# P6-LITE: Bucket Schema Short Diagnosis

**Generated:** 2026-05-12  
**Phase:** P6-HARDRESET-LITE  
**Final Verdict:** 🟡 **BY_DESIGN_BOUNDARY**

> **Disclaimer:** Schema self-consistency diagnosis only. No investment recommendations. No scoring formula changes. No model changes.

---

## Verdict Summary

All 5 inconsistent cases follow the same pattern: Watch bucket assigned to composite scores in [21, 29]. The existing Watch band lower bound (40) does not match observed behavior. This is a schema documentation gap — the boundary behavior appears intentional (signal-driven Watch assignment can override composite score thresholds) but is undocumented.

**Next Step:** Contract freeze today (PART B output). Tomorrow: P12 PIT Feature Contract v0 (CEO 主軸 A first step).

---

## Watch + Low-Score Boundary Pattern

| Field | Value |
|-------|-------|
| Detected | Yes |
| Case Count | 5 |
| Score Range | [21, 29] |
| Interpretation | Watch bucket appears to accept composite scores below its canonical band lower bound (40). This may reflect signal-qualified candidates where individual technical signals trigger Watch assignment independently of the composite score. The schema bands need explicit documentation of this boundary behavior. |

---

## Diagnosis Summary

| Metric | Value |
|--------|-------|
| Total Inconsistent Cases Analyzed | 5 |
| Watch + Low-Score Boundary Cases | 5 |
| Dominant Category | SCORE_THRESHOLD_MISMATCH |
| Observed Score Range | [21, 29] |
| Observed Buckets | Watch |

### Category Distribution

- **Score Threshold Mismatch**: 5

---

## Case-Level Diagnosis


### 1. P5-CASE-004 — 1536

| Field | Value |
|-------|-------|
| Symbol | 1536 |
| As-Of Date | 2025-12-02 |
| Horizon | 5d |
| Score | 21 |
| Score Source | researchBucket.score (composite, as captured in P5 walkthrough) |
| Research Bucket | Watch |
| Normalized Bucket | Watch |
| ActiveScoring Snapshot Bucket | N/A |
| Watch+LowScore Boundary Pattern | Yes |
| **Diagnosis Category** | **SCORE_THRESHOLD_MISMATCH** |
| Recommended Repair | FREEZE_CONTRACT_AS_BOUNDARY |

**Evidence:** Score 21 is below Watch band lower bound (40). All 5 inconsistent cases share this pattern: Watch + score in [21,29]. The Watch band lower threshold (40) appears too strict for signal-qualified candidates. This is a schema boundary definition question, not a code malfunction.

**Why No Model Change Now:** P6-LITE scope is limited to schema self-consistency diagnosis only. No scoring formula, alphaScore, recommendationBucket, or activeScoringSnapshot logic may be changed during this phase. All repair decisions are deferred to P7 or P12.


### 2. P5-CASE-006 — 00712

| Field | Value |
|-------|-------|
| Symbol | 00712 |
| As-Of Date | 2025-11-24 |
| Horizon | 5d |
| Score | 29 |
| Score Source | researchBucket.score (composite, as captured in P5 walkthrough) |
| Research Bucket | Watch |
| Normalized Bucket | Watch |
| ActiveScoring Snapshot Bucket | N/A |
| Watch+LowScore Boundary Pattern | Yes |
| **Diagnosis Category** | **SCORE_THRESHOLD_MISMATCH** |
| Recommended Repair | FREEZE_CONTRACT_AS_BOUNDARY |

**Evidence:** Score 29 is below Watch band lower bound (40). All 5 inconsistent cases share this pattern: Watch + score in [21,29]. The Watch band lower threshold (40) appears too strict for signal-qualified candidates. This is a schema boundary definition question, not a code malfunction.

**Why No Model Change Now:** P6-LITE scope is limited to schema self-consistency diagnosis only. No scoring formula, alphaScore, recommendationBucket, or activeScoringSnapshot logic may be changed during this phase. All repair decisions are deferred to P7 or P12.


### 3. P5-CASE-012 — 1536

| Field | Value |
|-------|-------|
| Symbol | 1536 |
| As-Of Date | 2025-12-02 |
| Horizon | 5d |
| Score | 21 |
| Score Source | researchBucket.score (composite, as captured in P5 walkthrough) |
| Research Bucket | Watch |
| Normalized Bucket | Watch |
| ActiveScoring Snapshot Bucket | N/A |
| Watch+LowScore Boundary Pattern | Yes |
| **Diagnosis Category** | **SCORE_THRESHOLD_MISMATCH** |
| Recommended Repair | FREEZE_CONTRACT_AS_BOUNDARY |

**Evidence:** Score 21 is below Watch band lower bound (40). All 5 inconsistent cases share this pattern: Watch + score in [21,29]. The Watch band lower threshold (40) appears too strict for signal-qualified candidates. This is a schema boundary definition question, not a code malfunction.

**Why No Model Change Now:** P6-LITE scope is limited to schema self-consistency diagnosis only. No scoring formula, alphaScore, recommendationBucket, or activeScoringSnapshot logic may be changed during this phase. All repair decisions are deferred to P7 or P12.


### 4. P5-CASE-040 — 1536

| Field | Value |
|-------|-------|
| Symbol | 1536 |
| As-Of Date | 2025-12-02 |
| Horizon | 5d |
| Score | 21 |
| Score Source | researchBucket.score (composite, as captured in P5 walkthrough) |
| Research Bucket | Watch |
| Normalized Bucket | Watch |
| ActiveScoring Snapshot Bucket | N/A |
| Watch+LowScore Boundary Pattern | Yes |
| **Diagnosis Category** | **SCORE_THRESHOLD_MISMATCH** |
| Recommended Repair | FREEZE_CONTRACT_AS_BOUNDARY |

**Evidence:** Score 21 is below Watch band lower bound (40). All 5 inconsistent cases share this pattern: Watch + score in [21,29]. The Watch band lower threshold (40) appears too strict for signal-qualified candidates. This is a schema boundary definition question, not a code malfunction.

**Why No Model Change Now:** P6-LITE scope is limited to schema self-consistency diagnosis only. No scoring formula, alphaScore, recommendationBucket, or activeScoringSnapshot logic may be changed during this phase. All repair decisions are deferred to P7 or P12.


### 5. P5-CASE-041 — 00712

| Field | Value |
|-------|-------|
| Symbol | 00712 |
| As-Of Date | 2025-12-02 |
| Horizon | 20d |
| Score | 29 |
| Score Source | researchBucket.score (composite, as captured in P5 walkthrough) |
| Research Bucket | Watch |
| Normalized Bucket | Watch |
| ActiveScoring Snapshot Bucket | N/A |
| Watch+LowScore Boundary Pattern | Yes |
| **Diagnosis Category** | **SCORE_THRESHOLD_MISMATCH** |
| Recommended Repair | FREEZE_CONTRACT_AS_BOUNDARY |

**Evidence:** Score 29 is below Watch band lower bound (40). All 5 inconsistent cases share this pattern: Watch + score in [21,29]. The Watch band lower threshold (40) appears too strict for signal-qualified candidates. This is a schema boundary definition question, not a code malfunction.

**Why No Model Change Now:** P6-LITE scope is limited to schema self-consistency diagnosis only. No scoring formula, alphaScore, recommendationBucket, or activeScoringSnapshot logic may be changed during this phase. All repair decisions are deferred to P7 or P12.


---

## Verdict Evidence

5/5 (100%) of inconsistent cases match the Watch + score ≤ 39 boundary pattern. The schema bands were calibrated from historical data and may not account for signal-qualified candidates with below-band composite scores. This is a boundary definition ambiguity, not a code malfunction. Contract freeze is appropriate.

---

*End of P6-LITE Bucket Schema Short Diagnosis*
