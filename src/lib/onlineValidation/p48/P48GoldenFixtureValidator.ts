/**
 * P48 — Paper Simulation Dry-run Result Artifact Golden Fixture Validator
 *
 * Validates that a PaperSimulationDryRunResultArtifactResult (P47)
 * conforms to the P48 golden fixture. Checks governance flags, step counts,
 * ID prefix patterns, phase chain, and absence of forbidden fields.
 *
 * Returns a frozen P48GoldenFixtureValidationResult — never throws.
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - noActualMetrics = true
 * - entersAlphaScore = false
 * - noRealExecution = true
 * - executedAt = null
 * - isGoldenFixtureValidation = true
 *
 * Authorization:
 *   YES design paper simulation dry-run result artifact golden fixture for P48
 */

import type { PaperSimulationDryRunResultArtifactResult } from "../p47/PaperSimulationDryRunResultArtifact";
import { P48_GOLDEN_FIXTURE } from "./goldenFixtures/P48GoldenFixture";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface P48GoldenFixtureValidationResult {
  readonly valid: boolean;
  readonly violations: readonly string[];
  readonly checkedFields: readonly string[];
  readonly fixtureId: string;
  readonly phase: "P48";
  readonly dryRunOnly: true;
  readonly paperOnly: true;
  readonly noRealExecution: true;
  readonly isGoldenFixtureValidation: true;
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validate a P47 result artifact against the P48 golden fixture.
 *
 * Never throws — all violations are collected and returned in the result.
 */
export function validateAgainstGoldenFixture(
  artifact: PaperSimulationDryRunResultArtifactResult
): P48GoldenFixtureValidationResult {
  const violations: string[] = [];
  const checked: string[] = [];

  const fixture = P48_GOLDEN_FIXTURE;

  // ── Governance flags ──────────────────────────────────────────────────────

  const gf = fixture.governanceFlags;

  checked.push("dryRunOnly");
  if (artifact.dryRunOnly !== gf.dryRunOnly) {
    violations.push(`dryRunOnly: expected ${gf.dryRunOnly}, got ${artifact.dryRunOnly}`);
  }

  checked.push("paperOnly");
  if (artifact.paperOnly !== gf.paperOnly) {
    violations.push(`paperOnly: expected ${gf.paperOnly}, got ${artifact.paperOnly}`);
  }

  checked.push("noActualMetrics");
  if (artifact.noActualMetrics !== gf.noActualMetrics) {
    violations.push(`noActualMetrics: expected ${gf.noActualMetrics}, got ${artifact.noActualMetrics}`);
  }

  checked.push("entersAlphaScore");
  if (artifact.entersAlphaScore !== gf.entersAlphaScore) {
    violations.push(`entersAlphaScore: expected ${gf.entersAlphaScore}, got ${artifact.entersAlphaScore}`);
  }

  checked.push("noAlphaScore");
  if (artifact.noAlphaScore !== gf.noAlphaScore) {
    violations.push(`noAlphaScore: expected ${gf.noAlphaScore}, got ${artifact.noAlphaScore}`);
  }

  checked.push("noRecommendation");
  if (artifact.noRecommendation !== gf.noRecommendation) {
    violations.push(`noRecommendation: expected ${gf.noRecommendation}, got ${artifact.noRecommendation}`);
  }

  checked.push("noPnL");
  if (artifact.noPnL !== gf.noPnL) {
    violations.push(`noPnL: expected ${gf.noPnL}, got ${artifact.noPnL}`);
  }

  checked.push("noROI");
  if (artifact.noROI !== gf.noROI) {
    violations.push(`noROI: expected ${gf.noROI}, got ${artifact.noROI}`);
  }

  checked.push("noWinRate");
  if (artifact.noWinRate !== gf.noWinRate) {
    violations.push(`noWinRate: expected ${gf.noWinRate}, got ${artifact.noWinRate}`);
  }

  checked.push("noReturnPct");
  if (artifact.noReturnPct !== gf.noReturnPct) {
    violations.push(`noReturnPct: expected ${gf.noReturnPct}, got ${artifact.noReturnPct}`);
  }

  checked.push("noOptimizer");
  if (artifact.noOptimizer !== gf.noOptimizer) {
    violations.push(`noOptimizer: expected ${gf.noOptimizer}, got ${artifact.noOptimizer}`);
  }

  checked.push("noRealBacktest");
  if (artifact.noRealBacktest !== gf.noRealBacktest) {
    violations.push(`noRealBacktest: expected ${gf.noRealBacktest}, got ${artifact.noRealBacktest}`);
  }

  checked.push("noInvestmentAdvice");
  if (artifact.noInvestmentAdvice !== gf.noInvestmentAdvice) {
    violations.push(`noInvestmentAdvice: expected ${gf.noInvestmentAdvice}, got ${artifact.noInvestmentAdvice}`);
  }

  checked.push("noBuySellActionSemantics");
  if (artifact.noBuySellActionSemantics !== gf.noBuySellActionSemantics) {
    violations.push(
      `noBuySellActionSemantics: expected ${gf.noBuySellActionSemantics}, got ${artifact.noBuySellActionSemantics}`
    );
  }

  checked.push("noRealExecution");
  if (artifact.noRealExecution !== gf.noRealExecution) {
    violations.push(`noRealExecution: expected ${gf.noRealExecution}, got ${artifact.noRealExecution}`);
  }

  // ── Step counts ───────────────────────────────────────────────────────────

  const sc = fixture.stepCounts;

  checked.push("materializationStepsCompleted");
  if (artifact.materializationStepsCompleted !== sc.materializationStepsCompleted) {
    violations.push(
      `materializationStepsCompleted: expected ${sc.materializationStepsCompleted}, got ${artifact.materializationStepsCompleted}`
    );
  }

  checked.push("materializationStepsTotal");
  if (artifact.materializationStepsTotal !== sc.materializationStepsTotal) {
    violations.push(
      `materializationStepsTotal: expected ${sc.materializationStepsTotal}, got ${artifact.materializationStepsTotal}`
    );
  }

  checked.push("fullPipelineRehearsalStepsCompleted");
  if (artifact.fullPipelineRehearsalStepsCompleted !== sc.fullPipelineRehearsalStepsCompleted) {
    violations.push(
      `fullPipelineRehearsalStepsCompleted: expected ${sc.fullPipelineRehearsalStepsCompleted}, got ${artifact.fullPipelineRehearsalStepsCompleted}`
    );
  }

  checked.push("rehearsalStepsCompleted");
  if (artifact.rehearsalStepsCompleted !== sc.rehearsalStepsCompleted) {
    violations.push(
      `rehearsalStepsCompleted: expected ${sc.rehearsalStepsCompleted}, got ${artifact.rehearsalStepsCompleted}`
    );
  }

  checked.push("pipelineStepsCompleted");
  if (artifact.pipelineStepsCompleted !== sc.pipelineStepsCompleted) {
    violations.push(
      `pipelineStepsCompleted: expected ${sc.pipelineStepsCompleted}, got ${artifact.pipelineStepsCompleted}`
    );
  }

  // ── Null-execution sentinel ───────────────────────────────────────────────

  checked.push("executedAt");
  if (artifact.executedAt !== null) {
    violations.push(`executedAt: expected null, got ${artifact.executedAt}`);
  }

  // ── ID prefix patterns ────────────────────────────────────────────────────

  const ip = fixture.idPatterns;

  checked.push("resultArtifactId");
  if (!ip.resultArtifactId.test(artifact.resultArtifactId)) {
    violations.push(`resultArtifactId: "${artifact.resultArtifactId}" does not match ${ip.resultArtifactId}`);
  }

  checked.push("fullPipelineRehearsalId");
  if (!ip.fullPipelineRehearsalId.test(artifact.fullPipelineRehearsalId)) {
    violations.push(
      `fullPipelineRehearsalId: "${artifact.fullPipelineRehearsalId}" does not match ${ip.fullPipelineRehearsalId}`
    );
  }

  checked.push("rehearsalId");
  if (!ip.rehearsalId.test(artifact.rehearsalId)) {
    violations.push(`rehearsalId: "${artifact.rehearsalId}" does not match ${ip.rehearsalId}`);
  }

  checked.push("integrationId");
  if (!ip.integrationId.test(artifact.integrationId)) {
    violations.push(`integrationId: "${artifact.integrationId}" does not match ${ip.integrationId}`);
  }

  checked.push("runnerId");
  if (!ip.runnerId.test(artifact.runnerId)) {
    violations.push(`runnerId: "${artifact.runnerId}" does not match ${ip.runnerId}`);
  }

  checked.push("lifecycleId");
  if (!ip.lifecycleId.test(artifact.lifecycleId)) {
    violations.push(`lifecycleId: "${artifact.lifecycleId}" does not match ${ip.lifecycleId}`);
  }

  // ── Phase chain ───────────────────────────────────────────────────────────

  const pc = fixture.phaseChain;

  checked.push("phase (P47)");
  if (artifact.phase !== pc.resultArtifactPhase) {
    violations.push(`phase: expected ${pc.resultArtifactPhase}, got ${artifact.phase}`);
  }

  checked.push("fullPipelineRehearsalResult.phase (P46)");
  if (artifact.fullPipelineRehearsalResult.phase !== pc.fullPipelineRehearsalPhase) {
    violations.push(
      `fullPipelineRehearsalResult.phase: expected ${pc.fullPipelineRehearsalPhase}, got ${artifact.fullPipelineRehearsalResult.phase}`
    );
  }

  checked.push("rehearsalResult.phase (P45)");
  if (artifact.fullPipelineRehearsalResult.rehearsalResult.phase !== pc.rehearsalPhase) {
    violations.push(
      `rehearsalResult.phase: expected ${pc.rehearsalPhase}, got ${artifact.fullPipelineRehearsalResult.rehearsalResult.phase}`
    );
  }

  checked.push("integrationResult.phase (P44)");
  if (
    artifact.fullPipelineRehearsalResult.rehearsalResult.integrationResult
      .phase !== pc.integrationPhase
  ) {
    violations.push(
      `integrationResult.phase: expected ${pc.integrationPhase}, got ${artifact.fullPipelineRehearsalResult.rehearsalResult.integrationResult.phase}`
    );
  }

  // ── Forbidden fields ──────────────────────────────────────────────────────

  const rec = artifact as Record<string, unknown>;
  for (const field of fixture.forbiddenFields) {
    checked.push(`forbidden:${field}`);
    if (rec[field] !== undefined) {
      violations.push(`forbidden field present: "${field}"`);
    }
  }

  return Object.freeze({
    valid: violations.length === 0,
    violations: Object.freeze([...violations]),
    checkedFields: Object.freeze([...checked]),
    fixtureId: fixture.fixtureId,
    phase: "P48" as const,
    dryRunOnly: true as const,
    paperOnly: true as const,
    noRealExecution: true as const,
    isGoldenFixtureValidation: true as const,
  });
}
