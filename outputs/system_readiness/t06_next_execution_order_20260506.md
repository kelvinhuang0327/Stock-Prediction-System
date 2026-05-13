# T-06 Next Execution Order

Generated: 2026-05-06

## Status

T-06 Daily Report Integration: **COMPLETE**

## Completed This Round

- [x] Existing Daily Report audit
- [x] Daily Report section contract (regimeAwareWalkForwardSummary)
- [x] build-daily-regime-walkforward-report.py (dry-run + output verified)
- [x] Daily Report section JSON + MD
- [x] Daily Ops Report JSON + MD (with do_not_interpret_as)
- [x] Guardrail validation (PASS, 21/21 checks)
- [x] Readiness decision

## Next Task: T-01/T-02 Scheduler Integration

### Priority

**P0 Immediate**: Integrate T-06 builder into T-01 lane-based scheduler for daily auto-trigger.

### Steps

1. Add `build-daily-regime-walkforward-report.py` to T-01 daily job lane
2. Add `regimeAwareWalkForwardSummary` section to `src/lib/report/DailyReportEngine.ts`
3. Verify T-02 freshness guard detects stale TAIEX and triggers backfill

### Blocked Items

- P4-04 chip features: ~236 trading days (need 500+)
- Revenue features: ~2 months (need 12+)
- Financial features: quarterly alignment + schema

## Do Not Start

- H013+ hypotheses
- Strategy optimization
- ROI backtesting
- Edge claims from skeleton results
