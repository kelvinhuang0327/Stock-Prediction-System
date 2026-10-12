import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID_MODES = ['strict_priority', 'balanced', 'fairness'] as const;
type PolicyMode = typeof VALID_MODES[number];

const POLICY_CONSTANTS = { fairness_every_n: 7, aging_interval_hours: 6, aging_pts_per_interval: 3, aging_pts_max: 30 };

async function getMode(): Promise<PolicyMode> {
  const row = await prisma.orchestratorSetting.findUnique({ where: { key: 'cto_execution_policy_mode' } });
  const val = row?.value ?? 'balanced';
  return (VALID_MODES as readonly string[]).includes(val) ? (val as PolicyMode) : 'balanced';
}

export async function GET() {
  try {
    const mode = await getMode();

    // Queue stats from open backlog items
    const openItems = await prisma.ctoBacklogItem.findMany({
      where: { status: 'open' },
      select: { priorityLevel: true, category: true, lastSelectedAt: true, agingBonus: true },
    });

    const queue_by_level: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    const queue_by_category: Record<string, number> = {};
    let aging_items_count = 0;

    for (const item of openItems) {
      const lvl = item.priorityLevel ?? 'P2';
      queue_by_level[lvl] = (queue_by_level[lvl] ?? 0) + 1;
      queue_by_category[item.category] = (queue_by_category[item.category] ?? 0) + 1;
      if ((item.agingBonus ?? 0) > 0) aging_items_count++;
    }

    // Recent selections from lastSelectedAt items (last 10 that have been selected)
    const selected = await prisma.ctoBacklogItem.findMany({
      where: { lastSelectedAt: { not: null } },
      orderBy: { lastSelectedAt: 'desc' },
      take: 10,
      select: { priorityLevel: true, category: true, lastSelectedAt: true },
    });
    const recent_selections = selected.map((s) => ({ level: s.priorityLevel, category: s.category }));

    return NextResponse.json({
      ok: true,
      mode,
      queue_by_level,
      queue_by_category,
      recent_selections,
      policy_constants:         POLICY_CONSTANTS,
      consecutive_high:         0,
      consecutive_category:     null,
      consecutive_category_count: 0,
      aging_items_count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { mode?: string };
    const mode = body.mode;
    if (!mode || !(VALID_MODES as readonly string[]).includes(mode)) {
      return NextResponse.json({ ok: false, error: `mode must be one of: ${VALID_MODES.join(', ')}` }, { status: 400 });
    }

    const now = new Date();
    await prisma.orchestratorSetting.upsert({
      where:  { key: 'cto_execution_policy_mode' },
      update: { value: mode, updatedAt: now },
      create: { key: 'cto_execution_policy_mode', value: mode, updatedAt: now },
    });

    return NextResponse.json({ ok: true, mode });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
