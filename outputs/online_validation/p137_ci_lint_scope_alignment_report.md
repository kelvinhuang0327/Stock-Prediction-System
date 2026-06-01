# P137 CI Lint Scope Alignment & Remaining Test-Node Attribution

## 1) Repo / Branch / Start HEAD / End HEAD
- Repo: /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System
- Branch: main
- Start HEAD: a66e424
- End HEAD: 0a23f7f

## 2) Phase 0 Actual-State Verification
- `pwd` and `git rev-parse --show-toplevel` point to canonical repo.
- Branch is `main`.
- HEAD is `a66e424`.
- Unrelated dirty/untracked files exist broadly; no non-whitelist files will be staged.

## 3) P135/P136 Artifacts Tracked/Untracked Status
- Carryover detected (all present, all untracked):
  - `outputs/online_validation/p135_global_lint_debt_baseline.json`
  - `outputs/online_validation/p135_global_lint_debt_baseline_report.md`
  - `outputs/online_validation/p136_scoped_lint_surface_baseline.json`
  - `outputs/online_validation/p136_scoped_lint_surface_baseline_report.md`
- P136 content consistency check: matches expected classification and scoped numbers in prompt.

## 4) Latest CI Run Status and Failing Steps Before Change
- Latest `CI` workflow on `main`: run `26731410459` (completed, failure).
- Failing steps:
  - `lint` -> `Run ESLint`
  - `test-node` -> `Run Jest tests`
- Concrete latest test-node failure attribution lines include:
  - `src/lib/jobs/__tests__/JobAlertService.test.ts:8` (`prisma.jobAlert.deleteMany` undefined)
  - `src/lib/jobs/__tests__/RecommendationLifecycleService.test.ts:24` (`prisma.recommendationHistory.deleteMany` undefined)
  - `src/lib/jobs/__tests__/autonomousJobRegistry.twQ1FinancialIngestCheck.test.ts:17` (registry entry undefined)

## 5) ci.yml Lint Command Before/After
- File: `.github/workflows/ci.yml`
- Before: `npm run lint`
- After: `npx eslint src tests --ext .js,.jsx,.ts,.tsx`

## 6) Why .claude/worktrees Should Not Be in CI Lint Gate
- P136 scoped evidence showed `.claude/worktrees` contributed 4265 diagnostics alone.
- That surface is non-target worktree/archive-like and not active product source path.
- CI quality gate should reflect active source/test health, not historical/worktree noise.

## 7) Scoped Lint Local Result After Command Alignment
- Command executed locally: `npx eslint src tests --ext .js,.jsx,.ts,.tsx`
- Result: **FAIL**
- Totals: **697 problems** (**368 errors**, **329 warnings**)
- Interpretation: scope alignment succeeded; active source/test lint debt still exists (not repaired in this task by design).

## 8) P133/P134 Regression Result
- `npx tsc --noEmit 2>&1 | grep -i "product-surface\|StrategyResearchStaticView" || true`
  - PASS (no output)
- `npx jest src/lib/research/__tests__/p108_stock_strategy_research_static_fixture.test.ts --no-coverage`
  - PASS
- `npx jest src/lib/research/__tests__/p114_strategy_research_page_static_render.test.tsx --no-coverage`
  - PASS
- `npx jest src/lib/research/__tests__ --no-coverage`
  - PASS
- `npx jest src/lib/jobs/__tests__/AutonomousAlertPolicyStore.test.ts --no-coverage`
  - PASS
- `DATABASE_URL=file:./dev.db npx jest src/lib/autonomous/__tests__/AutonomousDataLayer.test.ts --no-coverage`
  - PASS

## 9) Whether Test-Node Still Fails and Current Concrete Attribution
- Yes. Post-push CI run still fails in `test-node`.
- Latest concrete attribution after push (run `26732278171`):
  - `src/lib/jobs/__tests__/JobAlertService.test.ts:8` (`prisma.jobAlert.deleteMany` undefined)
  - `src/lib/jobs/__tests__/RecommendationLifecycleService.test.ts:24` (`prisma.recommendationHistory.deleteMany` undefined)
  - `src/lib/jobs/__tests__/autonomousJobRegistry.twQ1FinancialIngestCheck.test.ts:17` (registry entry undefined)

## 10) Files Changed List
- `.github/workflows/ci.yml`
- `outputs/online_validation/p137_ci_lint_scope_alignment.json`
- `outputs/online_validation/p137_ci_lint_scope_alignment_report.md`

## 11) Staged / Commit / Push Status
- Staged: whitelist-only files
- Commit 1: `331c283` (`ci: align lint scope to active source/tests and record p137 attribution`)
- Commit 2: `0a23f7f` (`docs: finalize p137 post-push CI attribution`)
- Push: completed to `origin/main`

## 12) Latest CI Result After Push
- Latest CI run after final push: `26732339157`
- Status: `in_progress`
- Latest completed comparable run: `26732278171` (`failure`)
- Failing steps in latest completed run:
  - `lint` -> `Run ESLint`
  - `test-node` -> `Run Jest tests`

## 13) Whether P2 Browser Review Is Allowed
- Not allowed unless latest CI is green or explicit CEO/CTO waiver exists.

## 14) Final Classification
- `P137_CI_LINT_SCOPE_ALIGNED_CI_STILL_RED_MIXED_ATTRIBUTION`

---

## Required Completion Check
1. 是否真的完成: 是
2. 測試結果 PASS / FAIL / NOT RUN: PASS（required local regression suite）
3. 仍卡住的唯一問題: CI 仍同時被 active source/test lint debt 與 test-node 失敗阻塞
4. 修改檔案清單: see section 10
5. staged / commit / push 狀態: done / done / done
6. CI 結果: latest run `26732339157` in progress; latest completed run `26732278171` failed（lint + test-node）
7. 是否允許進入下一輪 P2 browser review: 否
8. Final Classification: `P137_CI_LINT_SCOPE_ALIGNED_CI_STILL_RED_MIXED_ATTRIBUTION`
