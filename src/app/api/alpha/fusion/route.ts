import { NextRequest, NextResponse } from 'next/server';
import { fuseSignals, fuseBatch } from '@/lib/alpha/SignalFusionEngine';
import { apiCache } from '@/lib/cache';

/**
 * POST /api/alpha/fusion
 * Body: { symbol: string } or { symbols: string[] }
 * 
 * Returns AlphaScore fusion result(s).
 * Single symbol → single result. Multiple symbols → array.
 */
export async function POST(request: NextRequest) {
    let body: { symbol?: string; symbols?: string[] };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: '無效的請求格式' }, { status: 400 });
    }

    // Batch mode
    if (body.symbols && Array.isArray(body.symbols)) {
        const symbols = body.symbols.slice(0, 30); // cap batch size
        const cacheKey = `alpha:batch:${symbols.sort().join(',')}`;
        const cached = apiCache.get<any>(cacheKey);
        if (cached) return NextResponse.json(cached);

        try {
            const results = await fuseBatch(symbols);
            const response = {
                data: results,
                count: results.length,
                disclaimer: 'AlphaScore 為候選研究評分，非交易指令。所有分數基於規則計算，不保證未來績效。',
            };
            apiCache.set(cacheKey, response, 180);
            return NextResponse.json(response);
        } catch (error) {
            console.error('Alpha fusion batch error:', error);
            return NextResponse.json({ error: '融合分析失敗' }, { status: 500 });
        }
    }

    // Single mode
    const symbol = body.symbol;
    if (!symbol) {
        return NextResponse.json({ error: '缺少 symbol 參數' }, { status: 400 });
    }

    const cacheKey = `alpha:fusion:${symbol}`;
    const cached = apiCache.get<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    try {
        const result = await fuseSignals(symbol);
        apiCache.set(cacheKey, result, 180);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Alpha fusion error:', error);
        return NextResponse.json({ error: '融合分析失敗' }, { status: 500 });
    }
}
