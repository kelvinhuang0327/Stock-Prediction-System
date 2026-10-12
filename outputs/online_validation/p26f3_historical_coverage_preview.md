# P26F3-HARDRESET — Historical Coverage Preview

**Date**: 2026-05-13  
**Classification**: P26F3_SOURCE_NOT_FOUND_TEMPLATE_ONLY

## Coverage Summary
| Metric | Value |
|---|---|
| P3 corpus rows | 4500 |
| P19 corpus rows | 4500 |
| Real source rows | 0 |
| Template-only rows | 125 |
| Real matched rows | 0 |
| Template matched rows | 9000 (NOT real coverage) |
| Real coverage ratio | 0 |

## Template Matched Note
Template rows have `revenueMissing=true` and `isRealSource=false`.  
Template matches are informational only — they do NOT represent real data coverage.

For 2026-01 month, candidateReleaseDate=2026-02-10 ≤ corpus asOfDate max (2026-02-11), so template rows "match" in date terms.  
However, since revenue=null, this is NOT actionable coverage.

## Data Gap Analysis
- DB current periods: 2026-02, 2026-03 only
- Required periods: 2025-09 through 2026-01
- Required candidate dates: 2025-10-10 through 2026-02-10
- Gap type: HISTORICAL_DATA_NOT_IN_DB
- Acquisition path: TWSE monthly revenue data (manual acquisition)

## Matched Symbols (template)
0055, 00712, 00738U, 00830, 00891, 00903, 1210, 1308, 1314, 1319, 1326, 1402, 1434, 1513, 1536, 1560, 1598, 1605, 1710, 1717, 1802, 2317, 2330, 2454, 6415

## Unmatched Symbols
None

**Next step**: P26F3-2 Manual Historical Source Acquisition (TWSE monthly revenue 2025-09 to 2026-01)
