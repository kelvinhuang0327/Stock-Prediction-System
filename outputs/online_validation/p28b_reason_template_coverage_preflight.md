# P28B Pre-flight Gate

**Date:** 2026-05-19  
**Phase:** P28B-REASON-TEMPLATE-COVERAGE-HARDRESET  
**Status:** ✅ PREFLIGHT_GATE_PASS

---

## Git Status

| Field | Value |
|-------|-------|
| HEAD commit | `1cf0252` |
| Message | P28A-HARDRESET: Scoring Underoutput 9-Case Read-Only Audit + Template Branch Coverage Map |
| Uncommitted changes | logs/, runtime/, dev.db-shm/wal only (no source changes) |

---

## P28A Artifact Gate

| Artifact | Status |
|----------|--------|
| p28a_underoutput_case_list.json | ✅ PRESENT |
| p28a_per_case_audit_snapshots.json | ✅ PRESENT |
| p28a_underoutput_classification.json | ✅ PRESENT |
| p28a_reason_template_branch_coverage.json | ✅ PRESENT |
| p28a_scoring_invariance_recheck.json | ✅ PRESENT |
| p28a_active_scoring_smoke.json | ✅ PRESENT |
| p28a_scoring_underoutput_audit_final_report.md | ✅ PRESENT |

→ All P28A artifacts confirmed present. **GATE PASS**

---

## No-Write Baseline (PART A)

### DB Baseline
| File | SHA256 |
|------|--------|
| prisma/dev.db | `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8` |

### Corpus Baseline

| File | Lines | SHA256 |
|------|-------|--------|
| simulation_snapshot_corpus.jsonl | 60 | `6a668ba2196f...` |
| p0hardreset_historical_replay_corpus.jsonl | 4,500 | `f231e3b768ce...` |
| p1baseline_historical_replay_corpus.jsonl | 9,900 | `66f62cb2a2b8...` |
| p3active_scoring_historical_replay_corpus.jsonl | 4,500 | `e8b4e1a9f255...` |
| p19active_scoring_pit_replay_corpus.jsonl | 4,499 | `da92963f0d0f...` |

### Scoring Files Baseline

| File | SHA256 |
|------|--------|
| RuleBasedStockAnalyzer.ts | `bc3716cc8e74...` |
| SignalFusionEngine.ts | `b8ce3fa3ae63...` |
| ActiveScoringSnapshotBuilder.ts | `063a3bd524d2...` |

---

## Gate Summary

| Gate | Result |
|------|--------|
| P28A artifacts present | ✅ PASS |
| DB frozen | ✅ PASS |
| All 5 corpus frozen | ✅ PASS |
| All 3 scoring files frozen | ✅ PASS |
| P28A classification valid (9/9 NO_TRIGGERED_FACTOR) | ✅ PASS |

→ **PREFLIGHT_GATE_PASS — Cleared to execute P28B**

---

*Observability only. No investment recommendations.*
