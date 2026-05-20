# P29F Source Discovery

**Phase:** P29F-HARDRESET  
**Date:** 2026-05-20

## Quote (StockQuote)

| Field | Value |
|-------|-------|
| DB Table | StockQuote |
| Schema date comment | `String // 交易日期 (YYYYMMDD or string format from API)` |
| Loader | `analyzeStock(symbol, asOf?)` in RuleBasedStockAnalyzer.ts |
| Sync source | `syncDailyQuotes()` → `getDailyStocks()` → `parseTwseDateToIso()` → **ISO format** |
| entersAlphaScore | YES |
| Alpha dependency | `technicalScore + momentumScore → overallScore → alphaScore` |
| Known risk | Date format mismatch: sync stores ISO, gate converts to YYYYMMDD |

## Regime (MarketIndex / MarketRegimeEngine)

| Field | Value |
|-------|-------|
| DB Table | MarketIndex |
| Schema date comment | `String // Date string` |
| Loader | `detectRegime(asOf?)` in MarketRegimeEngine.ts |
| Sync source | `syncMarketIndices()` → `getLatestMarketSnapshot()` → openapiDate → **ISO format** |
| entersAlphaScore | YES |
| Alpha dependency | regime context → `adjustedScore` in SignalFusionEngine |
| Known risk | `detectRegimeForPeriod` uses full period return (backtest-only, not scoring) |

## Chip (InstitutionalChip)

| Field | Value |
|-------|-------|
| DB Table | InstitutionalChip |
| Schema date comment | `String // YYYYMMDD` **(comment wrong — sync stores ISO)** |
| Loader | `analyzeStock()` → `calculateChipStrength()` |
| Sync source | `syncInstitutionalChip()` stores `isoDate` — **ISO format** |
| entersAlphaScore | YES |
| Alpha dependency | `chipStrength → chipScore → overallScore → alphaScore` |
| Known risk | Schema comment wrong; same date format mismatch as Quote |
