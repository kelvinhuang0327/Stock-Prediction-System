import { NextRequest, NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';
import { analyzeStock, StockAnalysisResult } from '@/lib/analysis/RuleBasedStockAnalyzer';

/**
 * POST /api/strategy/analyze
 *
 * 個股分析 API — 委託 RuleBasedStockAnalyzer 執行。
 * 永遠回傳完整 JSON，資料不足時降級而非回傳 null。
 */
export async function POST(request: NextRequest) {
    try {
        const { symbol } = await request.json();
        if (!symbol) {
            return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
        }

        const cacheKey = `analyze:${symbol}`;
        const cached = apiCache.get<StockAnalysisResult>(cacheKey);
        if (cached) return NextResponse.json(cached);

        const result = await analyzeStock(symbol);
        apiCache.set(cacheKey, result, 180);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Analysis API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
