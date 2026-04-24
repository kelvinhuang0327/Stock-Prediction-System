import type { AutonomousJobName } from './types';

export interface JobWindowDefinition {
  jobName: AutonomousJobName;
  label: string;
  cadence: 'daily' | 'interval';
  intervalMinutes?: number;
  getScheduledFor(now: Date): Date;
  getExpectedWindows(now: Date): Date[];
}

function truncateToUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function truncateToUtcInterval(now: Date, minutes: number): Date {
  const bucket = Math.floor((now.getUTCHours() * 60 + now.getUTCMinutes()) / minutes) * minutes;
  const hours = Math.floor(bucket / 60);
  const mins = bucket % 60;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, mins));
}

function dailyWindows(now: Date): Date[] {
  return [truncateToUtcDay(now)];
}

function intervalWindows(now: Date, minutes: number): Date[] {
  return [truncateToUtcInterval(now, minutes)];
}

export const AUTONOMOUS_JOB_REGISTRY: Record<AutonomousJobName, JobWindowDefinition> = {
  'autonomous:daily': {
    jobName: 'autonomous:daily',
    label: 'Autonomous Daily Cycle',
    cadence: 'daily',
    getScheduledFor: truncateToUtcDay,
    getExpectedWindows: dailyWindows,
  },
  'autonomous:monitor': {
    jobName: 'autonomous:monitor',
    label: 'Autonomous Monitor Cycle',
    cadence: 'interval',
    intervalMinutes: 30,
    getScheduledFor: (now) => truncateToUtcInterval(now, 30),
    getExpectedWindows: (now) => intervalWindows(now, 30),
  },
  'autonomous:review': {
    jobName: 'autonomous:review',
    label: 'Autonomous Review Cycle',
    cadence: 'daily',
    getScheduledFor: truncateToUtcDay,
    getExpectedWindows: dailyWindows,
  },
  'autonomous:learning': {
    jobName: 'autonomous:learning',
    label: 'Autonomous Learning Cycle',
    cadence: 'daily',
    getScheduledFor: truncateToUtcDay,
    getExpectedWindows: dailyWindows,
  },
  // ── Training Scheduler Layers ────────────────────────────────────────────────
  'training:intraday_monitor': {
    jobName: 'training:intraday_monitor',
    label: 'Training Layer 1 — Intraday Monitor (every 30 min)',
    cadence: 'interval',
    intervalMinutes: 30,
    getScheduledFor: (now) => truncateToUtcInterval(now, 30),
    getExpectedWindows: (now) => intervalWindows(now, 30),
  },
  'training:daily_cycle': {
    jobName: 'training:daily_cycle',
    label: 'Training Layer 2 — Daily Cycle (end-of-day)',
    cadence: 'daily',
    getScheduledFor: truncateToUtcDay,
    getExpectedWindows: dailyWindows,
  },
  'training:nightly_opt': {
    jobName: 'training:nightly_opt',
    label: 'Training Layer 3 — Nightly Optimisation',
    cadence: 'daily',
    getScheduledFor: truncateToUtcDay,
    getExpectedWindows: dailyWindows,
  },
  'training:weekly_deep': {
    jobName: 'training:weekly_deep',
    label: 'Training Layer 4 — Weekly Deep Training',
    cadence: 'interval',
    intervalMinutes: 7 * 24 * 60, // once a week
    getScheduledFor: (now) => truncateToUtcInterval(now, 7 * 24 * 60),
    getExpectedWindows: (now) => intervalWindows(now, 7 * 24 * 60),
  },
};

export function getAutonomousJobNames(): AutonomousJobName[] {
  return Object.keys(AUTONOMOUS_JOB_REGISTRY) as AutonomousJobName[];
}

export function buildAutonomousIdempotencyKey(jobName: AutonomousJobName, scheduledFor: Date): string {
  return `${jobName}:${scheduledFor.toISOString()}`;
}

