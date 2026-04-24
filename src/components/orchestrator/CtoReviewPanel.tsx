"use client";

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GlassButton } from '@/components/ui/glass-button';
import type { CtoRunIntent } from '@/lib/agent-orchestrator/ctoTypes';

interface CtoReviewPanelProps {
  schedulerEnabled: boolean;
  signalState: {
    state: string;
    confidenceLabel: string;
    reason: string;
  } | null;
  latestRun: {
    runId:          string;
    candidateCount: number;
    acceptedCount:  number;
    rejectedCount:  number;
    deferredCount:  number;
    reflectedCount: number;
    summary:        string | null;
    isManual:       boolean;
    createdAt:      string;
  } | null;
}

interface CtoSummary {
  pending_count:      number;
  accepted_count:     number;
  rejected_count:     number;
  deferred_count:     number;
  reflected_count:    number;
  frequency_mode:     string;
  scheduler_enabled:  boolean;
  latest_run_at:      string | null;
  next_run_at:        string | null;
  latest_run_summary: string | null;
}

interface CtoRunRow {
  id: number;
  runId: string;
  frequencyMode: string;
  startedAt: string;
  completedAt: string | null;
  candidateCount: number;
  acceptedCount: number;
  rejectedCount: number;
  deferredCount: number;
  reflectedCount: number;
  summary: string | null;
  isManual: boolean;
  runIntent: string | null;
}

interface Candidate {
  proposalId?: number;
  symbol?: string;
  setupType?: string;
  conviction?: number;
  pnlPct?: number | null;
  decision?: string;
  decisionReason?: string;
  finding_id?: string;
  backlog_status?: string | null;
  [key: string]: unknown;
}

interface RunDetail {
  run: CtoRunRow;
  reviews: Candidate[];
  backlog_items: Array<{ findingId: string; status: string; priorityLevel: string; category: string; suggestedAction: string | null; urgency: string }>;
  report_json?: { signal_state?: unknown; candidates?: Candidate[] };
}

interface PendingRow {
  task_id: string;
  task_title: string;
  integration_group: string;
  review_priority: string;
  source_branch: string;
  commit_sha: string;
  conviction: number;
  state: string;
}

interface AdaptivePolicy {
  resubmitMergeRate:  number;
  compareApproveRate: number;
  forceLearningRate:  number;
  overallAcceptRate:  number;
  runsAnalyzed:       number;
  policyConfidence:   'low' | 'medium' | 'high';
  suggestions: Array<{ level: 'info' | 'warn' | 'recommend'; text: string }>;
  computedAt:  string | Date;
}

const INTENT_LABELS: Record<CtoRunIntent, string> = {
  resubmit_proposal: 'Resubmit Proposals',
  compare_regimes:   'Compare Regimes',
  force_learning:    'Force Learning',
};

function signalStateTone(state: string): string {
  if (state === 'NORMAL')           return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  if (state === 'SIGNAL_SATURATED') return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  if (state === 'COLD_REGIME')      return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
  if (state === 'TRUE_EXHAUSTED')   return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
}

function decisionColor(d?: string): string {
  if (!d) return 'text-slate-400';
  if (d.startsWith('ACCEPTED'))  return 'text-emerald-400';
  if (d.startsWith('REJECTED'))  return 'text-rose-400';
  if (d.startsWith('DEFERRED'))  return 'text-amber-400';
  if (d.startsWith('REFLECTED')) return 'text-slate-400';
  return 'text-slate-300';
}

function priorityColor(p?: string): string {
  if (p === 'P0') return 'bg-rose-700 text-white';
  if (p === 'P1') return 'bg-orange-700 text-white';
  if (p === 'P2') return 'bg-yellow-700 text-white';
  return 'bg-slate-700 text-slate-300';
}

function rateColor(value: number): string {
  if (value >= 0.5)  return 'text-emerald-400';
  if (value >= 0.25) return 'text-amber-400';
  return 'text-rose-400';
}

const CONF_COLOR: Record<string, string> = {
  high:   'text-emerald-400',
  medium: 'text-amber-400',
  low:    'text-rose-400',
};

const SUGGESTION_BG: Record<string, string> = {
  warn:      'bg-amber-900/40 text-amber-300 border border-amber-700/40',
  recommend: 'bg-blue-900/40 text-blue-300 border border-blue-700/40',
  info:      'bg-slate-800/60 text-slate-400 border border-slate-700/40',
};

const SUGGESTION_ICON: Record<string, string> = {
  warn:      '⚠',
  recommend: '→',
  info:      'ℹ',
};

const PRIORITY_BG: Record<string, string> = {
  HIGH:   'bg-rose-800 text-rose-200',
  MEDIUM: 'bg-yellow-800 text-yellow-200',
};

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

export function CtoReviewPanel({ schedulerEnabled, signalState, latestRun }: Readonly<CtoReviewPanelProps>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [schedulerOn, setSchedulerOn] = useState(schedulerEnabled);

  // CTO Summary stats
  const [ctoSummary, setCtoSummary] = useState<CtoSummary | null>(null);
  const ctoCountdown = useCountdown(ctoSummary?.next_run_at);

  // Force rerun + intent
  const [forceRerun, setForceRerun] = useState(false);
  const [runIntent, setRunIntent] = useState<CtoRunIntent | ''>('');

  // Runs list
  const [runs, setRuns] = useState<CtoRunRow[]>([]);
  const [runsDate, setRunsDate] = useState('');
  const [runsStatus, setRunsStatus] = useState('');
  const [runsLoading, setRunsLoading] = useState(false);

  // Run detail
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Pending commits
  const [pending, setPending] = useState<PendingRow[]>([]);

  // Backlog add feedback
  const [backlogMsg, setBacklogMsg] = useState<Record<string, string>>({});

  // Adaptive Policy
  const [adaptivePolicy, setAdaptivePolicy] = useState<AdaptivePolicy | null>(null);
  const [adaptivePolicyLoading, setAdaptivePolicyLoading] = useState(false);

  // CTO Provider
  const [ctoProvider, setCtoProvider] = useState('codex');
  const [ctoProviderModel, setCtoProviderModel] = useState('');
  const [ctoProviderHint, setCtoProviderHint] = useState('讀取 CTO provider 狀態中…');
  const [ctoProviderOptions, setCtoProviderOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [ctoProviderPresets, setCtoProviderPresets] = useState<string[]>([]);
  const [ctoProviderSaving, setCtoProviderSaving] = useState(false);

  // Execution Policy
  const [execPolicy, setExecPolicy] = useState<{
    mode: string;
    queue_by_level: Record<string, number>;
    queue_by_category: Record<string, number>;
    recent_selections: Array<{ level: string; category: string }>;
    consecutive_high: number;
    consecutive_category: string | null;
    consecutive_category_count: number;
    aging_items_count: number;
    policy_constants: Record<string, number>;
  } | null>(null);
  const [execPolicySaving, setExecPolicySaving] = useState(false);
  const [execPolicyMode, setExecPolicyMode] = useState('balanced');
  const [agingLoading, setAgingLoading] = useState(false);

  const loadAdaptivePolicy = useCallback(async () => {
    try {
      const res  = await fetch('/api/orchestrator/cto/adaptive-policy');
      const data = await res.json() as { ok: boolean; policy?: AdaptivePolicy };
      if (data.ok && data.policy) setAdaptivePolicy(data.policy);
    } catch { /* ignore */ }
  }, []);

  const recomputeAdaptivePolicy = useCallback(async () => {
    setAdaptivePolicyLoading(true);
    try {
      const res  = await fetch('/api/orchestrator/cto/adaptive-policy', { method: 'POST' });
      const data = await res.json() as { ok: boolean; policy?: AdaptivePolicy };
      if (data.ok && data.policy) setAdaptivePolicy(data.policy);
    } finally {
      setAdaptivePolicyLoading(false);
    }
  }, []);

  const loadCtoProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/orchestrator/cto/providers');
      const data = await res.json() as {
        ok: boolean; planner_provider?: string; planner_model?: string;
        planner_provider_label?: string; planner_options?: Array<{ value: string; label: string }>;
        planner_model_presets?: string[];
      };
      if (data.ok) {
        setCtoProvider(data.planner_provider ?? 'codex');
        setCtoProviderModel(data.planner_model ?? '');
        setCtoProviderOptions(data.planner_options ?? []);
        setCtoProviderPresets(data.planner_model_presets ?? []);
        setCtoProviderHint(`目前：${data.planner_provider_label ?? data.planner_provider ?? '—'}${data.planner_model ? ' / ' + data.planner_model : ''}`);
      }
    } catch { /* ignore */ }
  }, []);

  const saveCtoProviders = async () => {
    setCtoProviderSaving(true);
    try {
      const res = await fetch('/api/orchestrator/cto/providers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planner_provider: ctoProvider, planner_model: ctoProviderModel }),
      });
      const data = await res.json() as { ok: boolean; planner_provider_label?: string; planner_model?: string };
      if (data.ok) {
        setCtoProviderHint(`已套用：${data.planner_provider_label ?? ctoProvider}${data.planner_model ? ' / ' + data.planner_model : ''}`);
        setTimeout(() => void loadCtoProviders(), 3000);
      } else {
        setCtoProviderHint('儲存失敗');
      }
    } finally {
      setCtoProviderSaving(false);
    }
  };

  const loadExecPolicy = useCallback(async () => {
    try {
      const res = await fetch('/api/orchestrator/cto/backlog/policy');
      const data = await res.json() as { ok: boolean } & typeof execPolicy;
      if (data.ok) {
        setExecPolicy(data);
        setExecPolicyMode(data.mode ?? 'balanced');
      }
    } catch { /* ignore */ }
  }, []);

  const saveExecPolicy = async () => {
    setExecPolicySaving(true);
    try {
      await fetch('/api/orchestrator/cto/backlog/policy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: execPolicyMode }),
      });
      await loadExecPolicy();
    } finally {
      setExecPolicySaving(false);
    }
  };

  const triggerAging = async () => {
    setAgingLoading(true);
    try {
      const res = await fetch('/api/orchestrator/cto/backlog/aging', { method: 'POST' });
      const data = await res.json() as { ok: boolean; aged_count?: number };
      if (data.ok) {
        setStatus(`⏫ ${data.aged_count ?? 0} 筆已更新 aging bonus`);
        await loadExecPolicy();
      }
    } finally {
      setAgingLoading(false);
    }
  };

  const loadSummary = useCallback(async () => {    try {
      const res  = await fetch('/api/orchestrator/cto/summary');
      const data = await res.json() as { ok: boolean } & CtoSummary;
      if (data.ok) setCtoSummary(data);
    } catch { /* ignore */ }
  }, []);

  const loadRuns = useCallback(async (date = '', status = '') => {
    setRunsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (date)   params.set('date', date);
      if (status) params.set('status', status);
      const res  = await fetch(`/api/orchestrator/cto/runs?${params.toString()}`);
      const data = await res.json() as { ok: boolean; runs?: CtoRunRow[] };
      if (data.ok) setRuns(data.runs ?? []);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const res  = await fetch('/api/orchestrator/cto/pending');
      const data = await res.json() as { ok: boolean; rows?: PendingRow[] };
      if (data.ok) setPending(data.rows ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadRuns();
    void loadPending();
    void loadAdaptivePolicy();
    void loadCtoProviders();
    void loadExecPolicy();
  }, [loadSummary, loadRuns, loadPending, loadAdaptivePolicy, loadCtoProviders, loadExecPolicy]);

  useEffect(() => {
    const id = setInterval(() => { void loadSummary(); }, 60_000);
    return () => clearInterval(id);
  }, [loadSummary]);

  async function loadRunDetail(runId: string) {
    setDetailLoading(true);
    try {
      const [runRes, reportRes, backlogRes] = await Promise.all([
        fetch(`/api/orchestrator/cto/runs/${runId}`),
        fetch(`/api/orchestrator/cto/reports/${runId}`),
        fetch(`/api/orchestrator/cto/backlog?cto_run_id=${runId}`),
      ]);
      const [runData, reportData, backlogData] = await Promise.all([
        runRes.json()    as Promise<{ ok: boolean; run?: CtoRunRow; reviews?: Candidate[] }>,
        reportRes.json() as Promise<{ ok: boolean; run?: CtoRunRow; report_json?: RunDetail['report_json']; backlog_items?: RunDetail['backlog_items'] }>,
        backlogData_GET(backlogRes),
      ]);
      if (runData.ok && runData.run) {
        setSelectedRun({
          run:          runData.run,
          reviews:      runData.reviews ?? reportData.report_json?.candidates ?? [],
          backlog_items: reportData.backlog_items ?? backlogData,
          report_json:  reportData.report_json,
        });
      }
    } finally {
      setDetailLoading(false);
    }
  }

  async function backlogData_GET(res: Response): Promise<RunDetail['backlog_items']> {
    const data = await res.json().catch(() => ({})) as { ok?: boolean; items?: RunDetail['backlog_items'] };
    return data.ok ? (data.items ?? []) : [];
  }

  async function runNow() {
    setStatus('Running CTO review…');
    const body: Record<string, unknown> = { force: forceRerun };
    if (runIntent) body.run_intent = runIntent;
    const resp = await fetch('/api/orchestrator/cto/run-now', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (data.ok) {
      setStatus('Review complete');
      void loadSummary();
      void loadRuns(runsDate, runsStatus);
      startTransition(() => router.refresh());
    } else {
      setStatus(`Error: ${data.error ?? 'unknown'}`);
    }
  }

  async function setCtoScheduler(enabled: boolean) {
    const resp = await fetch('/api/orchestrator/cto/scheduler', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ enabled }),
    });
    const data = (await resp.json().catch(() => ({}))) as { ok?: boolean };
    if (data.ok) {
      setSchedulerOn(enabled);
      setStatus(`CTO scheduler ${enabled ? '已啟用' : '已停止'}`);
    }
  }

  async function addToBacklog(candidate: Candidate) {
    const findingId = candidate.finding_id ?? `${selectedRun?.run.runId}-${candidate.proposalId ?? candidate.symbol ?? Date.now()}`;
    setBacklogMsg((prev) => ({ ...prev, [findingId]: '加入中…' }));
    const resp = await fetch('/api/orchestrator/cto/backlog', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        finding_id:      findingId,
        cto_run_id:      selectedRun?.run.runId,
        severity:        candidate.decision?.startsWith('REJECTED') ? 'HIGH' : 'MEDIUM',
        impact_score:    candidate.conviction ? Math.round(candidate.conviction * 100) : 50,
        urgency:         'SOON',
        category:        'signal',
        suggested_action: candidate.decisionReason ?? null,
      }),
    });
    const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBacklogMsg((prev) => ({ ...prev, [findingId]: data.ok ? '✓ 已加入' : `❌ ${data.error ?? '失敗'}` }));
  }

  async function batchAddHighPriority() {
    if (!selectedRun) return;
    const highPrio = selectedRun.reviews.filter((c) =>
      c.decision === 'REJECTED_ADJUST_SIGNAL' || c.decision === 'DEFERRED_REGIME_MISMATCH',
    );
    const findings = highPrio.map((c) => ({
      finding_id:      c.finding_id ?? `${selectedRun.run.runId}-${c.proposalId ?? c.symbol ?? Math.random()}`,
      severity:        c.decision?.startsWith('REJECTED') ? 'HIGH' : 'MEDIUM',
      impact_score:    c.conviction ? Math.round(c.conviction * 100) : 70,
      urgency:         'SOON',
      category:        'signal',
      suggested_action: c.decisionReason ?? null,
    }));
    setStatus(`批次加入 ${findings.length} 筆…`);
    const resp = await fetch('/api/orchestrator/cto/backlog/batch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ run_id: selectedRun.run.runId, findings }),
    });
    const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; count?: number };
    setStatus(data.ok ? `✓ 已批次加入 ${data.count ?? findings.length} 筆到 backlog` : '❌ 批次加入失敗');
  }

  const highPrioCount = selectedRun?.reviews.filter((c) =>
    c.decision === 'REJECTED_ADJUST_SIGNAL' || c.decision === 'DEFERRED_REGIME_MISMATCH',
  ).length ?? 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">

      {/* ── Header: scheduler state + enable/stop ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">CTO Review System</h2>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${schedulerOn ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
            {schedulerOn ? '排程啟用中' : '排程已停止'}
          </span>
          <GlassButton
            onClick={() => void setCtoScheduler(true)}
            variant="success"
            disabled={schedulerOn}
            loading={isPending}
          >啟用排程</GlassButton>
          <GlassButton
            onClick={() => void setCtoScheduler(false)}
            variant="danger"
            disabled={!schedulerOn}
            loading={isPending}
          >停止排程</GlassButton>
        </div>
      </div>

      {/* ── CTO Provider Bar ── */}
      <div className="flex items-center gap-3 flex-wrap rounded-lg bg-slate-900/50 border border-slate-700 px-3 py-2">
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          {'Planner'}
          <select
            value={ctoProvider}
            onChange={(e) => setCtoProvider(e.target.value)}
            className="ml-1.5 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 text-xs"
          >
            {ctoProviderOptions.length > 0 ? ctoProviderOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            )) : (
              <>
                <option value="claude">Claude CLI</option>
                <option value="codex">Codex CLI</option>
              </>
            )}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          {'Model'}
          <input
            type="text"
            list="cto-planner-model-opts"
            placeholder="例如 auto"
            value={ctoProviderModel}
            onChange={(e) => setCtoProviderModel(e.target.value)}
            className="ml-1.5 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 w-36"
          />
          <datalist id="cto-planner-model-opts">
            {ctoProviderPresets.map((p) => <option key={p} value={p} />)}
          </datalist>
        </label>
        <GlassButton onClick={() => void saveCtoProviders()} loading={ctoProviderSaving} variant="default" className="text-xs">套用組合</GlassButton>
        <span className="text-xs text-slate-400">{ctoProviderHint}</span>
      </div>

      {/* ── CTO Summary Stats ── */}
      {ctoSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {[
            { label: '待審查', value: ctoSummary.pending_count,   color: 'text-yellow-400' },
            { label: '已接受', value: ctoSummary.accepted_count,  color: 'text-emerald-400' },
            { label: '已拒絕', value: ctoSummary.rejected_count,  color: 'text-rose-400' },
            { label: '已延遲', value: ctoSummary.deferred_count,  color: 'text-amber-400' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-slate-900/60 border border-slate-700 p-2">
              <div className="text-slate-400">{s.label}</div>
              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── CTO Countdown ── */}
      <div className="flex items-center gap-4 text-xs">
        <div className="rounded-lg bg-slate-900/60 border border-slate-700 p-2">
          <div className="text-slate-400 mb-0.5">下次 CTO 審查</div>
          <div className="text-white font-mono font-medium">{ctoCountdown}</div>
        </div>
        {ctoSummary?.frequency_mode && (
          <span className="text-slate-400">模式: <span className="text-white">{ctoSummary.frequency_mode}</span></span>
        )}
        {ctoSummary?.latest_run_at && (
          <span className="text-slate-400">上次: <span className="text-white">{new Date(ctoSummary.latest_run_at).toLocaleString()}</span></span>
        )}
      </div>

      {/* ── Signal State ── */}
      {signalState && (
        <div className={`rounded-lg border px-4 py-3 text-xs ${signalStateTone(signalState.state)}`}>
          <div className="flex items-center gap-2 font-semibold mb-1">
            <span>{signalState.state}</span>
            <span className="opacity-60">({signalState.confidenceLabel} confidence)</span>
          </div>
          <div className="opacity-70">{signalState.reason}</div>
        </div>
      )}

      {/* ── Run-Now Controls ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={forceRerun}
              onChange={(e) => setForceRerun(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800"
            />
            強制重跑 (force)
            {forceRerun && <span className="text-amber-400 ml-1">⚠ 將忽略 dedupe 鎖</span>}
          </label>
          <select
            value={runIntent}
            onChange={(e) => setRunIntent(e.target.value as CtoRunIntent | '')}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
          >
            <option value="">— 選擇 intent (可選) —</option>
            {(Object.entries(INTENT_LABELS) as [CtoRunIntent, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <GlassButton onClick={() => void runNow()} disabled={isPending} className="text-xs">
            立即執行 CTO Review
          </GlassButton>
        </div>
      </div>

      {status && <p className="text-xs text-slate-400">{status}</p>}

      {/* ── Latest Run Summary ── */}
      {latestRun && !selectedRun && (
        <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-xs space-y-1">
          <div className="text-white/50 mb-1">最近一次執行 · {new Date(latestRun.createdAt).toLocaleString()}</div>
          <div className="flex gap-4">
            <span className="text-emerald-400">✓ {latestRun.acceptedCount} 接受</span>
            <span className="text-rose-400">✗ {latestRun.rejectedCount} 拒絕</span>
            <span className="text-amber-400">⏸ {latestRun.deferredCount} 延遲</span>
            <span className="text-slate-400">↩ {latestRun.reflectedCount} 反映</span>
          </div>
          {latestRun.summary && <div className="text-white/40 mt-1">{latestRun.summary}</div>}
        </div>
      )}

      {/* ── CTO Runs List ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">執行歷史</span>
          <input
            type="text"
            placeholder="日期 YYYYMMDD"
            value={runsDate}
            onChange={(e) => setRunsDate(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 w-32"
          />
          <select
            value={runsStatus}
            onChange={(e) => setRunsStatus(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
          >
            <option value="">全部</option>
            <option value="manual">manual</option>
            <option value="scheduled">scheduled</option>
          </select>
          <GlassButton onClick={() => void loadRuns(runsDate, runsStatus)} variant="default" loading={runsLoading}>篩選</GlassButton>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left pb-1 pr-2">時間</th>
                <th className="text-left pb-1 pr-2">模式</th>
                <th className="text-left pb-1 pr-2">候選</th>
                <th className="text-left pb-1 pr-2">接受</th>
                <th className="text-left pb-1 pr-2">拒絕</th>
                <th className="text-left pb-1">摘要</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr
                  key={r.runId}
                  className={`border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/40 transition-colors ${selectedRun?.run.runId === r.runId ? 'bg-slate-800/60' : ''}`}
                  onClick={() => { void loadRunDetail(r.runId); }}
                >
                  <td className="py-1 pr-2 text-slate-400">{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</td>
                  <td className="py-1 pr-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${r.isManual ? 'bg-blue-800 text-blue-200' : 'bg-slate-700 text-slate-300'}`}>
                      {r.isManual ? 'manual' : 'scheduled'}
                    </span>
                    {r.runIntent && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-purple-800 text-purple-200">{r.runIntent}</span>}
                  </td>
                  <td className="py-1 pr-2 text-slate-300">{r.candidateCount}</td>
                  <td className="py-1 pr-2 text-emerald-400">{r.acceptedCount}</td>
                  <td className="py-1 pr-2 text-rose-400">{r.rejectedCount}</td>
                  <td className="py-1 text-slate-400 max-w-[200px] truncate">{r.summary ?? '—'}</td>
                </tr>
              ))}
              {runs.length === 0 && !runsLoading && (
                <tr><td colSpan={6} className="py-3 text-slate-500 text-center">無執行記錄</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Run Detail Panel ── */}
      {detailLoading && <div className="text-xs text-slate-400 animate-pulse">載入詳情…</div>}
      {selectedRun && !detailLoading && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-semibold text-white">Run {selectedRun.run.runId.slice(0, 8)}… 詳情</div>
              <div className="text-xs text-slate-400">{selectedRun.run.startedAt ? new Date(selectedRun.run.startedAt).toLocaleString() : ''} · {selectedRun.run.frequencyMode}</div>
            </div>
            <button onClick={() => setSelectedRun(null)} className="text-slate-400 hover:text-white text-sm">✕</button>
          </div>

          {/* Intelligence panel (Verdict + stats) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {[
              { label: '候選數', value: selectedRun.run.candidateCount, color: 'text-white' },
              { label: '接受', value: selectedRun.run.acceptedCount,  color: 'text-emerald-400' },
              { label: '拒絕', value: selectedRun.run.rejectedCount,  color: 'text-rose-400' },
              { label: '延遲', value: selectedRun.run.deferredCount,  color: 'text-amber-400' },
            ].map((s) => (
              <div key={s.label} className="rounded bg-slate-800/60 p-2 text-center">
                <div className="text-slate-400">{s.label}</div>
                <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {selectedRun.run.summary && (
            <div className="text-xs text-slate-300 bg-slate-800/40 p-2 rounded">{selectedRun.run.summary}</div>
          )}

          {/* Batch add button */}
          {highPrioCount > 0 && (
            <GlassButton onClick={() => void batchAddHighPriority()} variant="danger" className="text-xs">
              ⚡ 加入全部高優先 backlog ({highPrioCount})
            </GlassButton>
          )}

          {/* Findings (candidates) */}
          <div className="space-y-2">
            <div className="text-xs text-slate-400 font-medium">審查結果 ({selectedRun.reviews.length} 筆)</div>
            {selectedRun.reviews.map((c, i) => {
              const findingId = c.finding_id ?? `${selectedRun.run.runId}-${c.proposalId ?? c.symbol ?? i}`;
              const backlogItem = selectedRun.backlog_items.find((b) => b.findingId === findingId);
              const msg = backlogMsg[findingId];
              return (
                <div key={findingId} className="rounded-lg border border-slate-700 bg-slate-800/40 p-2 text-xs flex items-start justify-between gap-2">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">{c.symbol ?? `Proposal #${c.proposalId}`}</span>
                      {c.setupType && <span className="text-slate-400">{c.setupType}</span>}
                      {c.conviction !== undefined && <span className="text-slate-400">conviction={(Number(c.conviction) * 100).toFixed(0)}%</span>}
                      <span className={decisionColor(c.decision)}>{c.decision ?? '—'}</span>
                      {backlogItem && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${priorityColor(backlogItem.priorityLevel)}`}>
                          {backlogItem.priorityLevel}
                        </span>
                      )}
                    </div>
                    {c.decisionReason && <div className="text-slate-400">{c.decisionReason}</div>}
                  </div>
                  <div className="shrink-0">
                    {backlogItem ? (
                      <span className="text-xs text-slate-400">backlog: {backlogItem.status}</span>
                    ) : (
                      <button
                        onClick={() => void addToBacklog(c)}
                        className="text-xs px-2 py-0.5 rounded bg-blue-800 text-blue-200 hover:bg-blue-700 transition-colors"
                      >
                        {msg ?? '＋ 加入 backlog'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {selectedRun.reviews.length === 0 && (
              <div className="text-slate-500 text-center py-2">此次執行無候選</div>
            )}
          </div>
        </div>
      )}

      {/* ── Execution Policy Panel ── */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">🎯 Scheduler Execution Policy</span>
          <span className="flex-1" />
          <select
            value={execPolicyMode}
            onChange={(e) => setExecPolicyMode(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
          >
            <option value="strict_priority">strict_priority ⚡</option>
            <option value="balanced">balanced ⚖ (推薦)</option>
            <option value="fairness">fairness ♻</option>
          </select>
          <GlassButton onClick={() => void saveExecPolicy()} loading={execPolicySaving} variant="default" className="text-xs">儲存模式</GlassButton>
          <GlassButton onClick={() => void triggerAging()} loading={agingLoading} variant="default" className="text-xs">⏫ 觸發 Aging</GlassButton>
        </div>
        {execPolicy && (
          <div className="space-y-2 text-xs">
            <div className="flex gap-3 flex-wrap">
              {(['P0', 'P1', 'P2', 'P3'] as const).map((lvl) => {
                const lvlColors: Record<string, string> = { P0: 'text-rose-400', P1: 'text-yellow-400', P2: 'text-blue-400', P3: 'text-slate-400' };
                const cnt = execPolicy.queue_by_level[lvl] ?? 0;
                return cnt > 0 ? (
                  <span key={lvl} className={`${lvlColors[lvl]}`}>{lvl}: <b>{cnt}</b></span>
                ) : null;
              })}
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">高優先連續: <b className="text-yellow-400">{execPolicy.consecutive_high}</b> / {execPolicy.policy_constants.fairness_every_n ?? 7}</span>
              {execPolicy.consecutive_category && (
                <span className="text-slate-400">Category: <b className="text-blue-400">{execPolicy.consecutive_category}</b> × {execPolicy.consecutive_category_count}</span>
              )}
            </div>
            {Object.keys(execPolicy.queue_by_category).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(execPolicy.queue_by_category).sort((a, b) => b[1] - a[1]).map(([cat, cnt]) => (
                  <span key={cat} className="text-xs text-slate-400">{cat}: <span className="text-blue-400">{cnt}</span></span>
                ))}
              </div>
            )}
            {execPolicy.recent_selections.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {execPolicy.recent_selections.slice(0, 10).map((s, i) => {
                  const lvlColors: Record<string, string> = { P0: 'border-rose-400/40 text-rose-300', P1: 'border-yellow-400/40 text-yellow-300', P2: 'border-blue-400/40 text-blue-300', P3: 'border-slate-400/40 text-slate-400' };
                  return (
                    <span key={`${s.level}-${s.category}-${i}`} className={`text-[10px] px-1.5 py-0.5 rounded border ${lvlColors[s.level] ?? 'border-slate-600 text-slate-400'}`}>
                      {s.level} {s.category}
                    </span>
                  );
                })}
              </div>
            )}
            {execPolicy.aging_items_count > 0 && (
              <div className="text-yellow-400 text-xs">⏫ {execPolicy.aging_items_count} 個 backlog 項目已累計 aging bonus</div>
            )}
          </div>
        )}
      </div>

      {/* ── Adaptive Policy Panel ── */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Adaptive Policy</div>
          <GlassButton onClick={() => void recomputeAdaptivePolicy()} loading={adaptivePolicyLoading} className="text-xs">重新計算</GlassButton>
        </div>
        {adaptivePolicy ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {[
                { label: 'Overall Accept', value: adaptivePolicy.overallAcceptRate },
                { label: 'Resubmit Rate',  value: adaptivePolicy.resubmitMergeRate },
                { label: 'Compare Rate',   value: adaptivePolicy.compareApproveRate },
                { label: 'Force Rate',     value: adaptivePolicy.forceLearningRate },
              ].map((m) => (
                <div key={m.label} className="rounded bg-slate-800/60 p-2">
                  <div className="text-slate-400">{m.label}</div>
                  <div className={`text-sm font-bold ${rateColor(m.value)}`}>
                    {(m.value * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-400 flex gap-3">
              <span>信心: <span className={CONF_COLOR[adaptivePolicy.policyConfidence] ?? 'text-slate-400'}>{adaptivePolicy.policyConfidence}</span></span>
              <span>分析 runs: <span className="text-white">{adaptivePolicy.runsAnalyzed}</span></span>
              {adaptivePolicy.computedAt && <span>計算時間: <span className="text-white">{new Date(adaptivePolicy.computedAt).toLocaleString()}</span></span>}
            </div>
            {adaptivePolicy.suggestions.length > 0 && (
              <div className="space-y-1">
                {adaptivePolicy.suggestions.map((s) => (
                  <div key={s.text} className={`text-xs rounded px-2 py-1.5 ${SUGGESTION_BG[s.level] ?? SUGGESTION_BG['info']}`}>
                    <span className="font-semibold mr-1">{SUGGESTION_ICON[s.level] ?? 'ℹ'}</span>
                    {s.text}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-slate-500">尚無 adaptive policy 資料 — 點擊「重新計算」生成</div>
        )}
      </div>

      {/* ── Pending Commits Table ── */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-400 font-medium">待審查 Proposals ({pending.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-left pb-1 pr-2">ID</th>
                  <th className="text-left pb-1 pr-2">標的</th>
                  <th className="text-left pb-1 pr-2">類型</th>
                  <th className="text-left pb-1 pr-2">優先</th>
                  <th className="text-left pb-1 pr-2">Branch</th>
                  <th className="text-left pb-1">Commit</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.task_id} className="border-b border-slate-800/50">
                    <td className="py-1 pr-2 text-slate-400">{p.task_id}</td>
                    <td className="py-1 pr-2 text-white">{p.task_title}</td>
                    <td className="py-1 pr-2 text-slate-300">{p.integration_group}</td>
                    <td className="py-1 pr-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${PRIORITY_BG[p.review_priority] ?? 'bg-slate-700 text-slate-300'}`}>{p.review_priority}</span>
                    </td>
                    <td className="py-1 pr-2 text-slate-400 font-mono text-[10px]">{p.source_branch}</td>
                    <td className="py-1 text-slate-400 font-mono text-[10px]">{p.commit_sha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
