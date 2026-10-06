
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        const scriptPath = path.join(process.cwd(), 'scripts/ai_agents/single_stock_jury.py');
        const pythonPath = 'python3';

        // Ensure the script exists
        const { stdout, stderr } = await execPromise(`PYTHONPATH=. ${pythonPath} ${scriptPath} ${symbol}`);

        if (stderr && !stdout) {
            console.error('Python Error:', stderr);
            return NextResponse.json({ error: 'Failed to run jury analysis' }, { status: 500 });
        }

        const result = JSON.parse(stdout);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Jury API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
