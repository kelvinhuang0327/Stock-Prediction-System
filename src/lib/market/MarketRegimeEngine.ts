/**
 * MarketRegimeEngine
 *
 * 可解釋、可降級的市場環境判斷引擎。
 * 基於 TAIEX 指數的趨勢、動能與波動率，判斷當前屬於 Bull / Bear / Sideways。
 * 資料不足時誠實降級為 Unknown，所有因子均可追溯。
 */

import { prisma } from '@/lib/prisma';

// ─── Public Types ───────────────────────────────────────────────

export type MarketRegime = 'Bull' | 'Bear' | 'Sideways' | 'Unknown';

export interface RegimeFactor {
    name: string;
    value: number | string | boolean;
    impact: 'bullish' | 'bearish' | 'neutral';
    note: string;
}

export interface MarketRegimeResult {
    regime: MarketRegime;
    confidence: number; // 0-100
    factors: RegimeFactor[];
    dataCoverage: 'full' | 'limited' | 'insufficient';
    samplePeriod: string;
    dataPoints: number;
    last_updated: string | null;
    limitations: string[];
}

// ─── Helpers ────────────────────────────────────────────────────

function sma(values: number[], period: number): number | null {
    if (values.length < period) return null;
    const slice = values.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function stddev(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const sqDiffs = values.map(v => (v - avg) ** 2);
    return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
}

function dailyReturns(prices: number[]): number[] {
    const ret: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        ret.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return ret;
}

// ─── Engine ─────────────────────────────────────────────────────

/**
 * P0-04: asOf param added. When provided, MarketIndex query is gated with
 * date <= asOf so future-dated rows are excluded.
 * Regime judgment logic (thresholds, weights, scoring) is NOT modified.
 */
export async function detectRegime(asOf?: string): Promise<MarketRegimeResult> {
    const rows = await prisma.marketIndex.findMany({
        where: {
            name: 'TAIEX',
            ...(asOf ? { date: { lte: asOf } } : {}),
        },
        orderBy: { date: 'asc' },
        select: { date: true, value: true },
    });

    const dataPoints = rows.length;
    const lastDate = rows.length > 0 ? rows[rows.length - 1].date : null;
    const firstDate = rows.length > 0 ? rows[0].date : null;
    const samplePeriod = firstDate && lastDate ? `${firstDate} ~ ${lastDate}` : 'N/A';

    // ── Insufficient data ──
    if (dataPoints < 50) {
        return {
            regime: 'Unknown',
            confidence: 0,
            factors: [],
            dataCoverage: 'insufficient',
            samplePeriod,
            dataPoints,
            last_updated: lastDate,
            limitations: [
                `MarketIndex 歷史僅 ${dataPoints} 天，不足 50 天最低門檻`,
                '無法計算 MA50，無法判斷市場環境',
            ],
        };
    }

    const prices = rows.map(r => r.value);
    const currentPrice = prices[prices.length - 1];

    const limitations: string[] = [];
    const factors: RegimeFactor[] = [];

    // ── MA calculations ──
    const ma50 = sma(prices, 50)!; // guaranteed by dataPoints >= 50
    const ma200 = sma(prices, 200);
    const canComputeMA200 = ma200 !== null;

    if (!canComputeMA200) {
        limitations.push(`MarketIndex 歷史 ${dataPoints} 天，不足 200 天，無法計算 MA200`);
    }

    // ── Factor: Price vs MA50 ──
    const aboveMA50 = currentPrice > ma50;
    factors.push({
        name: 'aboveMA50',
        value: aboveMA50,
        impact: aboveMA50 ? 'bullish' : 'bearish',
        note: `指數 ${currentPrice.toFixed(0)} ${aboveMA50 ? '>' : '<'} MA50 ${ma50.toFixed(0)}`,
    });

    // ── Factor: Price vs MA200 ──
    if (canComputeMA200) {
        const aboveMA200 = currentPrice > ma200!;
        factors.push({
            name: 'aboveMA200',
            value: aboveMA200,
            impact: aboveMA200 ? 'bullish' : 'bearish',
            note: `指數 ${currentPrice.toFixed(0)} ${aboveMA200 ? '>' : '<'} MA200 ${ma200!.toFixed(0)}`,
        });
    }

    // ── Factor: MA50 vs MA200 (Golden/Death Cross trend) ──
    if (canComputeMA200) {
        const ma50AboveMA200 = ma50 > ma200!;
        factors.push({
            name: 'ma50VsMa200',
            value: ma50AboveMA200 ? 'Golden' : 'Death',
            impact: ma50AboveMA200 ? 'bullish' : 'bearish',
            note: `MA50 ${ma50.toFixed(0)} ${ma50AboveMA200 ? '>' : '<'} MA200 ${ma200!.toFixed(0)}`,
        });
    }

    // ── Factor: 20-day momentum ──
    const ret20 = prices.length >= 21
        ? ((currentPrice - prices[prices.length - 21]) / prices[prices.length - 21]) * 100
        : null;
    if (ret20 !== null) {
        factors.push({
            name: 'momentum20d',
            value: Math.round(ret20 * 100) / 100,
            impact: ret20 > 2 ? 'bullish' : ret20 < -2 ? 'bearish' : 'neutral',
            note: `近 20 日報酬 ${ret20 > 0 ? '+' : ''}${ret20.toFixed(2)}%`,
        });
    }

    // ── Factor: 60-day momentum ──
    const ret60 = prices.length >= 61
        ? ((currentPrice - prices[prices.length - 61]) / prices[prices.length - 61]) * 100
        : null;
    if (ret60 !== null) {
        factors.push({
            name: 'momentum60d',
            value: Math.round(ret60 * 100) / 100,
            impact: ret60 > 5 ? 'bullish' : ret60 < -5 ? 'bearish' : 'neutral',
            note: `近 60 日報酬 ${ret60 > 0 ? '+' : ''}${ret60.toFixed(2)}%`,
        });
    }

    // ── Factor: Volatility (20-day annualized) ──
    const recent20 = prices.slice(-21);
    const returns20d = dailyReturns(recent20);
    const vol20 = returns20d.length > 0 ? stddev(returns20d) * Math.sqrt(252) * 100 : null;
    if (vol20 !== null) {
        const volLevel = vol20 > 30 ? 'high' : vol20 > 15 ? 'medium' : 'low';
        factors.push({
            name: 'volatility20d',
            value: Math.round(vol20 * 100) / 100,
            impact: volLevel === 'high' ? 'bearish' : 'neutral',
            note: `20 日年化波動率 ${vol20.toFixed(1)}%（${volLevel === 'high' ? '偏高' : volLevel === 'medium' ? '中等' : '偏低'}）`,
        });
    }

    // ── Scoring ──
    let bullScore = 0;
    let bearScore = 0;
    let maxScore = 0;

    // Price > MA50 (weight 2)
    if (aboveMA50) bullScore += 2; else bearScore += 2;
    maxScore += 2;

    // Price > MA200 (weight 3)
    if (canComputeMA200) {
        if (currentPrice > ma200!) bullScore += 3; else bearScore += 3;
        maxScore += 3;
    }

    // MA50 > MA200 (weight 2)
    if (canComputeMA200) {
        if (ma50 > ma200!) bullScore += 2; else bearScore += 2;
        maxScore += 2;
    }

    // 20d momentum (weight 2)
    if (ret20 !== null) {
        if (ret20 > 2) bullScore += 2;
        else if (ret20 < -2) bearScore += 2;
        else { bullScore += 1; bearScore += 1; }
        maxScore += 2;
    }

    // 60d momentum (weight 2)
    if (ret60 !== null) {
        if (ret60 > 5) bullScore += 2;
        else if (ret60 < -5) bearScore += 2;
        else { bullScore += 1; bearScore += 1; }
        maxScore += 2;
    }

    // High volatility reduces bull conviction (weight 1)
    if (vol20 !== null && vol20 > 30) {
        bearScore += 1;
        maxScore += 1;
    }

    // ── Regime determination ──
    let regime: MarketRegime;
    let confidence: number;

    const bullRatio = maxScore > 0 ? bullScore / maxScore : 0;
    const bearRatio = maxScore > 0 ? bearScore / maxScore : 0;

    if (bullRatio >= 0.7) {
        regime = 'Bull';
        confidence = Math.round(bullRatio * 100);
    } else if (bearRatio >= 0.7) {
        regime = 'Bear';
        confidence = Math.round(bearRatio * 100);
    } else {
        regime = 'Sideways';
        confidence = Math.round(Math.max(bullRatio, bearRatio) * 100);
    }

    // Reduce confidence if MA200 unavailable
    if (!canComputeMA200) {
        confidence = Math.round(confidence * 0.6);
        limitations.push('MA200 不可用，信心度已降低');
    }

    const dataCoverage = dataPoints >= 200 ? 'full' : dataPoints >= 50 ? 'limited' : 'insufficient';

    return {
        regime,
        confidence,
        factors,
        dataCoverage,
        samplePeriod,
        dataPoints,
        last_updated: lastDate,
        limitations,
    };
}

// ─── Period-specific regime (for backtest) ──────────────────────

export async function detectRegimeForPeriod(
    startDate: string,
    endDate: string,
): Promise<MarketRegimeResult> {
    const rows = await prisma.marketIndex.findMany({
        where: {
            name: 'TAIEX',
            date: { gte: startDate, lte: endDate },
        },
        orderBy: { date: 'asc' },
        select: { date: true, value: true },
    });

    // Also fetch prior data for MA lookback
    const priorRows = await prisma.marketIndex.findMany({
        where: {
            name: 'TAIEX',
            date: { lt: startDate },
        },
        orderBy: { date: 'asc' },
        select: { date: true, value: true },
        take: 200,
    });

    const allPrices = [...priorRows.map(r => r.value), ...rows.map(r => r.value)];
    const periodPrices = rows.map(r => r.value);
    const dataPoints = rows.length;
    const firstDate = rows.length > 0 ? rows[0].date : null;
    const lastDate = rows.length > 0 ? rows[rows.length - 1].date : null;
    const samplePeriod = firstDate && lastDate ? `${firstDate} ~ ${lastDate}` : 'N/A';

    if (dataPoints < 20) {
        return {
            regime: 'Unknown',
            confidence: 0,
            factors: [],
            dataCoverage: 'insufficient',
            samplePeriod,
            dataPoints,
            last_updated: lastDate,
            limitations: [`回測期間 MarketIndex 僅 ${dataPoints} 天，無法判斷市場環境`],
        };
    }

    // Use midpoint of period for trend assessment
    const midIdx = Math.floor(periodPrices.length / 2);
    const midPrice = periodPrices[midIdx];
    const startPrice = periodPrices[0];
    const endPrice = periodPrices[periodPrices.length - 1];
    const periodReturn = ((endPrice - startPrice) / startPrice) * 100;

    const factors: RegimeFactor[] = [];
    const limitations: string[] = [];

    factors.push({
        name: 'periodReturn',
        value: Math.round(periodReturn * 100) / 100,
        impact: periodReturn > 5 ? 'bullish' : periodReturn < -5 ? 'bearish' : 'neutral',
        note: `期間大盤報酬 ${periodReturn > 0 ? '+' : ''}${periodReturn.toFixed(2)}%`,
    });

    // Trend direction: start→mid vs mid→end
    const firstHalfReturn = ((midPrice - startPrice) / startPrice) * 100;
    const secondHalfReturn = ((endPrice - midPrice) / midPrice) * 100;
    const trendConsistent = (firstHalfReturn > 0 && secondHalfReturn > 0) || (firstHalfReturn < 0 && secondHalfReturn < 0);

    factors.push({
        name: 'trendConsistency',
        value: trendConsistent,
        impact: trendConsistent ? (periodReturn > 0 ? 'bullish' : 'bearish') : 'neutral',
        note: trendConsistent ? '趨勢方向一致' : '趨勢方向不一致（先漲後跌或先跌後漲）',
    });

    // Volatility
    const returns = dailyReturns(periodPrices);
    const vol = returns.length > 0 ? stddev(returns) * Math.sqrt(252) * 100 : 0;
    factors.push({
        name: 'periodVolatility',
        value: Math.round(vol * 100) / 100,
        impact: vol > 30 ? 'bearish' : 'neutral',
        note: `期間年化波動率 ${vol.toFixed(1)}%`,
    });

    // Regime
    let regime: MarketRegime;
    let confidence: number;

    if (periodReturn > 10 && trendConsistent) {
        regime = 'Bull';
        confidence = Math.min(90, 60 + Math.round(periodReturn));
    } else if (periodReturn < -10 && trendConsistent) {
        regime = 'Bear';
        confidence = Math.min(90, 60 + Math.round(Math.abs(periodReturn)));
    } else if (periodReturn > 5) {
        regime = 'Bull';
        confidence = 50 + Math.round(periodReturn);
    } else if (periodReturn < -5) {
        regime = 'Bear';
        confidence = 50 + Math.round(Math.abs(periodReturn));
    } else {
        regime = 'Sideways';
        confidence = 50 + Math.round((10 - Math.abs(periodReturn)) * 3);
    }

    confidence = Math.max(0, Math.min(100, confidence));

    if (dataPoints < 60) {
        confidence = Math.round(confidence * 0.7);
        limitations.push(`期間資料僅 ${dataPoints} 天，信心度已降低`);
    }

    return {
        regime,
        confidence,
        factors,
        dataCoverage: dataPoints >= 120 ? 'full' : dataPoints >= 20 ? 'limited' : 'insufficient',
        samplePeriod,
        dataPoints,
        last_updated: lastDate,
        limitations,
    };
}

// ─── Rolling regime timeline (for backtest) ─────────────────────

export interface RegimeTimelineEntry {
    date: string;
    regime: MarketRegime;
    confidence: number;
}

/**
 * Build a date→regime map for every trading date in a period.
 * Uses rolling MA50/MA200 + momentum + volatility evaluated at each point.
 * Evaluates every 5 trading days for performance, interpolating in between.
 */
export async function buildRegimeTimeline(
    startDate: string,
    endDate: string,
): Promise<{ timeline: Map<string, RegimeTimelineEntry>; limitations: string[] }> {
    // Fetch all TAIEX up to endDate (need prior 200 days for MA lookback)
    const allRows = await prisma.marketIndex.findMany({
        where: { name: 'TAIEX', date: { lte: endDate } },
        orderBy: { date: 'asc' },
        select: { date: true, value: true },
    });

    const limitations: string[] = [];
    const timeline = new Map<string, RegimeTimelineEntry>();

    if (allRows.length < 50) {
        limitations.push(`MarketIndex 僅 ${allRows.length} 天歷史，無法建立 regime timeline`);
        // Fill all dates with Unknown
        for (const row of allRows) {
            if (row.date >= startDate) {
                timeline.set(row.date, { date: row.date, regime: 'Unknown', confidence: 0 });
            }
        }
        return { timeline, limitations };
    }

    const prices = allRows.map(r => r.value);
    const dates = allRows.map(r => r.date);

    // Find the index where our period starts
    let periodStartIdx = dates.findIndex(d => d >= startDate);
    if (periodStartIdx < 0) periodStartIdx = dates.length;

    let lastRegime: MarketRegime = 'Unknown';
    let lastConfidence = 0;
    const EVAL_INTERVAL = 5; // evaluate every 5 trading days

    for (let i = periodStartIdx; i < dates.length; i++) {
        const date = dates[i];

        // Only full-evaluate at intervals or first point
        if (i === periodStartIdx || (i - periodStartIdx) % EVAL_INTERVAL === 0) {
            const sliceEnd = i + 1;
            const pricesUpToNow = prices.slice(0, sliceEnd);
            const currentPrice = pricesUpToNow[pricesUpToNow.length - 1];
            const dataLen = pricesUpToNow.length;

            let bullScore = 0;
            let bearScore = 0;
            let maxScore = 0;

            // MA50
            if (dataLen >= 50) {
                const ma50Val = pricesUpToNow.slice(-50).reduce((a, b) => a + b, 0) / 50;
                if (currentPrice > ma50Val) bullScore += 2; else bearScore += 2;
                maxScore += 2;

                // MA200
                if (dataLen >= 200) {
                    const ma200Val = pricesUpToNow.slice(-200).reduce((a, b) => a + b, 0) / 200;
                    if (currentPrice > ma200Val) bullScore += 3; else bearScore += 3;
                    maxScore += 3;
                    // MA50 vs MA200
                    if (ma50Val > ma200Val) bullScore += 2; else bearScore += 2;
                    maxScore += 2;
                }

                // 20d momentum
                if (dataLen >= 21) {
                    const ret20 = ((currentPrice - pricesUpToNow[dataLen - 21]) / pricesUpToNow[dataLen - 21]) * 100;
                    if (ret20 > 3) bullScore += 2;
                    else if (ret20 < -3) bearScore += 2;
                    else { bullScore += 1; bearScore += 1; }
                    maxScore += 2;
                }

                // 60d momentum
                if (dataLen >= 61) {
                    const ret60 = ((currentPrice - pricesUpToNow[dataLen - 61]) / pricesUpToNow[dataLen - 61]) * 100;
                    if (ret60 > 5) bullScore += 2;
                    else if (ret60 < -5) bearScore += 2;
                    else { bullScore += 1; bearScore += 1; }
                    maxScore += 2;
                }

                // Volatility penalty
                if (dataLen >= 21) {
                    const rets = dailyReturns(pricesUpToNow.slice(-21));
                    const vol = stddev(rets) * Math.sqrt(252) * 100;
                    if (vol > 30) { bearScore += 1; maxScore += 1; }
                }
            }

            // Determine regime
            const bullRatio = maxScore > 0 ? bullScore / maxScore : 0;
            const bearRatio = maxScore > 0 ? bearScore / maxScore : 0;

            if (dataLen < 50) {
                lastRegime = 'Unknown';
                lastConfidence = 0;
            } else if (bullRatio >= 0.7) {
                lastRegime = 'Bull';
                lastConfidence = Math.round(bullRatio * 100);
            } else if (bearRatio >= 0.7) {
                lastRegime = 'Bear';
                lastConfidence = Math.round(bearRatio * 100);
            } else {
                lastRegime = 'Sideways';
                lastConfidence = Math.round(Math.max(bullRatio, bearRatio) * 100);
            }

            if (dataLen < 200 && dataLen >= 50) {
                lastConfidence = Math.round(lastConfidence * 0.6);
            }
        }

        timeline.set(date, { date, regime: lastRegime, confidence: lastConfidence });
    }

    if (!allRows.some(r => r.date >= startDate)) {
        limitations.push('回測期間無 MarketIndex 資料，regime 全部為 Unknown');
    }
    if (allRows.filter(r => r.date <= startDate).length < 200) {
        limitations.push('回測起始前 MarketIndex 不足 200 天，早期 regime 判斷信心度較低');
    }

    return { timeline, limitations };
}
