# 8-Hour Optimization Task: Decompose large TypeScript modules to reduce cognitive load

**Source:** code_quality | **Risk:** LOW | **Est:** 6h | **Priority:** 47

## Problem Statement
19 TypeScript files in src/lib/ exceed 500 lines. Large files increase maintenance burden, reduce testability, and obscure coupling.

## Evidence
- src/lib/agent-orchestrator/optimizationMiner.ts (1380 lines)
- src/lib/agent-orchestrator/providers.ts (879 lines)
- src/lib/autonomous/SimulationExecutionEngine.ts (879 lines)
- src/lib/relevance/RelevanceInsightsService.ts (817 lines)
- src/lib/technicalIndicators.ts (810 lines)
- src/lib/report/DailyReportEngine.ts (796 lines)

## Impact
Large files slow down agent comprehension, increase bug density, and make incremental fixes risky.

## Suggested Files
- `src/lib/agent-orchestrator/optimizationMiner.ts`
- `src/lib/agent-orchestrator/providers.ts`
- `src/lib/autonomous/SimulationExecutionEngine.ts`
- `src/lib/relevance/RelevanceInsightsService.ts`
- `src/lib/technicalIndicators.ts`
- `src/lib/report/DailyReportEngine.ts`

## Acceptance Criteria
- [ ] Each identified file decomposed into focused sub-modules (< 400 lines each)
- [ ] All imports updated and TypeScript compiles with zero errors after decomposition
- [ ] Test coverage maintained or improved
- [ ] New file boundaries documented with a header comment explaining the split rationale

## Forbidden Actions
- ⛔ Do not change public API signatures
- ⛔ Do not remove existing test coverage
- ⛔ Do not refactor files not in the identified list

## System Constraints
- Do not modify trading thresholds or strategy parameters
- Do not require live trading decisions or broker connection
- All acceptance criteria must be testable and verifiable
- Document every significant change with rationale