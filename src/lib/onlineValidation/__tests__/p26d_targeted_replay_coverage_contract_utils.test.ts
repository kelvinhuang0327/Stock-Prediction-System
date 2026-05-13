import {
  P26D_COVERAGE_CONTRACT_VERSION,
  P26D_COVERAGE_DIMENSIONS,
  P26D_OUTPUT_CLASSIFICATIONS,
  P26D_EXCLUDED_SCOPE,
  buildP26DCoverageContractV0,
  validateP26DCoverageContractCompleteness,
  isP26DCoverageClassificationValid,
} from "../P26DTargetedReplayCoverageContractUtils";
import * as fs from "fs";
import * as path from "path";

const SOURCE_PATH = path.join(
  __dirname,
  "../P26DTargetedReplayCoverageContractUtils.ts"
);
const sourceText = fs.readFileSync(SOURCE_PATH, "utf8");

describe("P26DTargetedReplayCoverageContractUtils", () => {
  test("buildP26DCoverageContractV0 returns object with all 9 coverage dimensions", () => {
    const contract = buildP26DCoverageContractV0();
    const dims = contract.coverageDimensions;
    expect(dims.monthlyRevenueAvailableAsOf).toBeDefined();
    expect(dims.monthlyRevenueReasonContextPresent).toBeDefined();
    expect(dims.monthlyRevenueFactorEvidencePresent).toBeDefined();
    expect(dims.newsEventContextVisibleAsOf).toBeDefined();
    expect(dims.financialReportContextVisibleAsOf).toBeDefined();
    expect(dims.contextReadOnly).toBeDefined();
    expect(dims.entersAlphaScoreFalseForNewsAndFinancial).toBeDefined();
    expect(dims.alphaScoreInvariant).toBeDefined();
    expect(dims.recommendationBucketInvariant).toBeDefined();
    expect(Object.keys(dims).length).toBe(9);
  });

  test("All 6 output classifications present in P26D_OUTPUT_CLASSIFICATIONS", () => {
    const cls = P26D_OUTPUT_CLASSIFICATIONS;
    expect(cls.COVERAGE_READY_FOR_CORPUS_EXPANSION).toBe("COVERAGE_READY_FOR_CORPUS_EXPANSION");
    expect(cls.COVERAGE_PARTIAL_NEEDS_SOURCE_MAPPING).toBe("COVERAGE_PARTIAL_NEEDS_SOURCE_MAPPING");
    expect(cls.COVERAGE_BLOCKED_BY_ARTIFACTS).toBe("COVERAGE_BLOCKED_BY_ARTIFACTS");
    expect(cls.SCORING_INVARIANCE_BROKEN).toBe("SCORING_INVARIANCE_BROKEN");
    expect(cls.PIT_CONTEXT_GATE_BROKEN).toBe("PIT_CONTEXT_GATE_BROKEN");
    expect(cls.FAILED_TESTS).toBe("FAILED_TESTS");
    expect(Object.keys(cls).length).toBe(6);
  });

  test("Contract excludes scoring / corpus regeneration / external API", () => {
    const excl = P26D_EXCLUDED_SCOPE;
    expect(excl.noScoringChange).toBe(true);
    expect(excl.noCorpusRegeneration).toBe(true);
    expect(excl.noExternalAPI).toBe(true);
    expect(excl.noDBWrite).toBe(true);
    expect(excl.noOutcomeFields).toBe(true);
  });

  test("validateP26DCoverageContractCompleteness returns valid for complete contract", () => {
    const contract = buildP26DCoverageContractV0();
    const result = validateP26DCoverageContractCompleteness(contract);
    expect(result.valid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  test("isP26DCoverageClassificationValid validates correct classifications", () => {
    expect(isP26DCoverageClassificationValid("COVERAGE_READY_FOR_CORPUS_EXPANSION")).toBe(true);
    expect(isP26DCoverageClassificationValid("COVERAGE_PARTIAL_NEEDS_SOURCE_MAPPING")).toBe(true);
    expect(isP26DCoverageClassificationValid("COVERAGE_BLOCKED_BY_ARTIFACTS")).toBe(true);
    expect(isP26DCoverageClassificationValid("SCORING_INVARIANCE_BROKEN")).toBe(true);
    expect(isP26DCoverageClassificationValid("PIT_CONTEXT_GATE_BROKEN")).toBe(true);
    expect(isP26DCoverageClassificationValid("FAILED_TESTS")).toBe(true);
  });

  test("isP26DCoverageClassificationValid rejects invalid classifications", () => {
    expect(isP26DCoverageClassificationValid("INVALID_CLASSIFICATION")).toBe(false);
    expect(isP26DCoverageClassificationValid("")).toBe(false);
    expect(isP26DCoverageClassificationValid("PASS")).toBe(false);
  });

  test("No Math.random() in source", () => {
    expect(sourceText).not.toMatch(/Math\.random\(\)/);
  });

  test("No external imports in source (no import statements)", () => {
    // Check for import statements that reference external packages
    // Allow only type-only constructs within the file itself
    const lines = sourceText.split("\n");
    const importLines = lines.filter(
      (l) => l.trim().startsWith("import ") && !l.trim().startsWith("//")
    );
    expect(importLines).toHaveLength(0);
  });

  test("VERSION is v0", () => {
    expect(P26D_COVERAGE_CONTRACT_VERSION).toBe("v0");
  });

  test("All dimension entries have readOnly=true and entersAlphaScore=false", () => {
    for (const [key, dim] of Object.entries(P26D_COVERAGE_DIMENSIONS)) {
      expect((dim as { readOnly: boolean }).readOnly).toBe(true);
      expect((dim as { entersAlphaScore: boolean }).entersAlphaScore).toBe(false);
    }
  });
});
