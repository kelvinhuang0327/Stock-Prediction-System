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
  getAutonomousJobNextDueAt,
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
  runTrainingTaiwanDataSync,
  runTrainingTaiwanInsightIngest,
  runTrainingTaiwanOptimizationMiner,
  runTrainingTaiwanReport,
  runTrainingTaiwanScreen,
  runTrainingTaiwanSelfAudit,
  runTrainingTaiwanSnapshot,
  runTrainingTaiwanWeeklyDeepResearch,
  runTrainingTaiwanWorkerCycle,
  runTrainingWeeklyDeep,
} from './autonomousJobRunners';
import type { AutonomousJobName, JobExecutionResult, JobRunMode } from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Classification of a single job window at evaluation time. */
export type JobWindowClassification =
  | 'already_ran'   // idempotency key exists with any non-failed terminal state
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

type BackfillTriggerSource = 'local_scheduler';

type BackfillRunner = (args: {
  triggerSource: BackfillTriggerSource;
  scheduledFor: Date;
  runMode: JobRunMode;
}) => Promise<JobExecutionResult<unknown>>;

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
  'training:tw-data-sync': {
    autoBackfill: true,
    maxMissedAgeMs: 2 * 60 * 60 * 1000,
    mostRecentOnly: true,
  },
  'training:tw-snapshot': {
    autoBackfill: true,
    maxMissedAgeMs: 24 * 60 * 60 * 1000,
    mostRecentOnly: true,
  },
  'training:tw-screen': {
    autoBackfill: true,
    maxMissedAgeMs: 24 * 60 * 60 * 1000,
    mostRecentOnly: true,
  },
  'training:tw-report': {
    autoBackfill: true,
    maxMissedAgeMs: 24 * 60 * 60 * 1000,
    mostRecentOnly: true,
  },
  'training:tw-optimization-miner': {
    autoBackfill: true,
    maxMissedAgeMs: 24 * 60 * 60 * 1000,
    mostRecentOnly: true,
  },
  'training:tw-worker-cycle': {
    autoBackfill: true,
    maxMissedAgeMs: 2 * 60 * 60 * 1000,
    mostRecentOnly: true,
  },
  'training:tw-insight-ingest': {
    autoBackfill: true,
    maxMissedAgeMs: 24 * 60 * 60 * 1000,
    mostRecentOnly: true,
  },
  'training:tw-weekly-deep-research': {
    autoBackfill: true,
    maxMissedAgeMs: 2 * 24 * 60 * 60 * 1000,
    mostRecentOnly: true,
  },
  'training:tw-self-audit': {
    autoBackfill: true,
    maxMissedAgeMs: 24 * 60 * 60 * 1000,
    mostRecentOnly: true,
  },
};

const BACKFILL_RUNNERS: Record<AutonomousJobName, BackfillRunner> = {
  'autonomous:daily': runAutonomousDailyCycle,
  'autonomous:monitor': runAutonomousMonitorCycle,
  'autonomous:review': runAutonomousReviewCycle,
  'autonomous:learning': runAutonomousLearningCycle,
  'training:intraday_monitor': runTrainingIntradayMonitorCycle,
  'training:daily_cycle': runTrainingDailyCycle,
  'training:nightly_opt': runTrainingNightlyOpt,
  'training:weekly_deep': runTrainingWeeklyDeep,
  'training:tw-data-sync': runTrainingTaiwanDataSync,
  'training:tw-snapshot': runTrainingTaiwanSnapshot,
  'training:tw-screen': runTrainingTaiwanScreen,
  'training:tw-report': runTrainingTaiwanReport,
  'training:tw-optimization-miner': runTrainingTaiwanOptimizationMiner,
  'training:tw-worker-cycle': runTrainingTaiwanWorkerCycle,
  'training:tw-insight-ingest': runTrainingTaiwanInsightIngest,
  'training:tw-weekly-deep-research': runTrainingTaiwanWeeklyDeepResearch,
  'training:tw-self-audit': runTrainingTaiwanSelfAudit,
};

const MAX_JOB_RETRY_ATTEMPTS = 2;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function truncateToUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getNextDueAt(jobName: AutonomousJobName, now: Date): Date {
  return getAutonomousJobNextDueAt(jobName, now);
}

function getResultError(result: JobExecutionResult<unknown>, jobName: AutonomousJobName): string | undefined {
  if (result.skipped) return undefined;
  if (result.jobRun.status === 'skipped') return undefined;
  if (result.jobRun.status === 'success') return undefined;
  return result.jobRun.errorMessage ?? result.reason ?? `Job ${jobName} returned status ${result.jobRun.status}`;
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export class SchedulerStateEngine {
  private readonly startedAt: Date = new Date();
  private lastReconciliationAt: Date | null = null;
  private lastReconciliationResults: JobReconciliationResult[] = [];

  private buildBackfillRunContext(scheduledFor: Date): {
    triggerSource: BackfillTriggerSource;
    scheduledFor: Date;
    runMode: JobRunMode;
  } {
    return {
      triggerSource: 'local_scheduler',
      scheduledFor,
      runMode: 'missed_run',
    };
  }

  private async runBackfillAttempt(
    jobName: AutonomousJobName,
    scheduledFor: Date,
  ): Promise<{ runId: number | undefined; error?: string }> {
    const result = await BACKFILL_RUNNERS[jobName](this.buildBackfillRunContext(scheduledFor));
    const error = getResultError(result, jobName);

    return {
      runId: result.jobRun.id,
      error,
    };
  }

  private shouldRetryBackfill(attempt: number): boolean {
    return attempt < MAX_JOB_RETRY_ATTEMPTS;
  }

  private logBackfillRetry(
    jobName: AutonomousJobName,
    scheduledFor: Date,
    attempt: number,
    error: string,
  ): void {
    console.error(JSON.stringify({
      event: 'scheduler_retry',
      jobName,
      scheduledFor: scheduledFor.toISOString(),
      attempt: attempt + 1,
      retrying: true,
      error,
    }));
  }

  private normalizeBackfillError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

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
      if (windowRun.status !== 'failed') return 'already_ran';
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
    for (let attempt = 0; attempt <= MAX_JOB_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const { runId, error } = await this.runBackfillAttempt(jobName, scheduledFor);
        if (!error) {
          return { runId };
        }

        if (this.shouldRetryBackfill(attempt)) {
          this.logBackfillRetry(jobName, scheduledFor, attempt, error);
          continue;
        }

        return { runId, error };
      } catch (err) {
        const error = this.normalizeBackfillError(err);
        if (this.shouldRetryBackfill(attempt)) {
          this.logBackfillRetry(jobName, scheduledFor, attempt, error);
          continue;
        }

        return {
          runId: undefined,
          error,
        };
      }
    }

    return { runId: undefined, error: `Unknown scheduler failure for ${jobName}` };
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
    if (existing && existing.status !== 'failed') {
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

    const uptimeSeconds = this.lastReconciliationAt === null
      ? null
      : Math.round((now.getTime() - this.startedAt.getTime()) / 1000);

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
