# T-07 Existing Scheduler / Freshness Guard Audit

**Audit Date:** 2026-05-06  
**Audited By:** T-07 Worker Agent  
**Status:** COMPLETE

---

## Summary

The Stock Prediction System has an **active TypeScript-based scheduler** (`local-autonomous-scheduler.ts` + `SchedulerStateEngine.ts`) and a Vercel Cron endpoint (`/api/cron/daily-sync`). Both write to production DB tables and call external TWSE APIs. **Neither is safe to directly hook the regime report pipeline into.**

**Verdict: Option  Standalone Python Pipeline**2 

---

## DB Tables Found

| Table | Exists | Rows |
|-------|--------|------|
| JobRunLog | 315 | | 
| SyncLog | 423 | | 
| DailyMarketSnapshot | 4 | | 
|  |DailyCandidateSnapshot |  | 
|  |DailyWatchlistSnapshot |  | 

---

## Scheduler Modules

| Module | Type | Writes DB | Calls External API | Safe to Reuse |
|--------|------|-----------|--------------------|---------------|
|  | TS daemon |   |JobRunLog |  | 
|  | Vercel Cron |   |Multiple |  | 
|  | TS module |   |SyncLog |  | 
|  | TS  |module |   | JobRunLog | 
|  | Python |  MarketIndex only (TWSE (with --dry-run guard) |) |  | 

---

## Reusable Components

1. `scripts/backfill-taiex-gap. TAIEX freshness check and safe backfillpy` 
2. `scripts/build-market-regime-classifier. P4-03 regime classifier (read-only)py` 
3. `scripts/build-portfolio-walk-forward-skeleton. T-05 walk-forward (read-only)py` 
4. `scripts/build-daily-regime-walkforward-report. T-06 daily report builder (read-only)py` 

## Components That Must NOT Be Reused

- `local-autonomous-scheduler. writes JobRunLog (production)ts` 
- `/api/cron/daily-sync/route. writes production tables, triggers external APIsts` 
- `DailySnapshotEngine. writes DailyMarketSnapshot/CandidateSnapshot/WatchlistSnapshotts` 
- `WalkForwardResult`  H001-H012 era, deprecatedtable 
- Any StrategySignal / SimulatedTrade / StrategyProposal tables

---

## Lane-Based Scheduler

- **Lane-based scheduler exists (SchedulerStateEngine manages job lanes):** 
- **Daily job lane exists (`autonomous:daily`, `training:daily_cycle`):** 
- **Regime report in daily  NOT yet scheduledlane:** 

---

## Recommendation

Create **standalone Python pipeline** (`scripts/run-daily-regime-aware-pipeline.py`).  
Do NOT modify TypeScript scheduler in T-07.  
Provide integration proposal for future TypeScript hook via `t07_scheduler_integration_proposal.md`.
