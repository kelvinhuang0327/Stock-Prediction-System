/**
 * StrategyScreenEngine
 *
 * 候選股篩選引擎。整合 SignalFusionEngine、MarketRegimeEngine，
 * 輸出分類後的候選池（Strong / Watch / Neutral / Excluded）。
 *
 * 這是候選篩選層，不是交易下單引擎。
 * 所有分類規則可解釋、可降級。
 */

import { prisma } from '@/lib/prisma';
import { fuseBatch, FusionResult, RecommendationBucket } from '@/lib/alpha/SignalFusionEngine';
import { detectRegime, MarketRegimeResult, MarketRegime } from '@/lib/market/MarketRegimeEngine';

// ─── Public Types ───────────────────────────────────────────────

export type CandidateBucket = 'Strong Candidate' | 'Watch' | 'Neutral' | 'Excluded';

export interface ScreenCandidate {
    symbol: string;
    name: string;
    closePrice: number;
    priceChangePercent: number;
    isETF: boolean;
    // Scores
    alphaScore: number;
    recommendationBucket: RecommendationBucket;
    confidence: number;
    technicalScore: number;
    chipScore: number;
    fundamentalScore: number;
    marketAdjustment: number;
    riskLevel: string;
    // Screen result
    screenBucket: CandidateBucket;
    whyIncluded: string;
    topFactors: string[];
    keyRisks: string[];
    // Data quality
    dataCoverage: 'full' | 'limited' | 'insufficient';
    usedSources: string[];
    missingSources: string[];
    limitations: string[];
    summary: string;
}

export interface ExcludedStock {
    symbol: string;
    name: string;
    reason: string;
}

export interface ScreenParams {
    minAlphaScore?: number;
    minConfidence?: number;
    includeBuckets?: CandidateBucket[];
    maxResults?: number;
    respectMarketRegime?: boolean;
    symbolUniverse?: string[];
    /** When running a rolling simulation, cap all data queries to this date (YYYY-MM-DD). */
    asOf?: string;
}

export interface ScreenResult {
    regime: MarketRegime;
    regimeConfidence: number;
    candidates: ScreenCandidate[];
    excludedCount: number;
    excluded: ExcludedStock[];
    totalScanned: number;
    dataCoverageSummary: {
        full: number;
        limited: number;
        insufficient: number;
    };
    screenParams: {
        minAlphaScore: number;
        minConfidence: number;
        respectMarketRegime: boolean;
        appliedRegimeAdjustment: string;
    };
    last_updated: string | null;
    limitations: string[];
    disclaimer: string;
}

// ─── Defaults ───────────────────────────────────────────────────

const DEFAULT_MIN_ALPHA = 40;
const DEFAULT_MIN_CONFIDENCE = 15;
const DEFAULT_MAX_RESULTS = 50;

// Regime-specific threshold adjustments
const REGIME_ALPHA_OFFSET: Record<MarketRegime, number> = {
    Bull: -5,      // More permissive in bull
    Sideways: 0,   // Normal
    Bear: +10,     // Stricter in bear
    Unknown: 0,    // No adjustment
};

const REGIME_STRONG_THRESHOLD: Record<MarketRegime, number> = {
    Bull: 70,
    Sideways: 75,
    Bear: 80,
    Unknown: 75,
};

// ─── Engine ─────────────────────────────────────────────────────

export async function runScreen(params: ScreenParams = {}): Promise<ScreenResult> {
    const {
        minAlphaScore: baseMinAlpha = DEFAULT_MIN_ALPHA,
        minConfidence: minConf = DEFAULT_MIN_CONFIDENCE,
        includeBuckets,
        maxResults = DEFAULT_MAX_RESULTS,
        respectMarketRegime = true,
        symbolUniverse,
        asOf,
    } = params;

    const limitations: string[] = [];

    // 1. Get market regime
    let regime: MarketRegimeResult;
    try {
        regime = await detectRegime();
    } catch {
        regime = {
            regime: 'Unknown', confidence: 0, factors: [],
            dataCoverage: 'insufficient', samplePeriod: 'N/A',
            dataPoints: 0, last_updated: null,
            limitations: ['MarketRegime 不可用'],
        };
        limitations.push('市場環境分析不可用，篩選未納入市場環境調整');
    }

    // 2. Determine symbol universe
    let symbols: string[];
    if (symbolUniverse && symbolUniverse.length > 0) {
        symbols = symbolUniverse;
    } else {
        // Use stocks with >= 50 days of data (capped to asOf when in simulation)
        const stockCounts = await prisma.stockQuote.groupBy({
            by: ['stockId'],
            where: asOf ? { date: { lte: asOf } } : undefined,
            _count: { stockId: true },
        });
        symbols = stockCounts
            .filter(s => s._count.stockId >= 50)
            .map(s => s.stockId);
    }

    if (symbols.length === 0) {
        return emptyResult(regime, limitations, 'stockUniverse 為空，無股票可分析');
    }

    // 3. Run fusion batch (caps at 50 for performance)
    const batchSymbols = symbols.slice(0, 80);
    let fusionResults: FusionResult[];
    try {
        fusionResults = await fuseBatch(batchSymbols);
    } catch (err) {
        limitations.push('SignalFusionEngine 執行失敗');
        return emptyResult(regime, limitations, 'SignalFusionEngine batch 失敗');
    }

    // 4. Apply regime-based threshold adjustments
    const regimeOffset = respectMarketRegime ? REGIME_ALPHA_OFFSET[regime.regime] : 0;
    const effectiveMinAlpha = Math.max(0, baseMinAlpha + regimeOffset);
    const strongThreshold = respectMarketRegime ? REGIME_STRONG_THRESHOLD[regime.regime] : 75;

    let regimeAdjLabel = '無調整';
    if (respectMarketRegime && regime.regime !== 'Unknown') {
        if (regimeOffset > 0) regimeAdjLabel = `${regime.regime} 環境：門檻提高 ${regimeOffset} 分`;
        else if (regimeOffset < 0) regimeAdjLabel = `${regime.regime} 環境：門檻降低 ${Math.abs(regimeOffset)} 分`;
        else regimeAdjLabel = `${regime.regime} 環境：門檻不變`;
    }

    // 5. Classify each stock
    const candidates: ScreenCandidate[] = [];
    const excluded: ExcludedStock[] = [];
    const coverageSummary = { full: 0, limited: 0, insufficient: 0 };

    for (const fr of fusionResults) {
        coverageSummary[fr.dataCoverage]++;

        // Build analysis metadata
        const riskLevel = deriveRiskLevel(fr);
        const topFactors = fr.factors
            .filter(f => f.impact.startsWith('+'))
            .sort((a, b) => parseFloat(b.impact) - parseFloat(a.impact))
            .slice(0, 3)
            .map(f => `${f.name}: ${f.value} (${f.impact})`);
        const keyRisks = fr.factors
            .filter(f => f.impact.startsWith('-'))
            .sort((a, b) => parseFloat(a.impact) - parseFloat(b.impact))
            .slice(0, 2)
            .map(f => `${f.name}: ${f.value} (${f.impact})`);

        // Exclusion checks
        if (fr.alphaScore < effectiveMinAlpha) {
            excluded.push({ symbol: fr.symbol, name: fr.name, reason: `alphaScore ${fr.alphaScore} < 門檻 ${effectiveMinAlpha}` });
            continue;
        }
        if (fr.confidence < minConf) {
            excluded.push({ symbol: fr.symbol, name: fr.name, reason: `confidence ${fr.confidence} < 門檻 ${minConf}` });
            continue;
        }
        if (fr.recommendationBucket === 'Insufficient Data') {
            excluded.push({ symbol: fr.symbol, name: fr.name, reason: '資料不足（Insufficient Data）' });
            continue;
        }

        // Determine screen bucket
        let screenBucket: CandidateBucket;
        let whyIncluded: string;

        if (fr.alphaScore >= strongThreshold && fr.confidence >= 40 && fr.dataCoverage !== 'insufficient') {
            // Must have reasonable data to be Strong
            if (fr.missingSources.length >= 2) {
                screenBucket = 'Watch';
                whyIncluded = `分數達標(${fr.alphaScore})，但缺少 ${fr.missingSources.length} 項資料來源，降為觀察`;
            } else {
                screenBucket = 'Strong Candidate';
                whyIncluded = buildStrongReason(fr, regime.regime);
            }
        } else if (fr.alphaScore >= effectiveMinAlpha && fr.recommendationBucket !== 'Avoid') {
            screenBucket = 'Watch';
            whyIncluded = buildWatchReason(fr, regime.regime);
        } else if (fr.recommendationBucket === 'Avoid') {
            screenBucket = 'Excluded';
            excluded.push({ symbol: fr.symbol, name: fr.name, reason: `推薦等級為 Avoid (alpha ${fr.alphaScore})` });
            continue;
        } else {
            screenBucket = 'Neutral';
            whyIncluded = '分數中性，暫不列入積極觀察';
        }

        // Regime-specific downgrade rules
        if (respectMarketRegime && regime.regime === 'Bear' && screenBucket === 'Strong Candidate') {
            if (fr.confidence < 60) {
                screenBucket = 'Watch';
                whyIncluded = `空頭環境下信心度不足(${fr.confidence})，自 Strong 降為 Watch`;
            }
        }

        // Apply bucket filter if specified
        if (includeBuckets && !includeBuckets.includes(screenBucket)) {
            continue;
        }

        const summary = buildSummary(fr, screenBucket, regime.regime);

        candidates.push({
            symbol: fr.symbol,
            name: fr.name,
            closePrice: fr.closePrice,
            priceChangePercent: fr.priceChangePercent,
            isETF: fr.isETF,
            alphaScore: fr.alphaScore,
            recommendationBucket: fr.recommendationBucket,
            confidence: fr.confidence,
            technicalScore: fr.technicalScore,
            chipScore: fr.chipScore,
            fundamentalScore: fr.fundamentalScore,
            marketAdjustment: fr.marketAdjustment,
            riskLevel,
            screenBucket,
            whyIncluded,
            topFactors,
            keyRisks,
            dataCoverage: fr.dataCoverage,
            usedSources: fr.usedSources,
            missingSources: fr.missingSources,
            limitations: fr.limitations,
            summary,
        });
    }

    // Sort: Strong first, then Watch, then Neutral; within each bucket by alphaScore desc
    const bucketOrder: Record<CandidateBucket, number> = {
        'Strong Candidate': 0, 'Watch': 1, 'Neutral': 2, 'Excluded': 3,
    };
    candidates.sort((a, b) => {
        const bo = bucketOrder[a.screenBucket] - bucketOrder[b.screenBucket];
        if (bo !== 0) return bo;
        return b.alphaScore - a.alphaScore;
    });

    const trimmed = candidates.slice(0, maxResults);

    return {
        regime: regime.regime,
        regimeConfidence: regime.confidence,
        candidates: trimmed,
        excludedCount: excluded.length,
        excluded: excluded.slice(0, 20), // Cap excluded list
        totalScanned: fusionResults.length,
        dataCoverageSummary: coverageSummary,
        screenParams: {
            minAlphaScore: effectiveMinAlpha,
            minConfidence: minConf,
            respectMarketRegime,
            appliedRegimeAdjustment: regimeAdjLabel,
        },
        last_updated: fusionResults[0]?.last_updated || null,
        limitations: [
            ...limitations,
            ...regime.limitations,
            batchSymbols.length < symbols.length
                ? `僅分析前 ${batchSymbols.length} 檔（共 ${symbols.length} 檔符合資料門檻）`
                : '',
        ].filter(Boolean),
        disclaimer: '候選股篩選結果為研究參考，不構成投資建議。所有評分基於規則計算與公開資料，不保證未來績效。',
    };
}

// ─── Helpers ────────────────────────────────────────────────────

function emptyResult(
    regime: MarketRegimeResult,
    limitations: string[],
    extraLimitation: string,
): ScreenResult {
    return {
        regime: regime.regime,
        regimeConfidence: regime.confidence,
        candidates: [],
        excludedCount: 0,
        excluded: [],
        totalScanned: 0,
        dataCoverageSummary: { full: 0, limited: 0, insufficient: 0 },
        screenParams: {
            minAlphaScore: DEFAULT_MIN_ALPHA,
            minConfidence: DEFAULT_MIN_CONFIDENCE,
            respectMarketRegime: true,
            appliedRegimeAdjustment: '無',
        },
        last_updated: null,
        limitations: [...limitations, extraLimitation],
        disclaimer: '候選股篩選結果為研究參考，不構成投資建議。',
    };
}

function deriveRiskLevel(fr: FusionResult): string {
    if (fr.dataCoverage === 'insufficient') return 'Unknown';
    // High risk: high fundamental score variance or missing sources
    if (fr.missingSources.length >= 2) return 'High';
    if (fr.confidence < 30) return 'High';
    if (fr.confidence < 50) return 'Medium';
    return 'Low';
}

function buildStrongReason(fr: FusionResult, regime: MarketRegime): string {
    const parts: string[] = [`Alpha ${fr.alphaScore}`];
    if (fr.technicalScore >= 60) parts.push('技術面轉強');
    if (fr.chipScore >= 60) parts.push('籌碼面正向');
    if (fr.fundamentalScore >= 60) parts.push('基本面支撐');
    if (regime === 'Bull') parts.push('多頭環境加持');
    return parts.join('，');
}

function buildWatchReason(fr: FusionResult, regime: MarketRegime): string {
    const parts: string[] = [`Alpha ${fr.alphaScore}`];
    if (fr.confidence < 40) parts.push('信心度偏低');
    if (fr.missingSources.length > 0) parts.push(`缺少 ${fr.missingSources.join('、')}`);
    if (regime === 'Bear') parts.push('空頭環境壓抑');
    if (regime === 'Sideways') parts.push('盤整環境觀望');
    if (parts.length === 1) parts.push('分數尚可，列入觀察');
    return parts.join('，');
}

function buildSummary(fr: FusionResult, bucket: CandidateBucket, regime: MarketRegime): string {
    const regimeText = regime === 'Bull' ? '多頭' : regime === 'Bear' ? '空頭' : regime === 'Sideways' ? '盤整' : '不明';

    if (bucket === 'Strong Candidate') {
        return `綜合評分 ${fr.alphaScore} 分，技術/籌碼/基本面多面向表現良好。目前市場環境${regimeText}。`;
    }
    if (bucket === 'Watch') {
        const weak = fr.missingSources.length > 0 ? `缺少${fr.missingSources.join('、')}資料` : '部分指標偏弱';
        return `評分 ${fr.alphaScore} 分，${weak}。市場環境${regimeText}，建議持續觀察。`;
    }
    return `評分 ${fr.alphaScore} 分，指標表現中性。市場環境${regimeText}。`;
}
