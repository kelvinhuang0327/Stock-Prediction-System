# P36 Test Baseline

## P36 Suite Results

| Metric | Value |
|--------|-------|
| Total tests | 50 |
| Passed | 50 |
| Failed | 0 |
| Result | ✅ PASS |

## Regression Suite Results

| Suite | Tests | Result |
|-------|-------|--------|
| P31 MonthlyRevenue dry-run | 50 | ✅ PASS |
| P30 Chip availableAt schema | 95 | ✅ PASS |
| P29L Chip/MonthlyRevenue backfill | 74 | ✅ PASS |
| P29K MonthlyRevenue releaseDate repair | 58 | ✅ PASS |

## Pre-existing Failures (unrelated to P36)

- `p26a_batch_pipeline_wiring.test.ts` — DB hash drift
- `p26a_renderer_fix.test.ts` — DB hash drift
- `p27_waiting_state_policy_guard.test.ts` — DB hash drift
- `p29d_dropzone_scaffold.test.ts` — DB hash drift

**P36 introduced 0 new failures.**

## Invariants

- `entersAlphaScore = false` enforced ✅
- DB not mutated by P36 tests ✅
- No corpus (.jsonl) mutations ✅
- No scoring module imports in P36 source ✅
