# P0-04 — MarketIndex As-of Gate Audit

**Task:** P0-04  
**Date:** 2026-05-07  
**Status:** COMPLETE  
**Disclaimer:** research tool only — no auto trading — no precision prediction claim — no DB write — no external API — no LLM call — no strategy mutation — no regime logic mutation — no performance claim — no edge claim

## MarketIndex Schema

| Field | Type | Format |
|-------|------|--------|
| date | String | YYYY-MM-DD |
| name | String | e.g. TAIEX |
| value | Float | closing value |

## MarketIndex Query Paths

| Function | File | Pre-P0-04 | P0-04 Gate | Status |
|----------|------|-----------|------------|--------|
| `detectRegime(asOf?)` | MarketRegimeEngine.ts | NO date upper bound | `date: { lte: asOf }` when provided | **COMPLETE** |
| `detectRegimeForPeriod(s,e)` | MarketRegimeEngine.ts | `lte: endDate` | unchanged | ALREADY_SAFE |
| `buildRegimeTimeline(s,e)` | MarketRegimeEngine.ts | `lte: endDate` | unchanged | ALREADY_SAFE |

## Out-of-Scope Callers (P0-05 candidates)

The following callers of `detectRegime()` are not in the MVP analysis path and are deferred to P0-05:

- `/api/stocks/[id]/detail/route.ts`
- `/api/market/regime/route.ts`
- `RelevanceInsightsService.ts`
- `DailyAlertEngine.ts`
- `DailyReportEngine.ts`
- `PortfolioImpactEngine.ts`
- `AutonomousResearchEngine.ts`

## Backward Compatibility

`asOf?` is optional — all existing callers without asOf continue functioning unchanged.
