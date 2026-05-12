# P17-HARDRESET: Query Gate Code Patch — APPLIED ✅

> **Disclaimer:** Does not constitute investment advice. PIT gate governance only. No production DB writes. productionApplyAllowed=false.

**Date:** 2026-05-12

## Patched Files

### `src/lib/fundamentals/StockFundamentalSnapshot.ts`
- Added optional `releaseDate?`, `releaseDateSource?`, `releaseDateConfidence?` to `MonthlyRevenueLike` interface
- Backward-compatible (all fields optional)

### `src/lib/analysis/RuleBasedStockAnalyzer.ts`
- Import: `filterMonthlyRevenueAvailableAsOf` from MonthlyRevenueAvailability
- After Prisma fetch: `revenuesPIT = asOf ? filterMonthlyRevenueAvailableAsOf(revenues, asOf, { allowInferredReleaseDate: true }) : revenues`
- `revenueCount` now uses `revenuesPIT.length`
- YoY calc uses `revenuesPIT[0]` and `revenuesPIT.find(...)`
- **Scoring formula unchanged**: `clamp(50 + revenueYoY, 0, 100)`
- **alphaScore: unchanged**
- **recommendationBucket: unchanged**

### `src/lib/fundamentals/FundamentalResearchService.ts`
- Import: `filterMonthlyRevenueAvailableAsOf`
- `buildFundamentalResearchContextForSymbol` input: added optional `asOf?: string`
- After Prisma fetch: applies PIT filter when asOf present
- Peer context query: no asOf available (batch query) — left unfilterd for now

## PIT Gate Rule
`releaseDate <= asOfDate`
Inferred fallback: `allowInferredReleaseDate=true` → Taiwan next-month-10th rule

## Frozen
- Scoring formula: **unchanged**
- alphaScore / recommendationBucket: **unchanged**
- Frozen corpus: **unchanged**
- Forbidden outcome fields: **NOT used**
