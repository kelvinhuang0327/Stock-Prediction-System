# 8-Hour Optimization Task: Validate trend/rebound setup classification against raw price structure

**Source:** price_analysis_quality | **Risk:** LOW | **Est:** 7h | **Priority:** 72

## Problem Statement
Setup classification may not reflect actual price behavior: 84 currently open/pending trades — setup classification should be validated.

## Evidence
- 84 currently open/pending trades — setup classification should be validated

## Impact
Misclassified setups cause the learning layer to draw incorrect conclusions about what drives profits vs losses.

## Suggested Files
- `src/lib/scoring/`
- `src/lib/learning/`
- `docs/reports/`
- `wiki/v1/`

## Acceptance Criteria
- [ ] Sample 20 recent trend and 20 recent rebound closed trades
- [ ] For each: compute MA5/MA20 alignment, 5-day return before entry, volume confirmation ratio
- [ ] Report trades where MA structure contradicts the assigned setupType
- [ ] Add confusion-matrix table (setupType vs MA-regime) to docs/reports/setup_audit.json
- [ ] Document findings in wiki/v1/price-analysis-quality.md
- [ ] No automatic reclassification of existing trades

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