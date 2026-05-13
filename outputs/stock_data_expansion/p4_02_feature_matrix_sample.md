# P4-02 Feature Matrix Sample Summary

**Generated:** 2026-05-06T11:32:57Z
**Date range:** 2025-10-20 to 2026-05-04
**Total rows:** 6000 (50 symbols x 120 trading days)

## PIT Safety Statement
All features computed using only data <= asof_date

## Feature Availability Notes
- **chip_features:** NULL — InstitutionalChip only 236 trading days (need 500). PROTOTYPE_ONLY.
- **revenue_features:** NULL — MonthlyRevenue only 2 months (need 13+). INSUFFICIENT_HISTORY.
- **financial_features:** NULL — FinancialReport only 2025-Q4 (need 8+ quarters). LIMITED_COVERAGE.
- **roe_debt_ratio:** NULL — schema missing equity/balance-sheet fields. BLOCKED.

## Sample Rows (5 symbols, last 3 trading days)

| asof_date | stock_id | name | industry | taiex_close | daily_return | close_to_ma20 | volatility_20d | breadth |
|-----------|----------|------|----------|------------|-------------|--------------|---------------|---------|
| 2026-04-29 | 1326 | 台灣化學纖維股份有限公司 | 03 | 39303.5 | 0.029412 | 0.116665 | 0.049519 | 0.4527 |
| 2026-04-30 | 1326 | 台灣化學纖維股份有限公司 | 03 | 38926.63 | -0.00381 | 0.104832 | 0.049302 | 0.321 |
| 2026-05-04 | 1326 | 台灣化學纖維股份有限公司 | 03 | 40705.14 | -0.028681 | 0.064487 | 0.047593 | 0.5646 |
| 2026-04-29 | 1560 | 中國砂輪企業股份有限公司 | 05 | 39303.5 | None | 0.087059 | 0.039499 | 0.4527 |
| 2026-04-30 | 1560 | 中國砂輪企業股份有限公司 | 05 | 38926.63 | 0.036468 | 0.118186 | 0.037132 | 0.321 |
| 2026-05-04 | 1560 | 中國砂輪企業股份有限公司 | 05 | 40705.14 | 0.031481 | 0.143561 | 0.035869 | 0.5646 |
| 2026-04-29 | 1802 | 台灣玻璃工業股份有限公司 | 08 | 39303.5 | None | 0.137359 | 0.050265 | 0.4527 |
| 2026-04-30 | 1802 | 台灣玻璃工業股份有限公司 | 08 | 38926.63 | 0.012085 | 0.145299 | 0.049912 | 0.321 |
| 2026-05-04 | 1802 | 台灣玻璃工業股份有限公司 | 08 | 40705.14 | -0.01194 | 0.123367 | 0.048623 | 0.5646 |
| 2026-04-29 | 2330 | 台灣積體電路製造股份有限公司 | 24 | 39303.5 | None | 0.147519 | 0.022768 | 0.4527 |
| 2026-04-30 | 2330 | 台灣積體電路製造股份有限公司 | 24 | 38926.63 | -0.020642 | 0.11707 | 0.023432 | 0.321 |
| 2026-05-04 | 2330 | 台灣積體電路製造股份有限公司 | 24 | 40705.14 | 0.065574 | 0.177232 | 0.026827 | 0.5646 |
| 2026-04-29 | 2454 | 聯發科技股份有限公司 | 24 | 39303.5 | None | 0.561316 | 0.029895 | 0.4527 |
| 2026-04-30 | 2454 | 聯發科技股份有限公司 | 24 | 38926.63 | 0.013592 | 0.541414 | 0.029926 | 0.321 |
| 2026-05-04 | 2454 | 聯發科技股份有限公司 | 24 | 40705.14 | 0.099617 | 0.637427 | 0.03659 | 0.5646 |

## Null Feature Summary

The following features are null for all rows (data coverage limitations):
- **chip features** (foreign_net_buy, investment_trust_net_buy, dealer_net_buy, chip_net_buy_5d): PROTOTYPE_ONLY, 236 trading days only
- **revenue features** (revenue_yoy, revenue_mom): INSUFFICIENT_HISTORY, 2 months only
- **financial features** (eps): LIMITED_COVERAGE, 2025-Q4 only
