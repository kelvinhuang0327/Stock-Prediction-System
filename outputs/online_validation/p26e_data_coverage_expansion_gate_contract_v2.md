# P26E Data Coverage Expansion Gate Contract v2

**Phase**: P26E-HARDRESET  
**Date**: 2026-05-13  
**Contract Version**: v2

## Source Categories

| Key | Value |
|-----|-------|
| MONTHLY_REVENUE | MonthlyRevenue |
| NEWS_EVENT | NewsEvent |
| FINANCIAL_REPORT | FinancialReport |

## Source States (7)

| State | Description |
|-------|-------------|
| REAL_DATA_READY | Real DB source found and fully mapped for corpus expansion |
| REAL_DATA_PRESENT_BUT_NOT_MAPPED | Source exists in DB/Prisma but connector not yet built |
| FIXTURE_ONLY | Only a fixture file exists — no real DB source |
| MISSING_SOURCE | No source found at all |
| PIT_GATE_READY_NO_SOURCE | PIT gate contract exists but underlying data missing |
| BLOCKED_BY_CONTRACT | Blocked by existing PIT or availability contract |
| UNKNOWN_REQUIRES_MANUAL_MAPPING | Cannot determine state without manual inspection |

## Expansion Readiness States (6)

| State | Meaning |
|-------|---------|
| READY_FOR_EXPANSION_IMPLEMENTATION | Source ready — go to P26F |
| PARTIAL_SOURCE_MAPPING_REQUIRED | Source exists but mapping incomplete |
| FIXTURE_ONLY_NOT_READY | Only fixture — no real expansion possible |
| BLOCKED_BY_MISSING_SOURCE | No source at all |
| BLOCKED_BY_PIT_CONTRACT | PIT contract issue blocking expansion |
| BLOCKED_BY_SCORING_INVARIANCE | Scoring must stay frozen |

## Required Checks

- sourceExists, pitGate, asOfKey, symbolJoin, asOfDateJoin
- readOnly, noOutcomeFields, doesNotEnterScoring, minCoverageCount

## Excluded Scope

- noCorpusGeneration: **true**
- noScoringChange: **true**
- noOptimizer: **true**
- noProductionDbWrite: **true**
- noExternalApi: **true**
- noPerformanceClaim: **true**

## Output Classifications (6)

1. P26E_PARTIAL_SOURCE_MAPPING_REQUIRED
2. P26E_DATA_COVERAGE_EXPANSION_GATE_COMPLETE
3. P26E_FIXTURE_ONLY_NOT_READY
4. P26E_BLOCKED_BY_MISSING_SOURCE
5. P26E_BLOCKED_BY_SCORING_INVARIANCE
6. P26E_BLOCKED_BY_PIT_CONTRACT
