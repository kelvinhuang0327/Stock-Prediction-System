# P25 MonthlyRevenue Distribution Audit

**Phase:** P25-HARDRESET Part C  
**Generated:** 2026-05-12T10:10:40.344Z  
**Validation Status:** `PASS`

## Summary

| Metric | Value |
|--------|-------|
| Total rows | 2143 |
| Rows with releaseDate | 2143 |
| Rows without releaseDate | 0 |
| Invalid releaseDate count | 0 |
| Duplicate stockId/year/month | 0 |
| Min releaseDate | 2026-03-10 |
| Max releaseDate | 2026-04-10 |

## releaseDateSource Distribution

- `INFERRED_NEXT_MONTH_10TH`: 2143

## releaseDateConfidence Distribution

- `LOW_TO_MEDIUM`: 2143

## Sample Inferred Rows

- stockId=1101 year=2026 month=2 releaseDate=2026-03-10 source=INFERRED_NEXT_MONTH_10TH
- stockId=1101 year=2026 month=3 releaseDate=2026-04-10 source=INFERRED_NEXT_MONTH_10TH
- stockId=1102 year=2026 month=2 releaseDate=2026-03-10 source=INFERRED_NEXT_MONTH_10TH
- stockId=1102 year=2026 month=3 releaseDate=2026-04-10 source=INFERRED_NEXT_MONTH_10TH
- stockId=1103 year=2026 month=2 releaseDate=2026-03-10 source=INFERRED_NEXT_MONTH_10TH

## Errors

✅ None

## Warnings

None

*Does not constitute investment advice. No ROI / win-rate / alpha / profit / outperform claims.*
