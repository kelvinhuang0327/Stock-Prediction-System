# T-05 Portfolio Walk-Forward Contract

Version: 1.0.0 | Status: SKELETON_ONLY | Generated: 2026-05-06

## Walk-Forward Definition

| Parameter | Value |
|-----------|-------|
| Evaluation unit | Portfolio |
| Date rule | ALL data: date <= asof_date |
| Regime source | P4-03 classifier |
| Feature source | P4-02 P4_03_READY (16 features) |
| H001-H012 | MUST NOT BE USED |
| Max sample days | 120 |
| Max candidates/day | 10 |

## Portfolio Construction

Method: **deterministic_alphabetical_mock** - no optimization, no alpha, no edge.

Universe: StockQuote symbols on asof_date, excl. ETFs, alphabetical order, top 10.

## Metric Schema (Skeleton)

Required fields per record: asof_date, regime_label, regime_confidence, portfolio_size (<=10),
candidate_symbols, candidate_selection_method, available_feature_count, missing_feature_count,
data_quality_flags, pit_safety_flags, forbidden_logic_flags, placeholder_metrics (all null).

## Prohibited Fields

buy, sell, signal, roi, win_rate, alpha, edge

## Regime Integration Rules

1. Every asof_date must have regime context
2. Missing regime -> label=regime_missing, confidence=0.0
3. No future imputation
4. Regime does not adjust selection thresholds

## PIT Safety Rules

- All queries: WHERE date <= asof_date
- Feature window: 60-day lookback from asof_date
- No look-ahead exceptions
