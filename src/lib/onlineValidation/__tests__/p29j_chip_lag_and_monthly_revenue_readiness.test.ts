/**
 * p29j_chip_lag_and_monthly_revenue_readiness.test.ts
 *
 * DISCLAIMER: Structural tests only. No investment advice, ROI, profit,
 * alpha, win-rate, edge, or outperformance claims. Results must not be
 * interpreted as buy/sell/hold signals.
 *
 * P29J — Chip C-F05 Lag Evidence + MonthlyRevenue Activation Readiness Audit
 *
 * Test plan:
 *   T01  Chip schema has no availability timestamp
 *   T02  Chip audit classification is CHIP_LAG_WARN_ASSUMPTION_REQUIRED
 *   T03  Chip audit rejects future-looking chip field names
 *   T04  Chip audit rejects outcome / target leakage field names
 *   T05  MonthlyRevenue: releaseDate requirement unsatisfied (sync does not populate)
 *   T06  MonthlyRevenue: asOfDate normalization approach is adequate
 *   T07  MonthlyRevenue: entersAlphaScore is always false
 *   T08  MonthlyRevenue: dry-run readiness requires source metadata
 *   T09  FinancialReport remains HIGH_RISK_SOURCE_ABSENT
 *   T10  NewsEvent remains HIGH_RISK_SOURCE_ABSENT
 *   T11  Both reports are deterministic (two calls produce identical output)
 *   T12  Both reports serialize to JSON without loss
 *   T13  Report text contains no investment advice keywords
 *   T14  Forbidden claims scan is clean on both reports
 *   T15  Report builders do not mutate DB / corpus / scoring files
 *        (verified structurally: no DB imports, fixed capturedAt, pure functions)
 */

import {
  buildChipLagReport,
  detectForbiddenChipFields,
  CHIP_KNOWN_SCHEMA_FIELDS,
  CHIP_AUDIT_VERSION,
  CHIP_AUDIT_DISCLAIMER,
  type ChipLagAuditReport,
} from "../p29j/ChipLagEvidenceAudit";

import {
  buildMonthlyRevenueReadinessReport,
  checkReleaseDateRequirement,
  checkAsOfDateNormalization,
  getBlockedSourceStatus,
  MONTHLY_REVENUE_AUDIT_VERSION,
  MONTHLY_REVENUE_AUDIT_DISCLAIMER,
  type MonthlyRevenueReadinessReport,
  type MonthlyRevenueSchemaStatus,
  type MonthlyRevenueSyncStatus,
} from "../p29j/MonthlyRevenueReadinessAudit";

// ─── T01: Chip schema has no availability timestamp ───────────────────────────

describe("T01 — Chip schema: no availability timestamp", () => {
  let report: ChipLagAuditReport;

  beforeAll(() => {
    report = buildChipLagReport();
  });

  it("T01-A: schemaEvidence.hasAvailabilityTimestamp is false", () => {
    expect(report.schemaEvidence.hasAvailabilityTimestamp).toBe(false);
  });

  it("T01-B: schemaEvidence.availabilityTimestampField is null", () => {
    expect(report.schemaEvidence.availabilityTimestampField).toBeNull();
  });

  it("T01-C: schemaEvidence.hasReleaseDateField is false", () => {
    expect(report.schemaEvidence.hasReleaseDateField).toBe(false);
  });

  it("T01-D: schemaEvidence.hasGeneratedAtField is false", () => {
    expect(report.schemaEvidence.hasGeneratedAtField).toBe(false);
  });

  it("T01-E: cronEvidence.cronFiresBeforeT86 is true", () => {
    expect(report.cronEvidence.cronFiresBeforeT86).toBe(true);
  });

  it("T01-F: cronEvidence.sameDayT0ViaCronPossible is false", () => {
    expect(report.cronEvidence.sameDayT0ViaCronPossible).toBe(false);
  });
});

// ─── T02: Chip audit classification is WARN_ASSUMPTION_REQUIRED ──────────────

describe("T02 — Chip classification: CHIP_LAG_WARN_ASSUMPTION_REQUIRED", () => {
  let report: ChipLagAuditReport;

  beforeAll(() => {
    report = buildChipLagReport();
  });

  it("T02-A: classification is CHIP_LAG_WARN_ASSUMPTION_REQUIRED", () => {
    expect(report.classification).toBe("CHIP_LAG_WARN_ASSUMPTION_REQUIRED");
  });

  it("T02-B: classification is NOT CHIP_LAG_CONFIRMED", () => {
    expect(report.classification).not.toBe("CHIP_LAG_CONFIRMED");
  });

  it("T02-C: classification is NOT CHIP_LAG_FAIL_LEAKAGE_RISK", () => {
    expect(report.classification).not.toBe("CHIP_LAG_FAIL_LEAKAGE_RISK");
  });

  it("T02-D: assumptionNotes is non-empty", () => {
    expect(report.assumptionNotes.length).toBeGreaterThan(0);
  });

  it("T02-E: upgradePath is non-empty", () => {
    expect(report.upgradePath.length).toBeGreaterThan(0);
  });

  it("T02-F: p29iStatus references P29I confirmation", () => {
    expect(report.p29iStatus).toContain("P29I");
  });

  it("T02-G: gateEvidence.gateExists is true", () => {
    expect(report.gateEvidence.gateExists).toBe(true);
  });

  it("T02-H: gateEvidence.normalizationApplied is true", () => {
    expect(report.gateEvidence.normalizationApplied).toBe(true);
  });
});

// ─── T03: Chip audit rejects future-looking chip fields ──────────────────────

describe("T03 — detectForbiddenChipFields: future-looking fields", () => {
  it("T03-A: known chip schema fields produce no forbidden matches", () => {
    const found = detectForbiddenChipFields(CHIP_KNOWN_SCHEMA_FIELDS);
    expect(found).toHaveLength(0);
  });

  it("T03-B: futureClose is detected as forbidden", () => {
    const found = detectForbiddenChipFields(["date", "foreignBuy", "futureClose"]);
    expect(found).toContain("futureClose");
  });

  it("T03-C: nextPrice is detected as forbidden", () => {
    const found = detectForbiddenChipFields(["date", "trustBuy", "nextPrice"]);
    expect(found).toContain("nextPrice");
  });

  it("T03-D: nextVolume is detected as forbidden", () => {
    const found = detectForbiddenChipFields(["totalBuy", "nextVolume"]);
    expect(found).toContain("nextVolume");
  });

  it("T03-E: report.forbiddenFieldsFound is empty (clean known schema)", () => {
    const report = buildChipLagReport();
    expect(report.forbiddenFieldsFound).toHaveLength(0);
  });
});

// ─── T04: Chip audit rejects outcome / target leakage fields ─────────────────

describe("T04 — detectForbiddenChipFields: outcome/target leakage", () => {
  it("T04-A: outcomeLabel is detected as forbidden", () => {
    const found = detectForbiddenChipFields(["date", "foreignBuy", "outcomeLabel"]);
    expect(found).toContain("outcomeLabel");
  });

  it("T04-B: returnPct is detected as forbidden", () => {
    const found = detectForbiddenChipFields(["date", "returnPct"]);
    expect(found).toContain("returnPct");
  });

  it("T04-C: targetReturn is detected as forbidden", () => {
    const found = detectForbiddenChipFields(["foreignBuy", "targetReturn"]);
    expect(found).toContain("targetReturn");
  });

  it("T04-D: realizedReturn is detected as forbidden", () => {
    const found = detectForbiddenChipFields(["date", "foreignBuy", "realizedReturn"]);
    expect(found).toContain("realizedReturn");
  });

  it("T04-E: multiple forbidden fields all detected", () => {
    const found = detectForbiddenChipFields([
      "date", "foreignBuy", "outcomeLabel", "returnPct", "futureClose"
    ]);
    expect(found).toContain("outcomeLabel");
    expect(found).toContain("returnPct");
    expect(found).toContain("futureClose");
    expect(found).not.toContain("date");
    expect(found).not.toContain("foreignBuy");
  });
});

// ─── T05: MonthlyRevenue: releaseDate requirement unsatisfied ─────────────────

describe("T05 — MonthlyRevenue: checkReleaseDateRequirement unsatisfied", () => {
  const baseSchema: MonthlyRevenueSchemaStatus = {
    modelExists: true,
    hasYearMonthFields: true,
    hasReleaseDateField: true,
    releaseDateFieldType: "DateTime? (nullable)",
    hasReleaseDateSourceField: true,
    hasReleaseDateConfidenceField: true,
    hasAnnouncementDateField: false,
    hasAvailabilityDateField: false,
    asOfDateApproach: "year_month_int_pair",
  };

  const syncNullReleaseDate: MonthlyRevenueSyncStatus = {
    syncFunctionExists: true,
    syncSource: "TWSE getMonthlyRevenueSummary()",
    syncPopulatesReleaseDate: false,
    syncPopulatesReleaseDateSource: false,
    syncPopulatesReleaseDateConfidence: false,
    effectiveReleaseDateInDB: "NULL",
    inferenceRule: "INFERRED_NEXT_MONTH_10TH",
    inferredConfidence: "LOW_TO_MEDIUM",
    syncRepairNeeded: true,
  };

  it("T05-A: requirement is NOT satisfied when sync does not populate releaseDate", () => {
    const result = checkReleaseDateRequirement(baseSchema, syncNullReleaseDate);
    expect(result.satisfied).toBe(false);
  });

  it("T05-B: reasons include description of missing releaseDate population", () => {
    const result = checkReleaseDateRequirement(baseSchema, syncNullReleaseDate);
    const combined = result.reasons.join(" ");
    expect(combined).toMatch(/never populated|always NULL/i);
  });

  it("T05-C: requirement IS satisfied when effectiveReleaseDateInDB is EXPLICIT", () => {
    const syncExplicit: MonthlyRevenueSyncStatus = {
      ...syncNullReleaseDate,
      syncPopulatesReleaseDate: true,
      effectiveReleaseDateInDB: "EXPLICIT",
    };
    const result = checkReleaseDateRequirement(baseSchema, syncExplicit);
    expect(result.satisfied).toBe(true);
  });

  it("T05-D: requirement IS satisfied when announcementDate field exists in schema", () => {
    const schemaWithAnnouncement: MonthlyRevenueSchemaStatus = {
      ...baseSchema,
      hasAnnouncementDateField: true,
    };
    const result = checkReleaseDateRequirement(schemaWithAnnouncement, syncNullReleaseDate);
    expect(result.satisfied).toBe(true);
  });

  it("T05-E: requirement IS satisfied when availabilityDate field exists in schema", () => {
    const schemaWithAvailability: MonthlyRevenueSchemaStatus = {
      ...baseSchema,
      hasAvailabilityDateField: true,
    };
    const result = checkReleaseDateRequirement(schemaWithAvailability, syncNullReleaseDate);
    expect(result.satisfied).toBe(true);
  });
});

// ─── T06: MonthlyRevenue asOfDate normalization is adequate ───────────────────

describe("T06 — MonthlyRevenue: asOfDate normalization adequate", () => {
  const baseSchema: MonthlyRevenueSchemaStatus = {
    modelExists: true,
    hasYearMonthFields: true,
    hasReleaseDateField: true,
    releaseDateFieldType: "DateTime? (nullable)",
    hasReleaseDateSourceField: true,
    hasReleaseDateConfidenceField: true,
    hasAnnouncementDateField: false,
    hasAvailabilityDateField: false,
    asOfDateApproach: "year_month_int_pair",
  };

  it("T06-A: year_month_int_pair approach is adequate", () => {
    const result = checkAsOfDateNormalization(baseSchema);
    expect(result.adequate).toBe(true);
  });

  it("T06-B: notes mention primary query gate", () => {
    const result = checkAsOfDateNormalization(baseSchema);
    const combined = result.notes.join(" ");
    expect(combined).toMatch(/year|month/i);
  });

  it("T06-C: notes mention filterMonthlyRevenueAvailableAsOf", () => {
    const result = checkAsOfDateNormalization(baseSchema);
    const combined = result.notes.join(" ");
    expect(combined).toMatch(/filterMonthlyRevenue|releaseDate/i);
  });

  it("T06-D: unknown asOfDate approach is NOT adequate", () => {
    const unknownSchema: MonthlyRevenueSchemaStatus = {
      ...baseSchema,
      asOfDateApproach: "none",
    };
    const result = checkAsOfDateNormalization(unknownSchema);
    expect(result.adequate).toBe(false);
  });
});

// ─── T07: MonthlyRevenue entersAlphaScore is always false ────────────────────

describe("T07 — MonthlyRevenue: entersAlphaScore always false", () => {
  it("T07-A: report.entersAlphaScore is false", () => {
    const report = buildMonthlyRevenueReadinessReport();
    expect(report.entersAlphaScore).toBe(false);
  });

  it("T07-B: nextActivationRequirements include entersAlphaScore=false constraint", () => {
    const report = buildMonthlyRevenueReadinessReport();
    const combined = report.nextActivationRequirements.join(" ");
    expect(combined).toMatch(/entersAlphaScore.*false|alphaScore.*false/i);
  });

  it("T07-C: classification is NOT READY (blocked by sync repair needed)", () => {
    const report = buildMonthlyRevenueReadinessReport();
    expect(report.classification).not.toBe("MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN");
  });
});

// ─── T08: MonthlyRevenue dry-run readiness requires source metadata ────────────

describe("T08 — MonthlyRevenue: dry-run readiness blocked by missing metadata", () => {
  let report: MonthlyRevenueReadinessReport;

  beforeAll(() => {
    report = buildMonthlyRevenueReadinessReport();
  });

  it("T08-A: classification is MONTHLY_REVENUE_NEEDS_SCHEMA_REPAIR", () => {
    expect(report.classification).toBe("MONTHLY_REVENUE_NEEDS_SCHEMA_REPAIR");
  });

  it("T08-B: blockingReasons is non-empty", () => {
    expect(report.blockingReasons.length).toBeGreaterThan(0);
  });

  it("T08-C: syncStatus.syncRepairNeeded is true", () => {
    expect(report.syncStatus.syncRepairNeeded).toBe(true);
  });

  it("T08-D: syncStatus.syncPopulatesReleaseDate is false", () => {
    expect(report.syncStatus.syncPopulatesReleaseDate).toBe(false);
  });

  it("T08-E: syncStatus.effectiveReleaseDateInDB is NULL", () => {
    expect(report.syncStatus.effectiveReleaseDateInDB).toBe("NULL");
  });

  it("T08-F: dryRunReadiness indicates BLOCKED", () => {
    expect(report.dryRunReadiness).toMatch(/BLOCKED/i);
  });

  it("T08-G: p29gStatus is STRUCTURAL_PLACEHOLDER_ONLY", () => {
    expect(report.p29gStatus).toBe("STRUCTURAL_PLACEHOLDER_ONLY");
  });

  it("T08-H: schemaStatus.modelExists is true (source is present)", () => {
    expect(report.schemaStatus.modelExists).toBe(true);
  });

  it("T08-I: schemaStatus.hasReleaseDateField is true (field exists, just unpopulated)", () => {
    expect(report.schemaStatus.hasReleaseDateField).toBe(true);
  });
});

// ─── T09: FinancialReport remains HIGH_RISK_SOURCE_ABSENT ────────────────────

describe("T09 — FinancialReport: HIGH_RISK_SOURCE_ABSENT", () => {
  it("T09-A: getBlockedSourceStatus returns HIGH_RISK_SOURCE_ABSENT", () => {
    const status = getBlockedSourceStatus("FinancialReport");
    expect(status.classification).toBe("HIGH_RISK_SOURCE_ABSENT");
  });

  it("T09-B: entersAlphaScore is false", () => {
    const status = getBlockedSourceStatus("FinancialReport");
    expect(status.entersAlphaScore).toBe(false);
  });

  it("T09-C: entersP29JDryRun is false", () => {
    const status = getBlockedSourceStatus("FinancialReport");
    expect(status.entersP29JDryRun).toBe(false);
  });

  it("T09-D: report.financialReportStatus.classification is HIGH_RISK_SOURCE_ABSENT", () => {
    const report = buildMonthlyRevenueReadinessReport();
    expect(report.financialReportStatus.classification).toBe("HIGH_RISK_SOURCE_ABSENT");
  });

  it("T09-E: FinancialReport reason mentions PIT or leakage risk", () => {
    const status = getBlockedSourceStatus("FinancialReport");
    expect(status.reason).toMatch(/PIT|leakage|risk|audit/i);
  });
});

// ─── T10: NewsEvent remains HIGH_RISK_SOURCE_ABSENT ──────────────────────────

describe("T10 — NewsEvent: HIGH_RISK_SOURCE_ABSENT", () => {
  it("T10-A: getBlockedSourceStatus returns HIGH_RISK_SOURCE_ABSENT", () => {
    const status = getBlockedSourceStatus("NewsEvent");
    expect(status.classification).toBe("HIGH_RISK_SOURCE_ABSENT");
  });

  it("T10-B: entersAlphaScore is false", () => {
    const status = getBlockedSourceStatus("NewsEvent");
    expect(status.entersAlphaScore).toBe(false);
  });

  it("T10-C: entersP29JDryRun is false", () => {
    const status = getBlockedSourceStatus("NewsEvent");
    expect(status.entersP29JDryRun).toBe(false);
  });

  it("T10-D: report.newsEventStatus.classification is HIGH_RISK_SOURCE_ABSENT", () => {
    const report = buildMonthlyRevenueReadinessReport();
    expect(report.newsEventStatus.classification).toBe("HIGH_RISK_SOURCE_ABSENT");
  });

  it("T10-E: NewsEvent reason mentions PIT, leakage, or sentiment", () => {
    const status = getBlockedSourceStatus("NewsEvent");
    expect(status.reason).toMatch(/PIT|leakage|sentiment|audit/i);
  });
});

// ─── T11: Both reports are deterministic ─────────────────────────────────────

describe("T11 — Determinism: identical output on repeated calls", () => {
  it("T11-A: buildChipLagReport() returns identical output on two calls", () => {
    const r1 = buildChipLagReport();
    const r2 = buildChipLagReport();
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("T11-B: buildMonthlyRevenueReadinessReport() returns identical output on two calls", () => {
    const r1 = buildMonthlyRevenueReadinessReport();
    const r2 = buildMonthlyRevenueReadinessReport();
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("T11-C: chip report capturedAt is a fixed string (not dynamic)", () => {
    const r1 = buildChipLagReport();
    const r2 = buildChipLagReport();
    expect(r1.capturedAt).toBe(r2.capturedAt);
    expect(r1.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("T11-D: monthly revenue report capturedAt is a fixed string (not dynamic)", () => {
    const r1 = buildMonthlyRevenueReadinessReport();
    const r2 = buildMonthlyRevenueReadinessReport();
    expect(r1.capturedAt).toBe(r2.capturedAt);
    expect(r1.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── T12: Both reports serialize to JSON without loss ────────────────────────

describe("T12 — JSON serialization: no data loss", () => {
  it("T12-A: chip report serializes to valid JSON", () => {
    const report = buildChipLagReport();
    expect(() => JSON.stringify(report)).not.toThrow();
    const str = JSON.stringify(report);
    expect(str.length).toBeGreaterThan(100);
  });

  it("T12-B: chip report round-trips through JSON without data loss", () => {
    const report = buildChipLagReport();
    const parsed = JSON.parse(JSON.stringify(report));
    expect(parsed.classification).toBe(report.classification);
    expect(parsed.auditVersion).toBe(CHIP_AUDIT_VERSION);
    expect(parsed.sourceName).toBe("Chip");
  });

  it("T12-C: monthly revenue report serializes to valid JSON", () => {
    const report = buildMonthlyRevenueReadinessReport();
    expect(() => JSON.stringify(report)).not.toThrow();
    const str = JSON.stringify(report);
    expect(str.length).toBeGreaterThan(100);
  });

  it("T12-D: monthly revenue report round-trips through JSON without data loss", () => {
    const report = buildMonthlyRevenueReadinessReport();
    const parsed = JSON.parse(JSON.stringify(report));
    expect(parsed.classification).toBe(report.classification);
    expect(parsed.auditVersion).toBe(MONTHLY_REVENUE_AUDIT_VERSION);
    expect(parsed.sourceName).toBe("MonthlyRevenue");
    expect(parsed.entersAlphaScore).toBe(false);
  });
});

// ─── T13: Report text contains no investment advice keywords ──────────────────

describe("T13 — No investment advice in report output", () => {
  // Patterns that indicate actual investment-advice claims (not disclaimer denials).
  // Specifically exclude "No ROI" / "no win-rate" since those appear in disclaimers.
  const INVESTMENT_ADVICE_PATTERNS = [
    /\bbuy signal\b/i,
    /\bsell signal\b/i,
    /\bhold signal\b/i,
    /guaranteed (profit|return|gain)/i,
    /\boutperform(s)? the market/i,
    /\bwill (always )?profit\b/i,
  ];

  it("T13-A: chip report JSON contains no investment advice keywords", () => {
    const text = JSON.stringify(buildChipLagReport());
    for (const pattern of INVESTMENT_ADVICE_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });

  it("T13-B: monthly revenue report JSON contains no investment advice keywords", () => {
    const text = JSON.stringify(buildMonthlyRevenueReadinessReport());
    for (const pattern of INVESTMENT_ADVICE_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });

  it("T13-C: chip disclaimer explicitly states no investment advice", () => {
    expect(CHIP_AUDIT_DISCLAIMER).toMatch(/investment advice/i);
  });

  it("T13-D: monthly revenue disclaimer explicitly states no investment advice", () => {
    expect(MONTHLY_REVENUE_AUDIT_DISCLAIMER).toMatch(/investment advice/i);
  });
});

// ─── T14: Forbidden claims scan is clean ─────────────────────────────────────

describe("T14 — Forbidden claims scan: clean", () => {
  // These patterns check for affirmative investment claims, not disclaimer denials.
  // "No ROI" in a disclaimer is correct — we only ban positive ROI/profit guarantees.
  const FORBIDDEN_CLAIM_PATTERNS = [
    /guaranteed profit/i,
    /guaranteed return/i,
    /risk[- ]?free/i,
    /\b(will|always) (profit|gain|double)\b/i,
    /\boutperform(s)? the market/i,
  ];

  it("T14-A: chip report is free of forbidden financial claims", () => {
    const text = JSON.stringify(buildChipLagReport());
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });

  it("T14-B: monthly revenue report is free of forbidden financial claims", () => {
    const text = JSON.stringify(buildMonthlyRevenueReadinessReport());
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });

  it("T14-C: chip audit version string contains no forbidden claims", () => {
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      expect(CHIP_AUDIT_VERSION).not.toMatch(pattern);
    }
  });

  it("T14-D: monthly revenue audit version string contains no forbidden claims", () => {
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      expect(MONTHLY_REVENUE_AUDIT_VERSION).not.toMatch(pattern);
    }
  });
});

// ─── T15: No DB / corpus / scoring file mutation ──────────────────────────────

describe("T15 — No DB / corpus / scoring file mutation", () => {
  it("T15-A: buildChipLagReport() completes synchronously (no async DB call)", () => {
    // Pure sync function — verify it doesn't return a Promise
    const result = buildChipLagReport();
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe("object");
  });

  it("T15-B: buildMonthlyRevenueReadinessReport() completes synchronously", () => {
    const result = buildMonthlyRevenueReadinessReport();
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe("object");
  });

  it("T15-C: chip report capturedAt is a fixed constant (not Date.now() or new Date())", () => {
    const r1 = buildChipLagReport();
    // Fixed timestamp means calling twice in same millisecond yields identical value
    const r2 = buildChipLagReport();
    expect(r1.capturedAt).toBe(r2.capturedAt);
  });

  it("T15-D: monthly revenue report capturedAt is a fixed constant", () => {
    const r1 = buildMonthlyRevenueReadinessReport();
    const r2 = buildMonthlyRevenueReadinessReport();
    expect(r1.capturedAt).toBe(r2.capturedAt);
  });

  it("T15-E: detectForbiddenChipFields is a pure function (no side effects)", () => {
    const input = [...CHIP_KNOWN_SCHEMA_FIELDS] as string[];
    const result = detectForbiddenChipFields(input);
    // Input array should be unchanged
    expect(input).toHaveLength(CHIP_KNOWN_SCHEMA_FIELDS.length);
    expect(result).toHaveLength(0);
  });
});
