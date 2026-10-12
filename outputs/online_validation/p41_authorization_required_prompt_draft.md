# P41 — Authorization Required Prompt Draft

> **Status:** DRAFT — requires explicit user authorization before execution  
> **Required authorization:** `YES design paper simulation execution dry-run for P41`  
> **Do NOT execute this prompt until authorization is received.**

---

```
============================================================
任務名稱
============================================================

P41 — Paper Simulation Execution Dry-Run Design

日期：
[DATE] Asia/Taipei

工作目錄：
/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System

============================================================
Authorization
============================================================

Authorization received:
YES design paper simulation execution dry-run for P41

============================================================
前置狀態
============================================================

P40 已完成：

- Commit: 68dd283
- Final Classification: P40_PAPER_SIMULATION_FRAMEWORK_DESIGN_READY
- Framework status: FRAMEWORK_READY
- Execution status: EXECUTION_BLOCKED_PENDING_AUTH
  → P41 will upgrade to: EXECUTION_DRY_RUN_AUTHORIZED

Eligible sources (from P39/P40):
  - MonthlyRevenue
  - Quote
  - Regime

Blocked sources:
  - NewsEvent
  - FinancialReport
  - Chip

P40 tests: 118/118 PASS
P39 regression: 77/77 PASS
P38 regression: 55/55 PASS

============================================================
本輪目標
============================================================

1. Design paper simulation execution dry-run interface (no real metrics)
2. Create PaperSimulationDryRunContract.ts — dry-run input/output types
3. Create PaperSimulationDryRunRunner.ts — stub runner, skeleton only
4. Update framework status to EXECUTION_DRY_RUN_AUTHORIZED in types
5. Tests proving: no actual PnL, no alpha score, no recommendation
6. Commit: "P41: Add paper simulation execution dry-run design"

============================================================
Governance Invariants (carried from P40)
============================================================

- paperOnly=true
- dryRunOnly=true
- entersAlphaScore=false
- noExecution=true (real simulation still forbidden)
- noInvestmentAdvice=true
- noBuySellActionSemantics=true
- notSimulationExecution=true (runner is a stub, not a real executor)
- notOptimizer=true
- notRealBacktest=true

============================================================
Strictly Forbidden
============================================================

- Actual PnL computation
- ROI / win-rate / return metrics
- Alpha score generation
- Real backtest execution
- Optimizer execution
- Recommendation / buy / sell / hold
- DB writes
- Corpus modification
- Scoring formula changes
- syncService modification

============================================================
Phase 0 — Governance Pre-flight
============================================================

Run:

  git rev-parse --show-toplevel
  git branch --show-current
  git status --short
  git rev-parse HEAD
  git log --oneline -5
  cat 00-Plan/roadmap/branch_policy.md

STOP if:
  - Not canonical repo
  - Not main branch
  - Detached HEAD
  - Staged files
  - Unrelated non-runtime dirty files

Output:
  - outputs/online_validation/p41_preflight_status.json
  - outputs/online_validation/p41_preflight_status.md

============================================================
Phase 1 — Read P40 Foundation
============================================================

Read and verify:
  - src/lib/onlineValidation/p40/PaperSimulationFrameworkTypes.ts
  - src/lib/onlineValidation/p40/PaperSimulationFrameworkBoundary.ts
  - src/lib/onlineValidation/p39/PaperSimulationInputContract.ts
  - outputs/online_validation/p40_paper_simulation_framework_plan.json

Output:
  - outputs/online_validation/p41_input_artifact_review.json
  - outputs/online_validation/p41_input_artifact_review.md

============================================================
Phase 2 — PaperSimulationDryRunContract.ts
============================================================

Create:
  src/lib/onlineValidation/p41/PaperSimulationDryRunContract.ts

Contents:
  - PaperSimulationDryRunMode: "stub-only" | "design-only"
  - PaperSimulationDryRunInput: accepts PaperSimulationFrameworkPlan
  - PaperSimulationDryRunResult:
    - runId: string
    - mode: PaperSimulationDryRunMode
    - dryRunOnly: true
    - paperOnly: true
    - noActualMetrics: true
    - noAlphaScore: true
    - noRecommendation: true
    - noPnL: true
    - noROI: true
    - noWinRate: true
    - executedAt: null  (no real execution timestamp)
    - stubResult: "DRY_RUN_STUB_ONLY"
    - disclaimer: string
  - PAPER_SIMULATION_DRY_RUN_VERSION constant
  - PAPER_SIMULATION_DRY_RUN_DISCLAIMER constant
  - P41_EXECUTION_STATUS = "EXECUTION_DRY_RUN_AUTHORIZED"

============================================================
Phase 3 — PaperSimulationDryRunRunner.ts
============================================================

Create:
  src/lib/onlineValidation/p41/PaperSimulationDryRunRunner.ts

Contents:
  - runPaperSimulationDryRun(input): PaperSimulationDryRunResult
    - Pure function, no side effects
    - No DB access
    - Returns stub result only
    - Throws if input.plan.noExecution !== true
    - Throws if input.plan.dryRunOnly !== true
  - validateDryRunInput(input): DryRunValidationResult
  - assertNoDryRunExecution(result): void
    - Throws if result contains pnl/roi/winRate/recommendation/alphaScore fields

No real simulation logic. No metrics. No formulas.

============================================================
Phase 4 — Tests
============================================================

Create:
  src/lib/onlineValidation/__tests__/p41_paper_simulation_dry_run_design.test.ts

Minimum 80 tests across:
  - Group 1: DryRunResult governance flags (dryRunOnly, paperOnly, noActualMetrics, etc.)
  - Group 2: runPaperSimulationDryRun accepts P40 framework plan
  - Group 3: runPaperSimulationDryRun rejects plan with noExecution=false
  - Group 4: runPaperSimulationDryRun rejects plan with dryRunOnly=false
  - Group 5: result.stubResult = "DRY_RUN_STUB_ONLY"
  - Group 6: assertNoDryRunExecution throws for pnl/roi/winRate/recommendation/alphaScore
  - Group 7: validateDryRunInput validates required fields
  - Group 8: version and disclaimer constants
  - Group 9: P40 regression — 118/118 still PASS
  - Group 10: isolation — pure function, no side effects, no exports of executors

============================================================
Phase 5 — Dry-Run Plan Artifact
============================================================

Output:
  - outputs/online_validation/p41_dry_run_design_plan.json
  - outputs/online_validation/p41_dry_run_design_plan.md

Contents:
  - frameworkStatus: EXECUTION_DRY_RUN_AUTHORIZED
  - dryRunMode: stub-only
  - noActualMetrics: true
  - eligibleSources
  - blockedSources
  - governanceFlags
  - forbiddenOutputs
  - allowedNextStep: "P42 requires further authorization"

============================================================
Phase 6 — Validation
============================================================

Run all tests:
  npx jest --testPathPattern="p41|p40|p39|p38" --no-coverage

Output:
  - outputs/online_validation/p41_test_baseline.json
  - outputs/online_validation/p41_test_baseline.md
  - outputs/online_validation/p41_forbidden_claims_scan.json
  - outputs/online_validation/p41_forbidden_claims_scan.md

============================================================
Phase 7 — Roadmap + CTO-Analysis + Commit
============================================================

1. Append P41 section to 00-Plan/roadmap/roadmap.md
2. Append P41 section to 00-Plan/roadmap/CTO-Analysis.md
3. Create p41_final_report.md
4. Stage only P41 files:
   git add src/lib/onlineValidation/p41/
   git add src/lib/onlineValidation/__tests__/p41_paper_simulation_dry_run_design.test.ts
   git add outputs/online_validation/p41_*.json
   git add outputs/online_validation/p41_*.md
   git add 00-Plan/roadmap/roadmap.md
   git add 00-Plan/roadmap/CTO-Analysis.md
5. Commit:
   git commit -m "P41: Add paper simulation execution dry-run design"

DO NOT STAGE: prisma/dev.db, runtime/, logs/

============================================================
Final Classification
============================================================

P41_PAPER_SIMULATION_DRY_RUN_DESIGN_READY

============================================================
Next 24h Prompt
============================================================

P42 requires further authorization (to be defined after P41 complete).
```
