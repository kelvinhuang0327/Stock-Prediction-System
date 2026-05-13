# P0-04 — MarketRegime As-of Gate Validation

**Task:** P0-04  
**Date:** 2026-05-07  
**Status:** COMPLETE  
**Disclaimer:** research tool only — no auto trading — no precision prediction claim — no DB write — no external API — no LLM call — no strategy mutation — no regime logic mutation — no performance claim — no edge claim

## MarketRegimeResult Schema

| Field | Type | Format |
|-------|------|--------|
| date | String | YYYY-MM-DD |
| regimeLabel | String | e.g. BULL, BEAR, Neutral |
| confidence | Float | 0.0–1.0 |
| source | String | nightly-sync etc. |
| version | String | e.g. v1 |

## getLatestMarketRegimeContext() Changes

| Aspect | Pre-P0-04 | P0-04 |
|--------|-----------|-------|
| DB query | `findFirst({ orderBy: { date: desc } })` | `findFirst({ where: { date: { lte: asOf } }, ... })` |
| Safety net | FUTURE_DATE_ERROR only for freshness check | Added explicit `row.date > asOf` rejection |
| asOf param | Not supported | `asOf?` optional arg |
| Response | `isAvailable: true` if row exists | `FUTURE_DATE_ERROR` if row.date > asOf |

## /api/daily-report/regime Changes

- Added `?asOfDate=YYYY-MM-DD` query param support
- `asOfDate` passed as 2nd arg to `getLatestMarketRegimeContext()`
- Response fields added: `asOfDate`, `asOfGateStatus`, `regime.sourceDate`
- `asOfGateStatus`: `ACTIVE` (asOf provided), `NOT_APPLIED` (no asOf), `ERROR`

## sourceDate Validation Rule

If `sourceDate > asOfDate` → `FUTURE_DATE_ERROR` → `isAvailable: false`

Does **not** fallback to returning the regime as bullish or valid.
