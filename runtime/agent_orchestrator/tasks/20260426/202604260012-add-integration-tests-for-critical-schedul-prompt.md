# 8-Hour Optimization Task: Add integration tests for critical scheduler and lifecycle flows

**Source:** test_coverage | **Risk:** LOW | **Est:** 7h | **Priority:** 48

## Problem Statement
E2E tests missing for critical flows: scheduler, lifecycle, learning, signal, sync. These paths have no automated regression protection.

## Evidence
- e2e/ contains: stock-query.spec.ts
- Missing coverage for: scheduler, lifecycle, learning, signal, sync

## Impact
A regression in scheduler or lifecycle would only be caught manually. Integration tests enable safe continuous deployment.

## Suggested Files
- `e2e/`
- `tests/`
- `jest.config.js`

## Acceptance Criteria
- [ ] Integration tests written for: scheduler, lifecycle, learning
- [ ] Tests use a test DB or mocks — no production data dependency
- [ ] All new tests pass in CI
- [ ] Tests documented in README with run instructions

## Forbidden Actions
- ⛔ Do not make tests depend on live market data
- ⛔ Do not require a running broker or live trading session

## System Constraints
- Do not modify trading thresholds or strategy parameters
- Do not require live trading decisions or broker connection
- All acceptance criteria must be testable and verifiable
- Document every significant change with rationale