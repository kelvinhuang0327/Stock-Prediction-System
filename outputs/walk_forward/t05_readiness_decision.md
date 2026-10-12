# T-05 Readiness Decision

Generated: 2026-05-06

## Decision Summary

| Question | Answer |
|----------|--------|
| 1. T-05 skeleton complete? | **YES** |
| 2. Can enter smoke test? | **YES** |
| 3. Blocked by P4-04 data features? | **PARTIAL** (skeleton runs with 16 features) |
| 4. Need chip/revenue/financial first? | **NO for skeleton** (YES for richer future) |
| 5. Can connect Daily Report? | **YES** |
| 6. Can connect P4-03 classifier? | **YES** |
| 7. Need schema migration? | **NO for skeleton** |
| 8. PIT leakage risk? | **LOW** |
| 9. Retired hypothesis leakage risk? | **LOW** |

## Next Round Recommendations

### P0 Immediate
- Verify daily report can consume walk-forward output
- Confirm T-01/T-02 can trigger daily regime update

### P1 Next
- P4-04: Chip backfill when >= 500 trading days
- Add MarketRegimeResult DB table
- Connect walk-forward output to Daily Ops Report

### P2 Deferred
- Revenue feature integration (12+ months needed)
- Financial feature integration (quarterly data)
- Replace mock selection with evidence-based ranking

### Do Not Continue
- No H013+ hypotheses
- No ROI/win-rate computation
- No future TAIEX dates
- No edge claims from skeleton
