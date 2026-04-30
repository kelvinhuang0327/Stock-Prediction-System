'use client';

/**
 * /settings/system — 系統健康巡檢頁
 *
 * 顯示資料源狀態、快照新鮮度、同步日誌、通知發送摘要。
 * 用於日常巡檢，非操作頁（操作通知請至 /settings/notifications）。
 * 不暴露任何敏感設定值。
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/config/app';
import { StatusBadge } from '@/components/ui/badges';

// ─── Types ────────────────────────────────────────────────────────

interface ChannelHealth {
  channel: string;
  configured: boolean;
  lastStatus: string | null;
  lastSentAt: string | null;
}

interface DataSourceHealth {
  id: string;
  table: string;
  rowCount: number;
  lastDate: string | null;
  grade: 'A' | 'B' | 'C' | 'D';
  usable: boolean;
}

interface SnapshotHealth {
  type: string;
  latestDate: string | null;
  rowCount: number;
  fresh: boolean;
}

interface SyncHealth {
  jobType: string;
  lastRun: string | null;
  status: string | null;
}

interface SystemHealth {
  generatedAt: string;
  overallStatus: 'ok' | 'degraded' | 'critical';
  dbSizeMb: string;
  dataSources: DataSourceHealth[];
  snapshots: SnapshotHealth[];
  recentSync: SyncHealth[];
  notificationChannels: ChannelHealth[];
  last24hDelivery: { success: number; failed: number; skipped: number };
  knownLimitations: string[];
}

// ─── Task Status Types ────────────────────────────────────────────

interface TaskLatestRun {
  id: number | undefined;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  summary: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  triggerSource: string;
}

interface TaskStatus {
  taskName: string;
  label: string;
  cadence: string;
  scheduleLabel: string | null;
  writesToDb: boolean;
  supportsDryRun: boolean;
  nextRunAt: string | null;
  latestRun: TaskLatestRun | null;
  todayRan: boolean;
  todayStatus: string | null;
}

interface TasksResponse {
  tasks: TaskStatus[];
  generatedAt: string;
}

interface AutonomousSchedulerJobStatus {
  jobName: string;
  status: string;
  healthStatus: string;
  summary: string;
  failureStreak: number;
  failureCount: number;
  nextDueAt: string;
  skippedReason: string | null;
  generatedTaskCount: number;
  generatedInsightCount: number;
  schedulerOutcome: string;
  latestRun: {
    startedAt: string | null;
    finishedAt: string | null;
    status: string;
    summary: string | null;
    errorMessage: string | null;
    metadata: Record<string, unknown> | null;
  } | null;
}

interface AutonomousSchedulerResponse {
  jobs: AutonomousSchedulerJobStatus[];
}

interface RunTaskResponse {
  summary?: string;
  status?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function FreshBadge({ fresh }: Readonly<{ fresh: boolean }>) {
  return <StatusBadge status={fresh ? 'fresh' : 'stale'} variant="glass"
    label={fresh ? '新鮮' : '過期'} />;
}

function ConfiguredBadge({ configured }: Readonly<{ configured: boolean }>) {
  return <StatusBadge status={configured ? 'configured' : 'not configured'} variant="glass"
    label={configured ? '已設定' : '未設定'} />;
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
  } catch {
    return iso;
  }
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function TaskHeartbeat({ todayRan, todayStatus, latestRun }: Readonly<Pick<TaskStatus, 'todayRan' | 'todayStatus' | 'latestRun'>>) {
  if (todayRan && todayStatus === 'success') {
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 mr-2" title="今日已成功執行" />;
  }
  if (latestRun?.status === 'failed') {
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 mr-2" title="最近執行失敗" />;
  }
  if (latestRun?.status === 'running') {
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse mr-2" title="執行中" />;
  }
  if (latestRun) {
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400 mr-2" title="今日尚未執行" />;
  }
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-500 mr-2" title="從未執行" />;
}

// ─── Task Runner Button ───────────────────────────────────────────

function RunTaskButton({ taskName, supportsDryRun, onDone }: Readonly<{ taskName: string; supportsDryRun: boolean; onDone: () => void }>) {
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const run = useCallback(async (dryRun: boolean) => {
    setRunning(true);
    setRunResult(null);
    setRunError(null);
    try {
      const res = await fetch('/api/tasks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskName, dryRun }),
      });
      const data: RunTaskResponse = await res.json();
      if (!res.ok) {
        setRunError(data.error ?? `HTTP ${res.status}`);
      } else if (data.skipped) {
        setRunResult(`略過：${data.skipReason ?? '已執行過'}`);
      } else {
        setRunResult(data.summary ?? data.status ?? '完成');
        onDone();
      }
    } catch (e) {
      setRunError(e instanceof Error ? e.message : '執行失敗');
    } finally {
      setRunning(false);
    }
  }, [taskName, onDone]);

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        disabled={running}
        onClick={() => run(false)}
        className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs transition-colors"
      >
        {running ? '執行中…' : '立即執行'}
      </button>
      {supportsDryRun && (
        <button
          disabled={running}
          onClick={() => run(true)}
          className="px-3 py-1 rounded-md bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white text-xs transition-colors"
        >
          預覽執行
        </button>
      )}
      {runResult && <span className="text-xs text-green-400 truncate max-w-xs">{runResult}</span>}
      {runError && <span className="text-xs text-red-400 truncate max-w-xs">{runError}</span>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function SystemSettingsPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<TaskStatus[] | null>(null);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [schedulerJobs, setSchedulerJobs] = useState<AutonomousSchedulerJobStatus[] | null>(null);
  const [schedulerLoading, setSchedulerLoading] = useState(true);
  const [schedulerError, setSchedulerError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/system/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '無法取得系統健康資料');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const res = await fetch('/api/tasks/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: TasksResponse = await res.json();
      setTasks(data.tasks);
    } catch (e: unknown) {
      setTasksError(e instanceof Error ? e.message : '無法取得任務狀態');
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadScheduler = useCallback(async () => {
    setSchedulerLoading(true);
    setSchedulerError(null);
    try {
      const res = await fetch('/api/autonomous/jobs/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AutonomousSchedulerResponse = await res.json();
      setSchedulerJobs(
        data.jobs.filter((job) => job.jobName.startsWith('training:tw-') && ![
          'training:tw-data-sync',
          'training:tw-snapshot',
          'training:tw-screen',
          'training:tw-report',
        ].includes(job.jobName)),
      );
    } catch (e: unknown) {
      setSchedulerError(e instanceof Error ? e.message : '無法取得自我優化排程狀態');
    } finally {
      setSchedulerLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadTasks();
    loadScheduler();
  }, [load, loadTasks, loadScheduler]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{APP_NAME}｜系統健康</h1>
            <p className="text-slate-400 text-sm mt-1">資料源狀態、快照新鮮度與發送摘要 — 巡檢用途</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={load}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
            >
              重新整理
            </button>
            <Link
              href="/settings/notifications"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
            >
              通知管理 →
            </Link>
          </div>
        </div>

        {loading && (
          <div className="text-center py-16 text-slate-400">載入中...</div>
        )}
        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
        )}

        {health && (
          <>
            {/* Overall status */}
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-white font-semibold">整體狀態</span>
                  <StatusBadge status={health.overallStatus} variant="glass" />
                </div>
                <p className="text-slate-400 text-xs mt-1">
                  最後更新：{fmtTime(health.generatedAt)} ｜ DB 大小：{health.dbSizeMb}
                </p>
              </div>
              {health.overallStatus !== 'ok' && health.knownLimitations.length > 0 && (
                <div className="text-right text-xs text-yellow-400">
                  {health.knownLimitations.length} 項已知限制
                </div>
              )}
            </div>

            {/* Data sources */}
            <section>
              <h2 className="text-white font-semibold mb-3">資料源狀態</h2>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 text-xs">
                      <th className="px-4 py-3 text-left">資料源</th>
                      <th className="px-4 py-3 text-left">Table</th>
                      <th className="px-4 py-3 text-right">筆數</th>
                      <th className="px-4 py-3 text-left">最新日期</th>
                      <th className="px-4 py-3 text-center">等級</th>
                      <th className="px-4 py-3 text-center">可用</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.dataSources.map(ds => (
                      <tr key={ds.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3 text-white font-medium">{ds.id}</td>
                        <td className="px-4 py-3 text-slate-400">{ds.table}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{ds.rowCount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-400">{ds.lastDate ?? '—'}</td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={ds.grade} variant="glass" label={ds.grade} /></td>
                        <td className="px-4 py-3 text-center">
                          {ds.usable
                            ? <span className="text-green-400">✓</span>
                            : <span className="text-red-400">✗</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Snapshots */}
            <section>
              <h2 className="text-white font-semibold mb-3">快照狀態</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {health.snapshots.map(s => (
                  <div key={s.type} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium capitalize">{s.type}</span>
                      <FreshBadge fresh={s.fresh} />
                    </div>
                    <div className="text-xs text-slate-400 space-y-1">
                      <div>最新日期：{s.latestDate ?? '無快照'}</div>
                      <div>累計筆數：{s.rowCount.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Recent sync */}
            <section>
              <h2 className="text-white font-semibold mb-3">最近同步紀錄</h2>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
                {health.recentSync.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-400 text-sm">尚無同步紀錄</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 text-xs">
                        <th className="px-4 py-3 text-left">Job</th>
                        <th className="px-4 py-3 text-left">最後執行</th>
                        <th className="px-4 py-3 text-center">狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.recentSync.map(s => (
                        <tr key={s.jobType} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 text-white font-mono text-xs">{s.jobType}</td>
                          <td className="px-4 py-3 text-slate-400">{fmtTime(s.lastRun)}</td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={s.status ?? 'unknown'} variant="glass" label={s.status ?? 'unknown'} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* Notification channels */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold">通知頻道狀態</h2>
                <Link href="/settings/notifications" className="text-blue-400 hover:text-blue-300 text-xs">
                  詳細管理 →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {health.notificationChannels.map(ch => (
                  <div key={ch.channel} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{ch.channel}</span>
                      <ConfiguredBadge configured={ch.configured} />
                    </div>
                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex items-center gap-2">
                        <span>上次狀態：</span>
                        {ch.lastStatus ? <StatusBadge status={ch.lastStatus} variant="glass" label={ch.lastStatus} /> : <span>—</span>}
                      </div>
                      <div>上次發送：{fmtTime(ch.lastSentAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 24h delivery summary */}
            <section>
              <h2 className="text-white font-semibold mb-3">近 24 小時通知發送</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{health.last24hDelivery.success}</div>
                  <div className="text-xs text-slate-400 mt-1">成功</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red-400">{health.last24hDelivery.failed}</div>
                  <div className="text-xs text-slate-400 mt-1">失敗</div>
                </div>
                <div className="bg-gray-500/10 border border-gray-500/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-gray-400">{health.last24hDelivery.skipped}</div>
                  <div className="text-xs text-slate-400 mt-1">略過</div>
                </div>
              </div>
            </section>

            {/* Known limitations */}
            {health.knownLimitations.length > 0 && (
              <section>
                <h2 className="text-white font-semibold mb-3">已知限制</h2>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 space-y-2">
                  {health.knownLimitations.map((l, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-yellow-300">
                      <span className="text-yellow-500 mt-0.5">⚠</span>
                      <span>{l}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Disclaimer */}
            <div className="text-xs text-slate-500 border-t border-white/10 pt-4">
              此頁面僅供系統巡檢使用，不顯示任何敏感設定值（token / secret / URL）。
              通知頻道操作請至{' '}
              <Link href="/settings/notifications" className="text-blue-400 hover:underline">通知設定</Link>。
            </div>
          </>
        )}

        {/* ── Task Orchestration ───────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">任務排程狀態</h2>
            <button
              onClick={loadTasks}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs transition-colors"
            >
              重新整理
            </button>
          </div>
          {tasksLoading && <div className="text-center py-8 text-slate-400 text-sm">載入中…</div>}
          {tasksError && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{tasksError}</div>
          )}
          {tasks && (
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.taskName} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <TaskHeartbeat todayRan={task.todayRan} todayStatus={task.todayStatus} latestRun={task.latestRun} />
                        <span className="text-white font-medium text-sm">{task.label}</span>
                        <span className="text-slate-500 text-xs font-mono hidden sm:block">{task.taskName}</span>
                      </div>
                      <div className="mt-1.5 text-xs text-slate-400 space-y-0.5">
                        {task.latestRun ? (
                          <>
                            <div>
                              上次執行：{fmtTime(task.latestRun.startedAt)}
                              {' '}
                              <StatusBadge status={task.latestRun.status} variant="glass" label={task.latestRun.status} />
                              {' '}
                              {fmtDuration(task.latestRun.durationMs)}
                            </div>
                            {task.latestRun.summary && (
                              <div className="text-slate-500 truncate max-w-xl">{task.latestRun.summary}</div>
                            )}
                            {task.latestRun.errorMessage && (
                              <div className="text-red-400 truncate max-w-xl">{task.latestRun.errorMessage}</div>
                            )}
                          </>
                        ) : (
                          <div className="text-slate-500">從未執行過</div>
                        )}
                      </div>
                      <RunTaskButton taskName={task.taskName} supportsDryRun={task.supportsDryRun} onDone={loadTasks} />
                    </div>
                    <div className="flex-shrink-0 text-right text-xs text-slate-500 space-y-1">
                      <div>{task.scheduleLabel ?? (task.cadence === 'daily' ? '每日' : '按需')}</div>
                      <div>下次執行：{fmtTime(task.nextRunAt)}</div>
                      <div>{task.writesToDb ? '寫入 DB' : '唯讀'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">自我優化排程</h2>
            <button
              onClick={loadScheduler}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs transition-colors"
            >
              重新整理
            </button>
          </div>
          {schedulerLoading && <div className="text-center py-8 text-slate-400 text-sm">載入中…</div>}
          {schedulerError && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{schedulerError}</div>
          )}
          {schedulerJobs && (
            <div className="space-y-3">
              {schedulerJobs.map((job) => (
                <div key={job.jobName} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={job.schedulerOutcome} variant="glass" label={job.schedulerOutcome} />
                        <span className="text-white font-medium text-sm">{job.jobName}</span>
                        <span className="text-slate-500 text-xs">{job.healthStatus}</span>
                      </div>
                      <div className="mt-2 text-xs text-slate-400 space-y-1">
                        <div>上次結果：{job.latestRun?.summary ?? job.summary}</div>
                        <div>
                          上次執行：{fmtTime(job.latestRun?.startedAt ?? null)}
                          {' '}
                          <StatusBadge status={job.latestRun?.status ?? job.status} variant="glass" label={job.latestRun?.status ?? job.status} />
                        </div>
                        {job.latestRun?.errorMessage && (
                          <div className="text-red-400 truncate max-w-xl">{job.latestRun.errorMessage}</div>
                        )}
                        {job.skippedReason && (
                          <div className="text-yellow-300">略過原因：{job.skippedReason}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right text-xs text-slate-500 space-y-1">
                      <div>下次執行：{fmtTime(job.nextDueAt)}</div>
                      <div>失敗次數：{job.failureCount}｜連續失敗：{job.failureStreak}</div>
                      <div>生成任務：{job.generatedTaskCount}｜生成洞察：{job.generatedInsightCount}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
