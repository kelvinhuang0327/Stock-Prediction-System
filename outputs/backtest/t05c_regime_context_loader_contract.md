# T-05C Regime Context Loader — Contract

**Task:** T-05C — Persisted MarketRegimeResult Loader for WalkForwardEngine  
**Date:** 2026-05-07  
**Labels:** T-05C | read-only loader | persisted MarketRegimeResult only | no regime recomputation | no production write | no DB write except read query | no external API | no LLM call | no strategy mutation | no performance claim

---

## Module

`src/lib/backtest/RegimeContextLoader.ts`

## Exports

| Export | Kind | Purpose |
|--------|------|---------|
| `loadRegimeContextMap()` | async function | Loads DB records → `Map<string, PersistedRegimeContext>` |
| `normalizeRegimeContextDateKey()` | function | Date/string → YYYY-MM-DD (UTC, deterministic) |
| `mapMarketRegimeResultToPersistedContext()` | function | DB row → `PersistedRegimeContext` |
| `validateRegimeContextCoverage()` | function | Coverage summary with PASS/WARN/FAIL |
| `InvalidDateKeyError` | class | Thrown for unrecognizable date input |
| `PrismaClientLike` | interface | Injectable Prisma mock interface |
| `RegimeContextCoverageSummary` | interface | Coverage output shape |
| `RegimeResultRow` | interface | DB row shape |

## DB Access Contract

- **Access type:** SELECT only via `findMany`
- **No INSERT, UPDATE, DELETE, or UPSERT**
- **Error behavior:** Returns empty `Map` on DB error — never throws
- **PrismaClientLike injectable:** Yes — allows test mocking without real DB

## normalizeRegimeContextDateKey

- Accepts: `Date` object, `YYYY-MM-DD` string, ISO string with time
- Returns: `YYYY-MM-DD` in UTC
- Deterministic, locale-independent
- Throws `InvalidDateKeyError` on invalid input

## mapMarketRegimeResultToPersistedContext

**Included fields (observability context):**  
`date`, `regimeLabel`, `confidence`, `taiexClose`, `source`, `version`

**Excluded fields (raw market indicators — not for regime context):**  
`taiexMa50`, `taiexMa200`, `taiexReturn1d`, `taiexReturn20d`, `taiexVolatility20d`,  
`marketBreadthProxy`, `evidenceJson`, `missingFeaturesJson`, `pitSafetyJson`,  
`id`, `createdAt`, `updatedAt`

**Unknown regimeLabel:** normalized to `LOW_CONFIDENCE` with warning  
**null fields:** preserved as `null`

## validateRegimeContextCoverage

| Coverage | Status |
|----------|--------|
| >= 90% | PASS |
| 50%–89% | WARN |
| < 50% | FAIL |
| No expected trading dates | WARN |

Expected trading dates use weekday approximation (Mon-Fri, excludes Sat/Sun).  
A full Taiwan trading calendar is needed for production accuracy (T-05D).
