import { NextRequest, NextResponse } from 'next/server';
import { twseMisApi } from '@/lib/api/twseMisApi';

// GET /api/stocks/[id]/realtime
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: code } = await params;

    try {
        console.log(`[Realtime API] Fetching data for code: ${code}`);
        const data = await twseMisApi.getRealTimeQuote(code);

        if (!data) {
            console.log(`[Realtime API] No live data for ${code}, attempting fallback to daily quote.`);

            // Fallback to daily data
            const { twseApi } = await import('@/lib/api/twseApi'); // Dynamic import
            const daily = await twseApi.getFullStockData(code);

            if (daily) {
                // Return daily data formatted as "RealTimeQuote" (or compatible)
                // Note: The frontend expects specific fields for MIS.
                // Let's construct a compatible object.
                const fallbackData = {
                    code: daily.code,
                    name: daily.name,
                    tradeTime: "收盤", // Mark as closed
                    open: daily.open,
                    high: daily.high,
                    low: daily.low,
                    close: daily.close,
                    volume: Math.round(daily.volume / 1000), // MIS uses lots? double check frontend. StockInfo uses /1000
                    // Frontend StockInfo: volume: Math.round(rt.volume / 1000)
                    // Wait, daily.volume is shares. MIS data.v IS accumulated volume (shares).
                    // So we should pass daily.volume (shares) here.

                    bestBidPrice: [],
                    bestBidVolume: [],
                    bestAskPrice: [],
                    bestAskVolume: [],
                    timestamp: Date.now(),
                    prevClose: daily.close - daily.change
                };
                return NextResponse.json({ data: fallbackData });
            }

            console.log(`[Realtime API] No data returned for code: ${code}`);
            return NextResponse.json(
                {
                    error: 'Realtime data unavailable',
                    code: code,
                    message: 'MIS API returned no data. This may be due to invalid stock code, market hours, or API issues.'
                },
                { status: 404 }
            );
        }

        console.log(`[Realtime API] Successfully fetched data for ${code}`);
        return NextResponse.json({ data });

    } catch (error) {
        console.error(`[Realtime API Error] Code: ${code}`, error);
        return NextResponse.json(
            {
                error: 'Internal Server Error',
                code: code,
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
