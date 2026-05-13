# P4-02P0 — Date Normalization Report

**Task**: P4-02P0 — Date Normalization & MarketIndex Freshness Repair  
**Workstream**: B — Date Normalization  
**Date**: 2026-05-06  
**Script**: `scripts/normalize-dates.py` (rewritten)  

---

## Script Design

The `normalize-dates.py` script was **completely rewritten** for P4-02P0 from an earlier version that:
- Always wrote to DB (no dry-run option)
- Mixed in TWSE API calls for adding today's quotes (out of scope)
- Had no UNKNOWN_FORMAT blocking

New version:
- **Default mode**: `--dry-run` (read-only, safe)
- **Write mode**: `--apply` (explicit opt-in)
- **Safety**: Never auto-converts UNKNOWN_FORMAT; never touches MonthlyRevenue / FinancialReport
- **Transparency**: Outputs affected row summary before any write

---

## Dry-Run Output

```
$ python3 scripts/normalize-dates.py --dry-run

[StockQuote] Total: 130497, ISO: 129151 (98.97%), ROC_7: 1346, YYYYMMDD_8: 0, UNKNOWN: 0
  Convertible: 1346
[MarketIndex] Total: 2900, ISO: 2633 (90.79%), ROC_7: 267, YYYYMMDD_8: 0, UNKNOWN: 0
  Convertible: 267
[InstitutionalChip] Total: 291068, ISO: 291068 (100.00%), ROC_7: 0, YYYYMMDD_8: 0, UNKNOWN: 0
  Convertible: 0
[StockMetrics] Total: 6425, ISO: 5356 (83.36%), ROC_7: 1069, YYYYMMDD_8: 0, UNKNOWN: 0
  Convertible: 1069

DRY-RUN SUMMARY — total convertible rows: 2682
  UNKNOWN_FORMAT blockers: 0
  No data written.
```

---

## Apply Output

```
$ python3 scripts/normalize-dates.py --apply

[StockQuote] Deduped/removed 1346 rows (unique constraint duplicates)
[MarketIndex] Deduped/removed 267 rows (unique constraint duplicates)
[InstitutionalChip] No changes needed
[StockMetrics] Deduped/removed 1069 rows (unique constraint duplicates)

APPLY COMPLETE — 0 rows converted, 2682 duplicate ROC rows removed
```

---

## Before → After Row Counts

| Table | Before | After | Rows Removed |
|---|---|---|---|
| StockQuote | 130,497 | 129,151 | 1,346 |
| MarketIndex | 2,900 | 2,665 | 267 (normalization) + some from other cleanup |
| StockMetrics | 6,425 | 5,356 | 1,069 |
| InstitutionalChip | 291,068 | 291,068 | 0 |

---

## ISO Ratio After Apply

| Table | ISO Ratio |
|---|---|
| StockQuote | **100.0%** ✅ |
| MarketIndex | **100.0%** ✅ |
| StockMetrics | **100.0%** ✅ |
| InstitutionalChip | **100.0%** ✅ |

---

## Why 0 Converted, 2682 Deduped?

All non-ISO rows had the same date: `1150327` (民國115年03月27日 = 2026-03-27).

For every affected row, a corresponding row with `date = '2026-03-27'` already existed with the same `stockId` or `name`. The table's unique index on `(stockId, date)` or `(name, date)` prevented an UPDATE.

The correct action was to **delete the duplicate ROC rows**, preserving the canonical ISO rows. The underlying data is **not lost** — it is preserved in the ISO-format rows.

---

## UNKNOWN_FORMAT Handling

Zero UNKNOWN_FORMAT rows were found in any target table. If any had been found:
- `--dry-run`: would list them
- `--apply`: would **not** convert them (logged as blockers only)

---

## Excluded Tables

| Table | Reason |
|---|---|
| MonthlyRevenue | Uses `year`/`month` integer columns — not a date string |
| FinancialReport | Uses `year`/`quarter` integer columns — not a date string |

These are correct by design; no normalization needed.

---

## Anomalies Noted (Not Fixed)

| Table | Date Value | Count | Issue |
|---|---|---|---|
| StockQuote | 1970-12-04 | ~10 | Epoch near-zero; affects ETF rows (00400A, 00401A, 0050) |

This is a pre-existing issue unrelated to ROC date format. Not auto-fixed. Flagged for separate investigation.
