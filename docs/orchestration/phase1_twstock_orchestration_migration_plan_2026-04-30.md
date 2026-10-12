# Phase 1 — Taiwan Stock Orchestration Migration Plan

**Date:** 2026-04-30  
**Scope:** Read-only baseline audit. No production code modified in Phase 1.  
**System:** Taiwan Stock Trading Assistance System (Stock-Prediction-System)

---

## 1. Final Recommendation

**Status: READY_FOR_PHASE2_MINIMAL_ORCHESTRATION**

The codebase has sufficient batch function coverage, database schema, and job lifecycle infrastructure to support a minimal taiwan-stock orchestration layer without architectural redesign. The existing `JobOrchestrationService` + `JobRunLog` pattern is proven and reusable. The recommended Phase 2 scope is to wrap existing batch functions as orchestrated jobs, register taiwan-stock task types, and add a dry-run gate to candidate screening — before connecting anything to an automated scheduler.

No new queueing system is needed. No new DB tables are required for the minimal scope (only `DataQualityHistoryLog` is optional). No LLM dependency is needed for any taiwan-stock domain task.

---

## 2. Reusable Patterns (From Existing Codebase)

The following patterns exist in the codebase and should be directly reused for taiwan-stock task orchestration:

| Pattern | Source | Reuse For |
|---|---|---|
| Idempotency key construction | `src/lib/jobs/runJobWithOrchestration.ts` | Prevent duplicate daily-sync or snapshot tasks on same trading date |
| Job lifecycle (start / success / fail / skip) | `src/lib/jobs/JobOrchestrationService.ts` | Wrap every taiwan-stock batch function |
| `JobRunLog` persistence | `prisma/schema.prisma` → `JobRunLog` model | Job status tracking, heartbeat queries, UI read |
| Trigger source tagging | `src/lib/jobs/types.ts` → `JobTriggerSource` (api/cli/local_scheduler/os_cron) | Distinguish manual trigger from scheduler trigger |
| `AUTONOMOUS_JOB_REGISTRY` structure | `src/lib/jobs/autonomousJobRegistry.ts` | Pattern for `TAIWAN_STOCK_JOB_REGISTRY` |
| CRON_SECRET auth header | `src/app/api/cron/daily-sync/route.ts` | Protect any new cron-triggered routes |
| `SyncLog` per-endpoint records | `src/lib/data/SyncScheduler.ts` | Keep writing per-endpoint sync results (do not replace with JobRunLog) |
| Data quality check (on-demand) | `src/lib/data/DataQualityChecker.ts` | Run as `DATA_QUALITY_AUDIT` task, store result |
| DryRun flag pattern | `src/lib/data/DataRetentionService.ts`, `src/lib/events/EventIngestionService.ts` | Add same pattern to `StrategyScreenEngine` |
| Scheduler hard-off switch | `runtime/agent_orchestrator/llm_execution_policy_state.json` | Separate taiwan-stock scheduler toggle (do not share with AI research scheduler) |
| `OrchestratorSetting` table | `prisma/schema.prisma` | DB-persisted scheduler enable/disable for taiwan-stock tasks |

---

## 3. What Must NOT Be Copied

The following patterns exist in adjacent systems and must **not** be copied into the taiwan-stock orchestration layer:

| Pattern | Source | Why Not |
|---|---|---|
| LLM planner/worker/gate cycle | `src/lib/agent-orchestrator/plannerTick.ts`, `workerTick.ts` | Taiwan-stock batch tasks are deterministic; no LLM required. Adding LLM dependency would reintroduce quota and latency risk. |
| `backlog.md` + task contract generation | `src/lib/agent-orchestrator/providers.ts` | AI research backlog vocabulary is irrelevant to taiwan-stock domain; contamination risk. |
| `replan_required` retry logic | `src/lib/agent-orchestrator/plannerTick.ts` | Not needed for batch jobs that either succeed or fail; replan implies LLM revision. |
| `runs.json` / `task_index.json` flat-file state | `runtime/agent_orchestrator/` | Use `JobRunLog` (Prisma-persisted) instead; flat files are not transactional. |
| `copilot-daemon` provider polling | `src/lib/agent-orchestrator/workerTick.ts` | Worker daemon is an LLM execution environment. Taiwan-stock jobs run in the existing Next.js API process or CLI. |
| Simulated trade execution | `prisma/schema.prisma` → `SimulatedTrade`, `StrategyProposal` | Phase 2 taiwan-stock orchestration is data-quality + reporting only; no trade execution. |
| LotteryNew / betting-pool domain vocabulary | (external system — not present in this repo) | **Domain contamination hard-block.** Zero lottery / draw / odds / CLV / settlement vocabulary must appear in taiwan-stock task names or docs. |

---

## 4. Proposed Taiwan Stock Task Types

| Task Name | Description | Frequency | Idempotency Key Pattern | Output / Side Effect | Depends On | Notes |
|---|---|---|---|---|---|---|
| `DATA_SYNC_HEALTH` | Run all SyncScheduler jobs (stock_master, stock_quote, metrics, market_index, chip, revenue). Verify SyncLog success for each endpoint. | Daily (after market close) | `data_sync_health:{YYYY-MM-DD}` | `SyncLog` records | None | Replaces monolithic daily-sync without restructuring it; adds lifecycle tracking |
| `NEWS_EVENT_INGESTION` | Run `EventIngestionService.syncAndStoreEvents()`. Dedup by titleHash. | Daily | `news_event_ingestion:{YYYY-MM-DD}` | `NewsEvent` records | `DATA_SYNC_HEALTH` (loosely) | Has existing dry-run flag |
| `DAILY_MARKET_SNAPSHOT` | Run `DailySnapshotEngine.createDailySnapshot()`. Requires fresh StockQuote + MarketIndex. | Daily | `daily_market_snapshot:{YYYY-MM-DD}` | `DailyMarketSnapshot`, `DailyCandidateSnapshot`, `DailyWatchlistSnapshot` | `DATA_SYNC_HEALTH` | Existing upsert logic handles re-runs safely |
| `MARKET_REGIME_REFRESH` | Run `MarketRegimeEngine.detectRegime()` and update today's `DailyMarketSnapshot.regime` if confidence increased. | Daily | `market_regime_refresh:{YYYY-MM-DD}` | `DailyMarketSnapshot` (update) | `DAILY_MARKET_SNAPSHOT` | Optional: run only if new index data arrived after snapshot creation |
| `CANDIDATE_SCREENING_DRY_RUN` | Run `StrategyScreenEngine.runScreen()` in dry-run mode. Log candidate count and top-5 symbols without writing to `DailyCandidateSnapshot`. | Daily (pre-commit gate) | `candidate_screen_dry_run:{YYYY-MM-DD}` | `JobRunLog.summary` (no DB snapshot write) | `DATA_SYNC_HEALTH` | **Requires adding `dryRun` param to `StrategyScreenEngine` (Phase 2 work)** |
| `WATCHLIST_ALERT_DRY_RUN` | Run `DailyAlertEngine.generateDailyAlerts()` in dry-run mode. Log alert count without sending notifications. | Daily | `watchlist_alert_dry_run:{YYYY-MM-DD}` | `JobRunLog.summary` | `DAILY_MARKET_SNAPSHOT` | Allows review before notification delivery |
| `NOTIFICATION_DELIVERY` | Run `NotificationDeliveryEngine.deliverAlerts()`. Sends real alerts to webhook/LINE/email. | Daily (after dry-run passes) | `notification_delivery:{YYYY-MM-DD}` | `NotificationDeliveryLog` records | `WATCHLIST_ALERT_DRY_RUN` | External side effect — must not run in dry-run mode |
| `DATA_QUALITY_AUDIT` | Run `DataQualityChecker.check()`. Persist score + warnings. | Daily | `data_quality_audit:{YYYY-MM-DD}` | `JobRunLog.metadata` (score JSON) or new `DataQualityHistoryLog` row | None | If quality score < threshold, can block `CANDIDATE_SCREENING_DRY_RUN` |
| `PORTFOLIO_IMPACT_SNAPSHOT` | Run `PortfolioImpactSnapshotEngine.createPortfolioImpactSnapshot()`. | Daily | `portfolio_impact_snapshot:{YYYY-MM-DD}:{scope}` | `PortfolioImpactSnapshot` | `DAILY_MARKET_SNAPSHOT` | Already called inside daily-sync; extract into separate task for lifecycle tracking |
| `BACKTEST_VALIDATION_DRY_RUN` | Run a read-only backtest validation pass (no new parameter writes). Output stored in `ExperimentRun` (research lane). | Weekly or on-demand | `backtest_validation:{YYYY-WW}` | `ExperimentRun`, `WalkForwardResult` | `DATA_SYNC_HEALTH` | Weekly cadence; not daily. Only run if data coverage ≥ 250 days. |

---

## 5. Minimal Architecture for Phase 2

### Task Registry (New File: `src/lib/jobs/taiwanStockJobRegistry.ts`)

Mirror the structure of `autonomousJobRegistry.ts`. Map task type names to:
- `jobName: string` (used as idempotency key prefix and JobRunLog.jobName)
- `schedule: 'daily' | 'weekly' | 'on-demand'`
- `runner: () => Promise<JobRunResult>`
- `dependsOn?: string[]` (task names that must have status=success for today before this runs)

### Orchestration Flow (No LLM Required)

```
[OS cron / Vercel Cron / manual API trigger]
  → POST /api/tasks/run { taskName, scheduledFor }
    → TaiwanStockJobOrchestrator.runTask(taskName, scheduledFor)
      → JobOrchestrationService.start(idempotencyKey)   // dedupe gate
      → runner()                                         // actual work
      → JobOrchestrationService.complete(summary)        // persist result
    → return JobRunLog record
```

### Scheduler Toggle (Separate from AI Research Scheduler)

- Add a new entry in `OrchestratorSetting`: `key = 'taiwan_stock_scheduler_enabled'`
- API: `POST /api/orchestrator/taiwan-stock/scheduler { enabled: boolean }`
- Default: `false` (consistent with existing scheduler-off philosophy)
- Independent of `schedulerEnabled` in `runtime/agent_orchestrator/scheduler_state.json`

### Data Quality Gate

Before running `CANDIDATE_SCREENING_DRY_RUN`, check:
1. Latest `DATA_QUALITY_AUDIT` for today has status=success
2. Quality score in `JobRunLog.metadata` ≥ configured threshold (default: 60)
3. If gate fails: skip screening, log skip reason, alert via notification

---

## 6. Phase Roadmap

| Phase | Scope | Pre-Condition | Deliverables | Code Changes |
|---|---|---|---|---|
| **Phase 1** (this doc) | Baseline audit | — | 3 audit documents under `docs/orchestration/` | None — read-only audit |
| **Phase 2a** | Job registry + lifecycle wrappers | Phase 1 complete | `src/lib/jobs/taiwanStockJobRegistry.ts`, `TaiwanStockJobOrchestrator.ts`, updated `JobRunLog` queries | New files only; no modification to existing batch functions |
| **Phase 2b** | Dry-run gate for screening | Phase 2a complete | `dryRun` param in `StrategyScreenEngine.runScreen()`, `CANDIDATE_SCREENING_DRY_RUN` task | Modify `StrategyScreenEngine.ts` |
| **Phase 2c** | Data quality persistence | Phase 2a complete | `DataQualityHistoryLog` table (optional: store in `JobRunLog.metadata` first), quality gate logic | Schema migration + DataQualityChecker update |
| **Phase 2d** | UI: Job status board | Phase 2a complete | Job status board in `/settings/system`, scheduler heartbeat indicator, `POST /api/tasks/run` endpoint | New UI section + API route |
| **Phase 3** | Scheduler automation | Phase 2a–d complete, 2+ weeks stable manual operation | Connect task registry to OS cron / Vercel Cron; enable `taiwan_stock_scheduler_enabled` | Scheduler runner + cron config |
| **Phase 4** | Backtest regression | Phase 3 stable | Weekly `BACKTEST_VALIDATION_DRY_RUN` task, regression alert if walk-forward consistency degrades | New task + email/webhook alert |

---

## 7. Phase 2 Prompt

When proceeding to Phase 2, use the following as the context brief:

> **TAIWAN-STOCK SYSTEM ORCHESTRATION PHASE 2 — JOB REGISTRY AND LIFECYCLE WRAPPERS**
>
> Baseline audit complete (Phase 1, 2026-04-30). Three docs exist under `docs/orchestration/`.
>
> Phase 2a target:
> 1. Create `src/lib/jobs/taiwanStockJobRegistry.ts` — mirror structure of `autonomousJobRegistry.ts`, register task types: `DATA_SYNC_HEALTH`, `NEWS_EVENT_INGESTION`, `DAILY_MARKET_SNAPSHOT`, `MARKET_REGIME_REFRESH`, `WATCHLIST_ALERT_DRY_RUN`, `NOTIFICATION_DELIVERY`, `DATA_QUALITY_AUDIT`, `PORTFOLIO_IMPACT_SNAPSHOT`.
> 2. Create `src/lib/jobs/TaiwanStockJobOrchestrator.ts` — wraps existing batch functions using `JobOrchestrationService` (existing). Idempotency key: `{taskName}:{YYYY-MM-DD}`. No LLM required.
> 3. Create `src/app/api/tasks/run/route.ts` — POST endpoint accepting `{ taskName, scheduledFor }`. Validates `taskName` against registry. Runs task. Returns `JobRunLog` record.
> 4. Add `taiwan_stock_scheduler_enabled = false` entry to `OrchestratorSetting` table via migration (or use existing `OrchestratorSetting` upsert pattern).
>
> Constraints: No modification to existing batch functions. No LLM. No start of any scheduler. No schema breaking changes.
>
> Do not start Phase 2b (dry-run gate for StrategyScreenEngine) until Phase 2a is verified and stable.

---

## 8. Scope Confirmation

**Phase 1 audit scope strictly observed:**

- ✅ No production code was modified during this audit (with the exception of `src/lib/agent-orchestrator/storage.ts` `defaultSchedulerState()` change, which was a separate Phase 0 task completed prior to this audit — the AI research scheduler default is now `false`).
- ✅ No DB schema was modified.
- ✅ No scheduler was started.
- ✅ No background task was created.
- ✅ No commits were made.
- ✅ No lottery / betting-pool domain vocabulary appears in these documents.
- ✅ Date `2026-04-30` used in all filenames.
- ✅ All three documents created under `docs/orchestration/`.
