/**
 * SignalFusionEngine
 *
 * 候選股綜合評分引擎。整合技術面、籌碼面、基本面-lite、市場環境四大維度，
 * 產出可解釋、可降級、可排序的 AlphaScore。
 *
 * AlphaScore 是候選評分（研究工具），不是交易指令。
 * 所有子分數均可追溯到規則與資料來源。
 */

import { analyzeStock, StockAnalysisResult } from '@/lib/analysis/RuleBasedStockAnalyzer';
import { detectRegime, MarketRegimeResult, MarketRegime } from '@/lib/market/MarketRegimeEngine';

// ─── Public Types ───────────────────────────────────────────────

export type RecommendationBucket =
    | 'Strong Candidate'
    | 'Watch'
    | 'Neutral'
    | 'Avoid'
    | 'Insufficient Data';

export interface FusionFactor {
    name: string;
    value: string | number;
    impact: string; // e.g. "+18", "-5", "0"
    category: 'technical' | 'chip' | 'fundamental' | 'market';
}

export interface FusionResult {
    symbol: string;
    name: string;
    closePrice: number;
    priceChangePercent: number;
    isETF: boolean;
    // Composite
    alphaScore: number; // 0-100
    recommendationBucket: RecommendationBucket;
    confidence: number; // 0-100
    // Sub-scores (each 0-100)
    technicalScore: number;
    chipScore: number;
    fundamentalScore: number;
    marketAdjustment: number; // signed, ±10 range
    // Weights used (after normalization)
    weights: {
        technical: number;
        chip: number;
        fundamental: number;
        market: number;
    };
    // Regime context
    marketRegime: MarketRegime;
    marketRegimeConfidence: number;
    // Explainability
    factors: FusionFactor[];
    usedSources: string[];
    missingSources: string[];
    limitations: string[];
    dataCoverage: 'full' | 'limited' | 'insufficient';
    last_updated: string | null;
}

// ─── Weights ────────────────────────────────────────────────────

interface WeightConfig {
    technical: number;
    chip: number;
    fundamental: number;
    market: number;
}

const STOCK_WEIGHTS: WeightConfig = {
    technical: 0.35,
    chip: 0.25,
    fundamental: 0.25,
    market: 0.15,
};

const ETF_WEIGHTS: WeightConfig = {
    technical: 0.50,
    chip: 0.25,
    fundamental: 0, // ETFs don't use revenue
    market: 0.25,
};

// ─── Market Adjustment ──────────────────────────────────────────

function computeMarketAdjustment(
    regime: MarketRegime,
    regimeConfidence: number,
    techScore: number,
): { score: number; factors: FusionFactor[] } {
    const factors: FusionFactor[] = [];

    // Scale adjustment by regime confidence (0-100 → 0-1)
    const scale = Math.min(regimeConfidence, 100) / 100;

    let rawAdj = 0;
    switch (regime) {
        case 'Bull':
            // Trend signals get a small boost
            rawAdj = techScore >= 50 ? 8 : 4;
            break;
        case 'Bear':
            // Bullish signals get dampened
            rawAdj = techScore >= 50 ? -6 : -3;
            break;
        case 'Sideways':
            // Reduce confidence in breakout signals
            rawAdj = techScore >= 70 ? -4 : techScore <= 30 ? 2 : 0;
            break;
        case 'Unknown':
        default:
            rawAdj = 0;
            break;
    }

    const adj = Math.round(rawAdj * scale);

    factors.push({
        name: 'Market Regime',
        value: regime,
        impact: adj >= 0 ? `+${adj}` : `${adj}`,
        category: 'market',
    });

    if (regime !== 'Unknown' && Math.abs(adj) > 0) {
        factors.push({
            name: 'Regime Confidence',
            value: regimeConfidence,
            impact: scale < 0.5 ? '低信心，調整幅度縮減' : '0',
            category: 'market',
        });
    }

    return { score: adj, factors };
}

// ─── Fundamental Score ──────────────────────────────────────────

function computeFundamentalScore(
    revenueYoY: number | null,
    factors: FusionFactor[],
): { score: number; available: boolean } {
    if (revenueYoY === null) {
        return { score: 0, available: false };
    }

    // Map revenue YoY to 0-100 score
    // -30% → ~20, 0% → 50, +30% → ~80, +50%+ → 90+
    const score = Math.round(Math.max(0, Math.min(100, 50 + revenueYoY * 1.2)));

    factors.push({
        name: 'Revenue YoY',
        value: `${revenueYoY > 0 ? '+' : ''}${revenueYoY.toFixed(1)}%`,
        impact: `${score}`,
        category: 'fundamental',
    });

    return { score, available: true };
}

// ─── Confidence ─────────────────────────────────────────────────

function computeConfidence(
    dataPoints: number,
    hasChip: boolean,
    hasRevenue: boolean,
    regimeAvailable: boolean,
    isETF: boolean,
): number {
    let conf = 0;

    // Data length (max 40 pts)
    if (dataPoints >= 200) conf += 40;
    else if (dataPoints >= 60) conf += 30;
    else if (dataPoints >= 20) conf += 15;

    // Chip coverage (max 20 pts)
    if (hasChip) conf += 20;

    // Fundamental coverage (max 20 pts, skip for ETF)
    if (isETF) {
        conf += 20; // ETFs don't need revenue
    } else if (hasRevenue) {
        conf += 20;
    }

    // Market regime (max 20 pts)
    if (regimeAvailable) conf += 20;
    else conf += 5; // partial credit even without regime

    return Math.min(100, conf);
}

// ─── Normalize Weights ──────────────────────────────────────────

function normalizeWeights(
    base: WeightConfig,
    hasChip: boolean,
    hasFundamental: boolean,
): WeightConfig {
    const w = { ...base };

    if (!hasChip) w.chip = 0;
    if (!hasFundamental) w.fundamental = 0;

    const total = w.technical + w.chip + w.fundamental + w.market;
    if (total === 0) return { technical: 1, chip: 0, fundamental: 0, market: 0 };

    return {
        technical: w.technical / total,
        chip: w.chip / total,
        fundamental: w.fundamental / total,
        market: w.market / total,
    };
}

// ─── Main: fuse single stock ────────────────────────────────────

export async function fuseSignals(
    symbol: string,
    regimeOverride?: MarketRegimeResult | null,
): Promise<FusionResult> {
    // 1. Get stock analysis from RuleBasedStockAnalyzer
    const analysis = await analyzeStock(symbol);

    // 2. Get market regime (use override if provided, for batch efficiency)
    let regime: MarketRegimeResult;
    if (regimeOverride !== undefined && regimeOverride !== null) {
        regime = regimeOverride;
    } else {
        try {
            regime = await detectRegime();
        } catch {
            regime = {
                regime: 'Unknown', confidence: 0, factors: [],
                dataCoverage: 'insufficient', samplePeriod: 'N/A',
                dataPoints: 0, last_updated: null,
                limitations: ['市場環境分析不可用'],
            };
        }
    }

    // 3. Compute sub-scores
    const factors: FusionFactor[] = [];
    const limitations = [...analysis.limitations];
    const usedSources = [...analysis.usedSources];
    const missingSources = [...analysis.missingSources];

    // Technical: use combined tech + momentum from analyzer (avg)
    const techScore = Math.round((analysis.technicalScore + analysis.momentumScore) / 2);
    factors.push({
        name: 'Technical Score',
        value: analysis.technicalScore,
        impact: `${analysis.technicalScore}`,
        category: 'technical',
    });
    factors.push({
        name: 'Momentum Score',
        value: analysis.momentumScore,
        impact: `${analysis.momentumScore}`,
        category: 'technical',
    });

    // Chip
    const chipScore = analysis.chipStrength;
    const hasChip = chipScore > 0 || analysis.usedSources.includes('InstitutionalChip');
    if (hasChip) {
        factors.push({
            name: 'Chip Strength',
            value: chipScore,
            impact: `${chipScore}`,
            category: 'chip',
        });
    }

    // Fundamental
    const fundResult = computeFundamentalScore(analysis.revenueYoY, factors);

    // Market adjustment
    const mktAdj = computeMarketAdjustment(
        regime.regime,
        regime.confidence,
        techScore,
    );
    factors.push(...mktAdj.factors);

    if (regime.regime !== 'Unknown') {
        usedSources.push('MarketRegime');
    } else {
        missingSources.push('MarketRegime（資料不足）');
        limitations.push('市場環境不可用，未納入市場調整');
    }

    // 4. Normalize weights
    const baseWeights = analysis.isETF ? ETF_WEIGHTS : STOCK_WEIGHTS;
    const weights = normalizeWeights(
        baseWeights,
        hasChip,
        fundResult.available && !analysis.isETF,
    );

    // 5. Compute alphaScore
    // Market adjustment is additive (±10), not weighted
    const baseScore =
        techScore * weights.technical +
        chipScore * weights.chip +
        fundResult.score * weights.fundamental;

    // Market weight portion: use a 50-centered base score adjusted by mktAdj
    const marketBaseScore = 50 + mktAdj.score;
    const weightedScore = baseScore + marketBaseScore * weights.market;

    const alphaScore = Math.round(Math.max(0, Math.min(100, weightedScore)));

    // 6. Recommendation bucket
    let recommendationBucket: RecommendationBucket;
    if (analysis.dataPoints < 20) {
        recommendationBucket = 'Insufficient Data';
    } else if (alphaScore >= 75) {
        recommendationBucket = 'Strong Candidate';
    } else if (alphaScore >= 55) {
        recommendationBucket = 'Watch';
    } else if (alphaScore >= 35) {
        recommendationBucket = 'Neutral';
    } else {
        recommendationBucket = 'Avoid';
    }

    // 7. Confidence
    const confidence = computeConfidence(
        analysis.dataPoints,
        hasChip,
        fundResult.available,
        regime.regime !== 'Unknown',
        analysis.isETF,
    );

    // 8. Data coverage
    const dataCoverage = analysis.dataCoverage;

    // Transfer relevant analysis factors with category tagging
    for (const af of analysis.factors) {
        const category = af.name.includes('法人') || af.name.includes('籌碼')
            ? 'chip' as const
            : af.name.includes('營收')
                ? 'fundamental' as const
                : 'technical' as const;
        factors.push({
            name: af.name,
            value: typeof af.value === 'number' ? af.value : String(af.value),
            impact: af.impact === 'positive' ? '+' : af.impact === 'negative' ? '-' : '0',
            category,
        });
    }

    return {
        symbol,
        name: analysis.name,
        closePrice: analysis.closePrice,
        priceChangePercent: analysis.priceChangePercent,
        isETF: analysis.isETF,
        alphaScore,
        recommendationBucket,
        confidence,
        technicalScore: techScore,
        chipScore,
        fundamentalScore: fundResult.score,
        marketAdjustment: mktAdj.score,
        weights,
        marketRegime: regime.regime,
        marketRegimeConfidence: regime.confidence,
        factors,
        usedSources: [...new Set(usedSources)],
        missingSources: [...new Set(missingSources)],
        limitations: [...new Set(limitations)],
        dataCoverage,
        last_updated: analysis.last_updated,
    };
}

// ─── Batch fusion (shares regime call) ──────────────────────────

export async function fuseBatch(
    symbols: string[],
): Promise<FusionResult[]> {
    // Single regime call shared across all stocks
    let regime: MarketRegimeResult;
    try {
        regime = await detectRegime();
    } catch {
        regime = {
            regime: 'Unknown', confidence: 0, factors: [],
            dataCoverage: 'insufficient', samplePeriod: 'N/A',
            dataPoints: 0, last_updated: null,
            limitations: ['市場環境分析不可用'],
        };
    }

    const results = await Promise.all(
        symbols.map(s => fuseSignals(s, regime)),
    );

    return results;
}
