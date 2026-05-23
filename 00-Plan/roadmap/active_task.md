# Active Task — 2026-05-23 (Post-P48)

## PROJECT_CONTEXT_LOCK (MANDATORY)

```text
Project = Stock-Prediction-System
Canonical Repo = /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System
Canonical Branch = main

If any task, file, commit, or roadmap reference belongs to another project
(Betting-pool, MLB, bare TSL, CLV, P26J, P26K, COMPLETE_PAIR, odds daemon):
  STOP immediately.
  Do not summarize it as current project work.
  Do not create artifacts for it.
```

## Governance Header (MANDATORY)

### Canonical Repo
`/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System`

### Canonical Branch
`main`

### Canonical HEAD (expected)
`261cd36 P48: Add paper simulation dry-run result artifact golden fixture design` or a clean descendant.

### Rules
- Do NOT create new branch, worktree, clone, or repo.
- Do NOT checkout another branch or use detached HEAD.
- Do NOT modify `src/**`, `prisma/**`, `data/**`, `tests/**`, `scripts/**`, `package.json`, corpus jsonl, or scoring files.
- Do NOT modify alphaScore / bucket / scoring formula semantics.
- Do NOT produce investment advice or performance claims (no ROI / PnL / win-rate / buy / sell / hold / action).
- Do NOT execute simulation, optimizer, real backtest, or migration apply.
- Any DB / migration apply requires the user's explicit authorization sentence and is NOT part of this task.

### Required Pre-flight
```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short

# PROJECT_CONTEXT_LOCK contamination scan
grep -RniE "P26J|P26K|Betting-pool|CLV|COMPLETE_PAIR|closing window" 00-StockPlan outputs src 00-Plan 2>/dev/null | head -20 || echo "PROJECT_CONTEXT_LOCK_CLEAN_partial"
grep -RniE "\\bTSL\\b" 00-StockPlan outputs src 00-Plan 2>/dev/null | grep -v "TSLA" | head -10 || echo "bare_TSL_CLEAN"
```

STOP if repo / branch / HEAD mismatch, or any contamination match (excluding TSLA / HTMLButtonElement false positives).

---

## Task Name

**P49-LEDGER — Post-P47 Full Suite Baseline + Known Failure Ledger (verification-only, no src/)**

## Source

CEO Decision 2026-05-23 (Post-P48 Review) — P0.

CEO split CTO's P49 proposal:
- **This task** = ledger half (derived from actual full-suite run).
- P49 Manifest half = P2 (deferred to after P1 Axis A round).

## Background

- HEAD = `261cd36` P48 golden fixture design (committed).
- P38–P48 chain regression: 1035/1035 PASS (per P48 report).
- P48 targeted: 100/100 PASS.
- **Full `npx jest src/lib/onlineValidation/__tests__` status post-P47/P48: `[Unknown]`.**
- P48 self-report names 4 pre-existing failures: `p26a_renderer_fix`, `p26a_batch_pipeline_wiring`, `p27_waiting_state_policy_guard`, `p29d_dropzone_scaffold` — but these have never been pinned by file path + describe → it name in a ledger.
- Without a real full-suite rerun + ledger, future implementation rounds cannot cleanly attribute new failures.
- CEO also flagged 11:0 Axis A:Axis B implementation ratio since P37; this round is bounded verification only — Axis A rebalancing happens in P1 tomorrow.

This round is **pure verification + ledger**. No new design artifact, no src/, no schema/DB/scoring change.

## Goal

Produce a project-wide test baseline and known-failure ledger such that:

1. Total suites / tests / pass / fail / skipped counts are recorded for current HEAD.
2. Every failing test is named (file path + full describe → it path) + failure type + message excerpt.
3. Each failing test is classified as **pre-existing**, **new**, or **unattributed**.
4. Each failing test has a ledger entry (suite / file / failure type / blocking status / owner / next action).
5. If any test is `new`, this task STOPS and reports — do NOT mix repair into this round.

## Allowed Modifications

Allowed to create / modify:
- `outputs/online_validation/p49_ledger_full_suite_baseline.json`
- `outputs/online_validation/p49_ledger_full_suite_baseline.md`
- `outputs/online_validation/p49_ledger_known_failures.json`
- `outputs/online_validation/p49_ledger_known_failures.md`
- `outputs/online_validation/p49_ledger_context_lock_scan.json`
- `outputs/online_validation/p49_ledger_context_lock_scan.md`
- `outputs/online_validation/p49_ledger_final_report.md`
- `00-Plan/roadmap/roadmap.md` — append a P49-LEDGER overlay section only; do NOT rewrite earlier overlays.

## Forbidden Modifications

Forbidden:
- Any file under `src/**`
- Any file under `prisma/**` (schema, migrations, dev.db, dev.db-shm, dev.db-wal)
- Any file under `data/**`
- Any file under `tests/**`
- Any file under `scripts/**`
- `package.json` / `package-lock.json`
- Any `.jsonl` corpus file
- `runtime/agent_orchestrator/llm_usage.jsonl`
- `src/lib/services/syncService.ts`
- `src/lib/analysis/RuleBasedStockAnalyzer.ts`
- `src/lib/alpha/SignalFusionEngine.ts`
- `src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts`
- `src/lib/market/MarketRegimeEngine.ts`
- alphaScore formula / bucket formula / scoring formula
- `00-Plan/roadmap/branch_policy.md`
- `00-Plan/roadmap/CEO-Decision.md` (CEO output)
- `00-Plan/roadmap/CTO-Analysis.md` (CTO domain)
- `00-Plan/roadmap/p29g_preflight_decision.md`
- branch / worktree topology
- new design documents, new contracts, new gate scanners, new src/ files

This task does NOT authorize:
- Any P49 Manifest creation (deferred to P2 tomorrow)
- Axis A research snapshot work (deferred to P1 tomorrow)
- `YES apply Chip availableAt migration to dev DB`
- `YES apply MonthlyRevenue releaseDate backfill`
- `YES apply FinancialReport releaseDate migration to dev DB`
- Any failure repair (deferred to P8 after ledger pinned)

## Execution Plan

### Phase 0 — Pre-flight + PROJECT_CONTEXT_LOCK

```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short

# Contamination scan
grep -RniE "P26J|P26K|Betting-pool|CLV|COMPLETE_PAIR|closing window" 00-StockPlan outputs src 00-Plan 2>/dev/null | head -20
grep -RniE "\\bTSL\\b" 00-StockPlan outputs src 00-Plan 2>/dev/null | grep -v "TSLA" | head -10
```

Expected:
- repo = canonical
- branch = `main`
- HEAD = `261cd36` (or a later commit if P49-LEDGER artifacts are being staged)
- staged files = none
- dirty files = pre-existing runtime only (logs, dev.db, runtime/*) + 30+ pre-existing untracked artifacts (not this task's concern)
- contamination scan = clean (excluding TSLA / HTMLButtonElement false positives)

STOP if any condition violated.

Record scan results to `p49_ledger_context_lock_scan.{json,md}`.

### Phase 1 — Run Full Suite

```bash
npx jest src/lib/onlineValidation/__tests__ --no-coverage --json --outputFile=/tmp/p49_ledger_jest.json 2>&1 | tail -40
```

If `--json --outputFile` is not supported by the project's Jest config, fall back to:
```bash
npx jest src/lib/onlineValidation/__tests__ --no-coverage 2>&1 | tee /tmp/p49_ledger_jest.txt | tail -60
```

Allow up to 10 minutes runtime.

Record raw output for failure extraction (raw output NOT committed; only structured ledger committed).

### Phase 2 — Extract Failures

For each failing test, extract:
- test file path (e.g. `src/lib/onlineValidation/__tests__/p26a_renderer_fix.test.ts`)
- full test name (describe → it path)
- failure type (`assertion` / `timeout` / `setup_error` / `unknown`)
- one-line message excerpt (no full stack trace in JSON; stack trace allowed in MD if useful)

### Phase 3 — Classify Pre-existing vs New vs Unattributed

Reference list (from P48 report — to be verified by this task):
- `p26a_renderer_fix`
- `p26a_batch_pipeline_wiring`
- `p27_waiting_state_policy_guard`
- `p29d_dropzone_scaffold`

For each failing test, classify:
- `pre-existing` — matches a P48-named failure pattern, AND the test file existed in HEAD before any P38-P48 commit (verify via `git log <test-file> --oneline | head -3`)
- `new` — test file was added in P38-P48 commits AND is currently failing
- `unattributed` — failing test that does not clearly fall into either category (must be investigated separately, NOT in this round)

### Phase 4 — Write Ledger Artifacts

#### `outputs/online_validation/p49_ledger_full_suite_baseline.json`

```json
{
  "phase": "P49-LEDGER",
  "purpose": "Post-P47/P48 full onlineValidation baseline + known-failure ledger source",
  "capturedAt": "<ISO timestamp>",
  "repo": "/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System",
  "branch": "main",
  "headCommit": "<actual HEAD>",
  "headSubject": "<actual HEAD subject>",
  "testScope": "src/lib/onlineValidation/__tests__",
  "jestCommand": "npx jest src/lib/onlineValidation/__tests__ --no-coverage",
  "totalSuites": <N>,
  "passedSuites": <N>,
  "failedSuites": <N>,
  "totalTests": <N>,
  "passedTests": <N>,
  "failedTests": <N>,
  "skippedTests": <N>,
  "runtimeSeconds": <N>,
  "overallClassification": "FULL_SUITE_BASELINE_GREEN | FULL_SUITE_BASELINE_PRE_EXISTING_ONLY | FULL_SUITE_BASELINE_HAS_NEW_FAILURES | FULL_SUITE_BASELINE_HAS_UNATTRIBUTED_FAILURES",
  "nextRoundAllowed": true | false,
  "nextRoundReason": "...",
  "entersAlphaScore": false,
  "noScoringChange": true,
  "noDbApply": true,
  "noCorpusChange": true,
  "noSimulationExecution": true,
  "noOptimizer": true,
  "noRealBacktest": true,
  "disclaimer": "Verification-only baseline. Does not constitute investment advice. No profit / return / win-rate / PnL claims. No scoring formula change. No DB write. Results must not be used as buy / sell / hold signals."
}
```

#### `outputs/online_validation/p49_ledger_known_failures.json`

```json
{
  "phase": "P49-LEDGER",
  "purpose": "Canonical ledger of known-failing tests in src/lib/onlineValidation/__tests__ at HEAD",
  "capturedAt": "<ISO timestamp>",
  "headCommit": "<actual HEAD>",
  "ledgerEntries": [
    {
      "file": "src/lib/onlineValidation/__tests__/<name>.test.ts",
      "test": "<full describe → it path>",
      "failureType": "assertion | timeout | setup_error | unknown",
      "messageExcerpt": "<one-line excerpt>",
      "classification": "pre-existing | new | unattributed",
      "firstSeenCommit": "<commit sha if known, or 'unknown'>",
      "blocking": false,
      "owner": "<phase prefix, e.g. 'p26a' / 'p27' / 'p29d' / 'unattributed'>",
      "nextAction": "<one-line: 'defer to P8 repair planning' | 'investigate in P8' | 'requires P1 Axis A round first'>"
    }
  ],
  "preExistingFailureCount": <N>,
  "newFailureCount": <N>,
  "unattributedFailureCount": <N>,
  "ledgerMatchesP48ClaimedSet": true | false,
  "p48ClaimedSet": [
    "p26a_renderer_fix",
    "p26a_batch_pipeline_wiring",
    "p27_waiting_state_policy_guard",
    "p29d_dropzone_scaffold"
  ],
  "disclaimer": "Ledger only. No repair authorized in this task. Repair is P8 after ledger pinned."
}
```

#### Markdown counterparts

Each JSON has a markdown counterpart with human-readable summary tables (header section, baseline table, failures table with classification, overall classification, next-round verdict, one paragraph on what this baseline means for tomorrow's P1 Axis A round, disclaimer footer).

### Phase 5 — Decision Gate

Based on `overallClassification`:

| Classification | Next Round Allowed | Action |
| --- | --- | --- |
| `FULL_SUITE_BASELINE_GREEN` | YES | Proceed to CEO P1 (Axis A research snapshot v0 design + src/ stub). |
| `FULL_SUITE_BASELINE_PRE_EXISTING_ONLY` | YES | Same as above. Pre-existing failures pinned and acceptable. |
| `FULL_SUITE_BASELINE_HAS_NEW_FAILURES` | NO | STOP. Report new failures by name. Return to CEO. Do NOT repair in this round. |
| `FULL_SUITE_BASELINE_HAS_UNATTRIBUTED_FAILURES` | CONDITIONAL | If ≤2 unattributed AND not blocking, CEO may waive next round; otherwise return to CEO. |

### Phase 6 — Final Report

`outputs/online_validation/p49_ledger_final_report.md` containing:

1. Goal (cite CEO Decision 2026-05-23 P0).
2. PROJECT_CONTEXT_LOCK scan result.
3. Pre-flight state (HEAD, branch, dirty file summary).
4. Full-suite baseline summary (counts table).
5. Failure ledger summary (by classification).
6. Overall classification + next-round verdict.
7. What this means for P1 Axis A round tomorrow.
8. Anti-axis-monopoly rule recorded (no further Axis B until Axis A delivers).
9. Forbidden modification scan result.
10. Final Classification.

## Acceptance Criteria

1. Phase 0 pre-flight + PROJECT_CONTEXT_LOCK PASS.
2. Phase 1 full-suite run executed in one continuous run, runtime recorded.
3. Phase 4 baseline JSON + ledger JSON + both MD counterparts written under `outputs/online_validation/p49_ledger_*`.
4. Every failing test has a ledger entry with file + test name + classification + owner + nextAction.
5. `ledgerMatchesP48ClaimedSet` field is populated true/false.
6. `git diff --stat` shows only paths under "Allowed modifications".
7. Forbidden claims regex over new artifacts:
   `ROI|win-rate|win rate|alpha(?!Score)|edge|profit|outperform|beat|\\bbuy\\b|\\bsell\\b|guaranteed|investment recommendation|買進|賣出|買入`
   → 0 violations. Allowed: `alphaScore`, the literal regex itself, accounting terms only when quoted from schema.
8. No file under "Forbidden Modifications" is touched (verify via `git diff --name-only`).
9. No `git add`, `git rm`, `git commit`, `git checkout`, `git merge`, `git rebase`, `prisma migrate`, `npm run build`, or any DB / migration apply executed.
10. `prisma/dev.db` sha256 unchanged (record before/after; expect identical).

## Test Commands (verification)

```bash
# Pre-flight
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short

# Full suite
npx jest src/lib/onlineValidation/__tests__ --no-coverage 2>&1 | tee /tmp/p49_ledger_jest.txt | tail -60

# Forbidden claims scan (after artifacts written)
grep -E -i "ROI|win-rate|win rate|alpha(?!Score)|edge|profit|outperform|beat|\\bbuy\\b|\\bsell\\b|guaranteed|investment recommendation|買進|賣出|買入" \
  outputs/online_validation/p49_ledger_*.md \
  outputs/online_validation/p49_ledger_*.json 2>/dev/null || echo "no forbidden matches"

# Boundary verification
git diff --name-only | grep -vE "^(outputs/online_validation/p49_ledger_|00-Plan/roadmap/roadmap\\.md)" && echo "BOUNDARY VIOLATION" || echo "boundary clean"

# Invariance
shasum -a 256 prisma/dev.db
```

## Output Report Locations

- `outputs/online_validation/p49_ledger_full_suite_baseline.json`
- `outputs/online_validation/p49_ledger_full_suite_baseline.md`
- `outputs/online_validation/p49_ledger_known_failures.json`
- `outputs/online_validation/p49_ledger_known_failures.md`
- `outputs/online_validation/p49_ledger_context_lock_scan.json`
- `outputs/online_validation/p49_ledger_context_lock_scan.md`
- `outputs/online_validation/p49_ledger_final_report.md`

## Final Classification (choose one)

- `P49_LEDGER_BASELINE_GREEN_NEXT_AXIS_A_AUTHORIZED` — all tests PASS; tomorrow's P1 Axis A is unblocked
- `P49_LEDGER_PRE_EXISTING_ONLY_NEXT_AXIS_A_AUTHORIZED` — only pre-existing failures pinned; tomorrow's P1 Axis A is unblocked
- `P49_LEDGER_HAS_NEW_FAILURES_BLOCKED` — new failures detected; STOP and return to CEO; do NOT repair
- `P49_LEDGER_HAS_UNATTRIBUTED_FAILURES_NEEDS_CEO_REVIEW` — unattributed failures present; return to CEO for waiver decision
- `P49_LEDGER_BLOCKED_CONTEXT_CONTAMINATION` — PROJECT_CONTEXT_LOCK violated
- `P49_LEDGER_BOUNDARY_VIOLATION` — modification outside allowed paths
- `P49_LEDGER_FORBIDDEN_CLAIM_DETECTED` — forbidden claims regex matched

Expected best outcome: `P49_LEDGER_PRE_EXISTING_ONLY_NEXT_AXIS_A_AUTHORIZED` (matches P48 self-report) or `P49_LEDGER_BASELINE_GREEN_NEXT_AXIS_A_AUTHORIZED`.

## Next-round routing (record verbatim in final report)

If P0 PASS:
- **Tomorrow's P1:** Axis A Controlled Research Snapshot v0 — DESIGN with `src/` stub under `src/lib/research/` (or equivalent new module) consuming P36/P37 MonthlyRevenue controlled consumer + PIT-safe Quote/Regime.
- **Hard rule (anti-axis-monopoly):** P1 MUST be Axis A AND MUST touch `src/`. No further Axis B implementation round until Axis A produces a visible research snapshot artifact.
- **Carry-forward invariants:** `entersAlphaScore=false`, `paperOnly=true`, `dryRun=true`, `notInvestmentRecommendation=true`, no scoring/DB/corpus/GUI/optimizer/real-backtest changes, no buy/sell/hold/action semantics, no PnL/ROI/win-rate claims.
- **P2 (after P1):** P49 Manifest (P39-P48 canonical phase documentation).
- **P3 (parallel to P2):** Untracked Artifact Disposition Plan & Execution (address 30+ untracked artifacts including `CEO-Decision.md` and `active_task.md` themselves).
- **P4 (after P1):** Axis B Fixture-backed Dry-run Validation Checkpoint.

If P0 BLOCKED (new failures or boundary violation):
- Return to CEO for triage; do NOT auto-expand scope; do NOT enter P1 until baseline pinned.
