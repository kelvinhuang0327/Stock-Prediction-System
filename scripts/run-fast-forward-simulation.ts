/**
 * run-fast-forward-simulation.ts
 *
 * Advances the autonomous trading simulation across N calendar days without
 * waiting for real market data.  Each simulated "day" calls closeOpenTrades()
 * with the simulated date so holdingDays accumulate correctly and time/stop/
 * target exits trigger as if those days had passed.
 *
 * After all days are processed, the script runs the review cycle and the
 * learning cycle once to activate the learning layer.
 *
 * Usage:
 *   npm run autonomous:fast-forward -- --days=15
 *   npm run autonomous:fast-forward -- --days=20 --start-date=2026-04-18
 *   npm run autonomous:fast-forward -- --days=10 --dry-run
 *
 * Flags:
 *   --days=N          Number of calendar days to simulate (default: 20)
 *   --start-date=D    Starting date in YYYY-MM-DD (default: tomorrow UTC)
 *   --dry-run         Print plan without executing anything
 *   --interval-ms=N   Pause between days in ms for log readability (default: 0)
 */

import { closeOpenTrades, promoteShadowTrades } from '../src/lib/autonomous/SimulationExecutionEngine';
import { runAutonomousReviewCycle, runAutonomousLearningCycle } from '../src/lib/jobs/autonomousJobRunners';
import { prisma } from '../src/lib/prisma';

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

function getFlag(name: string, fallback: string): string {
  const raw = process.argv.find((a) => a.startsWith(`${name}=`));
  return raw ? raw.split('=').slice(1).join('=') : fallback;
}

function parseStartDate(): Date {
  const raw = getFlag('--start-date', '');
  if (raw) {
    const d = new Date(`${raw}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  // Default: start from tomorrow UTC
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow;
}

const NUM_DAYS = Math.max(1, Number(getFlag('--days', '20')));
const START_DATE = parseStartDate();
const DRY_RUN = process.argv.includes('--dry-run');
const INTERVAL_MS = Math.max(0, Number(getFlag('--interval-ms', '0')));

function addDays(base: Date, n: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// State snapshot helper
// ---------------------------------------------------------------------------

async function getSimState() {
  const [trades, reviews, insights] = await Promise.all([
    prisma.simulatedTrade.findMany({
      select: { id: true, symbol: true, status: true, holdingDays: true, pnlPct: true, exitReason: true, setupType: true, tradeMode: true },
    }),
    prisma.tradeReviewReport.count(),
    prisma.strategyLearningInsight.count(),
  ]);

  const open = trades.filter((t) => t.status === 'open' || t.status === 'shadow-open');
  const closed = trades.filter((t) => t.status === 'closed' || t.status === 'shadow-closed');
  const pnls = closed.map((t) => t.pnlPct ?? 0);
  const avgPnl = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;

  return {
    total: trades.length,
    open: open.length,
    closed: closed.length,
    reviews,
    insights,
    avgPnl: parseFloat(avgPnl.toFixed(2)),
  };
}

// ---------------------------------------------------------------------------
// Main simulation loop
// ---------------------------------------------------------------------------

async function main() {
  const sessionStart = Date.now();

  const initialState = await getSimState();
  console.log(JSON.stringify({ event: 'simulation_start', config: { numDays: NUM_DAYS, startDate: START_DATE.toISOString(), dryRun: DRY_RUN }, initialState }, null, 2));

  if (DRY_RUN) {
    console.log('\nDRY RUN — simulation plan:');
    for (let d = 0; d < NUM_DAYS; d++) {
      const simDate = addDays(START_DATE, d);
      console.log(`  Day ${d + 1}: ${simDate.toISOString().slice(0, 10)}`);
    }
    return;
  }

  // ── Phase 1: Day-by-day trade closure loop ─────────────────────────────

  let totalClosed = 0;
  const closedPerDay: Array<{ day: number; simDate: string; closed: number; evaluated: number }> = [];

  for (let d = 0; d < NUM_DAYS; d++) {
    const simDate = addDays(START_DATE, d);
    const dayLabel = simDate.toISOString().slice(0, 10);

    // Promote eligible shadow trades before closing (Fix 2)
    await promoteShadowTrades();
    const result = await closeOpenTrades({
      simulationDate: simDate,
      bypassFreshnessGuard: true,
    });

    totalClosed += result.closed;
    closedPerDay.push({ day: d + 1, simDate: dayLabel, closed: result.closed, evaluated: result.evaluated });

    if (result.closed > 0 || result.evaluated > 0) {
      console.log(JSON.stringify({ event: 'sim_day', day: d + 1, date: dayLabel, evaluated: result.evaluated, closed: result.closed }));
    }

    // Check termination: if no open trades remain, stop early
    const remaining = await prisma.simulatedTrade.count({ where: { status: { in: ['open', 'shadow-open'] } } });
    if (remaining === 0) {
      console.log(JSON.stringify({ event: 'sim_early_stop', reason: 'no_open_trades', day: d + 1 }));
      break;
    }

    if (INTERVAL_MS > 0) await sleep(INTERVAL_MS);
  }

  // ── Phase 2: Review cycle ──────────────────────────────────────────────
  // Use the last simulated date as scheduledFor so we get a fresh idempotency
  // key that doesn't collide with any review cycle that ran earlier today.
  const lastSimDate = addDays(START_DATE, closedPerDay.length - 1);

  console.log(JSON.stringify({ event: 'phase_review_start' }));
  const reviewResult = await runAutonomousReviewCycle({
    triggerSource: 'local_scheduler',
    runMode: 'missed_run',
    scheduledFor: lastSimDate,
    force: true,
  });
  console.log(JSON.stringify({ event: 'phase_review_done', skipped: reviewResult.skipped, outcome: reviewResult.outcome }));

  // ── Phase 3: Learning cycle ────────────────────────────────────────────

  console.log(JSON.stringify({ event: 'phase_learning_start' }));
  const learningResult = await runAutonomousLearningCycle({
    triggerSource: 'local_scheduler',
    runMode: 'missed_run',
    scheduledFor: lastSimDate,
    force: true,
  });
  console.log(JSON.stringify({ event: 'phase_learning_done', skipped: learningResult.skipped, outcome: learningResult.outcome }));

  // ── Final report ──────────────────────────────────────────────────────

  const finalState = await getSimState();
  const runtimeMs = Date.now() - sessionStart;

  const triggerDist = await prisma.tradeReviewReport.groupBy({
    by: ['triggerType'],
    _count: { id: true },
  });

  const triggerMap: Record<string, number> = {};
  for (const row of triggerDist) {
    triggerMap[row.triggerType ?? 'unknown'] = row._count.id;
  }

  const signalCount = (triggerMap['+5'] ?? 0) + (triggerMap['-5'] ?? 0);
  const timeCount = triggerMap['time'] ?? 0;
  const snr = finalState.reviews > 0 ? `${signalCount}/${finalState.reviews} = ${(signalCount / finalState.reviews * 100).toFixed(0)}%` : 'n/a';

  const systemStatus =
    finalState.insights > 0 ? 'LEARNING_ACTIVE' :
    finalState.reviews > 0 ? 'LEARNING_READY' :
    finalState.closed > 0 ? 'DATA_GENERATING' :
    'NOT_STARTED';

  const successConditionMet = finalState.closed >= 5 && finalState.reviews > 0;

  const report = {
    event: 'session_final_report',
    runtime: `${Math.round(runtimeMs / 1000)}s`,
    daysSimulated: closedPerDay.length,
    keyMetrics: {
      totalTrades: finalState.total,
      closedTrades: finalState.closed,
      openTrades: finalState.open,
      reviewCount: finalState.reviews,
      learningInsightCount: finalState.insights,
      avgPnl: finalState.avgPnl,
    },
    systemStatus,
    signalQuality: {
      triggerType: triggerMap,
      timeExits: timeCount,
      signalNoise: snr,
    },
    closedPerDay: closedPerDay.filter((d) => d.closed > 0),
    successConditionMet,
    verdict: successConditionMet
      ? finalState.insights > 0 ? 'LEARNING ACTIVATED' : 'SUCCESS — ready for learning on next cycle'
      : 'PARTIAL — more closed trades needed',
    nextStep: finalState.insights > 0
      ? 'Monitor learning insights. Run audit_learning_signals.js to review pattern quality.'
      : finalState.reviews > 0
      ? 'Run: npm run autonomous:learning -- to attempt insight generation'
      : 'Run: node scripts/audit_learning_signals.js to diagnose why reviews were not generated',
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err: unknown) => {
  console.error(JSON.stringify({ event: 'fatal_error', error: err instanceof Error ? err.message : String(err) }));
  process.exitCode = 1;
});
