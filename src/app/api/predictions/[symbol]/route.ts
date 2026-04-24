import { NextRequest, NextResponse } from 'next/server';
import { predictionEngine } from '@/lib/services/PredictionEngine';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params;

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        const result = await predictionEngine.predict(symbol);

        if (!result) {
            return NextResponse.json({ error: 'Could not generate prediction' }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Prediction API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
