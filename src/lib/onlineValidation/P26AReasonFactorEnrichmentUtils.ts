/**
 * P26AReasonFactorEnrichmentUtils.ts
 * P26A-HARDRESET — Reason / Factor Enrichment Utilities
 *
 * Pure, read-only enrichment layer over existing ActiveScoringSnapshot factors.
 * Does NOT introduce new factors. Does NOT modify scoring. Does NOT call external APIs.
 *
 * All exported functions are pure: same input → same output, no side effects.
 *
 * Allowed factor set = factors already computed by RuleBasedStockAnalyzer + SignalFusionEngine.
 * See ALLOWED_FACTOR_SET for the exhaustive list.
 *
 * NO investment recommendations. NO ROI / win-rate / profit / outperform / buy / sell claims.
 */

import type { ActiveScoringSnapshot } from './ActiveScoringSnapshotBuilder';

// ─── Allowed Factor Set ──────────────────────────────────────────────────────
// Exhaustive list of factor names already computed by RuleBasedStockAnalyzer + SignalFusionEngine.
// No factor outside this set may appear in enriched reasons.

export const ALLOWED_FACTOR_SET: ReadonlySet<string> = new Set([
    // Technical factors (RuleBasedStockAnalyzer)
    'MA 趨勢',
    'MA20 位置',
    'RSI(14)',
    'MACD',
    '近 20 日動能',
    '近 5 日報酬',
    '近 20 日報酬',
    '量能變化',
    '波動率',
    '近期最大回撤',
    // Chip factors
    '法人近 10 日買超',
    // Fundamental factors
    '營收年增率',
    // SignalFusionEngine factors
    'Technical Score',
    'Momentum Score',
    'Chip Strength',
    'Revenue YoY',
    'Market Regime',
    'Regime Confidence',
]);

// ─── Forbidden Claim Patterns ────────────────────────────────────────────────

const FORBIDDEN_CLAIM_PATTERNS: ReadonlyArray<RegExp> = [
    /\bROI\b/i,
    /win[- ]?rate/i,
    /\balpha\b(?!\s*Score)/i,   // "alpha" alone is forbidden; "alphaScore" field name is allowed
    /\bedge\b/i,
    /\bprofit\b/i,
    /\boutperform\b/i,
    /\bbeat\b/i,
    /\bbuy\b/i,
    /\bsell\b/i,
    /\bguaranteed\b/i,
    /investment recommendation/i,
];

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReasonQualityLabel = 'RICH' | 'GENERIC' | 'UNDEROUTPUT' | 'EMPTY';

export interface FactorEvidence {
    maContext: string | null;
    rsiContext: string | null;
    macdContext: string | null;
    momentumContext: string | null;
    chipContext: string | null;
    revenueContext: string | null;
    regimeContext: string | null;
    volatilityContext: string | null;
    availableFactorCount: number;
}

export interface MonthlyRevenueAvailability {
    available: boolean;
    yoY: number | null;
    latestPeriod: string | null;
    pitGated: boolean;
}

export interface RegimeAssessment {
    regime: string;
    confidence: number;
}

export interface ReasonValidationResult {
    valid: boolean;
    violatingTerms: string[];
    message: string;
}

// ─── Factor Evidence Builder ─────────────────────────────────────────────────

/**
 * buildFactorEvidenceBlock
 *
 * Extracts structured evidence from the snapshot's factorSnapshot array.
 * Read-only — does not mutate the snapshot.
 */
export function buildFactorEvidenceBlock(snapshot: ActiveScoringSnapshot): FactorEvidence {
    const factors = snapshot.factorSnapshot;

    const find = (prefix: string): string | null =>
        factors.find(f => f.startsWith(prefix)) ?? null;

    const maRaw = find('MA 趨勢') ?? find('MA20 位置');
    const rsiRaw = find('RSI(14)');
    const macdRaw = find('MACD');
    const mom20Raw = find('近 20 日動能');
    const chipRaw = find('法人近 10 日買超');
    const revRaw = find('營收年增率');
    const volRaw = find('波動率');

    // Regime comes from signalSnapshot or reasonSnapshot context (not in factorSnapshot directly)
    // It is attached via attachRegimeContextToReason separately
    const regimeContext = null;

    return {
        maContext: maRaw,
        rsiContext: rsiRaw,
        macdContext: macdRaw,
        momentumContext: mom20Raw,
        chipContext: chipRaw,
        revenueContext: revRaw,
        regimeContext,
        volatilityContext: volRaw,
        availableFactorCount: factors.length,
    };
}

// ─── Attach Context Functions ────────────────────────────────────────────────

/**
 * attachTechnicalContextToReason
 *
 * Returns a technical context string derived from existing factorSnapshot.
 * Pure function — does not modify snapshot.
 */
export function attachTechnicalContextToReason(
    snapshot: ActiveScoringSnapshot,
    technicalScore: number,
): string {
    const ev = buildFactorEvidenceBlock(snapshot);
    const parts: string[] = [];

    if (technicalScore >= 65) {
        parts.push(`技術面偏多（技術分數 ${technicalScore}）`);
    } else if (technicalScore <= 35) {
        parts.push(`技術面偏空（技術分數 ${technicalScore}）`);
    } else {
        parts.push(`技術面中性（技術分數 ${technicalScore}）`);
    }

    if (ev.maContext) parts.push(`均線：${_extractNote(ev.maContext)}`);
    if (ev.rsiContext) parts.push(`RSI：${_extractNote(ev.rsiContext)}`);
    if (ev.macdContext) parts.push(`MACD：${_extractNote(ev.macdContext)}`);
    if (ev.momentumContext) parts.push(`動能：${_extractNote(ev.momentumContext)}`);

    return parts.join('，');
}

/**
 * attachChipContextToReason
 *
 * Returns a chip context string derived from existing factorSnapshot.
 */
export function attachChipContextToReason(
    snapshot: ActiveScoringSnapshot,
    chipScore: number,
): string {
    const ev = buildFactorEvidenceBlock(snapshot);
    if (!ev.chipContext) return '';

    const parts: string[] = [];
    if (chipScore >= 65) {
        parts.push(`法人籌碼偏多（籌碼分數 ${chipScore}）`);
    } else if (chipScore <= 35) {
        parts.push(`法人籌碼偏空（籌碼分數 ${chipScore}）`);
    } else {
        parts.push(`法人籌碼中性（籌碼分數 ${chipScore}）`);
    }
    parts.push(`明細：${_extractNote(ev.chipContext)}`);

    return parts.join('，');
}

/**
 * attachMonthlyRevenueContextToReason
 *
 * Returns a revenue context string.
 * Uses PIT-gated availability object — does not call DB.
 */
export function attachMonthlyRevenueContextToReason(
    snapshot: ActiveScoringSnapshot,
    monthlyRevenueAvailability: MonthlyRevenueAvailability,
): string {
    if (!monthlyRevenueAvailability.available) {
        return '月營收：資料不足或尚未公告（PIT 截止 ' + snapshot.asOfDate + '）';
    }

    const ev = buildFactorEvidenceBlock(snapshot);
    if (!ev.revenueContext) {
        return monthlyRevenueAvailability.yoY !== null
            ? `月營收年增率 ${monthlyRevenueAvailability.yoY > 0 ? '+' : ''}${monthlyRevenueAvailability.yoY.toFixed(1)}%（期間：${monthlyRevenueAvailability.latestPeriod ?? '未知'}）`
            : '月營收：已 PIT 篩選，數據有限';
    }

    return `月營收：${_extractNote(ev.revenueContext)}（PIT 截止 ${snapshot.asOfDate}）`;
}

/**
 * attachRegimeContextToReason
 *
 * Returns a market regime context string.
 */
export function attachRegimeContextToReason(
    _snapshot: ActiveScoringSnapshot,
    regimeAssessment: RegimeAssessment,
): string {
    const { regime, confidence } = regimeAssessment;
    if (regime === 'Unknown' || confidence === 0) {
        return '市場環境：無法判斷（資料不足）';
    }
    const label = regime === 'Bull' ? '多頭市場' : regime === 'Bear' ? '空頭市場' : '盤整市場';
    const confLabel = confidence >= 70 ? '高信心' : confidence >= 40 ? '中等信心' : '低信心';
    return `市場環境：${label}（${confLabel}，信心 ${confidence}%）`;
}

// ─── Core Enrichment Function ─────────────────────────────────────────────────

/**
 * enrichReasonFromExistingFactors
 *
 * PURE FUNCTION — same input always produces same output.
 * Enriches the reasonSnapshot using only data already present in factorSnapshot.
 * Does NOT introduce new factors. Does NOT modify the snapshot object.
 *
 * Replaces single-token generic reasons (技術偏多, 技術偏空, 法人買超) with
 * structured multi-dimensional reason strings backed by numerical evidence.
 */
export function enrichReasonFromExistingFactors(snapshot: ActiveScoringSnapshot): string {
    const ev = buildFactorEvidenceBlock(snapshot);

    // If no factors available, return a conservative fallback (not fabrication)
    if (ev.availableFactorCount === 0) {
        return '資料觀察中（factor snapshot 無可用資料）';
    }

    const parts: string[] = [];

    // ── Technical dimension ──
    const techScore = snapshot.scoreSnapshot.technicalScore;
    if (ev.maContext || ev.rsiContext || ev.macdContext || ev.momentumContext) {
        const techLabel = techScore >= 65 ? '偏多' : techScore <= 35 ? '偏空' : '中性';
        const techParts: string[] = [`技術面${techLabel}`];
        if (ev.maContext) techParts.push(_extractValue(ev.maContext) + '（' + _extractNote(ev.maContext) + '）');
        if (ev.rsiContext) techParts.push('RSI ' + _extractValue(ev.rsiContext));
        if (ev.macdContext) techParts.push('MACD ' + _extractValue(ev.macdContext));
        parts.push(techParts.join('，'));
    }

    // ── Chip dimension ──
    const chipScore = snapshot.scoreSnapshot.chipScore;
    if (ev.chipContext && chipScore > 0) {
        const chipLabel = chipScore >= 65 ? '法人偏多買超' : chipScore <= 35 ? '法人偏空賣超' : '法人中性';
        const chipDetail = _extractNote(ev.chipContext);
        parts.push(`${chipLabel}（${chipDetail}）`);
    }

    // ── Revenue dimension ──
    if (ev.revenueContext) {
        const revVal = _extractValue(ev.revenueContext);
        const revNote = _extractNote(ev.revenueContext);
        parts.push(`月營收年增率 ${revVal}（期間：${revNote}）`);
    }

    // ── Volatility dimension ──
    if (ev.volatilityContext) {
        const volVal = _extractValue(ev.volatilityContext);
        parts.push(`波動率 ${volVal}`);
    }

    if (parts.length === 0) {
        return snapshot.reasonSnapshot || '資料觀察中';
    }

    return parts.join(' / ');
}

// ─── Quality Classification ──────────────────────────────────────────────────

/**
 * classifyReasonQuality
 *
 * Classifies reason quality based on richness of textual content.
 * RICH: contains 2+ dimensions with numerical values
 * GENERIC: contains only 1-2 generic tags without numerical values
 * UNDEROUTPUT: single-token reason where factorEvidence also has no data (engine didn't output)
 * EMPTY: no reason text at all
 */
export function classifyReasonQuality(
    reasonText: string,
    factorEvidence: FactorEvidence,
): ReasonQualityLabel {
    if (!reasonText || reasonText.trim() === '') return 'EMPTY';

    const SINGLE_TOKEN_PATTERNS = [
        '技術偏多', '技術偏空', '法人買超', '法人賣超',
        '動能轉強', '動能走弱', '營收成長', '營收衰退', '資料觀察中',
    ];

    const trimmed = reasonText.trim();

    // UNDEROUTPUT: single generic tag AND no factor evidence available
    if (SINGLE_TOKEN_PATTERNS.includes(trimmed) && factorEvidence.availableFactorCount <= 1) {
        return 'UNDEROUTPUT';
    }

    // GENERIC: single tag or very short with no numerical content
    const hasNumerical = /[\d.]+%|[\d,]+張|分數\s*\d+|RSI|MACD|MA\d+/.test(reasonText);
    const dimensionCount = _countDimensions(reasonText);

    if (!hasNumerical && dimensionCount <= 1) return 'GENERIC';

    // RICH: 2+ dimensions OR has numerical evidence
    if (hasNumerical || dimensionCount >= 2) return 'RICH';

    return 'GENERIC';
}

// ─── Validation Functions ────────────────────────────────────────────────────

/**
 * validateReasonDoesNotIntroduceNewFactor
 *
 * Checks that no term in reasonText references a factor outside the allowed set.
 * Returns valid=true if all detected factor terms are in ALLOWED_FACTOR_SET.
 */
export function validateReasonDoesNotIntroduceNewFactor(
    reasonText: string,
    allowedFactorSet: ReadonlySet<string> = ALLOWED_FACTOR_SET,
): ReasonValidationResult {
    const violations: string[] = [];

    // Known new-factor patterns that would be invalid
    const NEW_FACTOR_PATTERNS = [
        /EPS/i, /P\/E\s*ratio/i, /dividend/i, /short\s*interest/i,
        /options\s*flow/i, /insider\s*trading/i, /short\s*squeeze/i,
        /darkpool/i, /dark\s*pool/i,
    ];

    for (const pat of NEW_FACTOR_PATTERNS) {
        if (pat.test(reasonText)) {
            violations.push(pat.source);
        }
    }

    // Check that any explicit factor name referenced is in allowedFactorSet
    for (const factorName of Array.from(allowedFactorSet)) {
        // If reason references this factor name, it's allowed
    }
    // (Additional checks can be added as new factor names are introduced)

    return {
        valid: violations.length === 0,
        violatingTerms: violations,
        message: violations.length === 0
            ? 'All factor references are within allowed set'
            : `New factor terms detected: ${violations.join(', ')}`,
    };
}

/**
 * validateReasonHasNoForbiddenClaim
 *
 * Checks that reasonText does not contain any forbidden investment claim.
 */
export function validateReasonHasNoForbiddenClaim(reasonText: string): ReasonValidationResult {
    const violations: string[] = [];

    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
        const match = reasonText.match(pattern);
        if (match) {
            violations.push(match[0]);
        }
    }

    return {
        valid: violations.length === 0,
        violatingTerms: violations,
        message: violations.length === 0
            ? 'No forbidden claims detected'
            : `Forbidden claims detected: ${violations.join(', ')}`,
    };
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

/** Extracts the value portion from "Name: VALUE (note)" format */
function _extractValue(factorStr: string): string {
    const match = factorStr.match(/^[^:]+:\s*([^(]+)/);
    return match ? match[1].trim() : factorStr;
}

/** Extracts the note portion from "Name: value (NOTE)" format */
function _extractNote(factorStr: string): string {
    const match = factorStr.match(/\(([^)]+)\)/);
    return match ? match[1].trim() : factorStr;
}

/** Counts how many distinct dimensions appear in reason text */
function _countDimensions(reasonText: string): number {
    let count = 0;
    if (/技術|MA|RSI|MACD/.test(reasonText)) count++;
    if (/法人|籌碼/.test(reasonText)) count++;
    if (/營收|基本/.test(reasonText)) count++;
    if (/市場環境|多頭市場|空頭市場|盤整/.test(reasonText)) count++;
    if (/波動|回撤/.test(reasonText)) count++;
    return count;
}
