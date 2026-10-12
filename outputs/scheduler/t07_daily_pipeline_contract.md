# T-07 Daily Regime-Aware Report Pipeline Contract

**Contract Date:** 2026-05-06  
**Pipeline Name:** `dailyRegimeAwareReportPipeline`  
**Version:** 1.0.0  
**Default Mode:** `dry-run`

---

## Safety Rules

- Default mode is `--dry-run`. Must pass `--apply` explicitly.
- `dry-run` writes NO DB tables.
- `--apply` may ONLY write `MarketIndex` (via `backfill-taiex-gap.py --apply`).
- No StockQuote mutation. No production DB write.
- No buy/sell signal. No strategy validation. No ROI/win-rate.
- No H013+. No H001-H012.
- External API limited to TAIEX TWSE in stage 2 only.
 stage marked DEGRADED, pipeline continues.
- Forbidden JSON fields: `buy, sell, signal, roi, win_rate, alpha, edge, profit, recommendation, outperform`

---

## Pipeline Stages

| # | Stage | Command | Writes DB | External API | Allowed to Fail |
|---|-------|---------|-----------|-------------|-----------------|
| 1 | `freshness_check` | `backfill-taiex-gap. |py -- | dry- | run` | 
| 2 |  |  (conditional) |  MarketIndex TWSE (DEGRADED) | |  | 
| 3 | `market_regime_classifier` | `build-market-regime- |classifier. | py -- | output ...` | 
| 4 | `portfolio_walk_forward_skeleton` | `build-portfolio-walk-forward- |skeleton. | py -- | output ...` | 
| 5 | `daily_report_builder` | `build-daily-regime- |walkforward- | report. | py ...` | 
| 6 | `guardrail_ |validation` |  | internal  | checks | 
| 7 | `artifact_ |validation` |  | internal  | checks | 
| 8 | `readiness_decision` |  |pipeline  | summary  | write | 

---

## Daily Output Files

- `outputs/daily_report/t06_daily_ops_report.json`
- `outputs/daily_report/t06_daily_ops_report.md`
- `outputs/scheduler/t07_pipeline_run_summary.json`
- `outputs/scheduler/t07_pipeline_run_summary.md`
- `outputs/scheduler/t07_guardrail_validation.json`
- `outputs/scheduler/t07_guardrail_validation.md`

---

## Final Pipeline Status Values

`PASS` | `PASS_WITH_DEGRADED_FRESHNESS` | `FAIL_GUARDRAIL` | `FAIL_ARTIFACT_VALIDATION` | `FAIL_STAGE_EXECUTION` | `BLOCKED_EXTERNAL_API` | `BLOCKED_SAFETY_RULE`
