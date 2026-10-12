# P37 — Test Baseline

**Date:** 2026-05-21

## P37 Tests

| Group | Tests | Pass |
|---|---|---|
| 1. Integration payload governance invariants | 10 | 10 |
| 2. Payload validation — forbidden fields | 10 | 10 |
| 3. Adapter — consumer readiness classifications | 8 | 8 |
| 4. Adapter — counts-only mode | 4 | 4 |
| 5. Adapter — blocked cases | 8 | 8 |
| 6. Payload builder & summarizer | 5 | 5 |
| 7. Batch adapter | 5 | 5 |
| 8. Field list integrity | 5 | 5 |
| 9. Isolation — no DB / Prisma / scoring mutation | 5 | 5 |
| **Total** | **60** | **60** |

## Regression Results

| Suite | Pass | Total |
|---|---|---|
| P36 | 50 | 50 |
| P31 | 27 | 27 |
| P29K | 50 | 50 |
| P29L | 50 | 50 |
| P30 | 150 | 150 |

## Full onlineValidation Suite

3807/3811 pass. 4 pre-existing failures in `p27_waiting_state_policy_guard.test.ts` (DB hash drift — unrelated to P37).

## Forbidden Diff

`prisma/dev.db` and `llm_usage.jsonl` not staged. CLEAN.
