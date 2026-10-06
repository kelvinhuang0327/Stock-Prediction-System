"use client";

/**
 * LlmAuditPanel — LLM Execution Control UI panel.
 *
 * Displays:
 * - LLM Mode (safe-run / hard-off)
 * - 今日 LLM 呼叫 by role (Planner / Worker / CTO)
 * - LLM Audit 今日摘要 (ATTEMPT / RESULT / BLOCKED counts)
 * - Recent Audit table (Time / Type / Role / Runner / Provider / Trigger / Task / Duration / Status)
 */

import React, { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditRecord {
  timestamp: string;
  correlation_id: string;
  event_type: 'LLM_CALL_ATTEMPT' | 'LLM_CALL_RESULT' | 'LLM_CALL_BLOCKED';
  runner_type: string;
  usage_role: string;
  provider: string;
  model: string | null;
  task_id: string | null;
  run_id: string | null;
  trigger_source: string;
  blocked: boolean;
  block_reason: string | null;
  success: boolean | null;
  error: string | null;
  duration_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  total_tokens: number;
  premium_requests: number;
}

interface AuditRoleSummary {
  attemptCount: number;
  resultSuccessCount: number;
  resultFailedCount: number;
  blockedCount: number;
  totalDurationMs: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  premiumRequests: number;
}

interface AuditTodayData {
  totals: AuditRoleSummary;
  byRole: Record<string, AuditRoleSummary>;
  byProvider: Record<string, AuditRoleSummary>;
  recentBlocked: AuditRecord[];
}

interface LlmRoleSummary {
  preflightCount: number;
  executionCount: number;
  blockedCount: number;
  failedCount: number;
  premiumRequests: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

interface LlmUsageData {
  totals: LlmRoleSummary;
  byRole: Record<string, LlmRoleSummary>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
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

function fmtDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function eventTypeBadge(eventType: string): React.ReactElement {
  if (eventType === 'LLM_CALL_ATTEMPT') {
    return <span className="inline-block px-1.5 py-0.5 text-xs rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">ATTEMPT</span>;
  }
  if (eventType === 'LLM_CALL_RESULT') {
    return <span className="inline-block px-1.5 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">RESULT</span>;
  }
  return <span className="inline-block px-1.5 py-0.5 text-xs rounded bg-red-500/20 text-red-300 border border-red-500/30">BLOCKED</span>;
}

function statusBadge(record: AuditRecord): React.ReactElement {
  if (record.event_type === 'LLM_CALL_BLOCKED' || record.blocked) {
    return <span className="inline-block px-1.5 py-0.5 text-xs rounded bg-red-500/20 text-red-300 border border-red-500/30">Blocked</span>;
  }
  if (record.event_type === 'LLM_CALL_RESULT') {
    if (record.success) {
      return <span className="inline-block px-1.5 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">OK</span>;
    }
    return <span className="inline-block px-1.5 py-0.5 text-xs rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">Failed</span>;
  }
  return <span className="inline-block px-1.5 py-0.5 text-xs rounded bg-slate-500/20 text-slate-300 border border-slate-500/30">—</span>;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LlmAuditPanelProps {
  /** Optional: current LLM execution mode string (e.g. 'safe-run' or 'hard-off') */
  llmMode?: string | null;
  schedulerEnabled?: boolean;
}

export function LlmAuditPanel({ llmMode, schedulerEnabled }: Readonly<LlmAuditPanelProps>) {
  const [auditToday, setAuditToday] = useState<AuditTodayData | null>(null);
  const [auditTodayLoading, setAuditTodayLoading] = useState(true);
  const [auditRecent, setAuditRecent] = useState<AuditRecord[]>([]);
  const [auditRecentLoading, setAuditRecentLoading] = useState(true);
  const [llmUsage, setLlmUsage] = useState<LlmUsageData | null>(null);
  const [llmUsageLoading, setLlmUsageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setAuditTodayLoading(true);
    setAuditRecentLoading(true);
    setLlmUsageLoading(true);

    try {
      const [todayRes, recentRes, usageRes] = await Promise.all([
        fetch('/api/orchestrator/llm-audit/today'),
        fetch('/api/orchestrator/llm-audit/recent?limit=30'),
        fetch('/api/orchestrator/llm-usage/today'),
      ]);

      if (todayRes.ok) {
        const data = await todayRes.json() as AuditTodayData & { ok: boolean };
        if (data.ok) setAuditToday(data);
      }
      setAuditTodayLoading(false);

      if (recentRes.ok) {
        const data = await recentRes.json() as { ok: boolean; records: AuditRecord[] };
        if (data.ok) setAuditRecent(data.records);
      }
      setAuditRecentLoading(false);

      if (usageRes.ok) {
        const data = await usageRes.json() as LlmUsageData & { ok: boolean };
        if (data.ok) setLlmUsage(data);
      }
      setLlmUsageLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
      setAuditTodayLoading(false);
      setAuditRecentLoading(false);
      setLlmUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const modeColor =
    llmMode === 'hard-off'
      ? 'bg-red-500/20 text-red-300 border-red-500/30'
      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

  return (
    <div className="space-y-4">
      {/* ── Header row ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-wider">LLM Mode</span>
          <span className={`inline-block px-2 py-0.5 text-xs rounded border font-mono ${modeColor}`}>
            {llmMode ?? '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-wider">Scheduler</span>
          <span className={`inline-block px-2 py-0.5 text-xs rounded border ${
            schedulerEnabled
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
          }`}>
            {schedulerEnabled ? 'ON' : 'OFF'}
          </span>
        </div>
        <button
          onClick={() => { void load(); }}
          className="ml-auto px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
        >
          重新整理
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{error}</div>
      )}

      {/* ── 今日 LLM 呼叫 (Usage) ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">今日 LLM 呼叫 (Usage)</h3>
        {llmUsageLoading ? (
          <div className="text-xs text-slate-400">載入中…</div>
        ) : llmUsage ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['planner', 'worker', 'cto', 'ai_service'] as const).map((role) => {
              const r = llmUsage.byRole[role];
              if (!r) return null;
              return (
                <div key={role} className="bg-white/5 rounded-lg p-3">
                  <div className="text-xs text-slate-400 uppercase mb-1">{role}</div>
                  <div className="text-white text-sm font-mono">{r.executionCount} calls</div>
                  <div className="text-xs text-slate-400">{r.blockedCount} blocked</div>
                  {r.premiumRequests > 0 && (
                    <div className="text-xs text-amber-400">{r.premiumRequests} premium</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-400">無資料</div>
        )}
      </div>

      {/* ── LLM Audit 今日摘要 ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">LLM Audit 今日摘要</h3>
        {auditTodayLoading ? (
          <div className="text-xs text-slate-400">載入中…</div>
        ) : auditToday ? (
          <div className="space-y-3">
            {/* Totals */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-slate-400 text-xs">ATTEMPT</span>
                <div className="text-blue-300 font-mono">{auditToday.totals.attemptCount}</div>
              </div>
              <div>
                <span className="text-slate-400 text-xs">SUCCESS</span>
                <div className="text-emerald-300 font-mono">{auditToday.totals.resultSuccessCount}</div>
              </div>
              <div>
                <span className="text-slate-400 text-xs">FAILED</span>
                <div className="text-orange-300 font-mono">{auditToday.totals.resultFailedCount}</div>
              </div>
              <div>
                <span className="text-slate-400 text-xs">BLOCKED</span>
                <div className="text-red-300 font-mono">{auditToday.totals.blockedCount}</div>
              </div>
              {auditToday.totals.premiumRequests > 0 && (
                <div>
                  <span className="text-slate-400 text-xs">Premium</span>
                  <div className="text-amber-300 font-mono">{auditToday.totals.premiumRequests}</div>
                </div>
              )}
            </div>

            {/* By Role */}
            {Object.keys(auditToday.byRole).length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-1">By Role</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(auditToday.byRole).map(([role, s]) => (
                    <div key={role} className="bg-white/5 rounded px-2 py-1 text-xs">
                      <span className="text-slate-300 font-medium">{role}</span>
                      <span className="text-slate-400 ml-1">
                        {s.attemptCount}A / {s.resultSuccessCount}OK / {s.blockedCount}B
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Provider */}
            {Object.keys(auditToday.byProvider).length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-1">By Provider</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(auditToday.byProvider).map(([prov, s]) => (
                    <div key={prov} className="bg-white/5 rounded px-2 py-1 text-xs">
                      <span className="text-slate-300 font-medium">{prov}</span>
                      <span className="text-slate-400 ml-1">
                        {s.attemptCount}A / {s.resultSuccessCount}OK / {s.blockedCount}B
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-400">無 Audit 資料（llm_audit.jsonl 尚未建立或今日無外部 LLM 呼叫）</div>
        )}
      </div>

      {/* ── Recent Audit Table ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">Recent Audit</h3>
        </div>
        {auditRecentLoading ? (
          <div className="px-4 py-8 text-center text-slate-400 text-xs">載入中…</div>
        ) : auditRecent.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400 text-xs">
            尚無 Audit 紀錄 — 外部 LLM 呼叫發生時才會產生
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Runner</th>
                  <th className="px-3 py-2 text-left">Provider</th>
                  <th className="px-3 py-2 text-left">Trigger</th>
                  <th className="px-3 py-2 text-left">Task</th>
                  <th className="px-3 py-2 text-right">Duration</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {auditRecent.map((r, i) => (
                  <tr key={`${r.correlation_id}-${i}`} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtTime(r.timestamp)}</td>
                    <td className="px-3 py-2">{eventTypeBadge(r.event_type)}</td>
                    <td className="px-3 py-2 text-slate-300">{r.usage_role}</td>
                    <td className="px-3 py-2 text-slate-400 font-mono">{r.runner_type}</td>
                    <td className="px-3 py-2 text-slate-300">{r.provider}</td>
                    <td className="px-3 py-2 text-slate-400">{r.trigger_source}</td>
                    <td className="px-3 py-2 text-slate-400 font-mono">{r.task_id ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">{fmtDuration(r.duration_ms)}</td>
                    <td className="px-3 py-2 text-center">{statusBadge(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
