# Cold-Phase Recovery — 3-Focus Deep Research (backlog_research #cold_regime_3focus)

## Objective
Investigate cold-phase patterns across three structured focuses: cold-phase strategy variants, hybrid entry timing, and distribution bias exploitation.

## Background
Triggered when COLD_REGIME confidence >= 0.6. Covers C/D/H focus areas from external research protocol.

## Context
- Source: backlog_research.json item "cold_regime_3focus" (priority 1).
- Trigger: COLD_REGIME
- Signal state at scheduling: COLD_REGIME
- Previous task #175 finished with PASS.
- Task must satisfy the 8-hour quality gate before creation.

## Execution Phases
- Phase 1: Perform structural analysis on Investigate cold-phase patterns across three structured focuses: cold-phase strategy variants, hybrid entry timing, and distribution bias exploitation., baseline the current production strategy, and document the existing edge / sharpe / drawdown before proposing any changes.
- Phase 2: Generate at least 3 strategy variants for Investigate cold-phase patterns across three structured focuses: cold-phase strategy variants, hybrid entry timing, and distribution bias exploitation., each with explicit entry, exit, sizing, and risk-control hypotheses.
- Phase 3: Run backtest batches at 150 / 500 / 1500 observations for every strategy variant and record edge, sharpe, drawdown, win rate, and stability notes in a comparable table.
- Phase 4: Execute Monte Carlo simulation at least 1000 runs per strategy, then perform parameter optimization / sensitivity analysis to identify robust vs fragile settings.
- Phase 5: Compare all variants against the existing strategy baseline, rank them quantitatively, and issue a final recommendation with rollout conditions and follow-up validation steps.

## Required Quantitative Outputs
- At least 3 strategy variants (across all focus areas if multi-focus).
- Backtest report for 150 / 500 / 1500 windows.
- Monte Carlo report with >= 1000 runs per strategy.
- Comparison matrix versus the existing strategy baseline.
- Final recommendation with rollout conditions.

## Source / Target Files
- cold_phase_strategy_report.json
- cold_phase_backtest_table.json
- hybrid_entry_strategy_report.json
- hybrid_backtest_table.json
- distribution_bias_report.json
- distribution_backtest_table.json

## Statistical Gates
- perm_p < 0.05 on cold-phase edge vs baseline
- Monte Carlo 5th-percentile drawdown < 20%
- McNemar test on hybrid vs cold-phase entry classification
- chi-squared p < 0.05 for distribution bias claim

## Constraints
- Do not modify protected paths from project profile.
- Do not claim completion without machine-readable quantitative evidence.
- Every statistical conclusion must cite the corresponding backtest or Monte Carlo evidence.
- If blocked by runtime or permissions, finalize with clear failure evidence rather than narrative-only output.
- Statistical gate required: perm_p < 0.05 on cold-phase edge vs baseline.
- Statistical gate required: Monte Carlo 5th-percentile drawdown < 20%.
- Statistical gate required: McNemar test on hybrid vs cold-phase entry classification.
- Statistical gate required: chi-squared p < 0.05 for distribution bias claim.

## Acceptance Criteria
- The task outputs at least 3 strategy variants with explicit rules and assumptions.
- The task includes backtest evidence for 150 / 500 / 1500 windows and reports edge / sharpe / drawdown for each strategy.
- The task includes Monte Carlo results with at least 1000 runs per strategy plus parameter optimization findings.
- The task compares all variants against the existing strategy and ends with a final recommendation.

## Handoff Notes
- Previous task #175 finished with PASS.
- Use quantitative evidence only; avoid narrative-only conclusions.

## Allowed References
- README.md
- docs/
- wiki/
- src/
- prisma/schema.prisma