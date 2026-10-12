# T-09 DailyReportEngine Integration Proposal

**Date:** 2026-05-06

## Current State

`DailyReportEngine.ts` calls `detectRegime()` (live compute from MarketIndex) to build `MarketSummary`. This is the in-memory `MarketRegimeResult` interface from `MarketRegimeEngine.ts`.

The persisted `MarketRegimeResult` Prisma table (300 rows, 2025-01-15 to 2026-05-06) is NOT yet used by the TypeScript report engine.

## Proposed Integration (T-12)

Update `buildMarketSummary()` in `DailyReportEngine.ts`:

1. Call `getLatestMarketRegimeContext()` from `src/lib/marketRegimeResult.ts`
2. If `isAvailable === true` and `freshnessStatus === 'FRESH'`: use persisted regime as primary source
3. If `STALE` or `MISSING`: fall back to `detectRegime()` with a staleness warning in `MarketSummary.limitations`
4. Add `persistedRegimeDate` and `persistedRegimeSource` fields to `MarketSummary` for observability

## Guardrails for T-12

- Must NOT add buy/sell/signal/ROI/win-rate/alpha/edge/profit/recommendation/outperform to MarketSummary
- Must NOT use regime label as trading signal
- Must NOT change existing MarketSummary interface contract (additive only)
- Must NOT write to DB

## Why Not Done in T-09

T-09 scope is limited to: Prisma Client verification + new service + new API route + tests. DailyReportEngine integration requires careful interface extension and is deferred to T-12 to keep scope clean.
