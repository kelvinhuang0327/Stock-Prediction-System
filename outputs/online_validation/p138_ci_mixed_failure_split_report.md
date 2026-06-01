# P138 - CI Mixed Failure Split

## Scope
- Objective: test-node attribution first, then active lint debt triage.
- Baseline commit: `7e312dfa423a67b778af6cbd858833c9158654c5`.
- Policy: no broad lint repair; only minimal test-only change if safely justified.

## CI Status Snapshot
- Latest completed CI run: `26732356222` (failure).
- URL: https://github.com/kelvinhuang0327/Stock-Prediction-System/actions/runs/26732356222
- Failed jobs: `lint`, `test-node`.
- Passed jobs: `test-python`.
- Skipped jobs: `build`, `e2e`.

## P137 Artifact Integrity Check
- Tracked and clean:
  - `outputs/online_validation/p137_ci_lint_scope_alignment.json`
  - `outputs/online_validation/p137_ci_lint_scope_alignment_report.md`
- No unexpected mutation observed for these artifacts.

## Test-Node Attribution (Priority A)
- Unique failing suites in latest run: 16.
- Confirmed failure clusters:
  1. Prisma model undefined in cleanup paths (same family as P134)
     - Signature: `TypeError: Cannot read properties of undefined (reading 'deleteMany')`
     - Representative suites:
       - `src/lib/jobs/__tests__/AutonomousAlertService.test.ts`
       - `src/lib/jobs/__tests__/JobAlertHistoryService.test.ts`
       - `src/lib/jobs/__tests__/RecommendationHistoryService.test.ts`
       - `src/lib/jobs/__tests__/JobAlertService.test.ts`
       - `src/lib/jobs/__tests__/RecommendationLifecycleService.test.ts`
       - `src/lib/jobs/__tests__/RecommendationTrendService.test.ts`
  2. Autonomous registry entry mismatch
     - Signature: `expect(AUTONOMOUS_JOB_REGISTRY[JOB_NAME]).toBeDefined()` received undefined
     - Representative suite:
       - `src/lib/jobs/__tests__/autonomousJobRegistry.twQ1FinancialIngestCheck.test.ts`
  3. UI expectation drift (text assertions no longer matching rendered content)
     - Signature: `TestingLibraryElementError: Unable to find an element with the text ...`
     - Representative suites:
       - `src/app/candidates/__tests__/page.test.tsx`
       - `src/app/stocks/[symbol]/__tests__/page.tab-sync.test.tsx`
       - `src/components/watchlist/__tests__/WatchlistTable.fundamental.test.tsx`
  4. Orchestrator audit smoke expectations not met
     - Signature: expected appended audit/usage lines not present (`length 0`, blocked event undefined)
     - Representative suite:
       - `src/lib/agent-orchestrator/__tests__/llmAuditSmoke.integration.test.ts`
  5. Notification delivery expectation mismatch
     - Signature: expected one channel result for autonomous-only alerts, received zero
     - Representative suite:
       - `src/lib/__tests__/NotificationDeliveryEngine.test.ts`

## Local Reproduction Summary
- Executed with CI-like env: `DATABASE_URL=file:./dev.db`.
- Reproduced locally:
  - Prisma undefined `deleteMany` failures across jobs suites.
  - Registry undefined in twQ1 check suite.
  - UI text assertion mismatches in candidates/stocks suites.
  - LLM audit smoke missing-line assertions.
  - Notification autonomous-only channel count mismatch.
- Observation:
  - `src/lib/autonomous/__tests__/AutonomousDataLayer.test.ts` passed in focused local execution while CI marks it failed within full run, indicating potential suite-order/shared-state coupling.

## Active Lint Debt Triage (Priority B, no broad fix)
- Command: `npx eslint src tests --ext .js,.jsx,.ts,.tsx`
- Totals: `697` (`368` errors, `329` warnings)
- Top rules:
  - `@typescript-eslint/no-unused-vars`: 311
  - `@typescript-eslint/no-explicit-any`: 271
  - `@typescript-eslint/no-require-imports`: 67
- Top files:
  - `src/components/plan/AssetDoublingPlan.tsx`: 18
  - `src/lib/stockService.ts`: 17
  - `src/lib/onlineValidation/__tests__/p18monthly_revenue_fixture_db_utils.test.ts`: 16
  - `src/lib/onlineValidation/__tests__/p26f_monthly_revenue_source_mapper_utils.test.ts`: 15
  - `src/lib/onlineValidation/__tests__/p13monthly_revenue_pit_utils.test.ts`: 14

## Repair Decision
- Decision: no code change in P138 (attribution-only closeout).
- Why no minimal test-only patch now:
  - Failure surface is multi-cluster and cross-domain, not a single isolated test harness break.
  - Several failures are tied to runtime behavior contracts (registry/audit/UI semantics), where test-only edits risk masking regressions.
  - Safe resolution likely requires staged work beyond P138 boundary (Prisma setup/schema fixtures, autonomous registry behavior verification, orchestrator audit side effects, and UI expectation contract updates).

## Final Classification
- `P138_TEST_NODE_ATTRIBUTED_FIRST_ACTIVE_LINT_DEBT_TRIAGED_NO_SAFE_TEST_ONLY_REPAIR`
