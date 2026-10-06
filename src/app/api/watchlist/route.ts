
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';
import { getErrorMessage } from '@/lib/error-utils';
import type { Prisma } from '@prisma/client';
import { buildFundamentalResearchContextForSymbol } from '@/lib/fundamentals/FundamentalResearchService';

/**
 * GET /api/watchlist
 * Returns DB-backed watchlist with quote overlay.
 */
export async function GET() {
    const cacheKey = 'watchlist:list';
    const cached = apiCache.get<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    try {
        const watchlist = await prisma.watchlist.findMany({
            include: {
                stock: {
                    select: {
                        name: true,
                        industry: true,
                        quotes: {
                            orderBy: { date: 'desc' },
                            take: 6,
                        }
                    }
                }
            },
            orderBy: { addedAt: 'desc' }
        });

        const formatted = watchlist.map(item => {
            const quotes = item.stock.quotes || [];
            const latestQuote = quotes[0];
            const currentPrice = latestQuote?.close || 0;
            const previousClose = quotes[1]?.close || 0;
            const weekAgoClose = quotes[quotes.length - 1]?.close || 0;

            const dailyChange = previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
            const weeklyChange = weekAgoClose > 0 ? ((currentPrice - weekAgoClose) / weekAgoClose) * 100 : 0;

            const currentVolume = latestQuote?.volume || 0;
            const avgVolume = quotes.length > 1
                ? quotes.slice(1).reduce((sum, q) => sum + q.volume, 0) / (quotes.length - 1)
                : 0;
            const volumeChange = avgVolume > 0 ? ((currentVolume - avgVolume) / avgVolume) * 100 : 0;

            const hasQuoteData = quotes.length > 0;

            return {
                id: item.id,
                stockId: item.stockId,
                name: item.stock.name,
                industry: item.stock.industry || '',
                entryPrice: item.entryPrice,
                quantity: item.quantity,
                note: item.note,
                tags: item.tags,
                currentPrice,
                changePercent: item.entryPrice
                    ? ((currentPrice - item.entryPrice) / item.entryPrice) * 100
                    : 0,
                dailyChange: Math.round(dailyChange * 100) / 100,
                weeklyChange: Math.round(weeklyChange * 100) / 100,
                volume: currentVolume,
                volumeChange: Math.round(volumeChange * 100) / 100,
                addedAt: item.addedAt,
                updatedAt: item.updatedAt,
                hasQuoteData,
                lastQuoteDate: latestQuote?.date || null,
            };
        });

        const lastUpdated = await prisma.stockQuote.findFirst({ orderBy: { date: 'desc' }, select: { date: true } });

        const withFundamentalOverlay = await Promise.all(
            formatted.map(async (item) => {
                try {
                    const context = await buildFundamentalResearchContextForSymbol({
                        symbol: item.stockId,
                        name: item.name,
                        industry: item.industry,
                    });
                    return {
                        ...item,
                        fundamentalOverlay: context.overlay,
                    };
                } catch {
                    return {
                        ...item,
                        fundamentalOverlay: {
                            riskLevel: 'unknown' as const,
                            strengths: [],
                            pressures: [],
                            valuationContext: '資料不足，暫無法建立估值脈絡。',
                            growthContext: '資料不足，暫無法建立成長脈絡。',
                            summary: '基本面資料不足，目前僅能保守觀察。',
                            limitations: ['基本面 overlay 建立失敗，已降級。'],
                        },
                    };
                }
            }),
        );

        const response = {
            data: withFundamentalOverlay,
            sample_size: formatted.length,
            last_updated: lastUpdated?.date || null,
            coverage: {
                total: withFundamentalOverlay.length,
                withQuotes: withFundamentalOverlay.filter(f => f.hasQuoteData).length,
            },
        };

        apiCache.set(cacheKey, response, 120);
        return NextResponse.json(response);
    } catch (error) {
        console.error('Watchlist GET error:', error);
        return NextResponse.json({ data: [], sample_size: 0, last_updated: null, coverage: { total: 0, withQuotes: 0 } }, { status: 500 });
    }
}

/**
 * POST /api/watchlist
 * Add a stock to watchlist or bulk-import from localStorage migration.
 * Body: { stockId, entryPrice?, quantity?, note? }
 *   or: { items: [{ stockId, entryPrice?, quantity?, note? }] } for bulk migration
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Bulk migration mode
        if (body.items && Array.isArray(body.items)) {
            const results = { migrated: 0, skipped: 0, errors: [] as string[] };
            for (const item of body.items) {
                if (!item.stockId) continue;
                try {
                    // Check stock exists in DB
                    const stock = await prisma.stock.findUnique({ where: { id: item.stockId } });
                    if (!stock) {
                        results.skipped++;
                        results.errors.push(`${item.stockId}: 股票不存在於資料庫`);
                        continue;
                    }
                    await prisma.watchlist.upsert({
                        where: { stockId: item.stockId },
                        update: {
                            entryPrice: item.entryPrice ?? undefined,
                            quantity: item.quantity ?? undefined,
                            note: item.note ?? undefined,
                        },
                        create: {
                            stockId: item.stockId,
                            entryPrice: item.entryPrice ?? null,
                            quantity: item.quantity ?? null,
                            note: item.note ?? null,
                        },
                    });
                    results.migrated++;
                } catch (e: unknown) {
                    results.skipped++;
                    results.errors.push(`${item.stockId}: ${getErrorMessage(e) || 'unknown error'}`);
                }
            }
            apiCache.invalidate('watchlist:');
            return NextResponse.json({ success: true, ...results });
        }

        // Single add
        const { stockId, entryPrice, quantity, note } = body;
        if (!stockId) {
            return NextResponse.json({ error: 'Stock ID is required' }, { status: 400 });
        }

        const item = await prisma.watchlist.upsert({
            where: { stockId },
            update: {
                entryPrice: entryPrice ?? undefined,
                quantity: quantity ?? undefined,
                note: note ?? undefined,
            },
            create: {
                stockId,
                entryPrice: entryPrice ?? null,
                quantity: quantity ?? null,
                note: note ?? null,
            }
        });

        apiCache.invalidate('watchlist:');
        return NextResponse.json(item);
    } catch (error) {
        console.error('Watchlist POST error:', error);
        return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 });
    }
}

/**
 * PATCH /api/watchlist
 * Update holdings for a watchlist item.
 * Body: { stockId, entryPrice?, quantity?, note?, tags? }
 */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { stockId, entryPrice, quantity, note, tags } = body;

        if (!stockId) {
            return NextResponse.json({ error: 'Stock ID is required' }, { status: 400 });
        }

        const existing = await prisma.watchlist.findUnique({ where: { stockId } });
        if (!existing) {
            return NextResponse.json({ error: 'Stock not in watchlist' }, { status: 404 });
        }

        const updateData: Prisma.WatchlistUpdateInput = {};
        if (entryPrice !== undefined) updateData.entryPrice = entryPrice;
        if (quantity !== undefined) updateData.quantity = quantity;
        if (note !== undefined) updateData.note = note;
        if (tags !== undefined) updateData.tags = tags;

        const updated = await prisma.watchlist.update({
            where: { stockId },
            data: updateData,
        });

        apiCache.invalidate('watchlist:');
        return NextResponse.json(updated);
    } catch (error) {
        console.error('Watchlist PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update watchlist item' }, { status: 500 });
    }
}
