/**
 * GET /api/research/experiments
 *
 * Returns the Research Experiment Registry — all tracked research hypotheses
 * with status, evidence level, blockers, and recommended next steps.
 *
 * Enriched with Wave 7 ResearchGapsReport: experiments linked to active gaps
 * receive dynamic findings and (for HIGH gaps) status downgrades.
 *
 * Query params (all optional):
 *   status   — filter by ExperimentStatus (e.g. BLOCKED, IDEA)
 *   area     — filter by ExperimentArea (e.g. signal, regime)
 *   priority — filter by ExperimentPriority (HIGH, MEDIUM, LOW)
 *
 * Cache: 300s. Degraded mode returns status 200 with conservative registry.
 *
 * This is a RESEARCH TRANSPARENCY endpoint only — no trading logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildSignalEffectivenessBatch,
  buildDegradedSignalEffectivenessBatch,
} from '@/lib/signals/SignalEffectivenessBatchService';
import { getMarketEventSummary } from '@/lib/events/EventSummaryEngine';
import { buildResearchGapsReport } from '@/lib/research/ResearchCoverageEngine';
import {
  buildExperimentRegistry,
} from '@/lib/research/ExperimentRegistry';
import type {
  ExperimentStatus,
  ExperimentArea,
  ExperimentPriority,
  ExperimentRegistry,
} from '@/lib/research/ExperimentRegistry';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // ── Fetch coverage data (same parallel pattern as /api/research/coverage) ──
    const [signalBatch, taiexRowCount, regimeSnapshotCount, eventRes] = await Promise.all([
      buildSignalEffectivenessBatch({ window: 5 }).catch(() =>
        buildDegradedSignalEffectivenessBatch(5, undefined, 'signal batch unavailable for experiment registry'),
      ),
      prisma.marketIndex.count({ where: { name: 'TAIEX' } }).catch(() => 0),
      prisma.dailyMarketSnapshot.count().catch(() => 0),
      getMarketEventSummary({ days: 1, limit: 30 }).catch(() => null),
    ]);

    const eventSourceQuality = eventRes?.summary.sourceQuality ?? null;

    // ── Build enriched registry ────────────────────────────────────────────────
    const gapsReport = buildResearchGapsReport({
      signalBatch,
      eventSourceQuality,
      taiexRowCount,
      regimeSnapshotCount,
    });

    let registry: ExperimentRegistry = buildExperimentRegistry(gapsReport);

    // ── Apply optional query filters ──────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') as ExperimentStatus | null;
    const areaFilter = searchParams.get('area') as ExperimentArea | null;
    const priorityFilter = searchParams.get('priority') as ExperimentPriority | null;

    if (statusFilter || areaFilter || priorityFilter) {
      const filtered = registry.experiments.filter((exp) => {
        if (statusFilter && exp.status !== statusFilter) return false;
        if (areaFilter && exp.area !== areaFilter) return false;
        if (priorityFilter && exp.priority !== priorityFilter) return false;
        return true;
      });
      registry = { ...registry, experiments: filtered };
    }

    return NextResponse.json(registry, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    // ── Degraded mode: return conservative registry without enrichment ─────────
    const degradedRegistry = buildExperimentRegistry(null);

    return NextResponse.json(
      {
        ...degradedRegistry,
        limitations: [
          'experiment registry data fetch failed — returning conservative defaults',
          error instanceof Error ? error.message : '未知錯誤',
        ],
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
