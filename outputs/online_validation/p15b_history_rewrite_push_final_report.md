# P15b — History Rewrite + Force Push Final Report

**Date**: 2026-05-23
**Classification**: P15B_HISTORY_REWRITE_LOGS_REMOVED_PUSHED
**Session**: P15b

---

## 1. Authorization Phrase

`YES rewrite history remove logs`

---

## 2. Pre-flight Result

| Check | Result |
|---|---|
| Repo root | `/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System` |
| Branch | `main` |
| Remote | `origin https://kelvinhuang0327@github.com/kelvinhuang0327/Stock-Prediction-System.git` |
| `git filter-repo` available | ✅ v2.47.0 (installed via `brew install git-filter-repo`) |
| Blocker commits in push range | 11 commits containing `logs/launchd/backend.stdout.log` (102–105 MB) |
| Pre-flight verdict | **PASS — proceed with rewrite** |

---

## 3. Original HEAD (Pre-Rewrite)

```
521edf6209505182b3e8fa04d5602e1b67c19ece
```

origin/main before push: `bd2fad7323a790544bf98c4064114721f92adb2a`

---

## 4. Rewrite Method

```bash
git filter-repo --path logs/ --invert-paths --force
```

- 215 commits parsed and rewritten
- `NOTICE: Removing 'origin' remote` (expected — re-added manually after)
- `Rewrote the stash.`
- Completed in 6.92 seconds

Verification after rewrite:
```
git log --all --oneline -- 'logs/'                       → 0 commits ✅
git log --all --oneline -- 'logs/launchd/backend.stdout.log' → 0 commits ✅
git status: logs/ now shows as ?? (untracked, not tracked)
```

---

## 5. New HEAD (Post-Rewrite)

```
e2e71cce9288ee0f21767874fdf0a2c468b60d54
```

All 215 commit SHAs were rewritten. The pre-rewrite SHA `521edf6` is now stale
across all prior reports.

---

## 6. Offending Logs Removed

| File | Pre-rewrite commits (origin..HEAD) | Post-rewrite commits |
|---|---|---|
| `logs/launchd/backend.stdout.log` | 11 (102–105 MB) | **0** ✅ |
| `logs/` (all) | multiple | **0** ✅ |

Result: **REMOVED — 0 commits remain in full git history**

---

## 7. Test Results (Local, Post-Rewrite)

| Suite | Result |
|---|---|
| `src/lib/research/__tests__/` | ✅ 275/275 PASS (8 suites, 1.84s) |
| `src/lib/simulation/__tests__/` | ✅ 275/275 PASS (combined above) |
| `src/lib/onlineValidation/__tests__` | ✅ 4846/4846 PASS (127 suites, 57.9s) |
| **Total** | **✅ 5121/5121 PASS** |

---

## 8. DB SHA Result

```
shasum -a 256 prisma/dev.db
a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8
```

Expected: `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8`
Result: **DB_SHA_OK — UNCHANGED** ✅

---

## 9. Push Result

```bash
git push origin main --force
→  bd2fad7..e2e71cc  main -> main
```

Only GitHub warnings (not errors):
- `prisma/dev.db` appears at 50–53 MB across historical commits (warning-only)
- No `remote: error:` lines

Result: **PUSH SUCCEEDED** ✅

---

## 10. GitHub Actions Run Status

### Run IDs (first live run after force push)
| Workflow | ID | Result |
|---|---|---|
| CI | `26333318285` | (see ci.yml) |
| **Test Gate — 5121/5121 Baseline** | `26333318275` | **❌ FAILED** |

### Test Gate Job Results
| Job | Elapsed | Result |
|---|---|---|
| `Dirty-File Bleed-Through Guard` | 7s | ✅ PASS |
| `research + simulation (275/275)` | 32s | ✅ PASS |
| `onlineValidation (4846/4846)` | 1m54s | **❌ FAIL** |

### Failure Root Cause — `onlineValidation` Job

**Failing test file**: `src/lib/onlineValidation/__tests__/p29d_dropzone_scaffold.test.ts`

**Failing assertions (T01–T11)**:
```
T01: financial-report p29b-dropzone directory exists     → FAIL
T02: news-event p29b-dropzone directory exists           → FAIL
T03: all required financial-report scaffold files exist  → FAIL
T04: all required news-event scaffold files exist        → FAIL
T05–T11: read scaffold files (ENOENT)                   → FAIL
T12: prisma/dev.db SHA unchanged                        → PASS
T13: scoring/snapshot files SHA unchanged               → PASS
```

**Error message**:
```
ENOENT: no such file or directory, open
  '.../data/manual/financial-report/p29b-dropzone/EXPECTED_SCHEMA.json'
ENOENT: no such file or directory, open
  '.../data/manual/news-event/p29b-dropzone/EXPECTED_SCHEMA.json'
```

**Root cause**:
The `data/manual/financial-report/p29b-dropzone/` and `data/manual/news-event/p29b-dropzone/`
directories contain 10 governance scaffold/template files that exist locally as untracked
(`??` in git status) but were NEVER committed to the git repository. CI only has what is
committed, so the directories are absent in the GitHub runner.

**Scaffold files (10 total — governance templates, NOT real data)**:
```
data/manual/financial-report/p29b-dropzone/README.md
data/manual/financial-report/p29b-dropzone/EXPECTED_SCHEMA.json
data/manual/financial-report/p29b-dropzone/EXPECTED_FILENAMES.md
data/manual/financial-report/p29b-dropzone/SOURCE_MANIFEST_TEMPLATE.json
data/manual/financial-report/p29b-dropzone/TEMPLATE_DO_NOT_IMPORT_financial_report_sample.csv
data/manual/news-event/p29b-dropzone/README.md
data/manual/news-event/p29b-dropzone/EXPECTED_SCHEMA.json
data/manual/news-event/p29b-dropzone/EXPECTED_FILENAMES.md
data/manual/news-event/p29b-dropzone/SOURCE_MANIFEST_TEMPLATE.json
data/manual/news-event/p29b-dropzone/TEMPLATE_DO_NOT_IMPORT_news_event_sample.csv
```

These files are:
- Schema contracts (`EXPECTED_SCHEMA.json`)
- Documentation (`README.md`, `EXPECTED_FILENAMES.md`)
- Template manifests with `_template: true`, `_do_not_import: true`, `approvalToken: null`
- Sample CSV templates labeled `TEMPLATE_DO_NOT_IMPORT_*`

**These are governance artifacts, not actual financial data.**

---

## 11. Remaining Risks

| Risk | Severity | Status |
|---|---|---|
| CI gate failing — scaffold files untracked | **CRITICAL** | open — blocks green CI |
| `.gitignore` missing `logs/`, `runtime/`, `data/manual/` actual data | HIGH | open |
| Branch protection rules not configured | HIGH | open |
| `prisma/dev.db` 50–53 MB warnings in git history | MEDIUM | warning-only, no blocker |
| p28 working-tree drift ×3 files | LOW | open |
| P14/P15/P15b output files untracked/uncommitted | LOW | open |

---

## 12. Next 24h Prompt

### Immediate Priority — Fix CI Gate (Session P16)

**Authorization phrase to fix CI**: `YES commit p29b-dropzone scaffold`

Expected actions:
1. Pre-flight: confirm HEAD is `e2e71cc`, branch `main`, remote connected
2. Stage 10 scaffold files:
   ```bash
   git add data/manual/financial-report/p29b-dropzone/
   git add data/manual/news-event/p29b-dropzone/
   ```
3. Governance check: `git diff --cached --name-only` — must show ONLY `data/manual/*/p29b-dropzone/` files
4. Commit:
   ```bash
   git commit -m "P16: commit p29b-dropzone governance scaffold files to fix CI"
   ```
5. Push:
   ```bash
   git push origin main
   ```
6. Observe second GitHub Actions run — target: 5121/5121 PASS in CI
7. Write `outputs/online_validation/p16_scaffold_commit_ci_fix_final_report.md`

**Classification target**: `P16_SCAFFOLD_COMMITTED_CI_GREEN`

### Secondary — Add .gitignore entries

**Authorization phrase**: `YES add gitignore entries`

Entries to add:
```
# Runtime / logs (never commit)
logs/
runtime/agent_orchestrator/pids/
data/manual/**/*.csv
data/manual/**/*.json
!data/manual/**/p29b-dropzone/
!data/manual/**/p29b-dropzone/**
```

Note: The `.gitignore` exclusion pattern (`!`) for `p29b-dropzone/` ensures scaffold
files remain tracked even after adding `data/manual/` glob rules.

### Axis continuation (can run in parallel or after P16)
- `begin axis A` — Axis A v2 (Research Snapshot sourceTrace/PIT)
- `begin axis B` — Axis B v2 (Dry-run Validation extension)

---

## 13. CTO Agent 10-Line Summary

```
P15b COMPLETE: History rewrite executed (git filter-repo --path logs/ --invert-paths).
215 commits rewritten; backend.stdout.log (102–105 MB) removed from all history.
DB SHA a5cf2771... verified UNCHANGED post-rewrite. Local: 5121/5121 PASS.
Force push to origin/main SUCCEEDED (bd2fad7 → e2e71cc, prisma warnings only).
GitHub Actions triggered immediately — Test Gate run 26333318275 started.
RESULT: CI FAILED — onlineValidation job, p29d_dropzone_scaffold.test.ts (T01-T11).
Root cause: data/manual/*/p29b-dropzone/ scaffold files (10 files) never committed.
Files are governance templates (schema contracts, READMEs, DO_NOT_IMPORT CSVs).
Fix is low-risk: commit 10 scaffold files; requires auth phrase YES commit p29b-dropzone scaffold.
P16 is immediate next: commit scaffold → push → observe second CI run → target green gate.
```

---

## Governance Invariants (all verified)

- `entersAlphaScore=false` ✅
- `paperOnly=true` ✅
- `dryRunOnly=true` ✅
- `noActualMetrics=true` ✅
- `executedAt=null` ✅
- `noRealExecution=true` ✅
- DB SHA: `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8` UNCHANGED ✅
- No `prisma/**` changes ✅
- No `data/**` changes ✅ (scaffold files are untracked pending P16 authorization)
