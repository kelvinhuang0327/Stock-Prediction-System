# Regime-Aware Walk-Forward Summary

**Report Date:** 2026-05-06 | **Generated At:** 2026-05-06T14:12:00+08:00

> This is a PIT-safe system readiness and observability artifact.
> This is not a trading recommendation, not a buy/sell signal, not ROI evidence, not proof of alpha or edge.

## Latest Market Regime

| Field | Value |
|-------|-------|
| Date | 2026-05-06 |
| Regime Label | **BULL** |
| Confidence | 1.0 |
| Evidence Flags | price_above_ma50, price_above_ma200, golden_cross_ma50_above_ma200, momentum_20d_positive=0.238, momentum_60d_positive=0.358, bull_score=11_bear_score=0_max=11, vol_20d=0.257 |

## Walk-Forward Skeleton Summary

| Metric | Value |
|--------|-------|
| Sample Days | 120 |
| Date Range | 2025-10-15 to 2026-05-06 |
| Average Portfolio Size | 8.87 |
| Low Confidence Days | 0 |
| Missing Regime Days | 0 |
| Dates with Data Quality Flags | 9 |

## Regime Distribution (120 trading days)

| Regime | Count | % |
|--------|-------|---|
| BULL | 71 | 59.2% |
| HIGH_VOLATILITY | 40 | 33.3% |
| SIDEWAYS | 9 | 7.5% |

## Latest Walk-Forward Date: 2026-05-06

- Portfolio size: **0**
- Candidate method: deterministic_alphabetical_mock (placeholder only)
- Candidates: none (data not yet populated for latest date)
- Data quality flags: no_stock_data_on_asof_date, missing_features:14

## Guardrail Status

| Check | Result |
|-------|--------|
| T-05 Guardrail Overall | **PASS** |
| Passed Checks | 18/18 |
| PIT Safety | **SAFE** |
| Forbidden Logic | **CLEAN** |

## Deferred Features

| Feature Group | Status | Reason |
|---------------|--------|--------|
| Chip | DEFERRED | ~236 trading days (need 500+) |
| Revenue | DEFERRED | ~2 months (need 12+) |
| Financial | DEFERRED | 1 quarter; schema incomplete |

## Next Actions

- Connect regime output to T-01/T-02 daily scheduler
- Add MarketRegimeResult persistent DB table (schema proposal exists)
- Trigger P4-04 when InstitutionalChip reaches 500 trading days
- Connect walk-forward output to TypeScript DailyReportEngine as new section

## Readiness Verdict: SKELETON_COMPLETE
