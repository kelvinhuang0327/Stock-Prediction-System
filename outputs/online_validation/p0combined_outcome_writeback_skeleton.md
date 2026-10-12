# P0-COMBINED Outcome Write-back v0 Skeleton

> NOT YET IMPLEMENTED — all functions throw NOT_YET_IMPLEMENTED
> No actual outcome row written. No future price lookup.

## 5D / 20D Outcome Definition

### Trading Days (not Calendar Days)
- **5D** = 5 consecutive Taiwan Stock Exchange (TWSE) trading days after the prediction asOfDate
  - Excludes weekends (Saturday, Sunday)
  - Excludes TWSE-designated holidays (New Year, Lunar New Year, etc.)
  - Approximately 1 calendar week under normal market conditions
- **20D** = 20 consecutive TWSE trading days after the prediction asOfDate
  - Same exclusions as 5D
  - Approximately 4 calendar weeks (1 month) under normal market conditions

### Source Date Validation Rules
- `sourceDate` must be a valid YYYY-MM-DD string
- `sourceDate` must be <= `asOfDate` (no future-date source data)
- `targetTradingDate` must be > `asOfDate` (outcome date is after prediction date)
- `targetTradingDate` must be <= `resolveAsOfDate()` at time of outcome write-back (no future price lookup)
- All price lookups must use `WHERE date = targetTradingDate AND date <= asOfDate_gate`

### PIT-Safe Requirements
- Point-in-time (PIT) safe means: no information leakage from future into past
- The price used for outcome must have been observable at the time of the outcome write-back gate
- `resolveOutcomePriceAsOf(symbol, targetDate, asOfDate)` must:
  - Return FUTURE_DATE_BLOCKED if targetDate > asOfDate
  - Query only StockQuote WHERE date = targetDate AND date <= asOfDate
  - Not call external APIs
  - Not use any data that would not have been available on asOfDate

## Stubs Exported (P1 must implement)
- `planOutcomeWriteBackTargets(entries, horizonDays)` — plans 5D/20D targets
- `resolveOutcomePriceAsOf(symbol, targetDate, asOfDate)` — PIT-safe price lookup
- `buildOutcomeWriteBackBatch(entries)` — builds batch of outcome records
- `validateOutcomeWriteBackBatch(batch)` — validates batch before write

## NOT YET IMPLEMENTED (this round)
- TWSE trading calendar loading
- Actual price lookup from StockQuote
- Outcome record creation
- Any return / priceDiff calculation (P2+ scope)
- DB write of outcome rows (P2+ scope)
- Win-rate / ROI aggregation (OUT OF SCOPE permanently for shadow log)