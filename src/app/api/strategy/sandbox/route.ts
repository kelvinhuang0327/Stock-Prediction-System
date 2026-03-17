
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'sandbox_discoveries.json');

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({
                top_discoveries: [],
                message: 'No sandbox discoveries found yet.'
            });
        }

        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
