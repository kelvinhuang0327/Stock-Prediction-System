# P26D Scoring Invariance Check

**Phase:** P26D-HARDRESET  
**Generated:** 2026-05-13  
**Classification:** SCORING_INVARIANCE_CONFIRMED

## Corpus

| Corpus | Rows |
|--------|------|
| P3 | 4500 |
| P19 | 4500 |
| Total | 9000 |

## Invariance Results

- Mismatched alphaScore: **0** ✅
- Mismatched recommendationBucket: **0** ✅
- Null alphaScore rows: 9000

## Scoring File Baseline Checks

| File | Match |
|------|-------|
| ActiveScoringSnapshotBuilder.ts | ✅ |
| RuleBasedStockAnalyzer.ts | ✅ |
| SignalFusionEngine.ts | ✅ |

## Context Adapters Do Not Enter Scoring

- MonthlyRevenue: entersAlphaScore=false ✅
- NewsEvent: entersAlphaScore=false ✅
- FinancialReport: entersAlphaScore=false ✅

---
*No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.*
