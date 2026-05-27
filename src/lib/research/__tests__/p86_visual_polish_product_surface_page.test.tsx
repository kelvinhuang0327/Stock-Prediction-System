/**
 * @jest-environment node
 */
/**
 * P86 — Visual Polish Product Surface Page Test Suite
 * Tests for: /research/product-surface (Tailwind-styled Next.js page)
 *
 * T86.1  – T86.66 (66 tests)
 *
 * Authorization token: P86_GATE_VISUAL_POLISH_APPROVED_WITH_STRICT_SCOPE
 * Upstream baseline: P85 — Frontend Product Surface Page (7f0a73e)
 *
 * All P86 tests are Axis B — source-scan only (no rendering).
 * Verifies: Tailwind classNames present, fetch path unchanged, disclaimer
 * verbatim, all 10 governance flags retained, forbidden UI absent.
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

// ─── T86.1–T86.5 | File existence and module exports ─────────────────────────

describe("T86.1–T86.5 | File existence and module exports", () => {
  it("T86.1 page file exists at expected path", () => {
    expect(fs.existsSync(PAGE_SOURCE_PATH)).toBe(true);
  });

  it("T86.2 page source is not empty", () => {
    expect(PAGE_SOURCE.length).toBeGreaterThan(0);
  });

  it("T86.3 page source contains 'export default'", () => {
    expect(PAGE_SOURCE).toContain("export default");
  });

  it("T86.4 page source contains 'function ProductSurfacePage'", () => {
    expect(PAGE_SOURCE).toContain("function ProductSurfacePage");
  });

  it("T86.5 page source is non-trivial and styled (length > 1500 characters)", () => {
    expect(PAGE_SOURCE.length).toBeGreaterThan(1500);
  });
});

// ─── T86.6–T86.12 | Page container and layout classNames ─────────────────────

describe("T86.6–T86.12 | Page container and layout classNames present", () => {
  it("T86.6 source contains page background class 'bg-gray-50'", () => {
    expect(PAGE_SOURCE).toContain("bg-gray-50");
  });

  it("T86.7 source contains centered container class 'max-w-3xl'", () => {
    expect(PAGE_SOURCE).toContain("max-w-3xl");
  });

  it("T86.8 source contains 'mx-auto' for horizontal centering", () => {
    expect(PAGE_SOURCE).toContain("mx-auto");
  });

  it("T86.9 source contains vertical spacing class 'space-y-6'", () => {
    expect(PAGE_SOURCE).toContain("space-y-6");
  });

  it("T86.10 source contains full-height class 'min-h-screen'", () => {
    expect(PAGE_SOURCE).toContain("min-h-screen");
  });

  it("T86.11 source contains vertical padding class 'py-8'", () => {
    expect(PAGE_SOURCE).toContain("py-8");
  });

  it("T86.12 source contains horizontal padding class 'px-4'", () => {
    expect(PAGE_SOURCE).toContain("px-4");
  });
});

// ─── T86.13–T86.17 | Card structural classNames ──────────────────────────────

describe("T86.13–T86.17 | Card structural classNames present", () => {
  it("T86.13 source contains card shape class 'rounded-lg'", () => {
    expect(PAGE_SOURCE).toContain("rounded-lg");
  });

  it("T86.14 source contains card elevation class 'shadow-sm'", () => {
    expect(PAGE_SOURCE).toContain("shadow-sm");
  });

  it("T86.15 source contains card background class 'bg-white'", () => {
    expect(PAGE_SOURCE).toContain("bg-white");
  });

  it("T86.16 source contains card border class 'border-gray-200'", () => {
    expect(PAGE_SOURCE).toContain("border-gray-200");
  });

  it("T86.17 source contains card horizontal padding 'px-6'", () => {
    expect(PAGE_SOURCE).toContain("px-6");
  });
});

// ─── T86.18–T86.22 | Heading hierarchy classNames ────────────────────────────

describe("T86.18–T86.22 | Heading hierarchy classNames present", () => {
  it("T86.18 source contains h1 size class 'text-2xl'", () => {
    expect(PAGE_SOURCE).toContain("text-2xl");
  });

  it("T86.19 source contains h1 weight class 'font-bold'", () => {
    expect(PAGE_SOURCE).toContain("font-bold");
  });

  it("T86.20 source contains h2 size class 'text-lg'", () => {
    expect(PAGE_SOURCE).toContain("text-lg");
  });

  it("T86.21 source contains h2 weight class 'font-semibold'", () => {
    expect(PAGE_SOURCE).toContain("font-semibold");
  });

  it("T86.22 source contains heading color class 'text-gray-900'", () => {
    expect(PAGE_SOURCE).toContain("text-gray-900");
  });
});

// ─── T86.23–T86.26 | Disclaimer prominence classNames ────────────────────────

describe("T86.23–T86.26 | Disclaimer prominence classNames present", () => {
  it("T86.23 source contains disclaimer left-border class 'border-l-4'", () => {
    expect(PAGE_SOURCE).toContain("border-l-4");
  });

  it("T86.24 source contains disclaimer border color 'border-yellow-400'", () => {
    expect(PAGE_SOURCE).toContain("border-yellow-400");
  });

  it("T86.25 source contains disclaimer background class 'bg-yellow-50'", () => {
    expect(PAGE_SOURCE).toContain("bg-yellow-50");
  });

  it("T86.26 source contains disclaimer text color 'text-yellow-800'", () => {
    expect(PAGE_SOURCE).toContain("text-yellow-800");
  });
});

// ─── T86.27–T86.31 | Governance flag badge classNames ────────────────────────

describe("T86.27–T86.31 | Governance flag badge classNames present", () => {
  it("T86.27 source contains true-flag badge background 'bg-green-50'", () => {
    expect(PAGE_SOURCE).toContain("bg-green-50");
  });

  it("T86.28 source contains true-flag badge text 'text-green-700'", () => {
    expect(PAGE_SOURCE).toContain("text-green-700");
  });

  it("T86.29 source contains badge ring class 'ring-1'", () => {
    expect(PAGE_SOURCE).toContain("ring-1");
  });

  it("T86.30 source contains badge ring modifier 'ring-inset'", () => {
    expect(PAGE_SOURCE).toContain("ring-inset");
  });

  it("T86.31 source contains false-flag badge background 'bg-red-50'", () => {
    expect(PAGE_SOURCE).toContain("bg-red-50");
  });
});

// ─── T86.32–T86.35 | Metadata card layout classNames ─────────────────────────

describe("T86.32–T86.35 | Metadata card layout classNames present", () => {
  it("T86.32 source contains grid layout class 'grid-cols-2'", () => {
    expect(PAGE_SOURCE).toContain("grid-cols-2");
  });

  it("T86.33 source contains horizontal gap class 'gap-x-6'", () => {
    expect(PAGE_SOURCE).toContain("gap-x-6");
  });

  it("T86.34 source contains vertical gap class 'gap-y-3'", () => {
    expect(PAGE_SOURCE).toContain("gap-y-3");
  });

  it("T86.35 source contains label weight class 'font-medium'", () => {
    expect(PAGE_SOURCE).toContain("font-medium");
  });
});

// ─── T86.36–T86.39 | Pre-block and code display classNames ───────────────────

describe("T86.36–T86.39 | Pre-block and code display classNames present", () => {
  it("T86.36 source contains pre-block horizontal scroll 'overflow-x-auto'", () => {
    expect(PAGE_SOURCE).toContain("overflow-x-auto");
  });

  it("T86.37 source contains pre-block height limit 'max-h-64'", () => {
    expect(PAGE_SOURCE).toContain("max-h-64");
  });

  it("T86.38 source contains pre-block monospace class 'font-mono'", () => {
    expect(PAGE_SOURCE).toContain("font-mono");
  });

  it("T86.39 source contains pre-block shape class 'rounded-md'", () => {
    expect(PAGE_SOURCE).toContain("rounded-md");
  });
});

// ─── T86.40–T86.45 | Fetch path and cache — unchanged from P85 ───────────────

describe("T86.40–T86.45 | Fetch path and cache — unchanged from P85", () => {
  it("T86.40 source contains fetch target path '/api/research/product-surface'", () => {
    expect(PAGE_SOURCE).toContain("/api/research/product-surface");
  });

  it("T86.41 source contains 'fetch(' call", () => {
    expect(PAGE_SOURCE).toContain("fetch(");
  });

  it("T86.42 source contains 'no-store' cache directive", () => {
    expect(PAGE_SOURCE).toContain("no-store");
  });

  it("T86.43 source contains 'NEXT_PUBLIC_BASE_URL' environment variable", () => {
    expect(PAGE_SOURCE).toContain("NEXT_PUBLIC_BASE_URL");
  });

  it("T86.44 source contains 'process.env' for base URL resolution", () => {
    expect(PAGE_SOURCE).toContain("process.env");
  });

  it("T86.45 source contains 'loadError' fetch error handling variable", () => {
    expect(PAGE_SOURCE).toContain("loadError");
  });
});

// ─── T86.46–T86.49 | Disclaimer text verbatim — unchanged from P85 ───────────

describe("T86.46–T86.49 | Disclaimer text verbatim — unchanged from P85", () => {
  it("T86.46 source contains disclaimer part 1: 'Research scaffold sample only'", () => {
    expect(PAGE_SOURCE).toContain("Research scaffold sample only");
  });

  it("T86.47 source contains disclaimer part 2: 'Not investment advice'", () => {
    expect(PAGE_SOURCE).toContain("Not investment advice");
  });

  it("T86.48 source contains exact error message 'Unable to load research surface.'", () => {
    expect(PAGE_SOURCE).toContain("Unable to load research surface.");
  });

  it("T86.49 source does not reference error.message (error state hardened)", () => {
    expect(PAGE_SOURCE).not.toContain("error.message");
  });
});

// ─── T86.50–T86.59 | All 10 governance flags retained ────────────────────────

describe("T86.50–T86.59 | All 10 governance flags retained in source", () => {
  it("T86.50 source retains governance flag: reviewOnly", () => {
    expect(PAGE_SOURCE).toContain("reviewOnly");
  });

  it("T86.51 source retains governance flag: noInvestmentAdvice", () => {
    expect(PAGE_SOURCE).toContain("noInvestmentAdvice");
  });

  it("T86.52 source retains governance flag: noForecast", () => {
    expect(PAGE_SOURCE).toContain("noForecast");
  });

  it("T86.53 source retains governance flag: noRecommendation", () => {
    expect(PAGE_SOURCE).toContain("noRecommendation");
  });

  it("T86.54 source retains governance flag: previewOnly", () => {
    expect(PAGE_SOURCE).toContain("previewOnly");
  });

  it("T86.55 source retains governance flag: paperOnly", () => {
    expect(PAGE_SOURCE).toContain("paperOnly");
  });

  it("T86.56 source retains governance flag: noExecution", () => {
    expect(PAGE_SOURCE).toContain("noExecution");
  });

  it("T86.57 source retains governance flag: noActualMetrics", () => {
    expect(PAGE_SOURCE).toContain("noActualMetrics");
  });

  it("T86.58 source retains governance flag: entersAlphaScore", () => {
    expect(PAGE_SOURCE).toContain("entersAlphaScore");
  });

  it("T86.59 source retains governance flag: notInvestmentAdvice", () => {
    expect(PAGE_SOURCE).toContain("notInvestmentAdvice");
  });
});

// ─── T86.60–T86.62 | Forbidden UI elements absent ────────────────────────────

describe("T86.60–T86.62 | Forbidden UI elements absent from source", () => {
  it("T86.60 source does not contain <input element", () => {
    expect(PAGE_SOURCE).not.toMatch(/<input/);
  });

  it("T86.61 source does not contain <button element", () => {
    expect(PAGE_SOURCE).not.toMatch(/<button/);
  });

  it("T86.62 source does not contain <form element", () => {
    expect(PAGE_SOURCE).not.toMatch(/<form/);
  });
});

// ─── T86.63–T86.66 | Regression — upstream files unchanged ───────────────────

describe("T86.63–T86.66 | Regression — upstream files unchanged", () => {
  it("T86.63 P83 test file exists at expected path", () => {
    expect(fs.existsSync(P83_TEST_PATH)).toBe(true);
  });

  it("T86.64 P83 route source exists at expected path", () => {
    expect(fs.existsSync(P83_ROUTE_PATH)).toBe(true);
  });

  it("T86.65 P83 route source contains FIXED_GENERATED_AT (P83 structure unchanged)", () => {
    expect(P83_ROUTE_SOURCE).toContain("FIXED_GENERATED_AT");
  });

  it("T86.66 P81 contract source exists at expected path", () => {
    expect(fs.existsSync(P81_CONTRACT_PATH)).toBe(true);
  });
});
