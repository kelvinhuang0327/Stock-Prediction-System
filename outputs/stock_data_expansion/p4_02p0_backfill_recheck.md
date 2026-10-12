# P4-02P0 — Backfill Readiness Recheck (Post-Repair)

**Task**: P4-02P0 — Date Normalization & MarketIndex Freshness Repair  
**Date**: 2026-05-06  

---

## Readiness Verdicts

| Phase | Status | Reason |
|---|---|---|
| **P4-02** | ✅ **CAN PROCEED** | StockQuote 100% ISO, 185 symbols ≥500d, JOIN safe |
| **P4-03** | ✅ **CAN PROCEED** | TAIEX 766 days, gap=1d, 100% ISO, JOIN safe |
| **P4-04** | ❌ **BLOCKED** | InstitutionalChip only 236d; MonthlyRevenue only 2026; FinancialReport only 2025 |

---

## Data Source Status

### StockQuote — ✅ READY

| Metric | Value |
|---|---|
| Rows | 129,151 |
| ISO ratio | 100.0% |
| Date range (effective) | 2021-05-16 → 2026-05-18 |
| Symbols with ≥500 rows | 185 |
| Symbols with ≥200 rows | 206 |
| Distinct symbols | 217 |
| Anomaly (1970-12-04 epoch) | ~10 rows, pre-existing, NOT introduced by normalization |
| Backfill needed | No (sufficient for P4-02/P4-03) |

---

### MarketIndex / TAIEX — ✅ READY

| Metric | Value |
|---|---|
| Total MarketIndex rows | 2,665 |
| ISO ratio | 100.0% |
| TAIEX rows | 766 |
| TAIEX date range | 2017-12-01 → 2026-05-05 |
| TAIEX freshness gap | 1 day (fresh) |
| Sector indices in table | 21+ |
| Sufficient for 500d window | ✅ YES |
| Backfill needed | No (sufficient for P4-03) |

---

### InstitutionalChip — ⚠️ PARTIAL (P4-04 BLOCKED)

| Metric | Value |
|---|---|
| Rows | 291,068 |
| ISO ratio | 100.0% |
| Date range | 2025-05-02 → 2026-05-05 |
| Distinct trading days | 236 |
| Target for P4-04 | ≥500 trading days |
| Gap | ~264 trading days |
| Backfill script | `scripts/bulk-history-sync.py --phase chip` |
| Script status | EXISTS but requires `twstock` module (unavailable in current Python env) |
| Action required | Fix Python environment or replace `twstock` with alternative fetch |

---

### MonthlyRevenue — ⚠️ PARTIAL (P4-04 BLOCKED)

| Metric | Value |
|---|---|
| Rows | 2,143 |
| Year range | 2026 only |
| Schema | `year` / `month` integer columns (not date string — correct, excluded from normalization) |
| Backfill needed | Yes — needs 2020–2025 history |
| Script | `scripts/bulk-history-sync.py --phase revenue` (requires `twstock`) |

---

### FinancialReport — ⚠️ PARTIAL (P4-04 BLOCKED)

| Metric | Value |
|---|---|
| Rows | 957 |
| Year range | 2025 only |
| Schema | `year` / `quarter` integer columns (not date string — correct, excluded from normalization) |
| Backfill needed | Yes — needs 2020–2024 history |
| Script | `scripts/bulk-history-sync.py --phase financials` (requires `twstock`) |

---

### Industry / Sector Mapping — ✅ SUFFICIENT FOR P4-03

| Metric | Value |
|---|---|
| Method | TWSE numeric code 01–38, 91 → Chinese name → GICS-like sector group |
| Codes mapped | 33 of 33 known codes |
| Official crosswalk | No — heuristic pattern matching |
| P4-03 blocker | No (sufficient for basic sector grouping) |

---

## P0 Blockers (After Repair)

✅ **No P0 blockers remain** for P4-02 and P4-03.

---

## P1 Action Items (For P4-04 Readiness)

1. **Fix `twstock` dependency** — install in virtual environment, or replace with a TWSE HTTP-based alternative fetcher
2. **Backfill InstitutionalChip** — target: 2021-01-01 to 2026-05-05 (~1,300 trading days)
3. **Backfill MonthlyRevenue** — target: 2020–2025 (72 months × ~900 stocks)
4. **Backfill FinancialReport** — target: 2020Q1–2024Q4 (20 quarters × ~900 stocks)
5. **Redesign T-05 walk-forward** — from H001-H012 signal backtest → portfolio-level walk-forward (P4-04 scope)
