import { getErrorMessage } from '@/lib/error-utils';

import { NextResponse } from 'next/server';
import { SectorAnalysisService } from '@/lib/services/SectorAnalysisService';

export async function GET() {
    try {
        const data = await SectorAnalysisService.getSectorRotationData();
        return NextResponse.json(data);
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
