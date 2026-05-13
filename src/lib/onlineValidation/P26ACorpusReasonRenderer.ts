/**
 * P26ACorpusReasonRenderer.ts
 * P26A-RENDERER-FIX-HARDRESET
 *
 * Read-time renderer for ActiveScoringSnapshot reason text.
 *
 * Problem addressed:
 *   The P3/P19 frozen corpus was built before enrichReasonFromExistingFactors was added
 *   to ActiveScoringSnapshotBuilder. As a result, 9 SCORING_UNDEROUTPUT cases in the
 *   corpus have reasonSnapshot = single generic token (e.g. "技術偏多") even though
 *   factorSnapshot contains 10+ rich signals.
 *
 * Solution:
 *   At READ time (walkthrough / API display / audit), apply enrichment if reasonSnapshot
 *   is a single generic token and factorSnapshot is non-empty.
 *   This does NOT modify the corpus files. This does NOT change alphaScore or researchBucket.
 *
 * Guarantees:
 *   - Pure function — same input → same output (deterministic)
 *   - No DB write
 *   - No corpus mutation
 *   - No external API / LLM call
 *   - No alphaScore change
 *   - No recommendationBucket / researchBucket change
 *   - No new factors introduced (reads only from factorSnapshot)
 *   - No buy/sell claims. No performance or return claims.
 *
 * Not investment advice. Not a trading system.
 */

import { enrichReasonFromExistingFactors } from './P26AReasonFactorEnrichmentUtils';
import type { ActiveScoringSnapshot } from './ActiveScoringSnapshotBuilder';

// ─── Renderer version ────────────────────────────────────────────────────────

export const CORPUS_REASON_RENDERER_VERSION = 'p26a-corpus-renderer-v1';

// ─── Single-token detection ───────────────────────────────────────────────────

/**
 * SINGLE_TOKEN_GENERIC_REASONS
 *
 * Exhaustive set of collapsed single-token reason strings produced by
 * RuleBasedStockAnalyzer before P26A enrichment was added.
 * These are the patterns that indicate SNAPSHOT_FIELD_PRESENT_BUT_REASON_NOT_RENDERED.
 */
export const SINGLE_TOKEN_GENERIC_REASONS: ReadonlySet<string> = new Set([
    '技術偏多',
    '技術偏空',
    '法人買超',
    '法人賣超',
    '動能轉強',
    '動能走弱',
    '營收成長',
    '營收衰退',
    '資料觀察中',
    'technicalBullish',
    'technicalBearish',
    'chipBullish',
    'chipBearish',
    'momentumUp',
    'momentumDown',
    'revenueBullish',
    'revenueBearish',
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export type RendererOutcome =
    | 'ENRICHED'           // single-token replaced with factorSnapshot-derived multi-factor text
    | 'ALREADY_RICH'       // reasonSnapshot already has multi-factor content, not replaced
    | 'FALLBACK_EMPTY'     // factorSnapshot empty — kept original reasonSnapshot
    | 'FALLBACK_NO_SNAPSHOT'; // no snapshot at all

export interface RenderedReason {
    renderedText: string;
    outcome: RendererOutcome;
    oldText: string;
    factorCount: number;
    rendererVersion: string;
    alphaScoreUnchanged: boolean;   // always true — renderer never touches alphaScore
    bucketUnchanged: boolean;       // always true — renderer never touches researchBucket
}

// ─── Core renderer ────────────────────────────────────────────────────────────

/**
 * isSingleTokenGenericReason
 *
 * Returns true if reasonText is a known single-token generic reason that
 * should be enriched with factorSnapshot content.
 */
export function isSingleTokenGenericReason(reasonText: string | null | undefined): boolean {
    if (!reasonText) return false;
    return SINGLE_TOKEN_GENERIC_REASONS.has(reasonText.trim());
}

/**
 * renderReasonFromCorpusSnapshot
 *
 * PURE FUNCTION — same input always produces same output.
 *
 * Takes a corpus snapshot (ActiveScoringSnapshot shape, as stored in JSONL corpus)
 * and returns an enriched reason text for display.
 *
 * If reasonSnapshot is a single generic token and factorSnapshot is non-empty:
 *   → applies enrichReasonFromExistingFactors → outcome = ENRICHED
 * If reasonSnapshot already has multi-factor content:
 *   → returns as-is → outcome = ALREADY_RICH
 * If factorSnapshot is empty:
 *   → returns original reasonSnapshot → outcome = FALLBACK_EMPTY
 *
 * NEVER modifies the input snapshot.
 * NEVER changes alphaScore or researchBucket.
 */
export function renderReasonFromCorpusSnapshot(snapshot: ActiveScoringSnapshot): RenderedReason {
    const oldText = snapshot.reasonSnapshot ?? '';
    const factorCount = snapshot.factorSnapshot?.length ?? 0;

    // Cannot enrich if no factors available
    if (factorCount === 0) {
        return {
            renderedText: oldText,
            outcome: 'FALLBACK_EMPTY',
            oldText,
            factorCount: 0,
            rendererVersion: CORPUS_REASON_RENDERER_VERSION,
            alphaScoreUnchanged: true,
            bucketUnchanged: true,
        };
    }

    // Already rich — has multi-factor content (contains '/' separator or multiple Chinese characters
    // with numerical evidence)
    if (!isSingleTokenGenericReason(oldText) && oldText.length > 20) {
        return {
            renderedText: oldText,
            outcome: 'ALREADY_RICH',
            oldText,
            factorCount,
            rendererVersion: CORPUS_REASON_RENDERER_VERSION,
            alphaScoreUnchanged: true,
            bucketUnchanged: true,
        };
    }

    // Single token or short generic reason → enrich from factorSnapshot
    const enriched = enrichReasonFromExistingFactors(snapshot);

    return {
        renderedText: enriched,
        outcome: 'ENRICHED',
        oldText,
        factorCount,
        rendererVersion: CORPUS_REASON_RENDERER_VERSION,
        alphaScoreUnchanged: true,
        bucketUnchanged: true,
    };
}

/**
 * renderReasonBatch
 *
 * Applies renderReasonFromCorpusSnapshot to multiple snapshots.
 * Pure — does not mutate inputs.
 */
export function renderReasonBatch(
    snapshots: ActiveScoringSnapshot[],
): RenderedReason[] {
    return snapshots.map(renderReasonFromCorpusSnapshot);
}

// ─── Coverage note helper ─────────────────────────────────────────────────────

/**
 * buildDataCoverageNote
 *
 * Returns a NEUTRAL data availability note when sources are missing.
 * Does NOT imply negative investment stance.
 * Per PIT contract: missing sources are a data observation, not a signal.
 */
export function buildDataCoverageNote(
    usedSources: string[],
    missingSources: string[],
    asOfDate: string,
): string {
    if (missingSources.length === 0) {
        return '';
    }
    const missing = missingSources.join(', ');
    const used = usedSources.join(', ');
    return (
        `資料說明：PIT 截止日 ${asOfDate}，已使用資料源：${used}；` +
        `尚待資料源：${missing}（不影響現有技術與籌碼評分，僅供資料完整性說明）`
    );
}

// ─── Quality check helper ─────────────────────────────────────────────────────

/**
 * countRenderedFactors
 *
 * Counts approximate number of distinct factor dimensions in rendered text.
 * Used for before/after quality comparison.
 */
export function countRenderedFactors(renderedText: string): number {
    if (!renderedText || renderedText.trim().length === 0) return 0;
    // Count '/' separators + 1
    const slashCount = (renderedText.match(/\//g) ?? []).length;
    // Count comma-separated items within each dimension
    const commaCount = (renderedText.match(/，/g) ?? []).length;
    // Rough estimate: each '/' is a dimension boundary
    return Math.max(1, slashCount + 1);
}
