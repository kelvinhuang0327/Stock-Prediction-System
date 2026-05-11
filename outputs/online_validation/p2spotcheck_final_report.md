# P2-HARDRESET Prediction Layer Spot-Check Calibration Audit — Final Report

**Round**: P2-HARDRESET v0  
**Classification**: `P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS`  
**Report generated**: 2026-05-14  
**Audit scope**: Observability only — no investment advice, no alpha/edge/ROI claims.

---

## 1. Executive Summary

This report records the first structured spot-check and calibration audit of the prediction layer historical-replay corpus. The audit degraded from FULL_BUCKET_SCORE_AUDIT to LIMITED_NON_DISCRIMINATIVE_FIELDS because the P0 corpus was generated with the scoring engine in its default mode: all `researchBucket` values are `"Neutral"` and all `scoreSnapshot` values are `0`. Bucket-stratified and score-decile analysis were not possible in this round.

All parts (A–I) completed. All gate checks passed.

---

## 2. Audit Classification

| Property | Value |
|---|---|
| auditMode | `LIMITED_NON_DISCRIMINATIVE_FIELDS` |
| classification | `P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS` |
| bucketCardinality | 1 (all `Neutral`) |
| scoreCardinality | 1 (all `0`) |
| reason | Scoring engine was in default-no-op mode during P0 corpus generation |

---

## 3. Pre-flight Gate (Part A)

- **Script**: `scripts/p2spotcheck-preflight-audit.js`
- **Artifact**: `outputs/online_validation/p2spotcheck_preflight_audit.json`
- **Result**: 17/17 checks PASS
- **Classification**: `P2_PREFLIGHT_PASS`

Checks covered: corpus existence, line counts, JSON parseability, required field presence, date plausibility, duplicate-key presence, corpusRunId format, writerVersion, validationMessages array, priceSource values, universTier presence, horizon label consistency, P1 corpus baseline types (4 types), frozen corpus integrity (60 lines), ManualReview module existence (4 files).

---

## 4. Corpus Field Inspection (Part B)

- **Script**: `scripts/inspect-p0-p1-corpus-fields-for-spotcheck.js`
- **Artifact**: `outputs/online_validation/p2spotcheck_corpus_field_inspection.json`

| Field | Finding |
|---|---|
| `researchBucket` | 100% `Neutral` — cardinality = 1 |
| `scoreSnapshot` | 100% `0` — cardinality = 1 |
| `outcomeSnapshot.returnPct` | Present; `outcomeAvailable` varies by horizon |
| `duplicateKey` | Present on all rows |
| `validationMessages` | Array (may be empty) |
| `universeTier` | Present on all rows |

**Consequence**: Bucket-stratified audit and score-decile analysis deferred to next round (requires corpus regeneration with active scoring engine).

---

## 5. Return Distribution Audit (Part C)

- **Script**: `scripts/run-p2-prediction-layer-spotcheck-audit.js`
- **Artifact**: `outputs/online_validation/p2spotcheck_prediction_layer_audit.json`

### P0 Corpus Descriptive Statistics (returnPct %)

| Horizon | Total | Covered | Mean | Median | Min | Max | Stddev |
|---|---|---|---|---|---|---|---|
| 5D | 1,500 | 1,500 | +0.923 | +0.259 | −28.81 | +56.30 | 6.15 |
| 20D | 1,500 | 1,486 | +4.589 | +1.615 | −27.52 | +75.53 | 12.26 |
| 60D | 1,500 | 1,218 | +15.095 | +9.063 | −35.87 | +144.69 | 23.70 |

Coverage: 5D=100%, 20D=99.1%, 60D=81.2% (60D has unresolved outcomes — expected for forward horizon).

### Confusion Matrix (returnPct %)

| Horizon | NEGATIVE (<0%) | FLAT (0–1%) | POSITIVE (>1%) | MISSING |
|---|---|---|---|---|
| 5D | 46% | 12% | 42% | 0% |
| 20D | 38% | 7% | 54% | 0% |
| 60D | 23% | 2% | 57% | 19% |

As horizon increases, POSITIVE outcomes increase and NEGATIVE outcomes decrease, consistent with the long-term positive drift of the TWSE universe studied.

### P1 Baseline Comparison

| Baseline Type | 5D Mean | 20D Mean | 60D Mean |
|---|---|---|---|
| BUY_AND_HOLD_ALL | +0.923% | +4.589% | +15.095% |
| STOCKQUOTE_COVERAGE_TOP_N | +1.360% | +6.881% | +22.320% |
| TOP_N_EQUAL_WEIGHT | +0.688% | +3.034% | +8.725% |
| NAIVE_RANDOM_SAMPLE | varies | varies | varies |

`BUY_AND_HOLD_ALL` returns match P0 exactly (same universe). Baselines are observability anchors only — no relative performance claims are made.

---

## 6. Walkthrough Sample Cases (Part D)

- **Script**: `scripts/sample-p2-spotcheck-walkthrough-cases.js`
- **Artifact**: `outputs/online_validation/p2spotcheck_walkthrough_cases.json`

- **Sampling strategy**: Deterministic djb2 hash — no `Math.random`
- **Cases**: 30 total (10 per horizon: 5D, 20D, 60D)
- **Coverage**: Includes POSITIVE, FLAT, NEGATIVE, and MISSING returnClass cases
- **Reproducibility**: Same input always produces same 30 cases

---

## 7. TypeScript Utility Layer (Part E)

- **Module**: `src/lib/onlineValidation/P2SpotCheckUtils.ts`
- **Tests**: `src/lib/onlineValidation/__tests__/p2spotcheck_prediction_layer_audit.test.ts`
- **Version**: `p2hardreset-spotcheck-utils-v1`

### Test Results

| Suite | Tests | Result |
|---|---|---|
| P2SpotCheckUtils — version | 1 | PASS |
| computeMean | 4 | PASS |
| computeMedian | 5 | PASS |
| computeStddev | 4 | PASS |
| computeDescStats | 2 | PASS |
| round4 | 3 | PASS |
| classifyReturn | 7 | PASS |
| assessFieldDiscriminability | 6 | PASS |
| groupReturnsByBucket | 5 | PASS |
| buildScoreDeciles | 4 | PASS |
| buildConfusionMatrix | 4 | PASS |
| containsForbiddenClaims | 8 | PASS |
| deterministicHash | 4 | PASS |
| frozen corpus integrity | 1 | PASS |
| ManualReview files unchanged | 4 | PASS |
| P2 corpus artifacts | 7 | PASS |
| **Total** | **70** | **PASS** |

Full `onlineValidation/__tests__` suite: 912/912. Full `data/__tests__` suite: 118/118.

---

## 8. Forbidden Claims Scan (Part F)

Searched all `p2spotcheck_*.md` and `p2spotcheck_*.json` artifacts for: ROI, win-rate, win rate, alpha, edge, profit, outperform, beat, buy, sell, guaranteed, investment recommendation, expected_return, predicted_return.

**Finding**: All matches appeared exclusively in disclaimer/denial context:
- *"No outperformance, alpha, or edge claims."*
- *"No ROI, win-rate, alpha, edge, or profit claims."*
- *"Not investment advice."*

**Result**: PASS — no forbidden investment claims.

---

## 9. Artifact Validation (Part G)

| Check | Result |
|---|---|
| `p2spotcheck_preflight_audit.json` parseable | PASS |
| `p2spotcheck_corpus_field_inspection.json` parseable | PASS |
| `p2spotcheck_prediction_layer_audit.json` parseable | PASS |
| `p2spotcheck_walkthrough_cases.json` parseable | PASS |
| `simulation_snapshot_corpus.jsonl` = 60 lines | PASS |
| P0 corpus = 4,500 lines | PASS |
| P1 corpus = 9,900 lines | PASS |

---

## 10. Frozen Artifacts — Integrity Status

The following artifacts were NEVER modified in this round:

| Artifact | Status |
|---|---|
| `outputs/online_validation/simulation_snapshot_corpus.jsonl` | FROZEN — 60 lines |
| `outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl` | READ-ONLY — 4,500 lines |
| `outputs/online_validation/p1baseline_historical_replay_corpus.jsonl` | READ-ONLY — 9,900 lines |
| `src/lib/onlineValidation/ManualReviewWorkflowBinding.ts` | FROZEN |
| `src/lib/onlineValidation/ManualReviewActionSchema.ts` | FROZEN |
| `src/lib/onlineValidation/ManualReviewOpsSurfaceAudit.ts` | FROZEN |
| `src/lib/onlineValidation/ManualReviewSurfaceContract.ts` | FROZEN |

---

## 11. Observability Boundaries

This audit is **descriptive statistics only**. The following are **explicitly not claimed**:

- No ROI, alpha, win-rate, edge, or profit claims
- No investment recommendations
- No "outperforms", "beats", or "guarantees"
- No `expected_return` or `predicted_return` assertions
- Return statistics are historical replay data — not forward-looking predictions

The prediction layer produces signals for workflow routing and observability. The corpus exists to audit the data pipeline, not to substantiate investment decisions.

---

## 12. Known Limitations

1. **Scoring engine was not active during P0 corpus generation.** All `researchBucket = "Neutral"` and `scoreSnapshot = 0`. Bucket-stratified and score-decile analysis require corpus regeneration.

2. **60D coverage is 81.2%.** Some outcomes were not available at the time of P0 corpus generation. This is expected — these rows are marked `outcomeAvailable: false`.

3. **P1 baselines share the same universe.** `BUY_AND_HOLD_ALL` baseline returns are identical to P0 by construction, since both use the same symbol/date set.

4. **No out-of-sample comparison.** This audit covers in-sample corpus quality only.

---

## 13. Artifacts Produced

| File | Type | Purpose |
|---|---|---|
| `p2spotcheck_preflight_audit.json` | JSON | Pre-flight gate (17 checks) |
| `p2spotcheck_preflight_audit.md` | Markdown | Human-readable pre-flight report |
| `p2spotcheck_corpus_field_inspection.json` | JSON | Field inspection + audit mode classification |
| `p2spotcheck_corpus_field_inspection.md` | Markdown | Human-readable field inspection |
| `p2spotcheck_prediction_layer_audit.json` | JSON | Descriptive stats + confusion matrix + baseline comparison |
| `p2spotcheck_prediction_layer_audit.md` | Markdown | Human-readable audit report |
| `p2spotcheck_walkthrough_cases.json` | JSON | 30 deterministic sample walkthrough cases |
| `p2spotcheck_walkthrough_cases.md` | Markdown | Human-readable walkthrough |
| `p2spotcheck_final_report.md` | Markdown | This file |
| `P2SpotCheckUtils.ts` | TypeScript | Pure utility functions (tested) |
| `p2spotcheck_prediction_layer_audit.test.ts` | TypeScript | Jest test suite (70 tests) |

Scripts produced:
- `scripts/p2spotcheck-preflight-audit.js`
- `scripts/inspect-p0-p1-corpus-fields-for-spotcheck.js`
- `scripts/run-p2-prediction-layer-spotcheck-audit.js`
- `scripts/sample-p2-spotcheck-walkthrough-cases.js`

---

## 14. Next Round Prerequisites

To reach `P2_SPOTCHECK_FULL_AUDIT` in the next round:

1. **Regenerate P0 corpus** with active scoring engine — `researchBucket` must have cardinality > 1
2. **Regenerate P0 corpus** with non-zero `scoreSnapshot` values for score-decile analysis
3. **Re-run Parts B, C, D** — bucket groups and score deciles will be meaningful
4. **Retain frozen corpus** (`simulation_snapshot_corpus.jsonl`) as-is

No code changes required — all scripts and utility functions already support FULL_BUCKET_SCORE_AUDIT mode (feature-flagged in `assessFieldDiscriminability`).

---

*End of P2-HARDRESET Prediction Layer Spot-Check Calibration Audit v0 Final Report.*
