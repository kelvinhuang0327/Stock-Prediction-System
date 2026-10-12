# T-10 Walk-Forward Regime Context Sample

**Generated**: 2026-05-06  
**Script**: `python3 scripts/build-portfolio-walk-forward-skeleton.py --output outputs/walk_forward/t10_walk_forward_regime_context_sample.json --regime-context`

## Summary

| Metric | Value |
|---|---|
| Total asof_dates | 120 |
| Records with regimeContext | 120 |
| Records missing regimeContext | 0 |
| PIT safe (all regimeDate <= asofDate) | YES |

## Regime Label Distribution (persisted)

| Label | Count | % |
|---|---|---|
| BULL | 62 | 51.7% |
| HIGH_VOLATILITY | 40 | 33.3% |
| SIDEWAYS | 18 | 15.0% |

## Freshness Status Distribution

| Status | Count |
|---|---|
| FRESH | 120 |

- Max freshnessLagDays: 0 (all regimes matched exact trading date)
- Min regimeDate: 2025-10-15
- Max regimeDate: 2026-05-06

## Guardrail Summary

- All 120 records have  
- All  
- No future regime usage 
- No DB write 
- No buy/sell/signal/ROI fields 
- No H001-H012 

## Sample Record (first)

```json
{
  "asof_date": "2025-10-15",
  "regime_label": "BULL",
  "portfolio_size": 10,
  "candidate_selection_method": "deterministic_alphabetical_mock",
  "regimeContext": {
    "asofDate": "2025-10-15",
    "regimeDate": "2025-10-15",
    "regimeLabel": "BULL",
    "confidence": 1.0,
    "freshnessStatus": "FRESH",
    "freshnessLagDays": 0,
    "source": "P4_03_MARKET_REGIME_CLASSIFIER",
    "version": "p4_03b_v1",
    "isAvailable": true,
    "warning": null
  }
}
```
