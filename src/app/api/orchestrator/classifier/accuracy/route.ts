import { NextResponse } from 'next/server';
import { computeClassifierAccuracy } from '@/lib/agent-orchestrator/classifierCalibration';

export async function GET() {
  try {
    const report = await computeClassifierAccuracy();
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
