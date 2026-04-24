# 8-Hour Optimization Task: Audit and close stuck SimulatedTrade lifecycle

**Source:** system_health | **Risk:** LOW | **Est:** 4h | **Priority:** 76

## Problem Statement
20 SimulatedTrades in open/pending status for > 24h — indicates broken lifecycle or missing exit trigger.

## Evidence
- Trade #102 1326 (trend) open since 2026-04-20T01:51:49.603Z
- Trade #103 2308 (trend) open since 2026-04-20T01:51:49.605Z
- Trade #104 1326 (trend) open since 2026-04-20T01:52:02.573Z
- Trade #105 2308 (trend) open since 2026-04-20T01:52:02.575Z
- Trade #109 1326 (trend) open since 2026-04-20T01:53:05.204Z

## Impact
Stuck trades pollute win rate statistics, skew learning data, and prevent accurate signal evaluation.

## Suggested Files
- `src/lib/lifecycle/`
- `src/lib/trading/`
- `scripts/`

## Acceptance Criteria
- [ ] All 20 stuck trades resolved (cancelled or closed with documented reason)
- [ ] Exit trigger logic reviewed and hardened for the identified edge case
- [ ] Zero trades in open/pending state > 24h after fix
- [ ] Write lifecycle audit report to docs/reports/lifecycle_audit.md

## Forbidden Actions
- ⛔ Do not modify pnlPct values arbitrarily
- ⛔ Do not delete trade records

## System Constraints
- Do not modify trading thresholds or strategy parameters
- Do not require live trading decisions or broker connection
- All acceptance criteria must be testable and verifiable
- Document every significant change with rationale