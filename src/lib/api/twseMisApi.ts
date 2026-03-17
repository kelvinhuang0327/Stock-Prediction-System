/**
 * TWSE MIS API Client
 * 台灣證券交易所 基本市況報導網站 API
 * Target: https://mis.twse.com.tw/
 */

export interface RealTimeQuote {
    code: string;       // c
    name: string;       // n
    tradeTime: string;  // t (Trading Time)
    open: number;       // o
    high: number;       // h
    low: number;        // l
    close: number;      // z (Latest trade price)
    volume: number;     // v (Latest trade volume - accumulated?) Usually 'v' is accum volume in MIS? No, 'v' is total volume.
    // MIS specific fields
    bestBidPrice: number[]; // b (5 levels)
    bestBidVolume: number[]; // g (5 levels)
    bestAskPrice: number[]; // a (5 levels)
    bestAskVolume: number[]; // f (5 levels)
    timestamp: number;
    prevClose: number; // y (Yesterday closing price)
}

class TWSEMISApiClient {
    private baseUrl = 'https://mis.twse.com.tw/stock';

    // Helper to sleep/delay
    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get real-time stock info
     * @param code Stock code (e.g. '2330', 't00', 'o00')
     */
    async getRealTimeQuote(code: string): Promise<RealTimeQuote | null> {
        try {
            // Timestamp to prevent caching
            const ts = Date.now();

            // Channel ID logic
            let type = 'tse';
            if (code === 'o00') type = 'otc'; // OTC Index

            const ch = `${type}_${code}.tw`;

            const url = `${this.baseUrl}/api/getStockInfo.jsp?ex_ch=${ch}&json=1&delay=0&_=${ts}`;

            console.log(`[MIS API] Fetching: ${url}`);
            const response = await fetch(url);

            if (!response.ok) {
                console.error(`[MIS API] Failed: ${response.status}`);
                return null;
            }

            const json = await response.json();

            // Response wrapper: { msgArray: [ ... ], ... }
            if (!json.msgArray || json.msgArray.length === 0) {
                return null;
            }

            const data = json.msgArray[0];

            // Map fields
            // c: code, n: name, z: price, tv: trade vol, v: total vol, o: open, h: high, l: low, t: time, y: prev close

            const parsePrice = (v: string) => isNaN(parseFloat(v)) || v === '-' ? 0 : parseFloat(v);

            const prevClose = parsePrice(data.y);

            return {
                code: data.c,
                name: data.n,
                tradeTime: data.t,
                open: parsePrice(data.o),
                high: parsePrice(data.h),
                low: parsePrice(data.l),
                close: parsePrice(data.z),
                volume: parseInt(data.v || '0'),
                bestBidPrice: (data.b || '').split('_').map(parsePrice).filter((p: number) => p > 0),
                bestBidVolume: (data.g || '').split('_').map((v: string) => parseInt(v)).filter((v: number) => !isNaN(v)),
                bestAskPrice: (data.a || '').split('_').map(parsePrice).filter((p: number) => p > 0),
                bestAskVolume: (data.f || '').split('_').map((v: string) => parseInt(v)).filter((v: number) => !isNaN(v)),
                timestamp: parseInt(data.tlong || Date.now().toString()),
                prevClose: prevClose
            };

        } catch (error) {
            console.error('[MIS API] Error:', error);

            // Fallback: If live data fails (e.g.blocked), try getting latest daily data
            try {
                // Import dynamically to avoid circular dependency if possible, or move this logic out
                // For simplicity, we can't easily import twseApi here if they depend on each other.
                // But twseApi.ts depends on nothing.
                // Let's return null and let the caller handle fallback, OR implementation a stronger fallback here.

                // Returning null causes 404 in the API route.
                // Let's make the API route handle the fallback.
                return null;
            } catch (e) {
                return null;
            }
        }
    }
}

export const twseMisApi = new TWSEMISApiClient();
