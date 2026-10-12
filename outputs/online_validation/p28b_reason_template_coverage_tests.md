# P28B — Test Run Results

**Phase**: P28B-REASON-TEMPLATE-COVERAGE-HARDRESET

## Test Results

| Test File | Result | Tests |
|---|---|---|
| p27_waiting_state_policy_guard.test.ts | ✅ PASS | — |
| p27_artifact_index_consistency.test.ts | ✅ PASS | — |
| p28b_reason_template_coverage_plan.test.ts | ✅ PASS | 48/48 |
| Full `__tests__` suite | ✅ PASS | 2933/2933 (96 suites) |

## P28B-specific Test Coverage (48 tests)

- PART 1: 6 artifact existence checks
- PART 2: 4 gap matrix content checks
- PART 3: 4 repair spec content checks
- PART 4: 8 fixture snapshot checks (FX-01, FX-02, FX-03)
- PART 5: 4 mixed-signal fixture checks
- PART 6: 2 alphaScore/bucket unchanged contract checks
- PART 7: 1 scoring keyword leakage check
- PART 8: 4 forbidden claims checks
- PART 9: 1 determinism contract check
- PART 10: 5 direction inference tests (FX-SZ)
- PART 11: 4 mixed-signal fixture content checks
- PART 12: 5 patch boundary checks

**Overall**: ✅ ALL_PASS
