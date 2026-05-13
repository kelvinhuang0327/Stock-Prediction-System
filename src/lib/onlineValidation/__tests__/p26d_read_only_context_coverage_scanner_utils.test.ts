import {
  scanNewsEventContextCoverage,
  scanFinancialReportContextCoverage,
  summarizeReadOnlyContextCoverage,
  validateReadOnlyContextsDoNotEnterScoring,
  validateContextCoverageNoForbiddenClaims,
  validateContextCoverageNoOutcomeFields,
  type NewsEventRow,
  type FinancialReportRow,
} from "../P26DReadOnlyContextCoverageScannerUtils";
import * as fs from "fs";
import * as path from "path";

const SOURCE_PATH = path.join(
  __dirname,
  "../P26DReadOnlyContextCoverageScannerUtils.ts"
);
const sourceText = fs.readFileSync(SOURCE_PATH, "utf8");

const AS_OF_DATE = "2026-05-13";

describe("P26DReadOnlyContextCoverageScannerUtils", () => {
  describe("scanNewsEventContextCoverage", () => {
    test("uses publishedAt gate — visible count correct", () => {
      const rows: NewsEventRow[] = [
        { publishedAt: "2026-05-10T09:00:00Z", symbol: "2330", sourceHash: "sha256:news001" },
        { publishedAt: "2026-05-12T09:00:00Z", symbol: "2330", sourceHash: "sha256:news002" },
        { publishedAt: "2026-05-20T09:00:00Z", symbol: "2330", sourceHash: "sha256:news003" },
      ];
      const result = scanNewsEventContextCoverage(rows, AS_OF_DATE);
      expect(result.visible).toBe(2);
      expect(result.future).toBe(1);
      expect(result.invalid).toBe(0);
      expect(result.total).toBe(3);
      expect(result.entersAlphaScore).toBe(false);
    });

    test("marks future events as future", () => {
      const rows: NewsEventRow[] = [
        { publishedAt: "2026-06-01T00:00:00Z", symbol: "2330", sourceHash: "sha256:news101" },
        { publishedAt: "2026-05-14T00:00:00Z", symbol: "2330", sourceHash: "sha256:news102" },
      ];
      const result = scanNewsEventContextCoverage(rows, AS_OF_DATE);
      expect(result.future).toBe(2);
      expect(result.visible).toBe(0);
    });

    test("marks missing publishedAt as invalid", () => {
      const rows: NewsEventRow[] = [
        { symbol: "2330", sourceHash: "sha256:news201" },
        { publishedAt: "2026-05-10T09:00:00Z", symbol: "2330", sourceHash: "sha256:news202" },
      ];
      const result = scanNewsEventContextCoverage(rows, AS_OF_DATE);
      expect(result.invalid).toBe(1);
      expect(result.visible).toBe(1);
    });
  });

  describe("scanFinancialReportContextCoverage", () => {
    test("uses availabilityDate gate with priority chain (filingDate first)", () => {
      const rows: FinancialReportRow[] = [
        {
          filingDate: "2026-05-10",
          announcementDate: null,
          publishedAt: null,
          availableAt: null,
          sourceHash: "sha256:fin001",
        },
        {
          filingDate: "2026-06-15",
          announcementDate: null,
          publishedAt: null,
          availableAt: null,
          sourceHash: "sha256:fin002",
        },
      ];
      const result = scanFinancialReportContextCoverage(rows, AS_OF_DATE);
      expect(result.visible).toBe(1);
      expect(result.future).toBe(1);
    });

    test("uses announcementDate when filingDate is null", () => {
      const rows: FinancialReportRow[] = [
        {
          filingDate: null,
          announcementDate: "2026-05-08",
          publishedAt: null,
          availableAt: null,
          sourceHash: "sha256:fin101",
        },
      ];
      const result = scanFinancialReportContextCoverage(rows, AS_OF_DATE);
      expect(result.visible).toBe(1);
    });

    test("marks rows with no availability date as noAvailabilityDate", () => {
      const rows: FinancialReportRow[] = [
        {
          filingDate: null,
          announcementDate: null,
          publishedAt: null,
          availableAt: null,
          sourceHash: "sha256:fin201",
        },
        {
          filingDate: "2026-05-10",
          announcementDate: null,
          publishedAt: null,
          availableAt: null,
          sourceHash: "sha256:fin202",
        },
      ];
      const result = scanFinancialReportContextCoverage(rows, AS_OF_DATE);
      expect(result.noAvailabilityDate).toBe(1);
      expect(result.visible).toBe(1);
    });
  });

  describe("validateReadOnlyContextsDoNotEnterScoring", () => {
    test("passes when entersAlphaScore=false", () => {
      const newsSummary = { total: 3, visible: 2, future: 1, invalid: 0, entersAlphaScore: false as const };
      const finSummary = { total: 2, visible: 1, future: 1, invalid: 0, noAvailabilityDate: 0, entersAlphaScore: false as const };
      const summary = summarizeReadOnlyContextCoverage(newsSummary, finSummary, AS_OF_DATE);
      const result = validateReadOnlyContextsDoNotEnterScoring(summary);
      expect(result.valid).toBe(true);
    });

    test("fails when entersAlphaScore=true (manual override)", () => {
      const newsSummary = { total: 1, visible: 1, future: 0, invalid: 0, entersAlphaScore: false as const };
      const finSummary = { total: 1, visible: 1, future: 0, invalid: 0, noAvailabilityDate: 0, entersAlphaScore: false as const };
      const summary = summarizeReadOnlyContextCoverage(newsSummary, finSummary, AS_OF_DATE);
      // Force override to simulate broken contract
      const broken = { ...summary, news: { ...summary.news, entersAlphaScore: true as unknown as false } };
      const result = validateReadOnlyContextsDoNotEnterScoring(broken);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateContextCoverageNoForbiddenClaims", () => {
    test("rejects summary containing forbidden claim strings", () => {
      const newsSummary = { total: 1, visible: 1, future: 0, invalid: 0, entersAlphaScore: false as const };
      const finSummary = { total: 1, visible: 1, future: 0, invalid: 0, noAvailabilityDate: 0, entersAlphaScore: false as const };
      const summary = summarizeReadOnlyContextCoverage(newsSummary, finSummary, AS_OF_DATE);
      // inject forbidden term into a custom property
      const tampered = { ...summary, extraNote: "This gives ROI advantage" };
      const result = validateContextCoverageNoForbiddenClaims(tampered as never);
      expect(result.valid).toBe(false);
      expect(result.forbiddenFound).toContain("ROI");
    });

    test("passes for clean summary", () => {
      const newsSummary = { total: 1, visible: 1, future: 0, invalid: 0, entersAlphaScore: false as const };
      const finSummary = { total: 1, visible: 1, future: 0, invalid: 0, noAvailabilityDate: 0, entersAlphaScore: false as const };
      const summary = summarizeReadOnlyContextCoverage(newsSummary, finSummary, AS_OF_DATE);
      const result = validateContextCoverageNoForbiddenClaims(summary);
      expect(result.valid).toBe(true);
      expect(result.forbiddenFound).toHaveLength(0);
    });
  });

  describe("validateContextCoverageNoOutcomeFields", () => {
    test("rejects summary containing outcomePrice/returnPct", () => {
      const newsSummary = { total: 1, visible: 1, future: 0, invalid: 0, entersAlphaScore: false as const };
      const finSummary = { total: 1, visible: 1, future: 0, invalid: 0, noAvailabilityDate: 0, entersAlphaScore: false as const };
      const summary = summarizeReadOnlyContextCoverage(newsSummary, finSummary, AS_OF_DATE);
      const tampered = { ...summary, outcomePrice: 150 };
      const result = validateContextCoverageNoOutcomeFields(tampered as never);
      expect(result.valid).toBe(false);
    });

    test("passes for clean summary", () => {
      const newsSummary = { total: 1, visible: 1, future: 0, invalid: 0, entersAlphaScore: false as const };
      const finSummary = { total: 1, visible: 1, future: 0, invalid: 0, noAvailabilityDate: 0, entersAlphaScore: false as const };
      const summary = summarizeReadOnlyContextCoverage(newsSummary, finSummary, AS_OF_DATE);
      const result = validateContextCoverageNoOutcomeFields(summary);
      expect(result.valid).toBe(true);
    });
  });

  test("summarizeReadOnlyContextCoverage combines news and financial summaries", () => {
    const newsSummary = { total: 6, visible: 4, future: 1, invalid: 1, entersAlphaScore: false as const };
    const finSummary = { total: 8, visible: 5, future: 2, invalid: 0, noAvailabilityDate: 1, entersAlphaScore: false as const };
    const summary = summarizeReadOnlyContextCoverage(newsSummary, finSummary, AS_OF_DATE);
    expect(summary.news.total).toBe(6);
    expect(summary.financial.total).toBe(8);
    expect(summary.contextsReadOnly).toBe(true);
    expect(summary.asOfDate).toBe(AS_OF_DATE);
  });

  test("readinessGate accepts fixture-only contexts as sourceMappingRequired, not scoring-ready", () => {
    const newsSummary = { total: 6, visible: 4, future: 1, invalid: 1, entersAlphaScore: false as const };
    const finSummary = { total: 8, visible: 5, future: 2, invalid: 0, noAvailabilityDate: 1, entersAlphaScore: false as const };
    const summary = summarizeReadOnlyContextCoverage(newsSummary, finSummary, AS_OF_DATE);
    expect(summary.sourceMappingRequired).toBe(true);
  });

  test("No Math.random() in source", () => {
    expect(sourceText).not.toMatch(/Math\.random\(\)/);
  });

  test("No external imports in source", () => {
    const lines = sourceText.split("\n");
    const importLines = lines.filter(
      (l) => l.trim().startsWith("import ") && !l.trim().startsWith("//")
    );
    expect(importLines).toHaveLength(0);
  });
});
