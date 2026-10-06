/**
 * P48 — Paper Simulation Dry-run Result Artifact Golden Fixture Schema
 *
 * Defines the TypeScript types for the P48 golden fixture — the
 * deterministic, schema-level representation of the expected
 * PaperSimulationDryRunResultArtifactResult (P47) output.
 *
 * A golden fixture captures:
 *   - All governance flag invariants (dryRunOnly, paperOnly, …)
 *   - All expected step counts at every pipeline layer
 *   - ID prefix patterns for every upstream phase
 *   - The full phase chain (P44 → P45 → P46 → P47)
 *   - The list of forbidden fields that must never appear
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

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

/** All 15 governance flags inherited from the P39–P47 contract chain. */
export interface P48GoldenFixtureGovernanceFlags {
  readonly dryRunOnly: true;
  readonly paperOnly: true;
  readonly noActualMetrics: true;
  readonly entersAlphaScore: false;
  readonly noAlphaScore: true;
  readonly noRecommendation: true;
  readonly noPnL: true;
  readonly noROI: true;
  readonly noWinRate: true;
  readonly noReturnPct: true;
  readonly noOptimizer: true;
  readonly noRealBacktest: true;
  readonly noInvestmentAdvice: true;
  readonly noBuySellActionSemantics: true;
  readonly noRealExecution: true;
}

/** Expected step counts at the four pipeline layers. */
export interface P48GoldenFixtureStepCounts {
  /** P47: 2 materialization steps (run P46 + build P46 report) */
  readonly materializationStepsCompleted: 2;
  readonly materializationStepsTotal: 2;
  /** P46: 2 full-pipeline rehearsal steps (run P45 + build P45 report) */
  readonly fullPipelineRehearsalStepsCompleted: 2;
  /** P45: 2 rehearsal steps (run P44 + build P44 report) */
  readonly rehearsalStepsCompleted: 2;
  /** P42: 5 pipeline steps (CREATED→STARTING→RUNNING→COMPLETING→COMPLETE) */
  readonly pipelineStepsCompleted: 5;
}

/** RegExp prefix patterns that every upstream ID must satisfy. */
export interface P48GoldenFixtureIdPatterns {
  readonly resultArtifactId: RegExp;
  readonly fullPipelineRehearsalId: RegExp;
  readonly rehearsalId: RegExp;
  readonly integrationId: RegExp;
  readonly runnerId: RegExp;
  readonly lifecycleId: RegExp;
}

/** Expected phase labels at each layer of the upstream chain. */
export interface P48GoldenFixturePhaseChain {
  readonly resultArtifactPhase: "P47";
  readonly fullPipelineRehearsalPhase: "P46";
  readonly rehearsalPhase: "P45";
  readonly integrationPhase: "P44";
}

// ─── Root golden fixture type ─────────────────────────────────────────────────

/** The complete P48 golden fixture schema. */
export interface P48GoldenFixture {
  // Identity
  readonly fixtureId: string;
  readonly phase: "P48";
  readonly version: string;
  readonly description: string;

  // Sub-schemas
  readonly governanceFlags: P48GoldenFixtureGovernanceFlags;
  readonly stepCounts: P48GoldenFixtureStepCounts;
  readonly idPatterns: P48GoldenFixtureIdPatterns;
  readonly phaseChain: P48GoldenFixturePhaseChain;

  // Null-execution sentinel
  readonly executedAt: null;
  readonly stubResult: "DRY_RUN_STUB_ONLY";

  // Expected execution status from the P47 result artifact
  readonly executionStatus: "EXECUTION_LIFECYCLE_RUNNER_RESULT_ARTIFACT_MATERIALIZATION_READY";

  // Fields that must NOT appear on any conforming artifact
  readonly forbiddenFields: readonly string[];

  // Fixture meta-flags
  readonly isGoldenFixture: true;
  readonly dryRunOnly: true;
  readonly paperOnly: true;
  readonly noRealExecution: true;
}
