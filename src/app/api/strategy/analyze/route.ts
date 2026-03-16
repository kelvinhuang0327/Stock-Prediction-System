import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';

/**
 * POST /api/strategy/analyze
 * 
 * 規則式個股分析 API — 基於 DB 真實資料，不使用 mock。
 * 所有分數依固定規則計算，每個因子均可追溯。
 * 資料不足時誠實降級，不硬湊結論。
 */
export async function POST(request: NextRequest) {
    try {
        const { symbol } = await request.json();
        if (!symbol) {
            return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
        }

        const cacheKey = `analyze:${symbol}`;
        const cached = apiCache.get<any>(cacheKey);
        if (cached) return NextResponse.json(cached);

        const result = await analyzeStock(symbol);
        apiCache.set(cacheKey, result, 180); // 3 min cache
        return NextResponse.json(result);
    } catch (error) {
        console.error('Analysis API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ─── Core Analysis ──────────────────────────────────────────────

interface AnalysisFactor {
    name: string;
    value: number | string;
    impact: 'positive' | 'negative' | 'neutral';
    note: string;
}

interface AnalysisResponse {
    // Backward-compatible fields (watchlist depends on these)
    stockId: string;
    name: string;
    closePrice: number;
    priceChangePercent: number;
    technicalScore: number;
    chipStrength: number;
    revenueYoY: number;
    eps: number;
    reason: string;
    riskScore: number;
    riskLevel: 'Low' | 'Medium' | 'High';
    isETF: boolean;
    // New structured scores
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
    dataCoverage: { quotes: number; chips: number; revenue: number };
    last_updated: string | null;
}

async function analyzeStock(symbol: string): Promise<AnalysisResponse> {
    // Fetch stock basic info
    const stock = await prisma.stock.findUnique({ where: { id: symbol } });
    const stockName = stock?.name || symbol;
    const isETF = symbol.length >= 4 && (symbol.startsWith('00') || symbol.startsWith('01'));

    // Fetch real data
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

    const factors: AnalysisFactor[] = [];
    const usedSources: string[] = [];
    const missingSources: string[] = [];
    const limitations: string[] = [];

    // ── Insufficient data shortcut ──
    if (quoteCount < 20) {
        return buildInsufficientResult(symbol, stockName, isETF, quoteCount, chipCount, revenueCount);
    }

    usedSources.push('StockQuote');

    // Latest quotes (ascending order already)
    const closes = quotes.map(q => q.close);
    const volumes = quotes.map(q => q.volume);
    const latestClose = closes[closes.length - 1];
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : latestClose;
    const priceChangePercent = prevClose > 0 ? ((latestClose - prevClose) / prevClose) * 100 : 0;

    const samplePeriod = `${quotes[0].date} ~ ${quotes[quotes.length - 1].date}`;
    const lastUpdated = quotes[quotes.length - 1].date;

    // ── Technical Score (0-100) ──
    let technicalScore = 50; // neutral baseline
    const techFactors = calculateTechnical(closes, quoteCount, factors);
    technicalScore = techFactors.score;

    if (quoteCount < 60) {
        limitations.push(`歷史資料僅 ${quoteCount} 天，技術分析為短期參考`);
    }

    // ── Momentum Score (0-100) ──
    const momentumScore = calculateMomentum(closes, volumes, quoteCount, factors);

    // ── Risk Score (0-100, higher = riskier) ──
    const riskResult = calculateRisk(closes, quoteCount, factors);

    // ── Chip Strength (0-100) ──
    let chipStrength = 50;
    if (chipCount >= 5) {
        usedSources.push('InstitutionalChip');
        chipStrength = calculateChipStrength(chips, factors);
    } else {
        missingSources.push('InstitutionalChip');
        limitations.push('法人籌碼資料不足，未納入籌碼面分析');
        chipStrength = 50; // neutral
    }

    // ── Revenue YoY ──
    let revenueYoY = 0;
    let eps = 0;
    if (revenueCount >= 13) {
        usedSources.push('MonthlyRevenue');
        const latest = revenues[0];
        const sameMonthLastYear = revenues.find(r => r.year === latest.year - 1 && r.month === latest.month);
        if (sameMonthLastYear && sameMonthLastYear.revenue > 0) {
            revenueYoY = ((latest.revenue - sameMonthLastYear.revenue) / sameMonthLastYear.revenue) * 100;
            factors.push({
                name: '營收年增率',
                value: r2(revenueYoY),
                impact: revenueYoY > 10 ? 'positive' : revenueYoY < -10 ? 'negative' : 'neutral',
                note: `${latest.year}/${latest.month} vs ${sameMonthLastYear.year}/${sameMonthLastYear.month}`,
            });
        }
    } else {
        if (revenueCount > 0) {
            missingSources.push('MonthlyRevenue（不足 13 個月，無法計算 YoY）');
        } else {
            missingSources.push('MonthlyRevenue');
        }
        limitations.push('營收資料不足，未納入基本面分析');
    }

    // ── Overall Score ──
    // Weighted: technical 40%, momentum 25%, chip 20%, revenue 15%
    const revenueScore = Math.min(100, Math.max(0, 50 + revenueYoY));
    const overallScore = Math.round(
        technicalScore * 0.4 +
        momentumScore * 0.25 +
        (chipCount >= 5 ? chipStrength * 0.2 : technicalScore * 0.2) + // fallback if no chip data
        (revenueCount >= 13 ? revenueScore * 0.15 : momentumScore * 0.15) // fallback if no revenue
    );

    // ── calculatedScore (backward-compatible with watchlist hook) ──
    const calculatedScore = isETF
        ? Math.round(Math.min(100, (chipStrength / 100 * 50) + (technicalScore / 100 * 50)))
        : Math.round(Math.min(100, (Math.min(revenueYoY, 50) / 30 * 40) + (chipStrength / 100 * 30) + (technicalScore / 100 * 30)));

    // ── Recommendation ──
    const recommendation = deriveRecommendation(overallScore, quoteCount, riskResult.riskLevel);

    // ── Summary ──
    const summary = buildSummary(technicalScore, momentumScore, riskResult.riskLevel, chipStrength, chipCount, revenueYoY, revenueCount, quoteCount, recommendation);

    // ── Reason (backward-compatible short version) ──
    const reason = buildReason(technicalScore, momentumScore, chipStrength, chipCount, revenueYoY, revenueCount);

    const result: AnalysisResponse = {
        stockId: symbol,
        name: stockName,
        closePrice: latestClose,
        priceChangePercent: r2(priceChangePercent),
        technicalScore,
        chipStrength,
        revenueYoY: r2(revenueYoY),
        eps,
        reason,
        riskScore: riskResult.riskScore,
        riskLevel: riskResult.riskLevel,
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
        dataCoverage: { quotes: quoteCount, chips: chipCount, revenue: revenueCount },
        last_updated: lastUpdated,
    };

    return result;
}

// ─── Technical Score Calculation ────────────────────────────────

function calculateTechnical(closes: number[], count: number, factors: AnalysisFactor[]): { score: number } {
    let score = 50;

    // MA20 trend
    if (count >= 20) {
        const ma20 = avg(closes.slice(-20));
        const latest = closes[closes.length - 1];
        const aboveMa20 = latest > ma20;
        score += aboveMa20 ? 10 : -10;
        factors.push({
            name: 'MA20 位置',
            value: aboveMa20 ? '高於均線' : '低於均線',
            impact: aboveMa20 ? 'positive' : 'negative',
            note: `收盤 ${r2(latest)} vs MA20 ${r2(ma20)}`,
        });
    }

    // MA60 trend
    if (count >= 60) {
        const ma60 = avg(closes.slice(-60));
        const latest = closes[closes.length - 1];
        const aboveMa60 = latest > ma60;
        score += aboveMa60 ? 10 : -10;
        factors.push({
            name: 'MA60 位置',
            value: aboveMa60 ? '高於均線' : '低於均線',
            impact: aboveMa60 ? 'positive' : 'negative',
            note: `收盤 ${r2(latest)} vs MA60 ${r2(ma60)}`,
        });

        // MA20 vs MA60 (golden/death cross proxy)
        const ma20 = avg(closes.slice(-20));
        if (ma20 > ma60) {
            score += 5;
            factors.push({ name: 'MA20/MA60', value: '多頭排列', impact: 'positive', note: `MA20(${r2(ma20)}) > MA60(${r2(ma60)})` });
        } else {
            score -= 5;
            factors.push({ name: 'MA20/MA60', value: '空頭排列', impact: 'negative', note: `MA20(${r2(ma20)}) < MA60(${r2(ma60)})` });
        }
    }

    // RSI(14)
    if (count >= 15) {
        const rsi = simpleRSI(closes, 14);
        let rsiImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
        if (rsi > 70) { score -= 5; rsiImpact = 'negative'; }
        else if (rsi < 30) { score += 5; rsiImpact = 'positive'; }
        else if (rsi > 50) { score += 3; rsiImpact = 'positive'; }
        else { score -= 3; rsiImpact = 'negative'; }
        factors.push({ name: 'RSI(14)', value: r2(rsi), impact: rsiImpact, note: rsi > 70 ? '超買區' : rsi < 30 ? '超賣區' : rsi > 50 ? '偏多' : '偏空' });
    }

    // MACD direction (simplified: EMA12 - EMA26)
    if (count >= 26) {
        const ema12 = ema(closes, 12);
        const ema26 = ema(closes, 26);
        const macdLine = ema12 - ema26;
        // Signal approximation: look at direction change
        const prevEma12 = ema(closes.slice(0, -1), 12);
        const prevEma26 = ema(closes.slice(0, -1), 26);
        const prevMacd = prevEma12 - prevEma26;
        const macdRising = macdLine > prevMacd;
        score += macdRising ? 5 : -5;
        factors.push({
            name: 'MACD 方向',
            value: macdRising ? '向上' : '向下',
            impact: macdRising ? 'positive' : 'negative',
            note: `MACD ${r2(macdLine)}（前日 ${r2(prevMacd)}）`,
        });
    }

    return { score: clamp(score, 0, 100) };
}

// ─── Momentum Score Calculation ─────────────────────────────────

function calculateMomentum(closes: number[], volumes: number[], count: number, factors: AnalysisFactor[]): number {
    let score = 50;

    // 5-day return
    if (count >= 6) {
        const ret5 = ((closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]) * 100;
        const impact5: 'positive' | 'negative' | 'neutral' = ret5 > 2 ? 'positive' : ret5 < -2 ? 'negative' : 'neutral';
        score += ret5 > 3 ? 10 : ret5 > 0 ? 5 : ret5 > -3 ? -5 : -10;
        factors.push({ name: '近 5 日報酬', value: `${r2(ret5)}%`, impact: impact5, note: `近 5 日漲跌幅` });
    }

    // 20-day return
    if (count >= 21) {
        const ret20 = ((closes[closes.length - 1] - closes[closes.length - 21]) / closes[closes.length - 21]) * 100;
        const impact20: 'positive' | 'negative' | 'neutral' = ret20 > 5 ? 'positive' : ret20 < -5 ? 'negative' : 'neutral';
        score += ret20 > 5 ? 10 : ret20 > 0 ? 3 : ret20 > -5 ? -3 : -10;
        factors.push({ name: '近 20 日報酬', value: `${r2(ret20)}%`, impact: impact20, note: `近一個月漲跌幅` });
    }

    // Volume trend (5-day avg vs 20-day avg)
    if (count >= 21) {
        const vol5 = avg(volumes.slice(-5));
        const vol20 = avg(volumes.slice(-20));
        const volRatio = vol20 > 0 ? (vol5 / vol20 - 1) * 100 : 0;
        const volImpact: 'positive' | 'negative' | 'neutral' = volRatio > 30 ? 'positive' : volRatio < -30 ? 'negative' : 'neutral';
        score += volRatio > 50 ? 5 : volRatio < -30 ? -5 : 0;
        factors.push({ name: '量能變化', value: `${r2(volRatio)}%`, impact: volImpact, note: `近 5 日均量 vs 20 日均量` });
    }

    return clamp(score, 0, 100);
}

// ─── Risk Calculation ───────────────────────────────────────────

function calculateRisk(closes: number[], count: number, factors: AnalysisFactor[]): { riskScore: number; riskLevel: 'Low' | 'Medium' | 'High' } {
    if (count < 10) return { riskScore: 50, riskLevel: 'Medium' };

    const recent = closes.slice(-Math.min(60, count));
    const mean = avg(recent);
    const variance = recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length;
    const stdDev = Math.sqrt(variance);
    const volatility = mean > 0 ? (stdDev / mean) * 100 : 0;

    // Max drawdown approximation over recent period
    let peak = recent[0];
    let maxDD = 0;
    for (const p of recent) {
        if (p > peak) peak = p;
        const dd = ((peak - p) / peak) * 100;
        if (dd > maxDD) maxDD = dd;
    }

    const riskScore = clamp(Math.round(volatility * 15 + maxDD * 2), 0, 100);
    const riskLevel: 'Low' | 'Medium' | 'High' = riskScore < 30 ? 'Low' : riskScore > 65 ? 'High' : 'Medium';

    factors.push({ name: '波動率', value: `${r2(volatility)}%`, impact: volatility > 4 ? 'negative' : 'neutral', note: `近 ${recent.length} 日收盤價標準差/均價` });
    factors.push({ name: '近期最大回撤', value: `${r2(maxDD)}%`, impact: maxDD > 10 ? 'negative' : 'neutral', note: `近 ${recent.length} 日最大回撤` });

    return { riskScore, riskLevel };
}

// ─── Chip Strength ──────────────────────────────────────────────

function calculateChipStrength(chips: any[], factors: AnalysisFactor[]): number {
    // chips are desc order (newest first)
    const recentChips = chips.slice(0, 10);
    const totalNetBuy = recentChips.reduce((sum: number, c: any) => sum + (c.totalBuy || 0), 0);
    const foreignNetBuy = recentChips.reduce((sum: number, c: any) => sum + (c.foreignBuy || 0), 0);
    const trustNetBuy = recentChips.reduce((sum: number, c: any) => sum + (c.trustBuy || 0), 0);

    // Normalize to 0-100 range (positive = buying, negative = selling)
    // Use a sigmoid-like mapping: totalNetBuy can be huge, so normalize
    const netBuyScore = 50 + clamp(Math.sign(totalNetBuy) * Math.min(Math.abs(totalNetBuy) / 1000, 30), -30, 30);

    const impact: 'positive' | 'negative' | 'neutral' = totalNetBuy > 500 ? 'positive' : totalNetBuy < -500 ? 'negative' : 'neutral';
    factors.push({
        name: '法人近 10 日買超',
        value: totalNetBuy.toLocaleString(),
        impact,
        note: `外資 ${foreignNetBuy.toLocaleString()} / 投信 ${trustNetBuy.toLocaleString()}`,
    });

    return clamp(Math.round(netBuyScore), 0, 100);
}

// ─── Recommendation ─────────────────────────────────────────────

function deriveRecommendation(
    overallScore: number,
    quoteCount: number,
    riskLevel: 'Low' | 'Medium' | 'High',
): '觀察' | '偏多' | '中性' | '偏空' | '資料不足' {
    if (quoteCount < 20) return '資料不足';
    if (overallScore >= 70) return '偏多';
    if (overallScore >= 45) return '中性';
    if (overallScore >= 30) return '偏空';
    return '觀察';
}

// ─── Summary Builder ────────────────────────────────────────────

function buildSummary(
    techScore: number, momScore: number, riskLevel: string,
    chipStr: number, chipCount: number,
    revYoY: number, revCount: number,
    quoteCount: number, recommendation: string,
): string {
    const parts: string[] = [];

    // Technical
    if (quoteCount >= 60) {
        parts.push(techScore >= 65 ? '技術面偏多，價格位於中長期均線之上' : techScore >= 45 ? '技術面中性' : '技術面偏弱，價格低於均線支撐');
    } else if (quoteCount >= 20) {
        parts.push(techScore >= 60 ? '短期技術面偏強' : '短期技術面偏弱');
        parts.push('長期趨勢資料有限');
    }

    // Momentum
    if (momScore >= 65) parts.push('近期動能轉強');
    else if (momScore <= 35) parts.push('近期動能偏弱');

    // Risk
    if (riskLevel === 'High') parts.push('波動偏高，注意風險');
    else if (riskLevel === 'Low') parts.push('近期波動穩定');

    // Chip
    if (chipCount >= 5) {
        if (chipStr >= 65) parts.push('法人偏多');
        else if (chipStr <= 35) parts.push('法人偏空');
    }

    // Revenue
    if (revCount >= 13) {
        if (revYoY > 20) parts.push(`營收年增 ${r2(revYoY)}%`);
        else if (revYoY < -10) parts.push(`營收年減 ${r2(Math.abs(revYoY))}%`);
    }

    return parts.length > 0 ? parts.join('。') + '。' : '目前資料有限，建議持續觀察。';
}

function buildReason(
    techScore: number, momScore: number,
    chipStr: number, chipCount: number,
    revYoY: number, revCount: number,
): string {
    const tags: string[] = [];
    if (techScore >= 65) tags.push('技術偏多');
    else if (techScore <= 35) tags.push('技術偏空');
    if (momScore >= 65) tags.push('動能轉強');
    else if (momScore <= 35) tags.push('動能走弱');
    if (chipCount >= 5 && chipStr >= 65) tags.push('法人買超');
    else if (chipCount >= 5 && chipStr <= 35) tags.push('法人賣超');
    if (revCount >= 13 && revYoY > 15) tags.push('營收成長');
    else if (revCount >= 13 && revYoY < -10) tags.push('營收衰退');
    return tags.length > 0 ? tags.join(' / ') : '資料觀察中';
}

// ─── Insufficient Data Response ─────────────────────────────────

function buildInsufficientResult(
    symbol: string, name: string, isETF: boolean,
    quotes: number, chips: number, revenue: number,
): AnalysisResponse {
    return {
        stockId: symbol,
        name,
        closePrice: 0,
        priceChangePercent: 0,
        technicalScore: 0,
        chipStrength: 0,
        revenueYoY: 0,
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
        dataCoverage: { quotes, chips, revenue },
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

function ema(data: number[], period: number): number {
    if (data.length === 0) return 0;
    const k = 2 / (period + 1);
    let value = data[0];
    for (let i = 1; i < data.length; i++) {
        value = data[i] * k + value * (1 - k);
    }
    return value;
}
