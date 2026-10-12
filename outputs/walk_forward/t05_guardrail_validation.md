# T-05 Guardrail Validation

Generated: 2026-05-06 | **Overall: PASS**

## Results

| Check | Result | Notes |
|-------|--------|-------|
| no_h001_h012_in_output | PASS | Searched all record fields |
| no_buy_field | PASS | Field not present in any record |
| no_sell_field | PASS | Field not present in any record |
| no_signal_field | PASS | Field not present in any record |
| no_roi_field | PASS | Field not present in any record |
| no_win_rate_field | PASS | Field not present in any record |
| no_production_write | PASS | Script is read-only; no DB mutations |
| no_future_dates | PASS | All asof_date <= 2026-05-06 |
| portfolio_size_lte_10 | PASS | Max found = 10 |
| sample_days_lte_120 | PASS | Actual = 120 |
| every_row_has_regime_context | PASS | All 120 records have regime_label + regime_confidence |
| every_row_has_pit_safety_flags | PASS | All 120 records have pit_safety_flags array |
| every_row_has_forbidden_logic_flags | PASS | All 120 records have forbidden_logic_flags object |
| all_forbidden_flags_are_false | PASS | All 6 flags = false in all records |
| chip_features_not_production | PASS | No chip features used; only deterministic alphabetical mock |
| revenue_features_not_production | PASS | No revenue features used |
| financial_features_not_production | PASS | No financial features used |
| json_artifacts_parseable | PASS | All 5 JSON files parse successfully |

## Notes on H001-H012 Codebase Presence

H001-H012 related files EXIST in codebase (ExperimentRegistry.ts, WalkForwardResult DB rows).
This does NOT cause T-05 to  the T-05 Python skeleton does not invoke or reference these.fail 
Risk is LOW. Files are documented in t05_existing_walk_forward_audit.json.

## Summary

- Total checks: 18
- Passed: 18
- Failed: 0
