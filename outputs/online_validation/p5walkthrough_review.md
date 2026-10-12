# P5-HARDRESET PART C — Walkthrough Review Report

**Classification:** `P5_WALKTHROUGH_REVIEW_COMPLETE`
**Date:** 2026-05-11
**Total Cases:** 58

> **Disclaimer:** Descriptive observability review only. No investment recommendations. Not financial advice.

## Summary

### By Horizon
| Horizon | Cases |
|---------|-------|
| 5d | 31 |
| 20d | 14 |
| 60d | 13 |

### By Research Bucket
| Bucket | Cases |
|--------|-------|
| LowPriority | 17 |
| Neutral | 15 |
| Strong | 21 |
| Watch | 5 |

### Explainability Completeness
| Level | Count |
|-------|-------|
| COMPLETE | 58 |

### Score ↔ Bucket Consistency
| Status | Count |
|--------|-------|
| CONSISTENT | 53 |
| INCONSISTENT | 5 |

### Signal / Reason Consistency
| Status | Count |
|--------|-------|
| CONSISTENT | 34 |
| GENERIC | 24 |

### Outcome Mismatch Pattern
| Pattern | Count |
|---------|-------|
| OTHER | 17 |
| HIGH_SCORE_NEGATIVE_RETURN | 13 |
| LOW_SCORE_POSITIVE_RETURN | 10 |
| HIGH_SCORE_POSITIVE_RETURN | 10 |
| LOW_SCORE_NEGATIVE_RETURN | 6 |
| NEUTRAL_FLAT | 2 |

### Followup Category
| Category | Count |
|----------|-------|
| READY_FOR_NEXT_AUDIT | 29 |
| DATA_COVERAGE_REVIEW | 15 |
| SIGNAL_REASON_REVIEW | 9 |
| BUCKET_SCHEMA_REVIEW | 5 |

### Top Limitation Notes
| Note | Count |
|------|-------|
| reasonSnapshot has only one token — limited explainability | 24 |
| Scoring completeness is PARTIAL — some dimension data was unavailable | 15 |

## Case Details

| # | Symbol | Date | Hz | Bucket | Score | Decile | Return% | ReturnClass | Explainability | ScoreBucket | SignalReason | Outcome | Followup |
|---|--------|------|----|--------|-------|--------|---------|-------------|----------------|-------------|--------------|---------|----------|
| P5-CASE-001 | 1434 | 2025-10-23 | 5d | Strong | 77 | 8 | -1.95% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_NEGATIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-002 | 2454 | 2025-11-05 | 5d | Strong | 94 | 10 | -6.39% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_NEGATIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-003 | 1717 | 2025-12-22 | 5d | Strong | 85 | 9 | -0.49% | NEGATIVE | COMPLETE | CONSISTENT | GENERIC | HIGH_SCORE_NEGATIVE_RETURN | SIGNAL_REASON_REVIEW |
| P5-CASE-004 | 1536 | 2025-12-02 | 5d | Watch | 21 | 1 | 4.36% | POSITIVE | COMPLETE | INCONSISTENT | CONSISTENT | LOW_SCORE_POSITIVE_RETURN | BUCKET_SCHEMA_REVIEW |
| P5-CASE-005 | 00903 | 2025-12-03 | 5d | LowPriority | 38 | 3 | 2.30% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | LOW_SCORE_POSITIVE_RETURN | SIGNAL_REASON_REVIEW |
| P5-CASE-006 | 00712 | 2025-11-24 | 5d | Watch | 29 | 1 | 2.89% | POSITIVE | COMPLETE | INCONSISTENT | GENERIC | LOW_SCORE_POSITIVE_RETURN | BUCKET_SCHEMA_REVIEW |
| P5-CASE-007 | 1326 | 2026-01-12 | 5d | Strong | 94 | 10 | 7.55% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_POSITIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-008 | 1717 | 2025-12-04 | 5d | Strong | 85 | 9 | 4.57% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | HIGH_SCORE_POSITIVE_RETURN | SIGNAL_REASON_REVIEW |
| P5-CASE-009 | 1717 | 2026-01-13 | 5d | Strong | 82 | 9 | 17.48% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_POSITIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-010 | 1710 | 2025-12-15 | 5d | Neutral | 68 | 7 | -2.02% | NEGATIVE | COMPLETE | CONSISTENT | GENERIC | HIGH_SCORE_NEGATIVE_RETURN | DATA_COVERAGE_REVIEW |
| P5-CASE-011 | 00738U | 2025-12-19 | 5d | Neutral | 63 | 6 | 14.78% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | OTHER | DATA_COVERAGE_REVIEW |
| P5-CASE-012 | 1536 | 2025-12-02 | 5d | Watch | 21 | 1 | 4.36% | POSITIVE | COMPLETE | INCONSISTENT | CONSISTENT | LOW_SCORE_POSITIVE_RETURN | BUCKET_SCHEMA_REVIEW |
| P5-CASE-013 | 1710 | 2025-12-15 | 5d | Neutral | 68 | 7 | -2.02% | NEGATIVE | COMPLETE | CONSISTENT | GENERIC | HIGH_SCORE_NEGATIVE_RETURN | DATA_COVERAGE_REVIEW |
| P5-CASE-014 | 2330 | 2025-10-31 | 20d | Strong | 94 | 10 | -4.00% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_NEGATIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-015 | 1434 | 2025-12-11 | 20d | Strong | 77 | 8 | -0.63% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_NEGATIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-016 | 1560 | 2026-01-07 | 20d | Strong | 94 | 10 | -3.67% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_NEGATIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-017 | 1314 | 2025-10-14 | 20d | LowPriority | 33 | 2 | 14.40% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | LOW_SCORE_POSITIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-018 | 1314 | 2025-10-31 | 20d | LowPriority | 33 | 2 | 9.59% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | LOW_SCORE_POSITIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-019 | 0055 | 2025-12-08 | 20d | LowPriority | 42 | 3 | 6.08% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | OTHER | SIGNAL_REASON_REVIEW |
| P5-CASE-020 | 2454 | 2025-12-24 | 20d | Strong | 94 | 10 | 7.61% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_POSITIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-021 | 6415 | 2026-01-13 | 20d | Strong | 94 | 10 | 16.89% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_POSITIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-022 | 1717 | 2025-12-26 | 20d | Strong | 85 | 9 | 56.47% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | HIGH_SCORE_POSITIVE_RETURN | SIGNAL_REASON_REVIEW |
| P5-CASE-023 | 00891 | 2025-11-12 | 20d | Neutral | 63 | 6 | 3.44% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | OTHER | DATA_COVERAGE_REVIEW |
| P5-CASE-024 | 2317 | 2025-11-06 | 20d | Neutral | 59 | 5 | -7.86% | NEGATIVE | COMPLETE | CONSISTENT | GENERIC | OTHER | DATA_COVERAGE_REVIEW |
| P5-CASE-025 | 1314 | 2025-12-08 | 20d | LowPriority | 33 | 2 | -0.38% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | LOW_SCORE_NEGATIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-026 | 00891 | 2025-11-12 | 20d | Neutral | 63 | 6 | 3.44% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | OTHER | DATA_COVERAGE_REVIEW |
| P5-CASE-027 | 1308 | 2026-01-28 | 60d | Strong | 85 | 9 | -0.71% | NEGATIVE | COMPLETE | CONSISTENT | GENERIC | HIGH_SCORE_NEGATIVE_RETURN | SIGNAL_REASON_REVIEW |
| P5-CASE-028 | 1513 | 2025-10-15 | 60d | Strong | 77 | 8 | -7.35% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_NEGATIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-029 | 1605 | 2025-12-24 | 60d | Strong | 94 | 10 | -2.84% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_NEGATIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-030 | 0055 | 2025-11-03 | 60d | LowPriority | 42 | 3 | 5.42% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | OTHER | SIGNAL_REASON_REVIEW |
| P5-CASE-031 | 6415 | 2025-11-05 | 60d | LowPriority | 30 | 1 | 42.62% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | LOW_SCORE_POSITIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-032 | 1314 | 2025-10-16 | 60d | LowPriority | 33 | 2 | 9.28% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | LOW_SCORE_POSITIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-033 | 1513 | 2025-10-28 | 60d | Strong | 77 | 8 | 18.73% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_POSITIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-034 | 1560 | 2025-12-01 | 60d | Strong | 77 | 8 | 46.37% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_POSITIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-035 | 2330 | 2025-10-14 | 60d | Strong | 94 | 10 | 17.54% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_POSITIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-036 | 1402 | 2025-11-10 | 60d | Neutral | 59 | 5 | 3.15% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | OTHER | DATA_COVERAGE_REVIEW |
| P5-CASE-037 | 00891 | 2025-10-15 | 60d | Neutral | 63 | 6 | 13.51% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | OTHER | DATA_COVERAGE_REVIEW |
| P5-CASE-038 | 1210 | 2025-11-06 | 60d | LowPriority | 42 | 3 | -5.21% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | OTHER | READY_FOR_NEXT_AUDIT |
| P5-CASE-039 | 1402 | 2025-11-10 | 60d | Neutral | 59 | 5 | 3.15% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | OTHER | DATA_COVERAGE_REVIEW |
| P5-CASE-040 | 1536 | 2025-12-02 | 5d | Watch | 21 | 1 | 4.36% | POSITIVE | COMPLETE | INCONSISTENT | CONSISTENT | LOW_SCORE_POSITIVE_RETURN | BUCKET_SCHEMA_REVIEW |
| P5-CASE-041 | 00712 | 2025-12-02 | 20d | Watch | 29 | 1 | -1.51% | NEGATIVE | COMPLETE | INCONSISTENT | GENERIC | LOW_SCORE_NEGATIVE_RETURN | BUCKET_SCHEMA_REVIEW |
| P5-CASE-042 | 1314 | 2025-11-05 | 5d | LowPriority | 33 | 2 | -4.17% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | LOW_SCORE_NEGATIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-043 | 1314 | 2025-11-28 | 5d | LowPriority | 33 | 2 | -2.79% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | LOW_SCORE_NEGATIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-044 | 2317 | 2026-01-05 | 5d | LowPriority | 36 | 2 | -2.56% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | LOW_SCORE_NEGATIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-045 | 00903 | 2025-12-03 | 5d | LowPriority | 38 | 3 | 2.30% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | LOW_SCORE_POSITIVE_RETURN | SIGNAL_REASON_REVIEW |
| P5-CASE-046 | 00903 | 2025-10-31 | 5d | LowPriority | 38 | 3 | -4.94% | NEGATIVE | COMPLETE | CONSISTENT | GENERIC | LOW_SCORE_NEGATIVE_RETURN | SIGNAL_REASON_REVIEW |
| P5-CASE-047 | 1319 | 2025-12-12 | 5d | LowPriority | 47 | 4 | 5.34% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | OTHER | READY_FOR_NEXT_AUDIT |
| P5-CASE-048 | 1319 | 2025-10-28 | 5d | LowPriority | 47 | 4 | -0.71% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | OTHER | READY_FOR_NEXT_AUDIT |
| P5-CASE-049 | 1319 | 2025-11-25 | 5d | LowPriority | 47 | 4 | 3.36% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | OTHER | READY_FOR_NEXT_AUDIT |
| P5-CASE-050 | 1326 | 2025-12-03 | 5d | Neutral | 59 | 5 | -9.55% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | OTHER | DATA_COVERAGE_REVIEW |
| P5-CASE-051 | 1402 | 2025-10-30 | 5d | Neutral | 59 | 5 | 0.19% | FLAT | COMPLETE | CONSISTENT | GENERIC | NEUTRAL_FLAT | DATA_COVERAGE_REVIEW |
| P5-CASE-052 | 1326 | 2025-10-27 | 5d | Neutral | 59 | 5 | -6.35% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | OTHER | DATA_COVERAGE_REVIEW |
| P5-CASE-053 | 00738U | 2025-12-19 | 5d | Neutral | 63 | 6 | 14.78% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | OTHER | DATA_COVERAGE_REVIEW |
| P5-CASE-054 | 00891 | 2025-12-30 | 5d | Neutral | 63 | 6 | 7.60% | POSITIVE | COMPLETE | CONSISTENT | GENERIC | OTHER | DATA_COVERAGE_REVIEW |
| P5-CASE-055 | 1710 | 2025-12-15 | 5d | Neutral | 68 | 7 | -2.02% | NEGATIVE | COMPLETE | CONSISTENT | GENERIC | HIGH_SCORE_NEGATIVE_RETURN | DATA_COVERAGE_REVIEW |
| P5-CASE-056 | 1434 | 2025-10-23 | 5d | Strong | 77 | 8 | -1.95% | NEGATIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_NEGATIVE_RETURN | READY_FOR_NEXT_AUDIT |
| P5-CASE-057 | 1560 | 2025-12-16 | 5d | Strong | 77 | 8 | 0.14% | FLAT | COMPLETE | CONSISTENT | CONSISTENT | NEUTRAL_FLAT | READY_FOR_NEXT_AUDIT |
| P5-CASE-058 | 1326 | 2026-01-12 | 5d | Strong | 94 | 10 | 7.55% | POSITIVE | COMPLETE | CONSISTENT | CONSISTENT | HIGH_SCORE_POSITIVE_RETURN | READY_FOR_NEXT_AUDIT |

## Limitation Notes (Per Case)

**P5-CASE-003** (1717 2025-12-22 hz=5d):
- reasonSnapshot has only one token — limited explainability

**P5-CASE-005** (00903 2025-12-03 hz=5d):
- reasonSnapshot has only one token — limited explainability

**P5-CASE-006** (00712 2025-11-24 hz=5d):
- reasonSnapshot has only one token — limited explainability

**P5-CASE-008** (1717 2025-12-04 hz=5d):
- reasonSnapshot has only one token — limited explainability

**P5-CASE-010** (1710 2025-12-15 hz=5d):
- Scoring completeness is PARTIAL — some dimension data was unavailable
- reasonSnapshot has only one token — limited explainability

**P5-CASE-011** (00738U 2025-12-19 hz=5d):
- Scoring completeness is PARTIAL — some dimension data was unavailable
- reasonSnapshot has only one token — limited explainability

**P5-CASE-013** (1710 2025-12-15 hz=5d):
- Scoring completeness is PARTIAL — some dimension data was unavailable
- reasonSnapshot has only one token — limited explainability

**P5-CASE-019** (0055 2025-12-08 hz=20d):
- reasonSnapshot has only one token — limited explainability

**P5-CASE-022** (1717 2025-12-26 hz=20d):
- reasonSnapshot has only one token — limited explainability

**P5-CASE-023** (00891 2025-11-12 hz=20d):
- Scoring completeness is PARTIAL — some dimension data was unavailable
- reasonSnapshot has only one token — limited explainability

**P5-CASE-024** (2317 2025-11-06 hz=20d):
- Scoring completeness is PARTIAL — some dimension data was unavailable
- reasonSnapshot has only one token — limited explainability

**P5-CASE-026** (00891 2025-11-12 hz=20d):
- Scoring completeness is PARTIAL — some dimension data was unavailable
- reasonSnapshot has only one token — limited explainability

**P5-CASE-027** (1308 2026-01-28 hz=60d):
- reasonSnapshot has only one token — limited explainability

**P5-CASE-030** (0055 2025-11-03 hz=60d):
- reasonSnapshot has only one token — limited explainability

**P5-CASE-036** (1402 2025-11-10 hz=60d):
- Scoring completeness is PARTIAL — some dimension data was unavailable
- reasonSnapshot has only one token — limited explainability

**P5-CASE-037** (00891 2025-10-15 hz=60d):
- Scoring completeness is PARTIAL — some dimension data was unavailable
- reasonSnapshot has only one token — limited explainability

**P5-CASE-039** (1402 2025-11-10 hz=60d):
- Scoring completeness is PARTIAL — some dimension data was unavailable
- reasonSnapshot has only one token — limited explainability

**P5-CASE-041** (00712 2025-12-02 hz=20d):
- reasonSnapshot has only one token — limited explainability

**P5-CASE-045** (00903 2025-12-03 hz=5d):
- reasonSnapshot has only one token — limited explainability

**P5-CASE-046** (00903 2025-10-31 hz=5d):
- reasonSnapshot has only one token — limited explainability

**P5-CASE-050** (1326 2025-12-03 hz=5d):
- Scoring completeness is PARTIAL — some dimension data was unavailable

**P5-CASE-051** (1402 2025-10-30 hz=5d):
- Scoring completeness is PARTIAL — some dimension data was unavailable
- reasonSnapshot has only one token — limited explainability

**P5-CASE-052** (1326 2025-10-27 hz=5d):
- Scoring completeness is PARTIAL — some dimension data was unavailable

**P5-CASE-053** (00738U 2025-12-19 hz=5d):
- Scoring completeness is PARTIAL — some dimension data was unavailable
- reasonSnapshot has only one token — limited explainability

**P5-CASE-054** (00891 2025-12-30 hz=5d):
- Scoring completeness is PARTIAL — some dimension data was unavailable
- reasonSnapshot has only one token — limited explainability

**P5-CASE-055** (1710 2025-12-15 hz=5d):
- Scoring completeness is PARTIAL — some dimension data was unavailable
- reasonSnapshot has only one token — limited explainability
