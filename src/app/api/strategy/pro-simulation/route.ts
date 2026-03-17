
import { NextResponse } from 'next/server';
import { proTraderSimulationService } from '@/lib/services/ProTraderSimulationService';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { initialCapital, maxDrawdown, style } = body;

        const result = await proTraderSimulationService.runSimulation({
            initialCapital: initialCapital || 1000000,
            maxDrawdown: maxDrawdown || 10,
            style: style || 'TREND'
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
