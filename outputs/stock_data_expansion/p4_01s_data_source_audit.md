# P4-01S — Data Source Expansion Audit

**Task**: P4-01S — Evidence-First Data Foundation & Phase 1 Readiness Audit  
**Workstream**: A — Data Source Expansion Audit  
**Date**: 2026-05-06  
**Method**: Direct SQLite queries on `prisma/dev.db` — no assumptions  

---

## Audit Summary

| Data Source | Rows | Date Range | Depth | Status | P4 Blocker? |
|---|---|---|---|---|---|
| StockQuote | 130,497 | 2017-04-05 → 2026-05-18 | 805 dates | IMMEDIATELY_USABLE* | ⚠️ Date format fix needed |
| Stock (metadata) | 1,358 | — | static | PARTIALLY_USABLE | ⚠️ Industry mapping missing |
| MarketIndex | 2,900 | 2017-12-01 → 2026-05-18 | 741 dates | USABLE_WITH_FRESHNESS_FIX | ⚠️ TAIEX stale by ~47d |
| InstitutionalChip | 291,068 | 2025-05-02 → 2026-05-05 | 236 dates | INSUFFICIENT_DEPTH | 🔴 Only ~1 year |
| MonthlyRevenue | 2,143 | 2026-02 → 2026-03 | 2 months | CRITICALLY_INSUFFICIENT | 🔴 Only 2 months |
| FinancialReport | 957 | 2025 Q4 only | 1 quarter | CRITICALLY_INSUFFICIENT | 🔴 Only 1 quarter |
| StockMetrics | 6,425 | latest only (PE/PB/Yield) | ~1 snapshot | PARTIALLY_USABLE | ⚠️ No time-series history |
| ShortSellingBalance | — | — | — | **DATA_SOURCE_MISSING** | 🔴 No table |
| MarginBalance | — | — | — | **DATA_SOURCE_MISSING** | 🔴 No table |
| DividendExRight | — | — | — | **DATA_SOURCE_MISSING** | 🔴 No table |

---

## Detailed Findings

### StockQuote ✅ IMMEDIATELY_USABLE (after date fix)

- **Rows**: 130,497 across **1,357 symbols**, **805 distinct dates**
- **ISO-format rows**: ~127,796 (2017-04-05 → 2026-05-18)
- **ROC-format contamination**: ~2,701 rows with dates like `1150327` (民國115年3月27日 = 2026-03-27) — **must normalize before join with MarketIndex**
- **Symbols with ≥500 rows**: **185** (sufficient for 500d window backtesting)
- **PIT Safety**: ✅ Close price is published data at end of trading day
- **Key blocker**: Date format normalization required for alignment with MarketIndex

### Stock (metadata) ⚠️ PARTIALLY_USABLE

- **Rows**: 1,358 stocks in system
- **With industry code**: 1,084 stocks (79.8%)
- **Without industry code**: 274 stocks (20.2%)
- **Distinct industry codes**: 33 numeric codes (01, 02, 03 … 38, 91)
- **Most represented**: code 28 (IT Services, 104 stocks), 24 (Optoelectronics, 94), 26 (Electronic Components, 68)
- **Missing from schema**: ETF/stock flag, listed/OTC classification field
- **Industry code → sector name mapping**: NOT in database — must be built externally

### MarketIndex ✅ USABLE_WITH_FRESHNESS_FIX

- **Rows**: 2,900 across **298 distinct index names**, **741 distinct dates**
- **TAIEX**: 734 rows, **2017-12-01 → 2026-03-17** — last entry is 47 trading days ago
- **Sector indices**: ~21+ sector-level indices present (半導體類指數, 電子類指數, 金融保險類指數, 光電類指數, 生技醫療類指數, etc.)
- **PIT Safety**: ✅ Published end-of-day index values
- **Critical gap**: TAIEX is stale by ~47 trading days (Apr 2 → May 18, 2026). StockQuote is current to 2026-05-18.
- **For P4-03**: TAIEX depth of 734 days is sufficient for regime classifier (needs 200–500d lookback window)

### InstitutionalChip 🔴 INSUFFICIENT_DEPTH

- **Rows**: 291,068 across **1,358 symbols**, **236 distinct trading dates**
- **Date range**: 2025-05-02 → 2026-05-05 (~1 year)
- **Fields**: foreignBuy, trustBuy, dealerBuy, totalBuy, holders400, holders1000
- **For 500d window**: ❌ Only 236 days available. Need 500+ for primary validation window.
- **Backfill script exists**: ✅ `scripts/backfill_chip_resilient.py` — has retry/resume capability
- **Backfill target**: 2021-01-01 (5 years) → estimated 1,358 symbols × ~1,250 trading days = ~1.7M rows to backfill

### MonthlyRevenue 🔴 CRITICALLY_INSUFFICIENT

- **Rows**: 2,143 across **1,074 symbols**
- **Periods available**: 2026-02 and 2026-03 only (2 months)
- **No backfill script**: ❌ None found in `scripts/`
- **PIT concern**: Revenue for month M published ~day 10 of M+1 — must apply offset at feature computation time
- **Hypothesis design**: Cannot proceed until multi-year backfill completed (need 60+ months)

### FinancialReport 🔴 CRITICALLY_INSUFFICIENT

- **Rows**: 957 across 957 symbols
- **Periods**: 2025 Q4 only (one quarter)
- **Available fields**: eps, netIncome, grossMargin, operatingMargin
- **Missing fundamental fields**: ROE, ROA, cash flow, debt ratio, revenue growth
- **No backfill script**: `scripts/ingest-financials.ts` is incremental only (current quarter)
- **Hypothesis design**: Cannot proceed until multi-year quarterly data available (need 20+ quarters)

### StockMetrics ⚠️ PARTIALLY_USABLE

- **Rows**: 6,425 across **1,074 symbols**
- **Fields**: pe, pb, dividendYield
- **Evidence**: All date values appear to be latest snapshot — likely not historical time-series
- **Useful for**: Current valuation screening only, not time-series backtesting

### Missing Tables 🔴

- **ShortSellingBalance**: No table in schema. TWSE publishes daily short selling data via OPENAPI but no ingest script exists.
- **MarginBalance**: No table in schema. Standard margin trading balance data not ingested.
- **DividendExRight**: No table in schema. FinancialReport has earnings but no dividend schedule or ex-dividend dates.

---

## Critical Findings

### 🚨 FINDING 1: Date Format Mismatch (StockQuote ↔ MarketIndex)

StockQuote and MarketIndex both contain rows with date = `1150327` (ROC民國格式). Regular rows use ISO format `YYYY-MM-DD`. Direct JOIN on `date` column will fail or produce wrong results without normalization.

**Impact**: P4-02 (Cross-Sectional Ranking) and P4-03 (Market Regime) both require aligned date joins between StockQuote and MarketIndex. This must be fixed first.

**Fix required**: Normalize all `date` values to ISO `YYYY-MM-DD` format before alignment.

### 🚨 FINDING 2: TAIEX Freshness Gap (~47 Trading Days)

TAIEX last synced: **2026-03-17**  
StockQuote latest: **2026-05-18**  
Gap: **~47 trading days** (all of April and early May 2026)

**Impact**: Any regime-conditioned analysis for April-May 2026 will have no TAIEX data. P4-03 Market Regime Classifier cannot classify current regime.

**Fix required**: Re-run MarketIndex sync to catch up TAIEX to current date.

### 🚨 FINDING 3: InstitutionalChip 236-day Depth vs 500d Requirement

P4 hypotheses requiring 500d window backtesting on institutional flow features cannot proceed until historical backfill is completed.

**Priority**: Backfill from 2021-01-01 using `scripts/backfill_chip_resilient.py`.

---

## P4 Readiness by Stage

| P4 Stage | Prerequisites Met? | Verdict |
|---|---|---|
| P4-01 Data Audit | — | ✅ This is P4-01 |
| P4-02 Cross-Sectional Ranking | StockQuote ✅, date-fix needed | **UNBLOCKED after date normalization** |
| P4-03 Market Regime Classifier | TAIEX ✅ (stale), date-fix needed | **UNBLOCKED after TAIEX refresh + date-fix** |
| P4-04 Portfolio Backtester | P4-02 + P4-03 needed | Depends on P4-02/03 |
| P4-05 Hypothesis Registry | P4-01~03 data audit | Depends on mapping + regime |
| P4-06 Batch Validation (institutional) | InstitutionalChip 5y | 🔴 **BLOCKED ~4–6 months backfill** |
