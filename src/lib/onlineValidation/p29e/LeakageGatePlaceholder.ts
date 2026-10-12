/**
 * P29E: Leakage Gate Placeholder
 * paper-only / simulation-only / NOT investment recommendation
 *
 * SCAFFOLD ONLY: This gate enforces structural safety for paper simulation
 * outputs. It does NOT validate PIT correctness for Quote/Regime/Chip
 * (those require the PIT Validation Audit — next hard gate after P29E).
 *
 * What this gate DOES check:
 *   1. No future-labeled fields present
 *   2. No outcome-like fields present
 *   3. All mutation flags are false
 *   4. paper-only marker is present (simulationMode === "paper_only")
 *   5. notInvestmentRecommendation marker is present and true
 *
 * What this gate DOES NOT check (requires future PIT audit):
 *   - Quote PIT safety
 *   - Regime PIT safety
 *   - Chip PIT safety
 *   - FinancialReport / NewsEvent availability
 *   - Production validation
 */

import {
  PaperSimulationOutput,
  FORBIDDEN_OUTPUT_FIELDS,
  assertNoForbiddenFields,
  LeakageGateStatus,
} from "./PaperSimulationOutputSchema";

const FUTURE_LABELED_FIELDS = [
  "outcomePrice",
  "returnPct",
  "realizedReturnClass",
  "futurePriceMovement",
  "postAsOfNewsEvent",
  "analystRevision",
  "forwardPE",
  "futureEPS",
] as const;

const OUTCOME_LIKE_FIELDS = [
  "outcomeJoinDate",
  "holdingWindow",
  "realizedReturn",
  "forecastedReturn",
  "expectedReturn",
  "strategyReturn",
] as const;

export interface LeakageGateResult {
  status: LeakageGateStatus;
  passed: boolean;
  violations: string[];
  checkedAt: string;
  scaffoldNote: string;
}

/**
 * Run the scaffold-level leakage gate on a candidate output.
 * Returns a gate result — does NOT throw. Caller decides how to handle failure.
 */
export function runLeakageGatePlaceholder(
  candidate: Record<string, unknown>
): LeakageGateResult {
  const violations: string[] = [];
  const checkedAt = new Date().toISOString();

  // Check 1: no future-labeled fields
  for (const field of FUTURE_LABELED_FIELDS) {
    if (field in candidate) {
      violations.push(`future-labeled field present: ${field}`);
    }
  }

  // Check 2: no outcome-like fields
  for (const field of OUTCOME_LIKE_FIELDS) {
    if (field in candidate) {
      violations.push(`outcome-like field present: ${field}`);
    }
  }

  // Check 3: no forbidden performance-claim fields
  const { violations: forbiddenViolations } = assertNoForbiddenFields(
    candidate as Record<string, unknown>
  );
  for (const v of forbiddenViolations) {
    violations.push(`forbidden performance field present: ${v}`);
  }

  // Check 4: mutation flags must all be false
  if (candidate["scoringMutation"] !== false) {
    violations.push("scoringMutation must be false");
  }
  if (candidate["corpusMutation"] !== false) {
    violations.push("corpusMutation must be false");
  }
  if (candidate["optimizerExecuted"] !== false) {
    violations.push("optimizerExecuted must be false");
  }
  if (candidate["realBacktestExecuted"] !== false) {
    violations.push("realBacktestExecuted must be false");
  }

  // Check 5: paper-only marker
  if (candidate["simulationMode"] !== "paper_only") {
    violations.push("simulationMode must be 'paper_only'");
  }

  // Check 6: notInvestmentRecommendation marker
  if (candidate["notInvestmentRecommendation"] !== true) {
    violations.push("notInvestmentRecommendation must be true");
  }

  const passed = violations.length === 0;
  let status: LeakageGateStatus;

  if (!passed) {
    if (violations.some((v) => v.includes("future-labeled"))) {
      status = "FAILED_FUTURE_LABEL_DETECTED";
    } else if (violations.some((v) => v.includes("outcome-like"))) {
      status = "FAILED_OUTCOME_FIELD_DETECTED";
    } else if (violations.some((v) => v.includes("mutation"))) {
      status = "FAILED_MUTATION_FLAG_TRUE";
    } else if (violations.some((v) => v.includes("simulationMode"))) {
      status = "FAILED_MISSING_PAPER_ONLY_MARKER";
    } else {
      status = "FAILED_MISSING_NOT_INVESTMENT_RECOMMENDATION";
    }
  } else {
    // Scaffold: gate passes structurally but PIT audit not yet done
    status = "NOT_EVALUATED_SCAFFOLD_ONLY";
  }

  return {
    status,
    passed,
    violations,
    checkedAt,
    scaffoldNote:
      "SCAFFOLD ONLY: PIT validation for Quote/Regime/Chip is the NEXT hard gate " +
      "(Quote/Regime/Chip PIT Validation Audit). FinancialReport/NewsEvent remain " +
      "HIGH_RISK_SOURCE_ABSENT and must not enter alphaScore.",
  };
}

/**
 * Type guard: verify a candidate object is a structurally valid PaperSimulationOutput.
 * Does not verify PIT correctness of underlying features.
 */
export function isPaperSimulationOutput(
  candidate: unknown
): candidate is PaperSimulationOutput {
  if (typeof candidate !== "object" || candidate === null) return false;
  const c = candidate as Record<string, unknown>;
  return (
    typeof c["runId"] === "string" &&
    typeof c["asOfDate"] === "string" &&
    c["simulationMode"] === "paper_only" &&
    c["notInvestmentRecommendation"] === true &&
    c["scoringMutation"] === false &&
    c["corpusMutation"] === false &&
    c["optimizerExecuted"] === false &&
    c["realBacktestExecuted"] === false &&
    typeof c["leakageGateStatus"] === "string"
  );
}
