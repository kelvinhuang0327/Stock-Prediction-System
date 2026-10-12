
// Native fetch in Node 18+ environment
// This service interacts with the undocumented TWSE/MIS API

export interface RealTimeQuote {
    code: string;
    target: string; // e.g., "tse_2330.tw"
    name: string;
    tradeTime: string; // HH:mm:ss
    tradePrice: number;
    tradeVolume: number; // Single tick volume
    accumulatedVolume: number;
    open: number;
    high: number;
    low: number;
    bestBidPrice: number[]; // Top 5
    bestBidVolume: number[]; // Top 5
    bestAskPrice: number[]; // Top 5
    bestAskVolume: number[]; // Top 5
    timestamp: number; // Server timestamp

    // AI Signals
    bidAskImbalance?: number; // -1 to 1 (Positive = Buy Pressure)
    isWhale?: boolean; // True if current Tick Volume > 50
}

export class RealTimeService {
    private cache: Map<string, { data: RealTimeQuote; expires: number }> = new Map();
    private readonly CACHE_TTL = 5000; // 5 seconds (Respecting userDelay: 5000 from API)

    /**
     * Get real-time quotes for a list of stock codes
     * @param codes array of stock codes like ['2330', '2317']
     */
    async getQuotes(codes: string[]): Promise<RealTimeQuote[]> {
        const results: RealTimeQuote[] = [];
        const toFetch: string[] = [];

        // 1. Check Cache
        const now = Date.now();
        for (const code of codes) {
            const cached = this.cache.get(code);
            if (cached && cached.expires > now) {
                results.push(cached.data);
            } else {
                toFetch.push(code);
            }
        }

        if (toFetch.length === 0) return results;

        // 2. Batch Fetch (Max ~50 stocks per request usually)
        // We will simple batch all into one request for now as robust start
        // TSE format: tse_{code}.tw
        // OTC format: otc_{code}.tw (Logic needs to distinguish, but usually we handle TSE first)
        // For simplicity, we assume TSE for 4 digits. Logic can be improved.

        const targets = toFetch.map(c => `tse_${c}.tw`).join('|');
        const epoch = Date.now();
        const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${targets}&_=${epoch}`;

        try {
            console.log(`[RealTimeService] Fetching: ${toFetch.length} stocks...`);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const json = await res.json() as any;

            if (json.msgArray && Array.isArray(json.msgArray)) {
                for (const item of json.msgArray) {
                    const quote = this.parseMisItem(item);
                    if (quote) {
                        results.push(quote);
                        this.cache.set(quote.code, {
                            data: quote,
                            expires: now + this.CACHE_TTL
                        });
                    }
                }
            }
        } catch (error) {
            console.error('[RealTimeService] Fetch error:', error);
            // Return whatever we have if fetch fails
        }

        return results;
    }

    private parseMisItem(item: any): RealTimeQuote | null {
        try {
            // "z": Recent Trade Price
            // "tv": Trade Volume (Tick)
            // "v": Accumulated Volume
            // "a": Best Ask Prices (underscore separated)
            // "b": Best Bid Prices
            // "f": Best Ask Volumes
            // "g": Best Bid Volumes

            const code = item.c;
            const name = item.n;
            const tradePrice = this.parseNum(item.z);

            // If no trade price (e.g. pre-market), use yesterday close (y) or open (o)
            const backupPrice = this.parseNum(item.o) || this.parseNum(item.y);
            const finalPrice = tradePrice > 0 ? tradePrice : backupPrice;

            const bestBidPrice = this.parseList(item.b);
            const bestBidVolume = this.parseList(item.g);
            const bestAskPrice = this.parseList(item.a);
            const bestAskVolume = this.parseList(item.f);
            const tradeVolume = this.parseNum(item.tv);

            // AI Signals Logic
            // 1. Order Imbalance: (Bid - Ask) / (Bid + Ask)
            const totalBid = bestBidVolume.reduce((a, b) => a + b, 0);
            const totalAsk = bestAskVolume.reduce((a, b) => a + b, 0);
            const totalDepth = totalBid + totalAsk;
            const imbalance = totalDepth > 0 ? (totalBid - totalAsk) / totalDepth : 0;

            // 2. Whale Detection
            // Threshold: > 50 lots (50,000 shares) single tick
            const isWhale = tradeVolume >= 50;

            return {
                code,
                target: item.ch,
                name,
                tradeTime: item.t,
                tradePrice: finalPrice,
                tradeVolume,
                accumulatedVolume: this.parseNum(item.v),
                open: this.parseNum(item.o),
                high: this.parseNum(item.h),
                low: this.parseNum(item.l),
                bestBidPrice,
                bestBidVolume,
                bestAskPrice,
                bestAskVolume,
                timestamp: parseInt(item.tlong || Date.now().toString()),
                bidAskImbalance: imbalance,
                isWhale
            };
        } catch (e) {
            return null;
        }
    }

    private parseNum(val: string): number {
        if (!val || val === '-') return 0;
        return parseFloat(val);
    }

    private parseList(val: string): number[] {
        if (!val) return [];
        return val.split('_').filter(x => x).map(x => parseFloat(x));
    }
}

export const realTimeService = new RealTimeService();
