# P0-HARDRESET Corpus Quality Gate Rerun

Generated: 2026-05-11T11:51:21.327Z  
Quality Status: **✅ PASS_FOR_OBSERVABILITY_ONLY**

## Corpus

| Field | Value |
|-------|-------|
| Total entries | 4500 |
| Ready (SNAPSHOT_READY) | 4204 |
| Blocked / Pending | 296 |
| Coverage ratio | 0.9342 |
| Unique asOfDates | 60 |
| Unique symbols | 25 |
| Unique horizons | 3 |

## Quality Gate Checks

- ✓ `hasEnoughDates`: true
- ✓ `hasEnoughSymbols`: true
- ✓ `hasEnoughHorizons`: true
- ✓ `coverageMeetsThreshold`: true
- ✓ `symbolCoverageGapWithinLimit`: true
- ✓ `horizonCoverageGapWithinLimit`: true
- ✓ `noProductionWrite`: true
- ✓ `noSimulationWrite`: true
- ✓ `noOptimizerWrite`: true
- ✓ `noPerformanceClaim`: true
- ✓ `noTradingSignal`: true

## Reasons

- All gates: dates=60 symbols=25 horizons=3 coverage=0.9342
- Observability-only quality gate; no production/simulation/optimizer writes permitted

## Frozen Corpus

`simulation_snapshot_corpus.jsonl`: 60 lines — **UNCHANGED**

## Safety

- No production DB write
- No mock-deterministic price source
- No forbidden claims (buy/sell/roi/win_rate/guaranteed)
- ManualReview* modules: NOT modified (frozen per P0-HARDRESET)

---
*Not investment advice. Not a trading system. Research observability corpus only.*