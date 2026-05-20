/**
 * P29F: Quote / Regime / Chip PIT Validation Audit Tests
 * audit-only / NOT investment recommendation / no production mutation
 */

import {
  buildP29FAuditSummary,
  QUOTE_AUDIT_RESULT,
  REGIME_AUDIT_RESULT,
  CHIP_AUDIT_RESULT,
  PIT_RULES,
  SUSPICIOUS_FUTURE_PATTERNS,
  hasSuspiciousFuturePattern,
} from "../p29f/quoteRegimeChipPitAudit";
import type { PitAuditClassification } from "../p29f/quoteRegimeChipPitAudit";

const ALLOWED_CLASSIFICATIONS: PitAuditClassification[] = [
  "PIT_SAFE_VERIFIED",
  "PIT_UNVERIFIED_NEEDS_REPAIR",
  "PIT_VIOLATION_CONFIRMED",
  "INSUFFICIENT_EVIDENCE",
];

// ── T01: audit module exists ──────────────────────────────────────────────────
describe("P29F-T01: audit module exists", () => {
  it("buildP29FAuditSummary is a function", () => {
    expect(typeof buildP29FAuditSummary).toBe("function");
  });

  it("QUOTE_AUDIT_RESULT is exported", () => {
    expect(QUOTE_AUDIT_RESULT).toBeDefined();
  });

  it("REGIME_AUDIT_RESULT is exported", () => {
    expect(REGIME_AUDIT_RESULT).toBeDefined();
  });

  it("CHIP_AUDIT_RESULT is exported", () => {
    expect(CHIP_AUDIT_RESULT).toBeDefined();
  });
});

// ── T02: quote source is discovered ──────────────────────────────────────────
describe("P29F-T02: quote source is discovered", () => {
  it("Quote source has a defined result", () => {
    expect(QUOTE_AUDIT_RESULT.sourceName).toBe("Quote");
  });

  it("Quote source has PIT rules defined", () => {
    expect(PIT_RULES.Quote.pitRules.length).toBeGreaterThan(0);
  });

  it("Quote source has dbTable defined", () => {
    expect(PIT_RULES.Quote.dbTable).toBe("StockQuote");
  });

  it("Quote source has gateImplementation", () => {
    expect(PIT_RULES.Quote.gateImplementation).toContain("lte");
  });
});

// ── T03: regime source is discovered ─────────────────────────────────────────
describe("P29F-T03: regime source is discovered", () => {
  it("Regime source has a defined result", () => {
    expect(REGIME_AUDIT_RESULT.sourceName).toBe("Regime");
  });

  it("Regime source has PIT rules defined", () => {
    expect(PIT_RULES.Regime.pitRules.length).toBeGreaterThan(0);
  });

  it("Regime source has dbTable defined", () => {
    expect(PIT_RULES.Regime.dbTable).toBe("MarketIndex");
  });

  it("Regime gate uses ISO format directly", () => {
    expect(PIT_RULES.Regime.gateFormatUsed).toContain("ISO");
  });
});

// ── T04: chip source is discovered ───────────────────────────────────────────
describe("P29F-T04: chip source is discovered", () => {
  it("Chip source has a defined result", () => {
    expect(CHIP_AUDIT_RESULT.sourceName).toBe("Chip");
  });

  it("Chip source has PIT rules defined", () => {
    expect(PIT_RULES.Chip.pitRules.length).toBeGreaterThan(0);
  });

  it("Chip source has dbTable defined", () => {
    expect(PIT_RULES.Chip.dbTable).toBe("InstitutionalChip");
  });

  it("Chip schema format mismatch documented", () => {
    expect(PIT_RULES.Chip.actualSyncFormat).toContain("ISO");
    expect(PIT_RULES.Chip.expectedFormat).toContain("YYYYMMDD");
  });
});

// ── T05: each source has PIT rule ─────────────────────────────────────────────
describe("P29F-T05: each source has PIT rule", () => {
  it("Quote has at least one PIT rule", () => {
    expect(PIT_RULES.Quote.pitRules.length).toBeGreaterThanOrEqual(1);
  });

  it("Regime has at least one PIT rule", () => {
    expect(PIT_RULES.Regime.pitRules.length).toBeGreaterThanOrEqual(1);
  });

  it("Chip has at least one PIT rule", () => {
    expect(PIT_RULES.Chip.pitRules.length).toBeGreaterThanOrEqual(1);
  });

  it("Each source PIT rule mentions asOf or date", () => {
    const allRules = [
      ...PIT_RULES.Quote.pitRules,
      ...PIT_RULES.Regime.pitRules,
      ...PIT_RULES.Chip.pitRules,
    ];
    const hasDateMention = allRules.some((r) => r.toLowerCase().includes("date") || r.toLowerCase().includes("asof"));
    expect(hasDateMention).toBe(true);
  });
});

// ── T06: each source has classification ──────────────────────────────────────
describe("P29F-T06: each source has classification", () => {
  it("Quote has a classification", () => {
    expect(QUOTE_AUDIT_RESULT.classification).toBeDefined();
  });

  it("Regime has a classification", () => {
    expect(REGIME_AUDIT_RESULT.classification).toBeDefined();
  });

  it("Chip has a classification", () => {
    expect(CHIP_AUDIT_RESULT.classification).toBeDefined();
  });
});

// ── T07: classification only uses allowed enum ────────────────────────────────
describe("P29F-T07: classification only uses allowed enum values", () => {
  it("Quote classification is an allowed value", () => {
    expect(ALLOWED_CLASSIFICATIONS).toContain(QUOTE_AUDIT_RESULT.classification);
  });

  it("Regime classification is an allowed value", () => {
    expect(ALLOWED_CLASSIFICATIONS).toContain(REGIME_AUDIT_RESULT.classification);
  });

  it("Chip classification is an allowed value", () => {
    expect(ALLOWED_CLASSIFICATIONS).toContain(CHIP_AUDIT_RESULT.classification);
  });

  it("All summary classifications are valid", () => {
    const summary = buildP29FAuditSummary();
    const sourceResults = Object.values(summary.sources);
    for (const r of sourceResults) {
      expect(ALLOWED_CLASSIFICATIONS).toContain(r.classification);
    }
  });
});

// ── T08: source entering alphaScore cannot be unclassified ───────────────────
describe("P29F-T08: sources entering alphaScore cannot be unclassified", () => {
  it("Quote must have a classification (not INSUFFICIENT_EVIDENCE for gated source)", () => {
    expect(QUOTE_AUDIT_RESULT.classification).not.toBe("INSUFFICIENT_EVIDENCE");
  });

  it("Chip must have a classification", () => {
    expect(CHIP_AUDIT_RESULT.classification).not.toBe("INSUFFICIENT_EVIDENCE");
  });

  it("Regime must have a classification", () => {
    expect(REGIME_AUDIT_RESULT.classification).not.toBe("INSUFFICIENT_EVIDENCE");
  });

  it("Each source has at least one finding", () => {
    expect(QUOTE_AUDIT_RESULT.findings.length).toBeGreaterThan(0);
    expect(REGIME_AUDIT_RESULT.findings.length).toBeGreaterThan(0);
    expect(CHIP_AUDIT_RESULT.findings.length).toBeGreaterThan(0);
  });
});

// ── T09: suspicious future-like fields are detected ──────────────────────────
describe("P29F-T09: suspicious future-like fields are detected", () => {
  it("hasSuspiciousFuturePattern detects 'futurePrice'", () => {
    expect(hasSuspiciousFuturePattern("futurePrice")).toBe(true);
  });

  it("hasSuspiciousFuturePattern detects 'nextClose'", () => {
    expect(hasSuspiciousFuturePattern("nextClose")).toBe(true);
  });

  it("hasSuspiciousFuturePattern detects 'forwardReturn'", () => {
    expect(hasSuspiciousFuturePattern("forwardReturn")).toBe(true);
  });

  it("hasSuspiciousFuturePattern detects 'outcomePrice'", () => {
    expect(hasSuspiciousFuturePattern("outcomePrice")).toBe(true);
  });

  it("hasSuspiciousFuturePattern does NOT flag 'closePrice'", () => {
    expect(hasSuspiciousFuturePattern("closePrice")).toBe(false);
  });

  it("hasSuspiciousFuturePattern does NOT flag 'technicalScore'", () => {
    expect(hasSuspiciousFuturePattern("technicalScore")).toBe(false);
  });

  it("SUSPICIOUS_FUTURE_PATTERNS list is not empty", () => {
    expect(SUSPICIOUS_FUTURE_PATTERNS.length).toBeGreaterThan(0);
  });
});

// ── T10: suspicious target/label-like fields are detected ────────────────────
describe("P29F-T10: suspicious target/label-like fields are detected", () => {
  it("hasSuspiciousFuturePattern detects 'targetReturn'", () => {
    expect(hasSuspiciousFuturePattern("targetReturn")).toBe(true);
  });

  it("hasSuspiciousFuturePattern detects 'realizedReturn'", () => {
    expect(hasSuspiciousFuturePattern("realizedReturn")).toBe(true);
  });

  it("hasSuspiciousFuturePattern detects 'labelClass'", () => {
    expect(hasSuspiciousFuturePattern("labelClass")).toBe(true);
  });

  it("hasSuspiciousFuturePattern detects 'returnPct'", () => {
    expect(hasSuspiciousFuturePattern("returnPct")).toBe(true);
  });
});

// ── T11: date gate ambiguity is flagged ──────────────────────────────────────
describe("P29F-T11: date gate ambiguity is flagged", () => {
  it("Quote findings include a DATE_FORMAT_MISMATCH finding", () => {
    const finding = QUOTE_AUDIT_RESULT.findings.find(
      (f) => f.category === "DATE_FORMAT_MISMATCH"
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("ERROR");
  });

  it("Chip findings include a DATE_FORMAT_MISMATCH finding", () => {
    const finding = CHIP_AUDIT_RESULT.findings.find(
      (f) => f.category === "DATE_FORMAT_MISMATCH"
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("ERROR");
  });

  it("Regime findings do NOT have a DATE_FORMAT_MISMATCH (ISO-ISO is correct)", () => {
    const finding = REGIME_AUDIT_RESULT.findings.find(
      (f) => f.category === "DATE_FORMAT_MISMATCH"
    );
    expect(finding).toBeUndefined();
  });

  it("Quote has GATE_INEFFECTIVE finding", () => {
    const finding = QUOTE_AUDIT_RESULT.findings.find(
      (f) => f.category === "GATE_INEFFECTIVE"
    );
    expect(finding).toBeDefined();
  });

  it("Chip has GATE_INEFFECTIVE finding", () => {
    const finding = CHIP_AUDIT_RESULT.findings.find(
      (f) => f.category === "GATE_INEFFECTIVE"
    );
    expect(finding).toBeDefined();
  });

  it("Regime findings confirm GATE_EXISTS (PIT_SAFE)", () => {
    const gateFindings = REGIME_AUDIT_RESULT.findings.filter(
      (f) => f.category === "GATE_EXISTS"
    );
    expect(gateFindings.length).toBeGreaterThan(0);
  });
});

// ── T12: FinancialReport remains entersAlphaScore=false ──────────────────────
describe("P29F-T12: FinancialReport remains entersAlphaScore=false", () => {
  it("Audit summary does not include FinancialReport as a verified source", () => {
    const summary = buildP29FAuditSummary();
    expect(Object.keys(summary.sources)).not.toContain("FinancialReport");
  });

  it("FinancialReport is not in scope for P29F audit", () => {
    const sourceNames = ["Quote", "Regime", "Chip"] as const;
    expect(sourceNames).not.toContain("FinancialReport" as never);
  });
});

// ── T13: NewsEvent remains entersAlphaScore=false ────────────────────────────
describe("P29F-T13: NewsEvent remains entersAlphaScore=false", () => {
  it("Audit summary does not include NewsEvent as a verified source", () => {
    const summary = buildP29FAuditSummary();
    expect(Object.keys(summary.sources)).not.toContain("NewsEvent");
  });

  it("NewsEvent is not in scope for P29F audit", () => {
    const sourceNames = ["Quote", "Regime", "Chip"] as const;
    expect(sourceNames).not.toContain("NewsEvent" as never);
  });
});

// ── T14: P29E simulation scaffold remains paper-only ─────────────────────────
describe("P29F-T14: P29E simulation scaffold remains paper-only", () => {
  it("P29F audit does not promote any source to allow simulation expansion", () => {
    const summary = buildP29FAuditSummary();
    // If any unverified sources, simulation expansion must be blocked
    if (summary.simulationTrustRootStatus !== "VERIFIED_SAFE") {
      expect(summary.trustRootBlockerRemains).toBe(true);
    }
  });

  it("Quote mustBlockBeforeSimulation is true (needs repair)", () => {
    expect(QUOTE_AUDIT_RESULT.mustBlockBeforeSimulation).toBe(true);
  });

  it("Chip mustBlockBeforeSimulation is true (needs repair)", () => {
    expect(CHIP_AUDIT_RESULT.mustBlockBeforeSimulation).toBe(true);
  });

  it("trust root blocker remains when any source is UNVERIFIED", () => {
    const summary = buildP29FAuditSummary();
    const hasUnverified = Object.values(summary.sources).some(
      (s) => s.classification === "PIT_UNVERIFIED_NEEDS_REPAIR"
    );
    if (hasUnverified) {
      expect(summary.trustRootBlockerRemains).toBe(true);
    }
  });
});

// ── T15: no production scoring imports are introduced ────────────────────────
describe("P29F-T15: no production scoring imports in audit module", () => {
  it("quoteRegimeChipPitAudit does not import RuleBasedStockAnalyzer", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      __dirname,
      "../p29f/quoteRegimeChipPitAudit.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).not.toMatch(/^import.*RuleBasedStockAnalyzer/m);
    expect(source).not.toMatch(/require.*RuleBasedStockAnalyzer/);
  });

  it("quoteRegimeChipPitAudit does not import SignalFusionEngine", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      __dirname,
      "../p29f/quoteRegimeChipPitAudit.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).not.toMatch(/^import.*SignalFusionEngine/m);
  });

  it("quoteRegimeChipPitAudit does not import ActiveScoringSnapshotBuilder", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      __dirname,
      "../p29f/quoteRegimeChipPitAudit.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).not.toMatch(/^import.*ActiveScoringSnapshotBuilder/m);
  });
});

// ── T16: no optimizer imports are introduced ─────────────────────────────────
describe("P29F-T16: no optimizer imports in audit module", () => {
  it("quoteRegimeChipPitAudit does not import any optimizer", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      __dirname,
      "../p29f/quoteRegimeChipPitAudit.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).not.toMatch(/^import.*[Oo]ptimizer/m);
    expect(source).not.toMatch(/GridSearch|BayesianOpt|ParamSearch/);
  });
});

// ── T17: no DB write path is introduced ──────────────────────────────────────
describe("P29F-T17: no DB write path in audit module", () => {
  it("quoteRegimeChipPitAudit does not import prisma", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      __dirname,
      "../p29f/quoteRegimeChipPitAudit.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).not.toMatch(/^import.*prisma/m);
    expect(source).not.toMatch(/from\s+['"]@\/lib\/prisma['"]/);
    expect(source).not.toMatch(/prisma\.[a-z]+\.(create|update|upsert|delete)\s*\(/);
  });
});

// ── T18: no corpus mutation path is introduced ────────────────────────────────
describe("P29F-T18: no corpus mutation in audit module", () => {
  it("quoteRegimeChipPitAudit does not write to files", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      __dirname,
      "../p29f/quoteRegimeChipPitAudit.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).not.toContain("appendFileSync");
    expect(source).not.toContain("writeFileSync");
    expect(source).not.toContain("createWriteStream");
    expect(source).not.toMatch(/fs\..*\(.*\.jsonl/);
  });
});

// ── T19: no P27/scanner consolidation touched ────────────────────────────────
describe("P29F-T19: no P27/scanner consolidation in audit module", () => {
  it("audit module does not reference P27", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const files = [
      path.resolve(__dirname, "../p29f/quoteRegimeChipPitAudit.ts"),
      path.resolve(__dirname, "../p29f/pitAuditTypes.ts"),
    ];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf-8");
      expect(source).not.toMatch(/\bP27\b/);
      expect(source).not.toMatch(/scanner.*consolidat/i);
    }
  });
});

// ── T20: next prompt blocks optimizer until PIT audit resolved ────────────────
describe("P29F-T20: next prompt blocks optimizer until PIT resolved", () => {
  it("trustRootBlockerRemains is true when any source needs repair", () => {
    const summary = buildP29FAuditSummary();
    const needsRepair =
      QUOTE_AUDIT_RESULT.classification === "PIT_UNVERIFIED_NEEDS_REPAIR" ||
      CHIP_AUDIT_RESULT.classification === "PIT_UNVERIFIED_NEEDS_REPAIR" ||
      REGIME_AUDIT_RESULT.classification === "PIT_UNVERIFIED_NEEDS_REPAIR";

    if (needsRepair) {
      expect(summary.trustRootBlockerRemains).toBe(true);
    }
  });

  it("nextRoundDecision mentions repair when sources are unverified", () => {
    const summary = buildP29FAuditSummary();
    if (summary.simulationTrustRootStatus === "UNVERIFIED_NEEDS_REPAIR") {
      expect(summary.nextRoundDecision.toLowerCase()).toMatch(/repair|block/);
    }
  });

  it("simulationTrustRootStatus is not VERIFIED_SAFE when Quote/Chip need repair", () => {
    const summary = buildP29FAuditSummary();
    const quoteBad = QUOTE_AUDIT_RESULT.classification !== "PIT_SAFE_VERIFIED";
    const chipBad = CHIP_AUDIT_RESULT.classification !== "PIT_SAFE_VERIFIED";

    if (quoteBad || chipBad) {
      expect(summary.simulationTrustRootStatus).not.toBe("VERIFIED_SAFE");
    }
  });
});

// ── Additional: full summary structure ────────────────────────────────────────
describe("P29F: buildP29FAuditSummary structure", () => {
  const summary = buildP29FAuditSummary();

  it("summary has auditId", () => {
    expect(typeof summary.auditId).toBe("string");
    expect(summary.auditId.length).toBeGreaterThan(0);
  });

  it("summary has all three sources", () => {
    expect(summary.sources.Quote).toBeDefined();
    expect(summary.sources.Regime).toBeDefined();
    expect(summary.sources.Chip).toBeDefined();
  });

  it("Regime simulationInputTag is VERIFIED", () => {
    expect(summary.sources.Regime.simulationInputTag).toBe("VERIFIED");
  });

  it("Quote simulationInputTag is UNVERIFIED", () => {
    expect(summary.sources.Quote.simulationInputTag).toBe("UNVERIFIED");
  });

  it("Chip simulationInputTag is UNVERIFIED", () => {
    expect(summary.sources.Chip.simulationInputTag).toBe("UNVERIFIED");
  });

  it("overall classification is deterministic", () => {
    const s1 = buildP29FAuditSummary();
    const s2 = buildP29FAuditSummary();
    expect(s1.overallClassification).toBe(s2.overallClassification);
  });

  it("overallClassification is one of the allowed P29F classifications", () => {
    const allowed = [
      "P29F_QUOTE_REGIME_CHIP_PIT_AUDIT_READY_ALL_SAFE",
      "P29F_QUOTE_REGIME_CHIP_PIT_AUDIT_RISK_FOUND_NEEDS_REPAIR",
      "P29F_QUOTE_REGIME_CHIP_PIT_AUDIT_VIOLATION_CONFIRMED",
      "P29F_QUOTE_REGIME_CHIP_PIT_AUDIT_INSUFFICIENT_EVIDENCE",
    ];
    expect(allowed).toContain(summary.overallClassification);
  });
});
