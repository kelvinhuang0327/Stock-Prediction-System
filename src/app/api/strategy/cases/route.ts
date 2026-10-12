import { getErrorMessage } from '@/lib/error-utils';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const cases = await prisma.doublingFeatures.findMany({
            orderBy: {
                maxGain: 'desc'
            },
            take: 50
        });

        // If no cases found, check if we need to return empty or fallback
        // For now, return what we have. Frontend handles empty state.

        return NextResponse.json(cases);
    } catch (error: unknown) {
        console.error("Failed to fetch doubling cases:", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
