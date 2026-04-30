# Phase 1 — Taiwan Stock Orchestration Backend Audit

**Date:** 2026-04-30  
**Scope:** Read-only baseline audit. No production code modified.  
**System:** Taiwan Stock Trading Assistance System (Stock-Prediction-System)

---

## 1. Executive Summary

**Status: BACKEND_PARTIAL_BATCH_FUNCTIONS_EXIST**

The backend has a substantial set of existing batch-capable functions covering data sync, market regime detection, candidate screening, daily snapshot generation, signal effectiveness validation, and data quality checking. However, these functions are **not wired into a task queue with lifecycle management** at the Taiwan-stock domain layer. The existing `agent-orchestrator` infrastructure (planner/worker/scheduler) is present but currently oriented toward AI research task orchestration, not toward structured taiwan-stock domain task lanes (e.g., `DATA_SYNC_HEALTH`, `DAILY_MARKET_SNAPSHOT`, `CANDIDATE_SCREENING_DRY_RUN`).

A `JobRunLog` table with idempotency key and status lifecycle exists in the schema. The `JobOrchestrationService` in `src/lib/jobs/` provides worker claim and dedupe logic, but the registered job types are `autonomous:daily`, `autonomous:monitor`, `autonomous:review`, `autonomous:learning`, and training scheduler layers — all oriented toward the simulated autonomous trading pipeline, not the taiwan-stock reporting/screening domain.

No dry-run validator gate exists for domain-specific tasks such as candidate screening or market snapshot generation. No taiwan-stock-specific scheduler heartbeat or daily cap exists.

---

## 2. Existing Batch / Job Inventory

| Capability | File / Function | Current Trigger | Inputs | Outputs | Safe for Scheduler? | Notes |
|---|---|---|---|---|---|---|
| Daily Data Sync (full) | `src/app/api/cron/daily-sync/route.ts` → `runAllSyncs()` | `POST /api/cron/daily-sync` with `CRON_SECRET` | HTTP request | `SyncLog` records, snapshot creation | Yes (idempotent upsert) | Vercel Cron / external. Includes stock_master, stock_quote, metrics, market_index, chip, revenue, events |
| Stock Master Sync | `src/lib/services/syncService.syncBasicInfo()` | Inside daily-sync or manual | TWSE API | `Stock` table | Yes | |
| Daily Quote Sync | `src/lib/services/syncService.syncDailyQuotes()` | Inside daily-sync or manual | TWSE API | `StockQuote` table | Yes | |
| Market Index Sync | `src/lib/services/syncService.syncMarketIndex()` | Inside daily-sync or manual | TWSE API | `MarketIndex` table | Yes | |
| Institutional Chip Sync | `src/lib/services/syncService` | Inside daily-sync | TWSE API | `InstitutionalChip` table | Yes | |
| Monthly Revenue Sync | `src/lib/services/syncService` | Inside daily-sync | TWSE API | `MonthlyRevenue` table | Yes | |
| News Event Ingestion | `src/lib/events/EventIngestionService.syncAndStoreEvents()` | Inside daily-sync | External news sources | `NewsEvent` table | Yes (dedup by titleHash) | Has dry-run flag in EventIngestionService |
| Daily Snapshot | `src/lib/report/DailySnapshotEngine.createDailySnapshot()` | Inside daily-sync | DB state | `DailyMarketSnapshot`, `DailyCandidateSnapshot`, `DailyWatchlistSnapshot` | Yes (upsert by date) | |
| Daily Report Generation | `src/lib/report/DailyReportEngine.generateDailyReport()` | On-demand via API | DB state | JSON report in memory / API response | Partial — no persistence | Report is generated on-demand, not stored |
| Market Regime Detection | `src/lib/market/MarketRegimeEngine.detectRegime()` | Called by DailyReportEngine | `MarketIndex` table | `MarketRegimeResult` object | Yes | Not stored separately; embedded in snapshot |
| Candidate Screening | `src/lib/screen/StrategyScreenEngine.runScreen()` | Called by DailySnapshotEngine | `StockQuote`, `InstitutionalChip`, signals | `ScreenResult[]` | Partial | No dry-run guard; no output isolation |
| Alpha Signal Fusion | `src/lib/alpha/SignalFusionEngine.fuseBatch()` | Called by DailySnapshotEngine | DB stock signals | alpha scores | Partial | Embedded in snapshot, not a standalone task |
| Signal Effectiveness Eval | `src/lib/signals/SignalEffectivenessEngine` | Research experiments | `ExperimentRun` | `SignalEffectivenessResult` | Yes | Academic/research lane only |
| Walk-Forward Validation | `src/lib/signals/WalkForwardValidator` | Research experiments | historical data | `WalkForwardResult` | Yes | Academic lane |
| Data Quality Check | `src/lib/data/DataQualityChecker.ts` | On-demand via API | DB state | `QualityReport` | Yes | Returns score 0–100 |
| Data Coverage Check | `src/lib/data/CoverageService.ts` | On-demand via API | DB state | coverage tier info | Yes | |
| Portfolio Impact Snapshot | `src/lib/portfolio/PortfolioImpactSnapshotEngine` | Inside daily-sync | DB state | `PortfolioImpactSnapshot` | Yes | |
| Alert Generation | `src/lib/notify/DailyAlertEngine.generateDailyAlerts()` | Inside daily-sync | DB state | `PriceAlert` evaluations | Yes | |
| Notification Delivery | `src/lib/notify/NotificationDeliveryEngine.deliverAlerts()` | Inside daily-sync | alerts | `NotificationDeliveryLog` | Partial — external side effect | Sends to webhook/LINE/email |
| Autonomous Daily Cycle | `src/lib/jobs/autonomousJobRunners.ts` → `runDailyRunner()` | `JobOrchestrationService` (idempotency key) | DB state + LLM | `AutonomousResearchSnapshot`, `SimulatedTrade` | **NO — LLM required** | Currently scheduler-disabled |
| Backtest Execution | `src/lib/backtest/BacktestRunner.ts` | CLI (`npm run backtest`) | historical data | stdout/file | Partial — CLI only | No API trigger; no task lifecycle |
| Chip Anomaly Scan | `src/lib/scanners/ChipAnomalyScanner.ts` | Unknown / research | chip data | anomaly signals | Partial | No scheduler integration |
| Data Retention Cleanup | `src/lib/data/DataRetentionService.ts` | `POST /api/system/cleanup` (with dryRun param) | DB | deleted row counts | Yes (has dryRun) | Has explicit dry-run mode |

---

## 3. Data Flow Inventory

### Stock Data Sync
```
TWSE API → syncService → Stock / StockQuote / StockMetrics / MarketIndex / InstitutionalChip / MonthlyRevenue → SyncLog
Trigger: /api/cron/daily-sync (CRON_SECRET) or manual scripts
```

### Market Regime Detection
```
MarketIndex table → MarketRegimeEngine.detectRegime() → MarketRegimeResult
→ Embedded in DailyMarketSnapshot (snapshotDate, regime, regimeConfidence)
Stored: DailyMarketSnapshot (persisted per day, upsert-safe)
```

### Signal / Alpha Score Pipeline
```
StockQuote + InstitutionalChip + StrategySignal → SignalFusionEngine.fuseBatch()
→ alphaScore per stock → DailyCandidateSnapshot
Signal effectiveness: → ExperimentRun → SignalEffectivenessResult (research lane)
```

### Candidate Screening
```
StockQuote / InstitutionalChip / StrategySignal → StrategyScreenEngine.runScreen()
→ ScreenCandidate[] → DailyCandidateSnapshot (via DailySnapshotEngine)
No standalone candidate_screening task; embedded in snapshot flow
```

### Watchlist Monitoring
```
Watchlist → DailyWatchlistSnapshot (per trading day)
Alerts: DailyAlertEngine → PriceAlert evaluations → NotificationDeliveryLog
```

### Backtest
```
CLI only: scripts/backtest.ts or src/lib/backtest/BacktestRunner.ts
No API trigger path. No DB persistence for backtest results (stdout/file).
```

### Daily Report Generation
```
DailyReportEngine.generateDailyReport() → DailyReport JSON (in-memory)
→ Served via /api/report/daily
Not persisted independently; relies on reading DailyMarketSnapshot / DailyCandidateSnapshot / DailyWatchlistSnapshot
```

### Data Quality
```
DataQualityChecker → QualityReport (in-memory score 0-100)
CoverageService → CoverageReport
Both served on-demand via /api/data/quality
Not persisted; no historical trend tracking
```

---

## 4. Persistence / Runtime State

| State Type | Existing Table / File | Purpose | Gap |
|---|---|---|---|
| Job run log | `JobRunLog` (Prisma model) | Idempotency, status lifecycle, trigger source | Registered job names are autonomous/training only; no taiwan-stock task lanes |
| Sync log | `SyncLog` | Per-endpoint sync history (status, records, duration) | No daily-cap, no failure threshold gate |
| Daily market snapshot | `DailyMarketSnapshot` | Market regime per trading day | Populated by daily-sync cron; no scheduler heartbeat |
| Daily candidate snapshot | `DailyCandidateSnapshot` | Alpha candidates per day | Populated by daily-sync cron |
| Daily watchlist snapshot | `DailyWatchlistSnapshot` | Watchlist status per day | Populated by daily-sync cron |
| Notification delivery log | `NotificationDeliveryLog` | Alert send history | Exists, no retry queue |
| Portfolio impact snapshot | `PortfolioImpactSnapshot` | Sector/theme concentration per day | Exists |
| Scheduler state | `runtime/agent_orchestrator/scheduler_state.json` | Agent orchestrator enable/disable, schedule interval | schedulerEnabled=false; not connected to taiwan-stock tasks |
| Runs store | `runtime/agent_orchestrator/runs.json` | Agent orchestrator tick history | Separate from JobRunLog; all entries are skipped |
| LLM execution policy | `runtime/agent_orchestrator/llm_execution_policy_state.json` | LLM call gate | Hard-off since 2026-04-27 |
| Experiment run | `ExperimentRun` | Research validation experiments | Research lane only; not operational |
| Signal effectiveness | `SignalEffectivenessResult`, `WalkForwardResult`, `RegimeStratifiedResult` | Academic signal validation | Research lane only |
| Autonomous pipeline | `AutonomousResearchSnapshot`, `StrategyProposal`, `SimulatedTrade`, `TradeReviewReport`, `TradeJournalEntry`, `StrategyLearningInsight` | Simulated autonomous trading | LLM-dependent; currently disabled |
| Orchestrator settings | `OrchestratorSetting` | DB-stored settings (incl. scheduler toggle) | Exists |
| Task queue | `runtime/agent_orchestrator/task_index.json` + `tasks/` dir | Agent orchestrator task queue | Task types are AI research tasks; no taiwan-stock domain lanes |
| Data quality report | None — in-memory only | Data quality scoring | **GAP: no historical quality score table** |
| Backtest results | None — stdout/file only | Backtest run results | **GAP: no persistent backtest result table** |

---

## 5. Safety / Validation Inventory

| Guard | Exists? | File | Gap |
|---|---:|---|---|
| Data quality check (on-demand) | Yes | `src/lib/data/DataQualityChecker.ts` | Not run as a scheduled gate; no pass/fail threshold wired to task flow |
| CRON_SECRET header validation | Yes | `src/app/api/cron/daily-sync/route.ts` | Protects HTTP trigger; not applicable to local daemon |
| Idempotency key (job dedupe) | Yes | `src/lib/jobs/JobOrchestrationService.ts` | Only for autonomous job types; not for taiwan-stock batch tasks |
| Dry-run mode | Partial | `DataRetentionService`, `EventIngestionService` | dryRun param exists in 2 services; candidate screening has no dry-run |
| Data retention guard | Yes | `src/lib/data/DataRetentionService.ts` | dryRun flag exists |
| Sync failure logging | Yes | `SyncLog` table | Logs error string; no alerting on consecutive failure |
| LLM preflight gate | Yes | `src/lib/agent-orchestrator/llmExecutionPolicy.ts` | Only applies to LLM calls; data-sync batch functions bypass |
| Scheduler hard-off switch | Yes | `runtime/agent_orchestrator/llm_execution_policy_state.json` | Hard-off only applies to LLM-dependent tasks |
| Look-ahead bias detector | Yes (Python) | `src/validators/LookAheadBiasDetector.py` | Python only; not integrated into TypeScript pipeline |
| Monte Carlo validator | Yes (Python) | `src/validators/MonteCarloValidator.py` | Python only; standalone script |
| Survivorship bias filter | Yes (Python) | `src/validators/SurvivorshipFilter.py` | Python only; standalone script |
| Anti-overfit gate | Partial | `src/lib/signals/WalkForwardValidator.ts` | Research lane only; not a pre-run gate for operational tasks |
| Transaction cost guard | None | — | **GAP: no transaction cost / slippage check in screening output** |
| No-trade / no-signal fallback | None | — | **GAP: no explicit fallback when screening returns empty candidates** |
| Audit trail for task output | Partial | `JobRunLog.summary` + `metadata` (JSON) | Only for autonomous job types |
| Scheduler heartbeat | None | — | **GAP: no watchdog monitoring for missed daily runs** |

---

## 6. Backend Gaps

The following gaps are supported by direct repository evidence:

1. **No taiwan-stock task lane registry** — `AUTONOMOUS_JOB_REGISTRY` in `src/lib/jobs/autonomousJobRegistry.ts` defines only autonomous/training job types. No entries for `DATA_SYNC_HEALTH`, `DAILY_MARKET_SNAPSHOT`, `CANDIDATE_SCREENING_DRY_RUN`, etc.

2. **No dry-run gate for candidate screening** — `StrategyScreenEngine.runScreen()` has no dryRun parameter. Calling it always writes to `DailyCandidateSnapshot`. No output isolation for pre-production validation.

3. **No historical data quality score table** — `DataQualityChecker` produces an in-memory score but does not persist results. Cannot trend data quality over time.

4. **No backtest result persistence** — `BacktestRunner.ts` outputs to stdout/file. No `BacktestResult` table in schema. Cannot track backtest regression from scheduler.

5. **No task queue lifecycle for taiwan-stock batches** — The daily-sync cron route is a monolithic function with no per-step task status tracking. If step 4 fails, there is no way to resume from step 5.

6. **No daily cap for taiwan-stock tasks** — No maximum run count per day implemented for any domain batch function.

7. **No scheduler heartbeat** — No watchdog process verifies that `daily-sync` actually ran on a given trading day. Missed runs are undetectable.

8. **No explicit no-signal fallback** — When `StrategyScreenEngine.runScreen()` returns zero candidates, the snapshot is written with zero rows. No fallback signal or alert is triggered.

9. **No transaction cost guard in screening output** — Candidate recommendations do not include slippage or transaction cost estimates. `src/validators/SurvivorshipFilter.py` exists but is Python-only and not integrated.

10. **Autonomous pipeline disabled but daemon running** — The worker daemon (`scripts/run-orchestrator-worker-daemon.sh`) is alive (PID 498, 2995) but all ticks are skipped (`SCHEDULER_DISABLED`). 2,905 preflight events in 24h, 0 LLM calls. Daemon is consuming CPU polling every 60 seconds with no useful work.

11. **No cross-domain contamination guard** — `runtime/agent_orchestrator/project_profile.json` and `backlog.md` contain general AI research tasks, not taiwan-stock-specific task contracts. Risk of contamination from adjacent system task vocabulary.

---

## 7. Backend Recommendation

**WRAP_EXISTING_BATCHES_FIRST**

The core batch functions (`daily-sync`, `DailySnapshotEngine`, `StrategyScreenEngine`, `DataQualityChecker`) are functional and largely idempotent. The `JobOrchestrationService` with idempotency key and status lifecycle already exists and can be extended to taiwan-stock task lanes without new infrastructure. The recommended first step is to register taiwan-stock domain task types in the job registry, wrap the existing batch functions as orchestrated jobs, and add a dry-run gate to `StrategyScreenEngine` before connecting any task to an automated scheduler.

Do not start with a new task queue from scratch — the `JobRunLog` + `JobOrchestrationService` pattern is already proven in this codebase.
