# T-07 Pipeline Run Summary

**Run Date:** 2026-05-06
**Mode:** dry-run
**Generated At:** 2026-05-06T14:49:29.685688

## Overall Result

**Final Pipeline Status: `PASS`**

| Metric | Value |
|--------|-------|
| Total Stages | 9 |
| Passed | 8 |
| Failed | 0 |
| Degraded | 0 |
| TAIEX Gap Detected | True |
| Daily Report Status | GENERATED |
| do_not_interpret_as | True |

## Stage Results

| Stage | Status | Duration |
|-------|--------|----------|
| freshness_check | PASS | 767ms |
| taiex_backfill_if_needed | SKIPPED | 0ms |
| market_regime_classifier | PASS | 244ms |
| market_regime_persistence | PASS | 98ms |
| portfolio_walk_forward_skeleton | PASS | 117ms |
| daily_report_builder | PASS | 63ms |
| guardrail_validation | PASS | 0ms |
| artifact_validation | PASS | 0ms |
| readiness_decision | PASS | 0ms |

## Artifact Validation

- [OK] outputs/market_regime/p4_03b_market_regime_sample.json
- [OK] outputs/walk_forward/t05_walk_forward_sample.json
- [OK] outputs/daily_report/t06_daily_report_section.json
- [OK] outputs/daily_report/t06_daily_report_section.md
- [OK] outputs/daily_report/t06_daily_ops_report.json
- [OK] outputs/daily_report/t06_daily_ops_report.md
