# 8-Hour Optimization Task: Investigate and resolve recurring scheduler job failures

**Source:** system_health | **Risk:** LOW | **Est:** 6h | **Priority:** 76

## Problem Statement
6 JobRunLog entries with status=failed in the last 24h across: training:tw-worker-cycle, training:tw-self-audit. Silent failures leave the pipeline in an unknown state.

## Evidence
- training:tw-worker-cycle @ 2026-04-30T09:11:00.000Z: Unexpected non-whitespace character after JSON at position 138194
- training:tw-self-audit @ 2026-04-30T09:10:00.000Z: Unexpected non-whitespace character after JSON at position 138194
- training:tw-self-audit @ 2026-04-30T08:58:00.000Z: Unexpected non-whitespace character after JSON at position 138194
- training:tw-worker-cycle @ 2026-04-30T08:55:00.000Z: Unexpected non-whitespace character after JSON at position 138194
- training:tw-self-audit @ 2026-04-30T08:54:00.000Z: Unexpected non-whitespace character after JSON at position 138194

## Impact
Job failures prevent data sync, signal generation, and report delivery. Every failure is a silent data gap.

## Suggested Files
- `src/lib/scheduler/`
- `scripts/`
- `logs/`

## Acceptance Criteria
- [ ] Root cause identified and documented for each failed job: training:tw-worker-cycle, training:tw-self-audit
- [ ] Fix applied or retry mechanism improved
- [ ] JobRunLog shows 0 failures for the same jobs in the next 24h window
- [ ] Write incident report to docs/reports/scheduler_incident.md

## Forbidden Actions
- ⛔ Do not disable jobs without operator approval
- ⛔ Do not clear JobRunLog history

## System Constraints
- Do not modify trading thresholds or strategy parameters
- Do not require live trading decisions or broker connection
- All acceptance criteria must be testable and verifiable
- Document every significant change with rationale