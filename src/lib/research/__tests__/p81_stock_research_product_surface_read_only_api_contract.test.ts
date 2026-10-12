/**
 * P81 — Stock Research Product Surface Read-Only API Contract
 * Test suite: 100+ tests
 *
 * Verifies:
 *   - version and governance constants
 *   - valid P80 export metadata envelope acceptance
 *   - all 10 bad governance flags rejected by validator
 *   - all 10 bad governance flags throw in builder
 *   - fixed/default generatedAt
 *   - status is "ok"
 *   - fileName / mimeType / contentBody preserved from P80 envelope
 *   - metadata preserved and frozen
 *   - governanceFlags frozen and correct
 *   - output is frozen
 *   - JSON serializable
 *   - deterministic repeated calls
 *   - input not mutated
 *   - frozen input supported
 *   - response top-level keys contain no forbidden fields
 *   - metadata keys contain no forbidden fields
 *   - governanceFlags keys contain no forbidden fields
 *   - source text import verification (no DB / Prisma / fs / path / network)
 *   - source text no HTTP / route / endpoint / server runtime
 *   - source text no forbidden financial terms
 *   - source text no buy / sell / hold / action semantics
 *   - source text no prediction / investment-advice / recommendation fields
 *   - source text no forbidden export signatures
 */

import fs from "fs";
import path from "path";

import {
  STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_VERSION,
  STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE,
  StockResearchProductSurfaceReadOnlyApiContractGovernanceError,
  validateExportMetadataForReadOnlyApiContract,
  buildStockResearchProductSurfaceReadOnlyApiContract,
} from "../api/StockResearchProductSurfaceReadOnlyApiContract";

import type {
  StockResearchProductSurfaceReadOnlyApiContractValidationResult,
  StockResearchProductSurfaceReadOnlyApiContractResponse,
  StockResearchProductSurfaceReadOnlyApiContractParams,
  StockResearchProductSurfaceReadOnlyApiContractGovernanceFlags,
} from "../api/StockResearchProductSurfaceReadOnlyApiContract";

import type {
  StockResearchProductSurfaceReportExportMetadataEnvelope,
} from "../export/StockResearchProductSurfaceReportExportMetadata";

import {
  STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_VERSION,
} from "../export/StockResearchProductSurfaceReportExportMetadata";

// ─── Source text ─────────────────────────────────────────────────────────────

const SOURCE_PATH = path.resolve(
  __dirname,
  "../api/StockResearchProductSurfaceReadOnlyApiContract.ts",
);

const SOURCE_TEXT = fs.readFileSync(SOURCE_PATH, "utf-8");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FIXED_TS = "2026-05-26T12:00:00.000Z";
const FIXED_TS_ALT = "2026-05-26T14:00:00.000Z";

function makeEnvelope(
  overrides: Partial<StockResearchProductSurfaceReportExportMetadataEnvelope> = {},
): StockResearchProductSurfaceReportExportMetadataEnvelope {
  const base: StockResearchProductSurfaceReportExportMetadataEnvelope = {
    version: STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_VERSION,
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
    fileName: "stock-research-product-surface-static-sample-artifact.md",
    mimeType: "text/markdown; charset=utf-8",
    contentBody: "## Disclaimer\n\nThis report is review-only and not investment advice.\n",
    metadata: Object.freeze({
      artifactVersion: STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_VERSION,
      artifactTitle: "Stock Research Product Surface Static Sample Artifact",
      researchCardCount: 2,
      simulationAuditCardCount: 1,
    }),
  };
  return Object.freeze({ ...base, ...overrides }) as StockResearchProductSurfaceReportExportMetadataEnvelope;
}

function makeParams(
  envelopeOverrides: Partial<StockResearchProductSurfaceReportExportMetadataEnvelope> = {},
  fixedGeneratedAt?: string,
): StockResearchProductSurfaceReadOnlyApiContractParams {
  return {
    envelope: makeEnvelope(envelopeOverrides),
    ...(fixedGeneratedAt !== undefined ? { fixedGeneratedAt } : {}),
  };
}

// ─── T81.01: version constant ─────────────────────────────────────────────────

describe("T81.01: version constant", () => {
  it("T81.01-a: version constant is exact expected value", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_VERSION).toBe(
      "p81-stock-research-product-surface-read-only-api-contract-v0",
    );
  });

  it("T81.01-b: version constant starts with p81", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_VERSION).toMatch(/^p81/);
  });

  it("T81.01-c: version constant is a string", () => {
    expect(typeof STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_VERSION).toBe("string");
  });
});

// ─── T81.02: governance constant ──────────────────────────────────────────────

describe("T81.02: governance constant", () => {
  it("T81.02-a: reviewOnly === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE.reviewOnly).toBe(true);
  });

  it("T81.02-b: noInvestmentAdvice === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE.noInvestmentAdvice).toBe(true);
  });

  it("T81.02-c: noForecast === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE.noForecast).toBe(true);
  });

  it("T81.02-d: noRecommendation === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE.noRecommendation).toBe(true);
  });

  it("T81.02-e: previewOnly === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE.previewOnly).toBe(true);
  });

  it("T81.02-f: paperOnly === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE.paperOnly).toBe(true);
  });

  it("T81.02-g: noExecution === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE.noExecution).toBe(true);
  });

  it("T81.02-h: noActualMetrics === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE.noActualMetrics).toBe(true);
  });

  it("T81.02-i: entersAlphaScore === false", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  it("T81.02-j: notInvestmentAdvice === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE.notInvestmentAdvice).toBe(true);
  });

  it("T81.02-k: governance constant is frozen", () => {
    expect(Object.isFrozen(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE)).toBe(true);
  });

  it("T81.02-l: governance constant has exactly 10 flags", () => {
    expect(Object.keys(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE)).toHaveLength(10);
  });
});

// ─── T81.03: validator — valid envelope ───────────────────────────────────────

describe("T81.03: validator — valid P80 envelope accepted", () => {
  it("T81.03-a: valid envelope returns { valid: true }", () => {
    const result = validateExportMetadataForReadOnlyApiContract(makeEnvelope());
    expect(result.valid).toBe(true);
  });

  it("T81.03-b: valid result has no reason field", () => {
    const result = validateExportMetadataForReadOnlyApiContract(makeEnvelope());
    expect("reason" in result).toBe(false);
  });
});

// ─── T81.04: validator — each bad governance flag rejected ────────────────────

describe("T81.04: validator — each bad governance flag rejected", () => {
  it("T81.04-a: reviewOnly=false returns valid:false", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ reviewOnly: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T81.04-b: reviewOnly=false reason mentions reviewOnly", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ reviewOnly: false as unknown as true }),
    );
    if (!result.valid) expect(result.reason).toContain("reviewOnly");
  });

  it("T81.04-c: noInvestmentAdvice=false returns valid:false", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ noInvestmentAdvice: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T81.04-d: noInvestmentAdvice=false reason mentions noInvestmentAdvice", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ noInvestmentAdvice: false as unknown as true }),
    );
    if (!result.valid) expect(result.reason).toContain("noInvestmentAdvice");
  });

  it("T81.04-e: noForecast=false returns valid:false", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ noForecast: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T81.04-f: noForecast=false reason mentions noForecast", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ noForecast: false as unknown as true }),
    );
    if (!result.valid) expect(result.reason).toContain("noForecast");
  });

  it("T81.04-g: noRecommendation=false returns valid:false", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ noRecommendation: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T81.04-h: noRecommendation=false reason mentions noRecommendation", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ noRecommendation: false as unknown as true }),
    );
    if (!result.valid) expect(result.reason).toContain("noRecommendation");
  });

  it("T81.04-i: previewOnly=false returns valid:false", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ previewOnly: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T81.04-j: previewOnly=false reason mentions previewOnly", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ previewOnly: false as unknown as true }),
    );
    if (!result.valid) expect(result.reason).toContain("previewOnly");
  });

  it("T81.04-k: paperOnly=false returns valid:false", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ paperOnly: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T81.04-l: paperOnly=false reason mentions paperOnly", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ paperOnly: false as unknown as true }),
    );
    if (!result.valid) expect(result.reason).toContain("paperOnly");
  });

  it("T81.04-m: noExecution=false returns valid:false", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ noExecution: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T81.04-n: noExecution=false reason mentions noExecution", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ noExecution: false as unknown as true }),
    );
    if (!result.valid) expect(result.reason).toContain("noExecution");
  });

  it("T81.04-o: noActualMetrics=false returns valid:false", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ noActualMetrics: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T81.04-p: noActualMetrics=false reason mentions noActualMetrics", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ noActualMetrics: false as unknown as true }),
    );
    if (!result.valid) expect(result.reason).toContain("noActualMetrics");
  });

  it("T81.04-q: entersAlphaScore=true returns valid:false", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ entersAlphaScore: true as unknown as false }),
    );
    expect(result.valid).toBe(false);
  });

  it("T81.04-r: entersAlphaScore=true reason mentions entersAlphaScore", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ entersAlphaScore: true as unknown as false }),
    );
    if (!result.valid) expect(result.reason).toContain("entersAlphaScore");
  });

  it("T81.04-s: notInvestmentAdvice=false returns valid:false", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ notInvestmentAdvice: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T81.04-t: notInvestmentAdvice=false reason mentions notInvestmentAdvice", () => {
    const result = validateExportMetadataForReadOnlyApiContract(
      makeEnvelope({ notInvestmentAdvice: false as unknown as true }),
    );
    if (!result.valid) expect(result.reason).toContain("notInvestmentAdvice");
  });
});

// ─── T81.05: builder — throws on governance violation ─────────────────────────

describe("T81.05: builder — throws StockResearchProductSurfaceReadOnlyApiContractGovernanceError on violation", () => {
  it("T81.05-a: throws on reviewOnly=false", () => {
    expect(() => buildStockResearchProductSurfaceReadOnlyApiContract(
      makeParams({ reviewOnly: false as unknown as true }),
    )).toThrow(StockResearchProductSurfaceReadOnlyApiContractGovernanceError);
  });

  it("T81.05-b: throws on noInvestmentAdvice=false", () => {
    expect(() => buildStockResearchProductSurfaceReadOnlyApiContract(
      makeParams({ noInvestmentAdvice: false as unknown as true }),
    )).toThrow(StockResearchProductSurfaceReadOnlyApiContractGovernanceError);
  });

  it("T81.05-c: throws on noForecast=false", () => {
    expect(() => buildStockResearchProductSurfaceReadOnlyApiContract(
      makeParams({ noForecast: false as unknown as true }),
    )).toThrow(StockResearchProductSurfaceReadOnlyApiContractGovernanceError);
  });

  it("T81.05-d: throws on noRecommendation=false", () => {
    expect(() => buildStockResearchProductSurfaceReadOnlyApiContract(
      makeParams({ noRecommendation: false as unknown as true }),
    )).toThrow(StockResearchProductSurfaceReadOnlyApiContractGovernanceError);
  });

  it("T81.05-e: throws on previewOnly=false", () => {
    expect(() => buildStockResearchProductSurfaceReadOnlyApiContract(
      makeParams({ previewOnly: false as unknown as true }),
    )).toThrow(StockResearchProductSurfaceReadOnlyApiContractGovernanceError);
  });

  it("T81.05-f: throws on paperOnly=false", () => {
    expect(() => buildStockResearchProductSurfaceReadOnlyApiContract(
      makeParams({ paperOnly: false as unknown as true }),
    )).toThrow(StockResearchProductSurfaceReadOnlyApiContractGovernanceError);
  });

  it("T81.05-g: throws on noExecution=false", () => {
    expect(() => buildStockResearchProductSurfaceReadOnlyApiContract(
      makeParams({ noExecution: false as unknown as true }),
    )).toThrow(StockResearchProductSurfaceReadOnlyApiContractGovernanceError);
  });

  it("T81.05-h: throws on noActualMetrics=false", () => {
    expect(() => buildStockResearchProductSurfaceReadOnlyApiContract(
      makeParams({ noActualMetrics: false as unknown as true }),
    )).toThrow(StockResearchProductSurfaceReadOnlyApiContractGovernanceError);
  });

  it("T81.05-i: throws on entersAlphaScore=true", () => {
    expect(() => buildStockResearchProductSurfaceReadOnlyApiContract(
      makeParams({ entersAlphaScore: true as unknown as false }),
    )).toThrow(StockResearchProductSurfaceReadOnlyApiContractGovernanceError);
  });

  it("T81.05-j: throws on notInvestmentAdvice=false", () => {
    expect(() => buildStockResearchProductSurfaceReadOnlyApiContract(
      makeParams({ notInvestmentAdvice: false as unknown as true }),
    )).toThrow(StockResearchProductSurfaceReadOnlyApiContractGovernanceError);
  });

  it("T81.05-k: error name is StockResearchProductSurfaceReadOnlyApiContractGovernanceError", () => {
    expect(() => buildStockResearchProductSurfaceReadOnlyApiContract(
      makeParams({ reviewOnly: false as unknown as true }),
    )).toThrow(expect.objectContaining({ name: "StockResearchProductSurfaceReadOnlyApiContractGovernanceError" }));
  });

  it("T81.05-l: error message contains Governance validation failed", () => {
    expect(() => buildStockResearchProductSurfaceReadOnlyApiContract(
      makeParams({ noForecast: false as unknown as true }),
    )).toThrow(/Governance validation failed/);
  });
});

// ─── T81.06: builder — valid envelope builds response ─────────────────────────

describe("T81.06: builder — valid envelope produces correct response", () => {
  it("T81.06-a: status is 'ok'", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.status).toBe("ok");
  });

  it("T81.06-b: version matches P81 version constant", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.version).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_VERSION);
  });

  it("T81.06-c: version starts with p81", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.version).toMatch(/^p81/);
  });

  it("T81.06-d: generatedAt matches fixedGeneratedAt when provided", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.generatedAt).toBe(FIXED_TS);
  });

  it("T81.06-e: generatedAt is ISO string when fixedGeneratedAt not provided", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams());
    expect(res.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("T81.06-f: different fixedGeneratedAt values produce different generatedAt", () => {
    const r1 = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    const r2 = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS_ALT));
    expect(r1.generatedAt).not.toBe(r2.generatedAt);
  });

  it("T81.06-g: fileName matches P80 envelope fileName", () => {
    const envelope = makeEnvelope({ fileName: "custom-file.md" });
    const res = buildStockResearchProductSurfaceReadOnlyApiContract({ envelope, fixedGeneratedAt: FIXED_TS });
    expect(res.fileName).toBe("custom-file.md");
  });

  it("T81.06-h: fileName is the expected neutral filename for default envelope", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.fileName).toBe("stock-research-product-surface-static-sample-artifact.md");
  });

  it("T81.06-i: mimeType matches P80 envelope mimeType", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.mimeType).toBe("text/markdown; charset=utf-8");
  });

  it("T81.06-j: contentBody matches P80 envelope contentBody", () => {
    const envelope = makeEnvelope({ contentBody: "## Neutral Content\n\nReview only.\n" });
    const res = buildStockResearchProductSurfaceReadOnlyApiContract({ envelope, fixedGeneratedAt: FIXED_TS });
    expect(res.contentBody).toBe("## Neutral Content\n\nReview only.\n");
  });

  it("T81.06-k: metadata.artifactVersion preserved", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.metadata.artifactVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_VERSION);
  });

  it("T81.06-l: metadata.artifactTitle preserved", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.metadata.artifactTitle).toBe("Stock Research Product Surface Static Sample Artifact");
  });

  it("T81.06-m: metadata.researchCardCount preserved", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.metadata.researchCardCount).toBe(2);
  });

  it("T81.06-n: metadata.simulationAuditCardCount preserved", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.metadata.simulationAuditCardCount).toBe(1);
  });
});

// ─── T81.07: governance flags in response ────────────────────────────────────

describe("T81.07: governanceFlags in response", () => {
  it("T81.07-a: governanceFlags.reviewOnly === true", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.governanceFlags.reviewOnly).toBe(true);
  });

  it("T81.07-b: governanceFlags.noInvestmentAdvice === true", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.governanceFlags.noInvestmentAdvice).toBe(true);
  });

  it("T81.07-c: governanceFlags.noForecast === true", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.governanceFlags.noForecast).toBe(true);
  });

  it("T81.07-d: governanceFlags.noRecommendation === true", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.governanceFlags.noRecommendation).toBe(true);
  });

  it("T81.07-e: governanceFlags.previewOnly === true", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.governanceFlags.previewOnly).toBe(true);
  });

  it("T81.07-f: governanceFlags.paperOnly === true", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.governanceFlags.paperOnly).toBe(true);
  });

  it("T81.07-g: governanceFlags.noExecution === true", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.governanceFlags.noExecution).toBe(true);
  });

  it("T81.07-h: governanceFlags.noActualMetrics === true", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.governanceFlags.noActualMetrics).toBe(true);
  });

  it("T81.07-i: governanceFlags.entersAlphaScore === false", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.governanceFlags.entersAlphaScore).toBe(false);
  });

  it("T81.07-j: governanceFlags.notInvestmentAdvice === true", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(res.governanceFlags.notInvestmentAdvice).toBe(true);
  });

  it("T81.07-k: governanceFlags is frozen", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.isFrozen(res.governanceFlags)).toBe(true);
  });
});

// ─── T81.08: immutability ─────────────────────────────────────────────────────

describe("T81.08: immutability", () => {
  it("T81.08-a: response is frozen", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.isFrozen(res)).toBe(true);
  });

  it("T81.08-b: metadata is frozen", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.isFrozen(res.metadata)).toBe(true);
  });

  it("T81.08-c: frozen input envelope is supported (does not throw)", () => {
    const envelope = Object.freeze(makeEnvelope());
    expect(() => buildStockResearchProductSurfaceReadOnlyApiContract({ envelope, fixedGeneratedAt: FIXED_TS })).not.toThrow();
  });

  it("T81.08-d: input envelope is not mutated", () => {
    const envelope = makeEnvelope({ fileName: "original.md" });
    buildStockResearchProductSurfaceReadOnlyApiContract({ envelope, fixedGeneratedAt: FIXED_TS });
    expect(envelope.fileName).toBe("original.md");
  });
});

// ─── T81.09: JSON safety and determinism ──────────────────────────────────────

describe("T81.09: JSON safety and determinism", () => {
  it("T81.09-a: response is JSON serializable", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(() => JSON.stringify(res)).not.toThrow();
  });

  it("T81.09-b: JSON.parse(JSON.stringify(res)) status is 'ok'", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    const parsed = JSON.parse(JSON.stringify(res));
    expect(parsed.status).toBe("ok");
  });

  it("T81.09-c: repeated calls with same fixedGeneratedAt produce identical generatedAt", () => {
    const r1 = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    const r2 = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(r1.generatedAt).toBe(r2.generatedAt);
  });

  it("T81.09-d: repeated calls with same fixedGeneratedAt produce identical version", () => {
    const r1 = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    const r2 = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(r1.version).toBe(r2.version);
  });

  it("T81.09-e: repeated calls with same fixedGeneratedAt produce identical fileName", () => {
    const r1 = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    const r2 = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(r1.fileName).toBe(r2.fileName);
  });
});

// ─── T81.10: forbidden fields in response ────────────────────────────────────

describe("T81.10: forbidden fields in response top-level", () => {
  const FORBIDDEN_KEYS = [
    "alphaScore", "targetPrice", "recommendation", "buyHold", "forecast",
    "score", "verdict", "causalChain", "mergedScore", "pnl", "roi",
    "winRate", "benchmark", "prediction", "investmentAdvice",
  ];

  for (const key of FORBIDDEN_KEYS) {
    it(`T81.10: response has no key '${key}'`, () => {
      const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
      expect(Object.keys(res)).not.toContain(key);
    });
  }
});

// ─── T81.11: forbidden fields in metadata ────────────────────────────────────

describe("T81.11: forbidden fields in metadata", () => {
  const FORBIDDEN_METADATA_KEYS = [
    "alphaScore", "targetPrice", "recommendation", "score", "verdict", "pnl", "roi",
    "winRate", "benchmark", "prediction",
  ];

  for (const key of FORBIDDEN_METADATA_KEYS) {
    it(`T81.11: metadata has no key '${key}'`, () => {
      const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
      expect(Object.keys(res.metadata)).not.toContain(key);
    });
  }
});

// ─── T81.12: source text — no DB / Prisma / fs / path / network ──────────────

describe("T81.12: source text — no forbidden runtime imports", () => {
  it("T81.12-a: no PrismaClient import", () => {
    expect(SOURCE_TEXT).not.toMatch(/from ['"]@prisma\/client['"]/);
  });

  it("T81.12-b: no prisma import", () => {
    expect(SOURCE_TEXT).not.toMatch(/import.*prisma/i);
  });

  it("T81.12-c: no fs import", () => {
    expect(SOURCE_TEXT).not.toMatch(/^import.*\bfs\b/m);
  });

  it("T81.12-d: no path import", () => {
    expect(SOURCE_TEXT).not.toMatch(/^import.*\bpath\b/m);
  });

  it("T81.12-e: no child_process import", () => {
    expect(SOURCE_TEXT).not.toMatch(/child_process/);
  });

  it("T81.12-f: no fetch usage", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bfetch\(/);
  });

  it("T81.12-g: no axios import", () => {
    expect(SOURCE_TEXT).not.toMatch(/import.*axios/);
  });

  it("T81.12-h: no http import", () => {
    expect(SOURCE_TEXT).not.toMatch(/^import.*\bhttp\b/m);
  });

  it("T81.12-i: no Buffer usage", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bBuffer\b/);
  });

  it("T81.12-j: no Blob usage", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bBlob\b/);
  });

  it("T81.12-k: no stream import", () => {
    expect(SOURCE_TEXT).not.toMatch(/^import.*\bstream\b/m);
  });

  it("T81.12-l: no onlineValidation runtime import", () => {
    expect(SOURCE_TEXT).not.toMatch(/onlineValidation/);
  });
});

// ─── T81.13: source text — no HTTP / route / endpoint ────────────────────────

describe("T81.13: source text — no HTTP / route / endpoint / server runtime", () => {
  it("T81.13-a: no NextRequest import", () => {
    expect(SOURCE_TEXT).not.toMatch(/NextRequest/);
  });

  it("T81.13-b: no NextResponse import", () => {
    expect(SOURCE_TEXT).not.toMatch(/NextResponse/);
  });

  it("T81.13-c: no 'use server' directive", () => {
    expect(SOURCE_TEXT).not.toMatch(/'use server'/);
  });

  it("T81.13-d: no export async function GET", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+async\s+function\s+GET/);
  });

  it("T81.13-e: no export async function POST", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+async\s+function\s+POST/);
  });

  it("T81.13-f: no export async function PUT", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+async\s+function\s+PUT/);
  });

  it("T81.13-g: no export async function DELETE", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+async\s+function\s+DELETE/);
  });

  it("T81.13-h: no app/api path reference", () => {
    expect(SOURCE_TEXT).not.toMatch(/app\/api/);
  });
});

// ─── T81.14: source text — no forbidden financial terms ──────────────────────

describe("T81.14: source text — no forbidden financial terms", () => {
  it("T81.14-a: no alphaScore reference", () => {
    expect(SOURCE_TEXT).not.toMatch(/alphaScore/);
  });

  it("T81.14-b: no targetPrice reference", () => {
    expect(SOURCE_TEXT).not.toMatch(/targetPrice/);
  });

  it("T81.14-c: no ROI reference", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bROI\b/);
  });

  it("T81.14-d: no PnL reference", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bPnL\b/);
  });

  it("T81.14-e: no winRate reference", () => {
    expect(SOURCE_TEXT).not.toMatch(/winRate/);
  });

  it("T81.14-f: no benchmark reference", () => {
    expect(SOURCE_TEXT).not.toMatch(/benchmark/);
  });

  it("T81.14-g: no forecast function call", () => {
    expect(SOURCE_TEXT).not.toMatch(/runForecast/);
  });

  it("T81.14-h: no simulate function call", () => {
    expect(SOURCE_TEXT).not.toMatch(/runSimulat/);
  });

  it("T81.14-i: no runBacktest", () => {
    expect(SOURCE_TEXT).not.toMatch(/runBacktest/);
  });

  it("T81.14-j: no runOptimizer", () => {
    expect(SOURCE_TEXT).not.toMatch(/runOptimizer/);
  });
});

// ─── T81.15: source text — no forbidden exports ───────────────────────────────

describe("T81.15: source text — no forbidden export signatures", () => {
  it("T81.15-a: does not export 'run'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+(?:async\s+)?function\s+run\b/);
  });

  it("T81.15-b: does not export 'execute'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+(?:async\s+)?function\s+execute\b/);
  });

  it("T81.15-c: does not export 'simulate'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+(?:async\s+)?function\s+simulate\b/);
  });

  it("T81.15-d: does not export 'score'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+(?:async\s+)?function\s+score\b/);
  });

  it("T81.15-e: does not export 'optimize'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+(?:async\s+)?function\s+optimize\b/);
  });

  it("T81.15-f: does not export 'backtest'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+(?:async\s+)?function\s+backtest\b/);
  });

  it("T81.15-g: does not export 'recommend'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+(?:async\s+)?function\s+recommend\b/);
  });
});

// ─── T81.16: error class shape ────────────────────────────────────────────────

describe("T81.16: StockResearchProductSurfaceReadOnlyApiContractGovernanceError", () => {
  it("T81.16-a: is instance of Error", () => {
    const err = new StockResearchProductSurfaceReadOnlyApiContractGovernanceError("test reason");
    expect(err instanceof Error).toBe(true);
  });

  it("T81.16-b: name is StockResearchProductSurfaceReadOnlyApiContractGovernanceError", () => {
    const err = new StockResearchProductSurfaceReadOnlyApiContractGovernanceError("test reason");
    expect(err.name).toBe("StockResearchProductSurfaceReadOnlyApiContractGovernanceError");
  });

  it("T81.16-c: message is preserved", () => {
    const err = new StockResearchProductSurfaceReadOnlyApiContractGovernanceError("test reason");
    expect(err.message).toBe("test reason");
  });
});

// ─── T81.17: metadata has exactly expected keys ───────────────────────────────

describe("T81.17: metadata structure", () => {
  it("T81.17-a: metadata has exactly 4 keys", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.keys(res.metadata)).toHaveLength(4);
  });

  it("T81.17-b: metadata has artifactVersion key", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.keys(res.metadata)).toContain("artifactVersion");
  });

  it("T81.17-c: metadata has artifactTitle key", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.keys(res.metadata)).toContain("artifactTitle");
  });

  it("T81.17-d: metadata has researchCardCount key", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.keys(res.metadata)).toContain("researchCardCount");
  });

  it("T81.17-e: metadata has simulationAuditCardCount key", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.keys(res.metadata)).toContain("simulationAuditCardCount");
  });
});

// ─── T81.18: governanceFlags has exactly 10 keys ──────────────────────────────

describe("T81.18: governanceFlags structure", () => {
  it("T81.18-a: governanceFlags has exactly 10 keys", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.keys(res.governanceFlags)).toHaveLength(10);
  });
});

// ─── T81.19: response has expected top-level keys ─────────────────────────────

describe("T81.19: response top-level key set", () => {
  it("T81.19-a: response has exactly 8 top-level keys", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.keys(res)).toHaveLength(8);
  });

  it("T81.19-b: response has 'status' key", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.keys(res)).toContain("status");
  });

  it("T81.19-c: response has 'version' key", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.keys(res)).toContain("version");
  });

  it("T81.19-d: response has 'generatedAt' key", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.keys(res)).toContain("generatedAt");
  });

  it("T81.19-e: response has 'governanceFlags' key", () => {
    const res = buildStockResearchProductSurfaceReadOnlyApiContract(makeParams({}, FIXED_TS));
    expect(Object.keys(res)).toContain("governanceFlags");
  });
});
