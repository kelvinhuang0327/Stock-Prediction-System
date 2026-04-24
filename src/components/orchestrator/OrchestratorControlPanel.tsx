"use client";

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GlassButton } from '@/components/ui/glass-button';
import type { PlannerProvider, WorkerProvider } from '@/lib/agent-orchestrator/types';

interface OrchestratorControlPanelProps {
  schedulerEnabled: boolean;
  plannerProvider: PlannerProvider;
  workerProvider: WorkerProvider;
}

type RunTarget = 'planner' | 'worker' | 'both';

interface RunRecord {
  request_id: string;
  runner: string;
  outcome: string;
  task_id: string | null;
  tick_at: string;
  message?: string | null;
}

interface TaskRecord {
  taskId: number;
  title?: string;
  dayKey: string;
  slug: string;
  status: string;
  plannerProvider: string;
  workerProvider: string;
  createdAt?: string;
  lastOutputAt?: string | null;
  latestProgressSummary?: string | null;
  changedFilesCount?: number | null;
  completedAt?: string | null;
  durationMs?: number | null;
  plannerContext?: {
    taskType: string;
    game: string | null;
    dedupeKey: string;
  } | null;
}

interface TaskDetail {
  task: TaskRecord & {
    promptPath?: string;
    contractPath?: string;
    resultPath?: string | null;
    workerLogPath?: string | null;
  };
  contract?: {
    objective: string;
    scope?: string[];
    constraints?: string[];
    acceptance_tests?: string[];
    required_outputs?: string[];
    trigger_reason?: string;
    background?: string;
  } | null;
  result?: {
    gate_verdict: string;
    gate_reason: string;
    failure_provider?: string | null;
    failure_reason?: string | null;
    reset_hint?: string | null;
    final_message?: string | null;
    duration_seconds: number;
    changed_files: string[];
    acceptance_results: Array<{ name: string; passed: boolean; evidence: string }>;
    next_action: string;
  } | null;
  promptContent?: string | null;
  completedContent?: string | null;
  workerLogTail?: string | null;
}

interface Summary {
  nextPlannerRunAt?: string | null;
  nextWorkerRunAt?: string | null;
  plannerProvider?: string;
  workerProvider?: string;
  providerCooldowns?: Record<string, {
    blockedUntil: string;
    reason: string;
    resetHint: string | null;
    finalMessage: string;
    lastTaskId: number | null;
    updatedAt: string;
  }>;
}

function outcomeColor(outcome: string): string {
  if (outcome === 'NEW_TASK')  return 'text-emerald-400';
  if (outcome === 'SKIPPED')   return 'text-slate-400';
  if (outcome === 'RUNNING')   return 'text-yellow-400 animate-pulse';
  if (outcome === 'TIMEOUT')   return 'text-orange-400';
  return 'text-rose-400';
}

function statusColor(status: string): string {
  if (status === 'COMPLETED') return 'text-emerald-400';
  if (status === 'RUNNING')   return 'text-yellow-400';
  if (status === 'QUEUED')    return 'text-blue-400';
  if (status === 'FAILED_RATE_LIMIT') return 'text-orange-300';
  if (status === 'FAILED')    return 'text-rose-400';
  return 'text-slate-400';
}

async function postJson(url: string, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string; request_id?: string }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; request_id?: string };
  if (!response.ok || !data.ok) {
    return { ok: false, error: data.error ?? `HTTP ${response.status}` };
  }
  return { ok: true, request_id: data.request_id };
}

function fmtDuration(ms?: number | null): string {
  if (!ms) return '-';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
}

function fmtDurationSec(sec?: number | null): string {
  if (!sec) return '-';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m${sec % 60}s`;
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function useCountdown(nextRunAt: string | null | undefined): string {
  const [display, setDisplay] = useState('—');

  useEffect(() => {
    if (!nextRunAt) { setDisplay('—'); return; }
    const tick = () => {
      const diff = new Date(nextRunAt).getTime() - Date.now();
      if (diff <= 0) { setDisplay('即將執行'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(`${m}m ${String(s).padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRunAt]);

  return display;
}

export function OrchestratorControlPanel({
  schedulerEnabled,
  plannerProvider,
  workerProvider,
}: Readonly<OrchestratorControlPanelProps>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [schedulerState, setSchedulerState] = useState<boolean>(schedulerEnabled);
  const [planner, setPlanner] = useState<PlannerProvider>(plannerProvider);
  const [worker, setWorker] = useState<WorkerProvider>(workerProvider);
  const [workerCopilotModel, setWorkerCopilotModel] = useState('');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Planner trace (request_id based)
  const [plannerTrace, setPlannerTrace] = useState<{ requestId: string; outcome: string; taskId: string | null; note?: string } | null>(null);

  // Summary (for countdown timer)
  const [summary, setSummary] = useState<Summary | null>(null);
  const plannerCountdown = useCountdown(summary?.nextPlannerRunAt);
  const workerCountdown  = useCountdown(summary?.nextWorkerRunAt);
  const activeWorkerCooldown = summary?.workerProvider ? summary.providerCooldowns?.[summary.workerProvider] : undefined;

  // Task list state
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskPage, setTaskPage] = useState(1);
  const [taskDate, setTaskDate] = useState('');
  const [taskStatus, setTaskStatus] = useState('');
  const [tasksLoading, setTasksLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<TaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Run history
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  // Provider hint
  const [comboLabel, setComboLabel] = useState(`planner=${plannerProvider} · worker=${workerProvider}`);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/orchestrator/summary');
      const data = await res.json() as { ok: boolean } & Summary;
      if (data.ok) setSummary(data);
    } catch { /* ignore */ }
  }, []);

  const loadTasks = useCallback(async (page = 1, date = '', status = '') => {
    setTasksLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' });
      if (date)   params.set('date', date);
      if (status) params.set('status', status);
      const res = await fetch(`/api/orchestrator/tasks?${params.toString()}`);
      const data = await res.json() as { ok: boolean; rows?: TaskRecord[]; total?: number };
      if (data.ok) {
        setTasks(data.rows ?? []);
        setTaskTotal(data.total ?? 0);
      }
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const res = await fetch('/api/orchestrator/runs?limit=50');
      const data = await res.json() as { ok: boolean; runs?: RunRecord[] };
      if (data.ok) setRuns(data.runs ?? []);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  const selectTask = useCallback(async (t: TaskRecord) => {
    setSelectedTask(t);
    setSelectedTaskDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/orchestrator/tasks/${t.taskId}`);
      const data = await res.json() as { ok: boolean; detail?: TaskDetail };
      if (data.ok && data.detail) setSelectedTaskDetail(data.detail);
    } catch { /* ignore */ } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadTasks();
    void loadRuns();
  }, [loadSummary, loadTasks, loadRuns]);

  // Refresh summary every 60s for countdown
  useEffect(() => {
    const id = setInterval(() => { void loadSummary(); }, 60_000);
    return () => clearInterval(id);
  }, [loadSummary]);

  async function pollOutcome(runner: string, requestId: string) {
    const MAX_POLLS = 47; // ~70s at 1500ms intervals
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const res  = await fetch(`/api/orchestrator/run-status?runner=${runner}&request_id=${requestId}`);
        const data = await res.json() as { ok: boolean; final?: boolean; run?: RunRecord };
        if (data.ok && data.final && data.run) {
          setPlannerTrace({
            requestId,
            outcome: data.run.outcome,
            taskId:  data.run.task_id,
            note:    data.run.message ?? undefined,
          });
          void loadTasks(1, taskDate, taskStatus);
          void loadRuns();
          void loadSummary();
          return;
        }
      } catch { /* ignore */ }
    }
    setPlannerTrace((prev) => prev ? { ...prev, outcome: 'TIMEOUT', note: '70s elapsed — no response' } : prev);
  }

  async function runNow(target: RunTarget) {
    setError('');
    setMessage('');
    const runner = target === 'both' ? 'planner' : target;
    const result = await postJson('/api/orchestrator/run-now', { target });
    if (!result.ok) {
      setError(`Run ${target} failed: ${result.error ?? 'unknown error'}`);
      return;
    }
    const requestId = result.request_id ?? `${runner}-${Date.now()}`;
    if (target === 'planner' || target === 'both') {
      setPlannerTrace({ requestId, outcome: 'RUNNING', taskId: null });
      void pollOutcome(runner, requestId);
    }
    setMessage(`Run ${target} queued.`);
    startTransition(() => router.refresh());
  }


  async function setScheduler(enabled: boolean) {
    setError('');
    setMessage('');
    const result = await postJson('/api/orchestrator/scheduler', { enabled });
    if (!result.ok) {
      setError(`Scheduler update failed: ${result.error ?? 'unknown error'}`);
      return;
    }
    setSchedulerState(enabled);
    setMessage(`Scheduler ${enabled ? '已啟用' : '已停止'}.`);
    startTransition(() => router.refresh());
  }

  async function applyProviders() {
    setError('');
    setMessage('');
    const result = await postJson('/api/orchestrator/providers', {
      planner_provider: planner,
      worker_provider:  worker,
    });
    if (!result.ok) {
      setError(`Provider update failed: ${result.error ?? 'unknown error'}`);
      return;
    }
    setComboLabel(`planner=${planner} · worker=${worker}`);
    setMessage(`Providers updated.`);
    startTransition(() => router.refresh());
  }

  function handleTaskFilter() {
    setTaskPage(1);
    void loadTasks(1, taskDate, taskStatus);
  }

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(taskTotal / PAGE_SIZE));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-5">
      {/* ── Header with scheduler state ── */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Orchestration</div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${schedulerState ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
          {schedulerState ? '排程啟用中' : '排程已停止'}
        </span>
      </div>

      {/* ── Countdown timers ── */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-700">
          <div className="text-slate-400 mb-1">Planner 下次執行</div>
          <div className="text-white font-mono font-medium">{plannerCountdown}</div>
        </div>
        <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-700">
          <div className="text-slate-400 mb-1">Worker 下次執行</div>
          <div className="text-white font-mono font-medium">{workerCountdown}</div>
        </div>
      </div>

      {activeWorkerCooldown && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-100">
          <div className="font-medium">目前 provider 額度限制中</div>
          <div className="mt-1">{summary?.workerProvider} blocked until {new Date(activeWorkerCooldown.blockedUntil).toLocaleString()}</div>
          <div className="mt-1 text-orange-200/90">{activeWorkerCooldown.resetHint ?? '請等待 reset，或切換到其他 worker provider。'}</div>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap gap-2">
        <GlassButton loading={isPending} onClick={() => void runNow('planner')} variant="primary">Planner 立即執行</GlassButton>
        <GlassButton loading={isPending} onClick={() => void runNow('worker')}  variant="primary">Worker 立即執行</GlassButton>
        <GlassButton loading={isPending} onClick={() => void runNow('both')}    variant="success">執行全部</GlassButton>
        <GlassButton loading={isPending} onClick={() => void setScheduler(true)}  variant="success" disabled={schedulerState}>啟用排程</GlassButton>
        <GlassButton loading={isPending} onClick={() => void setScheduler(false)} variant="danger"  disabled={!schedulerState}>停止排程</GlassButton>
      </div>

      {/* ── Planner trace (request_id based) ── */}
      {plannerTrace && (
        <div className="rounded-lg bg-slate-900/60 border border-slate-700 p-2 text-xs font-mono">
          <div className="text-slate-400 mb-1">Planner 觸發追蹤</div>
          <div className="grid grid-cols-3 gap-2">
            <span className="text-slate-500">request_id</span>
            <span className="text-slate-500">outcome</span>
            <span className="text-slate-500">task_id</span>
            <span className="text-white">{plannerTrace.requestId.slice(0, 12)}…</span>
            <span className={outcomeColor(plannerTrace.outcome)}>{plannerTrace.outcome}</span>
            <span className="text-slate-300">{plannerTrace.taskId ?? '—'}</span>
          </div>
          {plannerTrace.note && <div className="mt-1 text-slate-400">{plannerTrace.note}</div>}
        </div>
      )}

      {/* ── Providers + Copilot model ── */}
      <div className="space-y-2">
        <div className="text-xs text-slate-400 font-medium">Provider 設定</div>
        <div className="text-xs text-slate-500">{comboLabel}</div>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <select
            value={planner}
            onChange={(e) => { setPlanner(e.target.value as PlannerProvider); setComboLabel(`planner=${e.target.value} · worker=${worker}`); }}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            disabled={isPending}
          >
            <option value="codex">planner: codex</option>
            <option value="claude">planner: claude</option>
          </select>
          <select
            value={worker}
            onChange={(e) => { setWorker(e.target.value as WorkerProvider); setComboLabel(`planner=${planner} · worker=${e.target.value}`); }}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            disabled={isPending}
          >
            <option value="codex">worker: codex</option>
            <option value="claude">worker: claude</option>
            <option value="copilot">worker: copilot</option>
            <option value="copilot-daemon">worker: copilot-daemon</option>
          </select>
          <GlassButton loading={isPending} onClick={() => void applyProviders()} variant="default">套用</GlassButton>
        </div>
        {worker === 'copilot' || worker === 'copilot-daemon' ? (
          <div>
            <input
              list="copilot-model-options"
              value={workerCopilotModel}
              onChange={(e) => setWorkerCopilotModel(e.target.value)}
              placeholder="Copilot model (e.g. gpt-4o)"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <datalist id="copilot-model-options">
              <option value="auto" />
              <option value="gpt-4o" />
              <option value="gpt-4o-mini" />
            </datalist>
          </div>
        ) : null}
      </div>

      {/* ── Feedback ── */}
      {message && <div className="text-sm text-emerald-300">{message}</div>}
      {error   && <div className="text-sm text-rose-300">{error}</div>}

      {/* ── Task list with filters ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">任務列表</span>
          <input
            type="text"
            placeholder="日期 YYYYMMDD"
            value={taskDate}
            onChange={(e) => setTaskDate(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 w-32"
          />
          <select
            value={taskStatus}
            onChange={(e) => setTaskStatus(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
          >
            <option value="">全部狀態</option>
            <option value="QUEUED">QUEUED</option>
            <option value="RUNNING">RUNNING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="FAILED_RATE_LIMIT">FAILED_RATE_LIMIT</option>
            <option value="FAILED">FAILED</option>
          </select>
          <GlassButton onClick={handleTaskFilter} variant="default" loading={tasksLoading}>篩選</GlassButton>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left pb-1 pr-3">ID</th>
                <th className="text-left pb-1 pr-3">Planner 發佈時間</th>
                <th className="text-left pb-1 pr-3">標題</th>
                <th className="text-left pb-1 pr-3">狀態</th>
                <th className="text-left pb-1 pr-3">耗時</th>
                <th className="text-left pb-1 pr-3">異動檔案</th>
                <th className="text-left pb-1">Worker 完成時間</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr
                  key={t.taskId}
                  className="border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/40 transition-colors"
                  onClick={() => setSelectedTask(t)}
                >
                  <td className="py-1 pr-3 text-slate-400">{t.taskId}</td>
                  <td className="py-1 pr-3 text-slate-400">{t.dayKey}</td>
                  <td className="py-1 pr-3 text-white max-w-[180px] truncate">
                    {t.slug}
                    {t.status === 'RUNNING' && (
                      <span className="ml-1 text-yellow-400 text-[10px]">● RUNNING</span>
                    )}
                    {t.status === 'FAILED_RATE_LIMIT' && (
                      <span className="ml-1 text-orange-300 text-[10px]">● 額度限制</span>
                    )}
                  </td>
                  <td className={`py-1 pr-3 ${statusColor(t.status)}`}>{t.status}</td>
                  <td className="py-1 pr-3 text-slate-400">{fmtDuration(t.durationMs)}</td>
                  <td className="py-1 pr-3 text-slate-400">{t.changedFilesCount ?? '—'}</td>
                  <td className="py-1 text-slate-400">{t.completedAt ? new Date(t.completedAt).toLocaleTimeString() : '—'}</td>
                </tr>
              ))}
              {tasks.length === 0 && !tasksLoading && (
                <tr><td colSpan={7} className="py-3 text-slate-500 text-center">無資料</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <button
              disabled={taskPage <= 1}
              onClick={() => { const p = taskPage - 1; setTaskPage(p); void loadTasks(p, taskDate, taskStatus); }}
              className="px-2 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40"
            >‹</button>
            <span className="text-slate-400">{taskPage} / {totalPages}  ({taskTotal} 筆)</span>
            <button
              disabled={taskPage >= totalPages}
              onClick={() => { const p = taskPage + 1; setTaskPage(p); void loadTasks(p, taskDate, taskStatus); }}
              className="px-2 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40"
            >›</button>
          </div>
        )}

        {/* Selected task detail */}
        {selectedTask && (
          <div className="rounded-lg bg-slate-900/80 border border-slate-700 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="font-semibold text-white">任務 #{selectedTask.taskId} 詳情</span>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-300">
              <span>狀態:</span><span className={statusColor(selectedTask.status)}>{selectedTask.status}</span>
              <span>Planner:</span><span>{selectedTask.plannerProvider}</span>
              <span>Worker:</span><span>{selectedTask.workerProvider}</span>
              <span>日期:</span><span>{selectedTask.dayKey}</span>
            </div>
            {selectedTask.latestProgressSummary && (
              <div className="mt-1 text-slate-400 whitespace-pre-wrap">{selectedTask.latestProgressSummary}</div>
            )}
            {selectedTask.status === 'FAILED_RATE_LIMIT' && (
              <div className="text-orange-200">建議：等待 provider reset，或切換其他 provider 後再跑下一輪 worker。</div>
            )}
          </div>
        )}
      </div>

      {/* ── Run history ── */}
      <div className="space-y-2">
        <div className="text-xs text-slate-400 font-medium">{'執行歷史 (最近 50 筆)'}
          <button onClick={() => void loadRuns()} className="ml-2 text-blue-400 hover:underline">{runsLoading ? '載入中…' : '重新整理'}</button>
        </div>
        <div className="overflow-x-auto max-h-48">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left pb-1 pr-3">時間</th>
                <th className="text-left pb-1 pr-3">Runner</th>
                <th className="text-left pb-1 pr-3">結果</th>
                <th className="text-left pb-1 pr-3">Task ID</th>
                <th className="text-left pb-1">訊息</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={`${r.request_id}-${i}`} className="border-b border-slate-800/50">
                  <td className="py-0.5 pr-3 text-slate-400">{r.tick_at ? new Date(r.tick_at).toLocaleTimeString() : '—'}</td>
                  <td className="py-0.5 pr-3 text-slate-300">{r.runner}</td>
                  <td className={`py-0.5 pr-3 ${outcomeColor(r.outcome)}`}>{r.outcome}</td>
                  <td className="py-0.5 pr-3 text-slate-400">{r.task_id ?? '—'}</td>
                  <td className="py-0.5 text-slate-500 max-w-[320px] truncate" title={r.message ?? ''}>{r.message ?? '—'}</td>
                </tr>
              ))}
              {runs.length === 0 && !runsLoading && (
                <tr><td colSpan={5} className="py-3 text-slate-500 text-center">無執行記錄</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
