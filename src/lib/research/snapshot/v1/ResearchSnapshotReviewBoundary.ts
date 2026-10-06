/**
 * P67 — Axis A v1 Research Snapshot Review Boundary
 *
 * Accepts a caller-supplied P66 ResearchSnapshotReviewArtifact, validates all
 * governance flags, and produces a frozen, JSON-safe, deterministic
 * ResearchSnapshotReviewBoundaryResponse.
 *
 * Governance:
 *   reviewOnly = true
 *   noInvestmentAdvice = true
 *   noForecast = true
 *   noRecommendation = true
 *   entersAlphaScore = false
 *
 * Behavior:
 *   - Accepts caller-supplied P66 ResearchSnapshotReviewArtifact only.
 *   - Validates all governance flags before producing a response.
 *   - Throws if any governance flag is invalid.
 *   - Preserves sourceSections and excludedSources unchanged from artifact.
 *   - Preserves summary counts from artifact.
 *   - Does NOT call the P59 builder or P66 builder internally.
 *   - Does NOT query DB / Prisma.
 *   - Does NOT read filesystem.
 *   - Does NOT call network.
 *   - Does NOT run simulation / optimizer / backtest.
 *   - Does NOT produce forecast / prediction / target price / alphaScore.
 *   - Does NOT produce recommendation / action / buy / sell / hold semantics.
 *
 * Forbidden:
 *   - No DB / Prisma import
 *   - No fs / path / network / child_process import
 *   - No Axis B / onlineValidation module import
 *   - No recommendation / action / buy / sell / hold / targetPrice semantics
 *   - No ROI / PnL / winRate / benchmark / alphaScore / score / forecast
 *   - No run / execute / simulate / optimize / backtest exported function
 *
 * Classification: P67_AXIS_A_V1_RESEARCH_SNAPSHOT_REVIEW_BOUNDARY
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import type { ResearchSnapshotReviewArtifact } from "@/lib/research/snapshot/v1/ResearchSnapshotReviewArtifact";

// ─── Version ──────────────────────────────────────────────────────────────────

export const RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_VERSION =
  "p67-axis-a-research-snapshot-review-boundary-v0" as const;

// ─── Governance constants ─────────────────────────────────────────────────────

export const RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_GOVERNANCE = Object.freeze({
  reviewOnly: true,
  noInvestmentAdvice: true,
  noForecast: true,
  noRecommendation: true,
  entersAlphaScore: false,
} as const);

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResearchSnapshotReviewBoundaryValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

export type ResearchSnapshotReviewBoundarySummary = {
  readonly totalReviewedSources: number;
  readonly includedEligibleCount: number;
  readonly includedLowConfidenceCount: number;
  readonly excludedCount: number;
};

export type ResearchSnapshotReviewBoundaryResponse = {
  readonly version: typeof RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_VERSION;
  readonly generatedAt: string;
  readonly reviewOnly: true;
  readonly noInvestmentAdvice: true;
  readonly noForecast: true;
  readonly noRecommendation: true;
  readonly entersAlphaScore: false;
  readonly artifactVersion: string;
  readonly sourceSections: ResearchSnapshotReviewArtifact["sourceSections"];
  readonly excludedSources: ResearchSnapshotReviewArtifact["excludedSources"];
  readonly summary: ResearchSnapshotReviewBoundarySummary;
};

export type ResearchSnapshotReviewBoundaryParams = {
  readonly artifact: ResearchSnapshotReviewArtifact;
  readonly fixedGeneratedAt?: string;
};

// ─── validateResearchSnapshotReviewArtifactForBoundary ────────────────────────

/**
 * Validate that a ResearchSnapshotReviewArtifact carries the required
 * governance flags before it is admitted to the boundary layer.
 *
 * Returns { valid: true } on success.
 * Returns { valid: false, reason } on the first governance violation found.
 *
 * @param artifact - caller-supplied P66 review artifact
 */
export function validateResearchSnapshotReviewArtifactForBoundary(
  artifact: ResearchSnapshotReviewArtifact,
): ResearchSnapshotReviewBoundaryValidationResult {
  if ((artifact as { reviewOnly: unknown }).reviewOnly !== true) {
    return {
      valid: false,
      reason: "artifact.reviewOnly must be true",
    };
  }
  if ((artifact as { noInvestmentAdvice: unknown }).noInvestmentAdvice !== true) {
    return {
      valid: false,
      reason: "artifact.noInvestmentAdvice must be true",
    };
  }
  if ((artifact as { noForecast: unknown }).noForecast !== true) {
    return {
      valid: false,
      reason: "artifact.noForecast must be true",
    };
  }
  if ((artifact as { noRecommendation: unknown }).noRecommendation !== true) {
    return {
      valid: false,
      reason: "artifact.noRecommendation must be true",
    };
  }
  if ((artifact as { entersAlphaScore: unknown }).entersAlphaScore !== false) {
    return {
      valid: false,
      reason: "artifact.entersAlphaScore must be false",
    };
  }
  return { valid: true };
}

// ─── buildResearchSnapshotReviewBoundaryResponse ──────────────────────────────

/**
 * Build a frozen, JSON-safe, deterministic ResearchSnapshotReviewBoundaryResponse
 * from a caller-supplied P66 ResearchSnapshotReviewArtifact.
 *
 * Throws if any governance flag on the artifact is invalid.
 * Preserves sourceSections, excludedSources, and summary counts from artifact.
 *
 * Does not query DB, call network, run simulation, or produce scoring output.
 * Does not call the P59 builder or P66 builder internally.
 *
 * @param params.artifact        - pre-assembled ResearchSnapshotReviewArtifact from P66
 * @param params.fixedGeneratedAt - ISO-8601 override for deterministic testing
 */
export function buildResearchSnapshotReviewBoundaryResponse(
  params: ResearchSnapshotReviewBoundaryParams,
): ResearchSnapshotReviewBoundaryResponse {
  const { artifact, fixedGeneratedAt } = params;

  const validation = validateResearchSnapshotReviewArtifactForBoundary(artifact);
  if (!validation.valid) {
    throw new Error(
      `ResearchSnapshotReviewBoundary governance validation failed: ${validation.reason}`,
    );
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();

  const summary: ResearchSnapshotReviewBoundarySummary = Object.freeze({
    totalReviewedSources: artifact.summary.totalReviewedSources,
    includedEligibleCount: artifact.summary.includedEligibleCount,
    includedLowConfidenceCount: artifact.summary.includedLowConfidenceCount,
    excludedCount: artifact.summary.excludedCount,
  });

  return Object.freeze({
    version: RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_VERSION,
    generatedAt,
    reviewOnly: true as const,
    noInvestmentAdvice: true as const,
    noForecast: true as const,
    noRecommendation: true as const,
    entersAlphaScore: false as const,
    artifactVersion: artifact.version,
    sourceSections: artifact.sourceSections,
    excludedSources: artifact.excludedSources,
    summary,
  } satisfies ResearchSnapshotReviewBoundaryResponse);
}
