/**
 * P26ACorpusRowAdapter.ts
 * P26A-BATCH-PIPELINE-WIRING-HARDRESET
 *
 * Read-only adapter that maps a P3 corpus row to a WalkthroughCaseInput.
 * Passes factorSnapshot, usedSources, and missingSources from
 * activeScoringSnapshot into WalkthroughCaseInput so that the
 * P26ACorpusReasonRenderer can fire as ENRICHED at display time.
 *
 * Guarantees:
 *   - Pure function — same input → same output
 *   - No DB write
 *   - No corpus mutation
 *   - No external API call
 *   - No alphaScore change
 *   - No researchBucket change
 *   - No buy/sell/ROI/alpha/edge claims
 *
 * Not investment advice. Not a trading system.
 */

import type { WalkthroughCaseInput } from './P5WalkthroughReviewUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveScoringSnapshotShape {
  builderVersion?: string;
  symbol?: string;
  asOfDate?: string;
  scoringMode?: string;
  researchBucket?: string;
  alphaScore?: number;
  scoreSnapshot?: Record<string, number>;
  signalSnapshot?: unknown[];
  factorSnapshot?: string[];
  reasonSnapshot?: string | null;
  limitations?: string[];
  dataCoverage?: unknown;
  dataPoints?: unknown;
  usedSources?: string[];
  missingSources?: string[];
  pitGateDate?: string;
  scoringAvailable?: boolean;
  completenessStatus?: string;
  scoringNote?: string;
}

export interface OutcomeSnapshotShape {
  horizonDays: number;
  returnPct?: number | null;
}

export interface CorpusRow {
  corpusRunId?: string;
  writerVersion?: string;
  symbol: string;
  originalAsOfDate: string;
  universeTier?: string;
  duplicateKey?: string;
  createdAt?: string;
  logVersion?: string;
  runId?: string;
  researchBucket: string;
  scoreSnapshot?: Record<string, number>;
  sourceDateBasis?: unknown;
  closePriceAtPrediction?: number | null;
  entryPriceSource?: string;
  outcomeSnapshot: OutcomeSnapshotShape;
  validationMessages?: string[];
  scoringCompletenessStatus?: string;
  activeScoringSnapshot?: ActiveScoringSnapshotShape;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * corpusRowToWalkthroughCaseInput
 *
 * Converts a P3 corpus row to a WalkthroughCaseInput, passing through
 * factorSnapshot, usedSources, and missingSources from activeScoringSnapshot.
 *
 * These additive optional fields enable the P26ACorpusReasonRenderer to fire
 * as ENRICHED instead of FALLBACK_EMPTY during walkthrough/display time.
 *
 * Does not modify the input row. Does not write to any store.
 */
export function corpusRowToWalkthroughCaseInput(row: CorpusRow): WalkthroughCaseInput {
  const snap = row.activeScoringSnapshot;

  return {
    symbol: row.symbol,
    originalAsOfDate: row.originalAsOfDate,
    horizonDays: row.outcomeSnapshot.horizonDays,
    researchBucket: row.researchBucket,
    activeScoringBucket: snap?.researchBucket ?? undefined,
    primaryScore: snap?.alphaScore ?? null,
    scoreDecile: null,
    returnPct: row.outcomeSnapshot.returnPct ?? null,
    scoringCompletenessStatus: row.scoringCompletenessStatus,
    signalCount: snap?.signalSnapshot?.length ?? 0,
    factorCount: snap?.factorSnapshot?.length ?? 0,
    reasonSnapshot: snap?.reasonSnapshot ?? null,
    closePriceAtPrediction: row.closePriceAtPrediction ?? null,
    // P26A additive fields — pass-through from activeScoringSnapshot
    factorSnapshot: snap?.factorSnapshot ?? undefined,
    usedSources: snap?.usedSources ?? undefined,
    missingSources: snap?.missingSources ?? undefined,
    // P28C-RENDERER-REPAIR: pass actual scoreSnapshot so renderer uses real tech/chip scores
    scoreSnapshot: snap?.scoreSnapshot as { technicalScore: number; chipScore: number; [key: string]: number } ?? undefined,
  };
}
