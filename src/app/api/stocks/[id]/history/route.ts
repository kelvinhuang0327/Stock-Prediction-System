import { NextRequest, NextResponse } from 'next/server';
import { twseApi } from '@/lib/api/twseApi';
import { resolveAsOfDate } from '@/lib/data/AsOfDataGate';

// GET /api/stocks/[id]/history?months=6&asOfDate=YYYY-MM-DD
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } // In Next.js 15+, params is a Promise
) {
    const { id: code } = await params;

    // Get months from query param
    const searchParams = request.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '6');

    // P0-03: as-of gate — filter response rows to date <= asOfDate.
    // This route proxies an external API (twseApi) and cannot gate at the source.
    // Mitigation: filter the returned array client-side before returning to caller.
    const asOfDate = resolveAsOfDate(searchParams.get('asOfDate') ?? undefined);

    try {
        const history = await twseApi.getHistorySeries(code, months);

        // Apply response-level as-of filter. twseApi returns dates as YYYY-MM-DD.
        // Lexicographic comparison works correctly for ISO dates.
        const gatedHistory = history.filter((row: { date: string }) => row.date <= asOfDate);
        const futureRowsExcluded = history.length - gatedHistory.length;

        return NextResponse.json({
            data: gatedHistory,
            asOfGateStatus: futureRowsExcluded > 0 ? 'WARN' : 'PASS',
            asOfDate,
            futureRowsExcluded,
            asOfGateNote: 'P0-03: history route applies response-level date filter. Source is external TWSE API (cannot gate at origin).',
            limitation: 'This route proxies an external API. As-of gate is applied post-fetch, not at the data source. External API may return future-date rows which are excluded from the response.',
        });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch history' },
            { status: 500 }
        );
    }
}
