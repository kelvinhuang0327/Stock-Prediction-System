# T-08 MarketRegimeResult Schema Contract

**Contract Date:** 2026-05-06  
**Model Name:** `MarketRegimeResult`

---

## Fields

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | String (CUID) | No | Primary key |
| `date` | String | No | ISO YYYY-MM-DD (asof_date) |
| `regimeLabel` | String | No | BULL/BEAR/SIDEWAYS/HIGH_VOLATILITY/LOW_CONFIDENCE |
| `confidence` | Float | No | 0.0 to 1.0 |
| `taiexClose` | Float? | Yes | TAIEX closing price |
| `taiexMa50` | Float? | Yes | 50-day moving average |
| `taiexMa200` | Float? | Yes | 200-day moving average |
| `taiexReturn1d` | Float? | Yes | 1-day return |
| `taiexReturn20d` | Float? | Yes | 20-day return |
| `taiexVolatility20d` | Float? | Yes | 20-day volatility |
| `marketBreadthProxy` | Float? | Yes | Market breadth proxy |
| `evidenceJson` | String? | Yes | JSON array of evidence flags |
| `missingFeaturesJson` | String? | Yes | JSON array of missing features |
| `pitSafetyJson` | String? | Yes | JSON array of PIT safety flags |
| `source` | String | No | Fixed: `P4_03_MARKET_REGIME_CLASSIFIER` |
| `version` | String | No | Fixed: `p4_03b_v1` |
| `createdAt` | DateTime | No | Auto |
| `updatedAt` | DateTime | No | Auto |

## Unique Constraint

`@@unique([date, source,  prevents duplicate classificationsversion])` 

## Safety Constraints

- No forbidden fields: buy/sell/signal/roi/win_rate/alpha/edge/profit/recommendation/outperform
- No H001-H012 references
- No strategy thresholds
- No forward returns
- No future dates (> 2026-05-06)
- No portfolio performance data
