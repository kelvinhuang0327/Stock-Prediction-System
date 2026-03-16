/**
 * RuleBasedStockAnalyzer
 *
 * 規則式個股分析引擎。所有分數依固定規則計算，每個因子均可追溯。
 * 不依賴 AssetDoublingStrategy 或任何策略篩選模組。
 * 資料不足時誠實降級，永遠回傳完整 JSON（不回傳 null）。
 */

import { prisma } from '@/lib/prisma';

// ─── Public Types ───────────────────────────────────────────────

export interface AnalysisFactor {
    name: string;
    value: number | string;
    impact: 'positive' | 'negative' | 'neutral';
    note: string;
}

export interface StockAnalysisResult {
    // Backward-compatible fields (watchlist depends on these)
    stockId: string;
    name: string;
    closePrice: number;
    priceChangePercent: number;
    technicalScore: number;
    chipStrength: number;
    revenueYoY: number | null;
    eps: number;
    reason: string;
    riskScore: number;
    riskLevel: 'Low' | 'Medium' | 'High';
    isETF: boolean;
    // Structured scores
    momentumScore: number;
    overallScore: number;
    calculatedScore: number;
    recommendation: '觀察' | '偏多' | '中性' | '偏空' | '資料不足';
    summary: string;
    // Explainability
    factors: AnalysisFactor[];
    dataPoints: number;
    samplePeriod: string;
    usedSources: string[];
    missingSources: string[];
    limitations: string[];
    dataCoverage: 'full' | 'limited' | 'insufficient';
    last_updated: string | null;
}

// ─── Analyzer ───────────────────────────────────────────────────

export async function analyzeStock(symbol: string): Promise<StockAnalysisResult> {
    const stock = await prisma.stock.findUnique({ where: { id: symbol } });
    const stockName = stock?.name || symbol;
    const isETF = symbol.length >= 4 && (symbol.startsWith('00') || symbol.startsWith('01'));

    const [quotes, chips, revenues] = await Promise.all([
        prisma.stockQuote.findMany({
            where: { stockId: symbol },
            orderBy: { date: 'asc' },
            take: 500,
        }),
        prisma.institutionalChip.findMany({
            where: { stockId: symbol },
            orderBy: { date: 'desc' },
            take: 60,
        }),
        prisma.monthlyRevenue.findMany({
            where: { stockId: symbol },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            take: 24,
        }),
    ]);

    const quoteCount = quotes.length;
    const chipCount = chips.length;
    const revenueCount = revenues.length;

    // ── Insufficient data shortcut ──
    if (quoteCount < 20) {
        return buildInsufficientResult(symbol, stockName, isETF, quoteCount, chipCount, revenueCount);
    }

    const factors: AnalysisFactor[] = [];
    const usedSources: string[] = ['StockQuote'];
    const missingSources: string[] = [];
    const limitations: string[] = [];

    const closes = quotes.map(q => q.close);
    const volumes = quotes.map(q => q.volume);
    const latestClose = closes[closes.length - 1];
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : latestClose;
    const priceChangePercent = prevClose > 0 ? ((latestClose - prevClose) / prevClose) * 100 : 0;

    const samplePeriod = `${quotes[0].date} ~ ${quotes[quotes.length - 1].date}`;
    const lastUpdated = quotes[quotes.length - 1].date;

    // ── Technical Score (0-100) ──
    const technicalScore = calculateTechnical(closes, quoteCount, factors);
    if (quoteCount < 60) {
        limitations.push(`歷史資料僅 ${quoteCount} 天，技術分析為短期參考`);
    }

    // ── Momentum Score (0-100) ──
    const momentumScore = calculateMomentum(closes, volumes, quoteCount, factors);

    // ── Risk ──
    const { riskScore, riskLevel } = calculateRisk(closes, quoteCount, factors);

    // ── Chip Strength (0-100) ──
    let chipStrength = 0;
    if (chipCount >= 5) {
        usedSources.push('InstitutionalChip');
        chipStrength = calculateChipStrength(chips, factors);
    } else {
        missingSources.push('InstitutionalChip');
        limitations.push('法人籌碼資料不足，未納入籌碼面分析');
    }

    // ── Revenue YoY ──
    let revenueYoY: number | null = null;
    if (revenueCount >= 13) {
        usedSources.push('MonthlyRevenue');
        const latest = revenues[0];
        const sameMonthLastYear = revenues.find(r => r.year === latest.year - 1 && r.month === latest.month);
        if (sameMonthLastYear && sameMonthLastYear.revenue > 0) {
            revenueYoY = r2(((latest.revenue - sameMonthLastYear.revenue) / sameMonthLastYear.revenue) * 100);
            factors.push({
                name: '營收年增率',
                value: revenueYoY,
                impact: revenueYoY > 10 ? 'positive' : revenueYoY < -10 ? 'negative' : 'neutral',
                note: `${latest.year}/${latest.month} vs ${sameMonthLastYear.year}/${sameMonthLastYear.month}`,
            });
        }
    } else {
        missingSources.push(revenueCount > 0 ? 'MonthlyRevenue（不足 13 個月，無法計算 YoY）' : 'MonthlyRevenue');
        limitations.push('營收資料不足，未納入基本面分析');
    }

    // ── Overall Score ──
    const hasChip = chipCount >= 5;
    const hasRevenue = revenueYoY !== null;
    const revenueScore = hasRevenue ? clamp(50 + revenueYoY, 0, 100) : 0;

    let overallScore: number;
    if (isETF) {
        // ETF: 50% technical + 50% chip (or 100% technical if no chip)
        overallScore = hasChip
            ? Math.round(technicalScore * 0.5 + chipStrength * 0.5)
            : technicalScore;
    } else {
        // Stocks: 40% revenue + 30% chip + 30% technical (fallback if missing)
        const revWeight = hasRevenue ? 0.4 : 0;
        const chipWeight = hasChip ? 0.3 : 0;
        const techWeight = 0.3 + (hasRevenue ? 0 : 0.4) + (hasChip ? 0 : 0.3);
        overallScore = Math.round(
            revenueScore * revWeight +
            chipStrength * chipWeight +
            technicalScore * techWeight
        );
    }

    // ── calculatedScore (backward-compatible with watchlist hook) ──
    const calculatedScore = isETF
        ? Math.round(Math.min(100, (chipStrength / 100 * 50) + (technicalScore / 100 * 50)))
        : Math.round(Math.min(100,
            (Math.min(revenueYoY ?? 0, 50) / 30 * 40) +
            (chipStrength / 100 * 30) +
            (technicalScore / 100 * 30)
        ));

    // ── Recommendation ──
    const recommendation = deriveRecommendation(overallScore, quoteCount);

    // ── Summary & Reason ──
    const summary = buildSummary(technicalScore, momentumScore, riskLevel, chipStrength, chipCount, revenueYoY, revenueCount, quoteCount);
    const reason = buildReason(technicalScore, momentumScore, chipStrength, chipCount, revenueYoY, revenueCount);

    // ── Data Coverage ──
    const dataCoverage = quoteCount >= 60 && hasChip && hasRevenue ? 'full'
        : quoteCount >= 20 ? 'limited'
        : 'insufficient';

    return {
        stockId: symbol,
        name: stockName,
        closePrice: latestClose,
        priceChangePercent: r2(priceChangePercent),
        technicalScore,
        chipStrength,
        revenueYoY,
        eps: 0,
        reason,
        riskScore,
        riskLevel,
        isETF,
        momentumScore,
        overallScore,
        calculatedScore,
        recommendation,
        summary,
        factors,
        dataPoints: quoteCount,
        samplePeriod,
        usedSources,
        missingSources,
        limitations,
        dataCoverage,
        last_updated: lastUpdated,
    };
}

// ─── Technical Score ────────────────────────────────────────────
// Baseline 0, add points per factor. Clamp 0-100 at end.

function calculateTechnical(closes: number[], count: number, factors: AnalysisFactor[]): number {
    let score = 0;
    const latest = closes[closes.length - 1];

    // MA20 > MA60 → +20  /  MA20 < MA60 → -10
    if (count >= 60) {
        const ma20 = avg(closes.slice(-20));
        const ma60 = avg(closes.slice(-60));
        const bullish = ma20 > ma60;
        score += bullish ? 20 : -10;
        factors.push({
            name: 'MA 趨勢',
            value: bullish ? '多頭排列' : '空頭排列',
            impact: bullish ? 'positive' : 'negative',
            note: `MA20(${r2(ma20)}) ${bullish ? '>' : '<'} MA60(${r2(ma60)})`,
        });
    } else if (count >= 20) {
        // Only MA20 available
        const ma20 = avg(closes.slice(-20));
        const above = latest > ma20;
        score += above ? 10 : -5;
        factors.push({
            name: 'MA20 位置',
            value: above ? '高於均線' : '低於均線',
            impact: above ? 'positive' : 'negative',
            note: `收盤 ${r2(latest)} vs MA20 ${r2(ma20)}（無 MA60 資料）`,
        });
    }

    // RSI(14)：40-60 → +20 / >70 → -10 / <30 → +10 / else → 0
    if (count >= 15) {
        const rsi = simpleRSI(closes, 14);
        if (rsi >= 40 && rsi <= 60) { score += 20; }
        else if (rsi > 70) { score -= 10; }
        else if (rsi < 30) { score += 10; }
        const impact: 'positive' | 'negative' | 'neutral' =
            (rsi >= 40 && rsi <= 60) ? 'positive' : rsi > 70 ? 'negative' : rsi < 30 ? 'positive' : 'neutral';
        factors.push({
            name: 'RSI(14)',
            value: r2(rsi),
            impact,
            note: rsi > 70 ? '超買區，短期過熱' : rsi < 30 ? '超賣區，可能反彈' : rsi >= 40 && rsi <= 60 ? '中性健康區間' : '偏離中性',
        });
    }

    // MACD positive → +20 / negative → -10
    if (count >= 26) {
        const ema12 = calcEma(closes, 12);
        const ema26 = calcEma(closes, 26);
        const macdLine = ema12 - ema26;
        const positive = macdLine > 0;
        score += positive ? 20 : -10;
        factors.push({
            name: 'MACD',
            value: r2(macdLine),
            impact: positive ? 'positive' : 'negative',
            note: positive ? 'MACD > 0，多方動能' : 'MACD < 0，空方動能',
        });
    }

    // 20-day return > 0 → +20 / < 0 → -10
    if (count >= 21) {
        const ret20 = ((latest - closes[closes.length - 21]) / closes[closes.length - 21]) * 100;
        const positive = ret20 > 0;
        score += positive ? 20 : -10;
        factors.push({
            name: '近 20 日動能',
            value: `${r2(ret20)}%`,
            impact: positive ? 'positive' : 'negative',
            note: `近 20 日漲跌幅 ${positive ? '正' : '負'}`,
        });
    }

    // Max possible: 20 + 20 + 20 + 20 = 80; baseline adjustment → map to 0-100
    // Score range roughly -40 to +80. Normalize: (score + 40) / 120 * 100
    return clamp(Math.round((score + 40) / 120 * 100), 0, 100);
}

// ─── Momentum Score ─────────────────────────────────────────────

function calculateMomentum(closes: number[], volumes: number[], count: number, factors: AnalysisFactor[]): number {
    let score = 50;

    if (count >= 6) {
        const ret5 = ((closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]) * 100;
        score += ret5 > 3 ? 10 : ret5 > 0 ? 5 : ret5 > -3 ? -5 : -10;
        factors.push({
            name: '近 5 日報酬',
            value: `${r2(ret5)}%`,
            impact: ret5 > 2 ? 'positive' : ret5 < -2 ? 'negative' : 'neutral',
            note: '近 5 日漲跌幅',
        });
    }

    if (count >= 21) {
        const ret20 = ((closes[closes.length - 1] - closes[closes.length - 21]) / closes[closes.length - 21]) * 100;
        score += ret20 > 5 ? 10 : ret20 > 0 ? 3 : ret20 > -5 ? -3 : -10;
        factors.push({
            name: '近 20 日報酬',
            value: `${r2(ret20)}%`,
            impact: ret20 > 5 ? 'positive' : ret20 < -5 ? 'negative' : 'neutral',
            note: '近一個月漲跌幅',
        });
    }

    if (count >= 21) {
        const vol5 = avg(volumes.slice(-5));
        const vol20 = avg(volumes.slice(-20));
        const volRatio = vol20 > 0 ? (vol5 / vol20 - 1) * 100 : 0;
        score += volRatio > 50 ? 5 : volRatio < -30 ? -5 : 0;
        factors.push({
            name: '量能變化',
            value: `${r2(volRatio)}%`,
            impact: volRatio > 30 ? 'positive' : volRatio < -30 ? 'negative' : 'neutral',
            note: '近 5 日均量 vs 20 日均量',
        });
    }

    return clamp(score, 0, 100);
}

// ─── Risk ───────────────────────────────────────────────────────

function calculateRisk(
    closes: number[], count: number, factors: AnalysisFactor[],
): { riskScore: number; riskLevel: 'Low' | 'Medium' | 'High' } {
    if (count < 10) return { riskScore: 50, riskLevel: 'Medium' };

    const recent = closes.slice(-Math.min(60, count));
    const mean = avg(recent);
    const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length;
    const volatility = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : 0;

    let peak = recent[0];
    let maxDD = 0;
    for (const p of recent) {
        if (p > peak) peak = p;
        const dd = ((peak - p) / peak) * 100;
        if (dd > maxDD) maxDD = dd;
    }

    const riskScore = clamp(Math.round(volatility * 15 + maxDD * 2), 0, 100);
    const riskLevel: 'Low' | 'Medium' | 'High' = riskScore < 30 ? 'Low' : riskScore > 65 ? 'High' : 'Medium';

    factors.push({
        name: '波動率',
        value: `${r2(volatility)}%`,
        impact: volatility > 4 ? 'negative' : 'neutral',
        note: `近 ${recent.length} 日收盤價標準差/均價`,
    });
    factors.push({
        name: '近期最大回撤',
        value: `${r2(maxDD)}%`,
        impact: maxDD > 10 ? 'negative' : 'neutral',
        note: `近 ${recent.length} 日最大回撤`,
    });

    return { riskScore, riskLevel };
}

// ─── Chip Strength ──────────────────────────────────────────────

function calculateChipStrength(chips: any[], factors: AnalysisFactor[]): number {
    const recentChips = chips.slice(0, 10);
    const totalNetBuy = recentChips.reduce((s: number, c: any) => s + (c.totalBuy || 0), 0);
    const foreignNetBuy = recentChips.reduce((s: number, c: any) => s + (c.foreignBuy || 0), 0);
    const trustNetBuy = recentChips.reduce((s: number, c: any) => s + (c.trustBuy || 0), 0);

    const netBuyScore = 50 + clamp(Math.sign(totalNetBuy) * Math.min(Math.abs(totalNetBuy) / 1000, 30), -30, 30);

    factors.push({
        name: '法人近 10 日買超',
        value: totalNetBuy.toLocaleString(),
        impact: totalNetBuy > 500 ? 'positive' : totalNetBuy < -500 ? 'negative' : 'neutral',
        note: `外資 ${foreignNetBuy.toLocaleString()} / 投信 ${trustNetBuy.toLocaleString()}`,
    });

    return clamp(Math.round(netBuyScore), 0, 100);
}

// ─── Recommendation ─────────────────────────────────────────────

function deriveRecommendation(
    overallScore: number, quoteCount: number,
): '觀察' | '偏多' | '中性' | '偏空' | '資料不足' {
    if (quoteCount < 20) return '資料不足';
    if (overallScore >= 70) return '偏多';
    if (overallScore >= 50) return '中性';
    if (overallScore >= 30) return '偏空';
    return '觀察';
}

// ─── Summary ────────────────────────────────────────────────────

function buildSummary(
    techScore: number, momScore: number, riskLevel: string,
    chipStr: number, chipCount: number,
    revYoY: number | null, revCount: number, quoteCount: number,
): string {
    const parts: string[] = [];

    if (quoteCount >= 60) {
        parts.push(techScore >= 65 ? '價格位於中長期均線之上，技術面偏多' : techScore >= 45 ? '技術面中性' : '價格低於均線支撐，技術面偏弱');
    } else if (quoteCount >= 20) {
        parts.push(techScore >= 60 ? '短期技術面偏強' : '短期技術面偏弱');
        parts.push('長期趨勢資料有限');
    }

    if (momScore >= 65) parts.push('近期動能轉強');
    else if (momScore <= 35) parts.push('近期動能偏弱');

    if (riskLevel === 'High') parts.push('波動偏高，注意風險');
    else if (riskLevel === 'Low') parts.push('近期波動穩定');

    if (chipCount >= 5) {
        if (chipStr >= 65) parts.push('法人偏多');
        else if (chipStr <= 35) parts.push('法人偏空');
    } else {
        parts.push('籌碼資料不足');
    }

    if (revYoY !== null) {
        if (revYoY > 20) parts.push(`營收年增 ${r2(revYoY)}%`);
        else if (revYoY < -10) parts.push(`營收年減 ${r2(Math.abs(revYoY))}%`);
    }

    return parts.length > 0 ? parts.join('。') + '。' : '目前資料有限，建議持續觀察。';
}

function buildReason(
    techScore: number, momScore: number,
    chipStr: number, chipCount: number,
    revYoY: number | null, revCount: number,
): string {
    const tags: string[] = [];
    if (techScore >= 65) tags.push('技術偏多');
    else if (techScore <= 35) tags.push('技術偏空');
    if (momScore >= 65) tags.push('動能轉強');
    else if (momScore <= 35) tags.push('動能走弱');
    if (chipCount >= 5 && chipStr >= 65) tags.push('法人買超');
    else if (chipCount >= 5 && chipStr <= 35) tags.push('法人賣超');
    if (revYoY !== null && revYoY > 15) tags.push('營收成長');
    else if (revYoY !== null && revYoY < -10) tags.push('營收衰退');
    return tags.length > 0 ? tags.join(' / ') : '資料觀察中';
}

// ─── Insufficient Data ─────────────────────────────────────────

function buildInsufficientResult(
    symbol: string, name: string, isETF: boolean,
    quotes: number, chips: number, revenue: number,
): StockAnalysisResult {
    return {
        stockId: symbol,
        name,
        closePrice: 0,
        priceChangePercent: 0,
        technicalScore: 0,
        chipStrength: 0,
        revenueYoY: null,
        eps: 0,
        reason: '歷史資料不足，無法分析',
        riskScore: 0,
        riskLevel: 'Medium',
        isETF,
        momentumScore: 0,
        overallScore: 0,
        calculatedScore: 0,
        recommendation: '資料不足',
        summary: `${symbol} 僅有 ${quotes} 天歷史行情資料，需至少 20 天才能進行基本技術分析。`,
        factors: [],
        dataPoints: quotes,
        samplePeriod: '',
        usedSources: [],
        missingSources: ['StockQuote（不足 20 天）'],
        limitations: [`歷史資料僅 ${quotes} 天，無法進行任何技術分析`],
        dataCoverage: 'insufficient',
        last_updated: null,
    };
}

// ─── Math Helpers ───────────────────────────────────────────────

function r2(n: number): number { return Math.round(n * 100) / 100; }
function avg(arr: number[]): number { return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }

function simpleRSI(closes: number[], period: number): number {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
    }
    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return r2(100 - 100 / (1 + rs));
}

function calcEma(data: number[], period: number): number {
    if (data.length === 0) return 0;
    const k = 2 / (period + 1);
    let value = data[0];
    for (let i = 1; i < data.length; i++) {
        value = data[i] * k + value * (1 - k);
    }
    return value;
}
