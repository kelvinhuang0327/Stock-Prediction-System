/**
 * P29I: Quote / Regime / Chip PIT Validation Audit Test Suite
 *
 * paper-only / audit-only / NOT investment recommendation
 * Does NOT test trading strategy, returns, alpha, or predictive performance.
 * Tests ONLY: PIT-safety rules, scanner determinism, forbidden field rejection,
 * source governance classification, and evidence requirements.
 *
 * 15 test scenarios covering all P29I audit requirements.
 */

import {
  PIT_SAFETY_RULES,
  getRuleById,
  getMandatoryRules,
  getRulesByCategory,
  isForbiddenField,
  matchedForbiddenPatterns,
  ALL_FORBIDDEN_FIELD_PATTERNS,
} from "../p29i/PitSafetyRules";

import {
  scanSource,
  runScan,
  CANONICAL_P29I_SCAN_INPUTS,
  ALPHA_SCORE_PERMITTED_SOURCES,
  ALPHA_SCORE_BLOCKED_SOURCES,
  ALPHA_SCORE_NOT_YET_APPROVED_SOURCES,
  P29I_SCANNER_VERSION,
  SourceAuditInput,
} from "../p29i/QuoteRegimeChipPitAuditScanner";

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("P29I: Quote / Regime / Chip PIT Validation Audit", () => {
  // -------------------------------------------------------------------------
  // T01 — Quote source requires asOfDate (PSR-01 + PSR-08 + PSR-09)
  // -------------------------------------------------------------------------
  it("T01: Quote source requires asOfDate and gate — scan passes when present", () => {
    const quote = CANONICAL_P29I_SCAN_INPUTS.find((s) => s.sourceName === "Quote")!;
    const output = scanSource(quote);

    const psr01 = output.ruleChecks.find((r) => r.ruleId === "PSR-01")!;
    const psr08 = output.ruleChecks.find((r) => r.ruleId === "PSR-08")!;
    const psr09 = output.ruleChecks.find((r) => r.ruleId === "PSR-09")!;

    expect(psr01.passed).toBe(true);
    expect(psr08.passed).toBe(true);
    expect(psr09.passed).toBe(true);
    expect(output.result).toBe("PASS_PIT_SAFE");
  });

  // -------------------------------------------------------------------------
  // T02 — Regime source requires asOfDate
  // -------------------------------------------------------------------------
  it("T02: Regime source requires asOfDate and gate — scan passes when present", () => {
    const regime = CANONICAL_P29I_SCAN_INPUTS.find((s) => s.sourceName === "Regime")!;
    const output = scanSource(regime);

    const psr01 = output.ruleChecks.find((r) => r.ruleId === "PSR-01")!;
    const psr08 = output.ruleChecks.find((r) => r.ruleId === "PSR-08")!;
    const psr09 = output.ruleChecks.find((r) => r.ruleId === "PSR-09")!;

    expect(psr01.passed).toBe(true);
    expect(psr08.passed).toBe(true);
    expect(psr09.passed).toBe(true);
    expect(output.result).toBe("PASS_PIT_SAFE");
  });

  // -------------------------------------------------------------------------
  // T03 — Chip source requires asOfDate (WARN due to publication lag)
  // -------------------------------------------------------------------------
  it("T03: Chip source requires asOfDate and gate — WARN_ASSUMPTION_REQUIRED for publication lag", () => {
    const chip = CANONICAL_P29I_SCAN_INPUTS.find((s) => s.sourceName === "Chip")!;
    const output = scanSource(chip);

    const psr01 = output.ruleChecks.find((r) => r.ruleId === "PSR-01")!;
    const psr08 = output.ruleChecks.find((r) => r.ruleId === "PSR-08")!;
    const psr09 = output.ruleChecks.find((r) => r.ruleId === "PSR-09")!;
    const psr14 = output.ruleChecks.find((r) => r.ruleId === "PSR-14")!;

    expect(psr01.passed).toBe(true);
    expect(psr08.passed).toBe(true);
    expect(psr09.passed).toBe(true);
    expect(psr14.passed).toBe(true); // lag documented
    expect(chip.hasPublicationLagAssumption).toBe(true);
    expect(output.result).toBe("WARN_ASSUMPTION_REQUIRED");
  });

  // -------------------------------------------------------------------------
  // T04 — futureReturn / outcomePrice / realizedReturn fields are rejected
  // -------------------------------------------------------------------------
  it("T04: futureReturn, outcomePrice, realizedReturn fields trigger FAIL_LEAKAGE_RISK", () => {
    const contaminatedInput: SourceAuditInput = {
      sourceName: "Quote",
      hasDateField: true,
      dateFieldName: "date",
      dateFormatConsistent: true,
      hasGate: true,
      gateEffective: true,
      asOfPropagated: true,
      knownFields: ["id", "symbol", "date", "close", "futureReturn", "outcomePrice", "realizedReturn"],
      p29fStatus: "PIT_SAFE_VERIFIED",
      hasP29FEvidence: true,
      permittedInAlphaScore: true,
      hasPublicationLagAssumption: false,
      simulationBoundaryEnforced: true,
    };

    const output = scanSource(contaminatedInput);

    expect(output.forbiddenFieldsFound).toEqual(
      expect.arrayContaining(["futureReturn", "outcomePrice", "realizedReturn"])
    );
    expect(output.result).toBe("FAIL_LEAKAGE_RISK");
  });

  // -------------------------------------------------------------------------
  // T05 — target / label fields are rejected
  // -------------------------------------------------------------------------
  it("T05: targetLabel, outcomeLabel, classLabel fields trigger FAIL_LEAKAGE_RISK", () => {
    const labelLeakInput: SourceAuditInput = {
      sourceName: "Regime",
      hasDateField: true,
      dateFieldName: "date",
      dateFormatConsistent: true,
      hasGate: true,
      gateEffective: true,
      asOfPropagated: true,
      knownFields: ["id", "date", "ma50", "targetLabel", "outcomeLabel"],
      p29fStatus: "PIT_SAFE_VERIFIED",
      hasP29FEvidence: true,
      permittedInAlphaScore: true,
      hasPublicationLagAssumption: false,
      simulationBoundaryEnforced: true,
    };

    const output = scanSource(labelLeakInput);

    expect(output.forbiddenFieldsFound).toEqual(
      expect.arrayContaining(["targetLabel", "outcomeLabel"])
    );
    expect(output.result).toBe("FAIL_LEAKAGE_RISK");
  });

  // -------------------------------------------------------------------------
  // T06 — FinancialReport remains blocked
  // -------------------------------------------------------------------------
  it("T06: FinancialReport remains blocked — PSR-11 passes (correctly not in alphaScore)", () => {
    const fr = CANONICAL_P29I_SCAN_INPUTS.find((s) => s.sourceName === "FinancialReport")!;
    const output = scanSource(fr);

    const psr11 = output.ruleChecks.find((r) => r.ruleId === "PSR-11")!;
    expect(psr11.passed).toBe(true);
    expect(psr11.detail).toContain("correctly blocked");
    expect(fr.permittedInAlphaScore).toBe(false);
    // Result is not FAIL — blocked = correct state
    expect(output.result).not.toBe("FAIL_LEAKAGE_RISK");
  });

  // -------------------------------------------------------------------------
  // T07 — NewsEvent remains blocked
  // -------------------------------------------------------------------------
  it("T07: NewsEvent remains blocked — PSR-12 passes (correctly not in alphaScore)", () => {
    const ne = CANONICAL_P29I_SCAN_INPUTS.find((s) => s.sourceName === "NewsEvent")!;
    const output = scanSource(ne);

    const psr12 = output.ruleChecks.find((r) => r.ruleId === "PSR-12")!;
    expect(psr12.passed).toBe(true);
    expect(psr12.detail).toContain("correctly blocked");
    expect(ne.permittedInAlphaScore).toBe(false);
    expect(output.result).not.toBe("FAIL_LEAKAGE_RISK");
  });

  // -------------------------------------------------------------------------
  // T08 — MonthlyRevenue not in alphaScore
  // -------------------------------------------------------------------------
  it("T08: MonthlyRevenue not in alphaScore — PSR-13 passes", () => {
    const mr = CANONICAL_P29I_SCAN_INPUTS.find((s) => s.sourceName === "MonthlyRevenue")!;
    const output = scanSource(mr);

    const psr13 = output.ruleChecks.find((r) => r.ruleId === "PSR-13")!;
    expect(psr13.passed).toBe(true);
    expect(mr.permittedInAlphaScore).toBe(false);
  });

  // -------------------------------------------------------------------------
  // T09 — alphaScore allowed source list = only Quote / Regime / Chip
  // -------------------------------------------------------------------------
  it("T09: ALPHA_SCORE_PERMITTED_SOURCES contains exactly Quote, Regime, Chip", () => {
    expect(ALPHA_SCORE_PERMITTED_SOURCES).toHaveLength(3);
    expect(ALPHA_SCORE_PERMITTED_SOURCES).toContain("Quote");
    expect(ALPHA_SCORE_PERMITTED_SOURCES).toContain("Regime");
    expect(ALPHA_SCORE_PERMITTED_SOURCES).toContain("Chip");

    expect(ALPHA_SCORE_PERMITTED_SOURCES).not.toContain("FinancialReport");
    expect(ALPHA_SCORE_PERMITTED_SOURCES).not.toContain("NewsEvent");
    expect(ALPHA_SCORE_PERMITTED_SOURCES).not.toContain("MonthlyRevenue");
  });

  // -------------------------------------------------------------------------
  // T10 — scanner returns deterministic result (same input, same output)
  // -------------------------------------------------------------------------
  it("T10: scanner produces identical result on repeated calls with same input", () => {
    const quote = CANONICAL_P29I_SCAN_INPUTS.find((s) => s.sourceName === "Quote")!;

    const run1 = scanSource(quote);
    const run2 = scanSource(quote);
    const run3 = scanSource(quote);

    expect(run1.result).toBe(run2.result);
    expect(run2.result).toBe(run3.result);
    expect(run1.ruleChecks.map((r) => r.passed)).toEqual(run2.ruleChecks.map((r) => r.passed));
    expect(run2.ruleChecks.map((r) => r.passed)).toEqual(run3.ruleChecks.map((r) => r.passed));
    expect(run1.forbiddenFieldsFound).toEqual(run2.forbiddenFieldsFound);
  });

  // -------------------------------------------------------------------------
  // T11 — scanner output serializes to JSON (no circular refs, no undefined)
  // -------------------------------------------------------------------------
  it("T11: scanner report serializes to JSON without errors", () => {
    const report = runScan([...CANONICAL_P29I_SCAN_INPUTS]);

    let serialized: string;
    expect(() => {
      serialized = JSON.stringify(report, null, 2);
    }).not.toThrow();

    const parsed = JSON.parse(serialized!);
    expect(parsed.scannerVersion).toBe(P29I_SCANNER_VERSION);
    expect(Array.isArray(parsed.sourceOutputs)).toBe(true);
    expect(parsed.sourceOutputs).toHaveLength(CANONICAL_P29I_SCAN_INPUTS.length);
    expect(parsed.disclaimer).toContain("AUDIT-ONLY");
  });

  // -------------------------------------------------------------------------
  // T12 — scanner markdown report line contains no performance claim
  // -------------------------------------------------------------------------
  it("T12: scanner report line and summary contain no performance or financial claim language", () => {
    const report = runScan([...CANONICAL_P29I_SCAN_INPUTS]);
    const forbiddenTerms = [
      "profit",
      "return",
      "alpha",
      "edge",
      "outperform",
      "win rate",
      "accuracy",
      "roi",
      "sharpe",
      "backtest result",
      "predicted gain",
    ];

    const summaryLower = report.summary.toLowerCase();
    const allReportLines = report.sourceOutputs.map((o) => o.reportLine.toLowerCase()).join(" ");

    for (const term of forbiddenTerms) {
      expect(summaryLower).not.toContain(term);
      expect(allReportLines).not.toContain(term);
    }
  });

  // -------------------------------------------------------------------------
  // T13 — no buy/sell/hold language in scanner output
  // -------------------------------------------------------------------------
  it("T13: scanner output contains no buy/sell/hold/trade/invest language", () => {
    const report = runScan([...CANONICAL_P29I_SCAN_INPUTS]);
    const actionTerms = ["buy", "sell", "hold", "trade", "invest", "recommendation"];

    const fullText = JSON.stringify(report).toLowerCase();
    for (const term of actionTerms) {
      // Disclaimer mentions "advice" in context of "NOT investment advice" — that's allowed.
      // We check actionTerms only, not the disclaimer field.
      const relevantFields = report.sourceOutputs
        .map((o) => `${o.reportLine} ${o.assumptionNotes.join(" ")} ${o.sourceName}`)
        .join(" ")
        .toLowerCase();
      expect(relevantFields).not.toContain(term);
    }

    // The summary should not contain these terms
    const summaryLower = report.summary.toLowerCase();
    for (const term of actionTerms) {
      expect(summaryLower).not.toContain(term);
    }
  });

  // -------------------------------------------------------------------------
  // T14 — missing evidence causes BLOCKED_MISSING_EVIDENCE
  // -------------------------------------------------------------------------
  it("T14: source claiming PIT_SAFE_VERIFIED without P29F evidence returns BLOCKED_MISSING_EVIDENCE", () => {
    const noEvidence: SourceAuditInput = {
      sourceName: "Quote",
      hasDateField: true,
      dateFieldName: "date",
      dateFormatConsistent: true,
      hasGate: true,
      gateEffective: true,
      asOfPropagated: true,
      knownFields: ["id", "symbol", "date", "close", "volume"],
      p29fStatus: "PIT_SAFE_VERIFIED",
      hasP29FEvidence: false, // <-- evidence absent
      permittedInAlphaScore: true,
      hasPublicationLagAssumption: false,
      simulationBoundaryEnforced: true,
    };

    const output = scanSource(noEvidence);
    expect(output.result).toBe("BLOCKED_MISSING_EVIDENCE");
  });

  // -------------------------------------------------------------------------
  // T15 — explicit latency assumption produces WARN_ASSUMPTION_REQUIRED
  // -------------------------------------------------------------------------
  it("T15: explicit publication lag assumption produces WARN_ASSUMPTION_REQUIRED", () => {
    const withLagAssumption: SourceAuditInput = {
      sourceName: "Chip",
      hasDateField: true,
      dateFieldName: "date",
      dateFormatConsistent: true,
      hasGate: true,
      gateEffective: true,
      asOfPropagated: true,
      knownFields: ["id", "symbol", "date", "totalBuy", "totalSell", "foreignBuy"],
      p29fStatus: "PIT_SAFE_VERIFIED",
      hasP29FEvidence: true,
      permittedInAlphaScore: true,
      hasPublicationLagAssumption: true,
      publicationLagDescription:
        "T+0 chip data published ~6pm. Post-close assumption. Pre-market use requires prior-day data.",
      simulationBoundaryEnforced: true,
    };

    const output = scanSource(withLagAssumption);
    expect(output.result).toBe("WARN_ASSUMPTION_REQUIRED");
    expect(output.assumptionNotes.length).toBeGreaterThan(0);
    expect(output.assumptionNotes[0]).toContain("6pm");
  });

  // -------------------------------------------------------------------------
  // Additional structural / governance tests
  // -------------------------------------------------------------------------

  it("STRUCT-01: PIT_SAFETY_RULES has exactly 15 rules with unique IDs", () => {
    expect(PIT_SAFETY_RULES).toHaveLength(15);
    const ids = PIT_SAFETY_RULES.map((r) => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(15);
  });

  it("STRUCT-02: all mandatory rules have failOnViolation defined", () => {
    const mandatory = getMandatoryRules();
    for (const r of mandatory) {
      expect(typeof r.failOnViolation).toBe("boolean");
    }
  });

  it("STRUCT-03: getRuleById returns correct rule or undefined", () => {
    const psr01 = getRuleById("PSR-01");
    expect(psr01).toBeDefined();
    expect(psr01!.category).toBe("DATE_INTEGRITY");

    const psr15 = getRuleById("PSR-15");
    expect(psr15).toBeDefined();
    expect(psr15!.category).toBe("SIMULATION_BOUNDARY");
  });

  it("STRUCT-04: getRulesByCategory filters correctly", () => {
    const dateRules = getRulesByCategory("DATE_INTEGRITY");
    expect(dateRules.length).toBeGreaterThanOrEqual(2);
    for (const r of dateRules) {
      expect(r.category).toBe("DATE_INTEGRITY");
    }

    const alphaGovRules = getRulesByCategory("ALPHA_SCORE_GOVERNANCE");
    expect(alphaGovRules.length).toBeGreaterThanOrEqual(4);
  });

  it("STRUCT-05: ALL_FORBIDDEN_FIELD_PATTERNS is non-empty and all lowercase", () => {
    expect(ALL_FORBIDDEN_FIELD_PATTERNS.length).toBeGreaterThan(10);
    for (const p of ALL_FORBIDDEN_FIELD_PATTERNS) {
      expect(p).toBe(p.toLowerCase());
    }
  });

  it("STRUCT-06: isForbiddenField detects well-known forbidden patterns", () => {
    expect(isForbiddenField("futureReturn")).toBe(true);
    expect(isForbiddenField("outcomePrice")).toBe(true);
    expect(isForbiddenField("realizedReturn")).toBe(true);
    expect(isForbiddenField("targetLabel")).toBe(true);
    expect(isForbiddenField("nextRegime")).toBe(true);
    // Safe fields should NOT match
    expect(isForbiddenField("close")).toBe(false);
    expect(isForbiddenField("volume")).toBe(false);
    expect(isForbiddenField("symbol")).toBe(false);
    expect(isForbiddenField("date")).toBe(false);
    expect(isForbiddenField("ma50")).toBe(false);
  });

  it("STRUCT-07: isForbiddenField is case-insensitive and handles underscores", () => {
    expect(isForbiddenField("FUTURE_RETURN")).toBe(true);
    expect(isForbiddenField("future_return")).toBe(true);
    expect(isForbiddenField("FutureReturn")).toBe(true);
    expect(isForbiddenField("outcome_price")).toBe(true);
    expect(isForbiddenField("OUTCOME_PRICE")).toBe(true);
  });

  it("STRUCT-08: matchedForbiddenPatterns returns which patterns were matched", () => {
    const matches = matchedForbiddenPatterns("futureReturn");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.includes("futurereturn") || m.includes("future"))).toBe(true);
  });

  it("GOV-01: ALPHA_SCORE_BLOCKED_SOURCES contains FinancialReport and NewsEvent", () => {
    expect(ALPHA_SCORE_BLOCKED_SOURCES).toContain("FinancialReport");
    expect(ALPHA_SCORE_BLOCKED_SOURCES).toContain("NewsEvent");
  });

  it("GOV-02: ALPHA_SCORE_NOT_YET_APPROVED_SOURCES contains MonthlyRevenue", () => {
    expect(ALPHA_SCORE_NOT_YET_APPROVED_SOURCES).toContain("MonthlyRevenue");
  });

  it("GOV-03: canonical scan report overall result is ALL_PIT_SAFE", () => {
    const report = runScan([...CANONICAL_P29I_SCAN_INPUTS]);
    expect(report.overallResult).toBe("ALL_PIT_SAFE");
  });

  it("GOV-04: canonical scan allows Quote, Regime, Chip in alphaScore", () => {
    const report = runScan([...CANONICAL_P29I_SCAN_INPUTS]);
    expect(report.allowedAlphaScoreSources).toContain("Quote");
    expect(report.allowedAlphaScoreSources).toContain("Regime");
    // Chip is WARN_ASSUMPTION_REQUIRED but still in allowed (assumption documented)
    expect(report.allowedAlphaScoreSources).toContain("Chip");
  });

  it("GOV-05: canonical scan has no blocked sources in the blocked list", () => {
    const report = runScan([...CANONICAL_P29I_SCAN_INPUTS]);
    // FinancialReport and NewsEvent do NOT appear in blockedSources — their correct
    // state is "not permitted" (expected by design), not a failure
    expect(report.blockedSources).toHaveLength(0);
  });

  it("GOV-06: FinancialReport attempting alphaScore entry triggers PSR-11 violation", () => {
    const fraudAttempt: SourceAuditInput = {
      sourceName: "FinancialReport",
      hasDateField: true,
      dateFieldName: "filingDate",
      dateFormatConsistent: true,
      hasGate: true,
      gateEffective: true,
      asOfPropagated: true,
      knownFields: ["id", "symbol", "filingDate", "revenue", "eps"],
      p29fStatus: "PIT_SAFE_VERIFIED",
      hasP29FEvidence: true,
      permittedInAlphaScore: true, // <-- attempting to enter
      hasPublicationLagAssumption: false,
      simulationBoundaryEnforced: true,
    };

    const output = scanSource(fraudAttempt);
    const psr11 = output.ruleChecks.find((r) => r.ruleId === "PSR-11")!;
    expect(psr11.passed).toBe(false);
    expect(output.result).toBe("FAIL_LEAKAGE_RISK");
  });

  it("GOV-07: NewsEvent attempting alphaScore entry triggers PSR-12 violation", () => {
    const fraudAttempt: SourceAuditInput = {
      sourceName: "NewsEvent",
      hasDateField: true,
      dateFieldName: "publishedAt",
      dateFormatConsistent: true,
      hasGate: true,
      gateEffective: true,
      asOfPropagated: true,
      knownFields: ["id", "symbol", "publishedAt", "headline"],
      p29fStatus: "PIT_SAFE_VERIFIED",
      hasP29FEvidence: true,
      permittedInAlphaScore: true, // <-- attempting to enter
      hasPublicationLagAssumption: false,
      simulationBoundaryEnforced: true,
    };

    const output = scanSource(fraudAttempt);
    const psr12 = output.ruleChecks.find((r) => r.ruleId === "PSR-12")!;
    expect(psr12.passed).toBe(false);
    expect(output.result).toBe("FAIL_LEAKAGE_RISK");
  });

  it("GOV-08: missing gate triggers FAIL_LEAKAGE_RISK via PSR-08", () => {
    const noGate: SourceAuditInput = {
      sourceName: "Quote",
      hasDateField: true,
      dateFieldName: "date",
      dateFormatConsistent: true,
      hasGate: false, // <-- no gate
      gateEffective: null,
      asOfPropagated: null,
      knownFields: ["id", "symbol", "date", "close"],
      p29fStatus: "PIT_SAFE_VERIFIED",
      hasP29FEvidence: true,
      permittedInAlphaScore: true,
      hasPublicationLagAssumption: false,
      simulationBoundaryEnforced: true,
    };

    const output = scanSource(noGate);
    const psr08 = output.ruleChecks.find((r) => r.ruleId === "PSR-08")!;
    expect(psr08.passed).toBe(false);
    expect(output.result).toBe("FAIL_LEAKAGE_RISK");
  });

  it("GOV-09: P29I_SCANNER_VERSION has expected format", () => {
    expect(P29I_SCANNER_VERSION).toBe("p29i-audit-scanner-v1");
  });

  it("DISC-01: report disclaimer explicitly states AUDIT-ONLY and NOT investment advice", () => {
    const report = runScan([...CANONICAL_P29I_SCAN_INPUTS]);
    expect(report.disclaimer).toContain("AUDIT-ONLY");
    expect(report.disclaimer.toLowerCase()).toContain("not");
    expect(report.disclaimer.toLowerCase()).toContain("investment");
  });
});
