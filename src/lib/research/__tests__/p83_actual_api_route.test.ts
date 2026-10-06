/**
 * @jest-environment node
 */
/**
 * P83 — Actual API Route Test Suite
 * Tests for: GET /api/research/product-surface
 *
 * T83.1  – T83.70 (70 tests)
 *
 * Authorization token: P83_GATE_ACTUAL_API_ROUTE_APPROVED_WITH_STRICT_SCOPE
 * Upstream baseline: P81 — StockResearchProductSurfaceReadOnlyApiContract (ac54a43)
 *
 * Axis A (real-route tests): T83.1–T83.46 (46 tests)
 * Axis B (source-scaffold / text-scan tests): T83.47–T83.70 (24 tests)
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import fs from "fs";
import path from "path";

// ─── Source text ──────────────────────────────────────────────────────────────

const ROUTE_SOURCE_PATH = path.resolve(
  __dirname,
  "../../../app/api/research/product-surface/route.ts",
);

const ROUTE_SOURCE = fs.readFileSync(ROUTE_SOURCE_PATH, "utf-8");

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callGET() {
  const { GET } = await import("../../../app/api/research/product-surface/route");
  return GET();
}

async function callGETJson(): Promise<Record<string, unknown>> {
  const response = await callGET();
  return response.json() as Promise<Record<string, unknown>>;
}

// ─── T83.1–T83.2: Function existence ─────────────────────────────────────────

describe("T83.1–T83.2 | Function existence", () => {
  it("T83.1 GET is defined in route module", async () => {
    const mod = await import("../../../app/api/research/product-surface/route");
    expect(mod.GET).toBeDefined();
  });

  it("T83.2 GET is a function", async () => {
    const mod = await import("../../../app/api/research/product-surface/route");
    expect(typeof mod.GET).toBe("function");
  });
});

// ─── T83.3–T83.8: HTTP response status & structure ───────────────────────────

describe("T83.3–T83.8 | HTTP response status & structure", () => {
  it("T83.3 GET returns HTTP 200", async () => {
    const response = await callGET();
    expect(response.status).toBe(200);
  });

  it("T83.4 response body has status field", async () => {
    const data = await callGETJson();
    expect(data).toHaveProperty("status");
  });

  it("T83.5 response body has version field", async () => {
    const data = await callGETJson();
    expect(data).toHaveProperty("version");
  });

  it("T83.6 response body has generatedAt field", async () => {
    const data = await callGETJson();
    expect(data).toHaveProperty("generatedAt");
  });

  it("T83.7 response body has fileName field", async () => {
    const data = await callGETJson();
    expect(data).toHaveProperty("fileName");
  });

  it("T83.8 response body has mimeType field", async () => {
    const data = await callGETJson();
    expect(data).toHaveProperty("mimeType");
  });
});

// ─── T83.9–T83.14: Response content fields ───────────────────────────────────

describe("T83.9–T83.14 | Response content fields", () => {
  it("T83.9 contentBody is present", async () => {
    const data = await callGETJson();
    expect(data).toHaveProperty("contentBody");
  });

  it("T83.10 contentBody is a non-empty string", async () => {
    const data = await callGETJson();
    expect(typeof data["contentBody"]).toBe("string");
    expect((data["contentBody"] as string).length).toBeGreaterThan(0);
  });

  it("T83.11 metadata is present", async () => {
    const data = await callGETJson();
    expect(data).toHaveProperty("metadata");
  });

  it("T83.12 metadata.artifactVersion is present", async () => {
    const data = await callGETJson();
    const metadata = data["metadata"] as Record<string, unknown>;
    expect(metadata).toHaveProperty("artifactVersion");
  });

  it("T83.13 metadata.researchCardCount is present", async () => {
    const data = await callGETJson();
    const metadata = data["metadata"] as Record<string, unknown>;
    expect(metadata).toHaveProperty("researchCardCount");
  });

  it("T83.14 metadata.simulationAuditCardCount is present", async () => {
    const data = await callGETJson();
    const metadata = data["metadata"] as Record<string, unknown>;
    expect(metadata).toHaveProperty("simulationAuditCardCount");
  });
});

// ─── T83.15–T83.24: Governance flags ─────────────────────────────────────────

describe("T83.15–T83.24 | Governance flags", () => {
  async function flags() {
    const data = await callGETJson();
    return data["governanceFlags"] as Record<string, unknown>;
  }

  it("T83.15 governanceFlags.reviewOnly === true", async () => {
    expect((await flags())["reviewOnly"]).toBe(true);
  });

  it("T83.16 governanceFlags.noInvestmentAdvice === true", async () => {
    expect((await flags())["noInvestmentAdvice"]).toBe(true);
  });

  it("T83.17 governanceFlags.noForecast === true", async () => {
    expect((await flags())["noForecast"]).toBe(true);
  });

  it("T83.18 governanceFlags.noRecommendation === true", async () => {
    expect((await flags())["noRecommendation"]).toBe(true);
  });

  it("T83.19 governanceFlags.previewOnly === true", async () => {
    expect((await flags())["previewOnly"]).toBe(true);
  });

  it("T83.20 governanceFlags.paperOnly === true", async () => {
    expect((await flags())["paperOnly"]).toBe(true);
  });

  it("T83.21 governanceFlags.noExecution === true", async () => {
    expect((await flags())["noExecution"]).toBe(true);
  });

  it("T83.22 governanceFlags.noActualMetrics === true", async () => {
    expect((await flags())["noActualMetrics"]).toBe(true);
  });

  it("T83.23 governanceFlags.entersAlphaScore === false", async () => {
    expect((await flags())["entersAlphaScore"]).toBe(false);
  });

  it("T83.24 governanceFlags.notInvestmentAdvice === true", async () => {
    expect((await flags())["notInvestmentAdvice"]).toBe(true);
  });
});

// ─── T83.25–T83.34: Forbidden fields in top-level response ───────────────────

describe("T83.25–T83.34 | Forbidden fields absent from top-level response", () => {
  it("T83.25 no 'score' key at top level", async () => {
    const data = await callGETJson();
    expect(Object.keys(data)).not.toContain("score");
  });

  it("T83.26 no 'verdict' key at top level", async () => {
    const data = await callGETJson();
    expect(Object.keys(data)).not.toContain("verdict");
  });

  it("T83.27 no 'recommendation' key at top level", async () => {
    const data = await callGETJson();
    expect(Object.keys(data)).not.toContain("recommendation");
  });

  it("T83.28 no 'forecast' key at top level", async () => {
    const data = await callGETJson();
    expect(Object.keys(data)).not.toContain("forecast");
  });

  it("T83.29 no 'targetPrice' key at top level", async () => {
    const data = await callGETJson();
    expect(Object.keys(data)).not.toContain("targetPrice");
  });

  it("T83.30 no 'action' key at top level", async () => {
    const data = await callGETJson();
    expect(Object.keys(data)).not.toContain("action");
  });

  it("T83.31 no 'buy' key at top level", async () => {
    const data = await callGETJson();
    expect(Object.keys(data)).not.toContain("buy");
  });

  it("T83.32 no 'sell' key at top level", async () => {
    const data = await callGETJson();
    expect(Object.keys(data)).not.toContain("sell");
  });

  it("T83.33 no 'hold' key at top level", async () => {
    const data = await callGETJson();
    expect(Object.keys(data)).not.toContain("hold");
  });

  it("T83.34 no 'alphaScore' key at top level", async () => {
    const data = await callGETJson();
    expect(Object.keys(data)).not.toContain("alphaScore");
  });
});

// ─── T83.35–T83.38: Determinism ──────────────────────────────────────────────

describe("T83.35–T83.38 | Determinism", () => {
  it("T83.35 response status is identical across two calls", async () => {
    const [r1, r2] = await Promise.all([callGET(), callGET()]);
    expect(r1.status).toBe(r2.status);
  });

  it("T83.36 generatedAt is the fixed seed timestamp", async () => {
    const data = await callGETJson();
    expect(data["generatedAt"]).toBe("2026-05-26T00:00:00.000Z");
  });

  it("T83.37 response JSON is identical across two calls", async () => {
    const [d1, d2] = await Promise.all([callGETJson(), callGETJson()]);
    expect(JSON.stringify(d1)).toBe(JSON.stringify(d2));
  });

  it("T83.38 status field value is identical across two calls", async () => {
    const [d1, d2] = await Promise.all([callGETJson(), callGETJson()]);
    expect(d1["status"]).toBe(d2["status"]);
  });
});

// ─── T83.39–T83.42: Error path — source scan ─────────────────────────────────

describe("T83.39–T83.42 | Error path — catch block governance", () => {
  it("T83.39 source contains try block wrapping the chain", () => {
    expect(ROUTE_SOURCE).toContain("try {");
  });

  it("T83.40 source contains catch block", () => {
    expect(ROUTE_SOURCE).toMatch(/\} catch/);
  });

  it("T83.41 catch block returns neutral error JSON with 'Internal error'", () => {
    expect(ROUTE_SOURCE).toContain('"Internal error"');
  });

  it("T83.42 catch block returns status 500", () => {
    expect(ROUTE_SOURCE).toContain("status: 500");
  });
});

// ─── T83.43–T83.46: Response field values ────────────────────────────────────

describe("T83.43–T83.46 | Response field values", () => {
  it("T83.43 status is exactly 'ok'", async () => {
    const data = await callGETJson();
    expect(data["status"]).toBe("ok");
  });

  it("T83.44 version contains 'p81'", async () => {
    const data = await callGETJson();
    expect(typeof data["version"]).toBe("string");
    expect((data["version"] as string).toLowerCase()).toContain("p81");
  });

  it("T83.45 mimeType is 'text/markdown; charset=utf-8'", async () => {
    const data = await callGETJson();
    expect(data["mimeType"]).toBe("text/markdown; charset=utf-8");
  });

  it("T83.46 fileName contains 'stock-research'", async () => {
    const data = await callGETJson();
    expect(typeof data["fileName"]).toBe("string");
    expect((data["fileName"] as string).toLowerCase()).toContain("stock-research");
  });
});

// ─── T83.47–T83.54: Source text — no forbidden dependencies ──────────────────

describe("T83.47–T83.54 | Source text — no forbidden runtime dependencies", () => {
  it("T83.47 source has no runtime prisma import", () => {
    expect(ROUTE_SOURCE).not.toMatch(/import\s+.*[Pp]risma/);
    expect(ROUTE_SOURCE).not.toMatch(/require\(['"]@prisma/);
  });

  it("T83.48 source does not import pg or raw SQL", () => {
    expect(ROUTE_SOURCE).not.toContain("from 'pg'");
    expect(ROUTE_SOURCE).not.toContain('from "pg"');
  });

  it("T83.49 source does not import fs", () => {
    expect(ROUTE_SOURCE).not.toMatch(/import\s+.*\bfs\b/);
    expect(ROUTE_SOURCE).not.toContain("require('fs')");
  });

  it("T83.50 source does not import stream", () => {
    expect(ROUTE_SOURCE).not.toContain("require('stream')");
    expect(ROUTE_SOURCE).not.toContain('from "stream"');
  });

  it("T83.51 source does not import child_process", () => {
    expect(ROUTE_SOURCE).not.toContain("child_process");
  });

  it("T83.52 source does not call fetch(", () => {
    expect(ROUTE_SOURCE).not.toContain("fetch(");
  });

  it("T83.53 source does not import axios", () => {
    expect(ROUTE_SOURCE).not.toContain("axios");
  });

  it("T83.54 source does not reference external network (http.request / got / node-fetch)", () => {
    expect(ROUTE_SOURCE).not.toContain("http.request");
    expect(ROUTE_SOURCE).not.toContain("node-fetch");
    expect(ROUTE_SOURCE).not.toContain("from 'got'");
  });
});

// ─── T83.55–T83.60: Source text — no forbidden financial terms ───────────────

describe("T83.55–T83.60 | Source text — no forbidden financial terms", () => {
  it("T83.55 source has no alphaScore runtime assignment", () => {
    expect(ROUTE_SOURCE).not.toMatch(/[=:(,\s]alphaScore\s*[:=(]/);
  });

  it("T83.56 source has no targetPrice runtime assignment", () => {
    expect(ROUTE_SOURCE).not.toMatch(/[=:(,\s]targetPrice\s*[:=(]/);
  });

  it("T83.57 source does not contain 'scoreSignal'", () => {
    expect(ROUTE_SOURCE).not.toContain("scoreSignal");
  });

  it("T83.58 source does not contain 'winRate'", () => {
    expect(ROUTE_SOURCE).not.toContain("winRate");
  });

  it("T83.59 source does not contain 'backtest'", () => {
    expect(ROUTE_SOURCE.toLowerCase()).not.toContain("backtest");
  });

  it("T83.60 source does not contain 'optimizer'", () => {
    expect(ROUTE_SOURCE.toLowerCase()).not.toContain("optimizer");
  });
});

// ─── T83.61–T83.66: Source text — no forbidden exports ───────────────────────

describe("T83.61–T83.66 | Source text — no forbidden exports", () => {
  it("T83.61 source does not export POST", () => {
    expect(ROUTE_SOURCE).not.toMatch(/export\s+(async\s+)?function\s+POST\b/);
  });

  it("T83.62 source does not export PUT", () => {
    expect(ROUTE_SOURCE).not.toMatch(/export\s+(async\s+)?function\s+PUT\b/);
  });

  it("T83.63 source does not export DELETE", () => {
    expect(ROUTE_SOURCE).not.toMatch(/export\s+(async\s+)?function\s+DELETE\b/);
  });

  it("T83.64 source does not contain 'use server' directive", () => {
    expect(ROUTE_SOURCE).not.toContain("use server");
  });

  it("T83.65 source does not contain 'use client' directive", () => {
    expect(ROUTE_SOURCE).not.toContain("use client");
  });

  it("T83.66 source exports GET function", () => {
    expect(ROUTE_SOURCE).toMatch(/export\s+async\s+function\s+GET\b/);
  });
});

// ─── T83.67–T83.70: Full regression checks ───────────────────────────────────

describe("T83.67–T83.70 | Full regression", () => {
  it("T83.67 metadata.artifactTitle is a non-empty string", async () => {
    const data = await callGETJson();
    const metadata = data["metadata"] as Record<string, unknown>;
    expect(typeof metadata["artifactTitle"]).toBe("string");
    expect((metadata["artifactTitle"] as string).length).toBeGreaterThan(0);
  });

  it("T83.68 governanceFlags object has exactly 10 keys", async () => {
    const data = await callGETJson();
    const flags = data["governanceFlags"] as Record<string, unknown>;
    expect(Object.keys(flags)).toHaveLength(10);
  });

  it("T83.69 response is JSON-serializable without loss", async () => {
    const data = await callGETJson();
    const serialized = JSON.stringify(data);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    expect(parsed["status"]).toBe(data["status"]);
    expect(parsed["version"]).toBe(data["version"]);
  });

  it("T83.70 metadata card counts are positive integers", async () => {
    const data = await callGETJson();
    const metadata = data["metadata"] as Record<string, unknown>;
    expect(typeof metadata["researchCardCount"]).toBe("number");
    expect((metadata["researchCardCount"] as number)).toBeGreaterThan(0);
    expect(typeof metadata["simulationAuditCardCount"]).toBe("number");
    expect((metadata["simulationAuditCardCount"] as number)).toBeGreaterThan(0);
  });
});
