# T-04 Next Execution Order

**Generated:** 2026-05-06  
**Current status:** T-01 DONE, T-02 DONE, T-03 DONE, T-04 DONE

---

## P0 Immediate

**T- Portfolio Walk-Forward Skeleton (rule-only, P4-ready)**05 

- H001-H012 are retired. The old walk-forward must be redesigned.
- Build a rule-only walk-forward engine using existing MarketRegimeResult + StockQuote.
- No ML, no hypothesis, no signal promotion.
- Produce: rolling window results, regime-tagged rows, PIT-safe records.
- Target: 500-day depth validation.

---

## P1 Next

**T- Dynamic Date (remove DEFAULT_CURRENT_DATE hardcode)**12b 
- Replace `DEFAULT_CURRENT_DATE = '2026-05-06'` with `new Date().toISOString().slice(0,10)`.
- Apply to: computeFreshnessAlert(), getLatestMarketRegimeContext(), buildDailyOpsReport().
- Tests must still PASS.

**T- Unified Freshness Guard completeness review**02b 
- Verify dataCoverage write path is safe and complete.
- Confirm freshness guard covers all data tables audited in P4-01S.

---

## P2 Deferred

**T- Ops Report UI Dashboard**03b 
- Build a minimal UI page reading /api/report/ops.
- Not blocking any P4 execution path.

**SafetyGuard orchestrator integration**
- Extend SafetyGuard to orchestrator task routes beyond daily-sync.
- Low  daily-sync is the primary cron gate.urgency 

---

## Do Not Continue

- Do not design H013+
- Do not run strategy validation
- Do not compute ROI / win-rate
- Do not produce buy / sell signals
- Do not modify production strategy behavior
- Do not write production DB
