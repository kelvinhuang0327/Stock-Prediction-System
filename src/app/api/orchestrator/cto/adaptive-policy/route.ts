import { NextResponse } from 'next/server';
import { computeAdaptivePolicy, getLatestAdaptivePolicy } from '@/lib/agent-orchestrator/adaptivePolicy';

export async function GET() {
  try {
    const policy = await getLatestAdaptivePolicy();
    if (!policy) {
      return NextResponse.json({ ok: true, policy: null, message: 'No policy computed yet' });
    }
    return NextResponse.json({ ok: true, policy });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const policy = await computeAdaptivePolicy();
    return NextResponse.json({ ok: true, policy });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
