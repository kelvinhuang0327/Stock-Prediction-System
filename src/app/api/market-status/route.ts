
import { NextResponse } from 'next/server';
import { marketStatusService } from '@/lib/services/MarketStatusService';

export async function GET() {
    try {
        const result = await marketStatusService.getStatus();
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
