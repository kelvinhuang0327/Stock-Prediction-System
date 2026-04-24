Phase execution plan (concise)

Phase 1 (analysis) — complete: structural diagnosis and current baseline metrics captured via audit.

Phase 2 (strategy candidates) — complete: produced 3 variants in strategy_candidates.json. Each variant includes entry/exit/sizing/risk-control and promotion criteria.

Phase 3 (backtests) — next steps:
- Run backtests for each variant at windows 150, 500, 1500 observations using existing backtest runner (see strategy_research_framework.py / rolling_backtest_engine.py).
- Commands (example):
  - python3 rolling_backtest_engine.py --variant variant_a_momentum_probe --window 150 --output /tmp/bt_a_150.json

Phase 4 (Monte Carlo) — next steps:
- Execute Monte Carlo with >=1000 runs per variant using the backtest outputs as seed; vary entry thresholds and holding periods.

Phase 5 (comparison & recommendation) — deliverables:
- Generate comparison matrix JSON with metrics: edge, sharpe, max_drawdown, win_rate, stability_score.
- Recommend variant with pass criteria (match validation_rerun_checklist.md).

Validation steps (machine-readable):
1) node scripts/audit_learning_signals.js -> fullTradesClosed >=5
2) Run backtests -> produce JSONs for 150/500/1500 windows
3) Run Monte Carlo -> montecarlo_<variant>.json with >=1000 runs
4) Produce comparison_matrix.json and final_recommendation.md

Estimated time: 6-24 hours depending on compute resources.
