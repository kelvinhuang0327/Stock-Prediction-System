"use client";

/**
 * LlmUsageDetailCard — LLM / Agent Usage 詳細卡片
 *
 * Visually answers the 6 acceptance questions:
 *  Q1. Planner 今天有沒有呼叫外部 LLM？
 *  Q2. Worker 今天 Copilot-Daemon 呼叫幾次？
 *  Q3. CTO 今天有沒有外部 LLM 呼叫？
 *  Q4. 哪個 task 消耗最多 Copilot / GitHub Copilot？
 *  Q5. 最近 10 筆 LLM call 是 success / failed / blocked？
 *  Q6. token / premium / rate-limit 是否有資料？若沒有，明確顯示 unavailable。
 *
 * Data sources:
 *  - /api/system/llm-usage           → today's aggregated summary + warnings (Q1–Q3, Q6 totals)
 *  - /api/orchestrator/llm-usage/recent?limit=20 → all-time recent records (Q4, Q5)
 *
 * READ-ONLY — never triggers providers, modifies state, or changes scheduler config.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { UsageWarning } from '@/lib/agent-orchestrator/llmUsageWarnings';

// ── Token formatter ───────────────────────────────────────────────────────────

/**
 * Format a token count with K/M suffix.
 * 1200 → "1.2k" | 3800000 → "3.8M" | 0 → "0"
 */
export function fmtTokenCount(n: number | undefined | null): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (v === 0) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

/**
 * Format input/output/cached as "↑3.8M / ↓74.2k / cached 3.4M"
 * Missing/null values render as 0.
 */
export function fmtTokens(
  inputTokens: number | undefined | null,
  outputTokens: number | undefined | null,
  cachedTokens: number | undefined | null,
): string {
  const i = fmtTokenCount(inputTokens);
  const o = fmtTokenCount(outputTokens);
  const c = fmtTokenCount(cachedTokens);
  if (i === '0' && o === '0' && c === '0') return '—';
  return `↑${i} / ↓${o} / cached ${c}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LlmRoleSummary {
  preflightCount: number;
  executionCount: number;
  blockedCount: number;
  failedCount: number;
  premiumRequests: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export interface UsageRecord {
  timestamp: string;
  phase: string;
  event: string;
  caller: string;
  triggerSource: string;
  provider: string;
  model: string | null;
  taskId: string | null;
  jobName: string | null;
  decision: string;
  skipReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  parsed: boolean;
  premiumRequests: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  rateLimit: string | null;
  durationMs: number;
  desiredModel: string | null;
  actualModel: string | null;
  modelPropagationStatus: string | null;
  /** Idle/disabled reason when taskId is absent by design — null = real task or genuine anomaly */
  noTaskReason: string | null;
}

export interface LlmUsageTodayResponse {
  generatedAt: string;
  window: 'today';
  totals: LlmRoleSummary;
  byRole: Record<string, LlmRoleSummary>;
  byProvider: Record<string, LlmRoleSummary>;
  recent: UsageRecord[];
  /** Usage Guard warnings from all-time records */
  warnings?: UsageWarning[];
}

interface RecentResponse {
  ok: boolean;
  records: UsageRecord[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Providers that actually consume external quota */
const EXTERNAL_PROVIDERS = new Set([
  'codex', 'claude', 'github-copilot', 'copilot-daemon',
  'github-cli', 'openai', 'external-worker', 'worker_backfill',
]);

const COPILOT_PROVIDERS = new Set(['copilot-daemon', 'github-copilot', 'github-cli']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtPremium(n: number | undefined | null): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return v.toFixed(2);
}

function decisionBadge(decision: string): React.ReactElement {
  const map: Record<string, string> = {
    success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    allow:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
    block:   'bg-red-500/20 text-red-300 border-red-500/30',
    skip:    'bg-slate-500/20 text-slate-300 border-slate-500/30',
    failed:  'bg-orange-500/20 text-orange-300 border-orange-500/30',
  };
  const cls = map[decision] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  return <span className={`inline-block px-1.5 py-0.5 text-xs rounded border ${cls}`}>{decision || '—'}</span>;
}

function noTaskReasonBadge(reason: string | null | undefined): React.ReactElement {
  if (!reason) return <></> ;
  const labels: Record<string, { label: string; cls: string }> = {
    no_queued_task:    { label: 'No queued task', cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
    scheduler_disabled:{ label: 'Scheduler disabled', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    policy_blocked:    { label: 'Policy blocked', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  };
  const entry = labels[reason];
  if (entry) {
    return <span className={`inline-block px-1.5 py-0.5 text-xs rounded border ${entry.cls}`}>{entry.label}</span>;
  }
  return <span className="inline-block px-1.5 py-0.5 text-xs rounded border bg-slate-500/20 text-slate-300 border-slate-500/30">{reason}</span>;
}

function missingTaskBadge(): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border bg-red-500/20 text-red-300 border-red-500/30" title="Missing task attribution — anomaly">
      ⚠️ missing
    </span>
  );
}

function parsedBadge(parsed: boolean): React.ReactElement {
  return parsed
    ? <span className="text-emerald-400 text-xs" title="token usage parsed OK">✅</span>
    : <span className="text-orange-400 text-xs" title="token parse failed — tokens unavailable">⚠️</span>;
}

function phaseBadge(phase: string): React.ReactElement {
  const map: Record<string, string> = {
    execution: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    preflight: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    blocked:   'bg-red-500/20 text-red-300 border-red-500/30',
    failed:    'bg-orange-500/20 text-orange-300 border-orange-500/30',
    fallback:  'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };
  const cls = map[phase] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  return <span className={`inline-block px-1.5 py-0.5 text-xs rounded border ${cls}`}>{phase || '—'}</span>;
}

/** Explicit YES/NO badge for "external LLM called today?" — answers Q1 and Q3 */
function externalLlmVerdict(executionCount: number): React.ReactElement {
  if (executionCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
        ✅ 外部 LLM 今日 {executionCount} 次
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/20">
      ❌ 今日無外部 LLM 呼叫
    </span>
  );
}

/** Token display with explicit "unavailable" state — answers Q6 */
function tokenDisplay(
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number,
  allParsed: boolean,
): React.ReactElement {
  const hasTokens = inputTokens > 0 || outputTokens > 0 || cachedTokens > 0;
  if (!hasTokens && !allParsed) {
    return <span className="text-orange-400 text-xs italic">— (無資料 / token parse 失敗)</span>;
  }
  if (!hasTokens) {
    return <span className="text-slate-500 text-xs italic">— (無資料)</span>;
  }
  return (
    <span className="text-slate-200 font-mono text-xs">
      {fmtTokens(inputTokens, outputTokens, cachedTokens)}
    </span>
  );
}

// ── Sub-section: Role Block ───────────────────────────────────────────────────

interface RoleBlockProps {
  role: 'planner' | 'worker' | 'cto';
  label: string;
  icon: string;
  /** Today's aggregated summary (null while loading) */
  today: LlmUsageTodayResponse | null;
  /** All-time recent records for rate-limit and copilot count (null while loading) */
  recentAll: UsageRecord[] | null;
}

function RoleBlock({ role, label, icon, today, recentAll }: RoleBlockProps): React.ReactElement {
  const DEFAULT_PROVIDER: Record<string, string> = {
    planner: 'local-planner',
    worker:  'copilot-daemon',
    cto:     'local-review',
  };
  const providerKey = DEFAULT_PROVIDER[role];

  if (!today) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-sm font-semibold text-white">{label}</span>
        </div>
        <div className="text-xs text-slate-400">載入中…</div>
      </div>
    );
  }

  const summary = today.byRole[role];
  const hasAnyData = summary && (
    summary.preflightCount > 0 || summary.executionCount > 0 ||
    summary.blockedCount > 0 || summary.failedCount > 0
  );

  // Copilot-daemon specific count for worker (Q2)
  const copilotProviderSummary = role === 'worker' ? today.byProvider['copilot-daemon'] : null;
  const copilotCallCount = copilotProviderSummary
    ? (copilotProviderSummary.preflightCount + copilotProviderSummary.executionCount)
    : 0;
  const copilotExecCount = copilotProviderSummary?.executionCount ?? 0;

  // Rate limit: scan recent records for this role
  const rateLimitFromRecent = recentAll
    ?.filter(r => r.caller === role && r.rateLimit)
    .map(r => r.rateLimit)
    .filter(Boolean)
    .slice(-1)[0] ?? null;

  // All records for this role that are external executions
  const externalExecCount = summary
    ? Object.entries(today.byProvider)
        .filter(([p]) => EXTERNAL_PROVIDERS.has(p))
        .reduce((sum, [, s]) => {
          // only count providers that appeared under this role
          return sum;
        }, summary.executionCount)
    : 0;

  // Token parse status for worker
  const workerRecentParsed = recentAll
    ?.filter(r => r.caller === role && r.phase === 'execution')
    .map(r => r.parsed) ?? [];
  const hasAnyParseFail = workerRecentParsed.some(p => !p);

  // Model propagation: find most recent worker record that has desiredModel set
  const latestModelRecord = role === 'worker'
    ? (recentAll ?? [])
        .filter(r => r.caller === 'worker' && r.desiredModel != null)
        .slice(-1)[0] ?? null
    : null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-semibold text-white">{label}</span>
        </div>
        <span className="text-xs text-slate-500 font-mono">{providerKey}</span>
      </div>

      {/* Q1/Q3 explicit verdict for planner and cto */}
      {(role === 'planner' || role === 'cto') && (
        <div>{externalLlmVerdict(summary?.executionCount ?? 0)}</div>
      )}

      {!hasAnyData ? (
        <div className="text-xs text-slate-400 italic">今日尚無任何 LLM 呼叫紀錄</div>
      ) : (
        <div className="space-y-1.5 text-xs">
          {/* Preflight */}
          {summary && summary.preflightCount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Preflight</span>
              <span className="text-blue-300 font-mono">{summary.preflightCount}</span>
            </div>
          )}

          {/* Worker: Q2 — copilot-daemon 呼叫次數 */}
          {role === 'worker' && (
            <div className="bg-white/5 rounded-lg px-3 py-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Copilot-Daemon</span>
                <span className={`font-mono font-semibold ${copilotExecCount > 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {copilotExecCount > 0 ? `${copilotExecCount} exec` : `${copilotCallCount} total (0 exec)`}
                </span>
              </div>
              {copilotExecCount === 0 && summary.preflightCount > 0 && (
                <div className="text-slate-500 text-xs italic">preflight 通過但無成功 execution — token 無資料</div>
              )}
              {/* Q6 tokens */}
              <div className="flex justify-between">
                <span className="text-slate-500">Tokens</span>
                {tokenDisplay(
                  copilotProviderSummary?.inputTokens ?? 0,
                  copilotProviderSummary?.outputTokens ?? 0,
                  copilotProviderSummary?.cachedTokens ?? 0,
                  !hasAnyParseFail,
                )}
              </div>
              {/* Q6 premium */}
              <div className="flex justify-between">
                <span className="text-slate-500">Premium</span>
                {(copilotProviderSummary?.premiumRequests ?? 0) > 0
                  ? <span className="text-amber-300 font-mono">{fmtPremium(copilotProviderSummary?.premiumRequests)}</span>
                  : <span className="text-slate-500 italic">— (無資料)</span>}
              </div>
              {/* Q6 rate limit */}
              <div className="flex justify-between">
                <span className="text-slate-500">Rate Limit</span>
                {rateLimitFromRecent
                  ? <span className="text-orange-300 font-mono">{rateLimitFromRecent}</span>
                  : <span className="text-slate-500 italic">— (無資料)</span>}
              </div>
              {/* Model propagation status */}
              <div className="flex justify-between">
                <span className="text-slate-500">Desired Model</span>
                <span className="text-slate-300 font-mono text-xs">
                  {latestModelRecord?.desiredModel ?? '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Actual Model</span>
                <span className="text-slate-400 font-mono text-xs">
                  {latestModelRecord?.actualModel ?? '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Propagation</span>
                {latestModelRecord?.modelPropagationStatus
                  ? <span className={`font-mono text-xs ${
                      latestModelRecord.modelPropagationStatus === 'propagated' ? 'text-emerald-400' :
                      latestModelRecord.modelPropagationStatus === 'provider-managed' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>{latestModelRecord.modelPropagationStatus}</span>
                  : <span className="text-slate-500 italic text-xs">— (not-configured)</span>
                }
              </div>
            </div>
          )}

          {/* Non-worker executions */}
          {role !== 'worker' && summary && summary.executionCount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Executions</span>
              <span className="text-emerald-300 font-mono">{summary.executionCount}</span>
            </div>
          )}

          {/* Blocked */}
          {summary && summary.blockedCount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Blocked</span>
              <span className="text-red-300 font-mono">{summary.blockedCount}</span>
            </div>
          )}

          {/* Failed */}
          {summary && summary.failedCount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Failed</span>
              <span className="text-orange-300 font-mono">{summary.failedCount}</span>
            </div>
          )}

          {/* Tokens for planner/cto when they have real executions */}
          {role !== 'worker' && summary && summary.executionCount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Tokens</span>
              {tokenDisplay(summary.inputTokens, summary.outputTokens, summary.cachedTokens, true)}
            </div>
          )}
        </div>
      )}

      {/* Always show provider label hint */}
      {!hasAnyData && (
        <div className="text-xs text-slate-600 font-mono">{providerKey}</div>
      )}
    </div>
  );
}

// ── Top Tasks section (Q4) ────────────────────────────────────────────────────

interface TopTaskEntry {
  taskId: string;
  provider: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  premiumRequests: number;
  lastSeen: string;
}

function TopTasksSection({ records }: { records: UsageRecord[] }): React.ReactElement | null {
  // Aggregate Copilot/GitHub Copilot records by taskId
  const taskMap = new Map<string, TopTaskEntry>();

  for (const r of records) {
    if (!COPILOT_PROVIDERS.has(r.provider)) continue;
    const key = r.taskId ?? '(no task)';
    const existing = taskMap.get(key);
    if (existing) {
      existing.calls++;
      existing.inputTokens += r.inputTokens ?? 0;
      existing.outputTokens += r.outputTokens ?? 0;
      existing.cachedTokens += r.cachedTokens ?? 0;
      existing.premiumRequests += r.premiumRequests ?? 0;
      if (r.timestamp > existing.lastSeen) existing.lastSeen = r.timestamp;
    } else {
      taskMap.set(key, {
        taskId: key,
        provider: r.provider,
        calls: 1,
        inputTokens: r.inputTokens ?? 0,
        outputTokens: r.outputTokens ?? 0,
        cachedTokens: r.cachedTokens ?? 0,
        premiumRequests: r.premiumRequests ?? 0,
        lastSeen: r.timestamp,
      });
    }
  }

  if (taskMap.size === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Top Tasks — Copilot 消耗 (Q4)
        </h3>
        <div className="text-xs text-slate-500 italic">近期無 Copilot / GitHub Copilot 呼叫紀錄</div>
      </div>
    );
  }

  const sorted = Array.from(taskMap.values())
    .sort((a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens) || b.calls - a.calls)
    .slice(0, 5);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Top Tasks — Copilot 消耗 (Q4)
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">依 token 消耗排序，來源：近期所有紀錄</p>
      </div>
      <div className="divide-y divide-white/5">
        {sorted.map((entry, idx) => (
          <div key={entry.taskId} className="px-4 py-3 flex items-start justify-between gap-4 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-slate-600 text-xs font-mono w-4 shrink-0">#{idx + 1}</span>
              <div className="min-w-0">
                <div className="text-sm font-mono text-white truncate">
                  {entry.taskId === '(no task)' ? <span className="text-slate-500">no taskId</span> : `Task #${entry.taskId}`}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {entry.provider} · {entry.calls} calls · {fmtDate(entry.lastSeen)}
                </div>
              </div>
            </div>
            <div className="text-right text-xs shrink-0">
              {(entry.inputTokens > 0 || entry.outputTokens > 0) ? (
                <div className="text-slate-200 font-mono">{fmtTokens(entry.inputTokens, entry.outputTokens, entry.cachedTokens)}</div>
              ) : (
                <div className="text-slate-500 italic">— (無 token 資料)</div>
              )}
              {entry.premiumRequests > 0 && (
                <div className="text-amber-300 mt-0.5">premium {fmtPremium(entry.premiumRequests)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Recent Usage Table (Q5) ───────────────────────────────────────────────────

function RecentTable({ records, loading }: { records: UsageRecord[]; loading: boolean }): React.ReactElement {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            最近 LLM 呼叫明細 (Q5) {records.length > 0 ? `— ${records.length} 筆` : ''}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">跨日顯示，不限今日</p>
        </div>
      </div>
      {loading ? (
        <div className="px-4 py-8 text-center text-slate-400 text-xs">載入中…</div>
      ) : records.length === 0 ? (
        <div className="px-4 py-8 text-center text-slate-400 text-xs">尚無任何 Usage 紀錄</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-500">
                <th className="px-3 py-2 text-left whitespace-nowrap">Time</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Agent</th>
                <th className="px-3 py-2 text-left">Task</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">No-task Reason</th>
                <th className="px-3 py-2 text-left">Phase</th>
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-center" title="token usage parsed">Parsed</th>
                <th className="px-3 py-2 text-right">Premium</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Tokens (Q6)</th>
                <th className="px-3 py-2 text-center whitespace-nowrap">Rate Limit (Q6)</th>
                <th className="px-3 py-2 text-center">Decision</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">Skip Reason</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => {
                const hasTokens = (r.inputTokens > 0 || r.outputTokens > 0);
                const tokenCell = !r.parsed && !hasTokens
                  ? <span className="text-orange-400 italic">— (unavail)</span>
                  : !hasTokens
                    ? <span className="text-slate-500">—</span>
                    : <span className="text-slate-200 font-mono">{fmtTokens(r.inputTokens, r.outputTokens, r.cachedTokens)}</span>;

                return (
                  <tr key={`${r.timestamp}-${i}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap font-mono">{fmtTime(r.timestamp)}</td>
                    <td className="px-3 py-2 text-slate-300">{r.caller}</td>
                    <td className="px-3 py-2">
                      <span className={`font-medium ${COPILOT_PROVIDERS.has(r.provider) ? 'text-blue-300' : 'text-slate-200'}`}>
                        {r.provider}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400 font-mono">
                      {r.taskId
                        ? `#${r.taskId}`
                        : r.noTaskReason
                          ? <span className="text-slate-500">—</span>
                          : missingTaskBadge()
                      }
                    </td>
                    <td className="px-3 py-2">
                      {noTaskReasonBadge(r.noTaskReason)}
                    </td>
                    <td className="px-3 py-2">{phaseBadge(r.phase)}</td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                      {r.event?.replace('provider_', '') ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-center">{parsedBadge(r.parsed)}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.premiumRequests > 0
                        ? <span className="text-amber-300">{fmtPremium(r.premiumRequests)}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{tokenCell}</td>
                    <td className="px-3 py-2 text-center">
                      {r.rateLimit
                        ? <span className="text-orange-300 font-mono">{r.rateLimit}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">{decisionBadge(r.decision)}</td>
                    <td className="px-3 py-2 text-slate-400 max-w-[160px] truncate" title={r.skipReason ?? ''}>
                      {r.skipReason ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Usage Guard Section ───────────────────────────────────────────────────────

const LEVEL_STYLE: Record<string, { badge: string; row: string; icon: string }> = {
  CRITICAL: {
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    row:   'border-red-500/20 bg-red-500/5',
    icon:  '🚨',
  },
  WARNING: {
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    row:   'border-amber-500/20 bg-amber-500/5',
    icon:  '⚠️',
  },
  INFO: {
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    row:   'border-blue-500/20 bg-blue-500/5',
    icon:  'ℹ️',
  },
};

function UsageGuardSection({ warnings, loading }: { warnings: UsageWarning[] | undefined; loading: boolean }): React.ReactElement {
  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Usage Guard</h3>
        <div className="text-xs text-slate-500">載入中…</div>
      </div>
    );
  }

  if (!warnings || warnings.length === 0) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
        <span className="text-lg">✅</span>
        <div>
          <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Usage Guard</div>
          <div className="text-xs text-emerald-400 mt-0.5">目前未偵測到異常外部 LLM 使用</div>
        </div>
      </div>
    );
  }

  const hasCritical = warnings.some(w => w.level === 'CRITICAL');

  return (
    <div className={`border rounded-xl overflow-hidden ${hasCritical ? 'border-red-500/30' : 'border-amber-500/30'}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${
        hasCritical ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{hasCritical ? '🚨' : '⚠️'}</span>
          <div>
            <div className={`text-xs font-semibold uppercase tracking-wider ${hasCritical ? 'text-red-300' : 'text-amber-300'}`}>
              Usage Guard
            </div>
            <div className={`text-xs mt-0.5 ${hasCritical ? 'text-red-400' : 'text-amber-400'}`}>
              偵測到 {warnings.length} 個警示
            </div>
          </div>
        </div>
        {/* Count badges by level */}
        <div className="flex gap-1.5 flex-wrap">
          {(['CRITICAL', 'WARNING', 'INFO'] as const).map(level => {
            const cnt = warnings.filter(w => w.level === level).length;
            if (!cnt) return null;
            const s = LEVEL_STYLE[level];
            return (
              <span key={level} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border font-medium ${s.badge}`}>
                {s.icon} {level} ×{cnt}
              </span>
            );
          })}
        </div>
      </div>

      {/* Warning rows */}
      <div className="divide-y divide-white/5">
        {warnings.map((w, i) => {
          const s = LEVEL_STYLE[w.level] ?? LEVEL_STYLE.INFO;
          return (
            <div key={`${w.code}-${i}`} className={`px-4 py-3 border-l-2 ${s.row}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0">
                  {/* Level + message */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-block px-1.5 py-0.5 text-xs rounded border font-semibold ${s.badge}`}>
                      {w.level}
                    </span>
                    <span className="text-sm text-white font-medium">{w.message}</span>
                  </div>
                  {/* Meta */}
                  <div className="flex gap-3 text-xs text-slate-400 flex-wrap">
                    <span>provider: <span className="text-slate-200 font-mono">{w.provider || '—'}</span></span>
                    {w.taskId && <span>task: <span className="text-slate-200 font-mono">#{w.taskId}</span></span>}
                    <span>count: <span className="text-slate-200 font-mono">{w.count}</span></span>
                    <span className="text-xs font-mono text-slate-600">{w.code}</span>
                  </div>
                  {/* Suggested action */}
                  <div className="text-xs text-slate-400 italic">
                    → {w.action}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function LlmUsageDetailCard(): React.ReactElement {
  const [todayData, setTodayData] = useState<LlmUsageTodayResponse | null>(null);
  const [recentAll, setRecentAll] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [todayRes, recentRes] = await Promise.all([
        fetch('/api/system/llm-usage'),
        fetch('/api/orchestrator/llm-usage/recent?limit=20'),
      ]);

      if (!todayRes.ok) throw new Error(`/api/system/llm-usage: HTTP ${todayRes.status}`);
      const todayJson = await todayRes.json() as LlmUsageTodayResponse;
      setTodayData(todayJson);

      if (recentRes.ok) {
        const recentJson = await recentRes.json() as RecentResponse;
        setRecentAll(recentJson.records ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const t = todayData?.totals;
  const hasAnyToday = t && (t.preflightCount + t.executionCount + t.blockedCount + t.failedCount) > 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">LLM / Agent Usage 詳細</h2>
          <p className="text-xs text-slate-400 mt-0.5">今日統計 + 最近呼叫明細 — Planner / Worker / CTO</p>
        </div>
        <button
          onClick={() => { void load(); }}
          disabled={loading}
          className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 transition-colors"
        >
          {loading ? '載入中…' : '重新整理'}
        </button>
      </div>

      <div className="p-5 space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{error}</div>
        )}

        {/* ── Usage Guard (warnings from all-time records) ── */}
        <UsageGuardSection warnings={todayData?.warnings} loading={loading} />

        {/* ── Today Summary ── */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">今日 Summary</h3>
          {loading ? (
            <div className="text-xs text-slate-400">載入中…</div>
          ) : !hasAnyToday ? (
            <div className="text-xs text-slate-400 italic">今日（UTC）尚無 LLM 呼叫紀錄</div>
          ) : (
            <div className="space-y-1.5 text-sm font-mono">
              <div>
                <span className="text-slate-400 text-xs">Tokens </span>
                {tokenDisplay(t!.inputTokens, t!.outputTokens, t!.cachedTokens, true)}
              </div>
              <div>
                <span className="text-slate-400 text-xs">Premium </span>
                {t!.premiumRequests > 0
                  ? <span className="text-amber-300">{fmtPremium(t!.premiumRequests)}</span>
                  : <span className="text-slate-500 text-xs italic">— (無資料)</span>}
              </div>
              <div className="flex gap-4 flex-wrap text-xs">
                <span>Exec <span className="text-emerald-300 font-semibold">{t!.executionCount}</span></span>
                <span>Preflight <span className="text-blue-300">{t!.preflightCount}</span></span>
                <span>Blocked <span className="text-red-300">{t!.blockedCount}</span></span>
                <span>Failed <span className="text-orange-300">{t!.failedCount}</span></span>
              </div>
            </div>
          )}
        </div>

        {/* ── By Provider (today) ── */}
        {!loading && todayData && Object.keys(todayData.byProvider).length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">今日 By Provider</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(todayData.byProvider).map(([prov, s]) => (
                <div key={prov} className={`border rounded-lg px-3 py-2 text-xs min-w-[110px] ${
                  COPILOT_PROVIDERS.has(prov)
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : EXTERNAL_PROVIDERS.has(prov)
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-white/5 border-white/10'
                }`}>
                  <div className={`font-medium ${COPILOT_PROVIDERS.has(prov) ? 'text-blue-200' : 'text-slate-200'}`}>{prov}</div>
                  <div className="text-slate-400 mt-1 space-y-0.5">
                    {s.executionCount > 0 && <div>exec <span className="text-emerald-300">{s.executionCount}</span></div>}
                    {s.preflightCount > 0 && <div>preflight <span className="text-blue-300">{s.preflightCount}</span></div>}
                    {s.blockedCount > 0  && <div>blocked <span className="text-red-300">{s.blockedCount}</span></div>}
                    {(s.inputTokens > 0 || s.outputTokens > 0)
                      ? <div className="font-mono">{fmtTokens(s.inputTokens, s.outputTokens, s.cachedTokens)}</div>
                      : <div className="italic text-slate-600">tokens: —</div>}
                    {s.premiumRequests > 0
                      ? <div className="text-amber-300">premium {fmtPremium(s.premiumRequests)}</div>
                      : <div className="italic text-slate-600">premium: —</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Planner / Worker / CTO (Q1, Q2, Q3) ── */}
        <div className="grid gap-3 md:grid-cols-3">
          <RoleBlock role="planner" label="Planner" icon="📋" today={loading ? null : todayData} recentAll={recentAll} />
          <RoleBlock role="worker"  label="Worker"  icon="⚙️"  today={loading ? null : todayData} recentAll={recentAll} />
          <RoleBlock role="cto"     label="CTO"     icon="🔍"  today={loading ? null : todayData} recentAll={recentAll} />
        </div>

        {/* ── Top Tasks by Copilot usage (Q4) ── */}
        {!loading && <TopTasksSection records={recentAll} />}

        {/* ── Recent table (Q5, Q6) — all-time, not just today ── */}
        <RecentTable records={recentAll} loading={loading} />
      </div>
    </div>
  );
}
