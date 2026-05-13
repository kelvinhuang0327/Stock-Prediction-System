# T-06 Guardrail Validation

Generated: 2026-05-06 | **Overall: PASS**

## Results

| Check | Result | Notes |
|-------|--------|-------|
| daily_report_section_json_parseable | PASS | Loaded successfully |
| daily_ops_report_json_parseable | PASS | Loaded successfully |
| no_h001_h012_in_section | PASS | found=[] |
| no_h001_h012_in_ops_report | PASS | found=[] |
| no_forbidden_fields_in_section | PASS | found=[] |
| no_forbidden_fields_in_ops_report | PASS | found=[] |
| no_production_write | PASS | build-daily-regime-walkforward-report.py is read-only |
| no_external_api_call | PASS | Script reads only local artifact JSON files |
| report_date_lte_20260506 | PASS | report_date=2026-05-06 |
| latest_regime_date_lte_20260506 | PASS | regime_date=2026-05-06 |
| latest_wf_date_lte_20260506 | PASS | wf_date=2026-05-06 |
| section_has_data_quality_flags | PASS | field present |
| section_has_pit_safety_status | PASS | field present |
| section_has_guardrail_status | PASS | field present |
| section_has_deferred_features | PASS | field present |
| pit_safety_status_is_safe | PASS | status=SAFE |
| guardrail_status_is_pass | PASS | status=PASS |
| ops_report_has_do_not_interpret_as | PASS | field present |
| ops_report_disclaimer_complete | PASS | count=6 |
| section_has_regime_label | PASS | field present |
| section_has_regime_confidence | PASS | field present |
| section_has_walk_forward_distribution | PASS | field present |

## Summary

- Total checks: 22
- Passed: 22
- Failed: 0

## Notes

- H001-H012 present in TypeScript codebase (ExperimentRegistry.ts etc.) but NOT in T-06 Python artifacts.
- `recommendation` appears as `recommendationBucket` in TypeScript DailyReportEngine (candidate-level research label, NOT a buy/sell). NOT present in T-06 outputs.
