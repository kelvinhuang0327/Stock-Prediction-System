# P0-COMBINED Date Format Hardening Audit

**Audit Date:** 2026-05-11
**Timebox:** 4 hours (WITHIN_4H)

## Summary
| Metric | Value |
|---|---|
| Hits Total | 11 |
| Real Leak Sites | 0 |
| False Positive Sites | 11 |
| Repair Sites | 0 |
| Timebox Status | WITHIN_4H |
| Recommended Action | PROCEED_TO_PART_B |

## Conclusion
Zero true leak sites. All `.replace(/-/g,"")` calls are intentional, correct conversions from ISO YYYY-MM-DD (returned by `resolveAsOfDate()`) to YYYYMMDD (DB format). The call chain is consistently: `resolveAsOfDate()` → YYYY-MM-DD → `.replace(/-/g,"")` → YYYYMMDD → DB query. No hardcoded 8-digit date literals in query code. No bare string date comparisons in query context.

## Sites (all FALSE_POSITIVE)
- **src/app/api/admin/data-quality/route.ts:28** — asOfDate.replace(/-/g,"") — Intentional YYYY-MM-DD→YYYYMMDD conversion after resolveAsOfDate(). DB format.
- **src/app/api/stocks/backtest/route.ts:90** — asOfDate.replace(/-/g,"") — Intentional YYYY-MM-DD→YYYYMMDD conversion. Uses in DB query via asOfDb.
- **src/app/api/stocks/[id]/detail/route.ts:198** — asOfDate.replace(/-/g,"") — Intentional YYYY-MM-DD→YYYYMMDD conversion. Consistent with DB format.
- **src/app/api/backtest/validate/route.ts:66** — asOfDate.replace(/-/g,"") — Intentional YYYY-MM-DD→YYYYMMDD conversion after resolveAsOfDate().
- **src/app/api/report/ops/route.ts:27** — asOfDate.replace(/-/g,"") — Intentional YYYY-MM-DD→YYYYMMDD conversion after resolveAsOfDate().
- **src/app/api/strategy/screen/route.ts:32** — asOfDate.replace(/-/g,"") → asOf param — StrategyScreenEngine.asOf expects YYYYMMDD. Consistent with DB format.
- **src/app/api/strategy/screen/route.ts:68** — asOfDate.replace(/-/g,"") → asOf param — Same as above — POST handler. Consistent.
- **src/lib/analysis/RuleBasedStockAnalyzer.ts:60** — asOf.replace(/-/g,"") — Local YYYYMMDD conversion. Used only for DB string comparison.
- **src/lib/backtest/BacktestRunner.ts:42** — dateStr.replace(/-/g,"") — Converting simulation loop date to YYYYMMDD for DB query.
- **src/lib/services/PredictionEngine.ts:42** — asOfDate comparison with today YYYYMMDD — Self-contained today check. Not a query injection point.
- **src/lib/services/StrategyScreeningService.ts:42** — asOfDate.replace(/-/g,"") — Local YYYYMMDD conversion for DB query. Consistent with pattern.