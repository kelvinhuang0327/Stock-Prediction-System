# P27 Waiting-State CI Guard Proposal

**Date:** 2026-05-17

## Purpose
Prevent future agents from running import / corpus expansion / optimizer when operator source has not arrived.

## Errors To Prevent
1. Import without source files present
2. Import without dry-run PASS
3. Import without approval token
4. Corpus expansion without controlled import complete
5. Optimizer without corpus expansion authorized
6. Repeated empty drop-zone scan as primary 24h task
7. DB write without token

## Guard Rules

### Rule 1: READ_FREEZE_MARKER
- Read `outputs/online_validation/p26f4_waiting_state_freeze_marker.json`
 block import, corpus expansion, optimizer

### Rule 2: REQUIRE_SOURCE_ARRIVAL_FLAG
- `candidateSourceFiles` must be > 0 before source-present gate runs
 skip gate, log `WAITING_FOR_OPERATOR_SOURCE`

### Rule 3: REQUIRE_DRY_RUN_PASS
- Dry-run must PASS before token is requested
 block token collection and import

### Rule 4: REQUIRE_EXACT_TOKEN
- Token must exactly match `P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY`
 block DB write

## Proposed Test File
`src/lib/onlineValidation/__tests__/p27_waiting_state_policy_guard.test.ts`

**Status: IMPLEMENTED this round**

> Observability only. No investment recommendations.
