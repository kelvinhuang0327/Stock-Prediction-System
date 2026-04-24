import { fileExists, nowIso, readJsonFile, scheduleNextRunAt } from './common';
import { runPlannerTick } from './plannerTick';
import { loadProjectProfile } from './profile';
import {
  findTaskById,
  getLatestTask,
  loadRunStore,
  loadSchedulerState,
  loadTaskIndex,
  saveSchedulerState,
} from './storage';
import { runWorkerTick } from './workerTick';
import { isTerminalTaskStatus } from './types';
import type { PlannerProvider, TaskContract, TaskResult, WorkerProvider } from './types';

interface ListTaskOptions {
  page?: number;
  pageSize?: number;
  date?: string;   // YYYYMMDD
  status?: string; // TaskStatus value
}

function pagination<T>(rows: T[], page: number, pageSize: number): {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: T[];
} {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(Math.max(page, 1), totalPages);
  const start = (normalizedPage - 1) * pageSize;
  const end = start + pageSize;
  return {
    page: normalizedPage,
    pageSize,
    total,
    totalPages,
    rows: rows.slice(start, end),
  };
}

export async function getOrchestratorSummary() {
  const profile = await loadProjectProfile();
  const { paths, state } = await loadSchedulerState(profile);
  const index = await loadTaskIndex(paths);
  const runs = await loadRunStore(paths);
  const latestTask = getLatestTask(index);

  return {
    schedulerEnabled: state.schedulerEnabled,
    plannerProvider: state.plannerProvider,
    workerProvider: state.workerProvider,
    scheduleMinutes: state.scheduleMinutes,
    nextPlannerRunAt: state.nextPlannerRunAt,
    nextWorkerRunAt: state.nextWorkerRunAt,
    lastPlannerRunAt: state.lastPlannerRunAt,
    lastWorkerRunAt: state.lastWorkerRunAt,
    taskCounts: {
      total: index.tasks.length,
      queued: index.tasks.filter((task) => task.status === 'QUEUED').length,
      running: index.tasks.filter((task) => task.status === 'RUNNING').length,
      completed: index.tasks.filter((task) => task.status === 'COMPLETED').length,
      failed: index.tasks.filter((task) => task.status === 'FAILED' || task.status === 'FAILED_RATE_LIMIT').length,
      failedRateLimit: index.tasks.filter((task) => task.status === 'FAILED_RATE_LIMIT').length,
      replanRequired: index.tasks.filter((task) => task.status === 'REPLAN_REQUIRED').length,
    },
    providerCooldowns: state.providerCooldowns ?? {},
    latestTask,
    recentRuns: runs.runs.slice(0, 20),
    profile: {
      projectName: profile.project_name,
      backlogPath: profile.backlog_path,
      protectedPaths: profile.protected_paths,
      requiredChecks: profile.required_checks,
    },
  };
}

export async function listOrchestratorTasks(options: ListTaskOptions = {}) {
  const profile = await loadProjectProfile();
  const { paths } = await loadSchedulerState(profile);
  const index = await loadTaskIndex(paths);
  const page = options.page ?? 1;
  const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 100);
  let sorted = [...index.tasks].sort((a, b) => b.taskId - a.taskId);

  if (options.status) {
    sorted = sorted.filter((t) => t.status === options.status);
  }
  if (options.date) {
    sorted = sorted.filter((t) => t.dayKey === options.date);
  }

  return pagination(sorted, page, pageSize);
}

export async function getOrchestratorTaskDetail(taskId: number) {
  const profile = await loadProjectProfile();
  const { paths } = await loadSchedulerState(profile);
  const index = await loadTaskIndex(paths);
  const task = findTaskById(index, taskId);
  if (!task) return null;

  const contract = task.contractPath && (await fileExists(task.contractPath))
    ? await readJsonFile<TaskContract>(task.contractPath)
    : null;
  const result = task.resultPath && (await fileExists(task.resultPath))
    ? await readJsonFile<TaskResult>(task.resultPath)
    : null;

  return {
    task,
    contract,
    result,
  };
}

export async function listOrchestratorRuns(limit = 100) {
  const profile = await loadProjectProfile();
  const { paths } = await loadSchedulerState(profile);
  const runs = await loadRunStore(paths);
  return runs.runs.slice(0, Math.max(1, Math.min(limit, 500)));
}

export async function updateOrchestratorScheduler(enabled: boolean) {
  const profile = await loadProjectProfile();
  const { paths, state } = await loadSchedulerState(profile);
  state.schedulerEnabled = enabled;
  state.updatedAt = nowIso();

  if (enabled) {
    state.nextPlannerRunAt = scheduleNextRunAt(state.scheduleMinutes);
    state.nextWorkerRunAt = scheduleNextRunAt(state.scheduleMinutes);
  } else {
    state.nextPlannerRunAt = null;
    state.nextWorkerRunAt = null;
  }

  await saveSchedulerState(paths, state);
  return state;
}

export async function updateOrchestratorProviders(plannerProvider: PlannerProvider, workerProvider: WorkerProvider) {
  const profile = await loadProjectProfile();
  const { paths, state } = await loadSchedulerState(profile);
  state.plannerProvider = plannerProvider;
  state.workerProvider = workerProvider;
  state.updatedAt = nowIso();
  await saveSchedulerState(paths, state);
  return state;
}

export async function runOrchestratorNow(target: 'planner' | 'worker' | 'both') {
  if (target === 'planner') {
    return {
      planner: await runPlannerTick({ force: true }),
      worker: null,
    };
  }
  if (target === 'worker') {
    return {
      planner: null,
      worker: await runWorkerTick({ force: true }),
    };
  }
  const planner = await runPlannerTick({ force: true });
  const worker = await runWorkerTick({ force: true });
  return { planner, worker };
}

export async function ensureOrchestratorBootstrap() {
  const profile = await loadProjectProfile();
  await loadSchedulerState(profile);
}
