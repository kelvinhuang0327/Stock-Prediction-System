# P27  No-write Test MatrixOvernight 

**Date:** 2026-05-18 UTC

## Test Results

| ID | Suite | Tests | Passed | Status |
|----|-------|-------|--------|--------|
| F1a | p27_waiting_state_policy_guard.test.ts | 18 | 18 | PASS |
| F1b | p27_artifact_index_consistency.test.ts | 11 | 11 | PASS |
| F2 | Full onlineValidation/__tests__ (95 suites) | 2885 | 2885 | PASS |
| F3 |  | DEFERRED |admin/__ | tests__ | 
| F4 |  | DEFERRED |tsc -- | noEmit | 

**Overall: 2885/2885 PASS**

## Notes

- F3 deferred: not critical path for this audit
- F4 deferred: pre-existing TS errors in data-quality route (unrelated to this audit)
- No production code modified

---
*Observability only. No investment recommendations.*
