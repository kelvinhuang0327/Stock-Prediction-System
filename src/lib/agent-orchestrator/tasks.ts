import path from 'node:path';
import {
  ensureDir,
  nowIso,
  safeSlug,
  toDayKey,
  toTimestampCompact,
  writeJsonFile,
  writeTextFile,
} from './common';
import type {
  GateVerdict,
  PlannerTaskFingerprint,
  PlannerProvider,
  ProjectProfile,
  TaskContract,
  TaskMeta,
  TaskRecord,
  TaskResult,
  TaskStatus,
  TaskStoreIndex,
  WorkerProvider,
} from './types';
import type { RuntimePaths } from './storage';

interface CreateTaskInput {
  objective: string;
  promptMarkdown: string;
  contract: TaskContract;
  plannerContext: PlannerTaskFingerprint | null;
  plannerProvider: PlannerProvider;
  workerProvider: WorkerProvider;
  /** Optional health context stamped at task-creation time by the system health guard. */
  healthContext?: TaskRecord['healthContext'];
}

function nextTaskId(index: TaskStoreIndex): number {
  const max = index.tasks.reduce((memo, task) => Math.max(memo, task.taskId), 0);
  return max + 1;
}

function buildTaskMeta(record: TaskRecord): TaskMeta {
  return {
    version: '1.0',
    task_id: record.taskId,
    slug: record.slug,
    status: record.status,
    gate_verdict: record.gateVerdict,
    planner_provider: record.plannerProvider,
    worker_provider: record.workerProvider,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    last_output_at: record.lastOutputAt,
    latest_progress_summary: record.latestProgressSummary,
    planner_context: record.plannerContext,
  };
}

function buildArtifactPaths(paths: RuntimePaths, timestamp: string, slug: string, dayKey: string): {
  dayDir: string;
  promptPath: string;
  contractPath: string;
  completedPath: string;
  resultPath: string;
  workerLogPath: string;
  metaPath: string;
} {
  const dayDir = path.join(paths.taskRoot, dayKey);
  const base = `${timestamp}-${slug}`;
  return {
    dayDir,
    promptPath: path.join(dayDir, `${base}-prompt.md`),
    contractPath: path.join(dayDir, `${base}-contract.json`),
    completedPath: path.join(dayDir, `${base}-completed.md`),
    resultPath: path.join(dayDir, `${base}-result.json`),
    workerLogPath: path.join(dayDir, `${base}-worker-stdout.log`),
    metaPath: path.join(dayDir, `${base}-meta.json`),
  };
}

export async function createQueuedTask(
  profile: ProjectProfile,
  paths: RuntimePaths,
  index: TaskStoreIndex,
  input: CreateTaskInput,
): Promise<TaskRecord> {
  const now = new Date();
  const createdAt = now.toISOString();
  const dayKey = toDayKey(now);
  const slug = safeSlug(input.objective);
  const timestamp = toTimestampCompact(now);
  const taskId = nextTaskId(index);
  const artifact = buildArtifactPaths(paths, timestamp, slug, dayKey);

  await ensureDir(artifact.dayDir);
  await writeTextFile(artifact.promptPath, input.promptMarkdown);
  await writeJsonFile(artifact.contractPath, input.contract);

  const task: TaskRecord = {
    taskId,
    title: input.objective,
    slug,
    dayKey,
    status: 'QUEUED',
    gateVerdict: null,
    plannerProvider: input.plannerProvider,
    workerProvider: input.workerProvider,
    createdAt,
    updatedAt: createdAt,
    lastOutputAt: createdAt,
    latestProgressSummary: 'Planner created prompt + contract.',
    promptPath: artifact.promptPath,
    contractPath: artifact.contractPath,
    completedPath: null,
    resultPath: null,
    metaPath: artifact.metaPath,
    workerLogPath: null,
    plannerContext: input.plannerContext,
    ...(input.healthContext !== undefined ? { healthContext: input.healthContext } : {}),
  };

  index.tasks.push(task);
  await writeJsonFile(paths.taskIndexPath, index);
  await writeJsonFile(task.metaPath, buildTaskMeta(task));
  return task;
}

export async function updateTaskRecord(
  paths: RuntimePaths,
  index: TaskStoreIndex,
  taskId: number,
  patch: Partial<TaskRecord>,
): Promise<TaskRecord> {
  const current = index.tasks.find((task) => task.taskId === taskId);
  if (!current) {
    throw new Error(`Task ${taskId} not found`);
  }
  const updated: TaskRecord = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  };
  const idx = index.tasks.findIndex((task) => task.taskId === taskId);
  index.tasks[idx] = updated;
  await writeJsonFile(paths.taskIndexPath, index);
  await writeJsonFile(updated.metaPath, buildTaskMeta(updated));
  return updated;
}

export async function writeTaskCompletionArtifacts(
  task: TaskRecord,
  completedMarkdown: string,
  taskResult: TaskResult,
  workerStdout: string,
): Promise<{ completedPath: string; resultPath: string; workerLogPath: string }> {
  const parsed = path.parse(task.promptPath);
  const baseName = parsed.name.replace(/-prompt$/, '');
  const completedPath = path.join(parsed.dir, `${baseName}-completed.md`);
  const resultPath = path.join(parsed.dir, `${baseName}-result.json`);
  const workerLogPath = path.join(parsed.dir, `${baseName}-worker-stdout.log`);

  await writeTextFile(completedPath, completedMarkdown);
  await writeJsonFile(resultPath, taskResult);
  await writeTextFile(workerLogPath, workerStdout);
  return { completedPath, resultPath, workerLogPath };
}

export function toFinalStatus(verdict: GateVerdict): TaskStatus {
  if (verdict === 'PASS') return 'COMPLETED';
  if (verdict === 'PROVIDER_RATE_LIMITED') return 'FAILED_RATE_LIMIT';
  return 'REPLAN_REQUIRED';
}
