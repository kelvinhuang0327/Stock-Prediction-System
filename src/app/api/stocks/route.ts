import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;
    const search = searchParams.get('search') || '';

    try {
        const where = search ? {
            OR: [
                { id: { contains: search } },
                { name: { contains: search } },
            ]
        } : {};

        const [stocks, total] = await Promise.all([
            prisma.stock.findMany({
                where,
                include: {
                    quotes: {
                        orderBy: { date: 'desc' },
                        take: 1, // Get latest quote
                    },
                    metrics: {
                        orderBy: { date: 'desc' },
                        take: 1, // Get latest metrics
                    }
                },
                take: limit,
                skip: skip,
            }),
            prisma.stock.count({ where })
        ]);

        return NextResponse.json({
            data: stocks.map(s => ({
                code: s.id,
                name: s.name,
                industry: s.industry,
                price: s.quotes[0]?.close,
                change: s.quotes[0]?.change,
                volume: s.quotes[0]?.volume,
                pe: s.metrics[0]?.pe,
                yield: s.metrics[0]?.dividendYield,
                lastUpdated: s.quotes[0]?.date,
            })),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Stocks API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stocks' },
            { status: 500 }
        );
    }
}
