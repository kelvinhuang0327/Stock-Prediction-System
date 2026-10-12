# P5-HARDRESET PART D — Prioritized Repair Backlog

**Date:** 2026-05-11
**Primary Focus:** `BUCKET_SCHEMA_REVIEW`
**Total Items:** 5

> **Disclaimer:** Engineering review directions only. Not investment advice. No model changes made.

## Priority Summary

| Priority | Count |
|----------|-------|
| P0 | 1 |
| P1 | 2 |
| P2 | 2 |

## 1. [P0] BUCKET_SCHEMA_REVIEW

**Priority:** P0
**Evidence Count:** 5
**Example Cases:** P5-CASE-004, P5-CASE-006, P5-CASE-012, P5-CASE-040, P5-CASE-041

**Symptom:**
5 cases have INCONSISTENT score/bucket alignment. 0 are high-score in low bucket, 5 are low-score in high bucket. This may indicate stale bucket assignments or score recalculation not propagating to bucket labels.

**Recommended Next Phase:**
P6 Bucket Schema Calibration Repair — audit bucket assignment logic, verify score-to-bucket mapping table, check if bucket is assigned at scoring time vs. at a different pipeline stage.

**Constraints:**
- Do NOT modify alphaScore or recommendationBucket calculation logic
- Do NOT reclassify cases based on realized returns
- Investigate data pipeline ordering only

**Why Not Fix Now:**
Root cause is unknown — inconsistency may be from data pipeline timing or band definition. P6 must identify root cause before any fix.

---

## 2. [P1] SIGNAL_REASON_REVIEW

**Priority:** P1
**Evidence Count:** 24
**Example Cases:** P5-CASE-003, P5-CASE-005, P5-CASE-008, P5-CASE-019, P5-CASE-022

**Symptom:**
24 cases have GENERIC reason snapshots, 0 have CONFLICTING signal/reason patterns, 0 have WEAK explainability. Generic reasons (e.g. single-token "技術偏空") do not provide enough context to verify signal consistency.

**Recommended Next Phase:**
P6 Signal / Reason Snapshot Quality Repair — review reasonSnapshot construction in ActiveScoringSnapshotBuilder, add multi-token reason format validation, audit cases where single-token reasons appear.

**Constraints:**
- Do NOT modify scoring logic or formula weights
- Do NOT modify ActiveScoringSnapshotBuilder scoring behavior
- Only audit reasonSnapshot construction and format, not score calculation

**Why Not Fix Now:**
P5 cannot determine if single-token reasons are correct summaries or truncated output. P6 must trace reasonSnapshot generation path.

---

## 3. [P1] DATA_COVERAGE_REVIEW

**Priority:** P1
**Evidence Count:** 15
**Example Cases:** P5-CASE-010, P5-CASE-011, P5-CASE-013, P5-CASE-023, P5-CASE-024

**Symptom:**
15 walkthrough cases are PARTIAL completeness (31.1% of P3 corpus = PARTIAL, all are Neutral bucket). 0 cases have missing realized return. This reflects fundamental data availability constraints for the Neutral bucket tier.

**Recommended Next Phase:**
P6 Feature Coverage Backfill — investigate why all Neutral bucket rows are PARTIAL, trace which data sources are unavailable, determine if additional data ingestion can improve completeness.

**Constraints:**
- Do NOT modify P3 corpus
- Do NOT modify scoringCompletenessStatus calculation
- Data backfill must go through normal data pipeline — no PIT violations

**Why Not Fix Now:**
Data coverage gaps require upstream data availability work. Cannot be fixed within the validation layer alone.

---

## 4. [P2] CORPUS_EXPANSION_REVIEW

**Priority:** P2
**Evidence Count:** 0
**Example Cases:** 

**Symptom:**
Current P3 corpus covers 25 symbols × 3 horizons = 4500 rows. 60-day horizon has 0/13 walkthrough cases with missing returns. InsufficientData bucket is absent (all 25 symbols had data). A larger corpus would expose more edge cases and exercise the InsufficientData bucket.

**Recommended Next Phase:**
P6 or future round — expand symbol universe to ≥50 symbols, include symbols with known data gaps to exercise InsufficientData path, run on 3 non-overlapping historical windows.

**Constraints:**
- Do NOT modify frozen P0/P1/P3 corpora
- New corpus must pass same PIT and completeness invariants
- Expansion is a separate corpus generation run

**Why Not Fix Now:**
Corpus expansion requires a separate data collection run. Not a P5 deliverable.

---

## 5. [P2] NO_IMMEDIATE_REPAIR

**Priority:** P2
**Evidence Count:** 29
**Example Cases:** P5-CASE-001, P5-CASE-002, P5-CASE-007, P5-CASE-009, P5-CASE-014

**Symptom:**
29 cases passed all review dimensions (COMPLETE explainability, CONSISTENT score/bucket, CONSISTENT signal/reason). These cases are representative of expected scoring behavior.

**Recommended Next Phase:**
Continue to next scheduled audit round. No immediate action required for these cases.

**Why Not Fix Now:**
No issues detected. These cases are the calibration baseline.

---
