import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/alerts
export async function GET() {
    try {
        const alerts = await prisma.priceAlert.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(alerts);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }
}

// POST /api/alerts
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { symbol, type, value } = body;

        if (!symbol || !type || !value) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const alert = await prisma.priceAlert.create({
            data: {
                symbol,
                type,
                target: Number(value),
                isActive: true
            }
        });

        return NextResponse.json(alert);
    } catch (error) {
        console.error("Create Alert Error:", error);
        return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
    }
}

// DELETE /api/alerts?id=X
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        await prisma.priceAlert.delete({
            where: { id: Number(id) }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
    }
}
