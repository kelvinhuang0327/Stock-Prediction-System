# P17-HARDRESET: Query Gate Patch Validation

> **Disclaimer:** Does not constitute investment advice. PIT gate governance only.

**Date:** 2026-05-12  
**Status:** ALL_PASS  
**Score:** 18/18

## Results

| # | Scenario | Status |
|---|----------|--------|
| 1 | SC1: explicit releaseDate before asOfDate → available | ✅ PASS |
| 2 | SC2: explicit releaseDate == asOfDate → available (boundary) | ✅ PASS |
| 3 | SC3: explicit releaseDate after asOfDate → unavailable | ✅ PASS |
| 4 | SC4: missing releaseDate + allowInferred=false → unavailable | ✅ PASS |
| 5 | SC5: missing + allowInferred=true + asOf before inferred → unavailable | ✅ PASS |
| 6 | SC6: missing + allowInferred=true + asOf == inferred → available | ✅ PASS |
| 7 | SC7: missing year → unavailable | ✅ PASS |
| 8 | SC8: invalid month=0 → unavailable | ✅ PASS |
| 9 | SC9: filter excludes future/missing releaseDate records | ✅ PASS |
| 10 | SC10: no forbidden outcome fields in availability result | ✅ PASS |
| 11 | SG1: TAIWAN_REVENUE_RELEASE_DAY === 10 | ✅ PASS |
| 12 | SG2: INFERRED_RELEASE_DATE_SOURCE | ✅ PASS |
| 13 | SG3: INFERRED_RELEASE_DATE_CONFIDENCE | ✅ PASS |
| 14 | SG4: Dec inference → 2026-01-10 | ✅ PASS |
| 15 | SG5: validateMonthlyRevenueAvailabilityResult returns valid | ✅ PASS |
| 16 | SG6: explainMonthlyRevenueAvailability has rule + details | ✅ PASS |
| 17 | SG7: normalizeMonthlyRevenueReleaseDate handles Date object | ✅ PASS |
| 18 | SG8: productionApplyAllowed=false in script constants | ✅ PASS |

## Safety
- productionApplyAllowed: false
- No outcome/returnPct/realizedReturnClass used
- Scoring formula: unchanged
- alphaScore / recommendationBucket: unchanged