/**
 * P80 — Stock Research Product Surface Report Export Metadata Contract
 * Test suite: 80+ tests
 *
 * Verifies:
 *   - version and governance constants
 *   - valid P78 artifact response acceptance
 *   - all 10 bad governance flags rejected by validator
 *   - all 10 bad governance flags throw in builder
 *   - fixed/default generatedAt
 *   - deterministic fileName
 *   - mimeType exact value
 *   - contentBody neutral section labels present
 *   - contentBody forbidden terms absent
 *   - metadata neutral fields only
 *   - metadata is frozen
 *   - output is frozen
 *   - JSON serializable
 *   - deterministic repeated calls
 *   - input not mutated
 *   - frozen input supported
 *   - response top-level keys contain no forbidden fields
 *   - metadata keys contain no forbidden fields
 *   - source text import verification (no DB / Prisma / fs / path / network)
 *   - source text export verification (no run / execute / simulate / score / optimize)
 *   - source text no forbidden financial terms
 *   - no buy / sell / hold / action semantics
 *   - no prediction / investment-advice / recommendation fields
 */

import fs from "fs";
import path from "path";

import {
  STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_VERSION,
  STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE,
  validateStaticSampleArtifactForExportMetadata,
  buildStockResearchProductSurfaceReportExportMetadata,
} from "../export/StockResearchProductSurfaceReportExportMetadata";

import type {
  StockResearchProductSurfaceReportExportMetadataValidationResult,
  StockResearchProductSurfaceReportExportMetadataEnvelope,
  StockResearchProductSurfaceReportExportMetadataParams,
  StockResearchProductSurfaceReportExportMetadataRecord,
} from "../export/StockResearchProductSurfaceReportExportMetadata";

import type {
  StockResearchProductSurfaceStaticSampleArtifactResponse,
} from "../composition/StockResearchProductSurfaceStaticSampleArtifact";

import {
  STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_VERSION,
} from "../composition/StockResearchProductSurfaceStaticSampleArtifact";

// ─── Source text ─────────────────────────────────────────────────────────────

const SOURCE_PATH = path.resolve(
  __dirname,
  "../export/StockResearchProductSurfaceReportExportMetadata.ts",
);

const SOURCE_TEXT = fs.readFileSync(SOURCE_PATH, "utf-8");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FIXED_TS = "2026-05-26T12:00:00.000Z";

function makeArtifactResponse(
  overrides: Partial<StockResearchProductSurfaceStaticSampleArtifactResponse> = {},
): StockResearchProductSurfaceStaticSampleArtifactResponse {
  const base: StockResearchProductSurfaceStaticSampleArtifactResponse = {
    artifactVersion: STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_VERSION,
    generatedAt: "2026-05-26T00:00:00.000Z",
    reviewOnly: true,
    noInvestmentAdvice: true,
    noForecast: true,
    noRecommendation: true,
    previewOnly: true,
    paperOnly: true,
    noExecution: true,
    noActualMetrics: true,
    entersAlphaScore: false,
    notInvestmentAdvice: true,
    artifactTitle: "Stock Research Product Surface Static Sample Artifact",
    reportBlocks: Object.freeze([
      Object.freeze({
        blockKey: "disclaimer",
        blockLabel: "Disclaimer",
        lines: Object.freeze([
          "This report is review-only and not investment advice.",
          "No forecast. No execution. No actual metrics.",
        ]),
      }),
      Object.freeze({
        blockKey: "researchReview",
        blockLabel: "Research Review",
        lines: Object.freeze([
          "Source status: reviewed",
          "Source status: excluded — Review note: Low trust",
        ]),
      }),
      Object.freeze({
        blockKey: "simulationInputAudit",
        blockLabel: "Simulation Input Audit",
        lines: Object.freeze([
          "Source status: included",
        ]),
      }),
      Object.freeze({
        blockKey: "summary",
        blockLabel: "Report Summary",
        lines: Object.freeze([
          "Research review: 2 card(s)",
          "Simulation input audit: 1 card(s)",
          "This report is review-only and not investment advice.",
        ]),
      }),
    ]),
    artifactSummary: Object.freeze({
      summaryLabel: "Report Summary",
      researchCardCount: 2,
      simulationAuditCardCount: 1,
    }),
  };
  return { ...base, ...overrides } as StockResearchProductSurfaceStaticSampleArtifactResponse;
}

function makeParams(
  overrides: Partial<StockResearchProductSurfaceStaticSampleArtifactResponse> = {},
  fixedGeneratedAt?: string,
): StockResearchProductSurfaceReportExportMetadataParams {
  return {
    artifactResponse: makeArtifactResponse(overrides),
    ...(fixedGeneratedAt !== undefined ? { fixedGeneratedAt } : {}),
  };
}

// ─── T80.01: version constant ─────────────────────────────────────────────────

describe("T80.01: version constant", () => {
  it("T80.01-a: version constant is exact expected value", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_VERSION).toBe(
      "p80-stock-research-product-surface-report-export-metadata-v0",
    );
  });

  it("T80.01-b: version constant starts with p80", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_VERSION).toMatch(/^p80/);
  });

  it("T80.01-c: version constant is a string", () => {
    expect(typeof STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_VERSION).toBe("string");
  });
});

// ─── T80.02: governance constant ──────────────────────────────────────────────

describe("T80.02: governance constant", () => {
  it("T80.02-a: reviewOnly === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE.reviewOnly).toBe(true);
  });

  it("T80.02-b: noInvestmentAdvice === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE.noInvestmentAdvice).toBe(true);
  });

  it("T80.02-c: noForecast === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE.noForecast).toBe(true);
  });

  it("T80.02-d: noRecommendation === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE.noRecommendation).toBe(true);
  });

  it("T80.02-e: previewOnly === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE.previewOnly).toBe(true);
  });

  it("T80.02-f: paperOnly === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE.paperOnly).toBe(true);
  });

  it("T80.02-g: noExecution === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE.noExecution).toBe(true);
  });

  it("T80.02-h: noActualMetrics === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE.noActualMetrics).toBe(true);
  });

  it("T80.02-i: entersAlphaScore === false", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  it("T80.02-j: notInvestmentAdvice === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE.notInvestmentAdvice).toBe(true);
  });

  it("T80.02-k: governance constant is frozen", () => {
    expect(Object.isFrozen(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE)).toBe(true);
  });

  it("T80.02-l: governance constant has exactly 10 keys", () => {
    expect(Object.keys(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE)).toHaveLength(10);
  });
});

// ─── T80.03: validator — valid input ──────────────────────────────────────────

describe("T80.03: validator — valid input", () => {
  it("T80.03-a: returns { valid: true } for valid artifact response", () => {
    const result = validateStaticSampleArtifactForExportMetadata(makeArtifactResponse());
    expect(result.valid).toBe(true);
  });

  it("T80.03-b: validator result has no reason field when valid", () => {
    const result = validateStaticSampleArtifactForExportMetadata(makeArtifactResponse());
    expect("reason" in result).toBe(false);
  });
});

// ─── T80.04: validator — bad governance flags ─────────────────────────────────

describe("T80.04: validator — bad governance flags", () => {
  it("T80.04-a: rejects when reviewOnly is false", () => {
    const result = validateStaticSampleArtifactForExportMetadata(
      makeArtifactResponse({ reviewOnly: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/reviewOnly/);
  });

  it("T80.04-b: rejects when noInvestmentAdvice is false", () => {
    const result = validateStaticSampleArtifactForExportMetadata(
      makeArtifactResponse({ noInvestmentAdvice: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/noInvestmentAdvice/);
  });

  it("T80.04-c: rejects when noForecast is false", () => {
    const result = validateStaticSampleArtifactForExportMetadata(
      makeArtifactResponse({ noForecast: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/noForecast/);
  });

  it("T80.04-d: rejects when noRecommendation is false", () => {
    const result = validateStaticSampleArtifactForExportMetadata(
      makeArtifactResponse({ noRecommendation: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/noRecommendation/);
  });

  it("T80.04-e: rejects when previewOnly is false", () => {
    const result = validateStaticSampleArtifactForExportMetadata(
      makeArtifactResponse({ previewOnly: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/previewOnly/);
  });

  it("T80.04-f: rejects when paperOnly is false", () => {
    const result = validateStaticSampleArtifactForExportMetadata(
      makeArtifactResponse({ paperOnly: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/paperOnly/);
  });

  it("T80.04-g: rejects when noExecution is false", () => {
    const result = validateStaticSampleArtifactForExportMetadata(
      makeArtifactResponse({ noExecution: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/noExecution/);
  });

  it("T80.04-h: rejects when noActualMetrics is false", () => {
    const result = validateStaticSampleArtifactForExportMetadata(
      makeArtifactResponse({ noActualMetrics: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/noActualMetrics/);
  });

  it("T80.04-i: rejects when entersAlphaScore is true", () => {
    const result = validateStaticSampleArtifactForExportMetadata(
      makeArtifactResponse({ entersAlphaScore: true as unknown as false }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/entersAlphaScore/);
  });

  it("T80.04-j: rejects when notInvestmentAdvice is false", () => {
    const result = validateStaticSampleArtifactForExportMetadata(
      makeArtifactResponse({ notInvestmentAdvice: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/notInvestmentAdvice/);
  });
});

// ─── T80.05: builder — throws on bad governance flags ─────────────────────────

describe("T80.05: builder — throws on governance violation", () => {
  it("T80.05-a: throws when reviewOnly is false", () => {
    expect(() =>
      buildStockResearchProductSurfaceReportExportMetadata(
        makeParams({ reviewOnly: false as unknown as true }),
      ),
    ).toThrow(/reviewOnly/);
  });

  it("T80.05-b: throws when noInvestmentAdvice is false", () => {
    expect(() =>
      buildStockResearchProductSurfaceReportExportMetadata(
        makeParams({ noInvestmentAdvice: false as unknown as true }),
      ),
    ).toThrow(/noInvestmentAdvice/);
  });

  it("T80.05-c: throws when noForecast is false", () => {
    expect(() =>
      buildStockResearchProductSurfaceReportExportMetadata(
        makeParams({ noForecast: false as unknown as true }),
      ),
    ).toThrow(/noForecast/);
  });

  it("T80.05-d: throws when noRecommendation is false", () => {
    expect(() =>
      buildStockResearchProductSurfaceReportExportMetadata(
        makeParams({ noRecommendation: false as unknown as true }),
      ),
    ).toThrow(/noRecommendation/);
  });

  it("T80.05-e: throws when previewOnly is false", () => {
    expect(() =>
      buildStockResearchProductSurfaceReportExportMetadata(
        makeParams({ previewOnly: false as unknown as true }),
      ),
    ).toThrow(/previewOnly/);
  });

  it("T80.05-f: throws when paperOnly is false", () => {
    expect(() =>
      buildStockResearchProductSurfaceReportExportMetadata(
        makeParams({ paperOnly: false as unknown as true }),
      ),
    ).toThrow(/paperOnly/);
  });

  it("T80.05-g: throws when noExecution is false", () => {
    expect(() =>
      buildStockResearchProductSurfaceReportExportMetadata(
        makeParams({ noExecution: false as unknown as true }),
      ),
    ).toThrow(/noExecution/);
  });

  it("T80.05-h: throws when noActualMetrics is false", () => {
    expect(() =>
      buildStockResearchProductSurfaceReportExportMetadata(
        makeParams({ noActualMetrics: false as unknown as true }),
      ),
    ).toThrow(/noActualMetrics/);
  });

  it("T80.05-i: throws when entersAlphaScore is true", () => {
    expect(() =>
      buildStockResearchProductSurfaceReportExportMetadata(
        makeParams({ entersAlphaScore: true as unknown as false }),
      ),
    ).toThrow(/entersAlphaScore/);
  });

  it("T80.05-j: throws when notInvestmentAdvice is false", () => {
    expect(() =>
      buildStockResearchProductSurfaceReportExportMetadata(
        makeParams({ notInvestmentAdvice: false as unknown as true }),
      ),
    ).toThrow(/notInvestmentAdvice/);
  });
});

// ─── T80.06: builder — valid output structure ─────────────────────────────────

describe("T80.06: builder — valid output structure", () => {
  let envelope: StockResearchProductSurfaceReportExportMetadataEnvelope;

  beforeEach(() => {
    envelope = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
  });

  it("T80.06-a: version matches constant", () => {
    expect(envelope.version).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_VERSION);
  });

  it("T80.06-b: generatedAt matches fixedGeneratedAt", () => {
    expect(envelope.generatedAt).toBe(FIXED_TS);
  });

  it("T80.06-c: reviewOnly === true", () => {
    expect(envelope.reviewOnly).toBe(true);
  });

  it("T80.06-d: noInvestmentAdvice === true", () => {
    expect(envelope.noInvestmentAdvice).toBe(true);
  });

  it("T80.06-e: noForecast === true", () => {
    expect(envelope.noForecast).toBe(true);
  });

  it("T80.06-f: noRecommendation === true", () => {
    expect(envelope.noRecommendation).toBe(true);
  });

  it("T80.06-g: previewOnly === true", () => {
    expect(envelope.previewOnly).toBe(true);
  });

  it("T80.06-h: paperOnly === true", () => {
    expect(envelope.paperOnly).toBe(true);
  });

  it("T80.06-i: noExecution === true", () => {
    expect(envelope.noExecution).toBe(true);
  });

  it("T80.06-j: noActualMetrics === true", () => {
    expect(envelope.noActualMetrics).toBe(true);
  });

  it("T80.06-k: entersAlphaScore === false", () => {
    expect(envelope.entersAlphaScore).toBe(false);
  });

  it("T80.06-l: notInvestmentAdvice === true", () => {
    expect(envelope.notInvestmentAdvice).toBe(true);
  });

  it("T80.06-m: fileName is deterministic neutral value", () => {
    expect(envelope.fileName).toBe("stock-research-product-surface-static-sample-artifact.md");
  });

  it("T80.06-n: mimeType is text/markdown; charset=utf-8", () => {
    expect(envelope.mimeType).toBe("text/markdown; charset=utf-8");
  });

  it("T80.06-o: contentBody is a non-empty string", () => {
    expect(typeof envelope.contentBody).toBe("string");
    expect(envelope.contentBody.length).toBeGreaterThan(0);
  });

  it("T80.06-p: metadata is a plain object", () => {
    expect(typeof envelope.metadata).toBe("object");
    expect(envelope.metadata).not.toBeNull();
  });
});

// ─── T80.07: builder — generatedAt behavior ───────────────────────────────────

describe("T80.07: builder — generatedAt behavior", () => {
  it("T80.07-a: uses fixedGeneratedAt when provided", () => {
    const result = buildStockResearchProductSurfaceReportExportMetadata(
      makeParams({}, "2026-01-01T00:00:00.000Z"),
    );
    expect(result.generatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("T80.07-b: different fixedGeneratedAt values produce different generatedAt", () => {
    const r1 = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, "2026-01-01T00:00:00.000Z"));
    const r2 = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, "2026-06-01T00:00:00.000Z"));
    expect(r1.generatedAt).not.toBe(r2.generatedAt);
  });

  it("T80.07-c: generatedAt is a string when no fixedGeneratedAt", () => {
    const result = buildStockResearchProductSurfaceReportExportMetadata(makeParams());
    expect(typeof result.generatedAt).toBe("string");
    expect(result.generatedAt.length).toBeGreaterThan(0);
  });

  it("T80.07-d: generatedAt without fixedGeneratedAt looks like ISO timestamp", () => {
    const result = buildStockResearchProductSurfaceReportExportMetadata(makeParams());
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ─── T80.08: contentBody validation ──────────────────────────────────────────

describe("T80.08: contentBody — neutral section labels", () => {
  let envelope: StockResearchProductSurfaceReportExportMetadataEnvelope;

  beforeEach(() => {
    envelope = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
  });

  it("T80.08-a: contentBody includes Disclaimer block label", () => {
    expect(envelope.contentBody).toContain("Disclaimer");
  });

  it("T80.08-b: contentBody includes Research Review block label", () => {
    expect(envelope.contentBody).toContain("Research Review");
  });

  it("T80.08-c: contentBody includes Simulation Input Audit block label", () => {
    expect(envelope.contentBody).toContain("Simulation Input Audit");
  });

  it("T80.08-d: contentBody includes Report Summary block label", () => {
    expect(envelope.contentBody).toContain("Report Summary");
  });

  it("T80.08-e: contentBody uses markdown heading syntax", () => {
    expect(envelope.contentBody).toContain("##");
  });

  it("T80.08-f: contentBody does not contain forbidden word 'buy'", () => {
    expect(envelope.contentBody.toLowerCase()).not.toMatch(/\bbuy\b/);
  });

  it("T80.08-g: contentBody does not contain forbidden word 'sell'", () => {
    expect(envelope.contentBody.toLowerCase()).not.toMatch(/\bsell\b/);
  });

  it("T80.08-h: contentBody does not contain forbidden word 'recommend'", () => {
    expect(envelope.contentBody.toLowerCase()).not.toMatch(/\brecommend\b/);
  });

  it("T80.08-i: contentBody does not contain affirmative forecast claim", () => {
    // Governance denial language ("No forecast") is permitted.
    // An affirmative claim like "forecast: ..." or "expected return" is forbidden.
    expect(envelope.contentBody.toLowerCase()).not.toMatch(/forecast\s*:/);
    expect(envelope.contentBody.toLowerCase()).not.toMatch(/expected return/);
  });

  it("T80.08-j: contentBody does not contain forbidden word 'profit'", () => {
    expect(envelope.contentBody.toLowerCase()).not.toMatch(/\bprofit\b/);
  });

  it("T80.08-k: contentBody does not contain forbidden word 'target'", () => {
    expect(envelope.contentBody.toLowerCase()).not.toMatch(/\btarget\b/);
  });

  it("T80.08-l: contentBody does not contain alphaScore term", () => {
    expect(envelope.contentBody).not.toContain("alphaScore");
  });
});

// ─── T80.09: metadata validation ─────────────────────────────────────────────

describe("T80.09: metadata — neutral fields only", () => {
  let envelope: StockResearchProductSurfaceReportExportMetadataEnvelope;

  beforeEach(() => {
    envelope = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
  });

  it("T80.09-a: metadata.artifactVersion is a non-empty string", () => {
    expect(typeof envelope.metadata.artifactVersion).toBe("string");
    expect(envelope.metadata.artifactVersion.length).toBeGreaterThan(0);
  });

  it("T80.09-b: metadata.artifactVersion matches P78 version constant", () => {
    expect(envelope.metadata.artifactVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_VERSION);
  });

  it("T80.09-c: metadata.artifactTitle is a non-empty string", () => {
    expect(typeof envelope.metadata.artifactTitle).toBe("string");
    expect(envelope.metadata.artifactTitle.length).toBeGreaterThan(0);
  });

  it("T80.09-d: metadata.researchCardCount is a number", () => {
    expect(typeof envelope.metadata.researchCardCount).toBe("number");
  });

  it("T80.09-e: metadata.researchCardCount equals artifact summary value", () => {
    expect(envelope.metadata.researchCardCount).toBe(2);
  });

  it("T80.09-f: metadata.simulationAuditCardCount is a number", () => {
    expect(typeof envelope.metadata.simulationAuditCardCount).toBe("number");
  });

  it("T80.09-g: metadata.simulationAuditCardCount equals artifact summary value", () => {
    expect(envelope.metadata.simulationAuditCardCount).toBe(1);
  });

  it("T80.09-h: metadata has exactly 4 keys", () => {
    expect(Object.keys(envelope.metadata)).toHaveLength(4);
  });

  it("T80.09-i: metadata does not contain alphaScore key", () => {
    expect("alphaScore" in envelope.metadata).toBe(false);
  });

  it("T80.09-j: metadata does not contain score key", () => {
    expect("score" in envelope.metadata).toBe(false);
  });

  it("T80.09-k: metadata does not contain recommendation key", () => {
    expect("recommendation" in envelope.metadata).toBe(false);
  });

  it("T80.09-l: metadata does not contain forecast key", () => {
    expect("forecast" in envelope.metadata).toBe(false);
  });

  it("T80.09-m: metadata does not contain verdict key", () => {
    expect("verdict" in envelope.metadata).toBe(false);
  });

  it("T80.09-n: metadata does not contain targetPrice key", () => {
    expect("targetPrice" in envelope.metadata).toBe(false);
  });

  it("T80.09-o: metadata is frozen", () => {
    expect(Object.isFrozen(envelope.metadata)).toBe(true);
  });
});

// ─── T80.10: immutability ─────────────────────────────────────────────────────

describe("T80.10: immutability and freezing", () => {
  it("T80.10-a: returned envelope is frozen", () => {
    const result = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("T80.10-b: metadata is frozen on returned envelope", () => {
    const result = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
    expect(Object.isFrozen(result.metadata)).toBe(true);
  });

  it("T80.10-c: frozen input is accepted without error", () => {
    const frozen = Object.freeze(makeArtifactResponse());
    expect(() =>
      buildStockResearchProductSurfaceReportExportMetadata({ artifactResponse: frozen, fixedGeneratedAt: FIXED_TS }),
    ).not.toThrow();
  });

  it("T80.10-d: input artifact is not mutated", () => {
    const artifact = makeArtifactResponse();
    const beforeKeys = Object.keys(artifact).sort().join(",");
    buildStockResearchProductSurfaceReportExportMetadata({ artifactResponse: artifact, fixedGeneratedAt: FIXED_TS });
    const afterKeys = Object.keys(artifact).sort().join(",");
    expect(beforeKeys).toBe(afterKeys);
  });

  it("T80.10-e: input reviewOnly flag is not mutated", () => {
    const artifact = makeArtifactResponse();
    buildStockResearchProductSurfaceReportExportMetadata({ artifactResponse: artifact, fixedGeneratedAt: FIXED_TS });
    expect(artifact.reviewOnly).toBe(true);
  });
});

// ─── T80.11: determinism and JSON safety ──────────────────────────────────────

describe("T80.11: determinism and JSON safety", () => {
  it("T80.11-a: is JSON-serializable without error", () => {
    const result = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("T80.11-b: JSON round-trip preserves version", () => {
    const result = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
    const parsed = JSON.parse(JSON.stringify(result));
    expect(parsed.version).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_VERSION);
  });

  it("T80.11-c: JSON round-trip preserves generatedAt", () => {
    const result = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
    const parsed = JSON.parse(JSON.stringify(result));
    expect(parsed.generatedAt).toBe(FIXED_TS);
  });

  it("T80.11-d: repeated calls with same fixedGeneratedAt produce identical version", () => {
    const r1 = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
    const r2 = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
    expect(r1.version).toBe(r2.version);
  });

  it("T80.11-e: repeated calls with same input produce identical fileName", () => {
    const r1 = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
    const r2 = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
    expect(r1.fileName).toBe(r2.fileName);
  });

  it("T80.11-f: repeated calls with same input produce identical contentBody", () => {
    const r1 = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
    const r2 = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
    expect(r1.contentBody).toBe(r2.contentBody);
  });

  it("T80.11-g: repeated calls with same input produce identical metadata", () => {
    const r1 = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
    const r2 = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
    expect(JSON.stringify(r1.metadata)).toBe(JSON.stringify(r2.metadata));
  });
});

// ─── T80.12: forbidden top-level fields ───────────────────────────────────────

describe("T80.12: forbidden fields in response top-level keys", () => {
  let envelope: StockResearchProductSurfaceReportExportMetadataEnvelope;

  beforeEach(() => {
    envelope = buildStockResearchProductSurfaceReportExportMetadata(makeParams({}, FIXED_TS));
  });

  it("T80.12-a: no alphaScore field in top-level response", () => {
    expect("alphaScore" in envelope).toBe(false);
  });

  it("T80.12-b: no verdict field in top-level response", () => {
    expect("verdict" in envelope).toBe(false);
  });

  it("T80.12-c: no score field in top-level response", () => {
    expect("score" in envelope).toBe(false);
  });

  it("T80.12-d: no recommendation field in top-level response", () => {
    expect("recommendation" in envelope).toBe(false);
  });

  it("T80.12-e: no targetPrice field in top-level response", () => {
    expect("targetPrice" in envelope).toBe(false);
  });

  it("T80.12-f: no forecast field in top-level response", () => {
    expect("forecast" in envelope).toBe(false);
  });

  it("T80.12-g: no action field in top-level response", () => {
    expect("action" in envelope).toBe(false);
  });

  it("T80.12-h: no prediction field in top-level response", () => {
    expect("prediction" in envelope).toBe(false);
  });

  it("T80.12-i: no pnl field in top-level response", () => {
    expect("pnl" in envelope).toBe(false);
  });

  it("T80.12-j: no winRate field in top-level response", () => {
    expect("winRate" in envelope).toBe(false);
  });
});

// ─── T80.13: source text — import verification ────────────────────────────────

describe("T80.13: source text — forbidden imports absent", () => {
  it("T80.13-a: source does not import from 'fs'", () => {
    expect(SOURCE_TEXT).not.toMatch(/from ['"]fs['"]/);
    expect(SOURCE_TEXT).not.toMatch(/require\(['"]fs['"]\)/);
  });

  it("T80.13-b: source does not import from 'path'", () => {
    expect(SOURCE_TEXT).not.toMatch(/from ['"]path['"]/);
    expect(SOURCE_TEXT).not.toMatch(/require\(['"]path['"]\)/);
  });

  it("T80.13-c: source does not import from '@prisma'", () => {
    expect(SOURCE_TEXT).not.toMatch(/from ['"]@prisma/);
  });

  it("T80.13-d: source does not import from 'prisma'", () => {
    expect(SOURCE_TEXT).not.toMatch(/from ['"]prisma/);
  });

  it("T80.13-e: source does not import fetch or network module", () => {
    expect(SOURCE_TEXT).not.toMatch(/from ['"]node-fetch['"]/);
    expect(SOURCE_TEXT).not.toMatch(/from ['"]axios['"]/);
  });

  it("T80.13-f: source does not import child_process", () => {
    expect(SOURCE_TEXT).not.toMatch(/from ['"]child_process['"]/);
    expect(SOURCE_TEXT).not.toMatch(/require\(['"]child_process['"]\)/);
  });

  it("T80.13-g: source does not import onlineValidation runtime", () => {
    expect(SOURCE_TEXT).not.toMatch(/onlineValidation/);
  });

  it("T80.13-h: source only uses import type from upstream P78 module", () => {
    expect(SOURCE_TEXT).toMatch(/import type \{/);
  });

  it("T80.13-i: source does not bare-import P78 module (no runtime import)", () => {
    const bareImports = SOURCE_TEXT.match(/^import \{[^}]*\} from ['"].*StaticSampleArtifact/gm);
    expect(bareImports).toBeNull();
  });
});

// ─── T80.14: source text — export verification ────────────────────────────────

describe("T80.14: source text — forbidden exports absent", () => {
  it("T80.14-a: source does not export function named 'run'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export function run\b/);
    expect(SOURCE_TEXT).not.toMatch(/export const run\b/);
  });

  it("T80.14-b: source does not export function named 'execute'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export function execute\b/);
    expect(SOURCE_TEXT).not.toMatch(/export const execute\b/);
  });

  it("T80.14-c: source does not export function named 'simulate'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export function simulate\b/);
    expect(SOURCE_TEXT).not.toMatch(/export const simulate\b/);
  });

  it("T80.14-d: source does not export function named 'score'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export function score\b/);
    expect(SOURCE_TEXT).not.toMatch(/export const score\b/);
  });

  it("T80.14-e: source does not export function named 'optimize'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export function optimize\b/);
    expect(SOURCE_TEXT).not.toMatch(/export const optimize\b/);
  });

  it("T80.14-f: source does not export function named 'backtest'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export function backtest\b/);
    expect(SOURCE_TEXT).not.toMatch(/export const backtest\b/);
  });

  it("T80.14-g: source does not export function named 'recommend'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export function recommend\b/);
    expect(SOURCE_TEXT).not.toMatch(/export const recommend\b/);
  });
});

// ─── T80.15: source text — forbidden financial terms absent ───────────────────

describe("T80.15: source text — forbidden financial terms absent", () => {
  it("T80.15-a: source does not reference ROI", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bROI\b/);
  });

  it("T80.15-b: source does not reference PnL", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bPnL\b/);
    expect(SOURCE_TEXT).not.toMatch(/\bpnl\b/);
  });

  it("T80.15-c: source does not reference winRate", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bwinRate\b/);
  });

  it("T80.15-d: source does not reference benchmark", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bbenchmark\b/);
  });

  it("T80.15-e: source does not reference targetPrice", () => {
    expect(SOURCE_TEXT).not.toMatch(/\btargetPrice\b/);
  });

  it("T80.15-f: source does not contain buy-action semantics", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bbuy\b/);
  });

  it("T80.15-g: source does not contain sell-action semantics", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bsell\b/);
  });

  it("T80.15-h: source does not contain hold-action semantics", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bhold\b/);
  });

  it("T80.15-i: source does not reference alphaScore", () => {
    expect(SOURCE_TEXT).not.toMatch(/\balphaScore\b/);
  });

  it("T80.15-j: source does not use Buffer or Blob in executable code", () => {
    // Comments may describe what is NOT done; check executable lines only.
    const codeLines = SOURCE_TEXT.split("\n").filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//"));
    const codeText = codeLines.join("\n");
    expect(codeText).not.toMatch(/\bBuffer\b/);
    expect(codeText).not.toMatch(/\bBlob\b/);
  });

  it("T80.15-k: source does not use stream in executable code", () => {
    // Comments may describe what is NOT done; check executable lines only.
    const codeLines = SOURCE_TEXT.split("\n").filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//"));
    const codeText = codeLines.join("\n");
    expect(codeText).not.toMatch(/\bstream\b/);
    expect(codeText).not.toMatch(/\.pipe\(/);
  });

  it("T80.15-l: source does not reference writeFile or createWriteStream", () => {
    expect(SOURCE_TEXT).not.toMatch(/writeFile/);
    expect(SOURCE_TEXT).not.toMatch(/createWriteStream/);
  });
});
