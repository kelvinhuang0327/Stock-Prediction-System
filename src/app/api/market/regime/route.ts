import { NextResponse } from 'next/server';
import { detectRegime } from '@/lib/market/MarketRegimeEngine';
import { apiCache } from '@/lib/cache';

export async function GET() {
    const cacheKey = 'market:regime';
    const cached = apiCache.get<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    try {
        const result = await detectRegime();
        apiCache.set(cacheKey, result, 300); // 5 min cache
        return NextResponse.json(result);
    } catch (error) {
        console.error('Market regime error:', error);
        return NextResponse.json({
            regime: 'Unknown',
            confidence: 0,
            factors: [],
            dataCoverage: 'insufficient',
            samplePeriod: 'N/A',
            dataPoints: 0,
            last_updated: null,
            limitations: ['市場環境分析服務暫時不可用'],
        });
    }
}
