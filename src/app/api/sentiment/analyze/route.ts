import { getErrorMessage } from '@/lib/error-utils';

import { NextResponse } from 'next/server';
import { newsSentimentService } from '@/lib/services/NewsSentimentService';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        const result = await newsSentimentService.analyze(symbol);
        return NextResponse.json(result);
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
