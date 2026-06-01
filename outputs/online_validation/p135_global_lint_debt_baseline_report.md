# P135 Global Lint Debt Baseline & Safe Repair Scope Gate

## Classification
- `P135_GLOBAL_LINT_BASELINE_CREATED_NO_CODE_CHANGE`

## Baseline Context
- Baseline commit: `a66e424`
- Baseline CI run: `26731410459`
- CI URL: https://github.com/kelvinhuang0327/Stock-Prediction-System/actions/runs/26731410459
- Lint capture command: `npm run lint > /tmp/p135_lint_full.txt 2>&1 || true`

## Concrete CI Attribution Snapshot (a66e424)
- `lint` job failed at step `Run ESLint`.
- `test-node` job failed at step `Run Jest tests`.
- Representative test-node failures from run logs:
  - `src/lib/jobs/__tests__/RecommendationLifecycleService.test.ts:24` (`prisma.recommendationHistory.deleteMany` undefined)
  - `src/lib/jobs/__tests__/autonomousJobRegistry.twQ1FinancialIngestCheck.test.ts:17` (registry entry undefined)
  - `src/lib/autonomous/__tests__/AutonomousDataLayer.test.ts:5` (PrismaClientKnownRequestError, invalid characters)

## Lint Debt Totals
- Total diagnostics: **5686**
- Errors: **3712**
- Warnings: **1974**
- Potentially auto-fixable via `--fix`: **53** (28 errors + 25 warnings)

## Grouping Summary

### By Rule (Top)
- `@typescript-eslint/no-require-imports`: 2428
- `@typescript-eslint/no-unused-vars`: 1741
- `@typescript-eslint/no-explicit-any`: 1160
- `@typescript-eslint/no-unused-expressions`: 176
- `(none)` parser/other diagnostics: 85

### By Directory (Top)
- `.claude/worktrees`: 4265
- `src/lib`: 534
- `src/components`: 102
- `src/app`: 43
- `tests/agent-orchestrator`: 15

### By File Type
- `.js`: 2701
- `.ts`: 2472
- `.tsx`: 509
- `.mjs`: 4

### By Risk Class
- `unsafe_semantic`: 3616
- `owner_decision`: 2042
- `safe_auto_fix`: 28

## Safe Tranche Gate (Strict)
Gate constraints for this phase:
- Max files: 10
- Max diagnostics: 30
- Scope: test-only/report-only and mechanical-only

Result:
- **No qualifying tranche identified** under constraints.
- Reason: dominant debt is semantic (`no-require-imports`, `no-explicit-any`) or owner-decision class; safe mechanical-only set is too small and non-representative for a reliable first tranche in this pass.

## Decision
- This phase intentionally performs **no code changes**.
- Deliverables produced:
  - `outputs/online_validation/p135_global_lint_debt_baseline.json`
  - `outputs/online_validation/p135_global_lint_debt_baseline_report.md`

## Browser Review Status
- P2 browser review remains blocked because baseline CI is not green on `a66e424`.
