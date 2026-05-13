# P12 PIT Feature Contract v1

**Version:** p12-pit-feature-contract-v1  
**Generated:** 2026-05-13  
**Supersedes:** p12-pit-feature-contract-v0  

> No investment recommendations. No ROI, win-rate, profit claims. Research only.

---

## Feature Source PIT Status

| Source | PIT Status | Risk Level | Enters alphaScore | Enters Reason/Factor |
|--------|-----------|-----------|-------------------|----------------------|
| StockQuote | ALREADY_PIT_GATED | LOW | |  | 
| MarketRegime | ALREADY_PIT_GATED | LOW | |  | 
| InstitutionalChip | ALREADY_PIT_GATED | LOW | |  | 
| MonthlyRevenue | **REPAIRED_2026_05_12** | **REPAIRED | | ** | 
| FinancialReport | STILL_HIGH_RISK_NOT_PIT_ |GATED |  | HIGH | 
| NewsEvent | STILL_HIGH_RISK_NOT_PIT_ |GATED |  | HIGH | 

---

 v1

**MonthlyRevenue**: Previously described as `HIGH-RISK pending repair`. This is now **superseded**.  
As of 2026-05-12 (P17/P24/P25): `releaseDate` column added to schema, PIT gate enforced via `filterMonthlyRevenueAvailableAsOf()`.

Repair references: P17-HARDRESET, P24-HARDRESET, P25-HARDRESET.

---

## Remaining High-Risk Sources

- **FinancialReport**: Not used in scoring. If activated, must add `publishedDate` gate.
- **NewsEvent**: Not used in scoring. Must gate by `publishedAt`, NOT `ingestedAt`.

---

## Non-Goals

- Does not add FinancialReport or NewsEvent to scoring
- No activation date committed for FinancialReport or NewsEvent PIT gating repair
- Does not describe outcome fields (outcomePrice, returnPct, realizedReturnClass)
- Does not add any factor not already computed by RuleBasedStockAnalyzer + SignalFusionEngine

---

## Verdict: `CONTRACT_V1_COMPLETE`
