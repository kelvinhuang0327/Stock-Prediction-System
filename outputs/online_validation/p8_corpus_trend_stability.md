# P8 Corpus Trend Stability

| Field | Value |
|-------|-------|
| generatedAt | 2026-05-11T05:42:28.018Z |
| trendRunId | p8-corpus-trend-stability-20260511-001 |
| trendStabilityVersion | corpus-trend-stability-v0 |
| inputAsOfDateCount | 3 |
| inputTotalEntries | 18 |
| stabilityStatus | STABLE_FOR_OBSERVABILITY_ONLY |

## Coverage Trend Summary

| Metric | Value |
|--------|-------|
| dateCount | 3 |
| minCoverageRatio | 0.5000 |
| maxCoverageRatio | 0.6667 |
| averageCoverageRatio | 0.5556 |
| largestCoverageDrop | 0.0000 |
| largestCoverageRise | 0.1667 |
| stableDateCount | 3 |
| unstableDateCount | 0 |

## Stability Checks

- hasEnoughDates: true
- coverageDropWithinLimit: true
- averageCoverageMeetsThreshold: true
- noProductionWrite: true
- noSimulationWrite: true
- noOptimizerWrite: true
- noPerformanceClaim: true
- noTradingSignal: true

## Reasons

- hasEnoughDates=true coverageDropWithinLimit=true avgCoverage=0.556
- Observability-only stability; no production, simulation, or optimizer writes permitted

## Safety Guardrails
- productionWriteAllowed: false
- simulationWriteAllowed: false
- optimizerWriteAllowed: false
- No performance claims
- No trading signals

## Status: STABLE_FOR_OBSERVABILITY_ONLY
