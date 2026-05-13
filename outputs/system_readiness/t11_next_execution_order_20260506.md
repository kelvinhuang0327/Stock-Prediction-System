# T-11 Next Execution Order

**Generated**: 2026-05-06  
**Follows**: T-11 Freshness Alert for MarketRegimeResult (COMPLETE)

---

## Current Status Summary

| Task | Status | Notes |
|------|--------|-------|
| T-09 TypeScript DailyReportEngine Integration | ✅ COMPLETE | 21/21 tests PASS |
| T-10 Walk-Forward Regime Context Enrichment | ✅ COMPLETE | 120/120 records enriched, all FRESH |
| T-11 Freshness Alert for MarketRegimeResult | ✅ COMPLETE | 40/40 tests PASS, 18/18 guardrails PASS |

---

## P0 Immediate — T-12

### T-12: DailyReportEngine Deeper Integration

**Goal**: Replace any remaining live `detectRegime()` calls with reads from persisted `MarketRegimeResult`. Integrate `freshnessAlert` into the DailyReportEngine pipeline so that downstream consumers (scheduler, ops report, alerting) receive regime context + freshness status in a unified call.

**Key actions**:
1. Audit `src/` for any remaining live regime detection calls
2. Update DailyReportEngine to call `getLatestMarketRegimeContext()` + `computeFreshnessAlert()`
3. Expose unified regime + alert payload from engine
4. Add tests for engine integration
5. Validate no forbidden fields, no DB write, no external API call

**Depends on**: T-09, T-11 (both complete)  
**Blocks**: T-03 Daily Ops Report v1

---

## P1 Next — T-03 and T-02b

### T-03: Daily Ops Report v1

Build the structured daily ops report that includes:
- `marketRegimeContext` (from T-09/T-12)
- `freshnessAlert` (from T-11)
- `walkForwardSummary` (from T-10)
- System health / data coverage summary

**Depends on**: T-12

### T-02b: Unified Freshness Guard

Wire `freshnessAlert.requiresAction === true` into the scheduler/pipeline as a blocking guard. Emit alerts to log / ops channel when freshness drops below FRESH.

**Depends on**: T-11

---

## P2 Deferred

- **T-01b**: Lane-based Scheduler Heartbeat — extend scheduler with periodic freshness checks across all data sources
- **T-05b**: Portfolio Walk-Forward at Scale — run T-10 enriched skeleton at production scale and integrate with DailyReportEngine

---

## Do Not Proceed With

- H013+ hypothesis design
- Strategy validation or backtesting
- ML model training
- ROI / win-rate / alpha / edge calculation
- External data API calls
- Production DB writes

---

## File Evidence (T-11 Complete)

**Modified files**:
- `src/lib/marketRegimeResult.ts` — FreshnessAlertLevel, FreshnessAlert, computeFreshnessAlert()
- `src/app/api/daily-report/regime/route.ts` — freshnessAlert in all 3 response branches
- `src/app/api/daily-report/regime/__tests__/t09_market_regime_api.test.ts` — mock updated with computeFreshnessAlert

**New files**:
- `src/lib/__tests__/t11_freshness_alert.test.ts` — 12 unit tests
- `src/app/api/daily-report/regime/__tests__/t11_freshness_alert_api.test.ts` — 8 API tests
- `outputs/daily_report/t11_freshness_alert_contract.json/.md`
- `outputs/daily_report/t11_guardrail_validation.json/.md`
- `outputs/daily_report/t11_readiness_decision.json/.md`
- `outputs/system_readiness/t11_next_execution_order_20260506.md`

**Test results**: 40/40 PASS  
**Guardrails**: 18/18 PASS
