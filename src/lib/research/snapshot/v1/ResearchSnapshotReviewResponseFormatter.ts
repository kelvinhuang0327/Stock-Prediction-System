/**
 * P68 — Axis A v1 Research Snapshot Review Response Formatter
 *
 * Accepts a caller-supplied P67 ResearchSnapshotReviewBoundaryResponse,
 * validates governance flags, and produces a frozen, JSON-safe, deterministic
 * ResearchSnapshotReviewFormatterResponse with neutral display rows.
 *
 * Completes the Axis A read path:
 *   P57(contract) → P58(adapters) → P59(snapshot builder)
 *   → P66(review artifact) → P67(boundary) → P68(display formatter)
 *
 * Governance:
 *   reviewOnly = true
 *   noInvestmentAdvice = true
 *   noForecast = true
 *   noRecommendation = true
 *   entersAlphaScore = false
 *
 * Behavior:
 *   - Accepts caller-supplied P67 ResearchSnapshotReviewBoundaryResponse only.
 *   - Validates all governance flags before producing a response.
 *   - Throws if any governance flag is invalid.
 *   - Maps sourceSections → INCLUDED displayRows (neutral labels).
 *   - Maps excludedSources → EXCLUDED displayRows (neutral exclusion notes).
 *   - INCLUDED_LOW_CONFIDENCE rows carry a neutral low-confidence displayNote.
 *   - Does NOT call P59 / P66 / P67 builders internally.
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
 * Classification: P68_AXIS_A_V1_RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import type {
  ResearchSnapshotReviewBoundaryResponse,
  ResearchSnapshotReviewBoundaryValidationResult,
} from "@/lib/research/snapshot/v1/ResearchSnapshotReviewBoundary";

// ─── Version ──────────────────────────────────────────────────────────────────

export const RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_VERSION =
  "p68-axis-a-research-snapshot-review-response-formatter-v0" as const;

// ─── Governance constants ─────────────────────────────────────────────────────

export const RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_GOVERNANCE =
  Object.freeze({
    reviewOnly: true,
    noInvestmentAdvice: true,
    noForecast: true,
    noRecommendation: true,
    entersAlphaScore: false,
  } as const);

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResearchSnapshotReviewDisplayRow = {
  readonly sourceName: string;
  readonly rowType: "INCLUDED" | "EXCLUDED";
  readonly reviewStatus?: string;
  readonly pitGateStatus?: string;
  readonly includeInDisplay: boolean;
  readonly displayNote?: string;
};

export type ResearchSnapshotReviewFormatterSummary = {
  readonly totalDisplayRows: number;
  readonly includedEligibleCount: number;
  readonly includedLowConfidenceCount: number;
  readonly excludedCount: number;
};

export type ResearchSnapshotReviewFormatterResponse = {
  readonly version: typeof RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_VERSION;
  readonly generatedAt: string;
  readonly reviewOnly: true;
  readonly noInvestmentAdvice: true;
  readonly noForecast: true;
  readonly noRecommendation: true;
  readonly entersAlphaScore: false;
  readonly boundaryVersion: string;
  readonly artifactVersion: string;
  readonly displayRows: readonly ResearchSnapshotReviewDisplayRow[];
  readonly formatterSummary: ResearchSnapshotReviewFormatterSummary;
};

export type ResearchSnapshotReviewResponseFormatterParams = {
  readonly boundaryResponse: ResearchSnapshotReviewBoundaryResponse;
  readonly fixedGeneratedAt?: string;
};

// ─── validateResearchSnapshotReviewBoundaryResponseForFormatting ──────────────

/**
 * Validate that a ResearchSnapshotReviewBoundaryResponse carries the required
 * governance flags before it is admitted to the formatter.
 *
 * Returns { valid: true } on success.
 * Returns { valid: false, reason } on the first governance violation found.
 *
 * @param boundaryResponse - caller-supplied P67 boundary response
 */
export function validateResearchSnapshotReviewBoundaryResponseForFormatting(
  boundaryResponse: ResearchSnapshotReviewBoundaryResponse,
): ResearchSnapshotReviewBoundaryValidationResult {
  if (
    (boundaryResponse as { reviewOnly: unknown }).reviewOnly !== true
  ) {
    return {
      valid: false,
      reason: "boundaryResponse.reviewOnly must be true",
    };
  }
  if (
    (boundaryResponse as { noInvestmentAdvice: unknown }).noInvestmentAdvice !==
    true
  ) {
    return {
      valid: false,
      reason: "boundaryResponse.noInvestmentAdvice must be true",
    };
  }
  if (
    (boundaryResponse as { noForecast: unknown }).noForecast !== true
  ) {
    return {
      valid: false,
      reason: "boundaryResponse.noForecast must be true",
    };
  }
  if (
    (boundaryResponse as { noRecommendation: unknown }).noRecommendation !== true
  ) {
    return {
      valid: false,
      reason: "boundaryResponse.noRecommendation must be true",
    };
  }
  if (
    (boundaryResponse as { entersAlphaScore: unknown }).entersAlphaScore !==
    false
  ) {
    return {
      valid: false,
      reason: "boundaryResponse.entersAlphaScore must be false",
    };
  }
  return { valid: true };
}

// ─── formatResearchSnapshotReviewBoundaryResponse ────────────────────────────

/**
 * Build a frozen, JSON-safe, deterministic ResearchSnapshotReviewFormatterResponse
 * from a caller-supplied P67 ResearchSnapshotReviewBoundaryResponse.
 *
 * Throws if any governance flag on the boundary response is invalid.
 * Maps sourceSections to INCLUDED display rows and excludedSources to EXCLUDED
 * display rows — all using neutral, no-advice labels.
 *
 * Does not query DB, call network, run simulation, or produce scoring output.
 * Does not call any upstream builder (P59/P66/P67) internally.
 *
 * @param params.boundaryResponse - pre-built boundary response from P67
 * @param params.fixedGeneratedAt - ISO-8601 override for deterministic testing
 */
export function formatResearchSnapshotReviewBoundaryResponse(
  params: ResearchSnapshotReviewResponseFormatterParams,
): ResearchSnapshotReviewFormatterResponse {
  const { boundaryResponse, fixedGeneratedAt } = params;

  const validation =
    validateResearchSnapshotReviewBoundaryResponseForFormatting(
      boundaryResponse,
    );
  if (!validation.valid) {
    throw new Error(
      `ResearchSnapshotReviewResponseFormatter governance validation failed: ${validation.reason}`,
    );
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();

  // ── Map sourceSections → INCLUDED display rows ──────────────────────────
  const includedRows: ResearchSnapshotReviewDisplayRow[] =
    boundaryResponse.sourceSections.map((section) => {
      const row: ResearchSnapshotReviewDisplayRow = Object.freeze({
        sourceName: section.sourceName,
        rowType: "INCLUDED" as const,
        reviewStatus: section.reviewStatus,
        pitGateStatus: section.pitGateStatus,
        includeInDisplay: true as const,
        ...(section.reviewStatus === "INCLUDED_LOW_CONFIDENCE"
          ? {
              displayNote:
                "Review status: LOW_CONFIDENCE. " +
                "This source uses an inferred point-in-time gate. " +
                "Display only — not for decision use.",
            }
          : undefined),
      });
      return row;
    });

  // ── Map excludedSources → EXCLUDED display rows ──────────────────────────
  const excludedRows: ResearchSnapshotReviewDisplayRow[] =
    boundaryResponse.excludedSources.map((excluded) => {
      return Object.freeze({
        sourceName: excluded.sourceName,
        rowType: "EXCLUDED" as const,
        includeInDisplay: false as const,
        displayNote: `Excluded from review. Reason: ${excluded.exclusionReason}`,
      });
    });

  const displayRows = Object.freeze([...includedRows, ...excludedRows]);

  // ── Compute formatterSummary ─────────────────────────────────────────────
  let includedEligibleCount = 0;
  let includedLowConfidenceCount = 0;

  for (const row of includedRows) {
    if (row.reviewStatus === "INCLUDED_ELIGIBLE") {
      includedEligibleCount += 1;
    } else if (row.reviewStatus === "INCLUDED_LOW_CONFIDENCE") {
      includedLowConfidenceCount += 1;
    }
  }

  const formatterSummary: ResearchSnapshotReviewFormatterSummary = Object.freeze({
    totalDisplayRows: displayRows.length,
    includedEligibleCount,
    includedLowConfidenceCount,
    excludedCount: excludedRows.length,
  });

  return Object.freeze({
    version: RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_VERSION,
    generatedAt,
    reviewOnly: true as const,
    noInvestmentAdvice: true as const,
    noForecast: true as const,
    noRecommendation: true as const,
    entersAlphaScore: false as const,
    boundaryVersion: boundaryResponse.version,
    artifactVersion: boundaryResponse.artifactVersion,
    displayRows,
    formatterSummary,
  } satisfies ResearchSnapshotReviewFormatterResponse);
}
