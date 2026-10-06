import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Aggregate intent signal outcomes by runIntent
    const signals = await prisma.ctoIntentSignal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const byIntent: Record<string, { total: number; success: number; partial: number; failed: number }> = {};

    for (const sig of signals) {
      if (!byIntent[sig.runIntent]) {
        byIntent[sig.runIntent] = { total: 0, success: 0, partial: 0, failed: 0 };
      }
      byIntent[sig.runIntent].total++;
      if (sig.outcome === 'success') byIntent[sig.runIntent].success++;
      else if (sig.outcome === 'partial') byIntent[sig.runIntent].partial++;
      else byIntent[sig.runIntent].failed++;
    }

    const stats = Object.entries(byIntent).map(([intent, counts]) => ({
      intent,
      total:       counts.total,
      successRate: counts.total > 0 ? Math.round((counts.success / counts.total) * 1000) / 10 : 0,
      partialRate: counts.total > 0 ? Math.round((counts.partial / counts.total) * 1000) / 10 : 0,
      failedRate:  counts.total > 0 ? Math.round((counts.failed  / counts.total) * 1000) / 10 : 0,
    }));

    return NextResponse.json({ ok: true, stats, totalSignals: signals.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
