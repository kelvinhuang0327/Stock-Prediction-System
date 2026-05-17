# P29C Outcome Isolation / Leakage Control Design

**Paper design** | *Not investment advice*

## Outcome Fields (NEVER in scoring input)
`outcomePrice, returnPct, realizedReturnClass, benchmarkReturn, maxDrawdownAfterAsOf, futureVolatility`

Allowed location: **post-scoring evaluation artifact only**. Never in `ActiveScoringSnapshot`, `factorSnapshot`, `scoreSnapshot`, or renderer input.

## Join Timing
1. Scoring snapshot frozen
2. asOfDate feature snapshot sealed
3. PIT registry gate passed
→ THEN outcome fields may be joined for evaluation

## Leakage Classification
- `OUTCOME_LEAKAGE_DETECTED` — outcome field in scoring path
- `PIT_JOIN_VIOLATION` — outcome joined before snapshot sealed
- `SCORING_INPUT_CONTAMINATED` — alphaScore uses outcome data
- `SAFE_OBSERVABILITY_ONLY` — all clear

## Existing Evidence
- `RealPriceOutcomeResolver` already separates entry (PIT-safe) from outcome (post-asOf)
- P28D sweep: 0 outcomeLeakageCount across 572 sampled corpus rows
