# P26E Coverage Ratio Scan

**Phase**: P26E-HARDRESET  
**Date**: 2026-05-13  
**Status**: PASS

## Corpus Total: 9000 rows (P3: 4500, P19: 4500)

## Per-Source Coverage

| Source | Coverage Count | Coverage Ratio | Classification | Fixture Only |
|--------|---------------|---------------|----------------|-------------|
| MonthlyRevenue | 0 | 0 | NONE | false |
| NewsEvent | 0 | 0 | NONE | true |
| FinancialReport | 0 | 0 | NONE | true |

## Summary

- anyRealCoverage: **false** (no corpus rows have MonthlyRevenue context field yet)
- allFixtureOnly: **false** (MonthlyRevenue has real source candidates)
- outcomeFieldsInSummary: **false** ✅

## Notes

- MonthlyRevenue source exists in Prisma but context field not yet populated in corpus
- NewsEvent and FinancialReport are fixture-only — counted separately, not as real corpus coverage
- Next step: P26F source mapping implementation for MonthlyRevenue
