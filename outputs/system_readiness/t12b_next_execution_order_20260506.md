# T-12b Next Execution Order — 2026-05-06

## Completed This Round

- **T-12b Dynamic Current Date Source** — COMPLETE
  - `src/lib/time/currentDate.ts` created
  - Runtime hardcoded dates removed from 4 locations
  - API routes support `?date=` override
  - 15/15 T-12b tests PASS
  - 106/106 regression tests PASS

## Recommended Next Task

**T-05 — Portfolio Walk-Forward Backtest Skeleton (Regime-Aware, Rule-Only)**

H001-H012 are retired. The previous T-05 walk-forward skeleton was designed around hypothesis-specific signals. It should be redesigned as a regime-aware, rule-only portfolio walk-forward with the following scope:

- No hypothesis signals
- Regime context injection (uses `getLatestMarketRegimeContext()`)
- Rule-only scoring (e.g. momentum rank, quality rank)
- Walk-forward windows: 500-day lookback, monthly rebalance
- Output: portfolio equity curve and turnover stats (no ROI interpretation)
- No live data, no DB write, no strategy promotion

## Risk Flags Cleared by T-12b

- ~~Hardcoded `DEFAULT_CURRENT_DATE = '2026-05-06'` in runtime code~~ → CLEARED
- ~~API routes return stale date regardless of system time~~ → CLEARED
- ~~Tests dependent on hardcoded date constant~~ → CLEARED (mocks added)

## Remaining Stabilization Gaps

| Task | Status |
|------|--------|
| T-01 Lane scheduler + heartbeat | PARTIAL |
| T-02 Unified freshness guard + dataCoverage write | PARTIAL |
| T-05 Walk-forward backtest skeleton | NOT_STARTED (redesign required) |
| Data backfill (500-day depth) | BLOCKED — no backfill scripts for most tables |
