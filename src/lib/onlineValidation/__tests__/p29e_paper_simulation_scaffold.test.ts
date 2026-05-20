/**
 * P29E: Paper Simulation Scaffold Tests
 * paper-only / simulation-only / NOT investment recommendation
 */

import {
  runPaperSimulationScaffold,
  generateP29EFixture,
} from "../p29e/PaperSimulationScaffoldRunner";
import {
  FORBIDDEN_OUTPUT_FIELDS,
  assertNoForbiddenFields,
} from "../p29e/PaperSimulationOutputSchema";
import {
  runLeakageGatePlaceholder,
  isPaperSimulationOutput,
} from "../p29e/LeakageGatePlaceholder";

// ── Test 1: runner exists ────────────────────────────────────────────────────
describe("P29E-T01: runner exists", () => {
  it("runPaperSimulationScaffold is a function", () => {
    expect(typeof runPaperSimulationScaffold).toBe("function");
  });

  it("generateP29EFixture is a function", () => {
    expect(typeof generateP29EFixture).toBe("function");
  });
});

// ── Test 2: runner default dryRun true ──────────────────────────────────────
describe("P29E-T02: runner default dryRun = true", () => {
  it("returns dryRun=true when not specified", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    expect(result.dryRun).toBe(true);
  });

  it("returns dryRun=true when explicitly set true", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
  });

  it("scaffoldOnly is always true", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    expect(result.scaffoldOnly).toBe(true);
  });
});

// ── Test 3: simulationMode = paper_only ─────────────────────────────────────
describe("P29E-T03: simulationMode = paper_only", () => {
  it("output simulationMode is paper_only", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    expect(result.output.simulationMode).toBe("paper_only");
  });
});

// ── Test 4: notInvestmentRecommendation = true ───────────────────────────────
describe("P29E-T04: notInvestmentRecommendation = true", () => {
  it("notInvestmentRecommendation is true", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    expect(result.output.notInvestmentRecommendation).toBe(true);
  });

  it("fixture notInvestmentRecommendation is true", () => {
    const fixture = generateP29EFixture();
    expect(fixture.output.notInvestmentRecommendation).toBe(true);
  });
});

// ── Test 5: scoringMutation = false ─────────────────────────────────────────
describe("P29E-T05: scoringMutation = false", () => {
  it("scoringMutation is false", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    expect(result.output.scoringMutation).toBe(false);
  });
});

// ── Test 6: corpusMutation = false ──────────────────────────────────────────
describe("P29E-T06: corpusMutation = false", () => {
  it("corpusMutation is false", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    expect(result.output.corpusMutation).toBe(false);
  });
});

// ── Test 7: optimizerExecuted = false ───────────────────────────────────────
describe("P29E-T07: optimizerExecuted = false", () => {
  it("optimizerExecuted is false", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    expect(result.output.optimizerExecuted).toBe(false);
  });
});

// ── Test 8: realBacktestExecuted = false ────────────────────────────────────
describe("P29E-T08: realBacktestExecuted = false", () => {
  it("realBacktestExecuted is false", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    expect(result.output.realBacktestExecuted).toBe(false);
  });
});

// ── Test 9: leakageGateStatus exists ────────────────────────────────────────
describe("P29E-T09: leakageGateStatus exists", () => {
  it("output has leakageGateStatus field", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    expect(result.output.leakageGateStatus).toBeDefined();
    expect(typeof result.output.leakageGateStatus).toBe("string");
  });

  it("leakageGate result is present", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    expect(result.leakageGate).toBeDefined();
    expect(result.leakageGate.checkedAt).toBeDefined();
  });

  it("scaffold-mode output passes leakage gate structurally", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    expect(result.leakageGate.passed).toBe(true);
    expect(result.leakageGate.violations).toHaveLength(0);
  });
});

// ── Test 10: output schema forbids production claim fields ───────────────────
describe("P29E-T10: output schema forbids production claim fields", () => {
  it("FORBIDDEN_OUTPUT_FIELDS list is not empty", () => {
    expect(FORBIDDEN_OUTPUT_FIELDS.length).toBeGreaterThan(0);
  });

  it("output has no forbidden fields", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    const { valid, violations } = assertNoForbiddenFields(
      result.output as unknown as Record<string, unknown>
    );
    expect(valid).toBe(true);
    expect(violations).toHaveLength(0);
  });

  it("output with forbidden field fails assertNoForbiddenFields", () => {
    const badOutput = {
      simulationMode: "paper_only",
      roi: 0.15,
      notInvestmentRecommendation: true,
    };
    const { valid, violations } = assertNoForbiddenFields(badOutput);
    expect(valid).toBe(false);
    expect(violations).toContain("roi");
  });

  it("leakage gate rejects output with forbidden field", () => {
    const badOutput = {
      simulationMode: "paper_only",
      notInvestmentRecommendation: true,
      scoringMutation: false,
      corpusMutation: false,
      optimizerExecuted: false,
      realBacktestExecuted: false,
      profit: 12345,
    };
    const gateResult = runLeakageGatePlaceholder(badOutput);
    expect(gateResult.passed).toBe(false);
    expect(gateResult.violations.some((v) => v.includes("profit"))).toBe(true);
  });
});

// ── Test 11: fixture contains no forbidden claim terms ───────────────────────
describe("P29E-T11: fixture contains no forbidden claim terms", () => {
  const fixture = generateP29EFixture();
  const fixtureStr = JSON.stringify(fixture.output);

  // These terms must not appear as data claims in the output
  const forbiddenTerms = [
    /\broi\b/i,
    /\bwin.?rate\b/i,
    /\balpha\b(?!Score)/i,
    /\bedge\b/i,
    /\bprofit\b/i,
    /\boutperform\b/i,
    /\bbeat\b/i,
    /\bbuy\b/i,
    /\bsell\b/i,
    /\bguaranteed\b/i,
    /investment recommendation/i,
    /買進/,
    /賣出/,
    /買入/,
  ];

  forbiddenTerms.forEach((term) => {
    it(`fixture output does not contain forbidden term: ${term}`, () => {
      // Exclude the warnings/notes that list forbidden terms as prohibited
      const outputCopy = {
        ...fixture.output,
        warnings: [],
        scaffoldNotes: [],
      };
      const str = JSON.stringify(outputCopy);
      expect(str).not.toMatch(term);
    });
  });
});

// ── Test 12: runner does not import production scoring analyzer ──────────────
describe("P29E-T12: runner does not import production scoring analyzer", () => {
  it("PaperSimulationScaffoldRunner source does not reference RuleBasedStockAnalyzer", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const runnerPath = path.resolve(
      __dirname,
      "../p29e/PaperSimulationScaffoldRunner.ts"
    );
    const source = fs.readFileSync(runnerPath, "utf-8");
    expect(source).not.toContain("RuleBasedStockAnalyzer");
  });

  it("PaperSimulationScaffoldRunner source does not reference SignalFusionEngine", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const runnerPath = path.resolve(
      __dirname,
      "../p29e/PaperSimulationScaffoldRunner.ts"
    );
    const source = fs.readFileSync(runnerPath, "utf-8");
    expect(source).not.toContain("SignalFusionEngine");
  });

  it("PaperSimulationScaffoldRunner source does not reference ActiveScoringSnapshotBuilder", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const runnerPath = path.resolve(
      __dirname,
      "../p29e/PaperSimulationScaffoldRunner.ts"
    );
    const source = fs.readFileSync(runnerPath, "utf-8");
    expect(source).not.toContain("ActiveScoringSnapshotBuilder");
  });
});

// ── Test 13: runner does not import optimizer ────────────────────────────────
describe("P29E-T13: runner does not import optimizer", () => {
  it("PaperSimulationScaffoldRunner does not import any optimizer module", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const runnerPath = path.resolve(
      __dirname,
      "../p29e/PaperSimulationScaffoldRunner.ts"
    );
    const source = fs.readFileSync(runnerPath, "utf-8");
    // Check for actual imports — mentions in comments are benign documentation
    expect(source).not.toMatch(/^import.*[Oo]ptimizer/m);
    expect(source).not.toMatch(/require\s*\(.*[Oo]ptimizer/);
    expect(source).not.toMatch(/new\s+[A-Z][a-zA-Z]*[Oo]ptimizer/);
    expect(source).not.toMatch(/GridSearch|BayesianOpt|ParamSearch/);
  });
});

// ── Test 14: runner does not write DB ───────────────────────────────────────
describe("P29E-T14: runner does not write DB", () => {
  it("PaperSimulationScaffoldRunner does not import prisma client", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const runnerPath = path.resolve(
      __dirname,
      "../p29e/PaperSimulationScaffoldRunner.ts"
    );
    const source = fs.readFileSync(runnerPath, "utf-8");
    // Check for actual prisma imports — mentions in comments are benign documentation
    expect(source).not.toMatch(/^import.*prisma/m);
    expect(source).not.toMatch(/require\s*\(.*prisma/);
    expect(source).not.toMatch(/from\s+['"]@\/lib\/prisma['"]/);
    expect(source).not.toMatch(/from\s+['"]@prisma\/client['"]/);
  });

  it("PaperSimulationScaffoldRunner does not call DB write methods", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const runnerPath = path.resolve(
      __dirname,
      "../p29e/PaperSimulationScaffoldRunner.ts"
    );
    const source = fs.readFileSync(runnerPath, "utf-8");
    // Check for DB mutation calls (not just mentions)
    expect(source).not.toMatch(/prisma\.[a-z]+\.(create|upsert|update|delete)\s*\(/);
    expect(source).not.toContain("appendFileSync");
    expect(source).not.toContain("writeFileSync");
  });
});

// ── Test 15: runner does not mutate corpus ───────────────────────────────────
describe("P29E-T15: runner does not mutate corpus", () => {
  it("PaperSimulationScaffoldRunner source does not write to jsonl files", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const runnerPath = path.resolve(
      __dirname,
      "../p29e/PaperSimulationScaffoldRunner.ts"
    );
    const source = fs.readFileSync(runnerPath, "utf-8");
    // Check for actual file write operations — mentions in comments are benign documentation
    expect(source).not.toContain("appendFileSync");
    expect(source).not.toContain("writeFileSync");
    expect(source).not.toContain("createWriteStream");
    // Check for actual jsonl write calls (not comment mentions like "*.jsonl")
    expect(source).not.toMatch(/\.write\s*\(.*\.jsonl/);
    expect(source).not.toMatch(/fs\..*\(.*\.jsonl/);
  });

  it("corpusMutation is always false in runner output", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-corpus-check",
    });
    expect(result.output.corpusMutation).toBe(false);
  });
});

// ── Test 16: FinancialReport / NewsEvent remains entersAlphaScore=false ──────
describe("P29E-T16: FinancialReport / NewsEvent entersAlphaScore=false", () => {
  it("sourceFeaturePitStatus is AVAILABLE_NEEDS_VALIDATION (not AVAILABLE_PIT_SAFE)", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    // FinancialReport/NewsEvent are HIGH_RISK_SOURCE_ABSENT
    // Current scaffold uses AVAILABLE_NEEDS_VALIDATION for Quote/Regime/Chip
    expect(result.output.sourceFeaturePitStatus).not.toBe("AVAILABLE_PIT_SAFE");
  });

  it("warnings mention FinancialReport/NewsEvent remain HIGH_RISK_SOURCE_ABSENT", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    const warningsStr = result.output.warnings.join(" ");
    expect(warningsStr).toContain("HIGH_RISK_SOURCE_ABSENT");
    expect(warningsStr).toContain("entersAlphaScore=false");
  });
});

// ── Test 17: Quote / Regime / Chip remains AVAILABLE_NEEDS_VALIDATION ────────
describe("P29E-T17: Quote/Regime/Chip not promoted to AVAILABLE_PIT_SAFE", () => {
  it("sourceFeaturePitStatus is AVAILABLE_NEEDS_VALIDATION", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    expect(result.output.sourceFeaturePitStatus).toBe(
      "AVAILABLE_NEEDS_VALIDATION"
    );
  });

  it("warnings mention PIT audit is next hard gate", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    const allText = [
      ...result.output.warnings,
      ...(result.output.scaffoldNotes ?? []),
    ].join(" ");
    expect(allText).toMatch(/PIT.*audit|audit.*PIT/i);
  });

  it("scaffoldNotes mention next hard gate is PIT Validation Audit", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    const notes = (result.output.scaffoldNotes ?? []).join(" ");
    expect(notes).toContain("PIT Validation Audit");
  });
});

// ── Test 18: P27 / scanner consolidation not touched ─────────────────────────
describe("P29E-T18: P27/scanner consolidation not touched", () => {
  it("PaperSimulationScaffoldRunner does not reference P27", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const files = [
      path.resolve(__dirname, "../p29e/PaperSimulationScaffoldRunner.ts"),
      path.resolve(__dirname, "../p29e/LeakageGatePlaceholder.ts"),
      path.resolve(__dirname, "../p29e/PaperSimulationOutputSchema.ts"),
    ];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf-8");
      expect(source).not.toMatch(/\bP27\b/);
      expect(source).not.toMatch(/scanner.*consolidat/i);
      expect(source).not.toMatch(/phase.*registry.*cleanup/i);
    }
  });
});

// ── Test 19: sample output is deterministic ───────────────────────────────────
describe("P29E-T19: sample output is deterministic", () => {
  it("two fixture calls with same seed produce same runId", () => {
    const r1 = generateP29EFixture();
    const r2 = generateP29EFixture();
    expect(r1.output.runId).toBe(r2.output.runId);
  });

  it("two runs with same config produce same runId", () => {
    const config = {
      asOfDate: "2026-01-15",
      candidateId: "det-test",
      seed: "determinism-test",
    };
    const r1 = runPaperSimulationScaffold(config);
    const r2 = runPaperSimulationScaffold(config);
    expect(r1.output.runId).toBe(r2.output.runId);
    expect(r1.output.simulationMode).toBe(r2.output.simulationMode);
    expect(r1.output.notInvestmentRecommendation).toBe(
      r2.output.notInvestmentRecommendation
    );
  });

  it("runId encodes asOfDate and candidateId", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-03-01",
      candidateId: "my-candidate",
      seed: "test-seed",
    });
    expect(result.output.runId).toContain("2026-03-01");
    expect(result.output.runId).toContain("my-candidate");
  });
});

// ── Test 20: next prompt forces Quote/Regime/Chip PIT audit after P29-E ──────
describe("P29E-T20: next prompt artifact forces PIT audit", () => {
  it("scaffoldNotes reference Axis A trust root (PIT audit)", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    const notes = (result.output.scaffoldNotes ?? []).join(" ");
    expect(notes).toContain("Axis A");
  });

  it("leakageGate scaffoldNote references PIT audit as next hard gate", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "test-001",
    });
    expect(result.leakageGate.scaffoldNote.toLowerCase()).toContain("next hard gate");
    expect(result.leakageGate.scaffoldNote).toContain("PIT Validation Audit");
  });
});

// ── Additional leakage gate edge cases ───────────────────────────────────────
describe("P29E: LeakageGatePlaceholder edge cases", () => {
  it("rejects output with missing simulationMode", () => {
    const bad = {
      notInvestmentRecommendation: true,
      scoringMutation: false,
      corpusMutation: false,
      optimizerExecuted: false,
      realBacktestExecuted: false,
    };
    const gate = runLeakageGatePlaceholder(bad);
    expect(gate.passed).toBe(false);
    expect(gate.violations.some((v) => v.includes("simulationMode"))).toBe(
      true
    );
  });

  it("rejects output with scoringMutation=true", () => {
    const bad = {
      simulationMode: "paper_only",
      notInvestmentRecommendation: true,
      scoringMutation: true,
      corpusMutation: false,
      optimizerExecuted: false,
      realBacktestExecuted: false,
    };
    const gate = runLeakageGatePlaceholder(bad);
    expect(gate.passed).toBe(false);
  });

  it("rejects output with future-labeled field outcomePrice", () => {
    const bad = {
      simulationMode: "paper_only",
      notInvestmentRecommendation: true,
      scoringMutation: false,
      corpusMutation: false,
      optimizerExecuted: false,
      realBacktestExecuted: false,
      outcomePrice: 150.0,
    };
    const gate = runLeakageGatePlaceholder(bad);
    expect(gate.passed).toBe(false);
    expect(gate.status).toBe("FAILED_FUTURE_LABEL_DETECTED");
  });

  it("isPaperSimulationOutput returns true for valid output", () => {
    const result = runPaperSimulationScaffold({
      asOfDate: "2026-01-15",
      candidateId: "type-guard-test",
    });
    expect(isPaperSimulationOutput(result.output)).toBe(true);
  });

  it("isPaperSimulationOutput returns false for null", () => {
    expect(isPaperSimulationOutput(null)).toBe(false);
  });

  it("isPaperSimulationOutput returns false for missing required fields", () => {
    const partial = {
      runId: "test",
      asOfDate: "2026-01-15",
      // missing simulationMode, notInvestmentRecommendation, mutation flags
    };
    expect(isPaperSimulationOutput(partial)).toBe(false);
  });
});
