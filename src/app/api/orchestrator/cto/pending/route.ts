import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/orchestrator/cto/pending
 * Returns proposals in state approved|triggered with no CTO decision yet.
 * Mirrors LotteryNew /api/orchestrator/cto/pending
 */
export async function GET() {
  try {
    const pending = await prisma.strategyProposal.findMany({
      where: {
        state:       { in: ['approved', 'triggered'] },
        ctoDecision: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id:         true,
        symbol:     true,
        setupType:  true,
        conviction: true,
        state:      true,
        createdAt:  true,
      },
    });

    const rows = pending.map((p) => ({
      task_id:          `proposal-${p.id}`,
      task_title:       `${p.symbol} ${p.setupType}`,
      integration_group: p.setupType,
      review_priority:  Number(p.conviction) >= 0.8 ? 'HIGH' : Number(p.conviction) >= 0.5 ? 'MEDIUM' : 'LOW',
      source_branch:    `proposal/${p.symbol}-${p.id}`,
      commit_sha:       p.id.toString(16).padStart(12, '0').slice(0, 12),
      conviction:       p.conviction,
      state:            p.state,
      created_at:       p.createdAt,
    }));

    return NextResponse.json({ ok: true, rows, count: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
