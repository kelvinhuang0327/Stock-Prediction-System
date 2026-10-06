/**
 * P29G: Paper Simulation Dry-Run Report Generator
 * paper-only / simulation-only / NOT investment recommendation
 *
 * Converts a PaperSimulationDryRunResult into an auditable, human-readable
 * governance report.
 *
 * What this report OUTPUTS:
 *   - Row count (source classification count)
 *   - Source coverage classification summary
 *   - Leakage gate status
 *   - Governance check result
 *   - Blocked sources and reasons
 *   - alphaScore gating violations (must be empty)
 *   - Dry-run only status flags
 *
 * What this report NEVER outputs:
 *   - ROI, win-rate, alpha, edge, profit
 *   - buy / sell / hold / recommendation
 *   - Any performance claim
 *   - Any investment advice
 */

import { PaperSimulationDryRunResult } from "./PaperSimulationDryRunRunner";
import { DryRunSourceClassification, DryRunSourceStatus } from "./PaperSimulationDryRunInput";

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------

export interface DryRunSourceCoverageSummary {
  total: number;
  byStatus: Record<DryRunSourceStatus, number>;
  alphaScoreGated: number; // sources with entersAlphaScore=true (should be 0 for HIGH_RISK/BLOCKED)
  blockedSources: string[];
  highRiskAbsentSources: string[];
}

export interface PaperSimulationDryRunReportOutput {
  reportId: string;
  generatedAt: string;

  // Governance flags — the only metrics allowed in this report
  dryRunOnly: true;
  paperOnly: true;
  notInvestmentRecommendation: true;
  scaffoldOnly: true;

  // Governance status
  governanceCheckPassed: boolean;
  leakageGateStatus: string;
  leakageGatePassed: boolean;
  inputValidationErrors: string[];
  alphaScoreGatingViolations: string[];

  // Source coverage (count only — no performance values)
  sourceCoverage: DryRunSourceCoverageSummary;

  // Contract version
  p29gContractVersion: string;

  // Mutation safety confirmation
  mutationSafety: {
    scoringMutation: false;
    corpusMutation: false;
    optimizerExecuted: false;
    realBacktestExecuted: false;
  };

  // Status flags
  blockedReasons: string[];

  // Observability notes (no performance content)
  notes: string[];
}

// ---------------------------------------------------------------------------
// Report generator
// ---------------------------------------------------------------------------

/**
 * Generate an auditable governance report from a P29G dry-run result.
 *
 * The report contains ONLY governance metadata — no performance values.
 */
export function generateDryRunReport(
  result: PaperSimulationDryRunResult
): PaperSimulationDryRunReportOutput {
  const { output, leakageGate } = result;
  const generatedAt = new Date().toISOString();
  const reportId = `p29g-report-${output.runId}-${Date.now()}`;

  // Build source coverage summary
  const sourceCoverage = summarizeSourceCoverage(output.sourceClassifications);

  // Collect blocked reasons
  const blockedReasons: string[] = [];

  if (output.inputValidationErrors.length > 0) {
    blockedReasons.push(
      `Input validation failed: ${output.inputValidationErrors.join("; ")}`
    );
  }

  if (output.alphaScoreGatingViolations.length > 0) {
    blockedReasons.push(
      `AlphaScore gating violation: ${output.alphaScoreGatingViolations.join("; ")}`
    );
  }

  if (!leakageGate.passed) {
    blockedReasons.push(
      `Leakage gate failed: ${leakageGate.violations.join("; ")}`
    );
  }

  // Governance notes
  const notes: string[] = [
    "PAPER ONLY — no real simulation performed.",
    "DRY RUN ONLY — no DB, corpus, or scoring mutations.",
    "NOT INVESTMENT RECOMMENDATION — this report contains no performance claims.",
    `Leakage gate scaffold note: ${leakageGate.scaffoldNote}`,
    `Source classifications: ${output.sourceClassifications.length} sources evaluated.`,
    `HIGH_RISK_SOURCE_ABSENT sources: ${sourceCoverage.highRiskAbsentSources.join(", ") || "none"}.`,
    "FinancialReport and NewsEvent remain HIGH_RISK_SOURCE_ABSENT — entersAlphaScore=false.",
    "Next hard gate: Quote/Regime/Chip PIT Validation Audit (Axis A).",
  ];

  return {
    reportId,
    generatedAt,
    dryRunOnly: true,
    paperOnly: true,
    notInvestmentRecommendation: true,
    scaffoldOnly: true,
    governanceCheckPassed: output.governanceCheckPassed,
    leakageGateStatus: output.leakageGateStatus,
    leakageGatePassed: leakageGate.passed,
    inputValidationErrors: output.inputValidationErrors,
    alphaScoreGatingViolations: output.alphaScoreGatingViolations,
    sourceCoverage,
    p29gContractVersion: output.p29gContractVersion,
    mutationSafety: {
      scoringMutation: false,
      corpusMutation: false,
      optimizerExecuted: false,
      realBacktestExecuted: false,
    },
    blockedReasons,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Source coverage summary helper
// ---------------------------------------------------------------------------

function summarizeSourceCoverage(
  classifications: DryRunSourceClassification[]
): DryRunSourceCoverageSummary {
  const byStatus: Record<DryRunSourceStatus, number> = {
    PIT_SAFE_VERIFIED: 0,
    HIGH_RISK_SOURCE_ABSENT: 0,
    STRUCTURAL_PLACEHOLDER_ONLY: 0,
    BLOCKED: 0,
  };

  let alphaScoreGated = 0;
  const blockedSources: string[] = [];
  const highRiskAbsentSources: string[] = [];

  for (const sc of classifications) {
    byStatus[sc.status] = (byStatus[sc.status] ?? 0) + 1;
    if (sc.entersAlphaScore) {
      alphaScoreGated++;
    }
    if (sc.status === "BLOCKED") {
      blockedSources.push(sc.sourceName);
    }
    if (sc.status === "HIGH_RISK_SOURCE_ABSENT") {
      highRiskAbsentSources.push(sc.sourceName);
    }
  }

  return {
    total: classifications.length,
    byStatus,
    alphaScoreGated,
    blockedSources,
    highRiskAbsentSources,
  };
}

// ---------------------------------------------------------------------------
// Report serializer
// ---------------------------------------------------------------------------

/**
 * Serialize a dry-run report to a Markdown string.
 * This is the human-readable governance artifact.
 */
export function serializeDryRunReportToMarkdown(
  report: PaperSimulationDryRunReportOutput
): string {
  const govStatus = report.governanceCheckPassed ? "✅ PASS" : "❌ FAIL";
  const leakageStatus = report.leakageGatePassed ? "✅ PASS" : "❌ FAIL";

  const sourceRows = Object.entries(report.sourceCoverage.byStatus)
    .map(([status, count]) => `| ${status} | ${count} |`)
    .join("\n");

  const blockedSection =
    report.blockedReasons.length > 0
      ? `\n## Blocked Reasons\n\n${report.blockedReasons.map((r) => `- ${r}`).join("\n")}`
      : "";

  return `# P29G Dry-Run Report

**Report ID:** ${report.reportId}  
**Generated At:** ${report.generatedAt}  
**Contract Version:** ${report.p29gContractVersion}

---

## Governance Status

| Check | Result |
|-------|--------|
| Governance Check | ${govStatus} |
| Leakage Gate | ${leakageStatus} (status: \`${report.leakageGateStatus}\`) |
| Input Validation | ${report.inputValidationErrors.length === 0 ? "✅ PASS" : "❌ FAIL"} |
| AlphaScore Gating | ${report.alphaScoreGatingViolations.length === 0 ? "✅ PASS" : "❌ FAIL"} |

## Boundary Flags

| Flag | Value |
|------|-------|
| dryRunOnly | ${report.dryRunOnly} |
| paperOnly | ${report.paperOnly} |
| notInvestmentRecommendation | ${report.notInvestmentRecommendation} |
| scaffoldOnly | ${report.scaffoldOnly} |
| scoringMutation | ${report.mutationSafety.scoringMutation} |
| corpusMutation | ${report.mutationSafety.corpusMutation} |
| optimizerExecuted | ${report.mutationSafety.optimizerExecuted} |
| realBacktestExecuted | ${report.mutationSafety.realBacktestExecuted} |

## Source Coverage (Count Only — No Performance Values)

| Status | Count |
|--------|-------|
${sourceRows}
| **Total** | **${report.sourceCoverage.total}** |

**HIGH_RISK_SOURCE_ABSENT sources:** ${report.sourceCoverage.highRiskAbsentSources.join(", ") || "none"}  
**BLOCKED sources:** ${report.sourceCoverage.blockedSources.join(", ") || "none"}  
**entersAlphaScore=true count:** ${report.sourceCoverage.alphaScoreGated} (must be 0 for HIGH_RISK/BLOCKED)
${blockedSection}

## Observability Notes

${report.notes.map((n) => `- ${n}`).join("\n")}

---

*This report contains no investment advice, no performance claims, and no buy/sell/hold signals.*  
*It is a governance audit artifact only.*
`;
}
