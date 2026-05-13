# Signal Saturation Deep Research Task — 3-Focus Analysis

## Objective
Build shadow strategy tracking in SIGNAL_SATURATED state, conduct signal quality analysis, and perform saturation meta-review with three validated candidate variants and promotion criteria.

## Background
The signal classifier detected SIGNAL_SATURATED with 43% confidence. No setups are penalized; saturation may be driven by over-trading or market regime shift. This task covers three concurrent focuses: signal quality filtering, shadow strategy tracking, and saturation meta-review.

## System State (at task creation)
- Signal state: **SIGNAL_SATURATED**
- Confidence: 43%
- Win rate: 69.8%
- Win-rate delta: 0.0%
- Penalized setups: 0
- Data coverage: limited

## Context
- Trigger: SIGNAL_SATURATED classifier fired.
- Reason: winRateDelta=0.00% — plateau detected (threshold 3.0%)
- Overall win rate: 69.8%
- Win-rate delta: 0.0%
- Organic trades: 53
- Penalized setups: 0
- Data coverage: limited
- Confidence score: 43%

## Research Focus Areas

### Focus SIGNAL_QUALITY: Signal Quality & Noise Filtering

**Hypothesis:** SIGNAL_SATURATED state contains extractable high-quality sub-signals that survive noise filtering; isolating them improves per-trade edge.

**Required steps:**
- Identify the top 3 setup types by trade frequency in the saturated window.
- Apply noise filters (volume gate, spread filter, time-of-day restriction) to each setup type.
- Backtest filtered variants at 150 / 500 / 1500 observations and compare against unfiltered.
- Run Monte Carlo (≥ 1000 runs) on the best-filtered variant.

**Target outputs:**
- `signal_quality_filter_report.json`
- `signal_quality_backtest_table.json`

**Statistical gates:**
- perm_p < 0.05 on filtered vs unfiltered edge
- Sharpe improvement ≥ 0.1 after filtering

### Focus SHADOW_STRATEGY: Shadow Strategy Tracking & Promotion

**Hypothesis:** Running shadow strategies in parallel during saturation allows identification of candidates ready for promotion to production without live capital risk.

**Required steps:**
- Design shadow strategy tracking framework: define tracking period, performance gate, and promotion criteria.
- Select ≥ 2 candidate strategies for shadow tracking with explicit promotion thresholds.
- Backtest each shadow candidate at 150 / 500 / 1500 observations.
- Define a promotion decision rule: minimum edge, sharpe, drawdown, and observation count.

**Target outputs:**
- `shadow_strategy_candidates.json`
- `shadow_tracking_report.json`

**Statistical gates:**
- Promoted strategy must show perm_p < 0.05 vs random baseline
- Drawdown at 5th Monte Carlo percentile < 15%

### Focus SATURATION_META: Saturation Meta-Review & Policy Update

**Hypothesis:** Persistent SIGNAL_SATURATED state signals that current execution policy is over-trading; reducing position frequency and tightening quality gates will improve risk-adjusted returns.

**Required steps:**
- Compute position frequency per unit time in the current saturated period vs historical normal periods.
- Identify which acceptance criteria or execution policy thresholds allowed low-quality entries.
- Propose updated quality gate thresholds with quantitative justification.
- Backtest a policy-tightened variant at 150 / 500 / 1500 observations.

**Target outputs:**
- `saturation_meta_review.json`
- `policy_update_proposal.json`

**Statistical gates:**
- McNemar test on rejected vs accepted entries under new policy
- chi-squared on position timing distribution

## Execution Phases
- Phase 1: Read background context, snapshot current strategy state, and document existing edge / sharpe / drawdown for each focus area before proposing any changes.
- Phase 2: For each focus area, generate at least 1 distinct strategy variant with explicit entry, exit, sizing, and risk-control hypothesis. Combined total must be ≥ 3 variants.
- Phase 3: Run backtest batches at 150 / 500 / 1500 observations for every strategy variant. Record edge, sharpe, drawdown, win rate per focus in a comparable table.
- Phase 4: Execute Monte Carlo simulation (≥ 1000 runs per strategy) and perform parameter sensitivity analysis per focus. Identify robust vs fragile settings.
- Phase 5: Cross-focus synthesis — compare all variants (per focus and across focuses) against the existing baseline, rank quantitatively, and issue a final recommendation with rollout conditions.

## Required Quantitative Outputs
- At least 3 strategy variants (across all focus areas if multi-focus).
- Backtest report for 150 / 500 / 1500 windows.
- Monte Carlo report with >= 1000 runs per strategy.
- Comparison matrix versus the existing strategy baseline.
- Final recommendation with rollout conditions.

## Source / Target Files
- signal_quality_filter_report.json
- signal_quality_backtest_table.json
- shadow_strategy_candidates.json
- shadow_tracking_report.json
- saturation_meta_review.json
- policy_update_proposal.json

## Statistical Gates
- perm_p < 0.05 on filtered vs unfiltered signal quality edge
- Shadow strategy promotion gate: drawdown at 5th Monte Carlo percentile < 15%
- McNemar test on policy-tightened entry classification

## Constraints
- Do not modify protected paths from project profile.
- Do not claim completion without machine-readable quantitative evidence.
- Every statistical conclusion must cite the corresponding backtest or Monte Carlo evidence.
- If blocked by runtime or permissions, finalize with clear failure evidence rather than narrative-only output.
- Statistical gate required: perm_p < 0.05 on filtered vs unfiltered signal quality edge.
- Statistical gate required: Shadow strategy promotion gate: drawdown at 5th Monte Carlo percentile < 15%.
- Statistical gate required: McNemar test on policy-tightened entry classification.

## Acceptance Criteria
- Each defined focus produces at least 1 strategy variant; combined total is ≥ 3 variants with explicit rules and assumptions.
- The task includes backtest evidence for 150 / 500 / 1500 windows and reports edge / sharpe / drawdown for each strategy.
- The task includes Monte Carlo results with at least 1000 runs per strategy plus parameter optimization findings.
- The task compares all variants against the existing strategy and ends with a final recommendation.
- Cross-focus synthesis section identifies the best overall recommendation across all focus areas.

## Handoff Notes
- No previous task result found.
- Use quantitative evidence only; avoid narrative-only conclusions.

## Allowed References
- README.md
- docs/
- wiki/
- src/
- prisma/schema.prisma