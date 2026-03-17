import { NextRequest, NextResponse } from 'next/server';

const TWSE_BASE_URL = 'https://openapi.twse.com.tw/v1';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;
    const endpoint = '/' + path.join('/');

    try {
        const response = await fetch(`${TWSE_BASE_URL}${endpoint}`, {
            headers: {
                'Accept': 'application/json',
            },
            next: {
                revalidate: 300, // Cache for 5 minutes
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `TWSE API error: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('TWSE API proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch from TWSE API' },
            { status: 500 }
        );
    }
}
