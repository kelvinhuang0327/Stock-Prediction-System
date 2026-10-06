import {
  classifyMonthlyRevenueCoverageRow,
  scanMonthlyRevenueAvailabilityCoverage,
  summarizeMonthlyRevenueCoverage,
  validateMonthlyRevenueCoverageReadOnly,
  validateMonthlyRevenueCoverageNoOutcomeFields,
  compareMonthlyRevenueCoverageBeforeAfter,
  type MonthlyRevenueRow,
} from "../P26DMonthlyRevenueCoverageScannerUtils";
import * as fs from "fs";
import * as path from "path";

const SOURCE_PATH = path.join(
  __dirname,
  "../P26DMonthlyRevenueCoverageScannerUtils.ts"
);
const sourceText = fs.readFileSync(SOURCE_PATH, "utf8");

const AS_OF_DATE = "2026-05-13";

describe("P26DMonthlyRevenueCoverageScannerUtils", () => {
  test("classifyMonthlyRevenueCoverageRow classifies available row correctly", () => {
    const row: MonthlyRevenueRow = {
      symbol: "2330",
      releaseDate: "2026-05-10",
      reasonContext: "Revenue grew",
    };
    expect(classifyMonthlyRevenueCoverageRow(row, AS_OF_DATE)).toBe("available");
  });

  test("classifyMonthlyRevenueCoverageRow classifies future row correctly", () => {
    const row: MonthlyRevenueRow = {
      symbol: "2330",
      releaseDate: "2026-06-01",
    };
    expect(classifyMonthlyRevenueCoverageRow(row, AS_OF_DATE)).toBe("future");
  });

  test("classifyMonthlyRevenueCoverageRow classifies invalid (no releaseDate) correctly", () => {
    const row: MonthlyRevenueRow = { symbol: "2330" };
    expect(classifyMonthlyRevenueCoverageRow(row, AS_OF_DATE)).toBe("invalid");
  });

  test("scanMonthlyRevenueAvailabilityCoverage counts available rows correctly", () => {
    const rows: MonthlyRevenueRow[] = [
      { symbol: "2330", releaseDate: "2026-05-10", reasonContext: "Strong Q1" },
      { symbol: "2330", releaseDate: "2026-05-13", reasonContext: "Stable" },
      { symbol: "2330", releaseDate: "2026-06-01" },
      { symbol: "2330" },
    ];
    const result = scanMonthlyRevenueAvailabilityCoverage(rows, { asOfDate: AS_OF_DATE });
    expect(result.totalRows).toBe(4);
    expect(result.availableRows).toBe(2);
    expect(result.futureRows).toBe(1);
    expect(result.invalidRows).toBe(1);
    expect(result.withReasonContext).toBe(2);
  });

  test("scanMonthlyRevenueAvailabilityCoverage does NOT read outcomePrice field", () => {
    const rows: MonthlyRevenueRow[] = [
      { symbol: "2330", releaseDate: "2026-05-10" },
    ];
    // Structural check: verify no forbidden fields appear in the returned summary
    const result = scanMonthlyRevenueAvailabilityCoverage(rows, { asOfDate: AS_OF_DATE });
    expect(Object.keys(result)).not.toContain("outcomePrice");
    expect(Object.keys(result)).not.toContain("returnPct");
    expect(Object.keys(result)).not.toContain("realizedReturnClass");
  });

  test("summarizeMonthlyRevenueCoverage returns deterministic counts", () => {
    const rows: MonthlyRevenueRow[] = [
      { symbol: "A", releaseDate: "2026-05-10", reasonContext: "R1", factorEvidence: "F1" },
      { symbol: "B", releaseDate: "2026-05-11", reasonContext: "R2" },
      { symbol: "C" },
    ];
    const s = summarizeMonthlyRevenueCoverage(rows);
    expect(s.totalRows).toBe(3);
    expect(s.withReleaseDate).toBe(2);
    expect(s.withReasonContext).toBe(2);
    expect(s.withFactorEvidence).toBe(1);
    expect(s.noReleaseDate).toBe(1);
  });

  test("validateMonthlyRevenueCoverageReadOnly passes for valid summary", () => {
    const rows: MonthlyRevenueRow[] = [{ symbol: "A", releaseDate: "2026-05-10" }];
    const summary = summarizeMonthlyRevenueCoverage(rows);
    const result = validateMonthlyRevenueCoverageReadOnly(summary);
    expect(result.valid).toBe(true);
  });

  test("validateMonthlyRevenueCoverageNoOutcomeFields passes for valid summary", () => {
    const rows: MonthlyRevenueRow[] = [{ symbol: "A", releaseDate: "2026-05-10" }];
    const summary = summarizeMonthlyRevenueCoverage(rows);
    const result = validateMonthlyRevenueCoverageNoOutcomeFields(summary);
    expect(result.valid).toBe(true);
    expect(result.reason).toContain("No outcome fields");
  });

  test("compareMonthlyRevenueCoverageBeforeAfter computes delta correctly", () => {
    const before: MonthlyRevenueRow[] = [
      { symbol: "A", releaseDate: "2026-05-10" },
    ];
    const after: MonthlyRevenueRow[] = [
      { symbol: "A", releaseDate: "2026-05-10" },
      { symbol: "B", releaseDate: "2026-05-11" },
    ];
    const result = compareMonthlyRevenueCoverageBeforeAfter(before, after, AS_OF_DATE);
    expect(result.availabilityDelta).toBe(1);
    expect(result.coverageImproved).toBe(true);
    expect(result.beforeSummary.availableRows).toBe(1);
    expect(result.afterSummary.availableRows).toBe(2);
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

  test("No mutation of input rows", () => {
    const rows: MonthlyRevenueRow[] = [
      { symbol: "2330", releaseDate: "2026-05-10", reasonContext: "R1" },
    ];
    const originalSymbol = rows[0].symbol;
    const originalReleaseDate = rows[0].releaseDate;
    scanMonthlyRevenueAvailabilityCoverage(rows, { asOfDate: AS_OF_DATE });
    expect(rows[0].symbol).toBe(originalSymbol);
    expect(rows[0].releaseDate).toBe(originalReleaseDate);
    expect(rows.length).toBe(1);
  });
});
