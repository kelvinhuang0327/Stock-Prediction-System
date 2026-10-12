# P12-HARDRESET Contract Validation Against P3 Corpus

**Date:** 2026-05-12  
**Status:** ✅ PASS  
**Contract Version:** p12-pit-feature-contract-v0

> **Disclaimer:** Contract validation only. No investment recommendations. No scoring changes. No corpus modifications.

## Validation Stats

| Metric | Value |
|--------|-------|
| Total Rows | 4500 |
| Passed | 4500 |
| Failed | 0 |
| Warnings | 0 |
| Fail Rate | 0.00% |

## Requirements Tested

- PIT-001: No future data in scoring features (proxied via asOfDate existence)
- PIT-002: pitGateDate == asOfDate in activeScoringSnapshot
- PIT-004: No forbidden snapshot fields (outcomePrice, returnPct, realizedReturnClass, etc.) in activeScoringSnapshot
- PIT-007: priceSource != mock-deterministic
- scoringCompletenessStatus present

## Violations (first 10)

| Row | Symbol | asOfDate | Issues |
|-----|--------|----------|--------|
*(none)*

## Conclusion

All P3 corpus rows pass PIT feature contract validation. No forbidden fields, no mock-deterministic prices, no pitGateDate divergence found.
