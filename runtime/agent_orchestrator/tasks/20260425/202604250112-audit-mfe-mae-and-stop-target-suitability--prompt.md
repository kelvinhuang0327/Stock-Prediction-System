# 8-Hour Optimization Task: Audit MFE/MAE and stop/target suitability for TW stock volatility

**Source:** price_analysis_quality | **Risk:** LOW | **Est:** 7h | **Priority:** 72

## Problem Statement
Exit quality issues: Time-exit accounts for 100% of all exits (threshold: 40%); Avg MFE: 2.00%, Avg MAE: -1.81% across 5 trades; Sample: 5 closed trades (last 30d).

## Evidence
- Time-exit accounts for 100% of all exits (threshold: 40%)
- Avg MFE: 2.00%, Avg MAE: -1.81% across 5 trades
- Sample: 5 closed trades (last 30d)

## Impact
If stops/targets are misaligned with actual volatility, profitable moves are frequently cut short or losses allowed to extend.

## Suggested Files
- `src/lib/trading/`
- `src/lib/learning/`
- `prisma/schema.prisma`
- `docs/reports/`

## Acceptance Criteria
- [ ] Compute MFE/MAE distribution (percentiles: p25, p50, p75, p90) for last 30d closed trades
- [ ] Report time-exit, stop-hit, and target-hit breakdown as percentages
- [ ] Compare fixed stop/target distances vs ATR-proxy (high-low range / close) per symbol
- [ ] Identify trades where MFE > 2× stop distance but trade still exited at loss or time
- [ ] Produce analysis JSON to docs/reports/mfe_mae_audit.json
- [ ] Recommend diagnostics only — no threshold changes

## Forbidden Actions
- ⛔ Do not change live trading thresholds
- ⛔ Do not modify position sizing or risk floor
- ⛔ Do not auto-tune strategy parameters
- ⛔ Do not modify alphaScore or triggerScore weighting without evidence
- ⛔ Do not bypass learning gates
- ⛔ Diagnostics and reports only — no automated strategy changes

## System Constraints
- Do not modify trading thresholds or strategy parameters
- Do not require live trading decisions or broker connection
- All acceptance criteria must be testable and verifiable
- Document every significant change with rationale