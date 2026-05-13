# P4-02 PIT Safety Rules
**Generated:** 2026-05-06  
**Task:** P4-02 — PIT-Safe Cross-Table Data Foundation Expansion  
**Status:** FINAL — governs all feature computation in P4-03 and subsequent phases

---

## What is PIT Safety?

Point-in-Time (PIT) safety means that any feature value computed for `asof_date` uses **only data that was publicly available on or before `asof_date`**. Violating PIT safety (using future data) constitutes data leakage and invalidates any backtest or walk-forward result.

---

## Rule 1: StockQuote Daily Features

**Applies to:** daily_return, close_to_ma20, close_to_ma60, volume_ratio_20d, volatility_20d, volatility_60d, market_breadth_proxy

### Rules

1. **Strict date filter:** Only rows WHERE `StockQuote.date <= asof_date` may be used.
2. **No future close:** When predicting the next trading day's return, the `close` on `asof_date` may be used as the last observed value. The close on `asof_date + 1` is the **target** and must never appear in feature inputs.
3. **Rolling window:** MA20 uses the 20 most recent rows including `asof_date`. MA60 uses the 60 most recent rows.
4. **Volatility:** std(daily_return over last 20/60 days). Returns computed as `(close_t - close_{t-1}) / close_{t-1}`.
5. **Market breadth proxy:** Count of stocks with `change > 0` on `asof_date` / total stocks with quote on `asof_date`. No lookahead.
6. **Missing dates:** If a stock has no quote on `asof_date` (e.g., halted, suspended), output `null` for all price features. Do not carry forward from a future date.

### Prohibited

- Using `StockQuote.close` for any date > `asof_date` in feature computation.
- Imputing missing prices with forward-fill from future dates.

---

## Rule 2: MarketIndex (TAIEX / Sector) Features

**Applies to:** taiex_close, taiex_return_1d, taiex_return_20d, taiex_ma50, taiex_ma200, taiex_volatility_20d, sector_index_return

### Rules

1. **Strict date filter:** Only rows WHERE `MarketIndex.date <= asof_date` may be used.
2. **JOIN key:** Join StockQuote to MarketIndex on `date = asof_date` AND `name = 'TAIEX'`.
3. **Missing date fallback:** If MarketIndex has no row for `asof_date`, output `null` for all TAIEX features. **Do not forward-fill from a future TAIEX date.**
4. **taiex_return_1d:** Computed as `(value_t - value_{t-1}) / value_{t-1}` where `t = asof_date` and `t-1 = most recent prior trading date`.
5. **taiex_return_20d:** Computed as `(value_t - value_{t-20}) / value_{t-20}` using the 21st most recent MarketIndex row.
6. **taiex_ma50 / taiex_ma200:** Rolling mean of TAIEX `value` over last 50 / 200 rows WHERE date <= asof_date.
7. **Sector index return:** Use `MarketIndex.changePercent` WHERE `date = asof_date` AND `name = sector_index_name`. If no matching row, output `null`.

### Prohibited

- Using any MarketIndex row with `date > asof_date` in feature computation.
- Forward-filling TAIEX values into gaps using future observed values.

---

## Rule 3: MonthlyRevenue Features

**Applies to:** revenue_yoy, revenue_mom, revenue_growth_trend_3m, latest_revenue_available_asof

### Rules

1. **Announcement lag (conservative):** Revenue for month `M` of year `Y` is considered available only from `(Y, M+1, 15)` — i.e., the 15th day of the following month. Some practitioners use day 20.
   - Example: 2026-02 revenue → available from 2026-03-15.
   - Example: 2026-03 revenue → available from 2026-04-15.
2. **asof filter:** For a given `asof_date`, only include revenue rows WHERE `announcement_available_date <= asof_date`.
   - Since schema has no announcement date, compute: `available_date = date(year, month+1, 15)`.
3. **This is a conservative approximation.** Actual announcement dates may differ. The schema (`MonthlyRevenue`) does not have a `releaseDate` or `announcedAt` field.
4. **Missing month:** If the most recent available month is more than 2 months prior to `asof_date`, flag as stale.
5. **Current availability status:** Only 2026-02 and 2026-03 data exist. Revenue features are `INSUFFICIENT_HISTORY` until ≥13 months of data are available.

### Prohibited

- Assuming revenue for month `M` is available on any date in month `M`.
- Using pre-computed `yoyGrowth` or `momGrowth` without verifying the lag rule is satisfied.
- Using MonthlyRevenue without applying the announcement lag.

---

## Rule 4: FinancialReport Features

**Applies to:** eps, gross_margin, operating_margin, roe, debt_ratio, latest_financial_report_asof

### Rules

1. **Announcement lag (conservative):** Quarterly reports are available on the following dates:
   - Q1 (Jan–Mar): available from **May 15** of same year
   - Q2 (Apr–Jun): available from **Aug 14** of same year
   - Q3 (Jul–Sep): available from **Nov 14** of same year
   - Q4 (Oct–Dec): available from **March 31** of following year
2. **asof filter:** For a given `asof_date`, only include FinancialReport rows WHERE `report_available_date <= asof_date`.
3. **This is a conservative approximation.** Actual TWSE disclosure deadlines may differ. The schema does not have a `releasedAt` or `announcedAt` field.
4. **gross_margin / operating_margin:** Currently NULL in database. Do not use until data is populated.
5. **roe / debt_ratio:** Cannot be computed — schema has no equity, total assets, or total liabilities columns. Status: BLOCKED.
6. **Current availability status:** Only 2025-Q4 data exists. All features are `LIMITED_COVERAGE`. Minimum for reliable historical validation: 8 quarters (2 years).

### Prohibited

- Assuming Q4 results are available in January of the following year.
- Using gross_margin / operating_margin without verifying non-NULL.
- Computing ROE or debt_ratio with available schema (schema lacks required fields).
- Using FinancialReport without applying the quarterly announcement lag.

---

## Rule 5: InstitutionalChip Features

**Applies to:** foreign_net_buy, investment_trust_net_buy, dealer_net_buy, chip_net_buy_5d, chip_net_buy_20d

### Rules

1. **Asof rule (T+1):** Chip data is published daily after market close. Use chip data WHERE `date < asof_date` (T+1 lag). Chip data for `asof_date` itself is treated as not yet published at the start of `asof_date`.
   - Alternative conservative approach: WHERE `date <= asof_date - 1`. Both mean the same thing.
2. **NET values:** `foreignBuy`, `trustBuy`, `dealerBuy` in the schema are **net buy** values (can be negative). They are NOT gross buy amounts. Do not confuse with gross buy volume.
3. **Rolling sums:** `chip_net_buy_5d` = SUM(foreignBuy + trustBuy + dealerBuy) over last 5 days WHERE date <= asof_date - 1.
4. **Coverage requirement:** Production gates for 500-day walk-forward require ≥500 trading days of chip data. Current coverage: **236 trading days** (2025-05-02 to 2026-05-05). All chip features are `PROTOTYPE_ONLY`.
5. **Do not use in production:** Do not elevate chip features to `PORTFOLIO_WALKFORWARD_READY` or `P4_03_READY` until coverage reaches ≥500 days.

### Prohibited

- Using chip data for `asof_date` (same-day chip data is T+0 and may not yet be published).
- Treating foreignBuy as "foreign investor gross buy" without confirming it is a net figure.
- Promoting chip features to production-ready status without 500+ trading days of coverage.

---

## PIT Safety Summary Matrix

| Feature Group | PIT Status | Lag Rule | Current Status |
|---------------|-----------|----------|---------------|
| StockQuote (price/OHLCV) | PIT_SAFE | date <= asof_date | ✅ READY |
| MarketIndex (TAIEX/sector) | PIT_SAFE | date <= asof_date, NULL on miss | ✅ READY |
| Stock (industry/sector) | PIT_SAFE | static attribute | ✅ READY |
| InstitutionalChip | PIT_SAFE_WITH_ASOF_LAG | date <= asof_date - 1 (T+1) | ⚠️ PROTOTYPE_ONLY |
| MonthlyRevenue | PIT_SAFE_WITH_ASOF_LAG | month M available from (M+1)-15 | ❌ INSUFFICIENT_HISTORY |
| FinancialReport | PIT_SAFE_WITH_ASOF_LAG | Q report available per TWS schedule | ❌ LIMITED_COVERAGE |

---

## Enforcement

All feature computation scripts must:

1. Accept an explicit `asof_date` parameter.
2. Apply date filters before any computation.
3. Output `null` (not imputed/estimated values) when data is not available as-of `asof_date`.
4. Include `feature_availability_flags` in output to document missing/restricted features.
5. Never write to the production database.
6. Never call paid APIs or external services unless explicitly authorized.

These rules are enforced in `scripts/build-p4-feature-foundation.py`.
