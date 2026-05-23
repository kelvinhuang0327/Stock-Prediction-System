# P14 — Production Hardening v2 Plan
**Generated**: 2026-05-23T09:49:53Z
**Classification**: P14_PRODUCTION_HARDENING_V2_PLAN_READY
**Authorized by**: `begin production hardening v2`
**HEAD**: 521edf6 (main)

---

## 1. CI Live-Run Observation Status

**Status: NOT OBSERVED — repo never pushed to GitHub**

| Check | Finding |
|---|---|
| `git remote -v` | `origin https://github.com/kelvinhuang0327/Stock-Prediction-System.git` |
| `git status -sb` | `main...origin/main [ahead 201]` |
| CI trigger condition | push or PR to `main` |
| First GitHub Actions run | **NEVER TRIGGERED** — 201 local commits not pushed |

The CI gate workflow (`.github/workflows/test-gate.yml`) was committed locally as `521edf6`
but has not reached GitHub. No Actions run has ever been created for this workflow.

**Action required to trigger**: `git push origin main` (requires user authorization).

---

## 2. GitHub Actions Result

**NOT AVAILABLE** — no push to remote has occurred.

Expected behavior when first push lands:
| Job | Expected result | Expected duration |
|---|---|---|
| `online-validation` | ✅ 4846/4846 PASS | ~85 s |
| `research-simulation` | ✅ 275/275 PASS | ~3 s |
| `dirty-file-guard` | ✅ BOUNDARY_CLEAN (committed files only) | ~5 s |
| DB SHA guard | ✅ SKIPS (no `prisma/dev.db` in CI runner) | — |

Risk: `ubuntu-latest` runner may differ from local macOS on jsdom version, node_modules
hash, or filesystem encoding. If any job fails on first run, investigation is required
before adding new axis work.

---

## 3. Branch Protection Recommendation

Branch protection for `main` is **not configured**. The CI gate workflow is in place
but mergeable without CI passing. Recommended settings:

### Recommended: GitHub Branch Protection Rules for `main`

```
Repository → Settings → Branches → Add branch protection rule
Branch name pattern: main

✅ Require a pull request before merging
✅ Require status checks to pass before merging
   Required status checks (add all three):
   ┌─────────────────────────────────┬────────────────────────────────┐
   │ Job name (GitHub check)         │ Workflow file                  │
   ├─────────────────────────────────┼────────────────────────────────┤
   │ online-validation               │ .github/workflows/test-gate.yml│
   │ research-simulation             │ .github/workflows/test-gate.yml│
   │ dirty-file-guard                │ .github/workflows/test-gate.yml│
   └─────────────────────────────────┴────────────────────────────────┘
✅ Require branches to be up to date before merging
✅ Do not allow bypassing the above settings
❌ Allow force pushes         (DISABLED)
❌ Allow deletions            (DISABLED)
```

Note: GitHub only shows status checks in the autocomplete list after at least one
successful run. Configure rules **after** first successful push.

---

## 4. Required Checks Proposal

Three checks must pass before any commit reaches `main`:

### `online-validation`
- Command: `npx jest src/lib/onlineValidation/__tests__ --no-coverage --forceExit`
- Baseline: **4846 tests / 127 suites**
- Timeout: 10 minutes
- Failure mode: any regression below 4846 blocks merge

### `research-simulation`
- Command: `npx jest src/lib/research/__tests__ --no-coverage --forceExit`  
           `npx jest src/lib/simulation/__tests__ --no-coverage --forceExit`
- Baseline: **275 tests / 8 suites**
- Timeout: 5 minutes
- Failure mode: any regression below 275 blocks merge

### `dirty-file-guard`
- Command: `git diff --name-only HEAD~1 HEAD` grep for MUST_NOT_COMMIT paths
- Paths: `logs/`, `runtime/agent_orchestrator/pids/`, `data/manual/`, `prisma/dev.db`
- Timeout: 30 seconds
- Failure mode: any MUST_NOT_COMMIT file in the diff blocks merge

---

## 5. Dirty-File Guard Policy

| Category | Files | Policy |
|---|---|---|
| MUST_NOT_COMMIT | `logs/launchd/*` (10) | Never staged; gitignore candidate |
| MUST_NOT_COMMIT | `runtime/agent_orchestrator/pids/*.pid` | Never staged; gitignore candidate |
| MUST_NOT_COMMIT | `data/manual/**` | Never staged; gitignore candidate |
| MUST_NOT_COMMIT | `prisma/dev.db` | DB guard; CI skip if absent |
| working-tree drift | `outputs/online_validation/p28*.json` × 3 | Pending resolution (R1/R2) |
| USER_DECISION | `00-StockPlan/20260514/` | Awaiting `YES include 00-StockPlan files` |
| USER_DECISION | `00-StockPlan/20260515/` | Awaiting `YES include 00-StockPlan files` |

**Gitignore candidates** (recommended additions to reduce working-tree noise):
```
logs/launchd/
runtime/agent_orchestrator/pids/
data/manual/
```
These are already excluded by boundary policy but adding them to `.gitignore` would
remove them from `git status` output entirely.

---

## 6. DB SHA Guard Policy

| Property | Value |
|---|---|
| Canonical SHA | `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8` |
| Current local SHA | `a5cf2771...` UNCHANGED ✅ |
| CI behavior | Skip guard if `prisma/dev.db` absent in runner (expected on GitHub Actions) |
| Guard logic | `sha256sum prisma/dev.db` compared to canonical; fail-fast if mismatch |

The DB SHA guard is a safety net for detecting accidental DB mutation. Since GitHub
Actions runners do not have `prisma/dev.db`, the guard step is conditional and skips
cleanly in CI. On local runs, the guard asserts the canonical SHA.

**Policy**: `prisma/dev.db` and `prisma/` are never modified, never staged, never
committed. Any tool, script, or migration that touches `prisma/` is blocked by policy.

---

## 7. No DB / Scoring / Optimizer / Real Backtest Confirmation

Production Hardening v2 made **zero modifications** to any of the following:

| Scope | Modified | Evidence |
|---|---|---|
| `prisma/` | ❌ NO | boundary scan clean |
| `src/lib/scoring/` | ❌ NO | no files touched |
| `src/lib/optimizer/` | ❌ NO | no files touched |
| `src/lib/research/` | ❌ NO | no files touched |
| `src/lib/simulation/` | ❌ NO | no files touched |
| `data/` | ❌ NO | MUST_NOT_COMMIT, never touched |
| Any backtest runner | ❌ NO | not applicable |
| `entersAlphaScore` | false | unchanged |
| `paperOnly` | true | unchanged |
| `dryRunOnly` | true | unchanged |
| `noRealExecution` | true | unchanged |
| `executedAt` | null | unchanged |

Allowed outputs produced this session:
- `outputs/online_validation/p14_production_hardening_v2_plan.md` (this file)
- `00-Plan/roadmap/roadmap.md` P14 overlay (append-only)

---

## 8. Remaining Risks

| Risk | Severity | Status | Mitigation |
|---|---|---|---|
| Repo never pushed to remote — CI gate not yet live | HIGH | OPEN | User must `git push origin main` to activate |
| Branch protection not configured — CI bypassable on merge | HIGH | OPEN | Configure after first successful CI run |
| First CI run may fail on `ubuntu-latest` (env diff) | MEDIUM | OPEN | Monitor first run; pin deps if needed |
| p28 working-tree drift × 3 files | LOW | OPEN | `YES restore p28 outputs` or `YES restage p28 outputs` |
| 00-StockPlan/ dirs grow unbounded without gitignore | LOW | OPEN | gitignore or `YES include 00-StockPlan files` |
| MUST_NOT_COMMIT files pollute `git status` output | LOW | OPEN | Add to `.gitignore` |

---

## 9. Next 24h Prompt

```
[Stock Prediction System] P14 — Activate CI Gate or Continue Hardening

HEAD: 521edf6 (main)
Tests: 5121/5121 PASS (local)  |  DB SHA: a5cf2771... unchanged
CRITICAL: repo is 201 commits ahead of origin/main — CI gate NEVER pushed to GitHub

AUTHORIZATION OPTIONS — paste exact phrase to unblock:

[A] Push main to GitHub (activate CI gate / first live run):
    YES push main to github

[B] Add MUST_NOT_COMMIT paths to .gitignore (reduce git status noise):
    YES add gitignore entries

[C] Restore p28 outputs to committed state:
    YES restore p28 outputs

[D] Recommit corrected p28 outputs:
    YES restage p28 outputs

[E] Include 00-StockPlan dirs:
    YES include 00-StockPlan files

[F] Begin Axis A v2 (Research Snapshot sourceTrace/PIT):
    begin axis A

[G] Begin Axis B v2 (Dry-run Validation extension):
    begin axis B

Combinations OK. No phrase = planning-only, no changes.
```

---

## 10. CTO Agent 10-Line Summary

Authorization phrase `begin production hardening v2` received — gate opened for Production Hardening v2. Pre-flight passed: `main` / `521edf6` / dirty-file boundary intact. Critical finding: `git status -sb` shows `[ahead 201]` — the repo is 201 commits ahead of `origin/main`, meaning the CI gate workflow (`.github/workflows/test-gate.yml`) has never been pushed to GitHub and **no GitHub Actions run has ever been triggered**. The CI enforcement is entirely local until a push occurs. Branch protection is not configured. This session produced the hardening v2 plan documenting all five action items: push to activate CI, configure branch protection after first successful run, monitor first run for ubuntu-latest env differences, resolve p28 working-tree drift, and optionally add MUST_NOT_COMMIT paths to `.gitignore`. Zero modifications to DB, scoring, optimizer, research, or simulation code. Plan appended to roadmap as P14 overlay. Recommended next authorization: `YES push main to github` to activate the CI gate. Classification: **P14_PRODUCTION_HARDENING_V2_PLAN_READY**.
