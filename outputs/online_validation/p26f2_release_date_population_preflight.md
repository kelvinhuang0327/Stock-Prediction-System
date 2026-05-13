# P26F2-HARDRESET: Release Date Population Preflight

## Phase
P26F2-HARDRESET

## Date
2026-05-13

## Classification
**P26F_SOURCE_MAPPING_IMPLEMENTED_BUT_NO_REAL_COVERAGE**

## Summary

P26F implemented MonthlyRevenue source mapping but all `releaseDate` values are null (0% coverage). P26F2 adds the releaseDate population rule contract and dry-run candidate backfill.

## DB State

| Field | Value |
|---|---|
| Prisma MonthlyRevenue model found | ✅ Yes |
| `releaseDate` in Prisma schema | ✅ Yes (draft migration) |
| Migration applied | ❌ No |
| DB column exists | ❌ No |
| DB row count | 2143 |
| Year/Month coverage | 2026-02 (1070 rows), 2026-03 (1073 rows) |

## Candidate Release Dates

| Revenue Month | Candidate Release Date |
|---|---|
| 2026-02 | 2026-03-10 |
| 2026-03 | 2026-04-10 |

## Coverage Prediction

- Corpus asOfDate range: **2025-10-14 → 2026-02-11**
- Candidate dates: **2026-03-10, 2026-04-10**
- All candidate dates exceed corpus max → **0 coverage**

## Reason No Coverage

candidateReleaseDates (2026-03-10, 2026-04-10) all exceed corpus asOfDates max (2026-02-11)

## Frozen Corpus

| Corpus | Count |
|---|---|
| Simulation | 60 |
| P0 | 4500 |
| P1 | 9900 |
| P3 | 4500 |
| P19 | 4500 |

## Status

**PREFLIGHT_PASS** ✅
