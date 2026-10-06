/**
 * run-training-scheduler.ts
 *
 * Standalone daemon for the Autonomous Training Scheduler.
 * Runs only the 4 training layers (intraday_monitor, daily_cycle, nightly_opt, weekly_deep).
 *
 * Lifecycle:
 *   1. Startup — call initTrainingScheduler() to seed layer status store
 *   2. Reconcile — classify every training job window, backfill missed runs
 *   3. Tick loop — check jobs every `--interval-ms` (default 60 s), run if due
 *   4. Graceful shutdown on SIGINT / SIGTERM
 *
 * Run modes:
 *   --once          run init + reconcile once and exit
 *   --interval-ms=N tick interval in milliseconds (default 60000)
 *   --skip-reconcile skip startup reconciliation
 *
 * Run with:
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
 *   npx ts-node -r tsconfig-paths/register --transpile-only scripts/run-training-scheduler.ts
 */

import { initTrainingScheduler, getTrainingSchedulerStatus } from '../src/lib/training/TrainingScheduler';
import { evaluateExecutionPolicy, getPolicySkipMessage } from '../src/lib/agent-orchestrator/llmExecutionPolicy';
import { SchedulerStateEngine } from '../src/lib/jobs/SchedulerStateEngine';
import type { AutonomousJobName } from '../src/lib/jobs/types';

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parseIntervalMs(): number {
  const raw = process.argv.find((arg) => arg.startsWith('--interval-ms='));
  if (!raw) return 60_000;
  const value = Number(raw.split('=')[1]);
  return Number.isFinite(value) && value > 0 ? value : 60_000;
}

// ---------------------------------------------------------------------------
// Training job names only
// ---------------------------------------------------------------------------

const TRAINING_JOB_NAMES: AutonomousJobName[] = [
  'training:intraday_monitor',
  'training:daily_cycle',
  'training:nightly_opt',
  'training:weekly_deep',
];

// ---------------------------------------------------------------------------
// Daemon
// ---------------------------------------------------------------------------

const engine = new SchedulerStateEngine();

let tickTimer: ReturnType<typeof setInterval> | null = null;
let isShuttingDown = false;
let currentTick: Promise<void> | null = null;

async function tick(): Promise<void> {
  if (isShuttingDown) return;
  const policyDecision = await evaluateExecutionPolicy({ caller: 'training_scheduler', callerContext: 'background', provider: '', model: '', taskId: null });
  if (!policyDecision.allowed) {
    console.log(JSON.stringify({ event: 'training_scheduler_skip', reason: getPolicySkipMessage(policyDecision.skip_reason), at: new Date().toISOString() }));
    return;
  }
  const now = new Date();
  const tickResults: Array<{ jobName: string; ran: boolean; skipped: boolean; reason?: string }> = [];

  for (const jobName of TRAINING_JOB_NAMES) {
    try {
      const result = await engine.checkAndRunIfDue(jobName, now);
      tickResults.push({ jobName, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ event: 'tick_error', jobName, error: msg }));
      tickResults.push({ jobName, ran: false, skipped: false, reason: msg });
    }
  }

  const ran = tickResults.filter((r) => r.ran).map((r) => r.jobName);
  const skipped = tickResults.filter((r) => r.skipped).map((r) => r.jobName);
  if (ran.length > 0) {
    console.log(JSON.stringify({ event: 'tick', at: now.toISOString(), ran, skipped }));
  }
}

function scheduleTick(intervalMs: number): void {
  tickTimer = setInterval(() => {
    currentTick = tick().finally(() => {
      currentTick = null;
    });
  }, intervalMs);
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(JSON.stringify({ event: 'shutdown', signal, at: new Date().toISOString() }));
  if (tickTimer) clearInterval(tickTimer);
  if (currentTick) await currentTick;
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const once = hasFlag('--once');
  const skipReconcile = hasFlag('--skip-reconcile');
  const intervalMs = parseIntervalMs();
  const policyDecision = await evaluateExecutionPolicy({ caller: 'training_scheduler', callerContext: 'background', provider: '', model: '', taskId: null });

  console.log(
    JSON.stringify({
      event: 'training_scheduler_start',
      pid: process.pid,
      at: new Date().toISOString(),
      once,
      skipReconcile,
      intervalMs,
      jobs: TRAINING_JOB_NAMES,
    }),
  );

  if (!policyDecision.allowed) {
    console.log(JSON.stringify({ event: 'training_scheduler_skip', reason: getPolicySkipMessage(policyDecision.skip_reason), at: new Date().toISOString() }));
    return;
  }

  // Step 1: Init training scheduler state
  initTrainingScheduler();
  console.log(JSON.stringify({ event: 'training_scheduler_init', at: new Date().toISOString() }));

  // Step 2: Startup reconciliation (training jobs only)
  if (!skipReconcile) {
    console.log(JSON.stringify({ event: 'reconciliation_start', at: new Date().toISOString() }));
    const now = new Date();
    for (const jobName of TRAINING_JOB_NAMES) {
      try {
        const result = await engine.checkAndRunIfDue(jobName, now);
        console.log(JSON.stringify({ event: 'reconcile_job', jobName, ...result }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({ event: 'reconcile_error', jobName, error: msg }));
      }
    }
    console.log(JSON.stringify({ event: 'reconciliation_complete', at: new Date().toISOString() }));
  }

  if (once) {
    const status = await getTrainingSchedulerStatus();
    console.log(JSON.stringify({ event: 'training_scheduler_status', status }, null, 2));
    return;
  }

  // Step 3: Tick loop
  scheduleTick(intervalMs);
  console.log(
    JSON.stringify({
      event: 'training_scheduler_running',
      pid: process.pid,
      intervalMs,
      at: new Date().toISOString(),
    }),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ event: 'fatal_error', error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
