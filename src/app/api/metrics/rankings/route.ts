
import { NextResponse } from 'next/server';
import { strategyScreeningService } from '@/lib/services/StrategyScreeningService';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric') || 'rsi';
    const limit = parseInt(searchParams.get('limit') || '3');
    const asOfDate = searchParams.get('date') || undefined;

    try {
        const rankings = await strategyScreeningService.getMetricRankings(metric, limit, asOfDate);
        return NextResponse.json(rankings);
    } catch (error) {
        console.error('Error fetching rankings:', error);
        return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 });
    }
}
