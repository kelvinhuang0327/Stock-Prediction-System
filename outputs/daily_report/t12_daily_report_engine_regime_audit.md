# T-12 DailyReportEngine Regime Audit

**Task**: T-12 — DailyReportEngine Deeper Integration  
**Audit Date**: 2026-05-06

---

## Engine File
`src/lib/report/DailyReportEngine.ts`

## API Route
`src/app/api/report/daily/route.ts`

---

## Pre-T-12 State

| Check | Status |
|-------|--------|
| `detectRegime()` used | ✅ Yes |
| Persisted `MarketRegimeResult` used | ❌ No |
| `freshnessAlert` included | ❌ No |
| `/api/report/daily` returns regime | ✅ Yes (via `regime` + `regimeConfidence`) |
| Forbidden fields in output | ❌ None |

## Post-T-12 State

| Check | Status |
|-------|--------|
| `detectRegime()` used (as fallback/diagnostic) | ✅ Yes |
| Persisted `MarketRegimeResult` as primary | ✅ Yes (`regimeContext.source = PERSISTED_MARKET_REGIME_RESULT`) |
| `freshnessAlert` included | ✅ Yes (in `regimeContext.freshnessAlert`) |
| `/api/report/daily` returns `regimeContext` | ✅ Yes |
| Forbidden fields in output | ❌ None |

---

## Audit Questions

| # | Question | Answer |
|---|----------|--------|
| Q1 | Fully replace `detectRegime()`? | **No** — retained as live source for backward-compatible `regime`/`regimeConfidence` fields |
| Q2 | Preserve fallback? | **Yes** — `regimeContext.source='UNAVAILABLE'`, `fallbackUsed=true` when persisted missing |
| Q3 | Persisted regime as primary for `regimeContext`? | **Yes** |
| Q4 | Stale/missing handling? | Stale: `freshnessAlert` has STALE/CRITICAL_STALE + warning. Missing: source='UNAVAILABLE' |
| Q5 | Modify `DailyReport` interface? | **Yes** — optional `regimeContext?` added to `MarketSummary` (backward compatible) |
| Q6 | Schema migration needed? | **No** — reads existing `MarketRegimeResult` table |

---

## Recommended Integration Strategy

- **Additive pattern**: `regimeContext` is an optional field on `MarketSummary`, so existing consumers are unaffected.
- `detectRegime()` continues to provide `regime` and `regimeConfidence` for backward compatibility.
- `getLatestMarketRegimeContext()` + `computeFreshnessAlert()` run in parallel with other fetches.
- `buildRegimeContextSummary()` handles the mapping from persisted context → `RegimeContextSummary`.
- No DB write, no external API, no schema migration.
