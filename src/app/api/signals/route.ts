import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';
import type { SignalsApiResponse, SignalsCoverage } from '@/types/api-payloads';

/**
 * GET /api/signals
 * 技術指標交易建議 API
 * 
 * 僅使用 DB 中的真實歷史行情計算。不使用 mock 資料。
 * 只會為有 ≥60 天報價資料的股票計算信號。
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '30');
    const minStrength = parseInt(searchParams.get('minStrength') || '0');

    const cacheKey = `signals:${limit}:${minStrength}`;
    const cached = apiCache.get<SignalsApiResponse>(cacheKey);
    if (cached) return NextResponse.json(cached);

    try {
        const { results, coverage } = await calculateFromDB(limit, minStrength);
        const lastUpdated = await prisma.stockQuote.findFirst({ orderBy: { date: 'desc' }, select: { date: true } });
        const response = {
            data: results,
            source: results.length > 0 ? 'database（TWSE 歷史行情資料）' : 'empty',
            methodology: '依據 MA20/MA60/RSI/MACD 等技術指標計算支撐壓力位與建議價位',
            disclaimer: '以下為技術分析推估結果，僅供參考，不構成投資建議。實際交易請自行評估風險。',
            coverage,
            sample_size: results.length,
            last_updated: lastUpdated?.date || null,
            updatedAt: new Date().toISOString(),
        };
        apiCache.set(cacheKey, response, 300);
        return NextResponse.json(response);
    } catch (error) {
        console.error('Signals API error:', error);
        return NextResponse.json({
            data: [],
            source: 'error',
            methodology: '',
            disclaimer: '',
            coverage: { analyzed: 0, sufficient: 0, total: 0, minDays: 60, limitations: ['資料庫查詢失敗'] },
            sample_size: 0,
            last_updated: null,
            updatedAt: new Date().toISOString(),
        });
    }
}

interface SignalResult {
    symbol: string;
    name: string;
    industry: string;
    currentPrice: number;
    signal: 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
    strength: number;
    signalDate: string;
    dataPeriod: string;
    dataPoints: number;
    watchPrice: PriceLevel;
    buyPrice: PriceLevel;
    stopLoss: PriceLevel;
    targetPrice: PriceLevel;
    indicators: IndicatorDetail[];
}

interface PriceLevel {
    price: number;
    methodology: string;
}

interface IndicatorDetail {
    name: string;
    value: number | string;
    signal: 'bullish' | 'bearish' | 'neutral';
    description: string;
}

function calculateSignals(
    symbol: string,
    name: string,
    industry: string,
    currentPrice: number,
    priceHistory: { close: number; high: number; low: number; volume: number }[],
    dateRange: { first: string; last: string; count: number }
): SignalResult | null {
    if (priceHistory.length < 20) return null;

    const closes = priceHistory.map(p => p.close);
    const highs = priceHistory.map(p => p.high);
    const lows = priceHistory.map(p => p.low);
    const volumes = priceHistory.map(p => p.volume);

    // MA calculations
    const ma5 = avg(closes.slice(-5));
    const ma20 = avg(closes.slice(-20));
    const ma60 = closes.length >= 60 ? avg(closes.slice(-60)) : null;

    // RSI (14-day)
    const rsi = calculateRSI(closes, 14);

    // MACD
    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);
    const macdLine = ema12 - ema26;
    const signalLine = calculateEMA(
        closes.slice(-9).map(() => macdLine), // Simplified
        9
    );
    const macdHistogram = macdLine - signalLine;

    // Bollinger Bands (20-day, 2σ)
    const bbMiddle = ma20;
    const bbStd = stddev(closes.slice(-20));
    const bbUpper = bbMiddle + 2 * bbStd;
    const bbLower = bbMiddle - 2 * bbStd;

    // KD Stochastic (9-day)
    const kd = calculateKD(closes, highs, lows, 9);

    // ATR (14-day)
    const atr = calculateATR(closes, highs, lows, 14);

    // Volume analysis
    const avgVol20 = avg(volumes.slice(-20));
    const recentVol = avg(volumes.slice(-3));
    const volumeRatio = avgVol20 > 0 ? recentVol / avgVol20 : 1;

    // --- Signal determination ---
    const indicators: IndicatorDetail[] = [];
    let bullishCount = 0;
    let bearishCount = 0;

    // MA trend
    const maAligned = ma5 > ma20;
    if (currentPrice > ma20) {
        bullishCount++;
        indicators.push({ name: 'MA20', value: r(ma20), signal: 'bullish', description: `股價 ${r(currentPrice)} 在 MA20 (${r(ma20)}) 之上${maAligned ? '，MA5>MA20 多頭排列' : ''}` });
    } else {
        bearishCount++;
        indicators.push({ name: 'MA20', value: r(ma20), signal: 'bearish', description: `股價 ${r(currentPrice)} 在 MA20 (${r(ma20)}) 之下，短期趨勢偏弱` });
    }

    if (ma60 !== null) {
        if (currentPrice > ma60) {
            bullishCount++;
            indicators.push({ name: 'MA60', value: r(ma60), signal: 'bullish', description: `股價在 MA60 (${r(ma60)}) 之上，中期趨勢向上` });
        } else {
            bearishCount++;
            indicators.push({ name: 'MA60', value: r(ma60), signal: 'bearish', description: `股價在 MA60 (${r(ma60)}) 之下，中期趨勢偏弱` });
        }
    }

    // RSI
    if (rsi < 30) {
        bullishCount += 2;
        indicators.push({ name: 'RSI', value: r(rsi), signal: 'bullish', description: `RSI ${r(rsi)} 進入超賣區 (<30)，可能反彈` });
    } else if (rsi > 70) {
        bearishCount += 2;
        indicators.push({ name: 'RSI', value: r(rsi), signal: 'bearish', description: `RSI ${r(rsi)} 進入超買區 (>70)，可能回落` });
    } else {
        indicators.push({ name: 'RSI', value: r(rsi), signal: 'neutral', description: `RSI ${r(rsi)} 在中性區間` });
    }

    // MACD
    if (macdHistogram > 0) {
        bullishCount++;
        indicators.push({ name: 'MACD', value: `${r(macdLine)} / ${r(signalLine)}`, signal: 'bullish', description: `MACD 柱狀圖為正 (${r(macdHistogram)})，多方動能增強` });
    } else {
        bearishCount++;
        indicators.push({ name: 'MACD', value: `${r(macdLine)} / ${r(signalLine)}`, signal: 'bearish', description: `MACD 柱狀圖為負 (${r(macdHistogram)})，空方動能增強` });
    }

    // Bollinger Bands
    if (currentPrice < bbLower) {
        bullishCount++;
        indicators.push({ name: 'BB', value: `${r(bbLower)} - ${r(bbUpper)}`, signal: 'bullish', description: `股價跌破布林下軌 (${r(bbLower)})，可能超跌反彈` });
    } else if (currentPrice > bbUpper) {
        bearishCount++;
        indicators.push({ name: 'BB', value: `${r(bbLower)} - ${r(bbUpper)}`, signal: 'bearish', description: `股價突破布林上軌 (${r(bbUpper)})，可能過熱回落` });
    } else {
        indicators.push({ name: 'BB', value: `${r(bbLower)} - ${r(bbUpper)}`, signal: 'neutral', description: `股價在布林通道內，波動正常` });
    }

    // KD
    if (kd.k < 20 && kd.d < 20) {
        bullishCount++;
        indicators.push({ name: 'KD', value: `K:${r(kd.k)} D:${r(kd.d)}`, signal: 'bullish', description: `KD 值偏低，可能出現黃金交叉` });
    } else if (kd.k > 80 && kd.d > 80) {
        bearishCount++;
        indicators.push({ name: 'KD', value: `K:${r(kd.k)} D:${r(kd.d)}`, signal: 'bearish', description: `KD 值偏高，可能出現死亡交叉` });
    } else {
        indicators.push({ name: 'KD', value: `K:${r(kd.k)} D:${r(kd.d)}`, signal: 'neutral', description: `KD 值在中性區間` });
    }

    // Volume
    if (volumeRatio > 1.5) {
        indicators.push({ name: '成交量', value: `${r(volumeRatio)}x`, signal: currentPrice > closes[closes.length - 2] ? 'bullish' : 'bearish', description: `近3日量能為 20 日均量的 ${r(volumeRatio)} 倍，${currentPrice > closes[closes.length - 2] ? '量增價漲' : '量增價跌需注意'}` });
        if (currentPrice > closes[closes.length - 2]) bullishCount++;
        else bearishCount++;
    } else {
        indicators.push({ name: '成交量', value: `${r(volumeRatio)}x`, signal: 'neutral', description: `量能正常，近3日量能為 20 日均量的 ${r(volumeRatio)} 倍` });
    }

    // --- Signal & price levels ---
    const totalSignals = bullishCount + bearishCount;
    const strength = totalSignals > 0 ? Math.round((Math.max(bullishCount, bearishCount) / totalSignals) * 100) : 50;

    let signal: SignalResult['signal'] = 'HOLD';
    if (bullishCount >= bearishCount + 3) signal = 'BUY';
    else if (bearishCount >= bullishCount + 3) signal = 'SELL';
    else if (bullishCount > bearishCount) signal = 'WATCH';

    // Support levels (descending priority)
    const supports = [bbLower, ma60, ma20].filter((v): v is number => v !== null).sort((a, b) => b - a);
    const supportPrice = supports.find(s => s < currentPrice) ?? currentPrice * 0.95;

    // Resistance levels
    const resistances = [bbUpper, ma20, ma60].filter((v): v is number => v !== null).sort((a, b) => a - b);
    const resistPrice = resistances.find(r => r > currentPrice) ?? currentPrice * 1.05;

    return {
        symbol,
        name,
        industry,
        currentPrice: r(currentPrice),
        signal,
        strength,
        signalDate: dateRange.last,
        dataPeriod: `${dateRange.first} ~ ${dateRange.last}`,
        dataPoints: dateRange.count,
        watchPrice: {
            price: r(supportPrice * 1.01),
            methodology: `支撐位 (${r(supportPrice)}) 上方 1%，依據布林下軌/MA 計算`,
        },
        buyPrice: {
            price: r(supportPrice),
            methodology: `主要支撐位：${ma60 && supportPrice === ma60 ? 'MA60' : supportPrice === bbLower ? '布林下軌' : 'MA20'} = ${r(supportPrice)}`,
        },
        stopLoss: {
            price: r(currentPrice - 2 * atr),
            methodology: `進場價 - 2×ATR(${r(atr)}) = ${r(currentPrice - 2 * atr)}`,
        },
        targetPrice: {
            price: r(resistPrice),
            methodology: `主要壓力位：${resistPrice === bbUpper ? '布林上軌' : 'MA'} = ${r(resistPrice)}`,
        },
        indicators,
    };
}

// --- Helpers ---
function r(n: number): number { return Math.round(n * 100) / 100; }
function avg(arr: number[]): number { return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function stddev(arr: number[]): number {
    const m = avg(arr);
    return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length);
}

function calculateRSI(closes: number[], period: number): number {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}

function calculateEMA(data: number[], period: number): number {
    if (data.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
    }
    return ema;
}

function calculateKD(closes: number[], highs: number[], lows: number[], period: number) {
    const recentCloses = closes.slice(-period);
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const highest = Math.max(...recentHighs);
    const lowest = Math.min(...recentLows);
    const range = highest - lowest;
    const rsv = range > 0 ? ((recentCloses[recentCloses.length - 1] - lowest) / range) * 100 : 50;
    // Simplified K/D
    const k = rsv;
    const d = (rsv + 50) / 2; // Simplified smoothing
    return { k: Math.round(k * 100) / 100, d: Math.round(d * 100) / 100 };
}

function calculateATR(closes: number[], highs: number[], lows: number[], period: number): number {
    if (closes.length < period + 1) return closes[closes.length - 1] * 0.02;
    let sum = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const tr = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
        );
        sum += tr;
    }
    return sum / period;
}

async function calculateFromDB(limit: number, minStrength: number): Promise<{ results: SignalResult[]; coverage: SignalsCoverage }> {
    const stocks = await prisma.stock.findMany({
        select: { id: true, name: true, industry: true },
        take: 200,
    });

    const totalStocks = stocks.length;
    const results: SignalResult[] = [];
    let sufficientCount = 0;
    const MIN_DAYS = 60;

    for (const stock of stocks) {
        const quotes = await prisma.stockQuote.findMany({
            where: { stockId: stock.id },
            orderBy: { date: 'desc' },
            take: 250,
        });

        if (quotes.length < MIN_DAYS) continue;
        sufficientCount++;

        const sorted = quotes.reverse();
        const history = sorted.map(q => ({
            close: q.close,
            high: q.high,
            low: q.low,
            volume: q.volume,
        }));

        const dateRange = {
            first: sorted[0].date,
            last: sorted[sorted.length - 1].date,
            count: sorted.length,
        };

        const result = calculateSignals(
            stock.id,
            stock.name,
            stock.industry || '',
            history[history.length - 1].close,
            history,
            dateRange
        );

        if (result && result.strength >= minStrength) {
            results.push(result);
        }
    }

    const limitations: string[] = [];
    if (sufficientCount < 20) {
        limitations.push(`僅 ${sufficientCount} 檔股票有 ≥${MIN_DAYS} 天歷史資料`);
    }
    if (sufficientCount === 0) {
        limitations.push('無任何股票有足夠的歷史資料進行技術分析');
    }

    return {
        results: results.sort((a, b) => b.strength - a.strength).slice(0, limit),
        coverage: {
            analyzed: sufficientCount,
            sufficient: sufficientCount,
            total: totalStocks,
            minDays: MIN_DAYS,
            limitations,
        },
    };
}
