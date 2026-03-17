
import { NextResponse } from 'next/server';
import { strategyScreeningService } from '@/lib/services/StrategyScreeningService';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const id = params.id;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;

    try {
        const result = await strategyScreeningService.analyzeStock(id, date);
        if (!result) {
            return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
        }
        return NextResponse.json(result);
    } catch (error) {
        console.error(`Error analyzing stock ${id}:`, error);
        return NextResponse.json({ error: 'Failed to analyze stock' }, { status: 500 });
    }
}
