# P4-03b TAIEX Freshness  After BackfillGap 

Generated: 2026-05-06

## Before vs After

| Field | Before | After |
|-------|--------|-------|
| TAIEX max date | 2026-05-05 | 2026-05-06 |
| TAIEX row count | 766 | 767 |
| Rows inserted | - | 1 (2026-05-06 = 41138.85) |
| Non-ISO TAIEX | 0 | 0 |
| Duplicate dates | - | 0 |
| StockQuote max | 2026-05-18 | 2026-05-18 (unchanged) |
| StockQuote count | 129151 | 129151 (unchanged) |

## Remaining Gap

- Remaining gap: 2026-05-07 to 2026-05-18
- Reason: FUTURE_DATA_NOT_YET_PUBLISHED
- StockQuote contains 1355 rows dated 2026-05-18 (12 days in the future from today 2026-05-06)
- TWSE does not publish future TAIEX data; gap cannot be resolved by backfill

## Resolution Status

- TAIEX updated to today (2026-05-06): DONE
- Regime classifier can classify today market: YES
- StockQuote not modified: YES
- MarketIndex dates 100% ISO: YES
- Non-ISO count: 0
- Duplicate TAIEX dates: 0
- StockQuote synthetic future data (2026-05-18): ACKNOWLEDGED, no TAIEX until that date arrives
