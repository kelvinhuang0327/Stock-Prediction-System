/**
 * SchedulerStateEngine
 *
 * Responsible for startup reconciliation, backfill decisions, and scheduler
 * health state.  This module is the single source of truth for:
 *
 *   - whether a job window already ran
 *   - whether a missed window should be backfilled
 *   - which triggerSource / runMode to use for each run type
 *
 * Trigger flow:
 *   Scheduler boot → reconcile() → for each job → classify → backfill if policy allows
 *   Scheduler tick  → checkDue()  → run if window not yet satisfied
 */

import { prisma } from '../prisma';
import {
  AUTONOMOUS_JOB_REGISTRY,
  buildAutonomousIdempotencyKey,
  getAutonomousJobNames,
} from './autonomousJobRegistry';
import {
  runAutonomousDailyCycle,
  runAutonomousLearningCycle,
  runAutonomousMonitorCycle,
  runAutonomousReviewCycle,
  runTrainingIntradayMonitorCycle,
  runTrainingDailyCycle,
  runTrainingNightlyOpt,
  runTrainingWeeklyDeep,
} from './autonomousJobRunners';
import type { AutonomousJobName, JobRunLogRecord, JobRunMode } from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Classification of a single job window at evaluation time. */
export type JobWindowClassification =
  | 'already_ran'   // idempotency key exists with status success or running
  | 'not_due_yet'   // scheduledFor is in the future (edge-case guard)
  | 'missed'        // no success record for this window
  | 'failed'        // a failed record exists (eligible for retry)
  | 'never_ran';    // no runs of this job at all in history

export interface JobReconciliationResult {
  jobName: AutonomousJobName;
  scheduledFor: Date;
  classification: JobWindowClassification;
  backfillDecision: 'backfill' | 'skip';
  skipReason?: string;
  backfilled: boolean;
  backfillRunId?: number;
  errorMessage?: string;
}

export interface SchedulerStatus {
  schedulerPid: number | null;
  lastReconciliationAt: string | null;
  uptimeSeconds: number | null;
  missedJobCount: number;
  backfilledJobCount: number;
  neverRanJobs: string[];
  nextScheduledJobs: Array<{ jobName: string; nextDueAt: string }>;
  reconciliationResults: JobReconciliationResult[];
  jobSummary: Array<{
    jobName: string;
    lastRunAt: string | null;
    lastStatus: string | null;
    windowClassification: JobWindowClassification;
  }>;
}

// ---------------------------------------------------------------------------
// Backfill policy
// ---------------------------------------------------------------------------

interface BackfillPolicy {
  /** Whether to automatically backfill a missed window. */
  autoBackfill: boolean;
  /** Max age (ms) of a missed window that is still eligible for backfill.
   *  null = no age limit (always backfill). */
  maxMissedAgeMs: number | null;
  /** For interval jobs: only backfill the single most-recent missed window. */
  mostRecentOnly: boolean;
}

const BACKFILL_POLICIES: Record<AutonomousJobName, BackfillPolicy> = {
  'autonomous:daily': {
    autoBackfill: true,
    maxMissedAgeMs: null,      // today's window — always backfill
    mostRecentOnly: false,
  },
  'autonomous:review': {
    autoBackfill: true,
    maxMissedAgeMs: null,
    mostRecentOnly: false,
  },
  'autonomous:learning': {
    autoBackfill: true,
    maxMissedAgeMs: null,
    mostRecentOnly: false,
  },
  'autonomous:monitor': {
    autoBackfill: true,
    maxMissedAgeMs: 2 * 60 * 60 * 1000,  // only backfill if missed < 2 hours ago
    mostRecentOnly: true,
  },
  // ── Training Scheduler Layers ────────────────────────────────────────────────
  'training:intraday_monitor': {
    autoBackfill: true,
    maxMissedAgeMs: 2 * 60 * 60 * 1000,
    mostRecentOnly: true,
  },
  'training:daily_cycle': {
    autoBackfill: true,
    maxMissedAgeMs: null,
    mostRecentOnly: false,
  },
  'training:nightly_opt': {
    autoBackfill: true,
    maxMissedAgeMs: null,
    mostRecentOnly: false,
  },
  'training:weekly_deep': {
    autoBackfill: true,
    maxMissedAgeMs: 2 * 24 * 60 * 60 * 1000, // only backfill if missed < 2 days ago
    mostRecentOnly: true,
  },
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function truncateToUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getNextDueAt(jobName: AutonomousJobName, now: Date): Date {
  const def = AUTONOMOUS_JOB_REGISTRY[jobName];
  if (def.cadence === 'daily') {
    const tomorrow = new Date(truncateToUtcDay(now));
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow;
  }
  // interval job: next bucket
  const intervalMs = (def.intervalMinutes ?? 30) * 60_000;
  const scheduledMs = def.getScheduledFor(now).getTime();
  return new Date(scheduledMs + intervalMs);
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export class SchedulerStateEngine {
  private startedAt: Date = new Date();
  private lastReconciliationAt: Date | null = null;
  private lastReconciliationResults: JobReconciliationResult[] = [];

  /** Classify a specific job window. */
  async classifyJobWindow(
    jobName: AutonomousJobName,
    scheduledFor: Date,
    now: Date,
  ): Promise<JobWindowClassification> {
    // Guard: window is in the future
    if (scheduledFor.getTime() > now.getTime()) return 'not_due_yet';

    const idempotencyKey = buildAutonomousIdempotencyKey(jobName, scheduledFor);
    const windowRun = await prisma.jobRunLog.findUnique({ where: { idempotencyKey } });

    if (windowRun) {
      if (windowRun.status === 'success' || windowRun.status === 'running') return 'already_ran';
      if (windowRun.status === 'failed') return 'failed';
    }

    // Check if there has ever been any run for this job
    const anyRun = await prisma.jobRunLog.findFirst({ where: { jobName } });
    if (!anyRun && !windowRun) return 'never_ran';

    return 'missed';
  }

  /** Apply backfill policy for a given classification. */
  private evaluateBackfill(
    jobName: AutonomousJobName,
    classification: JobWindowClassification,
    scheduledFor: Date,
    now: Date,
  ): { decision: 'backfill' | 'skip'; reason?: string } {
    // Only backfill missed / failed / never_ran windows
    if (classification === 'already_ran') {
      return { decision: 'skip', reason: 'already_ran' };
    }
    if (classification === 'not_due_yet') {
      return { decision: 'skip', reason: 'not_due_yet' };
    }

    const policy = BACKFILL_POLICIES[jobName];
    if (!policy.autoBackfill) {
      return { decision: 'skip', reason: 'policy_disabled' };
    }

    // Age check
    if (policy.maxMissedAgeMs !== null) {
      const ageMs = now.getTime() - scheduledFor.getTime();
      if (ageMs > policy.maxMissedAgeMs) {
        return {
          decision: 'skip',
          reason: `missed_too_old: age=${Math.round(ageMs / 60_000)}min > limit=${Math.round(policy.maxMissedAgeMs / 60_000)}min`,
        };
      }
    }

    return { decision: 'backfill' };
  }

  /** Run the actual backfill for a job. Returns the run log record id. */
  private async executeBackfill(
    jobName: AutonomousJobName,
    scheduledFor: Date,
  ): Promise<{ runId: number | undefined; error?: string }> {
    const runMode: JobRunMode = 'missed_run';
    const triggerSource = 'local_scheduler' as const;

    try {
      let result;
      if (jobName === 'autonomous:daily') {
        result = await runAutonomousDailyCycle({ triggerSource, scheduledFor, runMode });
      } else if (jobName === 'autonomous:monitor') {
        result = await runAutonomousMonitorCycle({ triggerSource, scheduledFor, runMode });
      } else if (jobName === 'autonomous:review') {
        result = await runAutonomousReviewCycle({ triggerSource, scheduledFor, runMode });
      } else if (jobName === 'autonomous:learning') {
        result = await runAutonomousLearningCycle({ triggerSource, scheduledFor, runMode });
      } else if (jobName === 'training:intraday_monitor') {
        result = await runTrainingIntradayMonitorCycle({ triggerSource, scheduledFor, runMode });
      } else if (jobName === 'training:daily_cycle') {
        result = await runTrainingDailyCycle({ triggerSource, scheduledFor, runMode });
      } else if (jobName === 'training:nightly_opt') {
        result = await runTrainingNightlyOpt({ triggerSource, scheduledFor, runMode });
      } else {
        result = await runTrainingWeeklyDeep({ triggerSource, scheduledFor, runMode });
      }
      return { runId: result.jobRun.id };
    } catch (err) {
      return {
        runId: undefined,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Startup reconciliation.
   *
   * For each registered job, determines the current window's state and
   * applies backfill policy.  Idempotent — safe to call multiple times.
   */
  async reconcile(now = new Date()): Promise<JobReconciliationResult[]> {
    const results: JobReconciliationResult[] = [];

    for (const jobName of getAutonomousJobNames()) {
      const def = AUTONOMOUS_JOB_REGISTRY[jobName];
      const scheduledFor = def.getScheduledFor(now);

      const classification = await this.classifyJobWindow(jobName, scheduledFor, now);
      const { decision, reason } = this.evaluateBackfill(jobName, classification, scheduledFor, now);

      const entry: JobReconciliationResult = {
        jobName,
        scheduledFor,
        classification,
        backfillDecision: decision,
        skipReason: reason,
        backfilled: false,
      };

      if (decision === 'backfill') {
        const { runId, error } = await this.executeBackfill(jobName, scheduledFor);
        entry.backfilled = !error;
        entry.backfillRunId = runId;
        entry.errorMessage = error;
      }

      results.push(entry);
    }

    this.lastReconciliationAt = new Date();
    this.lastReconciliationResults = results;

    console.log(
      JSON.stringify({
        event: 'reconciliation_complete',
        at: this.lastReconciliationAt.toISOString(),
        results: results.map((r) => ({
          jobName: r.jobName,
          classification: r.classification,
          backfillDecision: r.backfillDecision,
          backfilled: r.backfilled,
          skipReason: r.skipReason,
          errorMessage: r.errorMessage,
        })),
      }),
    );

    return results;
  }

  /**
   * Per-tick check: run a job if its current window has not been satisfied.
   * Returns whether a run was triggered.
   */
  async checkAndRunIfDue(
    jobName: AutonomousJobName,
    now = new Date(),
  ): Promise<{ ran: boolean; skipped: boolean; reason?: string }> {
    const def = AUTONOMOUS_JOB_REGISTRY[jobName];
    const scheduledFor = def.getScheduledFor(now);
    const idempotencyKey = buildAutonomousIdempotencyKey(jobName, scheduledFor);

    const existing = await prisma.jobRunLog.findUnique({ where: { idempotencyKey } });
    if (existing && (existing.status === 'success' || existing.status === 'running')) {
      return { ran: false, skipped: true, reason: existing.status };
    }

    const { runId, error } = await this.executeBackfill(jobName, scheduledFor);
    if (error) {
      console.error(JSON.stringify({ event: 'tick_run_failed', jobName, error }));
      return { ran: false, skipped: false, reason: error };
    }

    console.log(JSON.stringify({ event: 'tick_run_complete', jobName, runId, scheduledFor }));
    return { ran: true, skipped: false };
  }

  /** Build scheduler status for the API/health endpoint. */
  async getStatus(now = new Date()): Promise<SchedulerStatus> {
    const jobNames = getAutonomousJobNames();
    const neverRanJobs: string[] = [];
    const jobSummary: SchedulerStatus['jobSummary'] = [];

    for (const jobName of jobNames) {
      const def = AUTONOMOUS_JOB_REGISTRY[jobName];
      const scheduledFor = def.getScheduledFor(now);
      const classification = await this.classifyJobWindow(jobName, scheduledFor, now);
      const latestRun = await prisma.jobRunLog.findFirst({
        where: { jobName },
        orderBy: { createdAt: 'desc' },
      });

      if (classification === 'never_ran') neverRanJobs.push(jobName);

      jobSummary.push({
        jobName,
        lastRunAt: latestRun?.finishedAt?.toISOString() ?? latestRun?.startedAt?.toISOString() ?? null,
        lastStatus: latestRun?.status ?? null,
        windowClassification: classification,
      });
    }

    const missedJobCount = jobSummary.filter(
      (j) => j.windowClassification === 'missed' || j.windowClassification === 'failed',
    ).length;

    const backfilledJobCount = this.lastReconciliationResults.filter((r) => r.backfilled).length;

    const nextScheduledJobs = jobNames.map((jobName) => ({
      jobName,
      nextDueAt: getNextDueAt(jobName, now).toISOString(),
    }));

    const uptimeSeconds =
      this.lastReconciliationAt !== null
        ? Math.round((now.getTime() - this.startedAt.getTime()) / 1000)
        : null;

    return {
      schedulerPid: process.pid,
      lastReconciliationAt: this.lastReconciliationAt?.toISOString() ?? null,
      uptimeSeconds,
      missedJobCount,
      backfilledJobCount,
      neverRanJobs,
      nextScheduledJobs,
      reconciliationResults: this.lastReconciliationResults,
      jobSummary,
    };
  }

  getLastReconciliationAt(): Date | null {
    return this.lastReconciliationAt;
  }
}
