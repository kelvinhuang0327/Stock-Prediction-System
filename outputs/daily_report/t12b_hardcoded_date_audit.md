# T-12b Hardcoded Date Audit

**Task:** T-12b — Dynamic Current Date Source
**Date:** 2026-05-06

## Runtime Hardcoded Dates Found → RESOLVED

| File | Line | Original | Status |
|------|------|----------|--------|
| `src/lib/marketRegimeResult.ts` | 61 | `export const DEFAULT_CURRENT_DATE = '2026-05-06'` | ✅ REMOVED |
| `src/app/api/daily-report/regime/route.ts` | 14 | `const REPORT_DATE = '2026-05-06'` | ✅ REMOVED |
| `src/lib/report/OpsReportEngine.ts` | 19 | `import { ..., DEFAULT_CURRENT_DATE }` | ✅ REMOVED |
| `src/lib/report/OpsReportEngine.ts` | 186 | `buildDailyOpsReport(currentDate = DEFAULT_CURRENT_DATE)` | ✅ REMOVED |

## Test Fixtures — Preserved or Updated

| File | Usage | Action |
|------|-------|--------|
| `t09_market_regime_service.test.ts` | Explicit arg `'2026-05-06'` | ✅ PRESERVED |
| `t11_freshness_alert.test.ts` | Explicit arg `'2026-05-06'` | ✅ PRESERVED |
| `t03_ops_report_engine.test.ts` | Explicit arg `'2026-05-06'` | ✅ PRESERVED |
| `t09_market_regime_api.test.ts` | Depended on hardcoded `REPORT_DATE` | ✅ UPDATED — added `jest.mock('@/lib/time/currentDate')` |
| `t11_freshness_alert_api.test.ts` | Value-agnostic `toHaveProperty('reportDate')` | ✅ UPDATED — added mock for consistency |
| `t03_ops_report_api.test.ts` | `buildDailyOpsReport` fully mocked | ✅ UPDATED — added mock for route isolation |

## Key Answers

1. **Runtime code still has hardcoded date?** NO — all removed.
2. **Test code can preserve fixed date?** YES — explicit args and mocks both work.
3. **Date provider needed?** YES — `src/lib/time/currentDate.ts` created.
4. **API contract changed?** Minor. `GET()` now optionally accepts `NextRequest`. Backward-compatible.
5. **DB migration needed?** NO.
6. **Timezone risk?** Low — `getCurrentDateISO()` uses UTC via `toISOString()`.
