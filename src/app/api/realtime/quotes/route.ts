
import { NextRequest, NextResponse } from 'next/server';
import { realTimeService } from '@/lib/services/RealTimeService';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const codesParam = searchParams.get('codes');

    if (!codesParam) {
        return NextResponse.json({ error: 'Missing codes parameter' }, { status: 400 });
    }

    const codes = codesParam.split(',').map(c => c.trim()).filter(c => c);

    // Limit to 50 to correspond with batch size safety
    if (codes.length > 50) {
        return NextResponse.json({ error: 'Too many codes (max 50)' }, { status: 400 });
    }

    try {
        const data = await realTimeService.getQuotes(codes);
        return NextResponse.json({ success: true, count: data.length, data });
    } catch (error) {
        console.error('RealTime API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
