# P4-02 Feature Contract
**Generated:** 2026-05-06  
**Task:** P4-02 — PIT-Safe Cross-Table Data Foundation Expansion  
**Status:** COMPLETE — 31 features defined across 6 groups

---

## Summary

| Metric | Value |
|--------|-------|
| Total features | 31 |
| P4_03_READY | 16 |
| PROTOTYPE_ONLY | 8 |
| DEFER | 5 |
| DO_NOT_USE | 2 |
| All have PIT_safety_status | ✅ PASS |
| All have availability_status | ✅ PASS |
| All have recommended_usage | ✅ PASS |

---

## PIT Safety Status Legend

| Status | Meaning |
|--------|---------|
| `PIT_SAFE` | No look-ahead risk. Feature uses only data strictly ≤ asof_date. |
| `PIT_SAFE_WITH_ASOF_LAG` | Safe only if conservative announcement lag is applied. |
| `NOT_PIT_SAFE` | Feature construction would leak future data. Do not use. |
| `UNKNOWN_REQUIRES_REVIEW` | Schema or data provenance unclear — requires human review before use. |

## Availability Status Legend

| Status | Meaning |
|--------|---------|
| `READY` | Sufficient history (≥500 days or matching requirement) and data quality verified. |
| `PROTOTYPE_ONLY` | Computable but insufficient depth for production validation gates. |
| `LIMITED_COVERAGE` | Some data available but not enough history for reliable use. |
| `INSUFFICIENT_HISTORY` | Data exists but far below minimum requirement. |
| `BLOCKED` | Cannot be computed with current schema/data. |
| `UNKNOWN` | Not yet assessed. |

---

## Group 1: Price / OHLCV Features

Source: `StockQuote`  
Coverage: 185 symbols ≥ 500 trading days; max_date 2026-05-18

| Feature | Source | PIT Safety | Availability | Usage | Blocker |
|---------|--------|-----------|--------------|-------|---------|
| daily_return | StockQuote | PIT_SAFE | READY | P4_03_READY | None |
| close_to_ma20 | StockQuote | PIT_SAFE | READY | P4_03_READY | None |
| close_to_ma60 | StockQuote | PIT_SAFE | READY | P4_03_READY | None |
| volume_ratio_20d | StockQuote | PIT_SAFE | READY | P4_03_READY | None |
| volatility_20d | StockQuote | PIT_SAFE | READY | P4_03_READY | None |
| volatility_60d | StockQuote | PIT_SAFE | READY | P4_03_READY | None |

**asof_rule:** Only rows WHERE date <= asof_date. Window computations use ROWS BETWEEN N PRECEDING AND CURRENT ROW ordered by date.

---

## Group 2: Market Regime Support Features

Source: `MarketIndex` (TAIEX + sector indices)  
Coverage: TAIEX 766 trading days; max_date 2026-05-05

| Feature | Source | PIT Safety | Availability | Usage | Blocker |
|---------|--------|-----------|--------------|-------|---------|
| taiex_return_1d | MarketIndex | PIT_SAFE | READY | P4_03_READY | None |
| taiex_return_20d | MarketIndex | PIT_SAFE | READY | P4_03_READY | None |
| taiex_ma50 | MarketIndex | PIT_SAFE | READY | P4_03_READY | None |
| taiex_ma200 | MarketIndex | PIT_SAFE | READY | P4_03_READY | None |
| taiex_volatility_20d | MarketIndex | PIT_SAFE | READY | P4_03_READY | None |
| market_breadth_proxy | StockQuote | PIT_SAFE | READY | P4_03_READY | None |

**asof_rule:** LEFT JOIN MarketIndex ON date = asof_date AND name = 'TAIEX'. If date missing → NULL. Do not forward-fill future data.

---

## Group 3: Industry / Sector Features

Source: `Stock.industry` + `MarketIndex` sector indices  
Coverage: 1,084 / 1,358 stocks have industry code (79.8%)

| Feature | Source | PIT Safety | Availability | Usage | Blocker |
|---------|--------|-----------|--------------|-------|---------|
| industry_code | Stock | PIT_SAFE | READY | P4_03_READY | 274 stocks without industry code |
| industry_name | Stock | PIT_SAFE | READY | P4_03_READY | Not official TWSE crosswalk - heuristic only |
| sector_group | Stock | PIT_SAFE | READY | P4_03_READY | Not official GICS - approximation |
| sector_index_return | MarketIndex | PIT_SAFE | READY | P4_03_READY | String-pattern join - not official crosswalk |

**asof_rule:** industry_code is a static attribute from Stock table. sector_index_return uses MarketIndex.changePercent WHERE date = asof_date AND name = sector_index_name.

---

## Group 4: Chip Features (InstitutionalChip)

Source: `InstitutionalChip`  
Coverage: **236 trading days only** (2025-05-02 to 2026-05-05)  
⚠️ **ALL CHIP FEATURES ARE PROTOTYPE_ONLY — DO NOT USE IN PRODUCTION GATES**

| Feature | Source | PIT Safety | Availability | Usage | Blocker |
|---------|--------|-----------|--------------|-------|---------|
| foreign_net_buy | InstitutionalChip | PIT_SAFE_WITH_ASOF_LAG | PROTOTYPE_ONLY | PROTOTYPE_ONLY | Only 236 days. PROTOTYPE_ONLY. |
| investment_trust_net_buy | InstitutionalChip | PIT_SAFE_WITH_ASOF_LAG | PROTOTYPE_ONLY | PROTOTYPE_ONLY | Only 236 days. PROTOTYPE_ONLY. |
| dealer_net_buy | InstitutionalChip | PIT_SAFE_WITH_ASOF_LAG | PROTOTYPE_ONLY | PROTOTYPE_ONLY | Only 236 days. PROTOTYPE_ONLY. |
| chip_net_buy_5d | InstitutionalChip | PIT_SAFE_WITH_ASOF_LAG | PROTOTYPE_ONLY | PROTOTYPE_ONLY | Only 236 days. PROTOTYPE_ONLY. |
| chip_net_buy_20d | InstitutionalChip | PIT_SAFE_WITH_ASOF_LAG | PROTOTYPE_ONLY | PROTOTYPE_ONLY | Only 236 days. PROTOTYPE_ONLY. |

**asof_rule:** Use chip data WHERE date <= asof_date - 1 day (T+1 lag). foreignBuy / trustBuy / dealerBuy fields are NET values (not gross buy amounts).  
**Blocker:** 500d walk-forward requires ≥500 trading days of chip data. Current: 236. Gap: 264 days.

---

## Group 5: Monthly Revenue Features (MonthlyRevenue)

Source: `MonthlyRevenue`  
Coverage: **2 months only** (2026-02, 2026-03)  
⚠️ **ALL REVENUE FEATURES DEFERRED — INSUFFICIENT_HISTORY**

| Feature | Source | PIT Safety | Availability | Usage | Blocker |
|---------|--------|-----------|--------------|-------|---------|
| revenue_yoy | MonthlyRevenue | PIT_SAFE_WITH_ASOF_LAG | INSUFFICIENT_HISTORY | DEFER | Need 13 months minimum. Only 2 available. |
| revenue_mom | MonthlyRevenue | PIT_SAFE_WITH_ASOF_LAG | LIMITED_COVERAGE | DEFER | Computable but insufficient for validation. |
| revenue_growth_trend_3m | MonthlyRevenue | PIT_SAFE_WITH_ASOF_LAG | INSUFFICIENT_HISTORY | DEFER | Need 3 months minimum. |
| latest_revenue_available_asof | MonthlyRevenue | PIT_SAFE_WITH_ASOF_LAG | LIMITED_COVERAGE | PROTOTYPE_ONLY | Limited to 2 months. |

**asof_rule (conservative):** Revenue for month M is available on (M+1)-15 or (M+1)-20. Do not assume current-month revenue is published. This is a conservative approximation — schema has no announcement date field.

---

## Group 6: Financial Report Features (FinancialReport)

Source: `FinancialReport`  
Coverage: **2025-Q4 only** (957 stocks)  
⚠️ **FINANCIAL FEATURES LIMITED / BLOCKED**

| Feature | Source | PIT Safety | Availability | Usage | Blocker |
|---------|--------|-----------|--------------|-------|---------|
| eps | FinancialReport | PIT_SAFE_WITH_ASOF_LAG | LIMITED_COVERAGE | PROTOTYPE_ONLY | Only 2025-Q4. Cannot compute trend. |
| gross_margin | FinancialReport | PIT_SAFE_WITH_ASOF_LAG | LIMITED_COVERAGE | DEFER | grossMargin appears NULL in current data. |
| operating_margin | FinancialReport | PIT_SAFE_WITH_ASOF_LAG | LIMITED_COVERAGE | DEFER | operatingMargin appears NULL in current data. |
| roe | FinancialReport | UNKNOWN_REQUIRES_REVIEW | BLOCKED | DO_NOT_USE | No equity column in FinancialReport schema. |
| debt_ratio | FinancialReport | UNKNOWN_REQUIRES_REVIEW | BLOCKED | DO_NOT_USE | No balance sheet data in schema. |
| latest_financial_report_asof | FinancialReport | PIT_SAFE_WITH_ASOF_LAG | LIMITED_COVERAGE | PROTOTYPE_ONLY | Only 1 quarter. Lookup only. |

**asof_rule (conservative):**
- Q1 (Jan-Mar): available from **May 15**
- Q2 (Apr-Jun): available from **Aug 14**
- Q3 (Jul-Sep): available from **Nov 14**
- Q4 (Oct-Dec): available from **March 31** of following year

Schema has no announcement date field. Conservative lag is an approximation. Actual disclosure may vary.

---

## Readiness Summary

| Group | Count | P4-03 Ready | Walk-Forward Ready | Prototype | Deferred/Blocked |
|-------|-------|------------|-------------------|-----------|-----------------|
| Price/OHLCV | 6 | ✅ 6 | ✅ 6 | 0 | 0 |
| Market Regime | 6 | ✅ 6 | ✅ 6 | 0 | 0 |
| Industry/Sector | 4 | ✅ 4 | ✅ 4 | 0 | 0 |
| Chip | 5 | ❌ 0 | ❌ 0 | 5 | 0 |
| Revenue | 4 | ❌ 0 | ❌ 0 | 1 | 3 |
| Financial | 6 | ❌ 0 | ❌ 0 | 2 | 4 |
| **Total** | **31** | **16** | **16** | **8** | **7** |
