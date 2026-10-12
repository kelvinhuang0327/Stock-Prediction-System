# T-07 Scheduler Integration Proposal

**Date:** 2026-05-06  
**Strategy:** Option  Standalone Python Pipeline (no TypeScript scheduler modification)2 

---

## Rationale

The existing TypeScript scheduler (`local-autonomous-scheduler.ts` + `SchedulerStateEngine.ts`) writes to `JobRunLog` and `SyncLog` production tables, and the Vercel Cron endpoint (`/api/cron/daily-sync/route.ts`) writes `DailyMarketSnapshot`, calls external TWSE APIs for all data types, and triggers `generateDailyAlerts`. Hooking the regime report pipeline into these would risk:

1. JobRunLog pollution with non-strategy jobs
2. Race conditions with existing data sync lanes
3. Accidental production DB writes from the report pipeline

**Decision: Standalone Python pipeline runner, integration proposal for future TypeScript hook.**

---

## Current Entrypoint (T-07)

```bash
python3 scripts/run-daily-regime-aware-pipeline.py --dry-run
python3 scripts/run-daily-regime-aware-pipeline.py --date 2026-05-06 --apply
```

---

## Recommended Cron / Interval

| Setting | Value |
|---------|-------|
| Trigger | Daily at 19:00 TWN (after TWSE market close + data propagation) |
| Cron expression | `0 11 * * 1-5` (UTC, Mon-Fri) |
| Mode | `--apply` for production; `--dry-run` for testing |
| Timeout | 300 seconds (5 minutes) |
| Max retries | 1 (network-related TAIEX fetch only) |

---

## Freshness Guard Policy

1. Always run `backfill-taiex-gap.py --dry-run` first (stage 1, freshness_check).
 run `backfill-taiex-gap.py --apply`.
 mark stage DEGRADED, continue pipeline. Do NOT fabricate data.
4. Report `PASS_WITH_DEGRADED_FRESHNESS` in run summary.

---

## Artifact Validation Policy

- All required JSON artifacts must exist and parse.
 `FAIL_ARTIFACT_VALIDATION`.
- `do_not_interpret_as` must be present in Daily Ops Report.
- No forbidden fields in any JSON output.

---

## Rollback / Disable Policy

- To disable: rename or remove `scripts/run-daily-regime-aware-pipeline.py`.
- To rollback: the pipeline writes no production DB tables except MarketIndex (TAIEX only).
- No TypeScript scheduler changes are needed to disable.
- If TAIEX backfill caused incorrect rows: delete them from `MarketIndex` by date range.

---

## Future TypeScript Integration Path

When Phase 1 stabilization is complete and a TypeScript scheduler lane is ready:

1. Add `regime_report` job lane to `SchedulerStateEngine` config.
2. Create `src/lib/jobs/RegimeReportJobRunner.ts` that wraps `run-daily-regime-aware-pipeline.py` via `child_process.spawn`.
3. Register in `autonomousJobRegistry.ts` with:
   - `jobName: 'regime:daily_report'`
   - `cronExpression: '0 11 * * 1-5'`
   - `runMode: 'live_run'`
4. Write `JobRunLog` entry for regime_report lane (separate from strategy lanes).
5. Expose status via `/api/autonomous/scheduler-status` endpoint.

**Prerequisite:** T-01 Lane-based scheduler must be DONE with clean lane separation.

---

## Safety Invariants (Permanent)

These must hold regardless of integration path:

- No StockQuote mutation.
- No production DB write (except MarketIndex via approved backfill).
- No buy/sell signal.
- No strategy validation or ROI calculation.
- No H001-H012 code reuse.
- External API limited to TAIEX TWSE endpoint.
