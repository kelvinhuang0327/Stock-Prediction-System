# P4-HARDRESET: Final Calibration Audit Report

**Classification:** `P4_FULL_CALIBRATION_AUDIT_COMPLETE`  
**Date:** 2026-05-12  
**Phase:** P4 — Full Bucket / Score Calibration Audit on Active-Scoring Replay Corpus  
**Preceding phases:** P0 (real-price corpus) → P1 (baseline corpus) → P2 (spot-check) → P3 (active scoring capture) → **P4 (calibration audit)**

---

## Safety Invariants (ALL MAINTAINED)

- No writes to production DB
- No modification of SignalFusion / RuleBased / StrategyScreen scoring formulas
- No modification of P0 / P1 / P3 / frozen corpora
- No modification of ManualReview* modules
- No external API or LLM calls
- All statistics are **descriptive only** — no ROI, win-rate, alpha, profit, guaranteed, outperform, buy/sell signal, or investment recommendation language in any output

---

## 1. Objectives

P4 is a calibration **observability audit** only. Its purpose is to describe how realized returns are distributed across:

- Research buckets (LowPriority / Watch / Neutral / Strong)
- Score deciles (1–10, deterministic percentile mapping)
- Scoring completeness status (COMPLETE / PARTIAL / EMPTY)
- Prediction horizon (5 / 20 / 60 days)

P4 makes **no model changes**, **no scoring changes**, and **no performance claims**. All statistics are descriptive.

---

## 2. Corpus Summary

| Corpus | Lines | Symbols | Notes |
|--------|-------|---------|-------|
| Simulation snapshot (P0 seed) | 60 | — | Frozen |
| P0 historical replay | 4,500 | 25 | Frozen |
| P1 baseline replay | 9,900 | — | Frozen |
| P3 active scoring replay | 4,500 | 25 | Frozen |

P3 corpus buckets: `LowPriority=1158`, `Watch=462`, `Neutral=1401`, `Strong=1479`

No `InsufficientData` rows at top level — all 25 symbols returned scored results with sufficient data.

---

## 3. Preflight Audit (PART A)

**24 / 24 gates PASS** — `P4_PREFLIGHT_PASS`

Gates covered:
- File existence (all 4 corpora present)
- P3 corpus: lines ≥ 4500, symbols ≥ 25, dates ≥ 60, no mock-determinism markers, completeness status present, COMPLETE+PARTIAL > 0, empty ratio < 100%, non-zero scores > 0, buckets not all Neutral, PIT violations = 0
- P1 corpus: lines ≥ 9900, ≥ 4 baseline types, no mock-determinism markers
- Frozen line counts: exact match for all 4 corpora

---

## 4. Overall Return Distribution by Horizon (PART C.1)

All returns are realized % return from historical price data (not predicted). Descriptive statistics only.

| Horizon | n | Non-Missing | Mean % | Median % | StdDev | Positive% | Negative% | Flat% | Missing% |
|---------|---|-------------|--------|----------|--------|-----------|-----------|-------|----------|
| 5 days  | 1500 | 1500 | 0.92 | 0.26 | 6.15 | 42.3% | 45.9% | 11.9% | 0.0% |
| 20 days | 1500 | 1486 | 4.59 | 1.62 | 12.26 | 53.7% | 38.3% | 7.0% | 0.9% |
| 60 days | 1500 | 1218 | 15.09 | 9.06 | 23.70 | 56.5% | 22.7% | 1.9% | 18.8% |

> Missing ratio in 60-day horizon reflects rows near end of historical data window where 60-day forward price was unavailable.

---

## 5. Bucket Return Distribution (PART C.2)

Return distributions by research bucket (descriptive). Each bucket appears across all 3 horizons.

**P3 corpus bucket population:**
- `LowPriority`: 1,158 rows
- `Watch`: 462 rows
- `Neutral`: 1,401 rows
- `Strong`: 1,479 rows

Completeness distribution per bucket:
- `LowPriority`: 100% COMPLETE, 0% PARTIAL
- `Neutral`: 0% COMPLETE, 100% PARTIAL
- `Watch`: mixed (COMPLETE + PARTIAL)
- `Strong`: predominantly COMPLETE

---

## 6. Score Decile Distribution (PART C.3)

Deciles are computed via deterministic unique-score percentile mapping. Tied scores always receive the same decile. Formula: `Math.min(10, Math.floor((i / (n-1)) * 9) + 1)` where `i` is index in sorted unique scores array.

- Score range in P3 corpus: non-zero scores present across all 3 horizons
- Unique deciles represented: ≥ 5 distinct deciles per horizon
- Unique score count: ≥ 5 unique scores per horizon
- `byScoreDecile` artifact: 30 entries (10 deciles × 3 horizons)

---

## 7. Completeness Return Distribution (PART C.4)

Rows are classified by `scoringCompleteness` field in P3 corpus:
- `COMPLETE`: all scoring dimensions had data
- `PARTIAL`: some scoring dimensions had partial data (all Neutral bucket rows)
- `EMPTY`: no scoring data available (0 rows in P3 corpus)

Completeness × horizon return distributions computed and written to audit artifact.

---

## 8. Confusion Matrices (PART C.5)

Two confusion matrix perspectives (descriptive frequency counts only):

**By Bucket** (`confusionMatrices.byBucket`):
- Rows: research bucket label
- Columns: realized return class (POSITIVE / NEGATIVE / FLAT / MISSING)

**By Score Decile** (`confusionMatrices.byScoreDecile`):
- Rows: score decile 1–10
- Columns: realized return class (POSITIVE / NEGATIVE / FLAT / MISSING)

These are frequency distributions, not accuracy metrics. No performance claims are made.

---

## 9. Prediction vs Baseline Comparison (PART C.6)

**Disclaimer in artifact:** "Descriptive distribution comparison only. No performance claims implied. Not investment advice."

Comparison is between P3 (active scoring) and P1 (baseline) realized return distributions by horizon. Fields compared: mean, median, stddev, positive/negative/flat ratio, count coverage.

This is a distributional snapshot comparison only.

---

## 10. Walkthrough Cases (PART D)

**58 total cases** sampled deterministically (djb2 hash, no Math.random).

| Label | Cases |
|-------|-------|
| high-score-negative | 9 |
| low-score-positive | 9 |
| high-score-positive | 9 |
| neutral-or-insufficient | 6 |
| completeness-COMPLETE | 3 |
| completeness-PARTIAL | 3 |
| bucket-coverage-Watch | 2 |
| decile-2-coverage | 3 |
| decile-3-coverage | 2 |
| decile-4-coverage | 3 |
| decile-5-coverage | 3 |
| decile-6-coverage | 2 |
| decile-7-coverage | 1 |
| decile-8-coverage | 2 |
| decile-10-coverage | 1 |

**By horizon:** hz=5: 31 cases, hz=20: 14 cases, hz=60: 13 cases

Dedup key is label-scoped (`${label}|${stableKey(row)}`), allowing the same row to appear under different mandatory scenario labels.

---

## 11. Readiness Decision (PART E)

**29 / 29 gates PASS** — `P4_FULL_CALIBRATION_AUDIT_COMPLETE`

Gate categories:
- Preflight pass (1 gate)
- Corpus size (2 gates)
- Score decile spread: ≥ 5 unique scores and ≥ 5 distinct deciles per horizon (6 gates)
- Bucket schema: no unknown buckets + all critical buckets present (Strong / Watch / Neutral / LowPriority) (2 gates)
- Walkthrough completeness: ≥ 30 total cases, ≥ 12 per horizon, mandatory scenario coverage (4 gates)
- Usable ratio ≥ 50% for hz=5 and hz=20 (2 gates)
- Baseline comparison horizons present (1 gate)
- Additional structural gates (11 gates)

> **Gate design note:** `InsufficientData` bucket is schema-valid but not required. Gate checks for *unknown* buckets (schema violations) and for the presence of the 4 critical buckets. All 25 symbols had sufficient data in P3 corpus.

---

## 12. Test Results (PART F)

**49 / 49 unit tests PASS** across 11 describe blocks in `p4calibration_audit_utils.test.ts`.

**1009 / 1009 regression tests PASS** across 47 test suites (full Jest run with `--no-coverage`).

Test coverage areas:
- `computeDescriptiveStats` (8 tests): empty, mean/median, even-length median, missing values, ratios, stddev
- `classifyRealizedReturn` (4 tests): POSITIVE / FLAT / NEGATIVE / MISSING
- `extractPrimaryScore` (3 tests): alphaScore priority, researchScore fallback, both-missing case
- `computeScoreDecileMap` (6 tests): tied scores, tieCount, uniqueScoreCount, determinism
- `buildBucketReturnStats` (3 tests): grouping, completeness distribution, null returnPct
- `buildScoreDecileStats` (4 tests): horizonDays, determinism, metadata, bucketDistribution
- `buildCompletenessReturnStats` (2 tests): grouping, EMPTY status
- `buildBucketConfusionMatrix` (2 tests): POSITIVE/NEGATIVE/FLAT/MISSING counts
- `buildScoreDecileConfusionMatrix` (2 tests): dimension, key format
- `comparePredictionToBaseline` (5 tests): disclaimer, no forbidden claims, horizon entries, coverage ratios, empty prediction
- `scanForbiddenClaims` (10 tests): detects roi/win-rate/outperform/guaranteed/profit/buy-signal/sell-signal/alpha-edge; clean for descriptive text and field names

---

## 13. Forbidden Claims Scan (PART G)

`grep -RniE "ROI|win-rate|win rate|outperform|guaranteed|profit|trading.edge|alpha.edge|beat.market|buy.signal|sell.signal|investment.recommendation"` scanned across all output artifacts and source files.

**Result: CLEAN**

All matches were:
1. In `scanForbiddenClaims()` function's own pattern definitions (the scanner's implementation)
2. In a module-level documentation comment noting what the module avoids

No forbidden investment claim language appears in any output artifact (JSON, Markdown, or walkthrough case).

---

## 14. Artifact Validation (PART H)

| Check | Result |
|-------|--------|
| `p4calibration_preflight_audit.json` — valid JSON | PASS |
| `p4calibration_full_audit.json` — valid JSON | PASS |
| `p4calibration_walkthrough_cases.json` — valid JSON | PASS |
| `p4calibration_readiness_decision.json` — valid JSON | PASS |
| `byHorizon` key present (3 items) | PASS |
| `byBucket` key present | PASS |
| `byScoreDecile` key present (30 items) | PASS |
| `confusionMatrices` key present | PASS |
| `predictionVsBaseline` key present | PASS |
| `simulation_snapshot_corpus.jsonl` = 60 lines | PASS |
| `p0hardreset_historical_replay_corpus.jsonl` = 4500 lines | PASS |
| `p1baseline_historical_replay_corpus.jsonl` = 9900 lines | PASS |
| `p3active_scoring_historical_replay_corpus.jsonl` = 4500 lines | PASS |

**All 13 artifact validation checks PASS.**

---

## 15. Files Committed

### New Source Files
- `src/lib/onlineValidation/P4CalibrationAuditUtils.ts` — Core TypeScript utility module
- `src/lib/onlineValidation/__tests__/p4calibration_audit_utils.test.ts` — 49 unit tests

### New Scripts
- `scripts/p4calibration-preflight-audit.js` — PART A preflight (24 gates)
- `scripts/run-p4-full-calibration-audit.js` — PART C full calibration audit
- `scripts/sample-p4-calibration-walkthrough-cases.js` — PART D deterministic sampling
- `scripts/decide-p4-calibration-readiness.js` — PART E readiness decision (29 gates)

### New Outputs
- `outputs/online_validation/p4calibration_preflight_audit.json` + `.md`
- `outputs/online_validation/p4calibration_full_audit.json` + `.md`
- `outputs/online_validation/p4calibration_walkthrough_cases.json` + `.md`
- `outputs/online_validation/p4calibration_readiness_decision.json` + `.md`
- `outputs/online_validation/p4calibration_final_report.md` ← this file

---

## 16. CEO Audit Contributions

### A — Active Scoring Observability
P4 provides the first structured view of how the active scoring system (P3 corpus, 4500 rows, 25 symbols, 3 horizons) distributes realized returns across buckets, score deciles, and completeness tiers. This is a calibration baseline for future audit rounds.

### B — Prediction vs Baseline Distributional Comparison
P4 includes a side-by-side descriptive comparison of P3 (active scoring) realized return distributions against P1 (baseline) distributions by horizon. This is a reference distribution snapshot only — no causal claims, no performance claims.

---

## 17. Limitations

1. **Descriptive only**: All statistics describe the distribution of historical realized returns in the corpus. No predictions, no recommendations, no claims about future behavior.
2. **P3 corpus is a snapshot**: 4500 rows covering 25 symbols across 3 horizons from one historical window. Does not represent all market conditions.
3. **Score decile interpretation**: Decile assignment is a rank-ordering of scores within this corpus. It does not imply any ordinal property of realized returns.
4. **Missing 60-day returns (18.8%)**: Rows near the end of the data window lack 60-day forward prices. This is expected, not a data quality issue.
5. **InsufficientData bucket absent**: All 25 symbols had sufficient data. A corpus with more symbols or shorter history would likely surface this bucket.

---

## 18. Next Round Recommendation

P4 establishes the calibration observability baseline. Suggested next steps (for a future P5 round):

1. **Expand symbol coverage**: Include ≥50 symbols to exercise `InsufficientData` bucket paths.
2. **Multi-window validation**: Run P3/P4 on 3 non-overlapping historical windows to assess temporal stability of distributions.
3. **Decile monotonicity audit**: Check whether higher score deciles tend to have different return distributions — purely descriptive, no performance claims.
4. **Completeness root cause**: Investigate why all Neutral bucket rows are PARTIAL (may be an expected scoring pipeline characteristic).

---

## 19. Hardreset Phase Summary

| Phase | Description | Commit | Status |
|-------|-------------|--------|--------|
| P0 | Real-price corpus (60→4500 rows) | 5426c68 + 5c2802f | ✅ COMPLETE |
| P1 | Baseline corpus (9900 rows) | c5fcaf5 | ✅ COMPLETE |
| P2 | Spot-check audit | 37a3f46 | ✅ COMPLETE |
| P3 | Active scoring capture (48/48 tests) | f78b412 | ✅ COMPLETE |
| P4 | Calibration audit (49+1009 tests, 29 gates) | — | ✅ `P4_FULL_CALIBRATION_AUDIT_COMPLETE` |

---

*This report was generated as part of the P4-HARDRESET calibration audit. All statistics are descriptive only. Not investment advice.*
