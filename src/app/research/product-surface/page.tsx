/**
 * P86 — Stock Research Product Surface Page (Visual Polish)
 *
 * Styling-only update to P85 bare HTML page.
 * Applies Tailwind CSS visual hierarchy; zero logic changes.
 *
 * Read-only frontend page. Fetches GET /api/research/product-surface (P83 route).
 * Displays sample contentBody, metadata, route info, all 10 governance flags,
 * and mandatory sample-only disclaimer.
 *
 * Governance:
 *   - reviewOnly = true
 *   - noInvestmentAdvice = true
 *   - noForecast = true
 *   - noRecommendation = true
 *   - previewOnly = true
 *   - paperOnly = true
 *   - noExecution = true
 *   - noActualMetrics = true
 *   - entersAlphaScore = false (ALWAYS)
 *   - notInvestmentAdvice = true
 *
 * Rules:
 *   - No ticker input, date picker, simulation trigger, or action UI
 *   - No DB, Prisma, source adapter, external API, auth/session, or server action
 *   - Server Component — no "use client", no useState, no useEffect
 *   - contentBody rendered as <pre> (safe, no HTML injection)
 *
 * Authorization: P86-GATE 2026-05-27
 * Token: P86_GATE_VISUAL_POLISH_APPROVED_WITH_STRICT_SCOPE
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import { StrategyResearchStaticView } from "../../../lib/research/components/StrategyResearchStaticView";
import { STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE } from "../../../lib/research/fixtures/StockStrategyResearchStaticFixture";

export default function ProductSurfacePage() {
  return <StrategyResearchStaticView fixture={STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE} />;
}
