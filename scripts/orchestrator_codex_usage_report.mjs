#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RUNTIME_ROOT = path.join(ROOT, 'runtime', 'agent_orchestrator');
const TASK_INDEX_PATH = path.join(RUNTIME_ROOT, 'task_index.json');
const EVENTS_PATH = path.join(RUNTIME_ROOT, 'llm_execution_events.jsonl');
const STATE_JSON_PATH = path.join(RUNTIME_ROOT, 'state.json');
const SCHEDULER_STATE_PATH = path.join(RUNTIME_ROOT, 'scheduler_state.json');

function parseArgs(argv) {
  const args = { mode: 'last', value: '24h', limit: 50 };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--last') {
      args.mode = 'last';
      args.value = argv[index + 1] ?? '24h';
      index += 1;
      continue;
    }
    if (token === '--today') {
      args.mode = 'today';
      continue;
    }
    if (token === '--limit') {
      const parsed = Number.parseInt(argv[index + 1] ?? '50', 10);
      args.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
      index += 1;
    }
  }
  return args;
}

function parseDurationMs(value) {
  const match = /^(\d+)([smhd])$/i.exec(value);
  if (!match) {
    throw new Error(`Unsupported --last value: ${value}. Use forms like 24h, 30m, 7d.`);
  }
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * multipliers[unit];
}

function resolveWindow(args, now = new Date()) {
  if (args.mode === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return {
      label: 'today',
      start,
      end: now,
    };
  }
  const durationMs = parseDurationMs(args.value);
  return {
    label: `last ${args.value}`,
    start: new Date(now.getTime() - durationMs),
    end: now,
  };
}

function safeReadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function safeReadText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function readJsonLines(filePath) {
  const raw = safeReadText(filePath);
  if (!raw.trim()) return [];
  const rows = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      // ignore malformed lines in a read-only report
    }
  }
  return rows;
}

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function isWithinWindow(date, window) {
  return Boolean(date && date >= window.start && date <= window.end);
}

function taskTouchesWindow(task, window) {
  return [task.createdAt, task.updatedAt, task.lastOutputAt]
    .map(parseDate)
    .some((date) => isWithinWindow(date, window));
}

function summarizeTaskArtifacts(task) {
  const result = task.resultPath ? safeReadJson(task.resultPath, null) : null;
  const meta = task.metaPath ? safeReadJson(task.metaPath, null) : null;
  const workerLog = task.workerLogPath ? safeReadText(task.workerLogPath) : '';
  return { result, meta, workerLog };
}

function includesRegex(value, regex) {
  return typeof value === 'string' && regex.test(value);
}

function countTaskMarker(tasksWithArtifacts, predicate) {
  return tasksWithArtifacts.filter(predicate).length;
}

function buildTaskCallBreakdown(recentTasks, workerCodexExecutionsByTaskId) {
  return recentTasks.map((task) => {
    const workerCalls = workerCodexExecutionsByTaskId.get(String(task.taskId)) ?? 0;
    const plannerCalls = task.plannerProvider === 'codex' ? 1 : 0;
    return {
      taskId: task.taskId,
      slug: task.slug,
      status: task.status,
      planner_codex_calls: plannerCalls,
      worker_codex_calls: workerCalls,
      total_codex_calls: plannerCalls + workerCalls,
      createdAt: task.createdAt,
    };
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const window = resolveWindow(args);

  const taskIndex = safeReadJson(TASK_INDEX_PATH, { tasks: [] });
  const tasks = Array.isArray(taskIndex.tasks) ? taskIndex.tasks : [];
  const events = readJsonLines(EVENTS_PATH);
  const stateFileUsed = fs.existsSync(STATE_JSON_PATH) ? STATE_JSON_PATH : SCHEDULER_STATE_PATH;
  const schedulerState = safeReadJson(stateFileUsed, {});

  const windowEvents = events.filter((event) => isWithinWindow(parseDate(event.at), window));
  const plannerCodexEvents = windowEvents.filter(
    (event) => event.event === 'llm_preflight'
      && event.decision === 'allow'
      && event.provider === 'codex'
      && event.caller === 'planner',
  );
  const workerCodexEvents = windowEvents.filter(
    (event) => event.event === 'llm_execution' && event.provider === 'codex',
  );

  const workerCodexExecutionsByTaskId = new Map();
  for (const event of workerCodexEvents) {
    const taskId = String(event.task_id ?? '').trim();
    if (!taskId) continue;
    workerCodexExecutionsByTaskId.set(taskId, (workerCodexExecutionsByTaskId.get(taskId) ?? 0) + 1);
  }

  const recentTasks = tasks.filter((task) => taskTouchesWindow(task, window));
  const recentCodexTasks = recentTasks.filter(
    (task) => task.plannerProvider === 'codex' || task.workerProvider === 'codex' || workerCodexExecutionsByTaskId.has(String(task.taskId)),
  );
  const tasksWithArtifacts = recentCodexTasks.map((task) => ({ task, ...summarizeTaskArtifacts(task) }));

  const timeoutRegex = /\btime(?:d)?\s*out\b|\btimeout\b/i;
  const retryRegex = /\bretry(?:ing|ed)?\b/i;
  const recoveryRegex = /\brecover(?:y|ing|ed)\b/i;
  const mechanicalFallbackRegex = /mechanical[_ -]?fallback/i;

  const timeoutCount = countTaskMarker(tasksWithArtifacts, ({ result, workerLog }) => {
    const joined = [result?.gate_reason, result?.final_message, workerLog, ...(result?.error_markers_hit ?? [])]
      .filter(Boolean)
      .join('\n');
    return timeoutRegex.test(joined);
  });

  const invalidDeliveryCount = countTaskMarker(
    tasksWithArtifacts,
    ({ result }) => result?.gate_verdict === 'INVALID_DELIVERY',
  );

  const resultJsonSuccessCount = countTaskMarker(
    tasksWithArtifacts,
    ({ result }) => result?.status === 'COMPLETED' && result?.gate_verdict === 'PASS',
  );

  const retryCalls = plannerCodexEvents.filter(
    (event) => retryRegex.test(`${event.caller ?? ''} ${event.caller_context ?? ''} ${event.skip_reason ?? ''}`),
  ).length + countTaskMarker(tasksWithArtifacts, ({ result, workerLog }) => {
    const joined = [result?.gate_reason, result?.final_message, workerLog].filter(Boolean).join('\n');
    return retryRegex.test(joined);
  });

  const recoveryCalls = plannerCodexEvents.filter(
    (event) => recoveryRegex.test(`${event.caller ?? ''} ${event.caller_context ?? ''} ${event.skip_reason ?? ''}`),
  ).length + countTaskMarker(tasksWithArtifacts, ({ result, workerLog }) => {
    const joined = [result?.gate_reason, result?.final_message, workerLog].filter(Boolean).join('\n');
    return recoveryRegex.test(joined);
  });

  const mechanicalFallbackCount = countTaskMarker(tasksWithArtifacts, ({ result, workerLog }) => {
    const joined = [result?.gate_reason, result?.final_message, workerLog].filter(Boolean).join('\n');
    return mechanicalFallbackRegex.test(joined);
  });

  const taskCallBreakdown = buildTaskCallBreakdown(recentCodexTasks, workerCodexExecutionsByTaskId);
  const tasksWithMultipleAttempts = taskCallBreakdown
    .filter((task) => task.total_codex_calls > 1)
    .map((task) => ({
      taskId: task.taskId,
      slug: task.slug,
      total_codex_calls: task.total_codex_calls,
    }));

  const topTasksByCodexCalls = taskCallBreakdown
    .filter((task) => task.total_codex_calls > 0)
    .sort((left, right) => {
      if (right.total_codex_calls !== left.total_codex_calls) {
        return right.total_codex_calls - left.total_codex_calls;
      }
      return String(left.createdAt).localeCompare(String(right.createdAt));
    })
    .slice(0, args.limit);

  const report = {
    window: {
      label: window.label,
      start: window.start.toISOString(),
      end: window.end.toISOString(),
    },
    source_files: {
      events: path.relative(ROOT, EVENTS_PATH),
      task_index: path.relative(ROOT, TASK_INDEX_PATH),
      state_json_present: fs.existsSync(STATE_JSON_PATH),
      state_file_used: path.relative(ROOT, stateFileUsed),
      logs_dir_present: fs.existsSync(path.join(RUNTIME_ROOT, 'logs')),
    },
    scheduler_state: {
      schedulerEnabled: schedulerState.schedulerEnabled ?? null,
      plannerProvider: schedulerState.plannerProvider ?? null,
      workerProvider: schedulerState.workerProvider ?? null,
      lastPlannerRunAt: schedulerState.lastPlannerRunAt ?? null,
      lastWorkerRunAt: schedulerState.lastWorkerRunAt ?? null,
    },
    counting_rules: {
      total_codex_calls: 'planner_codex_calls + worker_codex_calls',
      planner_codex_calls: 'llm_preflight allow events where caller=planner and provider=codex',
      worker_codex_calls: 'llm_execution events where provider=codex',
      retry_calls: 'codex-related event/artifact records with retry markers',
      recovery_calls: 'codex-related event/artifact records with recovery markers',
      timeout_count: 'recent codex-related result/log artifacts with timeout markers',
      invalid_delivery_count: 'recent codex-related result.json files with gate_verdict=INVALID_DELIVERY',
      result_json_success_count: 'recent codex-related result.json files with status=COMPLETED and gate_verdict=PASS',
      mechanical_fallback_count: 'recent codex-related result/log artifacts with mechanical fallback markers',
      tasks_with_multiple_attempts: 'recent codex-related tasks whose inferred Codex call count > 1',
      top_tasks_by_codex_calls: 'recent codex-related tasks ranked by inferred planner(1 if plannerProvider=codex) + worker execution calls',
    },
    total_codex_calls: plannerCodexEvents.length + workerCodexEvents.length,
    planner_codex_calls: plannerCodexEvents.length,
    worker_codex_calls: workerCodexEvents.length,
    retry_calls: retryCalls,
    recovery_calls: recoveryCalls,
    timeout_count: timeoutCount,
    invalid_delivery_count: invalidDeliveryCount,
    result_json_success_count: resultJsonSuccessCount,
    mechanical_fallback_count: mechanicalFallbackCount,
    tasks_with_multiple_attempts: tasksWithMultipleAttempts,
    top_tasks_by_codex_calls: topTasksByCodexCalls,
  };

  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}