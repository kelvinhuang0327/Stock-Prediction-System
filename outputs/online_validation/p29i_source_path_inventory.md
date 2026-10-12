# P29I Phase 1 — Source Path Inventory

**Phase:** P29I  
**Date:** 2026-05-20

## alphaScore-Permitted Sources (Quote / Regime / Chip)

### Quote (StockQuote)

| Attribute | Value |
|-----------|-------|
| DB Table | `StockQuote` |
| Date Field | `date` (ISO YYYY-MM-DD — stored via `parseTwseDateToIso`) |
| Source File | `src/lib/analysis/RuleBasedStockAnalyzer.ts` |
| Data Input | `syncService.ts → syncDailyQuotes → parseTwseDateToIso` |
| Transformation | `analyzeStock(symbol, asOf)` → `stockQuote.findMany(date lte asOfIso)` → MA/RSI/MACD |
| alphaScore Entry | `ActiveScoringSnapshotBuilder → analyzeStock(asOf) → SignalFusionEngine` |
| asOf Handling | `normalizePitDateToIso(asOf)` applied (P29F-Repair). ISO-to-ISO gate. ✅ |
| Future Data Risk | Latent only. Sync ingests current/past. No confirmed future records. |
| **P29F Result** | **PIT_SAFE_VERIFIED** |
| **P29I Conclusion** | **PASS_PIT_SAFE** |

### Regime (MarketIndex)

| Attribute | Value |
|-----------|-------|
| DB Table | `MarketIndex` |
| Date Field | `date` (ISO YYYY-MM-DD — stored via `openapiDate`) |
| Source File | `src/lib/market/MarketRegimeEngine.ts` |
| Data Input | `syncService.ts → syncMarketIndices → ISO date` |
| Transformation | `detectRegime(asOf)` → `marketIndex.findMany(date lte asOf)` → MA50/MA200/momentum |
| alphaScore Entry | `SignalFusionEngine → detectRegime(asOf) → regime label` |
| asOf Handling | ISO asOf passed directly. No format mismatch. ✅ |
| Future Data Risk | Low. All calculations backward-looking on PIT-gated data. |
| **P29F Result** | **PIT_SAFE_VERIFIED** |
| **P29I Conclusion** | **PASS_PIT_SAFE** |

### Chip (InstitutionalChip)

| Attribute | Value |
|-----------|-------|
| DB Table | `InstitutionalChip` |
| Date Field | `date` (ISO YYYY-MM-DD — stored as `isoDate`; schema comment "YYYYMMDD" is stale) |
| Source File | `src/lib/analysis/RuleBasedStockAnalyzer.ts` (`calculateChipStrength`) |
| Data Input | `syncService.ts → syncInstitutionalChip → isoDate` |
| Transformation | `analyzeStock(symbol, asOf)` → `institutionalChip.findMany(date lte asOfIso, take 60)` → last 10 net-flow |
| alphaScore Entry | `ActiveScoringSnapshotBuilder → analyzeStock(asOf) → SignalFusionEngine` |
| asOf Handling | `normalizePitDateToIso(asOf)` applied (P29F-Repair). ISO-to-ISO gate. ✅ |
| Future Data Risk | Latent + **publication lag** (T data published ~6pm on T). Post-close scoring: correct. Pre-market: assumption documented. |
| **P29F Result** | **PIT_SAFE_VERIFIED** (C-F05 publication lag → WARN_ASSUMPTION_REQUIRED) |
| **P29I Conclusion** | **PASS_PIT_SAFE_WITH_ASSUMPTION** |

## Blocked / Absent Sources

| Source | Status | alphaScore | Reason |
|--------|--------|------------|--------|
| MonthlyRevenue | `STRUCTURAL_PLACEHOLDER_ONLY` | ❌ NOT PERMITTED | Awaiting P26F4 operator source arrival |
| FinancialReport | `HIGH_RISK_SOURCE_ABSENT` | ❌ BLOCKED | Source absent; `filingDate` PIT path unverified |
| NewsEvent | `HIGH_RISK_SOURCE_ABSENT` | ❌ BLOCKED | Source absent; `publishedAt` vs `ingestedAt` separation unverified |

## Summary

| Source | PIT Status | Enters alphaScore |
|--------|-----------|-------------------|
| Quote | PIT_SAFE_VERIFIED ✅ | Yes (permitted) |
| Regime | PIT_SAFE_VERIFIED ✅ | Yes (permitted) |
| Chip | PIT_SAFE_VERIFIED ✅ + ASSUMPTION | Yes (permitted, post-close assumption) |
| MonthlyRevenue | STRUCTURAL_PLACEHOLDER_ONLY | No |
| FinancialReport | HIGH_RISK_SOURCE_ABSENT | No (blocked) |
| NewsEvent | HIGH_RISK_SOURCE_ABSENT | No (blocked) |
