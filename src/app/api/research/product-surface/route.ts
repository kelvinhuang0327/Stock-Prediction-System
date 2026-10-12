/**
 * P83 — GET /api/research/product-surface
 *
 * First HTTP-visible stock research product surface route.
 * Returns the P81 read-only API contract response as JSON (status 200).
 *
 * Chain (all in-memory, fixed seed, no external I/O):
 *   P77 fixture → P78 static sample artifact → P80 export metadata → P81 read-only API contract
 *
 * Seed:
 *   A fixed, frozen P76-shaped sample report object is constructed inline.
 *   fixedGeneratedAt is applied at every builder step for determinism.
 *
 * Error handling:
 *   Any thrown error → NextResponse.json({ error: "Internal error" }, { status: 500 })
 *   No stack trace. No error detail. No re-throw.
 *
 * Governance:
 *   - Read-only: GET only. No POST, PUT, DELETE.
 *   - In-memory only: no DB, no network, no filesystem.
 *   - Sample data only: fixed seed, fixed timestamp, deterministic.
 *   - No forecast, no recommendation, no scoring, no simulation.
 *   - No buy/sell/hold. No external data. No financial advice.
 *   - All 10 governance flags from P81 are preserved in the response.
 *
 * Authorization:
 *   P83-GATE 2026-05-26
 *   Token: P83_GATE_ACTUAL_API_ROUTE_APPROVED_WITH_STRICT_SCOPE
 *   Upstream baseline: P81 — StockResearchProductSurfaceReadOnlyApiContract (ac54a43)
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import { NextResponse } from "next/server";

import {
  STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_VERSION,
} from "@/lib/research/composition/StockResearchProductSurfaceSampleReportContract";
import type {
  StockResearchProductSurfaceSampleReportResponse,
} from "@/lib/research/composition/StockResearchProductSurfaceSampleReportContract";

import {
  buildStockResearchProductSurfaceSampleReportFixture,
} from "@/lib/research/composition/StockResearchProductSurfaceSampleReportFixture";

import {
  buildStockResearchProductSurfaceStaticSampleArtifact,
} from "@/lib/research/composition/StockResearchProductSurfaceStaticSampleArtifact";

import {
  buildStockResearchProductSurfaceReportExportMetadata,
} from "@/lib/research/export/StockResearchProductSurfaceReportExportMetadata";

import {
  buildStockResearchProductSurfaceReadOnlyApiContract,
} from "@/lib/research/api/StockResearchProductSurfaceReadOnlyApiContract";

// ─── Fixed Seed Timestamp ─────────────────────────────────────────────────────

const FIXED_GENERATED_AT = "2026-05-26T00:00:00.000Z";

// ─── Fixed Seed Sample Report (P76-shaped) ────────────────────────────────────

const SEED_SAMPLE_REPORT: StockResearchProductSurfaceSampleReportResponse =
  Object.freeze({
    reportVersion: STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_VERSION,
    generatedAt: FIXED_GENERATED_AT,
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
    reportTitle: "Stock Research Product Surface Sample Report",
    disclaimerBlock: Object.freeze({
      disclaimerLabel: "Disclaimer",
      lines: Object.freeze([
        "This report is review-only and not investment advice.",
        "No forecast is implied or generated.",
        "No trading execution is authorized or implied.",
      ]),
    }),
    researchReviewBlock: Object.freeze({
      blockLabel: "Research Review",
      cards: Object.freeze([
        Object.freeze({
          sourceName: "sample-source-a",
          label: "Sample Source A",
          status: "ok",
          note: "Axis A review note",
        }),
        Object.freeze({
          sourceName: "sample-source-b",
          label: "Sample Source B",
          status: "ok",
        }),
      ]),
      cardCount: 2,
    }),
    simulationInputAuditBlock: Object.freeze({
      blockLabel: "Simulation Input Audit",
      cards: Object.freeze([
        Object.freeze({
          sourceName: "sample-source-c",
          label: "Sample Source C",
          status: "ok",
          note: "Axis B audit note",
        }),
        Object.freeze({
          sourceName: "sample-source-d",
          label: "Sample Source D",
          status: "ok",
        }),
      ]),
      cardCount: 2,
    }),
    summaryBlock: Object.freeze({
      researchCardCount: 2,
      simulationAuditCardCount: 2,
    }),
  } satisfies StockResearchProductSurfaceSampleReportResponse);

// ─── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const fixtureResponse = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: SEED_SAMPLE_REPORT,
      fixedGeneratedAt: FIXED_GENERATED_AT,
    });

    const artifactResponse = buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse,
      fixedGeneratedAt: FIXED_GENERATED_AT,
    });

    const envelope = buildStockResearchProductSurfaceReportExportMetadata({
      artifactResponse,
      fixedGeneratedAt: FIXED_GENERATED_AT,
    });

    const apiResponse = buildStockResearchProductSurfaceReadOnlyApiContract({
      envelope,
      fixedGeneratedAt: FIXED_GENERATED_AT,
    });

    return NextResponse.json(apiResponse, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
