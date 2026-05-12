# P18 Fixture DB Backfill — PASS

> **DISCLAIMER**: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.

## Result: PASS (23/23)

| Gate | Status |
|------|--------|
| SG1: Fixture DB exists from PART C | ✅ PASS |
| SG2: releaseDate column exists in fixture DB | ✅ PASS |
| S-Seed: 6 distinct rows seeded (duplicate S7 ignored) | ✅ PASS |
| S9: outcomePrice not in DB columns | ✅ PASS |
| S9: returnPct not in DB columns | ✅ PASS |
| S9: realizedReturnClass not in DB columns | ✅ PASS |
| S1: 2024-01 → releaseDate=2024-02-10 | ✅ PASS |
| S1: releaseDateSource=INFERRED_NEXT_MONTH_10TH | ✅ PASS |
| S1: releaseDateConfidence=LOW_TO_MEDIUM | ✅ PASS |
| S2: 2024-12 → releaseDate=2025-01-10 | ✅ PASS |
| S2: releaseDateSource=INFERRED_NEXT_MONTH_10TH | ✅ PASS |
| S3: explicit releaseDate=2024-04-15 preserved | ✅ PASS |
| S3: explicit releaseDateSource=EXPLICIT preserved | ✅ PASS |
| S8: 2026-06 → releaseDate=2026-07-10 | ✅ PASS |
| S9: no forbidden outcome fields in DB row | ✅ PASS |
| S10: pre-existing releaseDateSource preserved (INFERRED_NEXT_MONTH_10TH) | ✅ PASS |
| S10: pre-existing releaseDate=2024-03-10 preserved | ✅ PASS |
| S4: inferReleaseDate(null,1) = null | ✅ PASS |
| S5: inferReleaseDate(2024,null) = null | ✅ PASS |
| S6: inferReleaseDate(2024,13) = null (invalid month) | ✅ PASS |
| S6b: inferReleaseDate(2024,0) = null (invalid month) | ✅ PASS |
| All inferred rows have releaseDateConfidence=LOW_TO_MEDIUM | ✅ PASS |
| productionDbWritten=false | ✅ PASS |

## Backfill Summary

| Metric | Value |
|--------|-------|
| Total rows | 6 |
| Inferred | 4 |
| Preserved | 2 |
| Skipped | 0 |

## Key Results

| Scenario | Expected | Actual |
|----------|----------|--------|
| S1: 2024-01 | 2024-02-10 | 2024-02-10 |
| S2: 2024-12 | 2025-01-10 | 2025-01-10 |
| S3: explicit | 2024-04-15 (preserved) | 2024-04-15 |
| S8: 2026-06 | 2026-07-10 | 2026-07-10 |

## Safety

- `productionApplyAllowed`: `false`
- `productionDbWritten`: `false`
- Forbidden outcome fields not persisted: `outcomePrice, returnPct, realizedReturnClass, futurePrice, horizonReturnPct, outcomeDate, horizonDays, baselineResult, outcomeClose`
