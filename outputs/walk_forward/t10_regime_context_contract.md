# T-10 Regime Context Contract

**Generated**: 2026-05-06

## Field: `regimeContext`

Added to each walk-forward record when `--regime-context` flag is used.

## Schema

| Field | Type | Description |
|---|---|---|
| `asofDate` | string | Walk-forward asof_date |
| `regimeDate` | string\|null | Date of persisted regime row. Always <= asofDate |
| `regimeLabel` | string | BULL \| BEAR \| SIDEWAYS \| HIGH_VOLATILITY \| LOW_CONFIDENCE |
| `confidence` | number\|null | 0.1.0 |0
| `freshnessStatus` | string | FRESH (<=3d) \| STALE (>3d) \| MISSING \| FUTURE_DATE_ERROR |
| `freshnessLagDays` | integer\|null | Calendar days: asofDate - regimeDate |
| `source` | string\|null | Source from MarketRegimeResult |
| `version` | string\|null | Version from MarketRegimeResult |
| `isAvailable` | boolean | True if valid row found |
| `warning` | string\|null | Warning if stale/missing/violation |

## PIT Safety Rules

- SQL: `WHERE date <= asof_date ORDER BY date DESC LIMIT 1`
- `regimeDate > asofDate` triggers `FUTURE_DATE_ERROR` guardrail
- No future regime data is ever used

## Forbidden Usage

- Must NOT change `candidate_symbols`, `portfolio_size`, `placeholder_metrics`
- Must NOT generate buy/sell/signal/ROI/win-rate/alpha/edge/profit
- Read-only context annotation only
