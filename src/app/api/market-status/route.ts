import { getErrorMessage } from '@/lib/error-utils';

import { NextResponse } from 'next/server';
import { marketStatusService } from '@/lib/services/MarketStatusService';

export async function GET() {
    try {
        const result = await marketStatusService.getStatus();
        return NextResponse.json(result);
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
