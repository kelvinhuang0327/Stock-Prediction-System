import { NextResponse } from 'next/server';
import { SchedulerStateEngine } from '@/lib/jobs/SchedulerStateEngine';

const engine = new SchedulerStateEngine();

export async function GET() {
  try {
    const now = new Date();
    const status = await engine.getStatus(now);
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
