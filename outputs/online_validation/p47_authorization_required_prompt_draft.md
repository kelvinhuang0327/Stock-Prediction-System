# P47 — Paper Simulation Dry-run Result Artifact Materialization
## Authorization Required Prompt Draft

**Date:** 2026-05-21  
**Upstream:** P46 commit `a5e475f` — `P46_PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_READY`

---

## Required Authorization

```
YES design paper simulation dry-run result artifact materialization for P47
```

This phrase must appear as a standalone, unambiguous authorization statement before any P47 implementation begins.

---

## What P47 Implements

**Paper Simulation Dry-run Result Artifact Materialization** — transforms the P46 full-pipeline rehearsal result into a stable, auditable, regression-safe result artifact contract.

### Core Design

**2 new source files:**

1. `src/lib/onlineValidation/p47/PaperSimulationDryRunResultArtifact.ts`
   - `P47_EXECUTION_STATUS = "EXECUTION_LIFECYCLE_RUNNER_RESULT_ARTIFACT_MATERIALIZATION_READY"`
   - `PAPER_SIMULATION_DRY_RUN_RESULT_ARTIFACT_VERSION`
   - `P47_RESULT_ARTIFACT_MATERIALIZATION_STEPS_TOTAL = 2`
   - `materializeDryRunResultArtifact(input)` → `PaperSimulationDryRunResultArtifactResult`
   - Orchestrates:
     - Step 1: `runDryRunFullPipelineRehearsal` (P46)
     - Step 2: `buildFullPipelineRehearsalReport` (P46)

2. `src/lib/onlineValidation/p47/PaperSimulationDryRunResultArtifactReport.ts`
   - `PAPER_SIMULATION_DRY_RUN_RESULT_ARTIFACT_REPORT_VERSION`
   - `buildResultArtifactReport(result, reportGeneratedAt)` → `PaperSimulationDryRunResultArtifactReport`
   - `isResultArtifactReport: true`, `phase: "P47"`

**1 test file:**

- `src/lib/onlineValidation/__tests__/p47_paper_simulation_dry_run_result_artifact_materialization.test.ts`
- 98 tests / 11 groups (same structure as P46)

### ID Scheme

```
resultArtifactId = p47-result-artifact-${fullPipelineRehearsalResult.runId}-${materializationStartedAt}
resultArtifactReportId = p47-result-artifact-report-${resultArtifactId}-${resultArtifactReportGeneratedAt}
```

### Input adds over P46

```typescript
interface PaperSimulationDryRunResultArtifactInput extends P46Input {
  readonly fullPipelineRehearsalReportGeneratedAt: string;
  readonly materializationStartedAt: string;
  readonly materializationCompletedAt: string;
}
```

---

## Governance Invariants (ALL must hold at every layer)

| Flag | Value |
|---|---|
| `dryRunOnly` | `true` |
| `paperOnly` | `true` |
| `noActualMetrics` | `true` |
| `entersAlphaScore` | `false` |
| `noAlphaScore` | `true` |
| `noPnL` | `true` |
| `noROI` | `true` |
| `noWinRate` | `true` |
| `noRealExecution` | `true` |
| `executedAt` | `null` |
| `stubResult` | `"DRY_RUN_STUB_ONLY"` |
| `isResultArtifactReport` | `true` |

**Still no actual simulation run.**  
**Still no ROI / win-rate / PnL.**  
**Still no optimizer / real backtest.**  
**Only result artifact contract / dry-run materialization after authorization.**

---

## Expected Artifacts After P47

```
src/lib/onlineValidation/p47/PaperSimulationDryRunResultArtifact.ts
src/lib/onlineValidation/p47/PaperSimulationDryRunResultArtifactReport.ts
src/lib/onlineValidation/__tests__/p47_paper_simulation_dry_run_result_artifact_materialization.test.ts
outputs/online_validation/p47_dry_run_result_artifact_materialization_plan.json
outputs/online_validation/p47_test_baseline.json
```

**Test target:** 98/98 P47 + 837/837 regression (P38–P46)  
**Commit message:** `P47: Add paper simulation dry-run result artifact materialization`  
**Final classification:** `P47_PAPER_SIMULATION_DRY_RUN_RESULT_ARTIFACT_MATERIALIZATION_READY`

---

## What P47 Does NOT Do

- Does NOT execute real simulation
- Does NOT produce PnL / ROI / win-rate / expected return
- Does NOT run optimizer / real backtest
- Does NOT modify alphaScore / scoring formula
- Does NOT modify DB / corpus / schema / syncService
- Does NOT generate investment advice
- Does NOT generate buy/sell/hold/action semantics
