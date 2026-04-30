import { JobOrchestrationService } from './JobOrchestrationService';
import type {
  JobExecutionResult,
  JobRunnerContext,
  JobRunnerOutput,
  JobRunLogRecord,
  JobRunStartResult,
  JobTriggerSource,
} from './types';
import { buildAutonomousIdempotencyKey, type JobWindowDefinition } from './autonomousJobRegistry';

interface RunJobWithOrchestrationInput {
  job: JobWindowDefinition;
  scheduledFor?: Date;
  triggerSource: JobTriggerSource;
  runMode?: 'live_run' | 'missed_run' | 'backfill_data_run';
  force?: boolean;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export async function runJobWithOrchestration<T>(
  input: RunJobWithOrchestrationInput,
  runner: (context: JobRunnerContext) => Promise<JobRunnerOutput<T>>,
): Promise<JobExecutionResult<T>> {
  const orchestration = new JobOrchestrationService();
  const scheduledFor = input.scheduledFor ?? input.job.getScheduledFor(new Date());
  const idempotencyKey = buildAutonomousIdempotencyKey(input.job.jobName, scheduledFor);
  const startResult: JobRunStartResult = await orchestration.startJobRun({
    jobName: input.job.jobName,
    scheduledFor,
    triggerSource: input.triggerSource,
    runMode: input.runMode ?? 'live_run',
    idempotencyKey,
    summary: input.summary,
    metadata: input.metadata,
    force: input.force ?? false,
  });

  if (!startResult.shouldRun) {
    return {
      jobRun: startResult.run,
      skipped: true,
      reason: startResult.reason,
      outcome: null,
    };
  }

  try {
    const outcome = await runner({
      jobName: input.job.jobName,
      scheduledFor,
      triggerSource: input.triggerSource,
      runMode: input.runMode ?? 'live_run',
      force: input.force ?? false,
    });
    const mergedMetadata = {
      ...input.metadata,
      ...outcome.metadata,
    };

    if (outcome.finalStatus === 'skipped') {
      const skipped = await orchestration.skipJobRun(
        startResult.run.id ?? 0,
        outcome.summary,
        mergedMetadata,
      );

      return {
        jobRun: skipped,
        skipped: true,
        reason: outcome.skipReason,
        outcome: outcome.payload ?? null,
      };
    }

    const completed = await orchestration.completeJobRun(startResult.run.id ?? 0, {
      summary: outcome.summary,
      metadata: mergedMetadata,
    });

    return {
      jobRun: completed,
      skipped: false,
      outcome: outcome.payload ?? null,
    };
  } catch (error) {
    const failed = await orchestration.failJobRun(startResult.run.id ?? 0, {
      error,
      summary: input.summary ?? `Job ${input.job.jobName} failed`,
      metadata: input.metadata,
    });
    return {
      jobRun: failed,
      skipped: false,
      reason: error instanceof Error ? error.message : String(error),
      outcome: null,
    };
  }
}

export function toJobSummary(jobRun: JobRunLogRecord): Record<string, unknown> {
  return {
    id: jobRun.id,
    jobName: jobRun.jobName,
    scheduledFor: jobRun.scheduledFor.toISOString(),
    startedAt: jobRun.startedAt?.toISOString() ?? null,
    finishedAt: jobRun.finishedAt?.toISOString() ?? null,
    status: jobRun.status,
    triggerSource: jobRun.triggerSource,
    idempotencyKey: jobRun.idempotencyKey,
    summary: jobRun.summary,
    errorMessage: jobRun.errorMessage,
    metadata: jobRun.metadata ? safeParse(jobRun.metadata) : null,
  };
}

function safeParse(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}
