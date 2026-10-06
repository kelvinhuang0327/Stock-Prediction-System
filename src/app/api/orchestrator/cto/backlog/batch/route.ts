import { NextResponse } from 'next/server';
import { batchInsertBacklogItems } from '@/lib/agent-orchestrator/backlogService';
import type { BacklogItemInput } from '@/lib/agent-orchestrator/ctoTypes';

/**
 * POST /api/orchestrator/cto/backlog/batch
 * Add multiple findings to the backlog in one request.
 * Body: { run_id?, findings: [{ finding_id, severity, impact_score, urgency, category, suggested_action }] }
 * Mirrors LotteryNew cto-batch-backlog-btn handler.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      run_id?: string;
      findings?: Array<Record<string, unknown>>;
    };

    const findings = body.findings ?? [];
    if (!Array.isArray(findings) || findings.length === 0) {
      return NextResponse.json({ ok: false, error: 'findings array required' }, { status: 400 });
    }

    const inputs: BacklogItemInput[] = findings.map((f) => ({
      findingId:      String(f.finding_id ?? f.findingId ?? `batch-${Date.now()}-${Math.random()}`),
      ctoRunId:       String(f.cto_run_id ?? f.ctoRunId ?? body.run_id ?? '') || undefined,
      source:         'review' as const,
      severity:       (f.severity       ?? 'HIGH')    as BacklogItemInput['severity'],
      impactScore:    Number(f.impact_score ?? f.impactScore ?? 70),
      urgency:        (f.urgency         ?? 'SOON')   as BacklogItemInput['urgency'],
      category:       (f.category        ?? 'signal') as BacklogItemInput['category'],
      suggestedAction: String(f.suggested_action ?? f.suggestedAction ?? '') || undefined,
    }));

    const created = await batchInsertBacklogItems(inputs);

    return NextResponse.json({ ok: true, created, count: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
