# 8-Hour Optimization Task: Diagnose and rebalance trigger distribution skew in execution layer

**Source:** execution_layer | **Risk:** LOW | **Est:** 6h | **Priority:** 68

## Problem Statement
setupType "trend" accounts for 82% of all simulated trades in the last 7 days (132/161). Skew indicates the scoring engine is over-fitting to one setup pattern.

## Evidence
- trend: 132 trades (82%)
- rebound: 29 trades (18%)

## Impact
Monoculture in trigger type kills diversification. A single bad signal floods the portfolio.

## Suggested Files
- `src/lib/scoring/`
- `src/lib/strategy/`
- `scripts/`

## Acceptance Criteria
- [ ] Root cause of trigger skew identified (scoring weight, signal density, or filtering bias)
- [ ] Scoring weights reviewed and documented with rationale
- [ ] Trigger distribution rebalanced so no single setupType > 60% of weekly trades
- [ ] Write analysis report to docs/reports/trigger_distribution_audit.md

## Forbidden Actions
- ⛔ Do not delete any SimulatedTrade records
- ⛔ Do not lower scoring thresholds arbitrarily
- ⛔ Do not modify live position sizing without approval

## System Constraints
- Do not modify trading thresholds or strategy parameters
- Do not require live trading decisions or broker connection
- All acceptance criteria must be testable and verifiable
- Document every significant change with rationale