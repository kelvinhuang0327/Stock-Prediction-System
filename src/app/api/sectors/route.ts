
import { NextResponse } from 'next/server';
import { SectorAnalysisService } from '@/lib/services/SectorAnalysisService';

export async function GET() {
    try {
        const data = await SectorAnalysisService.getSectorRotationData();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
