# Active Task — 2026-05-26 (Post-P53 / Axis B Round 1 of 2 Complete)

## P53 COMPLETION STATUS

| Item | Result |
|------|--------|
| Commit | `89f0ae7 feat: add Axis B simulation input eligibility diff` |
| Classification | `P53_AXIS_B_SIMULATION_INPUT_ELIGIBILITY_DIFF_V0_COMMITTED` |
| Tests | 87/87 PASS |
| Governance | All invariants verified |
| Axis B progress | Round 1 of 2 complete → P54 MUST also be Axis B |

---

## PROJECT_CONTEXT_LOCK (MANDATORY)

```text
Project = Stock-Prediction-System
Canonical Repo = /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System
Canonical Branch = main

If any task, file, commit, or roadmap reference belongs to another project
(Betting-pool, MLB, bare TSL, CLV, P26J, P26K, COMPLETE_PAIR, odds daemon,
Novel project, character memory ledger, relationship ledger,
dsxcai/stock_trading trading semantics, Electron GUI, IPC Python execution):
  STOP immediately.
  Do not summarize it as current project work.
  Do not create artifacts for it.
  Do not import code or trading semantics from external repos.
```

## Governance Header (MANDATORY)

### Canonical Repo
`/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System`

### Canonical Branch
`main`

### Canonical HEAD (expected)
`0cf1542 docs: finalize P51 report with CI run results` or a clean fast-forward successor.

### Rules
- Do NOT create new branch, worktree, clone, or repo.
- Do NOT checkout another branch or use detached HEAD.
- Do NOT modify `prisma/**`, `data/**`, `tests/**`, `scripts/**`, `package.json`, `package-lock.json`, corpus jsonl, scoring files, or branch-policy files.
- Do NOT modify `alphaScore` / `bucket` / scoring formula semantics.
- Do NOT produce investment advice or performance claims (no ROI / PnL / win-rate / buy / sell / hold / action / target price / benchmark).
- Do NOT execute simulation, optimizer, real backtest, GUI, or migration apply.
- Do NOT use `--no-verify`, `--no-gpg-sign`, `--amend` (post-commit), `git push --force`, or `git push --force-with-lease`.
- Do NOT import code, semantics, or executable logic from external repos (including `dsxcai/stock_trading`). Architectural concepts (mode separation, report schema, golden fixture pattern, assumption documentation) may be **referenced** but **not copied**.
- Any DB / migration apply requires the user's explicit authorization sentence and is NOT part of this task.

### Required Pre-flight
```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git log --oneline -8
git status --short
git diff --name-only
git diff --cached --name-only

# PROJECT_CONTEXT_LOCK contamination scan
grep -RniE "P26J|P26K|Betting-pool|CLV|COMPLETE_PAIR|closing window|character memory|relationship ledger" 00-Plan outputs src 2>/dev/null | head -20 || echo "PROJECT_CONTEXT_LOCK_PARTIAL_CLEAN"
grep -RniE "\\bTSL\\b" 00-Plan outputs src 2>/dev/null | grep -v "TSLA" | head -10 || echo "bare_TSL_CLEAN"
```

Expected:
- repo = canonical
- branch = `main`
- HEAD = `0cf1542` (or a fast-forward successor)
- staged files = none
- dirty files = known runtime + known USER_DECISION + known P28 drift only
- contamination scan = clean (excluding TSLA / HTMLButtonElement false positives)

STOP if any condition violated.

---

## Task Name

**P52 — Axis A Snapshot v0 Export Diff (FINAL Axis A v0 scaffold round)**

## Source

CEO Decision 2026-05-25 — P0. CTO P0 adopted with explicit closure caveat:
- This is the **FINAL Axis A v0 scaffold round**.
- From P53 onward, **no Axis A v0-chain stage may be added** until Axis B has delivered at least 2 rounds (CEO P1 + P2).

## Background

- HEAD = `0cf1542 docs: finalize P51 report with CI run results` (committed).
- P51 main commit: `bdb1db7 feat: add Axis A research snapshot v0 export serializer`.
- P51 docs finalization commit: `0cf1542`.
- P51 classification: `P51_AXIS_A_SNAPSHOT_EXPORT_SERIALIZER_V0_DEFINED`.
- P51 targeted tests: 36/36 PASS. Baseline: 5636/5636 PASS / 144 suites.
- P51 main Test Gate: `26394804827` success. Docs finalization Test Gate: `26394907867` success.
- Axis A v0 chain: read → format → emit → log → collect → batch → export → filter → serialize (9 stages).
- P52 closes the chain at stage 10 (diff).
- Handoff from P51 noted "Made changes" — Phase 0 must classify dirty state before any work.
- Axis A : Axis B implementation ratio = 11 : 4 (overinvested in A). P52 is the cap; P1 (next round) will be Axis B mandatory.

This round is **pure / in-memory / deterministic / no DB / no FS / no network / no scoring / no advice**. It closes the Axis A v0 chain.

## Goal

Add Axis A Snapshot v0 Export Diff (`SnapshotExportDiff`) that:

1. Compares two `SnapshotLogExport` objects (`before`, `after`).
2. Returns added / removed / unchanged records, by identity key `symbol + loggedAt`.
3. Preserves order: `added` follows `after.records`; `removed` follows `before.records`; `unchanged` follows `after.records`.
4. Returns correct counts (`addedCount`, `removedCount`, `unchangedCount`).
5. Uses `fixedDiffedAt` when provided (deterministic); otherwise current ISO timestamp.
6. Does not mutate either input.
7. Preserves blocked-source states.
8. Returns JSON-safe plain object.
9. Has 0 DB / filesystem / network dependencies.
10. Contains 0 recommendation / scoring / alphaScore / PnL / ROI / win-rate / target-price / benchmark fields.

## Allowed Modifications

Allowed to CREATE / MODIFY:
- `src/lib/research/snapshot/v0/SnapshotExportDiff.ts` (new)
- `src/lib/research/snapshot/v0/index.ts` (update — re-export `SnapshotExportDiff` API)
- `src/lib/research/__tests__/p52_axis_a_snapshot_export_diff.test.ts` (new)
- `outputs/online_validation/p52_axis_a_snapshot_export_diff_report.md` (new)

Allowed (post-CI) to UPDATE for finalization, as a SEPARATE docs commit:
- `outputs/online_validation/p52_axis_a_snapshot_export_diff_report.md` (CI result append only)

## Forbidden Modifications / Staging

Strictly forbidden to stage or modify:
- Any file under `prisma/**` (schema, migrations, `dev.db`, `dev.db-shm`, `dev.db-wal`)
- Any file under `data/**`
- Any file under `tests/**`
- Any file under `scripts/**`
- Any file under `logs/**`
- Any file under `runtime/**` (including `runtime/agent_orchestrator/llm_usage.jsonl`, `runtime/training_reports/tw_weekly_deep_research.json`)
- Any file under `00-StockPlan/**` (including `00-StockPlan/20260514/`, `00-StockPlan/20260515/`)
- `package.json` / `package-lock.json`
- Any `.jsonl` file
- `outputs/online_validation/p28c_renderer_only_repair_9case_before_after.json`
- `outputs/online_validation/p28d_9case_integrated_review_validation.json`
- `outputs/online_validation/p28d_p3_p19_renderer_regression_sweep.json`
- `src/lib/services/syncService.ts`
- `src/lib/analysis/RuleBasedStockAnalyzer.ts`
- `src/lib/alpha/SignalFusionEngine.ts`
- `src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts`
- `src/lib/market/MarketRegimeEngine.ts`
- alphaScore / bucket / scoring formula semantics
- `00-Plan/roadmap/branch_policy.md`
- `00-Plan/roadmap/CEO-Decision.md` (CEO output — do not modify)
- `00-Plan/roadmap/CTO-Analysis.md` (CTO domain — uncommitted CTO realignment; will be committed by CTO separately)
- `00-Plan/roadmap/roadmap.md` (uncommitted CTO V2.6 realignment; do NOT modify in this task)
- `00-Plan/roadmap/p29g_preflight_decision.md`
- branch / worktree topology
- Any other src/ file outside the 2 listed allowed `src/...` paths

This task does NOT authorize:
- Axis B Simulation Input Eligibility Diff (deferred to P1 / next round)
- Axis B v6 continuation (deferred to P2 / round after P1)
- dsxcai Pattern Adoption Plan (deferred to P3 — design only when started)
- Axis A v1 real-data integration (deferred to P4)
- Hygiene Backlog commits (deferred to P5)
- `YES apply Chip availableAt migration to dev DB`
- `YES apply MonthlyRevenue releaseDate backfill`
- `YES apply FinancialReport releaseDate migration to dev DB`
- Filesystem writer / GUI / optimizer / real backtest / DB writes / network calls
- Any additional Axis A v0 scaffold stage beyond P52 diff

## Execution Plan

### Phase 0 — Pre-flight + PROJECT_CONTEXT_LOCK + Dirty-State Classification

Run pre-flight commands from Governance Header. Then classify every dirty / untracked file into ONE of:

1. **Expected USER_DECISION** — `00-StockPlan/20260514/*`, `00-StockPlan/20260515/*`
2. **Expected runtime artifacts** — `prisma/dev.db-shm`, `prisma/dev.db-wal`, `runtime/agent_orchestrator/llm_usage.jsonl`, `runtime/training_reports/tw_weekly_deep_research.json`
3. **Known P28 drift artifacts** — `outputs/online_validation/p28c_renderer_only_repair_9case_before_after.json`, `p28d_9case_integrated_review_validation.json`, `p28d_p3_p19_renderer_regression_sweep.json`
4. **Pending CTO realignment** — `00-Plan/roadmap/CTO-Analysis.md`, `00-Plan/roadmap/roadmap.md` (modified by CTO; out of P52 scope; do NOT stage or modify)
5. **Safe P52 scope files** — only the 4 files listed in "Allowed Modifications"
6. **Post-P51 unknown changes** — any file not matching categories 1–5

If any file falls into category 6:
- STOP immediately
- Do NOT stage anything
- Do NOT modify anything
- Write `outputs/online_validation/p52_blocked_dirty_state_report.md` listing unknown files
- Final classification: `P52_BLOCKED_BY_DIRTY_STATE`

### Phase 1 — Read Existing Contracts

Read for context (no edits):
- `outputs/online_validation/p51_axis_a_snapshot_export_serializer_report.md`
- `outputs/online_validation/p50_axis_a_snapshot_export_filter_report.md`
- `outputs/online_validation/p49_axis_a_snapshot_log_exporter_report.md`
- `src/lib/research/snapshot/v0/SnapshotExportSerializer.ts`
- `src/lib/research/snapshot/v0/SnapshotExportFilter.ts`
- `src/lib/research/snapshot/v0/SnapshotLogExporter.ts`
- `src/lib/research/snapshot/v0/index.ts`
- Existing test files (`p49_*.test.ts`, `p50_*.test.ts`, `p51_*.test.ts`) for type / contract patterns

Identify:
- `SnapshotLogExport` shape (records, metadata, blocked-source states)
- `SnapshotLogRecord` shape (`symbol`, `loggedAt`, plus other fields)
- Existing exports from `index.ts`

### Phase 2 — Implement `SnapshotExportDiff.ts`

Required exports:

```typescript
export const SNAPSHOT_EXPORT_DIFF_VERSION = "p52-axis-a-snapshot-export-diff-v0";

export type SnapshotExportDiffReport = {
  readonly diffVersion: typeof SNAPSHOT_EXPORT_DIFF_VERSION;
  readonly diffedAt: string;
  readonly added: readonly SnapshotLogRecord[];
  readonly removed: readonly SnapshotLogRecord[];
  readonly unchanged: readonly SnapshotLogRecord[];
  readonly addedCount: number;
  readonly removedCount: number;
  readonly unchangedCount: number;
};

export function diffSnapshotLogExports(
  before: SnapshotLogExport,
  after: SnapshotLogExport,
  fixedDiffedAt?: string,
): SnapshotExportDiffReport;
```

Identity key: `symbol + loggedAt` (use ` ` or similar separator to avoid collision).

Behavior must satisfy all 10 goal bullets above. Implementation should:
- Build a `Set<string>` of `before` keys and `after` keys for O(n+m) classification.
- Walk `after.records` in order → emit to `added` (if key not in before) or `unchanged` (if key in both).
- Walk `before.records` in order → emit to `removed` (if key not in after).
- Use spread (or `Object.freeze`-friendly readonly types) so inputs are not mutated.
- Output `diffedAt = fixedDiffedAt ?? new Date().toISOString()`.

### Phase 3 — Update `index.ts`

Add re-exports for new public API:
- `SNAPSHOT_EXPORT_DIFF_VERSION`
- `SnapshotExportDiffReport`
- `diffSnapshotLogExports`

Do NOT remove or alter any existing exports.

### Phase 4 — Tests (`p52_axis_a_snapshot_export_diff.test.ts`)

Required test coverage (≥19 cases):

1. Empty before / empty after → `addedCount=0, removedCount=0, unchangedCount=0`
2. Empty before / non-empty after → all records in `added`
3. Non-empty before / empty after → all records in `removed`
4. Same exports (identical records) → all in `unchanged`
5. Added record detection (single new key in after)
6. Removed record detection (single key only in before)
7. Mixed added / removed / unchanged
8. Order preservation for `added` (matches `after.records` order)
9. Order preservation for `removed` (matches `before.records` order)
10. Order preservation for `unchanged` (matches `after.records` order)
11. Counts match array lengths
12. `fixedDiffedAt = "2026-05-25T00:00:00.000Z"` → deterministic output
13. Omitted `fixedDiffedAt` → `diffedAt` is a valid ISO timestamp (regex check)
14. `before` input is not mutated (deep-equal pre / post)
15. `after` input is not mutated (deep-equal pre / post)
16. Blocked-source records (if represented in `SnapshotLogExport`) remain blocked in output
17. Output is JSON-serializable: `JSON.parse(JSON.stringify(report))` deep-equals report
18. No DB / network / FS imports introduced (static check or absence of relevant imports)
19. Forbidden field scan: result object does NOT contain any of: `recommendation`, `action`, `buy`, `sell`, `target`, `ROI`, `PnL`, `winRate`, `edge`, `alphaScore`, `score`, `forecast`, `expectedReturn`, `benchmark`

Add bonus tests as desired but never reduce below 19.

### Phase 5 — Verification

```bash
# Targeted test
npx jest src/lib/research/__tests__/p52_axis_a_snapshot_export_diff.test.ts --no-coverage 2>&1 | tail -15

# Research + onlineValidation baseline
npx jest src/lib/research/ src/lib/onlineValidation/ --no-coverage 2>&1 | tail -10
```

Expected:
- Targeted: all P52 tests PASS.
- Baseline: 5636/5636 PASS or pre-existing baseline (no new failures).

If any new failure (not pre-existing pinned list), STOP and report. Do NOT commit.

### Phase 6 — Boundary Scan

Stage exactly 4 files by full path:
```bash
git add src/lib/research/snapshot/v0/SnapshotExportDiff.ts
git add src/lib/research/snapshot/v0/index.ts
git add src/lib/research/__tests__/p52_axis_a_snapshot_export_diff.test.ts
git add outputs/online_validation/p52_axis_a_snapshot_export_diff_report.md
```

Verify staged set:
```bash
git diff --cached --name-only
```

Expected: exactly 4 lines, all in the allowed list.

Forbidden scan:
```bash
git diff --cached --name-only | grep -E "prisma/|data/|scripts/|tests/|logs/|runtime/|00-StockPlan|\.jsonl$|p28c|p28d|package(-lock)?\.json|CEO-Decision|CTO-Analysis|branch_policy|roadmap\.md" && echo "BOUNDARY_VIOLATION_DETECTED" || echo "BOUNDARY_SCAN_CLEAN"
```

Expected: `BOUNDARY_SCAN_CLEAN`. If `BOUNDARY_VIOLATION_DETECTED`, `git reset` and STOP.

### Phase 7 — Commit

```bash
git commit -m "$(cat <<'EOF'
feat: add Axis A research snapshot export diff

P52 closes the Axis A v0 in-memory chain at stage 10 (diff).

- Pure / in-memory / deterministic with fixedDiffedAt.
- Compares two SnapshotLogExport objects by symbol + loggedAt.
- Returns added / removed / unchanged records with order preserved.
- No DB / filesystem / network writes.
- No recommendation / scoring / PnL / ROI / win-rate / benchmark fields.
- Closes Axis A v0 scaffold chain; next implementation round is Axis B
  Simulation Input Eligibility Diff per CEO Decision 2026-05-25 P1.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Do NOT use `--no-verify`. If a pre-commit hook fails, fix the underlying issue and re-stage / re-commit.

### Phase 8 — Push

```bash
git push origin main
```

No force-push. If rejected by branch protection, STOP and report.

### Phase 9 — CI Observation

```bash
gh run list --workflow=test-gate.yml --limit 3
```

Wait for new run conclusion. Required checks: `onlineValidation`, `research + simulation`, `Dirty-File Bleed-Through Guard` — all must be green.

If any check fails:
- Do NOT auto-fix
- STOP and report failing check + run URL
- Final classification: `P52_BLOCKED_BY_CI_FAIL`

### Phase 10 — Report Finalization (Separate Docs Commit)

After CI green, update `outputs/online_validation/p52_axis_a_snapshot_export_diff_report.md` with:
- Final CI run ID + conclusion + per-check results
- Final commit hashes (feat commit + finalization commit)
- Final classification

Stage and commit ONLY the report file:
```bash
git add outputs/online_validation/p52_axis_a_snapshot_export_diff_report.md
git commit -m "docs: finalize P52 report with CI run results

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main
```

Do NOT `--amend` and do NOT force-push. Finalization is a separate docs commit.

Observe finalization CI run and confirm green.

## Acceptance Criteria

1. Phase 0 dirty-state classification complete; no category-6 unknown files; PROJECT_CONTEXT_LOCK scan clean.
2. `SnapshotExportDiff.ts` implements full API per Phase 2 contract.
3. `index.ts` re-exports new API without breaking existing exports.
4. Test file has ≥19 tests covering all required cases; targeted PASS; baseline PASS.
5. Boundary scan CLEAN; exactly 4 files staged in P52 feat commit.
6. Commit message follows the template; no `--no-verify`.
7. Push to `main` succeeds; new CI run reaches success on all required checks.
8. Optional finalization docs commit lands cleanly (no amend, no force).
9. Report file documents: classification, commit hashes, CI run IDs, test counts, dirty-state classification result, axis-monopoly closure note.
10. No file outside the 4 allowed paths modified by P52 feat commit; no file outside the 1 allowed path modified by finalization docs commit.

## Test Command Summary

```bash
# Targeted
npx jest src/lib/research/__tests__/p52_axis_a_snapshot_export_diff.test.ts --no-coverage

# Baseline
npx jest src/lib/research/ src/lib/onlineValidation/ --no-coverage

# Pre-commit boundary scan
git diff --cached --name-only | grep -E "prisma/|data/|scripts/|tests/|logs/|runtime/|00-StockPlan|\.jsonl$|p28c|p28d|package(-lock)?\.json|CEO-Decision|CTO-Analysis|branch_policy|roadmap\.md" \
  && echo "BOUNDARY_VIOLATION_DETECTED" \
  || echo "BOUNDARY_SCAN_CLEAN"

# Post-push CI check
gh run list --workflow=test-gate.yml --limit 3
```

## Output Report Locations

- `src/lib/research/snapshot/v0/SnapshotExportDiff.ts`
- `src/lib/research/snapshot/v0/index.ts` (updated)
- `src/lib/research/__tests__/p52_axis_a_snapshot_export_diff.test.ts`
- `outputs/online_validation/p52_axis_a_snapshot_export_diff_report.md`
- (If blocked at Phase 0) `outputs/online_validation/p52_blocked_dirty_state_report.md`

## Final Classification

One of:
- `P52_AXIS_A_SNAPSHOT_EXPORT_DIFF_V0_COMMITTED` — feat committed, pushed, CI green, finalization committed
- `P52_AXIS_A_SNAPSHOT_EXPORT_DIFF_V0_DEFINED` — feat committed, pushed, CI green, finalization not yet done
- `P52_AXIS_A_SNAPSHOT_EXPORT_DIFF_TEST_ONLY_NOT_COMMITTED` — tests pass locally but not committed
- `P52_BLOCKED_BY_P51_NOT_CLOSED` — P51 closure incomplete
- `P52_BLOCKED_BY_DIRTY_STATE` — Phase 0 found unclassified post-P51 changes
- `P52_BLOCKED_BY_USER_DECISION_FILES` — USER_DECISION file staged or modified
- `P52_BLOCKED_BY_DB_OR_NETWORK_DEPENDENCY` — implementation requires forbidden side effects
- `P52_BLOCKED_BY_TEST_FAILURE` — new (non-pre-existing) test failure detected
- `P52_BLOCKED_BY_CI_FAIL` — post-push CI run failed
- `P52_BLOCKED_BY_SCOPE_AMBIGUITY` — contract / type ambiguity prevents implementation
- `P52_BOUNDARY_VIOLATION` — forbidden file staged or governance violation

## Notes for Worker / Planner

- This task is the **FINAL Axis A v0 scaffold round**. From P53 onward, no further Axis A v0-chain stage is permitted until Axis B has delivered at least 2 rounds (CEO P1 + P2).
- If tempted to add filesystem writer / archive / CLI command / GUI / metric semantics: STOP. Those are explicitly out of scope.
- If tempted to import code or trading semantics from `dsxcai/stock_trading` or any other external repo: STOP. Architectural patterns may be **referenced** in design discussion but never **copied**.
- If P51 handoff "Made changes" warning surfaces unknown files at Phase 0: STOP with `P52_BLOCKED_BY_DIRTY_STATE`. Do not attempt to repair or classify guessed.
- Do NOT modify `roadmap.md`, `CTO-Analysis.md`, or `CEO-Decision.md` in this task. CTO-realignment is uncommitted by design; CTO will commit it separately.
- The next task (P1 per CEO Decision) will be Axis B Simulation Input Eligibility Diff. This task should NOT prepare, stub, or reference that work.
- If `gh run list` shows the new run still in progress at Phase 9: WAIT (poll once after 60s) or report `IN_PROGRESS` with last known status. Do not declare success prematurely.
- Finalization docs commit is OPTIONAL. If skipped, final classification = `P52_AXIS_A_SNAPSHOT_EXPORT_DIFF_V0_DEFINED`. If completed, final classification = `P52_AXIS_A_SNAPSHOT_EXPORT_DIFF_V0_COMMITTED`.
