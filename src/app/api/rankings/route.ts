import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/rankings
 * 排行榜 API - 多維度股票排行
 * 
 * 不使用 mock 資料。若 DB 無資料，回傳空陣列 + 資料狀態。
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'foreign';
    const sectorFilter = searchParams.get('sector') || '';
    const limit = parseInt(searchParams.get('limit') || '50');

    try {
        const dbStocks = await fetchFromDB(type, sectorFilter, limit);
        const coverage = await getDataCoverage(type);

        return NextResponse.json({
            data: dbStocks || [],
            source: dbStocks && dbStocks.length > 0 ? 'database' : 'empty',
            type,
            coverage,
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Rankings API error:', error);
        return NextResponse.json({
            data: [],
            source: 'error',
            type,
            coverage: { stocks: 0, total: 0, limitations: ['資料庫查詢失敗'] },
            updatedAt: new Date().toISOString(),
        });
    }
}

async function getDataCoverage(type: string) {
    const totalStocks = await prisma.stock.count();
    const limitations: string[] = [];

    if (['foreign', 'trust', 'dealer'].includes(type)) {
        const chipStocks = await (prisma as any).institutionalChip.groupBy({ by: ['stockId'] });
        if (chipStocks.length < 20) {
            limitations.push(`僅 ${chipStocks.length} 檔股票有法人買賣超資料`);
        }
        return { stocks: chipStocks.length, total: totalStocks, limitations };
    }

    const quoteStocks = await prisma.stockQuote.groupBy({ by: ['stockId'] });
    if (quoteStocks.length < 50) {
        limitations.push(`僅 ${quoteStocks.length} 檔股票有行情資料`);
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
            .filter(idx => idx.name !== '發行量加權股價指數')
            .map((idx: any) => ({
                symbol: idx.name,
                name: idx.name,
                industry: idx.name,
                price: idx.close,
                change: idx.change,
                changePercent: idx.close > 0 ? Math.round((idx.change / idx.close) * 10000) / 100 : null,
                volume: idx.volume,
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
