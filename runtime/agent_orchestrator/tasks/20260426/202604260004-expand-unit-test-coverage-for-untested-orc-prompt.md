# 8-Hour Optimization Task: Expand unit test coverage for untested orchestrator modules

**Source:** test_coverage | **Risk:** LOW | **Est:** 7h | **Priority:** 48

## Problem Statement
20 orchestrator modules have no test file: service, signalStateClassifier, storage, tasks, types. Critical planner/worker/gate logic runs without regression protection.

## Evidence
- src/lib/agent-orchestrator/service.ts — no test file
- src/lib/agent-orchestrator/signalStateClassifier.ts — no test file
- src/lib/agent-orchestrator/storage.ts — no test file
- src/lib/agent-orchestrator/tasks.ts — no test file
- src/lib/agent-orchestrator/types.ts — no test file
- src/lib/agent-orchestrator/workerTick.ts — no test file
- src/lib/agent-orchestrator/adaptivePolicy.test.ts — no test file
- src/lib/agent-orchestrator/autoCommit.test.ts — no test file

## Impact
A silent regression in planner tick, rate-limit cooldown, or backlog selection would only be caught in production.

## Suggested Files
- `src/lib/agent-orchestrator/service.ts`
- `src/lib/agent-orchestrator/signalStateClassifier.ts`
- `src/lib/agent-orchestrator/storage.ts`
- `src/lib/agent-orchestrator/tasks.ts`
- `src/lib/agent-orchestrator/types.ts`
- `src/lib/agent-orchestrator/workerTick.ts`

## Acceptance Criteria
- [ ] Test files created for: service, signalStateClassifier, storage, tasks
- [ ] Each test covers: happy path, error path, and at least one edge case
- [ ] All tests pass: jest --testPathPattern=agent-orchestrator
- [ ] Coverage report shows improvement in orchestrator module line coverage

## Forbidden Actions
- ⛔ Do not add tests that require a live DB or network connection
- ⛔ Use mocks for prisma and filesystem calls

## System Constraints
- Do not modify trading thresholds or strategy parameters
- Do not require live trading decisions or broker connection
- All acceptance criteria must be testable and verifiable
- Document every significant change with rationale