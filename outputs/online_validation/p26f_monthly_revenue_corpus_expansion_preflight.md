# P26F-HARDRESET: MonthlyRevenue Corpus Expansion Pre-flight

**Phase:** P26F-HARDRESET  
**Date:** 2026-05-13  
**Status:** PREFLIGHT_PASS

## Summary

| Check | Result |
|---|---|
| P26E Classification | P26E_PARTIAL_SOURCE_MAPPING_REQUIRED |
| Prisma MonthlyRevenue model | ✅ Found |
| Prisma releaseDate field | ✅ Found |
| DB MonthlyRevenue rows | 2143 |
| DB releaseDate populated | 0 |
| DB releaseDate null | 2143 |
| P3 corpus rows | 4500 |
| P19 corpus rows | 4500 |
| P19 all rows missing revenue | true |
| Missing releaseDate blocks all matches | true |
| Expected coverage | 0 |

## Frozen Corpus Counts

| Corpus | Rows |
|---|---|
| simulation | 60 |
| p0 | 4500 |
| p1 | 9900 |
| p3 | 4500 |
| p19 | 4500 |

## Frozen Scoring File SHA256

| File | SHA256 |
|---|---|
| ActiveScoringSnapshotBuilder.ts | 063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d |
| RuleBasedStockAnalyzer.ts | bc3716cc8e74be304f2e262aac586a61760bb59d6c95e82a575c38e03ea7373d |
| SignalFusionEngine.ts | b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4 |

## Key Finding

All 2143 MonthlyRevenue rows have `releaseDate = null`. The PIT gate requires non-null releaseDate. Therefore, expected coverage = 0.

The candidate corpus dry-run will confirm this: all rows will have `pitGateStatus: "NO_VISIBLE_SOURCE_ROW"`.

## Next Step

Implement candidate corpus dry-run (P26F-HARDRESET main execution).

---
*Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.*
