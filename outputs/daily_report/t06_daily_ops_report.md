# Daily Ops Report

**Date:** 2026-05-06 | **Version:** T-06-v1.0

> **DISCLAIMER:** This is not a trading recommendation. This is not a buy/sell signal.
> This is not ROI evidence. This is not win-rate evidence. This is not proof of alpha or edge.
> This is a PIT-safe system readiness / observability artifact.

---

## 1. Data Freshness Summary

| Source | Max Date | Status |
|--------|----------|--------|
| TAIEX | 2026-05-06 | CURRENT |
| Regime | 2026-05-06 | CURRENT |
| Walk-Forward | 2026-05-06 | CURRENT |
| StockQuote | 2026-05-18 | NOTE: synthetic future rows (pre-existing) |

## 2. Market Regime Summary

- **Latest Regime:** BULL (confidence=1.0)
- **Date:** 2026-05-06
- **Source:** P4-03 PIT-safe classifier
- **PIT Safe:** True
- **Evidence:** price_above_ma50, price_above_ma200, golden_cross_ma50_above_ma200...

## 3. Regime-Aware Walk-Forward Summary

| Metric | Value |
|--------|-------|
| Sample Days | 120 |
| Date Range | 2025-10-15 to 2026-05-06 |
| Average Portfolio Size | 8.87 |
| Low Confidence Days | 0 |
| Missing Regime Days | 0 |
| Dates with DQ Flags | 9 |

Regime Distribution: {"BULL": 71, "SIDEWAYS": 9, "HIGH_VOLATILITY": 40}

## 4. Data Quality Summary

- Dates with quality flags: 9
- Note: Latest date (2026-05-06) portfolio_size=0 (StockQuote not yet populated)

## 5. Guardrail Summary

| Check | Status |
|-------|--------|
| T-05 Guardrail | **PASS (18/18)** |
| T-06 Guardrail | **PASS** |
| Forbidden Logic | **CLEAN** |
| H001-H012 in Output | **NO (clean)** |
| PIT Safety | **SAFE** |

## 6. Deferred Features Summary

| Feature Group | Status | Condition |
|---------------|--------|-----------|
| Chip | DEFERRED | Need 500+ trading days (~236 now) |
| Revenue | DEFERRED | Need 12+ months (~2 months now) |
| Financial | DEFERRED | Need quarterly alignment + schema fixes |

## 7. Next Actions

- Connect regime output to T-01/T-02 daily scheduler
- Add MarketRegimeResult persistent DB table (schema proposal exists)
- Trigger P4-04 when InstitutionalChip reaches 500 trading days
- Connect walk-forward output to TypeScript DailyReportEngine as new section

## 8. DO NOT INTERPRET AS

- This is not a trading recommendation.
- This is not a buy/sell signal.
- This is not ROI evidence.
- This is not win-rate evidence.
- This is not proof of alpha or edge.
- This is a PIT-safe system readiness / observability artifact.
