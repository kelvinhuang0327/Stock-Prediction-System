# 8-Hour Optimization Task: Audit price data quality for active simulated trades and current candidates

**Source:** price_analysis_quality | **Risk:** LOW | **Est:** 5h | **Priority:** 72

## Problem Statement
Price data quality issues detected: Latest quote: 2026-04-18T16:28:29.000Z (stale > 48h); 24 StockQuote rows with volume ≤ 0; 2 active simulated-trade symbols need fresh price data.

## Evidence
- Latest quote: 2026-04-18T16:28:29.000Z (stale > 48h)
- 24 StockQuote rows with volume ≤ 0
- 2 active simulated-trade symbols need fresh price data

## Impact
Stale or corrupted price data silently degrades all indicator calculations, trigger scoring, and strategy learning.

## Suggested Files
- `scripts/`
- `src/lib/sync/`
- `prisma/schema.prisma`
- `docs/reports/`

## Acceptance Criteria
- [ ] Produce JSON report of latest quote date per active symbol (docs/reports/price_data_quality.json)
- [ ] Report count of missing trading days per symbol for last 30 days
- [ ] Report all zero-volume and OHLC-anomaly rows with symbol/date
- [ ] Verify pipeline sync covers all open-trade symbols within 48h
- [ ] Add DB query assertions for OHLC integrity to data sync pipeline tests

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