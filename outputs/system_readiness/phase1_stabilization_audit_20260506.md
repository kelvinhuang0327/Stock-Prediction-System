# Phase 1 Stabilization Readiness Audit

**Task**: P4-01S — Evidence-First Data Foundation & Phase 1 Readiness Audit  
**Workstream**: E — Phase 1 Stabilization Readiness Audit  
**Date**: 2026-05-06  
**Evidence method**: Direct source file inspection + SQLite schema analysis + test file review

---

## Overall Status

| Task | Title | Status |
|---|---|---|
| T-01 | Lane-based scheduler + heartbeat | ⚠️ PARTIAL |
| T-02 | Unified freshness guard + dataCoverage write | ⚠️ PARTIAL |
| T-03 | Daily Ops Report v1 | ✅ DONE |
| T-04 | LLM hard-off / safe-run + missing-taskId alert | ✅ DONE |
| T-05 | Walk-forward backtest skeleton | ❌ DEPRECATED_OR_NEEDS_REDESIGN |

---

## T-01 — Lane-based Scheduler + Heartbeat

**Status: PARTIAL**

### What exists
- `src/lib/training/TrainingScheduler.ts` — 4-layer scheduler architecture:
  - `INTRADAY_MONITOR` — runs every 30 minutes
  - `DAILY_CYCLE` — runs nightly
  - `NIGHTLY_OPT` — optimization pass
  - `WEEKLY_DEEP` — deep analysis weekly
- `src/lib/training/TrainingSchedulerTypes.ts` — type definitions for `SchedulerLayer`, `LayerConfig`
- `JobRunLog` table in DB: 315 total runs, 22 distinct job names, success/fail/skip tracked

### What's missing
- **No heartbeat mechanism**: No periodic liveness ping to any monitoring endpoint
- **Stuck job detection**: 2 jobs currently stuck in `running` state in DB — no watchdog to clean these up
- **Lane isolation**: Roadmap specifies "lane" boundaries; current architecture uses shared layer queue
- **Automatic restart**: No watchdog that restarts a failed layer

### Gap impact for P4
Silent scheduler failures during multi-day backfill operations (P1 actions in Workstream B) will not be detected. This is an ops risk, not a P4 blocker per se.

---

## T-02 — Unified Freshness Guard + dataCoverage Write

**Status: PARTIAL**

### What exists
- `src/lib/autonomous/AutonomousDataLayer.ts` — `freshnessState()` function (149 lines)
- `src/app/api/stocks/[id]/detail/route.ts` — writes `dataCoverage` fields when stock data is fetched
- `DataCoverage` table in schema: `stockId`, `source`, `lastUpdated`, `tradingDaysAvailable`

### What's missing
- **No unified FreshnessGuard class**: Coverage checking is scattered across individual routes
- **No system-wide freshness registry**: No single source of truth for "is source X stale?"
- **No automatic stale-data gate**: P4-02/03/04 analyses could run on stale InstitutionalChip data (236 days) without any warning
- **No freshness alarm in Daily Ops Report**: Stale sources are not surfaced in T-03 report

### Gap impact for P4
P4-02 (Cross-Sectional Ranking) and P4-03 (Regime Classifier) depend on knowing exactly what data coverage is available. Without a unified freshness gate, analyses could silently degrade.

---

## T-03 — Daily Ops Report v1

**Status: DONE ✅**

### Evidence
- `src/app/api/report/daily/route.ts` — GET endpoint returning daily report JSON
- `src/lib/report/DailyReportEngine.ts` — report generation logic
- `src/app/report/daily/page.tsx` — frontend React page
- `SyncLog` table: 91 MarketIndices calls, 89 DailyQuotes, 61 RealRevenue, 61 StockMetrics, 58 BasicInfo — confirms active sync history visible to report

### Remaining gaps
- Heartbeat status not in report (T-01 dependency — not a T-03 blocker)
- Freshness alarms not surfaced (T-02 dependency — not a T-03 blocker)

**All core T-03 success criteria met.**

---

## T-04 — LLM Hard-Off / Safe-Run + Missing-TaskId Alert

**Status: DONE ✅**

### Evidence
- `src/lib/agent-orchestrator/llmExecutionPolicy.ts`:
  - `LlmExecutionMode = 'safe-run' | 'hard-off'` type defined
  - Enforcement logic blocks LLM calls in hard-off mode
- `src/app/components/LlmAuditPanel.tsx` — UI panel showing current LLM mode
- `src/lib/agent-orchestrator/__tests__/taskAttribution.test.ts`:
  - `COPILOT_MISSING_TASK_ID` alert test case confirmed
- 181/181 tests passing as of P3-14 handover

### All three success criteria met:
1. ✅ LLM calls blocked in hard-off mode
2. ✅ Missing taskId raises `COPILOT_MISSING_TASK_ID` alert
3. ✅ Mode visible in UI via LlmAuditPanel

---

## T-05 — Walk-Forward Backtest Skeleton

**Status: DEPRECATED_OR_NEEDS_REDESIGN ❌**

### What exists (now deprecated)
- `WalkForwardResult` table: **522 rows** of single-symbol rule-based walk-forward results
- Signals covered: `chip_accumulation`, `regime_shift`, `risk_cluster`, `strong_alpha`, `theme_diffusing`, `topic_surging`
- All correspond to **H001–H012 hypotheses**, which were fully retired in P3-14

### Why it must be redesigned
- H001–H012 are archived and must not drive active validation
- CTO `cto_analysis_20260506.md`: Classifies rule-only B-08 walk-forward as **DEPRECATE**
- Existing schema is single-symbol focused — cannot support portfolio-level walk-forward
- P4-04 requires: cross-sectional basket construction, regime conditioning, portfolio metrics (Sharpe, max drawdown, hit rate, turnover)

### Redesign recommendation
**P4-04** should build a new portfolio walk-forward engine:
- Rolling windows: 500d in-sample + 200d OOS
- Cross-sectional universe (all eligible symbols by trading date)
- Regime conditioning via P4-03 Market Regime Classifier output
- Portfolio-level metrics aggregated across all symbols per window
- New schema table (or migration of WalkForwardResult) required

**Action**: Archive or mark existing WalkForwardResult rows as `hypothesis_epoch = 'H001-H012 / RETIRED'` before P4-04 begins.

---

## Blocking Analysis for P4

### Blockers for P4-02 (Cross-Sectional Ranking)
- ⚠️ InstitutionalChip only 236 days — needs backfill to 500+ (Workstream B P1)
- ⚠️ Date normalization needed before cross-table joins

### Blockers for P4-03 (Market Regime Classifier)
- ❌ TAIEX freshness gap — 47 trading days stale (fix: `bulk-history-sync.py --phase index`)
- ❌ Date normalization needed

### Blockers for P4-04 (Portfolio Backtester)
- ❌ T-05 must be redesigned from scratch
- ⚠️ T-02 freshness gate needed to ensure analysis uses fully-covered data

### Non-blocking but important
- T-01 heartbeat missing — adds ops risk during multi-day backfills
- T-03 daily report available — can monitor backfill progress manually
