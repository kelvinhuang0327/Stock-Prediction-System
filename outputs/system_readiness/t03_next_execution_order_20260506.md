# T-03 Next Execution Order

**Generated**: 2026-05-06  
**Follows**: T-03 Daily Ops Report v1 (COMPLETE)

---

## Current Status Summary

| Task | Status | Notes |
|------|--------|-------|
| T-09 TypeScript DailyReportEngine Integration | ✅ COMPLETE | 20/20 tests |
| T-10 Walk-Forward Regime Context Enrichment | ✅ COMPLETE | 120/120 records enriched |
| T-11 Freshness Alert for MarketRegimeResult | ✅ COMPLETE | 40/40 tests, 18/18 guardrails |
| T-12 DailyReportEngine Deeper Integration | ✅ COMPLETE | 54/54 tests, 20/20 guardrails |
| T-03 Daily Ops Report v1 | ✅ COMPLETE | 81/81 tests, 22/22 guardrails |

---

## P0 Immediate — T-04

### T-04: LLM Hard-Off / Safe-Run + Missing-TaskId Alert

**Goal**: Implement scheduler safety controls:
1. **LLM Hard-Off**: In safe-run mode, no LLM calls are made. All output is rule-based only.
2. **Safe-Run Mode**: A flag/env-var that prevents any LLM-dependent pipeline stage from running.
3. **Missing-TaskId Alert**: When a scheduled task doesn't report back within expected time, emit an alert.

**Integration with T-03**: Scheduler can check `/api/report/ops` (or call `buildDailyOpsReport()` directly) before proceeding — if `status = MISSING_DATA` or `status = GUARDRAIL_FAIL`, safe-run mode triggers automatically.

**Key actions**:
1. Audit current LLM usage in pipeline (which stages call LLM)
2. Add `SAFE_RUN_MODE` flag
3. Add task-ID tracking for scheduled jobs
4. Add missing-taskId alert emission
5. Add tests
6. Guardrail validation + readiness decision

**Depends on**: T-03 (ops report for safe-run trigger)

---

## P1 Next

### T-02b: Unified Freshness Guard

Wire `OpsReport.freshness.requiresAction === true` into scheduler/pipeline:
- If `requiresAction`, emit alert to log / ops channel
- Do NOT block trading-unrelated pipeline stages

### T-12b: Replace DEFAULT_CURRENT_DATE

`DEFAULT_CURRENT_DATE = '2026-05-06'` is hardcoded in `marketRegimeResult.ts`.
Replace with: `new Date().toISOString().split('T')[0]` or `process.env.REPORT_DATE`.

---

## P2 Deferred

- **T-03b**: Ops Report UI Dashboard — consume `/api/report/ops` in frontend
- **T-01b**: Lane-based Scheduler Heartbeat — periodic freshness checks across data sources
- **T-05b**: Portfolio Walk-Forward at Scale

---

## Do Not Proceed With

- H013+ hypothesis design
- Strategy validation or backtesting
- ML model training
- ROI / win-rate / alpha / edge calculation
- External data API calls
- Production DB writes

---

## File Evidence (T-03 Complete)

**New files**:
- `src/lib/report/OpsReportEngine.ts` — `buildDailyOpsReport()`, `DailyOpsReport` interface
- `src/app/api/report/ops/route.ts` — GET /api/report/ops
- `src/lib/report/__tests__/t03_ops_report_engine.test.ts` — 15 engine tests
- `src/app/api/report/ops/__tests__/t03_ops_report_api.test.ts` — 12 API tests
- `outputs/daily_report/t03_existing_ops_report_audit.json/.md`
- `outputs/daily_report/t03_daily_ops_report_contract.json/.md`
- `outputs/daily_report/t03_guardrail_validation.json/.md`
- `outputs/daily_report/t03_readiness_decision.json/.md`
- `outputs/system_readiness/t03_next_execution_order_20260506.md`

**Test results**: 81/81 PASS  
**Guardrails**: 22/22 PASS
