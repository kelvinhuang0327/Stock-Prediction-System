# P29F Static Audit Results

**Phase:** P29F-HARDRESET  
**Date:** 2026-05-20  
**Method:** Source code static analysis (read-only)

## Suspicious Field Scan

| Source | Fields | Suspicious Found | Verdict |
|--------|--------|-----------------|---------|
| Quote | close, open, high, low, volume, date, ... | None | CLEAN |
| Regime | date, value, change, changePercent | None | CLEAN |
| Chip | date, foreignBuy, trustBuy, dealerBuy, totalBuy | None | CLEAN |

No future-labeled, outcome-like, or label/target fields found in any source.

## Date Usage Scan

### Quote — FORMAT MISMATCH (MEDIUM_HIGH risk)

- **Gate:** `date: { lte: asOfDb }` where `asOfDb = asOf.replace(/-/g, '')` (YYYYMMDD)
- **Stored:** ISO format (`YYYY-MM-DD`) — from `parseTwseDateToIso` in `getDailyStocks()`
- **Mismatch:** ISO `'2026-xx-xx'` always `<` YYYYMMDD `'2026xxxx'` (ASCII `-`=45 `<` `'0'`=48)
- **Impact:** Same-year future records NOT excluded. Cross-year filtering correct.

### Regime — NO MISMATCH (LOW risk)

- **Gate:** `date: { lte: asOf }` (ISO direct)
- **Stored:** ISO format — confirmed from `syncMarketIndices` via `openapiDate`
- **ISO ≤ ISO:** Correct lexicographic comparison ✓

### Chip — FORMAT MISMATCH (MEDIUM risk)

- **Gate:** `date: { lte: asOfDb }` where `asOfDb = asOf.replace(/-/g, '')` (YYYYMMDD)
- **Stored:** ISO format — **CONFIRMED** in `syncInstitutionalChip`: `date: isoDate`
- **Schema comment:** Says `// YYYYMMDD` — **WRONG**
- **Impact:** Same mismatch as Quote

## Rolling Window Audit

| Window | Source | Direction | Status |
|--------|--------|-----------|--------|
| MA20, MA60 | Quote | Backward | ✓ SAFE |
| RSI(14) | Quote | Backward | ✓ SAFE |
| MACD (EMA12, EMA26) | Quote | Backward | ✓ SAFE |
| 20d momentum | Quote | Backward | ✓ SAFE |
| MA50, MA200 | Regime | Backward | ✓ SAFE |
| 20d momentum, 60d momentum | Regime | Backward | ✓ SAFE |
| 20d volatility | Regime | Backward | ✓ SAFE |
| Last 10 chip rows | Chip | Backward | ✓ SAFE |

## Caller Chain Audit

| Chain | asOf Passed | Status |
|-------|-------------|--------|
| ActiveScoringSnapshotBuilder → analyzeStock | YES | ✓ PASS |
| SignalFusionEngine → analyzeStock | YES | ✓ PASS |
| SignalFusionEngine → detectRegime | YES | ✓ PASS |
| POST /api/strategy/analyze | NO (live, expected) | INFO |
| DailyAlertEngine → detectRegime | NO (live, expected) | INFO |
| backtest → detectRegimeForPeriod | N/A (backtest) | INFO |

## Overall Static Audit Verdict

| Check | Result |
|-------|--------|
| Suspicious fields | ✓ CLEAN |
| Date format consistency | ⚠️ INCONSISTENT (Quote + Chip need repair) |
| Rolling windows | ✓ SAFE |
| Caller chain | ✓ SAFE |
