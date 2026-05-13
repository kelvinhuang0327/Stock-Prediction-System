# P4-02 — Cross-Table Availability Audit

**Task**: P4-02 — PIT-Safe Cross-Table Data Foundation Expansion  
**Generated**: 2026-05-06  
**Evidence**: Direct SQLite queries on prisma/dev.db

---

## Summary Table

| Table | Rows | Date Range | Distinct Stocks | ≥500d Symbols | P4-03 Ready | Walk-Forward Ready | Status |
|---|---|---|---|---|---|---|---|
| **Stock** | 1,358 | static | 1,358 | — | ✅ | ✅ | READY (reference) |
| **StockQuote** | 129,151 | 2017-04-05 → 2026-05-18 | 1,357 | 185 | ✅ | ✅ | READY |
| **MarketIndex** | 2,665 | 2017-12-01 → 2026-05-05 | — (75 indices) | TAIEX: 766d | ✅ | ✅ | READY |
| **InstitutionalChip** | 291,068 | 2025-05-02 → 2026-05-05 | 1,358 | **0** | ❌ | ❌ | PROTOTYPE_ONLY |
| **MonthlyRevenue** | 2,143 | 2026-02 → 2026-03 | 881 | — | ❌ | ❌ | INSUFFICIENT_HISTORY |
| **FinancialReport** | 957 | 2025-Q4 only | 957 | — | ❌ | ❌ | INSUFFICIENT_HISTORY |
| **StockMetrics** | 5,356 | 2026-03-27 only | 1,074 | **0** | ❌ | ❌ | INSUFFICIENT_HISTORY |
| **WalkForwardResult** | 522 | 2026-04-15 → 2026-04-30 | — | — | ❌ | ❌ | **DEPRECATED** |

---

## Stock (Master Reference)

- 1,358 stocks total; 33 distinct industry codes; 1,084 with industry (79.8%)
- 223 ETF heuristic (`id LIKE '00%'`)
- 274 stocks have no industry code
- **Industry support**: 33 codes mapped to GICS-like sector groups — sufficient for P4-03 sector grouping
- PIT-safe as reference table; no survivorship bias mitigation in schema

---

## StockQuote

- 129,151 rows, 100% ISO date
- **Effective date range**: 2017-04-05 → 2026-05-18 (excluding ~1,355 epoch-anomaly ETF rows at 1970-12-04)
- **185 symbols with ≥500 trading days** — sufficient for 500d walk-forward universe
- 245 symbols with ≥200 trading days
- **PIT rule**: Use `WHERE date <= asof_date` — never include data after asof_date
- **JOIN safe** with MarketIndex on `date`

---

## MarketIndex

- 2,665 rows, 100% ISO date
- **TAIEX: 766 rows**, 2017-12-01 → 2026-05-05 — exceeds 500d requirement ✅
- 75 distinct index names (21+ sector indices)
- Freshness gap: 1 day (current)
- **PIT rule**: Join with StockQuote on `date`. Missing dates → fallback null (never forward-fill)

---

## InstitutionalChip ⚠️ PROTOTYPE ONLY

- 291,068 rows, 1,358 distinct stocks, **only 236 distinct trading days** (~1 year)
- Date range: 2025-05-02 → 2026-05-05
- Columns: `foreignBuy` (NET), `trustBuy` (NET), `dealerBuy` (NET), `totalBuy`, `holders400`, `holders1000`
- **foreignBuy/trustBuy/dealerBuy are net values** (can be negative = net selling)
- 181 of 185 large-universe symbols have chip data
- **PIT rule**: Use T+1 lag (chip released next morning); use `date <= asof_date - 1 day`
- **Backfill blocker**: `twstock` module unavailable in current Python 3.14 env

---

## MonthlyRevenue ❌ INSUFFICIENT HISTORY

- 2,143 rows, 881 distinct stocks
- **Only 2026-02 and 2026-03 data** — 2 months only
- Columns: `year`, `month`, `revenue`, `yoyGrowth` (pre-computed), `momGrowth` (pre-computed)
- **No announcement date in schema**
- **Conservative PIT lag**: Revenue for month M is available asof (M+1, day 15)
  - e.g. 2026-03 revenue → available asof 2026-04-15
- Historical revenue trends (yoy comparison) require 12+ months of data

---

## FinancialReport ❌ INSUFFICIENT HISTORY

- 957 rows, 957 distinct stocks (one per stock)
- **Only 2025-Q4 data** — 1 quarter only
- Columns: `year`, `quarter`, `eps`, `netIncome`, `grossMargin`, `operatingMargin`
- **No announcement date in schema**
- **Conservative PIT lag** (TWSE schedule):
  - Q1 → available May 15 same year
  - Q2 → available Aug 14 same year
  - Q3 → available Nov 14 same year
  - Q4 → available March 31 following year
- Trend analysis requires 8+ quarters

---

## StockMetrics ❌ INSUFFICIENT HISTORY

- 5,356 rows, 1,074 stocks
- **Effectively only 1 trading day** (2026-03-27); not a time-series
- Columns: `pe`, `pb`, `dividendYield`
- **0 symbols with ≥200 trading days**
- Cannot compute PE/PB trends; PROTOTYPE_ONLY at best

---

## WalkForwardResult — DEPRECATED

- 522 rows for 6 signal types (all belong to retired H001-H012)
- **DO NOT USE** for P4-02/P4-03/P4-04
- Must redesign as portfolio walk-forward under P4-04 scope

---

## Cross-Table Overlap Analysis

| Overlap | Count | Notes |
|---|---|---|
| StockQuote ↔ MarketIndex (date) | 727 overlapping dates | JOIN safe |
| StockQuote ↔ InstitutionalChip (stock) | 1,358 stocks | All stocks covered, 181 of 185 ≥500d |
| StockQuote ↔ MonthlyRevenue (stock) | 881 stocks | Limited to 2026 data |
| StockQuote ↔ FinancialReport (stock) | 957 stocks | Limited to 2025-Q4 |
| Stock.industry coverage | 79.8% (1,084/1,358) | 274 stocks without industry |

---

## P4-03 Ready Stack

**Available now**: StockQuote + MarketIndex + Stock (industry) → sufficient for:
- Price / OHLCV features
- Market regime features (TAIEX-based)
- Sector classification features
- Industry index return features (sector indices in MarketIndex)
