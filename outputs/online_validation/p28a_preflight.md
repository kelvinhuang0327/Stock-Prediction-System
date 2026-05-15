# P28A Pre-flight Gate Report

**Date:** 2026-05-15  
**Status:** ✅ **PASS**

## Overview

P28A-HARDRESET Pre-flight Gate validates that all necessary artifacts are present and all baselines remain frozen ahead of the 9-case read-only audit.

---

## 1. Required Artifacts Status

| Artifact | Location | Status |
|----------|----------|--------|
| P26A Scoring Underoutput 9-Case Audit | `p26a_scoring_underoutput_9case_audit.json` | ✅ Found |
| P26A Feature Snapshot Report | `p26a_feature_snapshot_v1_final_report.md` | ✅ Found |
| P26A Reason Quality Walkthrough | `p26a_walkthrough_reason_quality_compare.json` | ✅ Found |
| P27 Overnight Invariance Recheck | `p27_overnight_invariance_recheck.json` | ✅ Found (PASS) |
| P27 Overnight Deep Audit Summary | `p27_overnight_governance_deep_audit_summary.json` | ✅ Found (0 blockers) |
| Artifact Index V2 | `ARTIFACT_INDEX_V2.json` | ✅ Found |

---

## 2. Baseline Checksum Verification

### DB (prisma/dev.db)
- **Baseline (P27):** `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8`
- **Current:** `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8`
- **Match:** ✅ **PASS** (unchanged)

### Corpus Files

| Corpus | Lines | Baseline SHA256 | Current SHA256 | Match |
|--------|-------|-----------------|-----------------|-------|
| simulation_snapshot_corpus.jsonl | 60 | `6a668ba2196f...` | `6a668ba2196f...` | ✅ |
| p0hardreset_historical_replay_corpus.jsonl | 4,500 | `f231e3b768ce...` | `f231e3b768ce...` | ✅ |
| p1baseline_historical_replay_corpus.jsonl | 9,900 | `66f62cb2a2b8...` | `66f62cb2a2b8...` | ✅ |
| p3active_scoring_historical_replay_corpus.jsonl | 4,500 | `e8b4e1a9f255...` | `e8b4e1a9f255...` | ✅ |
| p19active_scoring_pit_replay_corpus.jsonl | 4,499 | `da92963f0d0f...` | `da92963f0d0f...` | ✅ |

**Result:** ✅ **ALL FROZEN**

### Scoring Files

| File | Baseline SHA256 | Current SHA256 | Match |
|------|-----------------|-----------------|-------|
| RuleBasedStockAnalyzer.ts | `bc3716cc8e74...` | `bc3716cc8e74...` | ✅ |
| SignalFusionEngine.ts | `b8ce3fa3ae63...` | `b8ce3fa3ae63...` | ✅ |
| ActiveScoringSnapshotBuilder.ts | `063a3bd524d2...` | `063a3bd524d2...` | ✅ |

**Result:** ✅ **ALL UNCHANGED**

---

## 3. P27 Overnight Audit Conclusion Validation

From `p27_overnight_governance_deep_audit_summary.json`:

| Metric | Value | Status |
|--------|-------|--------|
| Total Files Scanned | 1,124 | ✅ |
| Blocker Count | 0 | ✅ **PASS** |
| Test Matrix (Jest) | 2885/2885 PASS | ✅ **PASS** |
| Invariance Status | PASS | ✅ |
| Forbidden Claims | CLEAN | ✅ |
| DB Changed | false | ✅ |
| Corpus Changed | false | ✅ |
| Scoring Changed | false | ✅ |

**Conclusion:** ✅ **P27 overnight deep audit conclusions remain valid**

---

## 4. P26A 9-Case Underoutput Summary

From `p26a_scoring_underoutput_9case_audit.json`:

- **Total Cases:** 9
- **Unique Symbols:** 3 (1710, 00738U, 00891)
- **All Classified As:** NO_TRIGGERED_FACTOR
- **All Blocked By:** MonthlyRevenue source gap
- **All Are:** Renderer underoutput (reason not serialized from factor snapshot)
- **All Fixable:** Without scoring change (renderer fix only for 9 cases; source import for completeness)

**Case IDs:**
- P5-CASE-010, P5-CASE-011, P5-CASE-013
- P5-CASE-023, P5-CASE-026, P5-CASE-037
- P5-CASE-053, P5-CASE-054, P5-CASE-055

---

## 5. Readiness Gates

| Gate | Result |
|------|--------|
| All required artifacts exist | ✅ PASS |
| DB baseline frozen | ✅ PASS |
| All corpus files frozen | ✅ PASS |
| All scoring files unchanged | ✅ PASS |
| P27 overnight audit PASS | ✅ PASS |
| P27 invariance recheck PASS | ✅ PASS |
| P27 blocker count = 0 | ✅ PASS |
| 9 cases extractable | ✅ PASS |

---

## Final Classification

**P28A_PREFLIGHT_GATE_PASS**

All pre-flight gates cleared. Proceed to **PART B: Extract 9 SCORING_UNDEROUTPUT Cases**.

---

## Disclaimer

Observability only. No investment recommendations.
