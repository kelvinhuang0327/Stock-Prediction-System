# P2-HARDRESET Prediction Layer Spot-check Audit

**Date:** 2026-05-11
**Audit Mode:** `LIMITED_NON_DISCRIMINATIVE_FIELDS`
**Classification:** `P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS`

> **Note:** The P0 historical replay corpus was generated with the scoring engine
> in default mode — all `researchBucket` values are "Neutral" and all
> `scoreSnapshot` values are 0. Bucket and score audits are not possible.
> This audit presents return distribution and descriptive observability only.

---

## C.1 P0 Corpus — Descriptive Stats by Horizon

| Horizon | Total | Covered | Coverage | Mean returnPct | Median returnPct | Min | Max | StdDev |
|---------|-------|---------|----------|---------------|-----------------|-----|-----|--------|
| 5D | 1500 | 1500 | 100.0% | 0.923 | 0.2586 | -28.8136 | 56.2952 | 6.1509 |
| 20D | 1500 | 1486 | 99.1% | 4.5893 | 1.6153 | -27.521 | 75.5306 | 12.2628 |
| 60D | 1500 | 1218 | 81.2% | 15.0948 | 9.0626 | -35.8718 | 144.6889 | 23.6993 |

*returnPct values are percentages (e.g. 4.29 = +4.29%). Descriptive only.*

## C.2 Bucket Audit — NOT AVAILABLE

`researchBucket` field exists but has cardinality=1 (all "Neutral"). Bucket-level return distribution is not computable.

**Status:** `P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS`

## C.3 Score Decile Audit — NOT AVAILABLE

All `scoreSnapshot` fields are 0. Score decile distribution is not computable.

**Status:** `P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS`

## C.4 Descriptive Comparison — P0 vs P1 Baselines

*Descriptive statistics only. No outperformance, alpha, or edge claims.*

| Horizon | Corpus | N | Mean returnPct | Median returnPct | Coverage |
|---------|--------|---|---------------|-----------------|---------|
| 5D | P0 corpus | 1500 | 0.923 | 0.2586 | 100.0% |
| 5D | BUY_AND_HOLD_ALL | 1500 | 0.923 | 0.2586 | 100.0% |
| 5D | RANDOM_N_DETERMINISTIC | 600 | 0.9352 | 0 | 100.0% |
| 5D | STOCKQUOTE_COVERAGE_TOP_N | 600 | 1.3596 | 0.8277 | 100.0% |
| 5D | TOP_N_EQUAL_WEIGHT | 600 | 0.6883 | 0.3889 | 100.0% |
| 20D | P0 corpus | 1500 | 4.5893 | 1.6153 | 99.1% |
| 20D | BUY_AND_HOLD_ALL | 1500 | 4.5893 | 1.6153 | 99.1% |
| 20D | RANDOM_N_DETERMINISTIC | 600 | 4.6686 | 1.5152 | 98.8% |
| 20D | STOCKQUOTE_COVERAGE_TOP_N | 600 | 6.8809 | 3.4224 | 99.8% |
| 20D | TOP_N_EQUAL_WEIGHT | 600 | 3.0339 | 1.1559 | 99.2% |
| 60D | P0 corpus | 1500 | 15.0948 | 9.0626 | 81.2% |
| 60D | BUY_AND_HOLD_ALL | 1500 | 15.0948 | 9.0626 | 81.2% |
| 60D | RANDOM_N_DETERMINISTIC | 600 | 14.3091 | 7.8847 | 80.7% |
| 60D | STOCKQUOTE_COVERAGE_TOP_N | 600 | 22.3198 | 19.5337 | 93.2% |
| 60D | TOP_N_EQUAL_WEIGHT | 600 | 8.7251 | 4.0293 | 82.5% |

## C.5 Horizon × Realized Return Class Distribution

*NEGATIVE: returnPct < 0, FLAT: 0 ≤ returnPct ≤ 1, POSITIVE: returnPct > 1, MISSING: no outcome data*

| Horizon | NEGATIVE | FLAT | POSITIVE | MISSING | Total |
|---------|----------|------|----------|---------|-------|
| 5D | 688 (45.9%) | 178 (11.9%) | 634 (42.3%) | 0 (0.0%) | 1500 |
| 20D | 575 (38.3%) | 105 (7.0%) | 806 (53.7%) | 14 (0.9%) | 1500 |
| 60D | 341 (22.7%) | 29 (1.9%) | 848 (56.5%) | 282 (18.8%) | 1500 |

---

## Observability Statement

All results in this report are **observability-only descriptive statistics**.
- No investment recommendations are made.
- No ROI, win-rate, alpha, edge, or profit claims.
- P0 corpus reflects a historical replay with default scoring output (all Neutral / all zero).
- Bucket and score audits require a corpus regenerated with an active scoring engine.

---
*P2-HARDRESET Prediction Layer Spot-check Audit — 2026-05-11*
