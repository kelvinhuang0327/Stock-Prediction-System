import { NextRequest, NextResponse } from 'next/server';
import { runScreen, ScreenParams } from '@/lib/screen/StrategyScreenEngine';
import { apiCache } from '@/lib/cache';

/**
 * GET /api/strategy/screen
 * Quick candidate screen with query params.
 *
 * POST /api/strategy/screen
 * Full candidate screen with body params.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const params: ScreenParams = {
        minAlphaScore: searchParams.has('minAlphaScore') ? Number(searchParams.get('minAlphaScore')) : undefined,
        minConfidence: searchParams.has('minConfidence') ? Number(searchParams.get('minConfidence')) : undefined,
        maxResults: searchParams.has('maxResults') ? Number(searchParams.get('maxResults')) : undefined,
        respectMarketRegime: searchParams.get('respectMarketRegime') !== 'false',
    };

    const cacheKey = `screen:${JSON.stringify(params)}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    try {
        const result = await runScreen(params);
        apiCache.set(cacheKey, result, 180);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Strategy screen error:', error);
        return NextResponse.json({ error: '候選股篩選失敗' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    let body: ScreenParams;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: '無效的請求格式' }, { status: 400 });
    }

    const cacheKey = `screen:post:${JSON.stringify(body)}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    try {
        const result = await runScreen(body);
        apiCache.set(cacheKey, result, 180);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Strategy screen error:', error);
        return NextResponse.json({ error: '候選股篩選失敗' }, { status: 500 });
    }
}
