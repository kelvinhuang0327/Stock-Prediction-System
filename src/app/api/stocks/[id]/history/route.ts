import { NextRequest, NextResponse } from 'next/server';
import { twseApi } from '@/lib/api/twseApi';

// GET /api/stocks/[id]/history?months=6
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } // In Next.js 15+, params is a Promise
) {
    const { id: code } = await params;

    // Get months from query param
    const searchParams = request.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '6');

    try {
        const history = await twseApi.getHistorySeries(code, months);
        return NextResponse.json(history);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch history' },
            { status: 500 }
        );
    }
}
