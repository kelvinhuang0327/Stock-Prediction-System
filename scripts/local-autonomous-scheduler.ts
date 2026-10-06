/**
 * local-autonomous-scheduler.ts
 *
 * Stateful local scheduler daemon for the autonomous trading system.
 *
 * Lifecycle:
 *   1. Startup reconciliation — classify every job window, backfill missed runs
 *   2. Tick loop — check jobs every `--interval-ms` (default 60 s), run if due
 *   3. Graceful shutdown on SIGINT / SIGTERM
 *
 * Run modes:
 *   --once          run reconciliation once and exit (useful for manual checks)
 *   --interval-ms=N tick interval in milliseconds (default 60000)
 *   --skip-reconcile skip startup reconciliation (for debugging)
 *
 * Logs: structured JSON on stdout; errors on stderr.
 * Every job execution is recorded in JobRunLog with the correct triggerSource
 * and runMode, making the log the authoritative source of truth.
 */

import { getAutonomousJobNames } from '../src/lib/jobs/autonomousJobRegistry';
import { SchedulerStateEngine } from '../src/lib/jobs/SchedulerStateEngine';

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
// Daemon
// ---------------------------------------------------------------------------

const engine = new SchedulerStateEngine();

let tickTimer: ReturnType<typeof setInterval> | null = null;
let isShuttingDown = false;
let currentTick: Promise<void> | null = null;

async function tick(): Promise<void> {
  if (isShuttingDown) return;
  const now = new Date();
  const jobNames = getAutonomousJobNames();
  const tickResults: Array<{ jobName: string; ran: boolean; skipped: boolean; reason?: string }> = [];

  for (const jobName of jobNames) {
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
  // Wait for any in-flight tick to finish
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

  console.log(
    JSON.stringify({
      event: 'scheduler_start',
      pid: process.pid,
      at: new Date().toISOString(),
      once,
      skipReconcile,
      intervalMs,
    }),
  );

  // Step 1: Startup reconciliation
  if (!skipReconcile) {
    console.log(JSON.stringify({ event: 'reconciliation_start', at: new Date().toISOString() }));
    await engine.reconcile();
  }

  if (once) {
    const status = await engine.getStatus();
    console.log(JSON.stringify({ event: 'scheduler_status', status }, null, 2));
    return;
  }

  // Step 2: Tick loop
  scheduleTick(intervalMs);
  console.log(
    JSON.stringify({
      event: 'scheduler_running',
      intervalMs,
      pid: process.pid,
      at: new Date().toISOString(),
    }),
  );
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ event: 'fatal_error', error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
