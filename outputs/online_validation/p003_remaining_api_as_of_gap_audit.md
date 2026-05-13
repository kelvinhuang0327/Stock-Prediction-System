# P0-03 — Remaining API As-of Gap Closure — Audit

**Task:** P0-03  
**Date:** 2026-05-07  
**Classification:** research_tool_only | no auto trading | no edge claim | no performance claim  
**Flags:** no DB write | no external API | no LLM call | no strategy mutation | no H001-H012

---

## Route-by-Route Status

| Route / Component | P0-02A Status | P0-03 Status | Notes |
|---|---|---|---|
| /api/stocks/[id]/history | BLOCKED | **COMPLETE** | External proxy; response-level filter added |
| /api/stocks/backtest | AUDIT_ONLY | **COMPLETE** | `lte: asOfDb` on stockQuote, asOfDate/asOfGateStatus in response |
| /api/backtest/validate | AUDIT_ONLY | **COMPLETE** | `lte: asOfDb` on stockQuote, asOfDate/asOfGateStatus in response |
| /api/report/ops | AUDIT_ONLY | **COMPLETE** | asOfReadiness block added |
| StrategyScreenEngine | PARTIAL | **COMPLETE** | Passes asOf to fuseBatch |
| SignalFusionEngine / fuseBatch | PARTIAL | **COMPLETE** | asOf? propagated down to analyzeStock |
| RuleBasedStockAnalyzer | — | **COMPLETE** | All 3 DB queries gated (stockQuote, institutionalChip, monthlyRevenue) |
| InstitutionalChip query path | PARTIAL | **COMPLETE** | `date: { lte: asOfDb }` in RuleBasedStockAnalyzer |
| MarketIndex query path | AUDIT_ONLY | **AUDIT_ONLY** | Via MarketRegimeEngine, defer to P0-04 |

---

## Key Implementation Notes

### /api/stocks/[id]/history
- External proxy: cannot gate at TWSE source
- Response-level filter: `gatedHistory = history.filter(row => row.date <= asOfDate)`
- Response includes: `asOfGateStatus`, `futureRowsExcluded`, `limitation`

### RuleBasedStockAnalyzer
- `stockQuote.findMany`: `date: { lte: asOfDb }`
- `institutionalChip.findMany`: `date: { lte: asOfDb }`
- `monthlyRevenue.findMany`: `OR: [{ year: { lt: asOfYear } }, { year: asOfYear, month: { lte: asOfMonth } }]`

### MarketIndex (AUDIT_ONLY)
- MarketIndex is queried via `MarketRegimeEngine.detectRegime()`
- This engine is shared with T-09/T-10 suites
- Modifying it risks regression — deferred to P0-04

---

*P0-03 | observability-only | no edge claim | no production write | no DB write | no external API | no LLM call | no strategy mutation | no H001-H012*
