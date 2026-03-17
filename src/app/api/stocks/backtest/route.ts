import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';
import { detectRegimeForPeriod } from '@/lib/market/MarketRegimeEngine';

/**
 * POST /api/stocks/backtest
 * 個股回測 API
 * 
 * 僅使用 DB 真實歷史行情。不使用 mock 資料。
 * 需 ≥100 天資料才可回測。
 * 含 Buy & Hold benchmark + Market benchmark (若 MarketIndex 可用)。
 */
export async function POST(request: NextRequest) {
    let body: { symbol?: string; strategy?: string; months?: number };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: '無效的請求格式' }, { status: 400 });
    }

    const { symbol, strategy = 'ma_cross', months = 12 } = body;
    if (!symbol) {
        return NextResponse.json({ error: '缺少 symbol 參數' }, { status: 400 });
    }

    const cacheKey = `backtest:${symbol}:${strategy}:${months}`;
    const cached = apiCache.get<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    try {
        const quoteCount = await prisma.stockQuote.count({ where: { stockId: symbol } });

        if (quoteCount < 100) {
            return NextResponse.json({
                symbol,
                strategy,
                source: 'insufficient_data',
                coverage: {
                    availableDays: quoteCount,
                    requiredDays: 100,
                    message: `${symbol} 僅有 ${quoteCount} 天歷史資料，需至少 100 天才可進行回測。`,
                },
                sample_size: quoteCount,
                last_updated: null,
                disclaimer: '資料不足，無法執行回測。',
            }, { status: 200 });
        }

        const dbResult = await backtestFromDB(symbol, strategy, months);
        if (dbResult) {
            // Calculate benchmarks
            const benchmark = await calculateBenchmarks(symbol, dbResult.period, dbResult.equityCurve);

            // Detect market regime during backtest period
            const periodDates = dbResult.period.split(' ~ ');
            let marketRegime = null;
            try {
                if (periodDates.length === 2) {
                    marketRegime = await detectRegimeForPeriod(periodDates[0], periodDates[1]);
                }
            } catch { /* regime unavailable — non-critical */ }

            const dataLimitations: string[] = [];
            if (!benchmark.marketAvailable) {
                dataLimitations.push('大盤指數歷史資料不足，無法提供市場 benchmark 比較');
            }
            if (dbResult.equityCurve.length < 250) {
                dataLimitations.push(`回測期間僅 ${dbResult.equityCurve.length} 個交易日，統計意義有限`);
            }
            if (dbResult.trades.length < 5) {
                dataLimitations.push(`策略僅產生 ${dbResult.trades.length} 筆交易，樣本數偏少`);
            }

            const response = {
                ...dbResult,
                source: 'database（TWSE 歷史行情資料）',
                coverage: { availableDays: quoteCount, requiredDays: 100 },
                sample_size: quoteCount,
                last_updated: dbResult.equityCurve[dbResult.equityCurve.length - 1]?.date || null,
                benchmark,
                marketRegime,
                samplePeriod: dbResult.period,
                dataLimitations,
                disclaimer: '回測結果基於歷史資料，不代表未來績效。不含交易成本與滑價。過去表現不保證未來報酬。',
            };
            apiCache.set(cacheKey, response, 600);
            return NextResponse.json(response);
        }

        return NextResponse.json({
            symbol,
            strategy,
            source: 'insufficient_data',
            coverage: { availableDays: quoteCount, requiredDays: 100, message: '回測執行失敗或資料不符合條件。' },
            sample_size: quoteCount,
            last_updated: null,
            disclaimer: '資料不足或不符合回測條件。',
        });
    } catch (error) {
        console.error('Backtest error:', error);
        return NextResponse.json({ error: '回測執行失敗' }, { status: 500 });
    }
}

/**
 * GET /api/stocks/backtest?symbol=2330&strategy=ma_cross&months=12
 * 方便前端 /backtest 頁使用
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol') || '';
    const strategy = searchParams.get('strategy') || 'ma_cross';
    const months = parseInt(searchParams.get('months') || '12');

    if (!symbol) {
        // Return list of backtestable stocks
        const cacheKey = 'backtest:eligible';
        const cached = apiCache.get<any>(cacheKey);
        if (cached) return NextResponse.json(cached);

        try {
            const stockCounts = await prisma.stockQuote.groupBy({
                by: ['stockId'],
                _count: { stockId: true },
            });
            const eligible = stockCounts
                .filter(s => s._count.stockId >= 100)
                .map(s => ({ symbol: s.stockId, dataPoints: s._count.stockId }));

            // Enrich with stock names
            const stockNames = await prisma.stock.findMany({
                where: { id: { in: eligible.map(e => e.symbol) } },
                select: { id: true, name: true, industry: true },
            });
            const nameMap = new Map(stockNames.map(s => [s.id, s]));

            const enriched = eligible
                .map(e => ({
                    ...e,
                    name: nameMap.get(e.symbol)?.name || e.symbol,
                    industry: nameMap.get(e.symbol)?.industry || '',
                }))
                .sort((a, b) => b.dataPoints - a.dataPoints);

            const response = {
                eligible: enriched,
                total: stockCounts.length,
                eligibleCount: enriched.length,
                minRequired: 100,
                sample_size: enriched.length,
                last_updated: null as string | null,
            };

            const latest = await prisma.stockQuote.findFirst({ orderBy: { date: 'desc' }, select: { date: true } });
            response.last_updated = latest?.date || null;

            apiCache.set(cacheKey, response, 300);
            return NextResponse.json(response);
        } catch (error) {
            console.error('Backtest eligible list error:', error);
            return NextResponse.json({ eligible: [], total: 0, eligibleCount: 0, minRequired: 100 });
        }
    }

    // Proxy to POST logic
    const fakeRequest = new NextRequest(request.url, {
        method: 'POST',
        body: JSON.stringify({ symbol, strategy, months }),
    });
    return POST(fakeRequest);
}

interface Trade {
    entryDate: string;
    entryPrice: number;
    exitDate: string;
    exitPrice: number;
    returnPct: number;
    reason: string;
}

interface BacktestResult {
    symbol: string;
    strategy: string;
    period: string;
    trades: Trade[];
    summary: {
        totalTrades: number;
        winRate: number;
        avgReturn: number;
        maxDrawdown: number;
        totalReturn: number;
        cagr: number;
        sharpeRatio: number;
    };
    equityCurve: { date: string; value: number }[];
    methodology: string;
}

function runBacktest(
    symbol: string,
    strategy: string,
    priceHistory: { date: string; close: number; high: number; low: number; volume: number; open: number }[]
): BacktestResult {
    const trades: Trade[] = [];
    let equity = 100;
    const equityCurve: { date: string; value: number }[] = [];
    let maxEquity = equity;
    let maxDrawdown = 0;
    let inPosition = false;
    let entryPrice = 0;
    let entryDate = '';

    const closes = priceHistory.map(p => p.close);

    let methodologyDesc = '';

    for (let i = 20; i < priceHistory.length; i++) {
        const price = priceHistory[i];
        const ma5 = avg(closes.slice(i - 5, i));
        const ma20 = avg(closes.slice(i - 20, i));
        const rsi = simpleRSI(closes.slice(0, i + 1), 14);

        let shouldBuy = false;
        let shouldSell = false;
        let buyReason = '';
        let sellReason = '';

        switch (strategy) {
            case 'ma_cross':
                methodologyDesc = 'MA5/MA20 黃金交叉買進，死亡交叉賣出';
                shouldBuy = ma5 > ma20 && avg(closes.slice(i - 6, i - 1)) <= avg(closes.slice(i - 21, i - 1));
                shouldSell = ma5 < ma20 && avg(closes.slice(i - 6, i - 1)) >= avg(closes.slice(i - 21, i - 1));
                buyReason = `MA5(${r(ma5)}) 向上穿越 MA20(${r(ma20)})`;
                sellReason = `MA5(${r(ma5)}) 向下穿越 MA20(${r(ma20)})`;
                break;
            case 'rsi':
                methodologyDesc = 'RSI<30 買進，RSI>70 賣出';
                shouldBuy = rsi < 30;
                shouldSell = rsi > 70;
                buyReason = `RSI(${r(rsi)}) < 30 超賣`;
                sellReason = `RSI(${r(rsi)}) > 70 超買`;
                break;
            case 'bb':
                methodologyDesc = '跌破布林下軌買進，突破布林上軌賣出';
                const bbMid = ma20;
                const bbStd = stddev(closes.slice(i - 20, i));
                shouldBuy = price.close < bbMid - 2 * bbStd;
                shouldSell = price.close > bbMid + 2 * bbStd;
                buyReason = `股價(${r(price.close)}) < 布林下軌(${r(bbMid - 2 * bbStd)})`;
                sellReason = `股價(${r(price.close)}) > 布林上軌(${r(bbMid + 2 * bbStd)})`;
                break;
            default:
                methodologyDesc = 'MA5/MA20 黃金交叉買進，死亡交叉賣出';
                shouldBuy = ma5 > ma20;
                shouldSell = ma5 < ma20;
                buyReason = `MA5 > MA20`;
                sellReason = `MA5 < MA20`;
        }

        if (!inPosition && shouldBuy) {
            inPosition = true;
            entryPrice = price.close;
            entryDate = price.date;
        } else if (inPosition && shouldSell) {
            const returnPct = ((price.close - entryPrice) / entryPrice) * 100;
            trades.push({
                entryDate,
                entryPrice: r(entryPrice),
                exitDate: price.date,
                exitPrice: r(price.close),
                returnPct: r(returnPct),
                reason: `買進：${buyReason} → 賣出：${sellReason}`,
            });
            equity *= (1 + returnPct / 100);
            inPosition = false;
        }

        maxEquity = Math.max(maxEquity, equity);
        const drawdown = ((maxEquity - equity) / maxEquity) * 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);

        equityCurve.push({ date: price.date, value: r(equity) });
    }

    const wins = trades.filter(t => t.returnPct > 0).length;
    const avgReturn = trades.length > 0
        ? trades.reduce((sum, t) => sum + t.returnPct, 0) / trades.length
        : 0;

    // Simplified Sharpe
    const returns = trades.map(t => t.returnPct);
    const meanR = avg(returns);
    const stdR = returns.length > 1 ? stddev(returns) : 1;
    const sharpe = stdR > 0 ? meanR / stdR : 0;

    // CAGR calculation
    const totalReturnPct = equity - 100;
    const tradingDays = priceHistory.length - 20; // effective days
    const years = tradingDays / 252;
    const cagr = years > 0 ? (Math.pow(equity / 100, 1 / years) - 1) * 100 : 0;

    return {
        symbol,
        strategy,
        period: `${priceHistory[0]?.date || ''} ~ ${priceHistory[priceHistory.length - 1]?.date || ''}`,
        trades,
        summary: {
            totalTrades: trades.length,
            winRate: trades.length > 0 ? r((wins / trades.length) * 100) : 0,
            avgReturn: r(avgReturn),
            maxDrawdown: r(maxDrawdown),
            totalReturn: r(totalReturnPct),
            cagr: r(cagr),
            sharpeRatio: r(sharpe),
        },
        equityCurve,
        methodology: methodologyDesc,
    };
}

async function backtestFromDB(symbol: string, strategy: string, months: number): Promise<BacktestResult | null> {
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - months);
    const fromStr = fromDate.toISOString().slice(0, 10); // YYYY-MM-DD (matches DB format)

    const quotes = await prisma.stockQuote.findMany({
        where: {
            stockId: symbol,
            date: { gte: fromStr },
        },
        orderBy: { date: 'asc' },
    });

    if (quotes.length < 30) return null;

    const history = quotes.map(q => ({
        date: q.date,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume,
    }));

    return runBacktest(symbol, strategy, history);
}

// ─── Benchmark Calculations ─────────────────────────────────────

interface BenchmarkResult {
    buyAndHoldReturn: number;
    marketReturn: number | null;
    alphaVsBuyHold: number;
    alphaVsMarket: number | null;
    marketAvailable: boolean;
    marketUnavailableReason?: string;
}

async function calculateBenchmarks(
    symbol: string,
    period: string,
    equityCurve: { date: string; value: number }[],
): Promise<BenchmarkResult> {
    if (equityCurve.length === 0) {
        return { buyAndHoldReturn: 0, marketReturn: null, alphaVsBuyHold: 0, alphaVsMarket: null, marketAvailable: false, marketUnavailableReason: '無回測資料' };
    }

    const startDate = equityCurve[0].date;
    const endDate = equityCurve[equityCurve.length - 1].date;
    const strategyReturn = equityCurve[equityCurve.length - 1].value - 100; // equity starts at 100

    // Buy & Hold: same stock, same period
    const bhQuotes = await prisma.stockQuote.findMany({
        where: { stockId: symbol, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
        select: { close: true },
    });

    let buyAndHoldReturn = 0;
    if (bhQuotes.length >= 2) {
        const startPrice = bhQuotes[0].close;
        const endPrice = bhQuotes[bhQuotes.length - 1].close;
        buyAndHoldReturn = startPrice > 0 ? r(((endPrice - startPrice) / startPrice) * 100) : 0;
    }

    const alphaVsBuyHold = r(strategyReturn - buyAndHoldReturn);

    // Market benchmark: TAIEX index, same period
    const marketRecords = await prisma.marketIndex.findMany({
        where: { name: 'TAIEX', date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
        select: { value: true },
    });

    let marketReturn: number | null = null;
    let alphaVsMarket: number | null = null;
    let marketAvailable = false;
    let marketUnavailableReason: string | undefined;

    if (marketRecords.length >= 2) {
        const startVal = marketRecords[0].value;
        const endVal = marketRecords[marketRecords.length - 1].value;
        if (startVal > 0) {
            marketReturn = r(((endVal - startVal) / startVal) * 100);
            alphaVsMarket = r(strategyReturn - marketReturn);
            marketAvailable = true;
        }
    } else {
        marketUnavailableReason = marketRecords.length === 0
            ? '大盤指數歷史資料不存在，無法計算市場 benchmark'
            : `大盤指數僅有 ${marketRecords.length} 筆資料，不足以計算市場 benchmark`;
    }

    return { buyAndHoldReturn, marketReturn, alphaVsBuyHold, alphaVsMarket, marketAvailable, marketUnavailableReason };
}

// --- Helpers ---
function r(n: number): number { return Math.round(n * 100) / 100; }
function avg(arr: number[]): number { return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function stddev(arr: number[]): number {
    const m = avg(arr);
    return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length);
}
function simpleRSI(closes: number[], period: number): number {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
    }
    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return 100 - 100 / (1 + rs);
}
