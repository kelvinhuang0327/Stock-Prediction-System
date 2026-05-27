/**
 * @jest-environment node
 */
/**
 * P85 — Frontend Product Surface Page Test Suite
 * Tests for: /research/product-surface (Next.js page)
 *
 * T85.1  – T85.66 (66 tests)
 *
 * Authorization token: P85_GATE_FRONTEND_PRODUCT_SURFACE_PAGE_APPROVED_WITH_STRICT_SCOPE
 * Upstream baseline: P83 — Actual API Route (264e2eb)
 *
 * Axis B (source-scaffold / text-scan tests): T85.1–T85.66 (66 tests)
 * (All P85 tests are Axis B — no real rendering, source-scan only)
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import fs from "fs";
import path from "path";

// ─── Source text ──────────────────────────────────────────────────────────────

const PAGE_SOURCE_PATH = path.resolve(
  __dirname,
  "../../../app/research/product-surface/page.tsx",
);

const PAGE_SOURCE = fs.readFileSync(PAGE_SOURCE_PATH, "utf-8");

// ─── Source without comments (for financial-term checks) ─────────────────────

const SOURCE_NO_COMMENTS = PAGE_SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");

// ─── Regression paths ─────────────────────────────────────────────────────────

const P83_TEST_PATH = path.resolve(__dirname, "./p83_actual_api_route.test.ts");
const P83_ROUTE_PATH = path.resolve(
  __dirname,
  "../../../app/api/research/product-surface/route.ts",
);
const P81_CONTRACT_PATH = path.resolve(
  __dirname,
  "../api/StockResearchProductSurfaceReadOnlyApiContract.ts",
);
const P83_ROUTE_SOURCE = fs.readFileSync(P83_ROUTE_PATH, "utf-8");

// ─── T85.1–T85.5 | File existence and module exports ─────────────────────────

describe("T85.1–T85.5 | File existence and module exports", () => {
  it("T85.1 page file exists at expected path", () => {
    expect(fs.existsSync(PAGE_SOURCE_PATH)).toBe(true);
  });

  it("T85.2 page source is not empty", () => {
    expect(PAGE_SOURCE.length).toBeGreaterThan(0);
  });

  it("T85.3 page source contains 'export default'", () => {
    expect(PAGE_SOURCE).toContain("export default");
  });

  it("T85.4 page source contains 'function ProductSurfacePage'", () => {
    expect(PAGE_SOURCE).toContain("function ProductSurfacePage");
  });

  it("T85.5 page source is non-trivial (length > 1000 characters)", () => {
    expect(PAGE_SOURCE.length).toBeGreaterThan(1000);
  });
});

// ─── T85.6–T85.12 | Source structure — required content strings ───────────────

describe("T85.6–T85.12 | Source structure — required content strings", () => {
  it("T85.6 source contains page title string", () => {
    expect(PAGE_SOURCE).toContain("Stock Research Product Surface");
  });

  it("T85.7 source contains disclaimer part 1: 'Research scaffold sample only'", () => {
    expect(PAGE_SOURCE).toContain("Research scaffold sample only");
  });

  it("T85.8 source contains disclaimer part 2: 'Not investment advice'", () => {
    expect(PAGE_SOURCE).toContain("Not investment advice");
  });

  it("T85.9 source contains contentBody field reference", () => {
    expect(PAGE_SOURCE).toContain("contentBody");
  });

  it("T85.10 source contains artifactTitle field reference", () => {
    expect(PAGE_SOURCE).toContain("artifactTitle");
  });

  it("T85.11 source contains artifactVersion field reference", () => {
    expect(PAGE_SOURCE).toContain("artifactVersion");
  });

  it("T85.12 source contains simulationAuditCardCount field reference", () => {
    expect(PAGE_SOURCE).toContain("simulationAuditCardCount");
  });
});

// ─── T85.13–T85.22 | Governance flags — all 10 flag names present ─────────────

describe("T85.13–T85.22 | Governance flags — all 10 flag names present in source", () => {
  it("T85.13 source contains governance flag: reviewOnly", () => {
    expect(PAGE_SOURCE).toContain("reviewOnly");
  });

  it("T85.14 source contains governance flag: noInvestmentAdvice", () => {
    expect(PAGE_SOURCE).toContain("noInvestmentAdvice");
  });

  it("T85.15 source contains governance flag: noForecast", () => {
    expect(PAGE_SOURCE).toContain("noForecast");
  });

  it("T85.16 source contains governance flag: noRecommendation", () => {
    expect(PAGE_SOURCE).toContain("noRecommendation");
  });

  it("T85.17 source contains governance flag: previewOnly", () => {
    expect(PAGE_SOURCE).toContain("previewOnly");
  });

  it("T85.18 source contains governance flag: paperOnly", () => {
    expect(PAGE_SOURCE).toContain("paperOnly");
  });

  it("T85.19 source contains governance flag: noExecution", () => {
    expect(PAGE_SOURCE).toContain("noExecution");
  });

  it("T85.20 source contains governance flag: noActualMetrics", () => {
    expect(PAGE_SOURCE).toContain("noActualMetrics");
  });

  it("T85.21 source contains governance flag: entersAlphaScore", () => {
    expect(PAGE_SOURCE).toContain("entersAlphaScore");
  });

  it("T85.22 source contains governance flag: notInvestmentAdvice", () => {
    expect(PAGE_SOURCE).toContain("notInvestmentAdvice");
  });
});

// ─── T85.23–T85.30 | Forbidden UI elements absent ────────────────────────────

describe("T85.23–T85.30 | Forbidden UI elements absent from source", () => {
  it("T85.23 source does not contain <input element", () => {
    expect(PAGE_SOURCE).not.toMatch(/<input/);
  });

  it("T85.24 source does not contain <select element", () => {
    expect(PAGE_SOURCE).not.toMatch(/<select/);
  });

  it("T85.25 source does not contain <textarea element", () => {
    expect(PAGE_SOURCE).not.toMatch(/<textarea/);
  });

  it("T85.26 source does not contain <button element", () => {
    expect(PAGE_SOURCE).not.toMatch(/<button/);
  });

  it("T85.27 source does not contain download attribute", () => {
    expect(PAGE_SOURCE).not.toMatch(/\bdownload\b/);
  });

  it("T85.28 source does not contain <form element", () => {
    expect(PAGE_SOURCE).not.toMatch(/<form/);
  });

  it("T85.29 source does not contain SearchBar or DatePicker component", () => {
    expect(PAGE_SOURCE).not.toMatch(/[Ss]earch[Bb]ar|[Dd]ate[Pp]icker/);
  });

  it("T85.30 source does not contain simulation trigger patterns", () => {
    expect(PAGE_SOURCE).not.toMatch(/runSimulation|triggerSimulation|simulationTrigger/);
  });
});

// ─── T85.31–T85.40 | Forbidden financial terms absent ────────────────────────

describe("T85.31–T85.40 | Forbidden financial terms absent (source without comments)", () => {
  it("T85.31 source (no comments) does not contain standalone 'buy'", () => {
    expect(SOURCE_NO_COMMENTS).not.toMatch(/\bbuy\b/i);
  });

  it("T85.32 source (no comments) does not contain standalone 'sell'", () => {
    expect(SOURCE_NO_COMMENTS).not.toMatch(/\bsell\b/i);
  });

  it("T85.33 source (no comments) does not contain standalone 'hold'", () => {
    expect(SOURCE_NO_COMMENTS).not.toMatch(/\bhold\b/i);
  });

  it("T85.34 source (no comments) does not contain standalone 'alphaScore'", () => {
    expect(SOURCE_NO_COMMENTS).not.toMatch(/\balphaScore\b/i);
  });

  it("T85.35 source (no comments) does not contain standalone 'targetPrice'", () => {
    expect(SOURCE_NO_COMMENTS).not.toMatch(/\btargetPrice\b/i);
  });

  it("T85.36 source (no comments) does not contain standalone 'recommendation'", () => {
    expect(SOURCE_NO_COMMENTS).not.toMatch(/\brecommendation\b/i);
  });

  it("T85.37 source (no comments) does not contain standalone 'forecast'", () => {
    expect(SOURCE_NO_COMMENTS).not.toMatch(/\bforecast\b/i);
  });

  it("T85.38 source (no comments) does not contain standalone 'score'", () => {
    expect(SOURCE_NO_COMMENTS).not.toMatch(/\bscore\b/i);
  });

  it("T85.39 source (no comments) does not contain standalone 'verdict'", () => {
    expect(SOURCE_NO_COMMENTS).not.toMatch(/\bverdict\b/i);
  });

  it("T85.40 source (no comments) does not contain standalone 'signal'", () => {
    expect(SOURCE_NO_COMMENTS).not.toMatch(/\bsignal\b/i);
  });
});

// ─── T85.41–T85.48 | Forbidden imports absent ────────────────────────────────

describe("T85.41–T85.48 | Forbidden imports absent from source", () => {
  it("T85.41 source does not import from prisma", () => {
    expect(PAGE_SOURCE).not.toMatch(/@prisma\/client|from ["']prisma["']/);
  });

  it("T85.42 source does not import from pg", () => {
    expect(PAGE_SOURCE).not.toMatch(/from ["']pg["']/);
  });

  it("T85.43 source does not import from mysql", () => {
    expect(PAGE_SOURCE).not.toMatch(/from ["']mysql["']|from ["']mysql2["']/);
  });

  it("T85.44 source does not import from sqlite", () => {
    expect(PAGE_SOURCE).not.toMatch(/from ["']sqlite["']|from ["']better-sqlite3["']/);
  });

  it("T85.45 source does not import from axios", () => {
    expect(PAGE_SOURCE).not.toMatch(/from ["']axios["']/);
  });

  it("T85.46 source does not import from child_process", () => {
    expect(PAGE_SOURCE).not.toMatch(/from ["']child_process["']/);
  });

  it("T85.47 source does not import fs at runtime", () => {
    expect(PAGE_SOURCE).not.toMatch(/import fs from|require\(["']fs["']\)/);
  });

  it("T85.48 source does not import from source adapter paths", () => {
    expect(PAGE_SOURCE).not.toMatch(/from ["'][^"']*adapters[^"']*["']/);
  });
});

// ─── T85.49–T85.54 | Fetch target path ───────────────────────────────────────

describe("T85.49–T85.54 | Fetch target path", () => {
  it("T85.49 source contains the fetch target path '/api/research/product-surface'", () => {
    expect(PAGE_SOURCE).toContain("/api/research/product-surface");
  });

  it("T85.50 source contains 'fetch' call", () => {
    expect(PAGE_SOURCE).toContain("fetch(");
  });

  it("T85.51 source contains 'no-store' cache directive", () => {
    expect(PAGE_SOURCE).toContain("no-store");
  });

  it("T85.52 source contains 'NEXT_PUBLIC_BASE_URL' environment variable", () => {
    expect(PAGE_SOURCE).toContain("NEXT_PUBLIC_BASE_URL");
  });

  it("T85.53 source contains 'process.env' for base URL resolution", () => {
    expect(PAGE_SOURCE).toContain("process.env");
  });

  it("T85.54 source contains 'loadError' fetch error handling variable", () => {
    expect(PAGE_SOURCE).toContain("loadError");
  });
});

// ─── T85.55–T85.58 | Error state ─────────────────────────────────────────────

describe("T85.55–T85.58 | Error state", () => {
  it("T85.55 source contains exact error text: 'Unable to load research surface.'", () => {
    expect(PAGE_SOURCE).toContain("Unable to load research surface.");
  });

  it("T85.56 source does not reference error.message", () => {
    expect(PAGE_SOURCE).not.toContain("error.message");
  });

  it("T85.57 source does not reference error.stack", () => {
    expect(PAGE_SOURCE).not.toContain("error.stack");
  });

  it("T85.58 source uses loadError flag for error state branching", () => {
    expect(PAGE_SOURCE).toContain("loadError");
  });
});

// ─── T85.59–T85.62 | Neutral language ────────────────────────────────────────

describe("T85.59–T85.62 | Neutral language (source without comments)", () => {
  it("T85.59 source (no comments) does not contain standalone 'live'", () => {
    expect(SOURCE_NO_COMMENTS).not.toMatch(/\blive\b/i);
  });

  it("T85.60 source does not contain 'real-time'", () => {
    expect(PAGE_SOURCE).not.toContain("real-time");
  });

  it("T85.61 source (no comments) does not contain standalone 'trading'", () => {
    expect(SOURCE_NO_COMMENTS).not.toMatch(/\btrading\b/i);
  });

  it("T85.62 source (no comments) does not contain standalone 'execution'", () => {
    expect(SOURCE_NO_COMMENTS).not.toMatch(/\bexecution\b/i);
  });
});

// ─── T85.63–T85.66 | Regression ──────────────────────────────────────────────

describe("T85.63–T85.66 | Regression — upstream files unchanged", () => {
  it("T85.63 P83 test file exists at expected path", () => {
    expect(fs.existsSync(P83_TEST_PATH)).toBe(true);
  });

  it("T85.64 P83 route source exists at expected path", () => {
    expect(fs.existsSync(P83_ROUTE_PATH)).toBe(true);
  });

  it("T85.65 P83 route source contains FIXED_GENERATED_AT (P83 structure unchanged)", () => {
    expect(P83_ROUTE_SOURCE).toContain("FIXED_GENERATED_AT");
  });

  it("T85.66 P81 contract source exists at expected path", () => {
    expect(fs.existsSync(P81_CONTRACT_PATH)).toBe(true);
  });
});
