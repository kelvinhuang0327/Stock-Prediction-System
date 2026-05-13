# T-06 Daily Report Section Contract

Version: 1.0.0 | Generated: 2026-05-06

## Section Name: `regimeAwareWalkForwardSummary`

### Purpose

Present today's market regime, walk-forward skeleton coverage, guardrail status,
and deferred feature status. NOT a performance report, NOT a trading recommendation.

### Required Fields

| Field | Type | Notes |
|-------|------|-------|
| report_date | string | <= 2026-05-06 |
| latest_regime_date | string | <= 2026-05-06 |
| latest_regime_label | string | BULL/BEAR/SIDEWAYS/HIGH_VOLATILITY/LOW_CONFIDENCE |
| latest_regime_confidence | float | 0.0-1.0 |
| latest_regime_evidence_flags | array | From P4-03 classifier |
| latest_walk_forward_date | string | <= 2026-05-06 |
| latest_portfolio_size | int | <= 10 |
| latest_candidate_symbols | array | Mock placeholder only |
| walk_forward_sample_days | int | <= 120 |
| walk_forward_regime_distribution | object | BULL/BEAR/SIDEWAYS/HIGH_VOLATILITY counts |
| average_portfolio_size | float | |
| low_confidence_days | int | |
| missing_regime_days | int | |
| dates_with_data_quality_flags | int | |
| guardrail_status | string | PASS/FAIL |
| guardrail_passed_checks | int | |
| guardrail_failed_checks | int | |
| pit_safety_status | string | SAFE/VIOLATION |
| forbidden_logic_status | string | CLEAN/VIOLATION |
| deferred_features | object | chip/revenue/financial |
| readiness_verdict | string | |
| next_actions | array | |

### Forbidden Fields

buy, sell, signal, roi, win_rate, alpha, edge, profit, recommendation, outperform

### Missing Data Rule

Output null + data_quality_flags. Do NOT impute missing data.
