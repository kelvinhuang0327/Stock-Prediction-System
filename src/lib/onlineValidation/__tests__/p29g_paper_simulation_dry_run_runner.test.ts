/**
 * P29G Test Suite: Paper Simulation Dry-Run Runner
 * paper-only / simulation-only / NOT investment recommendation
 *
 * Tests P29G-T01 through P29G-T25 covering:
 *   - Input contract enforcement (paperOnly, dryRun, notInvestmentRecommendation)
 *   - Forbidden action field rejection (buy/sell/hold/action/stake)
 *   - Output leakage gate integration
 *   - Source classification and alphaScore gating
 *   - FinancialReport / NewsEvent HIGH_RISK_SOURCE_ABSENT enforcement
 *   - Quote/Regime/Chip PIT_SAFE_VERIFIED representation
 *   - Output determinism
 *   - Output serializability
 *   - No DB / corpus / scoring mutations
 *   - No forbidden claims in output
 *   - Report generation
 */

import * as fs from "fs";
import * as path from "path";
import {
  runPaperSimulationDryRun,
  generateP29GFixture,
  assertNoForbiddenActionFields,
  PaperSimulationDryRunResult,
} from "../p29g/PaperSimulationDryRunRunner";
import {
  validateDryRunInputConfig,
  resolveSourceClassifications,
  checkAlphaScoreGating,
  P29G_SOURCE_CLASSIFICATIONS,
  FORBIDDEN_ACTION_FIELDS,
} from "../p29g/PaperSimulationDryRunInput";
import {
  generateDryRunReport,
  serializeDryRunReportToMarkdown,
} from "../p29g/PaperSimulationDryRunReport";
import { runLeakageGatePlaceholder } from "../p29e/LeakageGatePlaceholder";
import { FORBIDDEN_OUTPUT_FIELDS } from "../p29e/PaperSimulationOutputSchema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXTURE_CONFIG = {
  asOfDate: "2026-01-15",
  candidateId: "p29g-test-candidate-001",
  paperOnly: true as const,
  dryRun: true as const,
  notInvestmentRecommendation: true as const,
  seed: "p29g-test-seed-v1",
};

const P29G_SOURCE_FILES = [
  path.join(__dirname, "../p29g/PaperSimulationDryRunInput.ts"),
  path.join(__dirname, "../p29g/PaperSimulationDryRunRunner.ts"),
  path.join(__dirname, "../p29g/PaperSimulationDryRunReport.ts"),
];

// ---------------------------------------------------------------------------
// P29G-T01: Input contract — paperOnly=true required
// ---------------------------------------------------------------------------
describe("P29G-T01: Input contract — paperOnly=true required", () => {
  it("rejects input without paperOnly=true", () => {
    const result = validateDryRunInputConfig({
      asOfDate: "2026-01-15",
      candidateId: "test",
      paperOnly: false,
      dryRun: true,
      notInvestmentRecommendation: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("paperOnly"))).toBe(true);
  });

  it("rejects input where paperOnly is undefined", () => {
    const result = validateDryRunInputConfig({
      asOfDate: "2026-01-15",
      candidateId: "test",
      dryRun: true,
      notInvestmentRecommendation: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("paperOnly"))).toBe(true);
  });

  it("accepts input with paperOnly=true", () => {
    const result = validateDryRunInputConfig(FIXTURE_CONFIG);
    expect(result.errors.filter((e) => e.includes("paperOnly"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// P29G-T02: Input contract — dryRun=true required
// ---------------------------------------------------------------------------
describe("P29G-T02: Input contract — dryRun=true required", () => {
  it("rejects input without dryRun=true", () => {
    const result = validateDryRunInputConfig({
      asOfDate: "2026-01-15",
      candidateId: "test",
      paperOnly: true,
      dryRun: false,
      notInvestmentRecommendation: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("dryRun"))).toBe(true);
  });

  it("accepts input with dryRun=true", () => {
    const result = validateDryRunInputConfig(FIXTURE_CONFIG);
    expect(result.errors.filter((e) => e.includes("dryRun"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// P29G-T03: Input contract — notInvestmentRecommendation=true required
// ---------------------------------------------------------------------------
describe("P29G-T03: Input contract — notInvestmentRecommendation=true required", () => {
  it("rejects input without notInvestmentRecommendation=true", () => {
    const result = validateDryRunInputConfig({
      asOfDate: "2026-01-15",
      candidateId: "test",
      paperOnly: true,
      dryRun: true,
      notInvestmentRecommendation: false,
    });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("notInvestmentRecommendation"))
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P29G-T04: Forbidden action fields — buy / sell / hold / action / stake
// ---------------------------------------------------------------------------
describe("P29G-T04: Forbidden action fields rejected from input", () => {
  const forbidden = ["buy", "sell", "hold", "action", "stake"];

  forbidden.forEach((field) => {
    it(`rejects input containing forbidden field: ${field}`, () => {
      const result = validateDryRunInputConfig({
        ...FIXTURE_CONFIG,
        [field]: "some-value",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(field))).toBe(true);
    });
  });

  it("FORBIDDEN_ACTION_FIELDS covers all required forbidden fields", () => {
    const required = ["buy", "sell", "hold", "action", "stake", "recommendation", "order"];
    for (const f of required) {
      expect(FORBIDDEN_ACTION_FIELDS).toContain(f);
    }
  });
});

// ---------------------------------------------------------------------------
// P29G-T05: Runner output — paperOnly enforced
// ---------------------------------------------------------------------------
describe("P29G-T05: Runner output — paperOnly enforced", () => {
  let result: PaperSimulationDryRunResult;

  beforeAll(() => {
    result = generateP29GFixture();
  });

  it("result.paperOnly is true", () => {
    expect(result.paperOnly).toBe(true);
  });

  it("output.simulationMode is paper_only", () => {
    expect(result.output.simulationMode).toBe("paper_only");
  });

  it("output.notInvestmentRecommendation is true", () => {
    expect(result.output.notInvestmentRecommendation).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P29G-T06: Runner output — dryRun enforced
// ---------------------------------------------------------------------------
describe("P29G-T06: Runner output — dryRun enforced", () => {
  let result: PaperSimulationDryRunResult;

  beforeAll(() => {
    result = generateP29GFixture();
  });

  it("result.dryRun is true", () => {
    expect(result.dryRun).toBe(true);
  });

  it("result.scaffoldOnly is true", () => {
    expect(result.scaffoldOnly).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P29G-T07: Runner output — mutation flags all false
// ---------------------------------------------------------------------------
describe("P29G-T07: Runner output — all mutation flags are false", () => {
  let result: PaperSimulationDryRunResult;

  beforeAll(() => {
    result = generateP29GFixture();
  });

  it("scoringMutation is false", () => {
    expect(result.output.scoringMutation).toBe(false);
  });

  it("corpusMutation is false", () => {
    expect(result.output.corpusMutation).toBe(false);
  });

  it("optimizerExecuted is false", () => {
    expect(result.output.optimizerExecuted).toBe(false);
  });

  it("realBacktestExecuted is false", () => {
    expect(result.output.realBacktestExecuted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P29G-T08: Leakage gate — output passes runLeakageGatePlaceholder()
// ---------------------------------------------------------------------------
describe("P29G-T08: Leakage gate — output passes runLeakageGatePlaceholder()", () => {
  let result: PaperSimulationDryRunResult;

  beforeAll(() => {
    result = generateP29GFixture();
  });

  it("leakage gate runs on output", () => {
    const gate = runLeakageGatePlaceholder(
      result.output as unknown as Record<string, unknown>
    );
    expect(gate).toBeDefined();
    expect(typeof gate.passed).toBe("boolean");
  });

  it("leakage gate passes structurally", () => {
    expect(result.leakageGate.passed).toBe(true);
  });

  it("leakageGateStatus is NOT_EVALUATED_SCAFFOLD_ONLY (scaffold stage)", () => {
    // Scaffold pass = NOT_EVALUATED_SCAFFOLD_ONLY (PIT audit deferred to next gate)
    expect(result.output.leakageGateStatus).toBe("NOT_EVALUATED_SCAFFOLD_ONLY");
  });

  it("no leakage gate violations", () => {
    expect(result.leakageGate.violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// P29G-T09: No forbidden performance fields in output
// ---------------------------------------------------------------------------
describe("P29G-T09: No forbidden performance fields in output", () => {
  let result: PaperSimulationDryRunResult;

  beforeAll(() => {
    result = generateP29GFixture();
  });

  it("output contains no forbidden output fields (FORBIDDEN_OUTPUT_FIELDS)", () => {
    const outputObj = result.output as unknown as Record<string, unknown>;
    for (const field of FORBIDDEN_OUTPUT_FIELDS) {
      expect(field in outputObj).toBe(false);
    }
  });

  it("output contains no forbidden action fields (FORBIDDEN_ACTION_FIELDS)", () => {
    const check = assertNoForbiddenActionFields(
      result.output as unknown as Record<string, unknown>
    );
    expect(check.valid).toBe(true);
    expect(check.violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// P29G-T10: FinancialReport remains HIGH_RISK_SOURCE_ABSENT
// ---------------------------------------------------------------------------
describe("P29G-T10: FinancialReport remains HIGH_RISK_SOURCE_ABSENT", () => {
  it("P29G_SOURCE_CLASSIFICATIONS has FinancialReport as HIGH_RISK_SOURCE_ABSENT", () => {
    const fr = P29G_SOURCE_CLASSIFICATIONS.find((s) => s.sourceName === "FinancialReport");
    expect(fr).toBeDefined();
    expect(fr!.status).toBe("HIGH_RISK_SOURCE_ABSENT");
  });

  it("FinancialReport entersAlphaScore=false", () => {
    const fr = P29G_SOURCE_CLASSIFICATIONS.find((s) => s.sourceName === "FinancialReport");
    expect(fr!.entersAlphaScore).toBe(false);
  });

  it("fixture output sourceClassifications has FinancialReport HIGH_RISK_SOURCE_ABSENT", () => {
    const result = generateP29GFixture();
    const fr = result.output.sourceClassifications.find(
      (s) => s.sourceName === "FinancialReport"
    );
    expect(fr).toBeDefined();
    expect(fr!.status).toBe("HIGH_RISK_SOURCE_ABSENT");
    expect(fr!.entersAlphaScore).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P29G-T11: NewsEvent remains HIGH_RISK_SOURCE_ABSENT
// ---------------------------------------------------------------------------
describe("P29G-T11: NewsEvent remains HIGH_RISK_SOURCE_ABSENT", () => {
  it("P29G_SOURCE_CLASSIFICATIONS has NewsEvent as HIGH_RISK_SOURCE_ABSENT", () => {
    const ne = P29G_SOURCE_CLASSIFICATIONS.find((s) => s.sourceName === "NewsEvent");
    expect(ne).toBeDefined();
    expect(ne!.status).toBe("HIGH_RISK_SOURCE_ABSENT");
  });

  it("NewsEvent entersAlphaScore=false", () => {
    const ne = P29G_SOURCE_CLASSIFICATIONS.find((s) => s.sourceName === "NewsEvent");
    expect(ne!.entersAlphaScore).toBe(false);
  });

  it("fixture output sourceClassifications has NewsEvent HIGH_RISK_SOURCE_ABSENT", () => {
    const result = generateP29GFixture();
    const ne = result.output.sourceClassifications.find(
      (s) => s.sourceName === "NewsEvent"
    );
    expect(ne).toBeDefined();
    expect(ne!.status).toBe("HIGH_RISK_SOURCE_ABSENT");
    expect(ne!.entersAlphaScore).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P29G-T12: HIGH_RISK sources do not enter alphaScore
// ---------------------------------------------------------------------------
describe("P29G-T12: HIGH_RISK_SOURCE_ABSENT sources do not enter alphaScore", () => {
  it("checkAlphaScoreGating returns no violations for canonical classifications", () => {
    const violations = checkAlphaScoreGating(P29G_SOURCE_CLASSIFICATIONS);
    expect(violations).toHaveLength(0);
  });

  it("checkAlphaScoreGating detects violation if HIGH_RISK source is incorrectly gated", () => {
    const badClassifications = [
      {
        sourceName: "FinancialReport",
        status: "HIGH_RISK_SOURCE_ABSENT" as const,
        entersAlphaScore: true, // violation
      },
    ];
    const violations = checkAlphaScoreGating(badClassifications);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain("FinancialReport");
    expect(violations[0]).toContain("BOUNDARY VIOLATION");
  });

  it("fixture output alphaScoreGatingViolations is empty", () => {
    const result = generateP29GFixture();
    expect(result.output.alphaScoreGatingViolations).toHaveLength(0);
  });

  it("fixture output governanceCheckPassed is true", () => {
    const result = generateP29GFixture();
    expect(result.output.governanceCheckPassed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P29G-T13: Quote / Regime / Chip represented as PIT_SAFE_VERIFIED
// ---------------------------------------------------------------------------
describe("P29G-T13: Quote / Regime / Chip represented as PIT_SAFE_VERIFIED", () => {
  ["Quote", "Regime", "Chip"].forEach((source) => {
    it(`${source} has status PIT_SAFE_VERIFIED in canonical classifications`, () => {
      const sc = P29G_SOURCE_CLASSIFICATIONS.find((s) => s.sourceName === source);
      expect(sc).toBeDefined();
      expect(sc!.status).toBe("PIT_SAFE_VERIFIED");
    });

    it(`${source} entersAlphaScore=false (scaffold representation only)`, () => {
      const sc = P29G_SOURCE_CLASSIFICATIONS.find((s) => s.sourceName === source);
      expect(sc!.entersAlphaScore).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// P29G-T14: Output determinism
// ---------------------------------------------------------------------------
describe("P29G-T14: Output determinism", () => {
  it("same seed + asOfDate + candidateId produces same runId", () => {
    const r1 = runPaperSimulationDryRun(FIXTURE_CONFIG);
    const r2 = runPaperSimulationDryRun(FIXTURE_CONFIG);
    expect(r1.output.runId).toBe(r2.output.runId);
  });

  it("same seed produces same contractVersion", () => {
    const r1 = runPaperSimulationDryRun(FIXTURE_CONFIG);
    const r2 = runPaperSimulationDryRun(FIXTURE_CONFIG);
    expect(r1.output.p29gContractVersion).toBe(r2.output.p29gContractVersion);
  });

  it("same seed produces same simulationMode", () => {
    const r1 = runPaperSimulationDryRun(FIXTURE_CONFIG);
    const r2 = runPaperSimulationDryRun(FIXTURE_CONFIG);
    expect(r1.output.simulationMode).toBe(r2.output.simulationMode);
  });
});

// ---------------------------------------------------------------------------
// P29G-T15: Output serializability
// ---------------------------------------------------------------------------
describe("P29G-T15: Output serializability", () => {
  it("output is JSON-serializable (no circular references)", () => {
    const result = generateP29GFixture();
    expect(() => JSON.stringify(result.output)).not.toThrow();
  });

  it("serialized output round-trips correctly", () => {
    const result = generateP29GFixture();
    const serialized = JSON.stringify(result.output);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    expect(parsed["runId"]).toBe(result.output.runId);
    expect(parsed["simulationMode"]).toBe("paper_only");
    expect(parsed["notInvestmentRecommendation"]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P29G-T16: No DB / corpus write
// ---------------------------------------------------------------------------
describe("P29G-T16: No DB / corpus write", () => {
  it("output.scoringMutation is false", () => {
    const result = generateP29GFixture();
    expect(result.output.scoringMutation).toBe(false);
  });

  it("output.corpusMutation is false", () => {
    const result = generateP29GFixture();
    expect(result.output.corpusMutation).toBe(false);
  });

  it("runner returns scaffoldOnly=true", () => {
    const result = generateP29GFixture();
    expect(result.scaffoldOnly).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P29G-T17: Source files do NOT import forbidden modules
// ---------------------------------------------------------------------------
describe("P29G-T17: P29G source files — no forbidden imports", () => {
  const FORBIDDEN_IMPORTS = [
    "prisma",
    "PrismaClient",
    "optimizer",
    "real_backtest",
    "realBacktest",
    "alphaScore",
    "RuleBasedStockAnalyzer",
    "SignalFusionEngine",
    "ActiveScoringSnapshotBuilder",
  ];

  P29G_SOURCE_FILES.forEach((filePath) => {
    const fileName = path.basename(filePath);
    it(`${fileName} does not import forbidden modules`, () => {
      const content = fs.readFileSync(filePath, "utf-8");
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(content).not.toContain(`from "${forbidden}"`);
        expect(content).not.toContain(`require("${forbidden}")`);
        // Allow if it appears only in comments/strings as a prohibition reference
        const codeLines = content.split("\n").filter(
          (line) => !line.trim().startsWith("*") && !line.trim().startsWith("//")
        );
        const codeContent = codeLines.join("\n");
        if (forbidden === "prisma" || forbidden === "PrismaClient") {
          expect(codeContent).not.toContain(`import.*${forbidden}`);
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// P29G-T18: Source files do NOT contain forbidden claim terms
// ---------------------------------------------------------------------------
describe("P29G-T18: P29G source files — no forbidden performance claims", () => {
  const FORBIDDEN_CLAIM_PATTERNS = [
    /\bROI\s*=\s*[0-9]/,
    /\bwinRate\s*=\s*[0-9]/,
    /\bprofit\s*=\s*[0-9]/,
    /\boutperform\s*=\s*true/,
    /expectedReturn\s*=\s*[0-9]/,
    /\bbuySignal\s*=\s*true/,
    /\bsellSignal\s*=\s*true/,
  ];

  P29G_SOURCE_FILES.forEach((filePath) => {
    const fileName = path.basename(filePath);
    it(`${fileName} contains no forbidden performance claim assignments`, () => {
      const content = fs.readFileSync(filePath, "utf-8");
      for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
        expect(content).not.toMatch(pattern);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// P29G-T19: Report generation — no performance claims
// ---------------------------------------------------------------------------
describe("P29G-T19: Report generation — no performance claims", () => {
  let reportMarkdown: string;

  beforeAll(() => {
    const result = generateP29GFixture();
    const report = generateDryRunReport(result);
    reportMarkdown = serializeDryRunReportToMarkdown(report);
  });

  it("generated report contains no ROI/profit/win-rate values", () => {
    expect(reportMarkdown).not.toMatch(/\bROI\s*[:=]\s*[0-9]/i);
    expect(reportMarkdown).not.toMatch(/\bprofit\s*[:=]\s*[0-9]/i);
    expect(reportMarkdown).not.toMatch(/win.?rate\s*[:=]\s*[0-9]/i);
  });

  it("generated report contains no buy/sell/hold signals", () => {
    expect(reportMarkdown.toLowerCase()).not.toMatch(/\bbuy signal\b/);
    expect(reportMarkdown.toLowerCase()).not.toMatch(/\bsell signal\b/);
  });

  it("generated report contains NOT INVESTMENT RECOMMENDATION disclaimer", () => {
    expect(reportMarkdown.toLowerCase()).toContain("not investment recommendation");
  });

  it("generated report contains PAPER ONLY flag", () => {
    expect(reportMarkdown.toUpperCase()).toContain("PAPER ONLY");
  });
});

// ---------------------------------------------------------------------------
// P29G-T20: Report governance flags
// ---------------------------------------------------------------------------
describe("P29G-T20: Report governance flags", () => {
  it("report dryRunOnly=true", () => {
    const result = generateP29GFixture();
    const report = generateDryRunReport(result);
    expect(report.dryRunOnly).toBe(true);
  });

  it("report paperOnly=true", () => {
    const result = generateP29GFixture();
    const report = generateDryRunReport(result);
    expect(report.paperOnly).toBe(true);
  });

  it("report notInvestmentRecommendation=true", () => {
    const result = generateP29GFixture();
    const report = generateDryRunReport(result);
    expect(report.notInvestmentRecommendation).toBe(true);
  });

  it("report mutationSafety all false", () => {
    const result = generateP29GFixture();
    const report = generateDryRunReport(result);
    expect(report.mutationSafety.scoringMutation).toBe(false);
    expect(report.mutationSafety.corpusMutation).toBe(false);
    expect(report.mutationSafety.optimizerExecuted).toBe(false);
    expect(report.mutationSafety.realBacktestExecuted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P29G-T21: Source coverage summary
// ---------------------------------------------------------------------------
describe("P29G-T21: Source coverage summary in report", () => {
  it("report source coverage total matches classification count", () => {
    const result = generateP29GFixture();
    const report = generateDryRunReport(result);
    expect(report.sourceCoverage.total).toBe(
      result.output.sourceClassifications.length
    );
  });

  it("report sourceCoverage.highRiskAbsentSources includes FinancialReport and NewsEvent", () => {
    const result = generateP29GFixture();
    const report = generateDryRunReport(result);
    expect(report.sourceCoverage.highRiskAbsentSources).toContain("FinancialReport");
    expect(report.sourceCoverage.highRiskAbsentSources).toContain("NewsEvent");
  });

  it("report sourceCoverage.alphaScoreGated is 0", () => {
    const result = generateP29GFixture();
    const report = generateDryRunReport(result);
    expect(report.sourceCoverage.alphaScoreGated).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// P29G-T22: resolveSourceClassifications — caller overrides canonical
// ---------------------------------------------------------------------------
describe("P29G-T22: resolveSourceClassifications merging", () => {
  it("returns canonical classifications when no caller overrides", () => {
    const resolved = resolveSourceClassifications();
    expect(resolved.length).toBe(P29G_SOURCE_CLASSIFICATIONS.length);
  });

  it("caller can override a canonical classification by sourceName", () => {
    const override = [
      {
        sourceName: "MonthlyRevenue",
        status: "PIT_SAFE_VERIFIED" as const,
        entersAlphaScore: false,
      },
    ];
    const resolved = resolveSourceClassifications(override);
    const mr = resolved.find((s) => s.sourceName === "MonthlyRevenue");
    expect(mr!.status).toBe("PIT_SAFE_VERIFIED");
  });

  it("caller can add a new source classification", () => {
    const extra = [
      {
        sourceName: "CustomSource",
        status: "STRUCTURAL_PLACEHOLDER_ONLY" as const,
        entersAlphaScore: false,
      },
    ];
    const resolved = resolveSourceClassifications(extra);
    expect(resolved.find((s) => s.sourceName === "CustomSource")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// P29G-T23: Runner throws for null config
// ---------------------------------------------------------------------------
describe("P29G-T23: Runner throws for null / invalid config", () => {
  it("throws for null config", () => {
    expect(() =>
      runPaperSimulationDryRun(null as unknown as Parameters<typeof runPaperSimulationDryRun>[0])
    ).toThrow("P29G: config must not be null/undefined");
  });
});

// ---------------------------------------------------------------------------
// P29G-T24: Input validation — asOfDate format
// ---------------------------------------------------------------------------
describe("P29G-T24: Input validation — asOfDate format", () => {
  it("rejects invalid asOfDate format", () => {
    const result = validateDryRunInputConfig({
      ...FIXTURE_CONFIG,
      asOfDate: "20260115",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("asOfDate"))).toBe(true);
  });

  it("accepts valid asOfDate YYYY-MM-DD", () => {
    const result = validateDryRunInputConfig(FIXTURE_CONFIG);
    expect(result.errors.filter((e) => e.includes("asOfDate"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// P29G-T25: BLOCKED source alphaScore gating
// ---------------------------------------------------------------------------
describe("P29G-T25: BLOCKED source must not enter alphaScore", () => {
  it("checkAlphaScoreGating detects violation for BLOCKED source with entersAlphaScore=true", () => {
    const violations = checkAlphaScoreGating([
      {
        sourceName: "SomeBlockedSource",
        status: "BLOCKED",
        entersAlphaScore: true,
      },
    ]);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain("SomeBlockedSource");
    expect(violations[0]).toContain("BOUNDARY VIOLATION");
  });

  it("BLOCKED source with entersAlphaScore=false passes check", () => {
    const violations = checkAlphaScoreGating([
      {
        sourceName: "SomeBlockedSource",
        status: "BLOCKED",
        entersAlphaScore: false,
      },
    ]);
    expect(violations).toHaveLength(0);
  });
});
