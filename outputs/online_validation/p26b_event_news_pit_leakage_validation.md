# P26B Event/News PIT Leakage Validation (PART F)

**Generated:** 2026-05-13
**Verdict:** `P26B_PIT_LEAKAGE_VALIDATION_PASS`

> No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.

## Summary

| Metric | Value |
|--------|-------|
| Total checks | 10 |
| Passed | 10 |
| Failed | 0 |

## Check Results

- ✅ **CHECK 1: publishedAt <= asOfDate is visible**: publishedAt=2026-05-10T09:00:00Z, ingestedAt=2026-05-15T08:00:00Z
- ✅ **CHECK 2: publishedAt > asOfDate is excluded**: publishedAt=2026-05-20T09:00:00Z, ingestedAt=2026-05-12T08:00:00Z
- ✅ **CHECK 3: ingestedAt early does NOT grant visibility to future publishedAt**: ingestedAt=2026-05-12T08:00:00Z (before asOf) but publishedAt=2026-05-20T09:00:00Z (future) → correctly excluded
- ✅ **CHECK 4: ingestedAt after asOfDate does NOT block past publishedAt visibility**: ingestedAt=2026-05-15T08:00:00Z (after asOf) but publishedAt=2026-05-10T09:00:00Z → correctly visible
- ✅ **CHECK 5: missing publishedAt is not visible**: publishedAt=null
- ✅ **CHECK 6: different symbol event not in target symbol context**: event symbol=0050, target=2330
- ✅ **CHECK 7: output does not contain outcome fields**: clean
- ✅ **CHECK 8: output does not contain buy/sell/recommendation claims**: clean
- ✅ **CHECK 9: output marks entersAlphaScore=false**: entersAlphaScore=false
- ✅ **CHECK 10: output marks readOnly=true**: readOnly=true

## Verdict

`P26B_PIT_LEAKAGE_VALIDATION_PASS`
