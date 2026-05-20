/**
 * P29E: Paper Simulation Scaffold Runner
 * paper-only / simulation-only / NOT investment recommendation
 *
 * SCAFFOLD ONLY — does not:
 *   - read or write production DB (prisma/dev.db)
 *   - mutate any corpus (*.jsonl)
 *   - modify scoring / alphaScore / recommendationBucket
 *   - execute any optimizer
 *   - execute any real backtest
 *   - produce any performance claims (ROI / win-rate / alpha / edge / profit)
 *
 * Default: dryRun = true. Must be explicitly set to false for any future
 * promoted mode, subject to CTO approval token per P29C contract.
 *
 * This runner is the P29C contract → P29E executable bridge.
 * It is paper-only by design and will remain so until:
 *   1. Quote/Regime/Chip PIT Validation Audit completes (next hard gate)
 *   2. MonthlyRevenue source import (P26F4) completes
 *   3. CTO approval token is provided per P29C evaluationModes
 */

import {
  PaperSimulationOutput,
  SourceFeaturePitStatus,
} from "./PaperSimulationOutputSchema";
import {
  runLeakageGatePlaceholder,
  LeakageGateResult,
} from "./LeakageGatePlaceholder";

/** Contract version from P29C */
const CONTRACT_VERSION = "p29c-backtest-simulation-contract-v1";

export interface PaperSimulationRunConfig {
  /** Simulation date (YYYY-MM-DD) */
  asOfDate: string;
  /** Strategy candidate identifier */
  candidateId: string;
  /** Feature set label */
  sourceFeatureSet?: string;
  /** Must remain true in scaffold mode */
  dryRun?: boolean;
  /** Optional deterministic seed for reproducibility */
  seed?: string;
}

export interface PaperSimulationRunResult {
  output: PaperSimulationOutput;
  leakageGate: LeakageGateResult;
  dryRun: boolean;
  scaffoldOnly: true;
}

/**
 * Run the paper simulation scaffold.
 *
 * Always returns a paper-only output. Never writes to DB, corpus, or scoring.
 * The leakage gate is run on every output as a structural check.
 */
export function runPaperSimulationScaffold(
  config: PaperSimulationRunConfig
): PaperSimulationRunResult {
  const dryRun = config.dryRun !== false; // default true

  const asOfDate = config.asOfDate;
  const candidateId = config.candidateId;
  const seed = config.seed ?? "p29e-scaffold-default";
  const sourceFeatureSet = config.sourceFeatureSet ?? "p29a-pit-registry-v1";

  // Deterministic runId from seed + asOfDate + candidateId
  const runId = `p29e-scaffold-${seed}-${asOfDate}-${candidateId}`;

  // Feature PIT status — Quote/Regime/Chip are AVAILABLE_NEEDS_VALIDATION
  // (not AVAILABLE_PIT_SAFE until the audit completes)
  // FinancialReport/NewsEvent are HIGH_RISK_SOURCE_ABSENT
  const sourceFeaturePitStatus: SourceFeaturePitStatus =
    "AVAILABLE_NEEDS_VALIDATION";

  const output: PaperSimulationOutput = {
    runId,
    asOfDate,
    simulationMode: "paper_only",
    contractVersion: CONTRACT_VERSION,
    candidateId,
    sourceFeatureSet,
    sourceFeaturePitStatus,
    inputSnapshotRef: `scaffold://input/${runId}`,
    outputRef: `scaffold://output/${runId}`,
    leakageGateStatus: "NOT_EVALUATED_SCAFFOLD_ONLY",
    scoringMutation: false,
    corpusMutation: false,
    optimizerExecuted: false,
    realBacktestExecuted: false,
    generatedAt: new Date().toISOString(),
    warnings: [
      "SCAFFOLD ONLY: No real simulation performed.",
      "SCAFFOLD ONLY: No production DB read or write.",
      "SCAFFOLD ONLY: No corpus mutation.",
      "SCAFFOLD ONLY: No scoring / alphaScore / bucket mutation.",
      "SCAFFOLD ONLY: No optimizer executed.",
      "SCAFFOLD ONLY: No real backtest executed.",
      "Feature PIT status is AVAILABLE_NEEDS_VALIDATION — Quote/Regime/Chip PIT audit is the NEXT hard gate.",
      "FinancialReport / NewsEvent remain HIGH_RISK_SOURCE_ABSENT — entersAlphaScore=false.",
    ],
    notInvestmentRecommendation: true,
    scaffoldNotes: [
      `dryRun=${dryRun}`,
      `contractVersion=${CONTRACT_VERSION}`,
      `seed=${seed}`,
      "Next hard gate: Quote/Regime/Chip PIT Validation Audit (Axis A trust root)",
    ],
  };

  const leakageGate = runLeakageGatePlaceholder(
    output as unknown as Record<string, unknown>
  );

  // Update leakageGateStatus from gate result
  const finalOutput: PaperSimulationOutput = {
    ...output,
    leakageGateStatus: leakageGate.status,
  };

  return {
    output: finalOutput,
    leakageGate,
    dryRun,
    scaffoldOnly: true,
  };
}

/**
 * Generate a deterministic fixture output for testing and documentation.
 * This is the canonical sample output for P29E.
 */
export function generateP29EFixture(): PaperSimulationRunResult {
  return runPaperSimulationScaffold({
    asOfDate: "2026-01-15",
    candidateId: "p29e-scaffold-candidate-001",
    sourceFeatureSet: "p29a-pit-registry-v1",
    dryRun: true,
    seed: "p29e-fixture-v1",
  });
}
