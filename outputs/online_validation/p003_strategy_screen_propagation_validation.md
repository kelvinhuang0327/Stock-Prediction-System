# P0-03 — StrategyScreenEngine asOf Propagation Validation

**Task:** P0-03  
**Date:** 2026-05-07  
**Classification:** research_tool_only | no auto trading | no edge claim | no performance claim  
**Flags:** no DB write | no external API | no LLM call | no strategy mutation | no H001-H012

---

## Propagation Chain

```
/api/strategy/screen (asOfDate param)
  → StrategyScreenEngine.runScreen({ asOf })
      → fuseBatch(batchSymbols, asOf)        ← P0-03 change
          → fuseSignals(symbol, regime, asOf)  ← P0-03 change
              → analyzeStock(symbol, asOf)       ← P0-03 change
                  → stockQuote WHERE date <= asOfDb        ✓
                  → institutionalChip WHERE date <= asOfDb ✓
                  → monthlyRevenue WHERE year/month <= asOf ✓
```

## MarketIndex Path (AUDIT_ONLY)

MarketIndex is accessed inside `MarketRegimeEngine.detectRegime()`, which is shared with T-09/T-10 suites. Modifying this in P0-03 risks breaking existing regression tests. Deferred to P0-04.

## Strategy Mutation Check

- `alphaScore` — NOT modified
- `confidence` — NOT modified  
- `scoring weights` — NOT modified
- All `asOf` params are optional for backward compatibility

---

*P0-03 | observability-only | no edge claim | no production write | no DB write | no external API | no LLM call | no strategy mutation | no H001-H012*
