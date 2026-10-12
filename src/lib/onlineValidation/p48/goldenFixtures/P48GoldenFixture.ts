/**
 * P48 — Paper Simulation Dry-run Result Artifact Golden Fixture
 *
 * The concrete, frozen P48GoldenFixture instance — the canonical
 * reference object used by tests and validators to assert that
 * any PaperSimulationDryRunResultArtifactResult (P47) conforms to
 * the expected dry-run result artifact contract.
 *
 * Design principles:
 *   - Fully deterministic — no Date.now(), no Math.random()
 *   - Immutable — every nested object is Object.freeze()'d
 *   - Not a snapshot — captures invariant patterns, not a specific run
 *   - No PnL / ROI / win-rate / real execution of any kind
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - noActualMetrics = true
 * - entersAlphaScore = false
 * - noRealExecution = true
 * - executedAt = null
 * - isGoldenFixture = true
 *
 * Authorization:
 *   YES design paper simulation dry-run result artifact golden fixture for P48
 */

import type { P48GoldenFixture } from "./P48GoldenFixtureSchema";

// ─── Constants ────────────────────────────────────────────────────────────────

export const P48_GOLDEN_FIXTURE_VERSION =
  "p48-paper-simulation-dry-run-result-artifact-golden-fixture-v1" as const;

export const P48_EXECUTION_STATUS =
  "P48_GOLDEN_FIXTURE_DESIGN_READY" as const;

// ─── Concrete golden fixture ──────────────────────────────────────────────────

export const P48_GOLDEN_FIXTURE: P48GoldenFixture = Object.freeze({
  fixtureId:
    "p48-golden-fixture-paper-simulation-dry-run-result-artifact-v1",
  phase: "P48" as const,
  version: P48_GOLDEN_FIXTURE_VERSION,
  description:
    "Golden fixture for P47 paper simulation dry-run result artifact — " +
    "defines expected governance flags, step counts, ID prefix patterns, " +
    "and forbidden fields. Deterministic, immutable, no real execution.",

  governanceFlags: Object.freeze({
    dryRunOnly: true as const,
    paperOnly: true as const,
    noActualMetrics: true as const,
    entersAlphaScore: false as const,
    noAlphaScore: true as const,
    noRecommendation: true as const,
    noPnL: true as const,
    noROI: true as const,
    noWinRate: true as const,
    noReturnPct: true as const,
    noOptimizer: true as const,
    noRealBacktest: true as const,
    noInvestmentAdvice: true as const,
    noBuySellActionSemantics: true as const,
    noRealExecution: true as const,
  }),

  stepCounts: Object.freeze({
    materializationStepsCompleted: 2 as const,
    materializationStepsTotal: 2 as const,
    fullPipelineRehearsalStepsCompleted: 2 as const,
    rehearsalStepsCompleted: 2 as const,
    pipelineStepsCompleted: 5 as const,
  }),

  idPatterns: Object.freeze({
    resultArtifactId: /^p47-result-artifact-/,
    fullPipelineRehearsalId: /^p46-full-pipeline-rehearsal-/,
    rehearsalId: /^p45-rehearsal-/,
    integrationId: /^p44-integration-/,
    runnerId: /^p43-runner-/,
    lifecycleId: /^p42-lifecycle-/,
  }),

  phaseChain: Object.freeze({
    resultArtifactPhase: "P47" as const,
    fullPipelineRehearsalPhase: "P46" as const,
    rehearsalPhase: "P45" as const,
    integrationPhase: "P44" as const,
  }),

  executedAt: null,
  stubResult: "DRY_RUN_STUB_ONLY" as const,
  executionStatus:
    "EXECUTION_LIFECYCLE_RUNNER_RESULT_ARTIFACT_MATERIALIZATION_READY" as const,

  forbiddenFields: Object.freeze([
    "pnl",
    "roi",
    "ROI",
    "winRate",
    "alphaScore",
    "recommendation",
    "prediction",
    "backtestResult",
    "executeSimulation",
    "computePnL",
    "computeROI",
    "runSimulation",
    "computeWinRate",
    "generateRecommendation",
    "runBacktest",
    "runOptimizer",
  ] as const),

  isGoldenFixture: true as const,
  dryRunOnly: true as const,
  paperOnly: true as const,
  noRealExecution: true as const,
});
