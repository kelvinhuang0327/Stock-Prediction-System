# 8-Hour Optimization Task: Audit sector and market context alignment for active proposals

**Source:** price_analysis_quality | **Risk:** LOW | **Est:** 5h | **Priority:** 72

## Problem Statement
Proposals may be generated without sufficient market/sector confirmation: Latest MarketIndex: 2026-03-17T07:20:39.000Z — cannot validate sector alignment; 43 approved proposals in last 7d — sector concentration not validated.

## Evidence
- Latest MarketIndex: 2026-03-17T07:20:39.000Z — cannot validate sector alignment
- 43 approved proposals in last 7d — sector concentration not validated

## Impact
Bullish proposals during weak sector or broad market downtrend increase false-positive rate and degrade learning signal.

## Suggested Files
- `src/lib/scoring/`
- `prisma/schema.prisma`
- `docs/reports/`
- `wiki/v1/`

## Acceptance Criteria
- [ ] Report TAIEX direction (5d return) for each approved proposal date
- [ ] Report sector distribution of active open trades (semiconductor / finance / etc.)
- [ ] Identify proposals where stock setup contradicts broad market direction
- [ ] Produce sector alignment summary in docs/reports/sector_alignment.json
- [ ] Document findings in wiki/v1/price-analysis-quality.md
- [ ] No automatic proposal rejection — report only

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