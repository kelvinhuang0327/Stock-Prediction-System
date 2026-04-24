import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rescoreAllBacklogItems } from '@/lib/agent-orchestrator/backlogService';

export async function POST() {
  try {
    const before = await prisma.ctoBacklogItem.count({ where: { status: 'open', agingBonus: { gt: 0 } } });
    await rescoreAllBacklogItems();
    const after = await prisma.ctoBacklogItem.count({ where: { status: 'open', agingBonus: { gt: 0 } } });
    const aged_count = Math.max(after, before);
    return NextResponse.json({ ok: true, aged_count });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
