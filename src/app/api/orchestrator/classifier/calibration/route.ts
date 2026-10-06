import { NextResponse } from 'next/server';
import {
  getClassifierThresholds,
  updateClassifierThresholds,
} from '@/lib/agent-orchestrator/classifierCalibration';
import type { ClassifierThresholdsConfig } from '@/lib/agent-orchestrator/ctoTypes';

export async function GET() {
  try {
    const thresholds = await getClassifierThresholds();
    return NextResponse.json({ ok: true, thresholds });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const allowed: (keyof ClassifierThresholdsConfig)[] = [
      'coldWinRateMin',
      'saturationDeltaMax',
      'coldMinTrades',
      'weightWinRate',
      'weightTrendDelta',
      'weightDataCoverage',
    ];

    const patch: Partial<ClassifierThresholdsConfig> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        patch[key] = Number(body[key]) as never;
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: 'no valid fields to update' }, { status: 400 });
    }

    await updateClassifierThresholds(patch);
    const updated = await getClassifierThresholds();
    return NextResponse.json({ ok: true, thresholds: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
