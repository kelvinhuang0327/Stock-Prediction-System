# 8-Hour Optimization Task: Diagnose stalled lifecycle — no SimulatedTrade closes in 7 days

**Source:** lifecycle | **Risk:** LOW | **Est:** 6h | **Priority:** 62

## Problem Statement
Zero SimulatedTrade closes in the last 7 days despite 84 open/pending trades. Exit criteria may be broken or signal thresholds are unreachable.

## Evidence
- Closed in last 7 days: 0
- Currently open/pending: 84
- Expected: at least some trades closing weekly via stop-loss or target

## Impact
No closes means no completed learning samples. Win rate, PnL, and strategy adaptation are all frozen.

## Suggested Files
- `src/lib/lifecycle/`
- `src/lib/trading/`
- `scripts/`

## Acceptance Criteria
- [ ] Exit trigger logic traced end-to-end and breakage point identified
- [ ] At least 1 trade manually reviewed for why it has not closed
- [ ] Exit criteria verified to be reachable with current price data
- [ ] Write lifecycle health report to docs/reports/lifecycle_health.md

## Forbidden Actions
- ⛔ Do not force-close trades with arbitrary PnL values
- ⛔ Do not delete trade records

## System Constraints
- Do not modify trading thresholds or strategy parameters
- Do not require live trading decisions or broker connection
- All acceptance criteria must be testable and verifiable
- Document every significant change with rationale