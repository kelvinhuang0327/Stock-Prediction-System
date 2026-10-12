# P5-HARDRESET: Manual Walkthrough Calibration Case Review — Final Report

**Phase:** P5-HARDRESET  
**Classification:** `P5_WALKTHROUGH_REVIEW_COMPLETE` + `P5_REQUIRES_BUCKET_SCHEMA_REPAIR` (P0 backlog item active)  
**Scope:** Engineering observability only. No model changes. No scoring changes. No investment claims.  
**Commit:** `78adf87` — "P5-HARDRESET: Manual walkthrough calibration case review" (12 files, 3,683 insertions)  
**Generated:** 2025-01-01 (deterministic — no real-time clock dependency in artifacts)  

---

## 1. Objective

P5-HARDRESET is a structured engineering observability walkthrough of the 58 P4 calibration cases. The goal is to identify explainability gaps, score–bucket mismatches, and signal/reason quality issues in the scoring pipeline — **not** to change models, scoring behavior, or produce investment recommendations.

No claims about ROI, win-rate, alpha-edge, profit, or outperformance are made anywhere in this phase.

---

## 2. Preflight Gate — PASS

| Gate | Result |
|------|--------|
| Preflight gates passed | **24 / 24** |
| Preflight classification | `P5_PREFLIGHT_PASS` |
| Corpus files verified | 4 (sim=60, p0=4,500, p1=9,900, p3=4,500 — unchanged) |
| Math.random calls | 0 |
| Forbidden claims in codebase scan | 0 |

All prerequisite conditions were met before walkthrough execution.

---

## 3. Walkthrough Case Population

| Dimension | Count |
|-----------|-------|
| Total cases reviewed | **58** |
| 5-day horizon | 31 (53%) |
| 20-day horizon | 14 (24%) |
| 60-day horizon | 13 (22%) |

**By research bucket:**

| Bucket | Count |
|--------|-------|
| Strong | 21 |
| LowPriority | 17 |
| Neutral | 15 |
| Watch | 5 |

---

## 4. Review Rubric Results

### 4.1 Explainability Completeness

| Status | Count | % |
|--------|-------|---|
| COMPLETE | **58** | 100% |
| PARTIAL | 0 | 0% |
| WEAK | 0 | 0% |

**Finding:** All 58 cases carry a research bucket, a primary score, and a reason snapshot of adequate length (≥3 tokens). The explainability dimension shows full population coverage.

> Note: `COMPLETE` here means structural completeness (fields present, reason non-trivial). It does not imply the reason is semantically precise — see Section 4.3 for signal/reason quality findings.

---

### 4.2 Score ↔ Bucket Consistency

| Status | Count | % |
|--------|-------|---|
| CONSISTENT | 53 | 91.4% |
| INCONSISTENT | **5** | 8.6% |
| BORDERLINE | 0 | 0% |

**Finding:** 5 cases have a score value that falls outside the declared bucket's expected band. These are the P0 repair target (see Section 6). The issue suggests either bucket assignment logic or score normalization has an edge-case misalignment.

Bucket score bands used for evaluation:
- Strong: 60–100
- Watch: 40–70
- Neutral: 30–70
- LowPriority: 0–50
- Borderline margin: ±10 (none triggered in this corpus)

---

### 4.3 Signal / Reason Consistency

| Status | Count | % |
|--------|-------|---|
| CONSISTENT | 34 | 58.6% |
| GENERIC | **24** | 41.4% |
| CONFLICTING | 0 | 0% |
| UNKNOWN | 0 | 0% |

**Finding:** 41.4% of reason snapshots are classified GENERIC — single-token reasons with no slash-separated structure (e.g., `"動能"` alone rather than `"偏多/動能走強"`). This is the P1 repair target.

GENERIC does not mean incorrect; it means the reason carries insufficient detail for diagnostic tracing. No CONFLICTING cases were found (i.e., no case where a bullish signal is paired with a bearish reason).

---

### 4.4 Outcome Mismatch Patterns

Cases are classified by the relationship between score tier (high ≥65, low <40) and return class:

| Pattern | Description |
|---------|-------------|
| HIGH_SCORE_POSITIVE_RETURN | High score + positive return (expected alignment) |
| HIGH_SCORE_NEGATIVE_RETURN | High score + negative return (mismatch) |
| LOW_SCORE_POSITIVE_RETURN | Low score + positive return (mismatch) |
| LOW_SCORE_NEGATIVE_RETURN | Low score + negative return (expected alignment) |
| NEUTRAL_FLAT | Mid-range score or flat/missing return |
| OTHER | Score in 40–65 range with non-flat return |

> Mismatch patterns are observational only. They do not indicate model failure — backtested return outcomes were not used to set score thresholds. The purpose is diagnostic: identify cases worth deeper investigation in future phases.

---

### 4.5 Follow-up Category Distribution

| Category | Count | % |
|----------|-------|---|
| READY_FOR_NEXT_AUDIT | **29** | 50.0% |
| DATA_COVERAGE_REVIEW | 15 | 25.9% |
| SIGNAL_REASON_REVIEW | 9 | 15.5% |
| BUCKET_SCHEMA_REVIEW | 5 | 8.6% |

Half of all cases (29/58) are structurally ready to proceed to the next audit phase without repair. The remaining 29 cases are distributed across three repair categories.

---

## 5. Key Findings Summary

1. **Full explainability coverage** — 58/58 cases are structurally COMPLETE. No cases with missing bucket, missing score, or trivially short reasons.

2. **5 INCONSISTENT score–bucket cases (P0 priority)** — Score values fall outside the declared bucket's expected band. Root cause is unconfirmed: could be bucket assignment race condition, score normalization rounding, or schema version drift.

3. **24 GENERIC reason snapshots (41% rate, P1 priority)** — Single-token reason strings without structural breakdown. This limits traceability when reviewing why a case was assigned to a bucket. Root cause unknown: could be truncation in the reason builder, a snapshot timing issue, or a deliberate minimum-viable output path.

4. **15 DATA_COVERAGE_REVIEW cases** — These are Neutral-bucket cases with partial field coverage. No scoring changes are needed; the data capture path should be audited for completeness.

5. **0 forbidden claims detected** — No ROI, win-rate, alpha-edge, profit, outperform, guaranteed, buy-signal, or sell-signal language found in any generated artifact.

6. **0 CONFLICTING signal/reason cases** — No bullish–bearish mismatches were detected. Signal and reason are directionally coherent across all 58 cases.

---

## 6. Repair Backlog

**5 items total | Primary focus: BUCKET_SCHEMA_REVIEW**

| Priority | Category | Description |
|----------|----------|-------------|
| **P0** | BUCKET_SCHEMA_REVIEW | 5 cases with score outside declared bucket band. Investigate bucket assignment vs. score normalization alignment. |
| P1 | SIGNAL_REASON_REVIEW | 24 GENERIC reason snapshots. Audit reason builder for single-token output paths; improve structural output (`signal/detail` format). |
| P1 | DATA_COVERAGE_REVIEW | 15 PARTIAL/missing data cases (Neutral bucket). Audit data capture pipeline for field population gaps. |
| P2 | SCORE_DISTRIBUTION_REVIEW | Borderline cases (score near band boundary). Low urgency — monitor over larger corpus. |
| P2 | CORPUS_EXPANSION_REVIEW | Current corpus is 58 cases. Expand to cover more Watch-bucket cases (only 5 present). |

---

## 7. Why No Model Adjustments Were Made

P5 is an observability phase. Engineering diagnostic work only.

Specifically:
- Root causes for all 3 issues (INCONSISTENT, GENERIC, DATA_COVERAGE) are **unconfirmed**. Fixing models before understanding root cause risks masking symptoms.
- Score thresholds were not derived from backtested returns. Adjusting them based on outcome mismatch patterns would introduce look-ahead bias.
- The `alphaScore`, `recommendationBucket`, `ActiveScoringSnapshotBuilder`, `SignalFusion`, `RuleBased`, and `StrategyScreen` modules were not touched.
- No corpus files (P0/P1/P3/simulation) were modified.

The correct sequence is: **observe → diagnose → repair schema → revalidate** — not skip directly to model tuning.

---

## 8. Test Coverage

| Suite | Tests | Result |
|-------|-------|--------|
| `p5walkthrough_review_utils.test.ts` | **68 / 68** | PASS |

All exported functions in `P5WalkthroughReviewUtils.ts` are covered:
- `classifyCasePattern` — operator precedence fix applied
- `evaluateExplainability` — PARTIAL logic fix applied  
- `evaluateScoreBucketConsistency`
- `evaluateSignalReasonConsistency` — bullishKeywords regex fix applied (removed bare `動能`)
- `summarizeWalkthroughFindings`
- `scanForbiddenClaims`
- `reviewCase` + `determineFollowupCategory` + `buildLimitationNotes`

---

## 9. Forbidden Claims Scan

| Target | Result |
|--------|--------|
| `p5walkthrough_review.json` | **0 hits** |
| `p5walkthrough_repair_backlog.json` | **0 hits** |
| `p5walkthrough_preflight_audit.json` | **0 hits** |

Terms scanned: `roi`, `win-rate`, `outperform`, `guaranteed`, `profit`, `trading-edge`, `alpha-edge`, `beat-market`, `buy-signal`, `sell-signal`, `investment-recommendation`, `expected-return`, `predicted-return`.

Note: The field name `alphaScore` (camelCase, no hyphen) is allowed per system convention and is not flagged.

---

## 10. Frozen Corpus Validation

| File | Expected Lines | Status |
|------|---------------|--------|
| `simulation_snapshot_corpus.jsonl` | 60 | ✅ FROZEN |
| `p0hardreset_historical_replay_corpus.jsonl` | 4,500 | ✅ FROZEN |
| `p1baseline_historical_replay_corpus.jsonl` | 9,900 | ✅ FROZEN |
| `p3active_scoring_historical_replay_corpus.jsonl` | 4,500 | ✅ FROZEN |

No corpus mutations occurred during P5.

---

## 11. Files Committed in `78adf87`

| File | Type |
|------|------|
| `src/lib/onlineValidation/P5WalkthroughReviewUtils.ts` | Core util (7 exports + helpers) |
| `src/lib/onlineValidation/__tests__/p5walkthrough_review_utils.test.ts` | 68 tests |
| `scripts/p5walkthrough-preflight-audit.js` | PART A: Preflight (24/24 PASS) |
| `scripts/run-p5-walkthrough-review.js` | PART C: Walkthrough execution |
| `scripts/build-p5-walkthrough-repair-backlog.js` | PART D: Backlog builder |
| `scripts/validate-p5-artifacts.js` | PART G: Artifact validation |
| `outputs/online_validation/p5walkthrough_preflight_audit.json` | Artifact |
| `outputs/online_validation/p5walkthrough_preflight_audit.md` | Artifact |
| `outputs/online_validation/p5walkthrough_review.json` | Artifact |
| `outputs/online_validation/p5walkthrough_review.md` | Artifact |
| `outputs/online_validation/p5walkthrough_repair_backlog.json` | Artifact |
| `outputs/online_validation/p5walkthrough_repair_backlog.md` | Artifact |

---

## 12. Engineering Insights (Non-Investment)

These are observational findings about the scoring pipeline's internal consistency. They are not predictions, recommendations, or performance claims.

**A. Generic reason rate is high (41%)**  
Single-token reason snapshots make it impossible to trace which sub-signals contributed to a bucket assignment. The reason builder likely has a minimum-viable fallback path that outputs a bare category token without structural detail. This should be audited in the P6 repair phase.

**B. BUCKET_SCHEMA_REVIEW is the highest-priority structural gap**  
5 cases where the score value is outside the declared bucket's expected band suggest a schema alignment issue — not a model quality issue. The bucket bands (Strong=60–100, Watch=40–70, Neutral=30–70, LowPriority=0–50) overlap intentionally, but cases falling fully outside the declared bucket's range indicate a discrete logic error.

---

## 13. Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Generic reasons may be permanent (not a bug) | Medium | If the reason builder intentionally outputs minimal tokens for some paths, "fixing" it may change production behavior unexpectedly |
| INCONSISTENT cases may be from schema version drift | Medium | Old cases captured under a different bucket schema may look inconsistent against current rules |
| Corpus size (58 cases) limits statistical confidence | Low | Watch bucket has only 5 cases; findings may not generalize |
| No outcome data for DATA_COVERAGE_REVIEW cases | Low | 15 Neutral cases lack full field population — may simply reflect lower-quality data at capture time |

---

## 14. Next Phase Recommendation

**P6-HARDRESET: Bucket Schema Repair**

Focus on the P0 backlog item: diagnose and repair the 5 INCONSISTENT score–bucket cases. Approach:

1. Inspect the 5 specific case `stableHashKey` values from `p5walkthrough_repair_backlog.json`
2. Re-run those cases through `ActiveScoringSnapshotBuilder` with debug logging
3. Identify whether the mismatch is in `recommendationBucket` assignment or `alphaScore` normalization
4. Propose a schema-level fix (not a model-level fix)
5. Re-validate: all 58 cases should pass CONSISTENT after repair

SIGNAL_REASON_REVIEW (P1) should run in parallel if bandwidth allows.

---

## 15. Phase Classification

```
P5_WALKTHROUGH_REVIEW_COMPLETE
P5_REQUIRES_BUCKET_SCHEMA_REPAIR  ← active P0 backlog item
```

P5-HARDRESET is **complete**. All 9 parts (A–I) delivered and committed.

---

*This report contains no investment recommendations, return predictions, buy/sell signals, or performance claims. All findings are engineering observability outputs only.*
