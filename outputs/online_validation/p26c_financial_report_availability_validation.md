# P26C FinancialReport Availability PIT Leakage Validation

**Generated:** 2026-05-13

> No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.

## Results

- ✅ **CHECK 1: availabilityDate <= asOfDate is visible**: filingDate=2026-05-10
- ✅ **CHECK 2: availabilityDate > asOfDate is excluded**: filingDate=2026-05-20
- ✅ **CHECK 3: periodEndDate before asOf does not grant visibility**: periodEndDate=2025-12-31, filingDate=2026-06-15
- ✅ **CHECK 4: fiscalYear/fiscalQuarter do not decide visibility**: fiscalYear=2025, fiscalQuarter=Q4
- ✅ **CHECK 5: ingestedAt early does NOT grant visibility to future filingDate**: ingestedAt=2026-05-12T08:00:00Z, filingDate=2026-05-20
- ✅ **CHECK 6: ingestedAt late does NOT block past filingDate visibility**: ingestedAt=2026-05-15T08:00:00Z, filingDate=2026-05-10
- ✅ **CHECK 7: missing availability fields — not visible**: all availability null
- ✅ **CHECK 8: different symbol not in target context**: targetSymbol=2330
- ✅ **CHECK 9: duplicate sourceHash excluded via dedup**: CASE_7 has same sourceHash as CASE_2
- ✅ **CHECK 10: output does not contain outcome fields**: clean
- ✅ **CHECK 11: no buy/sell/recommendation claims**: clean
- ✅ **CHECK 12: entersAlphaScore=false**: entersAlphaScore=false
- ✅ **CHECK 13: readOnly=true**: readOnly=true

## Summary

| Metric | Value |
|--------|-------|
| Total Checks | 13 |
| Passed | 13 |
| Failed | 0 |

## Classification

**`P26C_AVAILABILITY_VALIDATION_PASS`**
