# P9 Corpus Quality Gate

**qualityGateVersion:** corpus-quality-gate-v0
**qualityRunId:** p9-corpus-quality-gate-20260511-001
**generatedAt:** 2026-05-11T06:02:30.216Z
**qualityStatus:** DATA_LIMITED
**validationStatus:** PASS

## Coverage Summary
- totalEntries: 24
- asOfDateCount: 4
- symbolCount: 2
- horizonCount: 3
- coverageRatio: 0.5833
- symbolCoverageGap: 0.3333
- horizonCoverageGap: 0.875

## Per-Symbol Coverage
- 2330: total=12, ready=9, blocked=3, ratio=0.7500
- 2454: total=12, ready=5, blocked=7, ratio=0.4167

## Per-Horizon Coverage
- 5D: total=8, ready=8, blocked=0, ratio=1.0000
- 20D: total=8, ready=5, blocked=3, ratio=0.6250
- 60D: total=8, ready=1, blocked=7, ratio=0.1250

## Quality Checks
- hasEnoughDates: true
- hasEnoughSymbols: true
- hasEnoughHorizons: true
- coverageMeetsThreshold: true
- symbolCoverageGapWithinLimit: true
- horizonCoverageGapWithinLimit: false
- noProductionWrite: true
- noSimulationWrite: true
- noOptimizerWrite: true
- noPerformanceClaim: true
- noTradingSignal: true

## Reasons
- horizonCoverageGap=0.875 > maxHorizonCoverageGap=0.35 => DATA_LIMITED

> Observability-only quality gate. No performance claims. No production writes.
