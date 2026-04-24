import { prisma } from '../prisma';
import type {
  JobRunCompletionInput,
  JobRunFailureInput,
  JobRunLogRecord,
  JobRunStartInput,
  JobRunStartResult,
  JobRunStatus,
} from './types';

function safeParse(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function safeStringify(value?: Record<string, unknown>): string | null {
  if (!value) return null;
  return JSON.stringify(value);
}

function mergeMetadata(existing: string | null | undefined, next?: Record<string, unknown>): string | null {
  if (!next) return existing ?? null;
  const merged = {
    ...(safeParse(existing) ?? {}),
    ...next,
  };
  return JSON.stringify(merged);
}

function toRecord(row: {
  id: number;
  jobName: string;
  scheduledFor: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  status: string;
  runMode: string;
  triggerSource: string;
  idempotencyKey: string;
  summary: string | null;
  errorMessage: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}): JobRunLogRecord {
  return {
    id: row.id,
    jobName: row.jobName,
    scheduledFor: row.scheduledFor,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    status: row.status as JobRunStatus,
    runMode: row.runMode as JobRunLogRecord['runMode'],
    triggerSource: row.triggerSource as JobRunLogRecord['triggerSource'],
    idempotencyKey: row.idempotencyKey,
    summary: row.summary,
    errorMessage: row.errorMessage,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class JobOrchestrationService {
  static buildIdempotencyKey(jobName: string, scheduledFor: Date): string {
    return `${jobName}:${scheduledFor.toISOString()}`;
  }

  async startJobRun(input: JobRunStartInput): Promise<JobRunStartResult> {
    const idempotencyKey = input.idempotencyKey ?? JobOrchestrationService.buildIdempotencyKey(input.jobName, input.scheduledFor);
    const existing = await prisma.jobRunLog.findUnique({ where: { idempotencyKey } });

    if (existing) {
      if (existing.status === 'success' && !input.force) {
        return {
          run: toRecord(existing),
          shouldRun: false,
          reason: 'duplicate_success',
        };
      }

      if (existing.status === 'running' && !input.force) {
        return {
          run: toRecord(existing),
          shouldRun: false,
          reason: 'already_running',
        };
      }

      const run = await prisma.jobRunLog.update({
        where: { idempotencyKey },
        data: {
          jobName: input.jobName,
          scheduledFor: input.scheduledFor,
          startedAt: new Date(),
          finishedAt: null,
          status: 'running',
          runMode: input.runMode ?? existing.runMode,
          triggerSource: input.triggerSource,
          summary: input.summary ?? existing.summary,
          errorMessage: null,
          metadata: mergeMetadata(existing.metadata, input.metadata),
        },
      });

      return {
        run: toRecord(run),
        shouldRun: true,
        reason: input.force ? 'forced' : 'retry',
      };
    }

    const run = await prisma.jobRunLog.create({
        data: {
          jobName: input.jobName,
          scheduledFor: input.scheduledFor,
          startedAt: new Date(),
          finishedAt: null,
          status: 'running',
          runMode: input.runMode ?? 'live_run',
          triggerSource: input.triggerSource,
          idempotencyKey,
          summary: input.summary ?? null,
          errorMessage: null,
          metadata: safeStringify(input.metadata),
      },
    });

    return {
      run: toRecord(run),
      shouldRun: true,
      reason: 'new',
    };
  }

  async completeJobRun(runId: number, input: JobRunCompletionInput = {}): Promise<JobRunLogRecord> {
    const run = await prisma.jobRunLog.update({
      where: { id: runId },
      data: {
        status: 'success',
        finishedAt: new Date(),
        summary: input.summary ?? undefined,
        errorMessage: null,
        metadata: mergeMetadata((await prisma.jobRunLog.findUnique({ where: { id: runId }, select: { metadata: true } }))?.metadata, input.metadata),
      },
    });

    return toRecord(run);
  }

  async failJobRun(runId: number, input: JobRunFailureInput): Promise<JobRunLogRecord> {
    const errorMessage = input.error instanceof Error ? input.error.message : String(input.error);
    const existing = await prisma.jobRunLog.findUnique({ where: { id: runId }, select: { metadata: true } });

    const run = await prisma.jobRunLog.update({
      where: { id: runId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        summary: input.summary ?? undefined,
        errorMessage,
        metadata: mergeMetadata(existing?.metadata, input.metadata),
      },
    });

    return {
      ...toRecord(run),
      errorMessage,
    };
  }

  async skipJobRun(runId: number, summary: string, metadata?: Record<string, unknown>): Promise<JobRunLogRecord> {
    const existing = await prisma.jobRunLog.findUnique({ where: { id: runId }, select: { metadata: true } });
    const run = await prisma.jobRunLog.update({
      where: { id: runId },
      data: {
        status: 'skipped',
        finishedAt: new Date(),
        summary,
        metadata: mergeMetadata(existing?.metadata, metadata),
      },
    });
    return toRecord(run);
  }

  async hasSuccessfulRun(jobName: string, scheduledFor: Date): Promise<boolean> {
    const idempotencyKey = JobOrchestrationService.buildIdempotencyKey(jobName, scheduledFor);
    const run = await prisma.jobRunLog.findUnique({
      where: { idempotencyKey },
      select: { status: true },
    });
    return run?.status === 'success';
  }

  async getLatestJobRun(jobName: string): Promise<JobRunLogRecord | null> {
    const row = await prisma.jobRunLog.findFirst({
      where: { jobName },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toRecord(row) : null;
  }

  async getLatestSuccessfulJobRun(jobName: string): Promise<JobRunLogRecord | null> {
    const row = await prisma.jobRunLog.findFirst({
      where: { jobName, status: 'success' },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toRecord(row) : null;
  }

  async findMissedRuns(jobName: string, scheduledFors: Date[]): Promise<Date[]> {
    if (scheduledFors.length === 0) return [];
    const keys = scheduledFors.map((scheduledFor) => JobOrchestrationService.buildIdempotencyKey(jobName, scheduledFor));
    const rows = await prisma.jobRunLog.findMany({
      where: { idempotencyKey: { in: keys } },
      select: { idempotencyKey: true, status: true },
    });
    const successKeys = new Set(rows.filter((row) => row.status === 'success').map((row) => row.idempotencyKey));
    return scheduledFors.filter((scheduledFor) => !successKeys.has(JobOrchestrationService.buildIdempotencyKey(jobName, scheduledFor)));
  }

  async getLatestRunsByJob(jobNames: string[]): Promise<Record<string, JobRunLogRecord | null>> {
    const runs = await prisma.jobRunLog.findMany({
      where: { jobName: { in: jobNames } },
      orderBy: { createdAt: 'desc' },
    });
    const latest: Record<string, JobRunLogRecord | null> = {};
    for (const jobName of jobNames) latest[jobName] = null;
    for (const row of runs) {
      if (!latest[row.jobName]) {
        latest[row.jobName] = toRecord(row);
      }
    }
    return latest;
  }
}
