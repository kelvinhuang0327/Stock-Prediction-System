/**
 * P66 — Axis A v1 Research Snapshot Review Artifact
 *
 * Consumes a caller-supplied P59-compatible ResearchSnapshotInput and
 * produces a JSON-safe, deterministic, frozen review artifact.
 *
 * Governance:
 *   reviewOnly = true
 *   noInvestmentAdvice = true
 *   noForecast = true
 *   noRecommendation = true
 *   entersAlphaScore = false
 *
 * Source coverage:
 *   Quote          → INCLUDED_ELIGIBLE          (PIT_SAFE gate)
 *   Regime         → INCLUDED_ELIGIBLE          (PIT_SAFE gate)
 *   MonthlyRevenue → INCLUDED_LOW_CONFIDENCE    (nullable releaseDate — LOW_CONFIDENCE_PIT_INFERRED)
 *   FinancialReport → excludedSources           (BLOCKED_PENDING_PIT_METADATA)
 *   Chip            → excludedSources           (BLOCKED_PENDING_AVAILABLE_AT_AND_PROD_LOGS)
 *   NewsEvent       → excludedSources           (AUDIT_ONLY — quality policy pending)
 *
 * Forbidden:
 *   - No DB / Prisma import
 *   - No fs / path / network / child_process import
 *   - No Axis B simulation module import
 *   - No recommendation / action / buy / sell / hold / targetPrice semantics
 *   - No ROI / PnL / winRate / benchmark / alphaScore / score / forecast
 *   - No run / execute / simulate / optimize / backtest exported function
 *
 * Classification: P66_AXIS_A_V1_RESEARCH_SNAPSHOT_REVIEW_ARTIFACT
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import type { ResearchSnapshotInput } from "@/lib/research/snapshot/v1/ResearchSnapshotInputBuilder";

// ─── Version ──────────────────────────────────────────────────────────────────

export const RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_VERSION =
  "p66-axis-a-research-snapshot-review-artifact-v0" as const;

// ─── Governance constants ─────────────────────────────────────────────────────

export const RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_GOVERNANCE = Object.freeze({
  reviewOnly: true,
  noInvestmentAdvice: true,
  noForecast: true,
  noRecommendation: true,
  entersAlphaScore: false,
} as const);

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResearchSnapshotReviewSourceSection = {
  readonly sourceName: "Quote" | "Regime" | "MonthlyRevenue";
  readonly reviewStatus: "INCLUDED_ELIGIBLE" | "INCLUDED_LOW_CONFIDENCE";
  readonly pitGateStatus: string;
  readonly includeInReview: true;
  readonly lowConfidenceWarning?: string;
};

export type ResearchSnapshotReviewExcludedSource = {
  readonly sourceName: "FinancialReport" | "Chip" | "NewsEvent";
  readonly exclusionReason: string;
};

export type ResearchSnapshotReviewSummary = {
  readonly totalReviewedSources: number;
  readonly includedEligibleCount: number;
  readonly includedLowConfidenceCount: number;
  readonly excludedCount: number;
};

export type ResearchSnapshotReviewArtifact = {
  readonly version: typeof RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_VERSION;
  readonly generatedAt: string;
  readonly reviewOnly: true;
  readonly noInvestmentAdvice: true;
  readonly noForecast: true;
  readonly noRecommendation: true;
  readonly entersAlphaScore: false;
  readonly sourceSections: readonly ResearchSnapshotReviewSourceSection[];
  readonly excludedSources: readonly ResearchSnapshotReviewExcludedSource[];
  readonly summary: ResearchSnapshotReviewSummary;
};

export type ResearchSnapshotReviewArtifactParams = {
  readonly snapshot: ResearchSnapshotInput;
  readonly fixedGeneratedAt?: string;
};

// ─── Internal constants ───────────────────────────────────────────────────────

const MONTHLY_REVENUE_LOW_CONFIDENCE_WARNING =
  "MonthlyRevenue uses LOW_CONFIDENCE_PIT_INFERRED gate: releaseDate is nullable. " +
  "This source is included in paper-mode review only and must not be used for " +
  "any form of forecast, investment decision, or performance measurement.";

const EXCLUDED_SOURCES: readonly ResearchSnapshotReviewExcludedSource[] =
  Object.freeze([
    Object.freeze({
      sourceName: "FinancialReport" as const,
      exclusionReason:
        "BLOCKED_PENDING_PIT_METADATA: no releaseDate column in v1 schema; " +
        "excluded from adapter scope until PIT metadata gate is authorized.",
    }),
    Object.freeze({
      sourceName: "Chip" as const,
      exclusionReason:
        "BLOCKED_PENDING_AVAILABLE_AT_AND_PROD_LOGS: institutional chip data " +
        "requires availableAt field and prod log validation; not authorized in v1.",
    }),
    Object.freeze({
      sourceName: "NewsEvent" as const,
      exclusionReason:
        "AUDIT_ONLY: news event quality policy pending CEO authorization; " +
        "excluded from review artifact until policy gate passes.",
    }),
  ]);

// ─── summarizeResearchSnapshotReviewSources ───────────────────────────────────

/**
 * Compute summary counts from a set of source sections and excluded sources.
 *
 * Can be called standalone for testing or after buildResearchSnapshotReviewArtifact.
 * Does not mutate either input array.
 */
export function summarizeResearchSnapshotReviewSources(
  sections: readonly ResearchSnapshotReviewSourceSection[],
  excludedSources?: readonly ResearchSnapshotReviewExcludedSource[],
): ResearchSnapshotReviewSummary {
  let includedEligibleCount = 0;
  let includedLowConfidenceCount = 0;

  for (const section of sections) {
    if (section.reviewStatus === "INCLUDED_ELIGIBLE") {
      includedEligibleCount += 1;
    } else if (section.reviewStatus === "INCLUDED_LOW_CONFIDENCE") {
      includedLowConfidenceCount += 1;
    }
  }

  return Object.freeze({
    totalReviewedSources: sections.length,
    includedEligibleCount,
    includedLowConfidenceCount,
    excludedCount: excludedSources?.length ?? 0,
  });
}

// ─── buildResearchSnapshotReviewArtifact ─────────────────────────────────────

/**
 * Build a frozen, JSON-safe, deterministic ResearchSnapshotReviewArtifact from
 * a caller-supplied ResearchSnapshotInput (P59-compatible).
 *
 * Does not query DB, call network, run simulation, or produce scoring output.
 * Does not call the P59 builder — accepts caller-supplied snapshot only.
 *
 * @param params.snapshot        - pre-assembled ResearchSnapshotInput from P59
 * @param params.fixedGeneratedAt - ISO-8601 override for deterministic testing
 */
export function buildResearchSnapshotReviewArtifact(
  params: ResearchSnapshotReviewArtifactParams,
): ResearchSnapshotReviewArtifact {
  const { snapshot, fixedGeneratedAt } = params;
  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();

  // Quote section — always INCLUDED_ELIGIBLE; pitGateStatus from snapshot fact
  const quoteSection: ResearchSnapshotReviewSourceSection = Object.freeze({
    sourceName: "Quote" as const,
    reviewStatus: "INCLUDED_ELIGIBLE" as const,
    pitGateStatus: snapshot.quote?.pitGateStatus ?? "NOT_AVAILABLE",
    includeInReview: true as const,
  });

  // Regime section — always INCLUDED_ELIGIBLE; pitGateStatus from snapshot fact
  const regimeSection: ResearchSnapshotReviewSourceSection = Object.freeze({
    sourceName: "Regime" as const,
    reviewStatus: "INCLUDED_ELIGIBLE" as const,
    pitGateStatus: snapshot.regime?.pitGateStatus ?? "NOT_AVAILABLE",
    includeInReview: true as const,
  });

  // MonthlyRevenue section — always INCLUDED_LOW_CONFIDENCE with warning
  const monthlyRevenueSection: ResearchSnapshotReviewSourceSection =
    Object.freeze({
      sourceName: "MonthlyRevenue" as const,
      reviewStatus: "INCLUDED_LOW_CONFIDENCE" as const,
      pitGateStatus:
        snapshot.monthlyRevenue?.pitGateStatus ?? "NOT_AVAILABLE",
      includeInReview: true as const,
      lowConfidenceWarning: MONTHLY_REVENUE_LOW_CONFIDENCE_WARNING,
    });

  const sourceSections = Object.freeze([
    quoteSection,
    regimeSection,
    monthlyRevenueSection,
  ]);

  const summary = summarizeResearchSnapshotReviewSources(
    sourceSections,
    EXCLUDED_SOURCES,
  );

  return Object.freeze({
    version: RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_VERSION,
    generatedAt,
    reviewOnly: true as const,
    noInvestmentAdvice: true as const,
    noForecast: true as const,
    noRecommendation: true as const,
    entersAlphaScore: false as const,
    sourceSections,
    excludedSources: EXCLUDED_SOURCES,
    summary,
  } satisfies ResearchSnapshotReviewArtifact);
}
