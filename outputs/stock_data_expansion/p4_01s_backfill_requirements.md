# P4-01S — Backfill Requirements

**Task**: P4-01S — Evidence-First Data Foundation & Phase 1 Readiness Audit  
**Workstream**: B — Backfill Requirement Audit  
**Date**: 2026-05-06  

---

## Backfill Priority Matrix

| Data Source | Current | Required | Gap | Script Status | Priority |
|---|---|---|---|---|---|
| StockQuote date normalization | ROC contamination | ISO only | ~2701 bad rows | ✅ `normalize-dates.py` | **P0** |
| MarketIndex / TAIEX refresh | 2026-03-17 | 2026-05-18 | ~47 days | ✅ `bulk-history-sync.py --phase index` | **P0** |
| InstitutionalChip | 236 days | 1,250 days (5y) | 4.3 years | ✅ `backfill_chip_resilient.py` | **P1** |
| MonthlyRevenue | 2 months | 62 months (5y) | 5.0 years | ❌ No backfill script | **P1** |
| FinancialReport | 1 quarter | 20 quarters (5y) | 4.75 years | ⚠️ `ingest-financials.ts` (incremental only) | **P1** |
| StockQuote (wider universe) | 185 symbols ≥500d | 500+ symbols | — | ✅ `backfill_stock_quote_full.py` | **P1** |
| ShortSellingBalance | MISSING | 5y | ALL | ❌ No script, no table | **P2** |
| MarginBalance | MISSING | 5y | ALL | ❌ No script, no table | **P2** |
| DividendExRight | MISSING | 5y | ALL | ❌ No script, no table | **P2** |

---

## Execution Order (P0 → P1 → P2)

### P0 — Must complete before P4-02 or P4-03 can start

**Step 1: Date Normalization (StockQuote + MarketIndex)**
```bash
python3 scripts/normalize-dates.py
```
- Converts ROC-format dates (`1150327`) to ISO format (`2026-03-27`)
- Required for JOIN alignment between StockQuote and MarketIndex
- Estimated rows affected: ~2,701 in StockQuote, ~1 in MarketIndex

**Step 2: TAIEX Freshness Refresh**
```bash
python3 scripts/bulk-history-sync.py --phase index
```
- Catches TAIEX up from 2026-03-17 → 2026-05-18 (~47 trading days)
- Unblocks P4-03 Market Regime Classifier for current period

---

### P1 — Must complete before institutional flow / fundamental hypotheses

**Step 3: InstitutionalChip Backfill (5 years)**
```bash
python3 scripts/backfill_chip_resilient.py --start 2021-01-04
```
- Target: 2021-01-04 → 2025-05-01 (the missing 4+ years)
- Estimated rows: ~1.7M (1,358 symbols × ~1,250 trading days)
- Has retry/resume via `logs/chip_backfill_state.json`
- **Estimated time**: Multiple days at TWSE API rate limits

**Step 4: MonthlyRevenue Backfill (NEW SCRIPT NEEDED)**
- No existing backfill script — must build new one
- Target: 2021-01 → 2026-01 (62 months × ~1,074 symbols = ~66K rows)
- TWSE RealRevenue endpoint already used in SyncLog (61 calls) — pattern available
- **PIT offset**: Revenue released ~day 10 of following month — must store `announcedDate`

**Step 5: FinancialReport Historical Backfill (EXTEND EXISTING)**
- Extend `scripts/ingest-financials.ts` with historical mode
- Target: 2021-Q1 → 2025-Q3 (19 quarters × ~957 symbols = ~18K rows)
- **PIT offset**: Quarterly reports published ~45 days after quarter end
- **Schema gap**: Consider adding ROE, ROA, cashFlow fields to FinancialReport table

---

### P2 — New data sources (require schema + script creation)

**Step 6–8: ShortSelling / MarginBalance / DividendExRight**
- All three require new Prisma schema tables
- New ingest scripts targeting TWSE public APIs
- Lower priority for P4 (no planned hypotheses in near-term P4-02/03/04)

---

## Script Inventory (All Backfill-Related Scripts)

| Script | Source | Backfill? | Incremental? | API Needed? | Notes |
|---|---|---|---|---|---|
| `backfill_chip_resilient.py` | InstitutionalChip | ✅ | — | ✅ TWSE | Retry+resume |
| `backfill_stock_quote_full.py` | StockQuote | ✅ | — | ✅ TWSE | Batch+resume |
| `bulk-history-sync.py` | SQ + MI + Chip | ✅ | — | ✅ TWSE | Multi-phase |
| `normalize-dates.py` | SQ + MI | — | — | ❌ | Pure DB migration |
| `normalize_market_index_dates.py` | MarketIndex | — | — | ❌ | MI-specific |
| `targeted-chip-backfill.py` | InstitutionalChip | ✅ | — | ✅ TWSE | Lightweight, skips existing |
| `targeted_quote_sync.py` | StockQuote | — | ✅ | ✅ TWSE | Symbol-specific recent sync |
| `sync-2025-data.py` | StockQuote | ✅ | — | ✅ twstock | Requires pip install twstock |
| `ingest-financials.ts` | FinancialReport | ⚠️ | ✅ | ✅ TWSE | Incremental only |
| `run-tw-q1-financial-ingest-check.ts` | FinancialReport | — | — | ❌ | Audit/check only |
