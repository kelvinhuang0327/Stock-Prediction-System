# Feature Family Research Map

**Task:** P3- Research Program Reset  14 
**Note:** Research map only. No hypotheses defined. No validation performed.

---

## Priority Ranking

| Rank | Family | Priority | Data Status | Action |
|------|--------|----------|-------------|--------|
| 1 | Market Regime | 10/10 | EXISTS (TAIEX) | P4-03 immediately |
| 2 | Cross-Sectional Relative Strength | 9/10 | EXISTS (StockQuote) | P4-02 immediately |
| 3 | Portfolio-Level Hypotheses | 9/10 | PARTIAL | P4-04 after P4-02 |
| 4 | Institutional / Flow Data | 8/10 | EXISTS but 1yr only | P4-01 backfill audit |
| 5 | Liquidity / Volume Regime | 7/10 | EXISTS | Standard filter |
| 6 | Risk Management Features | 7/10 | EXISTS | Standard filter |
| 7 | Corporate Event Context | 6/10 | PARTIAL - 2 months only | Need major backfill |

---

## Family Details

### FF- Cross-Sectional Relative StrengthA 
Ranking symbols by relative performance within universe or sector. Well-documented momentum anomaly. Removes market-wide drift.
- **Data:** StockQuote, sector  (numeric codes, needs mapping)metadata  
- **PIT risk:** LOW
- **Action:** P4-02 Cross-Sectional Ranking Framework

### FF- Market RegimeB 
TAIEX-based bull/bear/sideways classifier. All next-gen hypotheses conditioned on regime.
- **Data:** MarketIndex (2900 rows, 2026, 298 sector indices)2017 
- **PIT risk:** LOW
- **Action:** P4-03 Market Regime  highest priority, data available nowClassifier 

### FF- Liquidity / Volume RegimeC 
Turnover rate, liquidity percentile, abnormal volume with persistence. Filters false signals.
- **Data:** StockQuote volume, capital  (partial)data  
- **PIT risk:** LOW
- **Action:** Incorporate as filter in all next-gen hypotheses

### FF- Institutional / Flow DataD 
Foreign investor, investment trust, dealer net buy/sell.
- **Data:** InstitutionalChip  **only 1 year (2025-05 to 2026-05)**but  
- **PIT risk:** LOW (published next trading day)
- **Blocker:** Need backfill to 2020+ for robust 500d window validation
- **Action:** P4-01 data audit first, then backfill, then hypothesis design

### FF- Corporate Event ContextE 
Monthly revenue, earnings, dividends, ex-right.
- **Data:**  **only 2 months (2026-02 to 2026-03)**;  limitedFinancialReport MonthlyRevenue 
- **PIT risk:** MEDIUM (use announcement date, not report period)
- **Blocker:** Need multi-year backfill
- **Action:** P4-01 audit, then major backfill effort

### FF- Risk Management FeaturesF 
Max drawdown, volatility targeting, downside volatility, stop-loss simulation (paper-only).
- **Data:** StockQuote sufficient for historical vol and drawdown 
- **PIT risk:** LOW
- **Action:** Standard filter in all next-gen hypotheses. Not a standalone signal family.

### FF- Portfolio-Level HypothesesG 
Top-N ranked baskets, sector-neutral portfolios, ETF vs stock bucket comparisons.
- **Data:** StockQuote, sector metadata  
- **PIT risk:** LOW
- **Action:** P4-04 Portfolio-Level  higher statistical power than single-stockBacktester 
