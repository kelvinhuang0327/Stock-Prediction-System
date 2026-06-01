# P137 CI Lint Scope Alignment & Remaining Test-Node Attribution

## 1) Repo / Branch / Start HEAD / End HEAD
- Repo: /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System
- Branch: main
- Start HEAD: a66e424
- End HEAD: a66e424 (before commit/push in this execution stage)

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
- Pre-change latest CI still had concrete test-node failures (above).
- Post-push attribution will be updated after new CI run is available.

## 10) Files Changed List
- `.github/workflows/ci.yml`
- `outputs/online_validation/p137_ci_lint_scope_alignment.json`
- `outputs/online_validation/p137_ci_lint_scope_alignment_report.md`

## 11) Staged / Commit / Push Status
- Pending in this stage; will be updated after commit/push.

## 12) Latest CI Result After Push
- Pending in this stage; will be updated after push-triggered CI run is available.

## 13) Whether P2 Browser Review Is Allowed
- Not allowed unless latest CI is green or explicit CEO/CTO waiver exists.

## 14) Final Classification
- Provisional (before post-push CI confirmation): `P137_CI_LINT_SCOPE_ALIGNED_CI_STILL_RED_ACTIVE_LINT_DEBT`

---

## Required Completion Check
1. 是否真的完成: pending final CI-after-push observation
2. 測試結果 PASS / FAIL / NOT RUN: currently PASS for required local regression commands
3. 仍卡住的唯一問題: active source/test lint debt and unresolved CI test-node failures on latest pre-change run
4. 修改檔案清單: see section 10
5. staged / commit / push 狀態: pending
6. CI 結果: pending post-push run
7. 是否允許進入下一輪 P2 browser review: 否
8. Final Classification: pending final CI-after-push confirmation
