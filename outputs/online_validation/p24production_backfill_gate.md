# P24-HARDRESET: Production Backfill Gate

**Generated:** 2026-05-12T07:18:00.085Z  
**Backfill Status:** ✅ PASS  
**Migration Status:** ✅ PASS  

## Backfill Rule

- releaseDate = 10th day of the month following the revenue month
- releaseDateSource = `INFERRED_NEXT_MONTH_10TH`
- releaseDateConfidence = `LOW_TO_MEDIUM`
- Does NOT overwrite explicit releaseDates
- Skips rows with invalid year/month

## Row Counts

| Metric | Count |
|--------|-------|
| Total rows scanned | 2143 |
| Rows backfilled | 2143 |
| Rows skipped (already had releaseDate) | 0 |
| Invalid rows (null after backfill) | 0 |

## releaseDate Source Distribution

| Source | Count |
|--------|-------|
| INFERRED_NEXT_MONTH_10TH | 2143 |

## Sample Backfilled Rows

| Stock | Year | Month | Release Date |
|-------|------|-------|-------------|
| 1101 | 2026 | 2 | "2026-03-10 00:00:00.000" |
| 1102 | 2026 | 2 | "2026-03-10 00:00:00.000" |
| 1103 | 2026 | 2 | "2026-03-10 00:00:00.000" |
| 1104 | 2026 | 2 | "2026-03-10 00:00:00.000" |
| 1108 | 2026 | 2 | "2026-03-10 00:00:00.000" |

## Backfill Status: PASS

✅ Backfill complete. Safe to proceed to post-migration validation.

---

*DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.*
