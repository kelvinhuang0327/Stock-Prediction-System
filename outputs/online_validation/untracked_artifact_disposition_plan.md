# P3 — Untracked Artifact Disposition Plan v1

**Phase:** P3 — Untracked Artifact Disposition  
**Date:** 2026-05-23  
**Classification:** `P2_P3_GOVERNANCE_READY` (pending user decision on root scripts)  
**Total untracked entries:** 77  
**Prior art:** P35-REALIGN disposition plan (2026-05-21, 42 entries, never executed)

> **GOVERNANCE NOTE:** Documentation plan only. No git operations executed. `entersAlphaScore=false`.  
> Not investment advice. No buy/sell/hold. No scoring change. No DB apply.

---

## Summary

| Disposition | Count | Action |
|---|---|---|
| COMMIT_WITH_RETENTION | 65 | Commit in phase group per sequence below |
| KEEP_IN_PLACE_SRC | 4 | Already in canonical src/ — commit with phase |
| KEEP_IN_PLACE_DATA | 2 | Never move; commit when authorization lifted |
| KEEP_IN_PLACE_STOCKPLAN | 2 | Active plan dirs; commit when complete |
| KEEP_IN_PLACE_GOVERNANCE | 2 | Governance docs; commit end-of-session |
| NEEDS_USER_DECISION | 3 | Root scripts — user must confirm relocation or deletion |

---

## Changes vs P35-REALIGN Plan

P35 covered 42 entries (G1–G6, verify_p34.py). P3 extends:
- **New groups added:** G7 (P27 orphan JSON), G8 (P49-LEDGER), G9 (P1 Axis A output), G10 (P1 src), G11 (p29d pre-existing failure), G13 (StockPlan dirs), G14 (CEO-Decision/active_task), G15 (root scripts)
- **Carried forward:** G1–G6 dispositions unchanged from P35; G16 (verify_p34.py) — relocation still pending
- **P35 note:** No commit sequence from P35 was ever executed; all P35 artifacts remain untracked

---

## Group Dispositions

### G1: P32PREP Artifacts (11 files) → COMMIT_WITH_RETENTION
**Commit:** `P32PREP: Add dry-run spec scaffolding and artifact inventory`

Canonical P32PREP artifact inventory and spec schemas (v0 dry-run sample, PIT audit, source gate). Referenced by P32/P33/P34 conformance checks. Required for future fixture materialization.

### G2: P32 Artifacts (8 files) → COMMIT_WITH_RETENTION
**Commit:** `P32: Add MonthlyRevenue source-present dry-run artifacts`

Core MonthlyRevenue dry-run gate evidence. FULL_CONFORMANCE result. Required for PROMOTE decision audit trail.

### G3: P33 Artifacts (10 files) → COMMIT_WITH_RETENTION
**Commit:** `P33: Add FinancialReport+NewsEvent source-present gate artifacts`

FinancialReport BLOCK evidence + NewsEvent ELIGIBLE evidence. Required for migration authorization workflow.

### G4: P34 Artifacts (10 files) → COMMIT_WITH_RETENTION
**Commit:** `P34: Add NewsEvent source-present dry-run sample artifacts`

NewsEvent 1018/1018 READY. Strongest PIT result in system. Required for NewsEvent consumer design authorization.

### G5: P35-REALIGN Artifacts (5 files) → COMMIT_WITH_RETENTION
**Commit:** `P35-REALIGN: Add realign decision matrix and disposition plan`

P35 governance audit and prior disposition plan. P3 extends it — prior plan preserved for audit trail.

### G6: P29G Preflight Artifacts (11 files) → COMMIT_WITH_RETENTION
**Commit:** `P29G: Add preflight governance artifacts`

P29G forbidden claims, git ancestry, invariance baseline, test baseline. Governance CLEAN record.

### G7: P27 Orphaned JSON (1 file) → COMMIT_WITH_RETENTION
**Commit:** `P27: Add overnight deep audit preflight JSON (missing companion)`

`p27_overnight_deep_audit_preflight.json` — all other P27 artifacts are committed; this is the missing JSON companion to the committed `.md`.

### G8: P49-LEDGER Artifacts (7 files) → COMMIT_WITH_RETENTION
**Commit:** `P49-LEDGER: Add post-P48 full-suite baseline and known failure ledger`

Canonical P49-LEDGER baseline (4842/4846 PASS, 4 pre-existing failures pinned). Source of truth for all future implementation rounds.

### G9: P1 Axis A Output Artifact (1 file) → COMMIT_WITH_RETENTION
**Commit:** `P1-AXIS-A: Add controlled research snapshot v0 report`

Phase gate report for P1_AXIS_A_RESEARCH_SNAPSHOT_READY. 46/46 tests PASS.

### G10: P1 Axis A src/ Files (3 files) → KEEP_IN_PLACE_SRC
**Commit:** `P1-AXIS-A: Add ControlledResearchSnapshot types, builder, and tests`

Already in canonical `src/lib/research/`. Commit with G9 as combined P1-AXIS-A commit.

### G11: p29d Pre-existing Failing Test → KEEP_IN_PLACE_SRC
`src/lib/onlineValidation/__tests__/p29d_dropzone_scaffold.test.ts`  
⚠️ **DO NOT DELETE.** This is one of the 4 pinned pre-existing failures in P49 ledger. Commit when fixed.

### G12: data/manual Dropzone Templates (2 dirs) → KEEP_IN_PLACE_DATA
`data/manual/financial-report/` and `data/manual/news-event/`  
⚠️ **NEVER MOVE.** Governed by data/ access rules. Commit when FinancialReport/NewsEvent block is lifted.

### G13: 00-StockPlan/ Directories (2 dirs) → KEEP_IN_PLACE_STOCKPLAN
`00-StockPlan/20260514/` and `00-StockPlan/20260515/`  
Active Taiwan stock plan directories. Commit when plan complete.

### G14: Governance Planning Docs (2 files) → KEEP_IN_PLACE_GOVERNANCE
`00-Plan/roadmap/CEO-Decision.md` and `00-Plan/roadmap/active_task.md`  
CEO Decision 2026-05-23 (post-P48) and active task spec. Commit end-of-session.

### G15: Root Scripts — NEEDS USER DECISION (2 files)
- `generate_artifacts.py`
- `p28c_9case_validation.js`

**Options per file:**
- RELOCATE to `scripts/` (if still useful)
- DELETE (if obsolete — requires user authorization)

### G16: verify_p34.py — NEEDS USER DECISION (carry-over from P35)
P35 plan said: RELOCATE to `scripts/verify_p34.py`. Move not yet executed.  
Options: execute P35 plan (`mv verify_p34.py scripts/`) or delete.

---

## Proposed Commit Sequence

```
1. P27: Add overnight deep audit preflight JSON (missing companion)
2. P29G: Add preflight governance artifacts  
3. P32PREP: Add dry-run spec scaffolding and artifact inventory
4. P32: Add MonthlyRevenue source-present dry-run artifacts
5. P33: Add FinancialReport+NewsEvent source-present gate artifacts
6. P34: Add NewsEvent source-present dry-run sample artifacts
7. P35-REALIGN: Add realign decision matrix and disposition plan
8. P49-LEDGER: Add post-P48 full-suite baseline and known failure ledger
9. P1-AXIS-A: Add ControlledResearchSnapshot types, builder, tests, and report
10. governance: Add CEO-Decision and active_task post-P48
── DEFER ──
data/, src/p29d, 00-StockPlan/, root scripts → user decision required
```

---

## Pending User Decisions

| File | Question |
|---|---|
| `generate_artifacts.py` | Relocate to `scripts/generate_artifacts.py` or delete? |
| `p28c_9case_validation.js` | Relocate to `scripts/p28c_9case_validation.js` or delete? |
| `verify_p34.py` | Execute P35 plan: `mv verify_p34.py scripts/` — confirm? |

---

*DISCLAIMER: Documentation plan only. No git operations executed. `entersAlphaScore=false`. Not investment advice. P3 — 2026-05-23.*
