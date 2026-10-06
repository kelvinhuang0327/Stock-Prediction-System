import nodePath from 'node:path';
import {
  ensureDir,
  fileExists,
  nowIso,
  readJsonFile,
  resolveWorkspacePath,
  writeJsonFile,
  writeTextFile,
} from './common';
import type {
  ProjectProfile,
  RunRecord,
  RunStore,
  SchedulerState,
  TaskMeta,
  TaskRecord,
  TaskStatus,
  TaskStoreIndex,
} from './types';

interface RuntimePaths {
  orchestratorRoot: string;
  taskRoot: string;
  logRoot: string;
  databasePath: string;
  schedulerStatePath: string;
  taskIndexPath: string;
  runStorePath: string;
}

function buildRuntimePaths(profile: ProjectProfile): RuntimePaths {
  const orchestratorRoot = resolveWorkspacePath(profile.orchestrator_root);
  return {
    orchestratorRoot,
    taskRoot: resolveWorkspacePath(profile.task_storage_path),
    logRoot: resolveWorkspacePath(profile.log_storage_path),
    databasePath: resolveWorkspacePath(profile.database_path),
    schedulerStatePath: nodePath.join(orchestratorRoot, 'scheduler_state.json'),
    taskIndexPath: nodePath.join(orchestratorRoot, 'task_index.json'),
    runStorePath: nodePath.join(orchestratorRoot, 'runs.json'),
  };
}

function defaultSchedulerState(profile: ProjectProfile): SchedulerState {
  return {
    version: '1.0',
    schedulerEnabled: false,
    plannerProvider: profile.planner_provider,
    workerProvider: profile.worker_provider,
    providerCooldowns: {},
    scheduleMinutes: profile.default_schedule_minutes,
    nextPlannerRunAt: null,
    nextWorkerRunAt: null,
    lastPlannerRunAt: null,
    lastWorkerRunAt: null,
    updatedAt: nowIso(),
  };
}

function defaultTaskIndex(): TaskStoreIndex {
  return {
    version: '1.0',
    tasks: [],
  };
}

function defaultRunStore(): RunStore {
  return {
    version: '1.0',
    runs: [],
  };
}

export async function ensureRuntimeLayout(profile: ProjectProfile): Promise<RuntimePaths> {
  const paths = buildRuntimePaths(profile);
  await ensureDir(paths.orchestratorRoot);
  await ensureDir(paths.taskRoot);
  await ensureDir(paths.logRoot);
  await ensureDir(nodePath.dirname(paths.databasePath));

  if (!(await fileExists(paths.databasePath))) {
    await writeTextFile(paths.databasePath, '');
  }

  if (!(await fileExists(paths.schedulerStatePath))) {
    await writeJsonFile(paths.schedulerStatePath, defaultSchedulerState(profile));
  }
  if (!(await fileExists(paths.taskIndexPath))) {
    await writeJsonFile(paths.taskIndexPath, defaultTaskIndex());
  }
  if (!(await fileExists(paths.runStorePath))) {
    await writeJsonFile(paths.runStorePath, defaultRunStore());
  }

  return paths;
}

export async function loadSchedulerState(profile: ProjectProfile): Promise<{ paths: RuntimePaths; state: SchedulerState }> {
  const paths = await ensureRuntimeLayout(profile);
  const stored: Partial<SchedulerState> = await readJsonFile<Partial<SchedulerState>>(paths.schedulerStatePath).catch(() => ({} as Partial<SchedulerState>));
  const state: SchedulerState = {
    ...defaultSchedulerState(profile),
    ...stored,
    providerCooldowns: stored.providerCooldowns ?? {},
  };
  return { paths, state };
}

export async function saveSchedulerState(paths: RuntimePaths, state: SchedulerState): Promise<void> {
  await writeJsonFile(paths.schedulerStatePath, { ...state, updatedAt: nowIso() });
}

export async function loadTaskIndex(paths: RuntimePaths): Promise<TaskStoreIndex> {
  const stored: Partial<TaskStoreIndex> = await readJsonFile<Partial<TaskStoreIndex>>(paths.taskIndexPath).catch(() => ({} as Partial<TaskStoreIndex>));
  return {
    ...defaultTaskIndex(),
    ...stored,
    tasks: Array.isArray(stored.tasks) ? stored.tasks : [],
  };
}

export async function saveTaskIndex(paths: RuntimePaths, index: TaskStoreIndex): Promise<void> {
  await writeJsonFile(paths.taskIndexPath, index);
}

export async function loadRunStore(paths: RuntimePaths): Promise<RunStore> {
  const stored: Partial<RunStore> = await readJsonFile<Partial<RunStore>>(paths.runStorePath).catch(() => ({} as Partial<RunStore>));
  return {
    ...defaultRunStore(),
    ...stored,
    runs: Array.isArray(stored.runs) ? stored.runs : [],
  };
}

export async function appendRun(paths: RuntimePaths, run: RunRecord): Promise<void> {
  const store = await loadRunStore(paths);
  store.runs.unshift(run);
  store.runs = store.runs.slice(0, 500);
  await writeJsonFile(paths.runStorePath, store);
}

export function getLatestTask(index: TaskStoreIndex): TaskRecord | null {
  if (index.tasks.length === 0) return null;
  return [...index.tasks].sort((a, b) => (a.taskId > b.taskId ? -1 : 1))[0] ?? null;
}

export function findFirstTaskByStatus(index: TaskStoreIndex, status: TaskStatus): TaskRecord | null {
  return (
    [...index.tasks]
      .filter((task) => task.status === status)
      .sort((a, b) => (a.taskId > b.taskId ? -1 : 1))
      .at(-1) ?? null
  );
}

export function findTaskById(index: TaskStoreIndex, taskId: number): TaskRecord | null {
  return index.tasks.find((task) => task.taskId === taskId) ?? null;
}

export async function writeTaskMeta(task: TaskRecord, meta: TaskMeta): Promise<void> {
  await writeJsonFile(task.metaPath, meta);
}

export type { RuntimePaths };
