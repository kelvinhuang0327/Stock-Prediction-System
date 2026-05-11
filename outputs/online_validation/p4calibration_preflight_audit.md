# P4 Calibration Pre-flight Audit

**Classification**: `P4_PREFLIGHT_PASS`
**Date**: 2026-05-11  **Gates**: 24/24 PASS

## Gate Results

| Gate | Result | Detail |
|------|--------|--------|
| FILE_EXISTS:p3active_scoring_historical_replay_corpus.jsonl | ✓ PASS | PASS |
| FILE_EXISTS:p3active_scoring_field_inspection.json | ✓ PASS | PASS |
| FILE_EXISTS:p3active_scoring_final_report.md | ✓ PASS | PASS |
| FILE_EXISTS:p1baseline_historical_replay_corpus.jsonl | ✓ PASS | PASS |
| FILE_EXISTS:simulation_snapshot_corpus.jsonl | ✓ PASS | PASS |
| FILE_EXISTS:p0hardreset_historical_replay_corpus.jsonl | ✓ PASS | PASS |
| P1_SUMMARY_OR_COMPARISON_EXISTS | ✓ PASS | PASS |
| P3_MIN_LINES_4500 | ✓ PASS | PASS |
| P3_MIN_SYMBOLS_25 | ✓ PASS | PASS |
| P3_MIN_ASOFDATES_60 | ✓ PASS | PASS |
| P3_NO_MOCK_DETERMINISTIC | ✓ PASS | PASS |
| P3_COMPLETENESS_STATUS_PRESENT_ALL | ✓ PASS | PASS |
| P3_COMPLETE_OR_PARTIAL_POSITIVE | ✓ PASS | PASS |
| P3_EMPTY_RATIO_NOT_100PCT | ✓ PASS | PASS |
| P3_NON_ZERO_SCORES_EXIST | ✓ PASS | PASS |
| P3_BUCKET_NOT_ALL_NEUTRAL | ✓ PASS | PASS |
| P3_PIT_VIOLATIONS_ZERO | ✓ PASS | PASS |
| P1_MIN_LINES_9900 | ✓ PASS | PASS |
| P1_MIN_BASELINE_TYPES_4 | ✓ PASS | PASS |
| P1_NO_MOCK_DETERMINISTIC | ✓ PASS | PASS |
| FROZEN_FROZEN_LINES_60 | ✓ PASS | PASS |
| FROZEN_P0_LINES_4500 | ✓ PASS | PASS |
| FROZEN_P1_LINES_9900 | ✓ PASS | PASS |
| FROZEN_P3_LINES_4500 | ✓ PASS | PASS |

## P3 Active-Scoring Corpus
| Field | Value |
|-------|-------|
| Lines | 4500 |
| Unique symbols | 25 |
| Unique asOfDates | 60 |
| COMPLETE | 3099 |
| PARTIAL | 1401 |
| EMPTY | 0 |
| Usable ratio | 100.0% |
| Non-zero score | 4500 |
| Unique buckets | LowPriority, Watch, Neutral, Strong |
| PIT violations | 0 |

## P1 Baseline Corpus
| Field | Value |
|-------|-------|
| Lines | 9900 |
| Baseline types | BUY_AND_HOLD_ALL, TOP_N_EQUAL_WEIGHT, RANDOM_N_DETERMINISTIC, STOCKQUOTE_COVERAGE_TOP_N |


---
*Not investment advice. Not a trading system.*