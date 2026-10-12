# TRUE_EXHAUSTED Follow-up Recovery Sprint (backlog_research #auto-true-exhausted-followup)

## Objective
TRUE_EXHAUSTED follow-up: diagnose why learning data remains below the minimum trade threshold, audit data coverage blockers, and produce a concrete recovery plan with validation steps to restore usable learning flow.

## Background
Auto-generated fallback because both optimization miners produced nothing while classifier stayed TRUE_EXHAUSTED. Reason: fullTradeCount=4 < min=5

## Context
- Source: backlog_research.json item "auto-true-exhausted-followup" (priority 1).
- Trigger: TRUE_EXHAUSTED@fullTradeCount=4 < min=5
- Signal state at scheduling: TRUE_EXHAUSTED
- Previous task #142 finished with POLICY_VIOLATION.
- Task must satisfy the 8-hour quality gate before creation.

## Execution Phases
- Phase 1: Perform structural analysis on TRUE_EXHAUSTED follow-up: diagnose why learning data remains below the minimum trade threshold, audit data coverage blockers, and produce a concrete recovery plan with validation steps to restore usable learning flow., baseline the current production strategy, and document the existing edge / sharpe / drawdown before proposing any changes.
- Phase 2: Generate at least 3 strategy variants for TRUE_EXHAUSTED follow-up: diagnose why learning data remains below the minimum trade threshold, audit data coverage blockers, and produce a concrete recovery plan with validation steps to restore usable learning flow., each with explicit entry, exit, sizing, and risk-control hypotheses.
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
- true_exhausted_diagnosis.md
- learning_data_gap_report.json
- recovery_execution_plan.json
- validation_rerun_checklist.md

## Statistical Gates
- Document current fullTradeCount and target threshold delta
- List all missing data segments or blocked sync paths with counts
- Define pass criteria for exiting TRUE_EXHAUSTED on next validation run

## Constraints
- Do not modify protected paths from project profile.
- Do not claim completion without machine-readable quantitative evidence.
- Every statistical conclusion must cite the corresponding backtest or Monte Carlo evidence.
- If blocked by runtime or permissions, finalize with clear failure evidence rather than narrative-only output.
- Statistical gate required: Document current fullTradeCount and target threshold delta.
- Statistical gate required: List all missing data segments or blocked sync paths with counts.
- Statistical gate required: Define pass criteria for exiting TRUE_EXHAUSTED on next validation run.

## Acceptance Criteria
- The task outputs at least 3 strategy variants with explicit rules and assumptions.
- The task includes backtest evidence for 150 / 500 / 1500 windows and reports edge / sharpe / drawdown for each strategy.
- The task includes Monte Carlo results with at least 1000 runs per strategy plus parameter optimization findings.
- The task compares all variants against the existing strategy and ends with a final recommendation.

## Handoff Notes
- Previous task #142 finished with POLICY_VIOLATION.
- Use quantitative evidence only; avoid narrative-only conclusions.

## Allowed References
- README.md
- docs/
- wiki/
- src/
- prisma/schema.prisma