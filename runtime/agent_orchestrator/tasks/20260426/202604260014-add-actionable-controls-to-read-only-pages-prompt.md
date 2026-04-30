# 8-Hour Optimization Task: Add actionable controls to read-only pages missing operator interactions

**Source:** ui_ux | **Risk:** LOW | **Est:** 5h | **Priority:** 44

## Problem Statement
2 pages appear to display data without any interactive controls (no buttons, links, or forms). Operators cannot act on what they see.

## Evidence
- src/app/simplified/page.tsx — no interactive elements detected
- src/app/watchlist/page.tsx — no interactive elements detected

## Impact
Operator pages with no actions are dead ends. The system should surface at least one useful action (refresh, export, drill-down) per view.

## Suggested Files
- `src/app/simplified/page.tsx`
- `src/app/watchlist/page.tsx`

## Acceptance Criteria
- [ ] Each identified page reviewed for intended audience and purpose
- [ ] At least one actionable control added per page (refresh, export CSV, view detail, or clear filter)
- [ ] New controls documented in USER_GUIDE.md
- [ ] TypeScript compiles with zero errors

## Forbidden Actions
- ⛔ Do not add controls that trigger irreversible actions without confirmation
- ⛔ Do not remove read-only data display

## System Constraints
- Do not modify trading thresholds or strategy parameters
- Do not require live trading decisions or broker connection
- All acceptance criteria must be testable and verifiable
- Document every significant change with rationale