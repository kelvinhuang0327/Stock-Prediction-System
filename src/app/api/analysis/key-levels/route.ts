
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper for arithmetic mean
const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const codesParam = searchParams.get('codes');

    if (!codesParam) {
        return NextResponse.json({ error: 'Missing codes' }, { status: 400 });
    }

    const codes = codesParam.split(',').map(c => c.trim()).filter(c => c);
    const results: Record<string, any> = {};

    try {
        // Fetch last 60 days of data for each stock
        // Optimization: In real-world, we might do a raw query or parallelize carefully
        for (const code of codes) {
            const quotes = await prisma.stockQuote.findMany({
                where: { stockId: code },
                orderBy: { date: 'desc' },
                take: 60, // Need 60 for MA60
                select: { close: true, high: true, low: true }
            });

            if (quotes.length < 2) {
                results[code] = null;
                continue;
            }

            // 1. Pivot Points (Classic)
            // Based on "Yesterday's" data (Index 0 if latest is today? 
            // Usually DB has closed candles. If 'today' is not closed, Index 0 is yesterday?
            // Let's assume Quotes are "Daily Closes". 
            // If we are Intraday, 'today' quote might stick be forming or missing. 
            // Safe bet: Index 0 is the last COMPLETED day usually.

            const lastCandle = quotes[0];
            const P = (lastCandle.high + lastCandle.low + lastCandle.close) / 3;
            const R1 = (2 * P) - lastCandle.low;
            const S1 = (2 * P) - lastCandle.high;
            const R2 = P + (lastCandle.high - lastCandle.low);
            const S2 = P - (lastCandle.high - lastCandle.low);

            // 2. Moving Averages
            const closes = quotes.map(q => q.close);
            const ma5 = closes.length >= 5 ? avg(closes.slice(0, 5)) : null;
            const ma20 = closes.length >= 20 ? avg(closes.slice(0, 20)) : null;
            const ma60 = closes.length >= 60 ? avg(closes.slice(0, 60)) : null;

            results[code] = {
                pivot: P, r1: R1, s1: S1, r2: R2, s2: S2,
                ma5, ma20, ma60
            };
        }

        return NextResponse.json({ success: true, data: results });
    } catch (error) {
        console.error('KeyLevels API Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
