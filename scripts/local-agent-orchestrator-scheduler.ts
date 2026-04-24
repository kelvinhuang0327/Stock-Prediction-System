/**
 * local-agent-orchestrator-scheduler.ts
 *
 * Lightweight scheduler daemon for dual-agent orchestrator.
 * It triggers planner/worker ticks based on scheduler_state timestamps.
 */

import { loadProjectProfile } from '../src/lib/agent-orchestrator/profile';
import { ensureOrchestratorBootstrap } from '../src/lib/agent-orchestrator/service';
import { loadSchedulerState } from '../src/lib/agent-orchestrator/storage';
import { runPlannerTick } from '../src/lib/agent-orchestrator/plannerTick';
import { runWorkerTick } from '../src/lib/agent-orchestrator/workerTick';
import { runCtoReviewTick } from '../src/lib/agent-orchestrator/ctoReviewTick';
import { prisma } from '../src/lib/prisma';

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parseIntervalMs(): number {
  const raw = process.argv.find((arg) => arg.startsWith('--interval-ms='));
  if (!raw) return 60_000;
  const value = Number(raw.split('=')[1]);
  return Number.isFinite(value) && value > 0 ? value : 60_000;
}

function shouldRun(nextRunAt: string | null, now: Date): boolean {
  if (!nextRunAt) return true;
  return new Date(nextRunAt).getTime() <= now.getTime();
}

let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

async function tick(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const profile = await loadProjectProfile();
    const { state } = await loadSchedulerState(profile);
    const now = new Date();

    if (!state.schedulerEnabled) {
      console.log(JSON.stringify({ event: 'scheduler_tick', skipped: true, reason: 'disabled', at: now.toISOString() }));
      return;
    }

    if (shouldRun(state.nextPlannerRunAt, now)) {
      const planner = await runPlannerTick();
      console.log(JSON.stringify({ event: 'planner_tick', at: now.toISOString(), planner }));
    }

    if (shouldRun(state.nextWorkerRunAt, now)) {
      const worker = await runWorkerTick();
      console.log(JSON.stringify({ event: 'worker_tick', at: now.toISOString(), worker }));
    }

    // CTO Review tick — runs when cto_scheduler_enabled is 'true'
    const ctoEnabled = await prisma.orchestratorSetting.findUnique({
      where: { key: 'cto_scheduler_enabled' },
    });
    if (ctoEnabled?.value === 'true') {
      const cto = await runCtoReviewTick({ isManual: false });
      console.log(JSON.stringify({ event: 'cto_review_tick', at: now.toISOString(), cto }));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ event: 'scheduler_error', error: message }));
  } finally {
    inFlight = false;
  }
}

async function main(): Promise<void> {
  const once = hasFlag('--once');
  const intervalMs = parseIntervalMs();

  await ensureOrchestratorBootstrap();
  console.log(
    JSON.stringify({
      event: 'agent_orchestrator_scheduler_start',
      once,
      intervalMs,
      pid: process.pid,
      at: new Date().toISOString(),
    }),
  );

  await tick();

  if (once) return;

  timer = setInterval(() => {
    void tick();
  }, intervalMs);
}

process.on('SIGINT', () => {
  if (timer) clearInterval(timer);
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (timer) clearInterval(timer);
  process.exit(0);
});

main().catch((error: unknown) => {
  console.error(JSON.stringify({ event: 'fatal_error', error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
