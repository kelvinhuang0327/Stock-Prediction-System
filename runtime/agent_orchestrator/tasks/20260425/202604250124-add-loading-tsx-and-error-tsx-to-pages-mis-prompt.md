# 8-Hour Optimization Task: Add loading.tsx and error.tsx to pages missing async feedback

**Source:** ui_ux | **Risk:** LOW | **Est:** 5h | **Priority:** 44

## Problem Statement
20 page directories lack loading.tsx or error.tsx. Operators see blank screens or crashes during slow fetches or API errors.

## Evidence
- Missing loading/error in src/app
- Missing loading/error in src/app/analysis
- Missing loading/error in src/app/asset-doubling
- Missing loading/error in src/app/backtest
- Missing loading/error in src/app/candidates
- Missing loading/error in src/app/calendar

## Impact
Operator usability degrades when pages load silently or crash without explanation during market data fetches.

## Suggested Files
- `src/app`
- `src/app/analysis`
- `src/app/asset-doubling`
- `src/app/backtest`
- `src/app/candidates`
- `src/app/calendar`

## Acceptance Criteria
- [ ] loading.tsx added to all identified page directories
- [ ] error.tsx added to all identified page directories
- [ ] Each loading state shows a meaningful skeleton or spinner (not a blank screen)
- [ ] Each error state shows the error message and a retry action
- [ ] TypeScript compiles with zero errors

## Forbidden Actions
- ⛔ Do not modify page business logic
- ⛔ Do not change routing structure

## System Constraints
- Do not modify trading thresholds or strategy parameters
- Do not require live trading decisions or broker connection
- All acceptance criteria must be testable and verifiable
- Document every significant change with rationale