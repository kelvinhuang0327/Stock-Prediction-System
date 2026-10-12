# T-05B Walk-Forward Contract

**Task:** T-05B — Portfolio Walk-Forward Backtest Skeleton v2  
**Date:** 2026-05-07  
**Labels:** T-05B | observability-only | no edge claim | no production write | no DB write | no external API | no LLM call | no strategy mutation | no H001-H012

---

## Engine File

`src/lib/backtest/WalkForwardEngine.ts`

---

## Exported Functions

### `buildWalkForwardSkeleton(config?, regimeContextMap?)`

| Contract | Value |
|----------|-------|
| Uses `resolveCurrentDate()` | ✅ YES |
| No hardcoded date cap | ✅ YES |
| Lookback days | 500 (T05B_LOOKBACK_DAYS) |
| No DB write | ✅ YES |
| No external API | ✅ YES |
| No LLM call | ✅ YES |
| Regime context | Read-only injected Map |
| Output type | observability-only |

### `getRegimeContextForDate(date, contextMap)`

| Contract | Value |
|----------|-------|
| PIT-safe | ✅ YES (date <= requested date) |
| Explicit MISSING state | ✅ YES (`dataAvailabilityFlag: 'MISSING'`) |
| Never re-computes regime | ✅ YES |
| Never writes DB | ✅ YES |
| Never assumes valid on missing | ✅ YES |

### `buildMonthlyRebalanceSchedule(rangeStart, rangeEnd, tradingDates)`

| Contract | Value |
|----------|-------|
| Deterministic | ✅ YES |
| No implicit state | ✅ YES |
| Handles empty range | ✅ YES |
| Handles no trading days | ✅ YES (`dataAvailabilityFlag: 'NO_TRADING_DAYS'`) |
| Output type | schedule metadata only |

### `rankCandidatesRuleOnly(candidates, asofDate, regimeContext?)`

| Contract | Value |
|----------|-------|
| Deterministic | ✅ YES |
| Ranking basis | ALPHABETICAL_DETERMINISTIC |
| No trading output | ✅ YES |
| Output fields | rankingBasis, ruleOnlyScore, observableReasons, dataAvailabilityFlags |

### `computeTurnoverStats(prev, curr, start, end, rebalanceCount, missingCount)`

| Output Field | Description |
|---|---|
| candidateAddedCount | Count of new candidates vs prior period |
| candidateRemovedCount | Count of dropped candidates vs prior period |
| candidateRetainedCount | Count of retained candidates |
| overlapRatio | Retained / union size (0–1) |
| rebalanceCount | Number of rebalance points in period |
| missingDataCount | Dates with missing regime/market data |

---

## Lookback Contract

- **Constant:** `T05B_LOOKBACK_DAYS`
- **Value:** `500`
- **Unit:** calendar days

---

## Forbidden Output Fields

`buy`, `sell`, `signal`, `roi`, `win_rate`, `alpha`, `edge`, `profit`, `recommendation`, `outperform`

These terms must NOT appear as field names or conclusions in T-05B output artifacts.

---

## Forbidden Hypotheses

H001–H012 are retired and must NOT be referenced in T-05B.
