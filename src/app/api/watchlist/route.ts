
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';

export async function GET() {
    const cacheKey = 'watchlist:list';
    const cached = apiCache.get<any>(cacheKey);
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
                            take: 6, // need ~5 days for weekly change
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
                currentPrice,
                changePercent: item.entryPrice
                    ? ((currentPrice - item.entryPrice) / item.entryPrice) * 100
                    : 0,
                dailyChange: Math.round(dailyChange * 100) / 100,
                weeklyChange: Math.round(weeklyChange * 100) / 100,
                volume: currentVolume,
                volumeChange: Math.round(volumeChange * 100) / 100,
                addedAt: item.addedAt,
                note: item.note,
                hasQuoteData,
                lastQuoteDate: latestQuote?.date || null,
            };
        });

        const lastUpdated = await prisma.stockQuote.findFirst({ orderBy: { date: 'desc' }, select: { date: true } });

        const response = {
            data: formatted,
            sample_size: formatted.length,
            last_updated: lastUpdated?.date || null,
            coverage: {
                total: formatted.length,
                withQuotes: formatted.filter(f => f.hasQuoteData).length,
            },
        };

        apiCache.set(cacheKey, response, 120);
        return NextResponse.json(response);
    } catch (error) {
        console.error('Watchlist GET error:', error);
        return NextResponse.json({ data: [], sample_size: 0, last_updated: null, coverage: { total: 0, withQuotes: 0 } }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { stockId, entryPrice, note } = body;

        if (!stockId) {
            return NextResponse.json({ error: 'Stock ID is required' }, { status: 400 });
        }

        const item = await prisma.watchlist.upsert({
            where: { stockId },
            update: {
                entryPrice: entryPrice || undefined,
                note: note || undefined,
                addedAt: new Date()
            },
            create: {
                stockId,
                entryPrice,
                note
            }
        });

        // Invalidate cache
        apiCache.invalidate('watchlist:');
        return NextResponse.json(item);
    } catch (error) {
        console.error('Watchlist POST error:', error);
        return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 });
    }
}
