# P2-HARDRESET Pre-flight Audit

**Date:** 2026-05-11
**Classification:** `P2_PREFLIGHT_PASS`

## Summary

| Metric | Value |
|--------|-------|
| Total checks | 17 |
| PASS | 17 |
| FAIL | 0 |
| P0 corpus lines | 4500 |
| P1 corpus lines | 9900 |
| P0 mock-deterministic | 0 |
| P1 mock-deterministic | 0 |
| Frozen corpus lines | 60 |

## Check Results

| Check | Status | Detail |
|-------|--------|--------|
| P0 file exists: p0hardreset_historical_replay_corpus.jsonl | **PASS** | 3877277 bytes |
| P0 file exists: p0hardreset_historical_replay_summary.md | **PASS** | 1231 bytes |
| P0 file exists: p0hardreset_corpus_quality_gate_rerun.json | **PASS** | 5469 bytes |
| P0 file exists: p0hardreset_final_report.md | **PASS** | 11700 bytes |
| P1 file exists: p1baseline_historical_replay_corpus.jsonl | **PASS** | 6226238 bytes |
| P1 file exists: p1baseline_historical_replay_summary.json | **PASS** | 1360 bytes |
| P1 file exists: p1baseline_comparison_observability.json | **PASS** | 6333 bytes |
| P1 file exists: p1baseline_final_report.md | **PASS** | 8331 bytes |
| P0 corpus lines >= 4500 | **PASS** | 4500 lines |
| P1 corpus lines >= 9900 | **PASS** | 9900 lines |
| P0 mock-deterministic = 0 | **PASS** | found 0 |
| P1 mock-deterministic = 0 | **PASS** | found 0 |
| simulation_snapshot_corpus.jsonl = 60 lines | **PASS** | 60 lines |
| ManualReview file exists: ManualReviewWorkflowBinding.ts | **PASS** | /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System/src/lib/onlineValidation/ManualReviewWorkflowBinding.ts |
| ManualReview file exists: ManualReviewActionSchema.ts | **PASS** | /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System/src/lib/onlineValidation/ManualReviewActionSchema.ts |
| ManualReview file exists: ManualReviewOpsSurfaceAudit.ts | **PASS** | /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System/src/lib/onlineValidation/ManualReviewOpsSurfaceAudit.ts |
| ManualReview file exists: ManualReviewSurfaceContract.ts | **PASS** | /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System/src/lib/onlineValidation/ManualReviewSurfaceContract.ts |

## Result

All pre-flight checks passed. P2 audit may proceed.


---
*Observability-only. Not investment advice.*
