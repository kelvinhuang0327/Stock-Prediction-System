# P0-02A: MVP API As-of Gate Audit

**Task**: P0-02A — MVP API As-of Gate Integration  
**Date**: 2026-05-07  
**Classification**: MVP API as-of gate integration | research tool only | no auto trading | no precision prediction claim | no DB write | no external API | no LLM call | no strategy mutation | no performance claim | no edge claim

---

## API Integration Status

| Route | Status | asOfDate Param | DB Queries Gated |
|---|---|---|---|
| /api/strategy/screen | **COMPLETE** | ✅ | stockQuote.groupBy via asOf |
| /api/stocks/[id]/detail | **COMPLETE** | ✅ | stockQuote.findMany date lte |
| /api/stocks/[id]/history | **BLOCKED** | ❌ | External proxy — no DB control |
| /api/stocks/backtest | **AUDIT_ONLY** | ❌ | Deferred to P0-03 |
| /api/backtest/validate | **AUDIT_ONLY** | ❌ | Deferred to P0-03 |
| /api/admin/data-quality | **COMPLETE** | ✅ | asOfReadiness summary added |
| /api/report/ops | **AUDIT_ONLY** | ❌ | Handled via data-quality |

---

## Future Date Protection

| Table | Status | Notes |
|---|---|---|
| StockQuote | GATED | date lte asOfDateDb in detail; asOf param in screen |
| MarketIndex | PARTIAL | Not directly queried in this scope |
| InstitutionalChip | PARTIAL | Via runScreen asOf param |
| NewsEvent | NOT_GATED | No direct queries in scope |
| fundamentals | NOT_GATED | year/quarter integers — no date gate possible |

---

## /api/stocks/[id]/history — BLOCKED

**Reason**: External API proxy via `twseApi.getHistorySeries()`. No Prisma DB queries. Cannot add `date <= asOfDate` filter to external response.

**Mitigation (P0-03)**: Add as-of quarantine middleware or wrap `twseApi` response with date filter at consumer level.

---

## /api/stocks/backtest + /api/backtest/validate — AUDIT_ONLY

**Gap**: `prisma.stockQuote.findMany` uses `gte` only — no upper date bound. Future rows can appear in backtest data.

**Fix (P0-03)**: Add `lte: asOfDateDb` to stockQuote queries in `backtestFromDB()` and validate route.

---

## Notes

- `resolveAsOfDate()` is the strict gate — throws `InvalidAsOfDateError` on invalid format
- asOfDate is converted to YYYYMMDD (no hyphens) for DB string comparison
- Existing `alphaScore` / `recommendationBucket` field names NOT modified
- No strategy weights changed
- No performance claims added
