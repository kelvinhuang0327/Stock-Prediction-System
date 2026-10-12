/**
 * P29G: Paper Simulation Dry-Run Runner
 * paper-only / simulation-only / NOT investment recommendation
 *
 * This is the P29G executable runner. It expands the P29E scaffold with:
 *   - Explicit P29G dry-run input contract enforcement
 *   - Per-source governance classification in output
 *   - alphaScore gating validation (HIGH_RISK sources must not enter)
 *   - Leakage gate integration on every output
 *   - P29G governance metadata in output
 *
 * What this runner WILL NEVER do:
 *   - Write to prisma/dev.db
 *   - Mutate any *.jsonl corpus
 *   - Modify alphaScore / bucket / scoring formula
 *   - Execute any optimizer
 *   - Execute any real backtest
 *   - Produce any ROI / win-rate / alpha / edge / profit claim
 *   - Produce any buy / sell / hold / recommendation
 *
 * dryRun=true is the only authorized mode for P29G.
 * Promotion to any other mode requires explicit CTO approval token per P29C.
 */

import {
  DryRunInputConfig,
  DryRunSourceClassification,
  validateDryRunInputConfig,
  resolveSourceClassifications,
  checkAlphaScoreGating,
  FORBIDDEN_ACTION_FIELDS,
} from "./PaperSimulationDryRunInput";
import { PaperSimulationOutput } from "../p29e/PaperSimulationOutputSchema";
import {
  runLeakageGatePlaceholder,
  LeakageGateResult,
} from "../p29e/LeakageGatePlaceholder";

// ---------------------------------------------------------------------------
// P29G output types
// ---------------------------------------------------------------------------

/** P29G runner contract version */
const P29G_CONTRACT_VERSION = "p29g-dry-run-runner-v1";

/**
 * Structured output of a P29G dry-run run.
 *
 * Extends P29E PaperSimulationOutput with:
 *   - p29gContractVersion
 *   - sourceClassifications record
 *   - alphaScoreGatingViolations (must be empty)
 *   - inputValidationErrors (must be empty)
 *
 * Structurally FORBIDDEN fields (never present):
 *   buy, sell, hold, action, stake, position, allocation, order, trade,
 *   roi, returnPct, winRate, alpha, edge, profit, outperformance,
 *   realizedReturn, forecastedReturn, expectedAlpha, strategyEdge,
 *   buySignal, sellSignal, recommendation, outcomePrice, investmentAdvice
 */
export interface PaperSimulationDryRunOutput extends PaperSimulationOutput {
  /** P29G runner contract version */
  p29gContractVersion: string;

  /** Governance classification for all data sources in this run */
  sourceClassifications: DryRunSourceClassification[];

  /** Any alphaScore gating boundary violations (must be empty for a valid run) */
  alphaScoreGatingViolations: string[];

  /** Input validation errors (must be empty for a valid run) */
  inputValidationErrors: string[];

  /** True when all governance checks passed */
  governanceCheckPassed: boolean;
}

/**
 * Full result returned by runPaperSimulationDryRun.
 */
export interface PaperSimulationDryRunResult {
  output: PaperSimulationDryRunOutput;
  leakageGate: LeakageGateResult;
  dryRun: true;
  paperOnly: true;
  scaffoldOnly: true;
  p29gContractVersion: string;
  /** ISO8601 timestamp of result generation */
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Runner implementation
// ---------------------------------------------------------------------------

/**
 * Run a P29G paper simulation dry-run.
 *
 * Enforces:
 *   1. Input validation (paperOnly=true, dryRun=true, notInvestmentRecommendation=true)
 *   2. No forbidden action fields in input
 *   3. All HIGH_RISK_SOURCE_ABSENT sources blocked from alphaScore
 *   4. Leakage gate on every output
 *
 * Never throws for governance violations — returns them in the output struct.
 * Throws only for programming errors (null config, etc.).
 */
export function runPaperSimulationDryRun(
  config: DryRunInputConfig
): PaperSimulationDryRunResult {
  if (!config) {
    throw new Error("P29G: config must not be null/undefined");
  }

  const generatedAt = new Date().toISOString();

  // Step 1: Validate input contract
  const inputValidation = validateDryRunInputConfig(config);
  const inputValidationErrors = inputValidation.errors;

  // Step 2: Resolve source classifications
  const sourceClassifications = resolveSourceClassifications(
    config.sourceClassifications
  );

  // Step 3: Check alphaScore gating
  const alphaScoreGatingViolations = checkAlphaScoreGating(sourceClassifications);

  // Step 4: Determine overall governance pass
  const governanceCheckPassed =
    inputValidationErrors.length === 0 && alphaScoreGatingViolations.length === 0;

  // Step 5: Build deterministic runId
  const seed = config.seed ?? "p29g-default-seed";
  const featureSetLabel = config.featureSetLabel ?? "p29a-pit-registry-v1";
  const runId = `p29g-dry-run-${seed}-${config.asOfDate}-${config.candidateId}`;

  // Step 6: Build warnings
  const warnings: string[] = [
    "PAPER ONLY: No real simulation performed.",
    "PAPER ONLY: No production DB read or write.",
    "PAPER ONLY: No corpus mutation.",
    "PAPER ONLY: No scoring / alphaScore / bucket mutation.",
    "PAPER ONLY: No optimizer executed.",
    "PAPER ONLY: No real backtest executed.",
    "FinancialReport remains HIGH_RISK_SOURCE_ABSENT — entersAlphaScore=false.",
    "NewsEvent remains HIGH_RISK_SOURCE_ABSENT — entersAlphaScore=false.",
    "Quote/Regime/Chip are PIT_SAFE_VERIFIED for scaffold representation only — next hard gate is PIT Validation Audit (Axis A).",
  ];
  if (!governanceCheckPassed) {
    warnings.push(
      `GOVERNANCE VIOLATION DETECTED: inputErrors=${inputValidationErrors.length}, alphaGatingViolations=${alphaScoreGatingViolations.length}`
    );
  }

  // Step 7: Build base PaperSimulationOutput
  const baseOutput: PaperSimulationOutput = {
    runId,
    asOfDate: config.asOfDate,
    simulationMode: "paper_only",
    contractVersion: P29G_CONTRACT_VERSION,
    candidateId: config.candidateId,
    sourceFeatureSet: featureSetLabel,
    sourceFeaturePitStatus: "AVAILABLE_NEEDS_VALIDATION",
    inputSnapshotRef: `p29g://input/${runId}`,
    outputRef: `p29g://output/${runId}`,
    leakageGateStatus: "NOT_EVALUATED_SCAFFOLD_ONLY",
    scoringMutation: false,
    corpusMutation: false,
    optimizerExecuted: false,
    realBacktestExecuted: false,
    generatedAt,
    warnings,
    notInvestmentRecommendation: true,
    scaffoldNotes: [
      `dryRun=true (enforced by P29G)`,
      `paperOnly=true (enforced by P29G)`,
      `p29gContractVersion=${P29G_CONTRACT_VERSION}`,
      `seed=${seed}`,
      "Next hard gate: Quote/Regime/Chip PIT Validation Audit (Axis A)",
      "P29G authorizes dry-run only. Promotion requires CTO approval token per P29C.",
    ],
  };

  // Step 8: Run leakage gate
  const leakageGate = runLeakageGatePlaceholder(
    baseOutput as unknown as Record<string, unknown>
  );

  // Step 9: Build full P29G output
  const output: PaperSimulationDryRunOutput = {
    ...baseOutput,
    leakageGateStatus: leakageGate.status,
    p29gContractVersion: P29G_CONTRACT_VERSION,
    sourceClassifications,
    alphaScoreGatingViolations,
    inputValidationErrors,
    governanceCheckPassed,
  };

  return {
    output,
    leakageGate,
    dryRun: true,
    paperOnly: true,
    scaffoldOnly: true,
    p29gContractVersion: P29G_CONTRACT_VERSION,
    generatedAt,
  };
}

// ---------------------------------------------------------------------------
// Forbidden field guard
// ---------------------------------------------------------------------------

/**
 * Assert that a P29G output object contains no forbidden action fields.
 * Used in tests and in report generation to verify output boundaries.
 */
export function assertNoForbiddenActionFields(
  output: Record<string, unknown>
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const field of FORBIDDEN_ACTION_FIELDS) {
    if (field in output) {
      violations.push(`forbidden action field present in output: ${field}`);
    }
  }
  return { valid: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// Fixture generator
// ---------------------------------------------------------------------------

/**
 * Generate a canonical P29G dry-run fixture.
 * Used for tests, documentation, and sample output artifacts.
 */
export function generateP29GFixture(): PaperSimulationDryRunResult {
  return runPaperSimulationDryRun({
    asOfDate: "2026-01-15",
    candidateId: "p29g-dry-run-candidate-001",
    paperOnly: true,
    dryRun: true,
    notInvestmentRecommendation: true,
    featureSetLabel: "p29a-pit-registry-v1",
    seed: "p29g-fixture-v1",
    metadata: {
      generatedBy: "P29G dry-run runner",
      purpose: "canonical fixture for testing and documentation",
    },
  });
}
