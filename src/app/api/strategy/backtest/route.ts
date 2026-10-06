import { getErrorMessage } from '@/lib/error-utils';
import { NextResponse } from 'next/server';
import { doublingBacktestService } from '@/lib/services/DoublingBacktestService';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : 30;
    const horizon = searchParams.get('horizon') ? parseInt(searchParams.get('horizon')!) : 10;

    try {
        const results = await doublingBacktestService.runBacktest(days, horizon);
        return NextResponse.json(results);
    } catch (error: unknown) {
        console.error('Backtest API error:', error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
