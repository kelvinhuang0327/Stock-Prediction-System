/**
 * P0-02A: as-of gate integrated.
 * asOfDate query param enforces date <= asOfDate for all DB queries.
 * No strategy mutation. No performance claims. Research tool only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runScreen, ScreenParams } from '@/lib/screen/StrategyScreenEngine';
import { apiCache } from '@/lib/cache';
import { resolveAsOfDate } from '@/lib/data/AsOfDataGate';

/**
 * GET /api/strategy/screen
 * Quick candidate screen with query params.
 * Supports asOfDate param to enforce data gate (default: current date).
 *
 * POST /api/strategy/screen
 * Full candidate screen with body params.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    // P0-02A: resolve asOfDate (default = current date via resolveAsOfDate)
    const asOfDateRaw = searchParams.get('asOfDate') ?? undefined;
    const asOfDate = resolveAsOfDate(asOfDateRaw);

    const params: ScreenParams = {
        minAlphaScore: searchParams.has('minAlphaScore') ? Number(searchParams.get('minAlphaScore')) : undefined,
        minConfidence: searchParams.has('minConfidence') ? Number(searchParams.get('minConfidence')) : undefined,
        maxResults: searchParams.has('maxResults') ? Number(searchParams.get('maxResults')) : undefined,
        respectMarketRegime: searchParams.get('respectMarketRegime') !== 'false',
        // P0-02A: pass asOf to engine so all DB queries are capped at asOfDate
        asOf: asOfDate.replace(/-/g, ''),
    };

    const cacheKey = `screen:${JSON.stringify(params)}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    try {
        const result = await runScreen(params);
        const response = {
            ...result,
            // P0-02A: as-of gate metadata
            asOfDate,
            asOfGateStatus: 'ACTIVE',
            asOfGateNote: 'All DB queries capped at asOfDate. Future-date rows excluded. Research tool only.',
        };
        apiCache.set(cacheKey, response, 180);
        return NextResponse.json(response);
    } catch (error) {
        console.error('Strategy screen error:', error);
        return NextResponse.json({ error: '候選股篩選失敗' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    let body: ScreenParams & { asOfDate?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: '無效的請求格式' }, { status: 400 });
    }

    // P0-02A: resolve asOfDate from body
    const asOfDate = resolveAsOfDate(body.asOfDate ?? undefined);
    const screenParams: ScreenParams = {
        ...body,
        asOf: asOfDate.replace(/-/g, ''),
    };

    const cacheKey = `screen:post:${JSON.stringify(screenParams)}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    try {
        const result = await runScreen(screenParams);
        const response = {
            ...result,
            asOfDate,
            asOfGateStatus: 'ACTIVE',
            asOfGateNote: 'All DB queries capped at asOfDate. Future-date rows excluded. Research tool only.',
        };
        apiCache.set(cacheKey, response, 180);
        return NextResponse.json(response);
    } catch (error) {
        console.error('Strategy screen error:', error);
        return NextResponse.json({ error: '候選股篩選失敗' }, { status: 500 });
    }
}
