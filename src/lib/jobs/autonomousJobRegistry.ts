import type { AutonomousJobName } from './types';

export interface JobWindowDefinition {
  jobName: AutonomousJobName;
  label: string;
  cadence: 'daily' | 'interval' | 'weekly';
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

function latestDailyWindowAtUtc(now: Date, hour: number, minute: number): Date {
  const todayWindow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour,
    minute,
  ));

  if (todayWindow.getTime() <= now.getTime()) {
    return todayWindow;
  }

  todayWindow.setUTCDate(todayWindow.getUTCDate() - 1);
  return todayWindow;
}

function dailyWindowsAtUtc(now: Date, hour: number, minute: number): Date[] {
  return [latestDailyWindowAtUtc(now, hour, minute)];
}

function latestWeeklyWindowAtUtc(now: Date, weekday: number, hour: number, minute: number): Date {
  const currentWeekday = now.getUTCDay();
  const daysBack = (currentWeekday - weekday + 7) % 7;
  const candidate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour,
    minute,
  ));
  candidate.setUTCDate(candidate.getUTCDate() - daysBack);

  if (candidate.getTime() <= now.getTime()) {
    return candidate;
  }

  candidate.setUTCDate(candidate.getUTCDate() - 7);
  return candidate;
}

function weeklyWindowsAtUtc(now: Date, weekday: number, hour: number, minute: number): Date[] {
  return [latestWeeklyWindowAtUtc(now, weekday, hour, minute)];
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
  'training:tw-data-sync': {
    jobName: 'training:tw-data-sync',
    label: 'Taiwan Stock Data Sync (every 30 min)',
    cadence: 'interval',
    intervalMinutes: 30,
    getScheduledFor: (now) => truncateToUtcInterval(now, 30),
    getExpectedWindows: (now) => intervalWindows(now, 30),
  },
  'training:tw-snapshot': {
    jobName: 'training:tw-snapshot',
    label: 'Taiwan Stock Daily Snapshot (14:05 Asia/Taipei)',
    cadence: 'daily',
    getScheduledFor: (now) => latestDailyWindowAtUtc(now, 6, 5),
    getExpectedWindows: (now) => dailyWindowsAtUtc(now, 6, 5),
  },
  'training:tw-screen': {
    jobName: 'training:tw-screen',
    label: 'Taiwan Stock Dry-Run Screening (14:10 Asia/Taipei)',
    cadence: 'daily',
    getScheduledFor: (now) => latestDailyWindowAtUtc(now, 6, 10),
    getExpectedWindows: (now) => dailyWindowsAtUtc(now, 6, 10),
  },
  'training:tw-report': {
    jobName: 'training:tw-report',
    label: 'Taiwan Stock End-of-Day Report (21:10 Asia/Taipei)',
    cadence: 'daily',
    getScheduledFor: (now) => latestDailyWindowAtUtc(now, 13, 10),
    getExpectedWindows: (now) => dailyWindowsAtUtc(now, 13, 10),
  },
  'training:tw-optimization-miner': {
    jobName: 'training:tw-optimization-miner',
    label: 'Taiwan Self-Optimisation Miner (22:00 Asia/Taipei)',
    cadence: 'daily',
    getScheduledFor: (now) => latestDailyWindowAtUtc(now, 14, 0),
    getExpectedWindows: (now) => dailyWindowsAtUtc(now, 14, 0),
  },
  'training:tw-worker-cycle': {
    jobName: 'training:tw-worker-cycle',
    label: 'Taiwan Optimisation Worker Cycle (every 60 min)',
    cadence: 'interval',
    intervalMinutes: 60,
    getScheduledFor: (now) => truncateToUtcInterval(now, 60),
    getExpectedWindows: (now) => intervalWindows(now, 60),
  },
  'training:tw-insight-ingest': {
    jobName: 'training:tw-insight-ingest',
    label: 'Taiwan Optimisation Insight Ingest (23:10 Asia/Taipei)',
    cadence: 'daily',
    getScheduledFor: (now) => latestDailyWindowAtUtc(now, 15, 10),
    getExpectedWindows: (now) => dailyWindowsAtUtc(now, 15, 10),
  },
  'training:tw-weekly-deep-research': {
    jobName: 'training:tw-weekly-deep-research',
    label: 'Taiwan Weekly Deep Research (Sunday 18:00 Asia/Taipei)',
    cadence: 'weekly',
    getScheduledFor: (now) => latestWeeklyWindowAtUtc(now, 0, 10, 0),
    getExpectedWindows: (now) => weeklyWindowsAtUtc(now, 0, 10, 0),
  },
  'training:tw-self-audit': {
    jobName: 'training:tw-self-audit',
    label: 'Taiwan Self-Optimisation Audit (00:10 Asia/Taipei)',
    cadence: 'daily',
    getScheduledFor: (now) => latestDailyWindowAtUtc(now, 16, 10),
    getExpectedWindows: (now) => dailyWindowsAtUtc(now, 16, 10),
  },
};

export function getAutonomousJobNames(): AutonomousJobName[] {
  return Object.keys(AUTONOMOUS_JOB_REGISTRY) as AutonomousJobName[];
}

export function buildAutonomousIdempotencyKey(jobName: AutonomousJobName, scheduledFor: Date): string {
  return `${jobName}:${scheduledFor.toISOString()}`;
}

export function getAutonomousJobNextDueAt(jobName: AutonomousJobName, now: Date): Date {
  const def = AUTONOMOUS_JOB_REGISTRY[jobName];
  if (def.cadence === 'daily') {
    const next = new Date(def.getScheduledFor(now));
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  if (def.cadence === 'weekly') {
    const next = new Date(def.getScheduledFor(now));
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  const intervalMs = (def.intervalMinutes ?? 30) * 60_000;
  return new Date(def.getScheduledFor(now).getTime() + intervalMs);
}

