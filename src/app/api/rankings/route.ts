import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';

/**
 * GET /api/rankings
 * 排行榜 API - 多維度股票排行
 * 
 * 不使用 mock 資料。若 DB 無資料，回傳空陣列 + 資料狀態。
 * 回傳 coverage, sample_size, last_updated 給前端。
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'foreign';
    const sectorFilter = searchParams.get('sector') || '';
    const limit = parseInt(searchParams.get('limit') || '50');

    const cacheKey = `rankings:${type}:${sectorFilter}:${limit}`;
    const cached = apiCache.get<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    try {
        const dbStocks = await fetchFromDB(type, sectorFilter, limit);
        const coverage = await getDataCoverage(type);
        const lastUpdated = await getLastUpdated(type);

        const response = {
            data: dbStocks || [],
            source: dbStocks && dbStocks.length > 0 ? 'database' : 'empty',
            type,
            coverage,
            sample_size: dbStocks?.length || 0,
            last_updated: lastUpdated,
            updatedAt: new Date().toISOString(),
        };

        apiCache.set(cacheKey, response, 180);
        return NextResponse.json(response);
    } catch (error) {
        console.error('Rankings API error:', error);
        return NextResponse.json({
            data: [],
            source: 'error',
            type,
            coverage: { stocks: 0, total: 0, limitations: ['資料庫查詢失敗'] },
            sample_size: 0,
            last_updated: null,
            updatedAt: new Date().toISOString(),
        });
    }
}

async function getLastUpdated(type: string): Promise<string | null> {
    try {
        if (['foreign', 'trust', 'dealer'].includes(type)) {
            const latest = await (prisma as any).institutionalChip.findFirst({ orderBy: { date: 'desc' }, select: { date: true } });
            return latest?.date || null;
        }
        const latest = await prisma.stockQuote.findFirst({ orderBy: { date: 'desc' }, select: { date: true } });
        return latest?.date || null;
    } catch { return null; }
}

async function getDataCoverage(type: string) {
    const totalStocks = await prisma.stock.count();
    const limitations: string[] = [];

    if (['foreign', 'trust', 'dealer'].includes(type)) {
        const chipStocks = await (prisma as any).institutionalChip.groupBy({ by: ['stockId'] });
        const chipDates = await (prisma as any).institutionalChip.groupBy({ by: ['date'] });
        if (chipStocks.length < totalStocks * 0.5) {
            limitations.push(`資料覆蓋率不足，排行榜僅基於目前可用樣本 (${chipStocks.length}/${totalStocks} 檔)`);
        }
        return { stocks: chipStocks.length, total: totalStocks, dates: chipDates.length, limitations };
    }

    const quoteStocks = await prisma.stockQuote.groupBy({ by: ['stockId'] });
    if (quoteStocks.length < totalStocks * 0.5) {
        limitations.push(`資料覆蓋率不足，排行榜僅基於目前可用樣本 (${quoteStocks.length}/${totalStocks} 檔)`);
    }
    return { stocks: quoteStocks.length, total: totalStocks, limitations };
}

async function fetchFromDB(type: string, sectorFilter: string, limit: number) {
    const sectorWhere = sectorFilter
        ? { stock: { industry: { contains: sectorFilter } } }
        : {};

    if (['foreign', 'trust', 'dealer'].includes(type)) {
        const chips = await (prisma as any).institutionalChip.findMany({
            where: {
                ...sectorWhere,
            },
            orderBy: { date: 'desc' },
            take: 200,
            include: {
                stock: {
                    include: {
                        quotes: { orderBy: { date: 'desc' }, take: 1 },
                    },
                },
            },
        });

        // Group by stockId, take latest per stock
        const latestByStock = new Map<string, any>();
        for (const chip of chips) {
            if (!latestByStock.has(chip.stockId)) {
                latestByStock.set(chip.stockId, chip);
            }
        }

        const sortKey = type === 'foreign' ? 'foreignBuy' : type === 'trust' ? 'trustBuy' : 'dealerBuy';
        const sorted = Array.from(latestByStock.values())
            .sort((a: any, b: any) => b[sortKey] - a[sortKey])
            .slice(0, limit);

        return sorted.map((chip: any) => ({
            symbol: chip.stockId,
            name: chip.stock?.name || chip.stockId,
            industry: chip.stock?.industry || '',
            price: chip.stock?.quotes?.[0]?.close ?? null,
            change: chip.stock?.quotes?.[0]?.change ?? null,
            volume: chip.stock?.quotes?.[0]?.volume ?? null,
            foreignBuy: chip.foreignBuy,
            trustBuy: chip.trustBuy,
            dealerBuy: chip.dealerBuy,
            totalBuy: chip.totalBuy,
            date: chip.date,
        }));
    }

    if (type === 'volume' || type === 'gainers' || type === 'losers') {
        const orderField = type === 'volume' ? 'volume' : 'change';
        const orderDir = type === 'losers' ? 'asc' : 'desc';

        const quotes = await prisma.stockQuote.findMany({
            orderBy: [{ date: 'desc' }],
            take: 500,
            include: { stock: true },
        });

        const latestByStock = new Map<string, any>();
        for (const q of quotes) {
            if (!latestByStock.has(q.stockId)) {
                latestByStock.set(q.stockId, q);
            }
        }

        const sorted = Array.from(latestByStock.values())
            .sort((a: any, b: any) => {
                const va = a[orderField] ?? 0;
                const vb = b[orderField] ?? 0;
                return orderDir === 'desc' ? vb - va : va - vb;
            })
            .slice(0, limit);

        return sorted.map((q: any) => ({
            symbol: q.stockId,
            name: q.stock?.name || q.stockId,
            industry: q.stock?.industry || '',
            price: q.close,
            change: q.change,
            volume: q.volume,
            foreignBuy: null,
            trustBuy: null,
            dealerBuy: null,
            totalBuy: null,
            date: q.date,
        }));
    }

    if (type === 'sector') {
        // Get market index data for sector ranking
        const indices = await prisma.marketIndex.findMany({
            orderBy: { date: 'desc' },
            take: 200,
        });
        if (indices.length === 0) return null;

        // Group by name, take latest
        const latestByName = new Map<string, any>();
        for (const idx of indices) {
            if (!latestByName.has(idx.name)) {
                latestByName.set(idx.name, idx);
            }
        }

        return Array.from(latestByName.values())
            .filter(idx => idx.name !== 'TAIEX' && idx.name !== '發行量加權股價指數')
            .map((idx: any) => ({
                symbol: idx.name,
                name: idx.name,
                industry: idx.name,
                price: idx.value,
                change: idx.change,
                changePercent: idx.changePercent ?? (idx.value > 0 ? Math.round((idx.change / idx.value) * 10000) / 100 : null),
                volume: null,
                foreignBuy: null,
                trustBuy: null,
                dealerBuy: null,
                totalBuy: null,
                stockCount: null,
            }))
            .slice(0, limit);
    }

    return null;
}
