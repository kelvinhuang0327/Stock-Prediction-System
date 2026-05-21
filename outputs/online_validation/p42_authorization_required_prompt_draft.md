# P42 — Paper Simulation Dry-run Lifecycle Design
# Authorization Required Prompt Draft

---

## REQUIRES AUTHORIZATION

Before running this prompt, send this exact phrase as a standalone message:

```
YES design paper simulation dry-run lifecycle for P42
```

---

## Prompt (Use only after authorization is received)

```
# P42 — Paper Simulation Dry-run Lifecycle Design

Date: 2026-05-21 Asia/Taipei
Work dir: /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System
Branch: main | HEAD: 2c0685d

## Prior state

P41_PAPER_SIMULATION_DRY_RUN_DESIGN_READY

- PaperSimulationDryRunContract.ts — types + constants (stub-only)
- PaperSimulationDryRunRunner.ts — runPaperSimulationDryRun (stub, executedAt=null)
- 97/97 tests PASS, regressions P40/P39/P38 all PASS
- executionStatus = EXECUTION_DRY_RUN_AUTHORIZED
- stubResult = DRY_RUN_STUB_ONLY

Authorization received:
YES design paper simulation dry-run lifecycle for P42

## Objective

Design paper simulation dry-run lifecycle state machine (stub-only, no real execution).

New files:
- src/lib/onlineValidation/p42/PaperSimulationDryRunLifecycle.ts
  - Lifecycle states: PENDING | RUNNING | COMPLETE | CANCELLED
  - Transition guards: no invalid state jumps allowed
  - createDryRunLifecycle(input) → PaperSimulationDryRunLifecycleState
  - All states stub-only; no real execution; no real metrics

- src/lib/onlineValidation/p42/PaperSimulationDryRunLog.ts
  - Immutable append-only stub log entries
  - createDryRunLogEntry(event) → PaperSimulationDryRunLogEntry
  - No PnL, ROI, win-rate, alphaScore, recommendation in entries

- src/lib/onlineValidation/__tests__/p42_paper_simulation_dry_run_lifecycle.test.ts
  - 80+ tests, 10+ groups
  - Governance: entersAlphaScore=false, executedAt=null, stubResult=DRY_RUN_STUB_ONLY

## Strict Governance (Unchanged from P40/P41)

- paperOnly = true
- dryRunOnly = true
- entersAlphaScore = false
- noActualMetrics = true
- No real simulation executed
- No PnL / ROI / win-rate produced
- No optimizer / real backtest
- No DB / Prisma / corpus / scoring formula touched
- No investment advice / buy / sell / hold semantics

## Forbidden Outputs

Same 21-item list from P41 PAPER_SIMULATION_DRY_RUN_FORBIDDEN_FIELDS +
P40 PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS (18 items).

## Expected Test Results

- P42: 80+/80+ PASS
- P41 regression: 97/97 PASS
- P40 regression: 118/118 PASS
- P39 regression: 77/77 PASS
- P38 regression: 55/55 PASS

## Commit Message

P42: Add paper simulation dry-run lifecycle design

## Final Classification Target

P42_PAPER_SIMULATION_DRY_RUN_LIFECYCLE_READY
```

---

## Governance Reminder

This prompt STILL does NOT authorize:
- Real simulation execution
- ROI / win-rate / PnL / return production
- Optimizer / real backtest execution
- alphaScore / scoring formula modification
- DB / corpus / schema changes
- Investment advice or buy/sell/hold signals

P42 lifecycle is still stub-only. Only lifecycle state machine design (PENDING/RUNNING/COMPLETE/CANCELLED) and immutable log entry design — no real execution semantics.
