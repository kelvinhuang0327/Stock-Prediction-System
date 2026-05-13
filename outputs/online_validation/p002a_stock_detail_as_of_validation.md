# P0-02A: Stock Detail As-of Gate Validation

**Task**: P0-02A — Stock Detail As-of Gate  
**Date**: 2026-05-07  
**Classification**: P0-02A | MVP API as-of gate integration | research tool only | no auto trading | no precision prediction claim | no DB write | no external API | no LLM call | no strategy mutation | no performance claim | no edge claim

---

## Integration Status: COMPLETE

`/api/stocks/[id]/detail` now supports `asOfDate` query param.

### Changes Made

- `src/app/api/stocks/[id]/detail/route.ts`:
  - Added `resolveAsOfDate` import from `@/lib/data/AsOfDataGate`
  - GET: `asOfDate` from `_req.nextUrl.searchParams.get('asOfDate')` → `resolveAsOfDate()`
  - `asOfDateDb = asOfDate.replace(/-/g, '')` for DB comparison
  - `stockQuote.findMany` → `where: { stockId: symbol, date: { lte: asOfDateDb } }`
  - `runScreen()` → `{ ..., asOf: asOfDateDb }`
  - `cacheKey` includes `asOfDate` to prevent stale cross-gate cache hits
  - Response: `asOfDate`, `asOfGateStatus: 'ACTIVE'`, `asOfGateNote`
  - `StockDetailResponse` interface: added 3 new fields

### Gated Queries

| Query | Status |
|---|---|
| `stockQuote.findMany` | ✅ GATED (`date lte asOfDateDb`) |
| `runScreen()` | ⚠️ PARTIALLY_GATED (via asOf param) |

### Known Limitations (Documented in response)

| Query | Status | Reason |
|---|---|---|
| `monthlyRevenue.findMany` | NOT_GATED | year/quarter integers only |
| `financialReport.findMany` | NOT_GATED | year/quarter integers only |
| `stockMetrics.findMany` | NOT_GATED | deferred to P0-03 |
| history | BLOCKED | External API proxy |

### history Route — BLOCKED

`/api/stocks/[id]/history` calls `twseApi.getHistorySeries()` — external API proxy.  
Cannot add `date <= asOfDate` filter. Documented in response `asOfGateNote`.  
**Mitigation**: P0-03 — wrap response with date filter.
