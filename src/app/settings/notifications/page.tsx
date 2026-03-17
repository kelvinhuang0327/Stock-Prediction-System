"use client";

/**
 * /settings/notifications — Notification Delivery Management Page
 *
 * Sections:
 * 1. Channel Status Cards   — configured/unconfigured, last delivery
 * 2. Test Send Panel        — trigger test per channel (no auto-fire on load)
 * 3. Delivery Log Table     — filterable, paginated log
 * 4. Recent Activity        — 24h summary stats
 * 5. Disclaimer / Limitations
 *
 * Security: sensitive values (tokens, URLs, emails) are MASKED by the backend API.
 * This page never displays or requests raw credentials.
 */

import React, { useState, useCallback } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { GlassCard } from '@/components/ui/glass-card';
import { LoadingSpinner } from '@/components/ui/loading';
import { StatusBadge } from '@/components/ui/badges';
import {
  Bell, Webhook, Mail, CheckCircle2, XCircle, AlertTriangle,
  Minus, RefreshCw, Send, ChevronDown, ChevronUp,
  Clock, Activity, Database, Info, FlaskConical
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────

interface LastDelivery {
  status: string;
  sentAt: string;
  alertCount: number;
  retryCount: number;
  errorMessage: string | null;
  reportDate: string | null;
}

interface ChannelStatus {
  channel: string;
  label: string;
  payloadType: string;
  configured: boolean;
  targetMasked: string | null;
  note?: string;
  lastDelivery: LastDelivery | null;
}

interface NotifyStatus {
  channels: ChannelStatus[];
  stats24h: { total: number; success: number; failed: number; skipped: number };
  lastAlertDelivery: { sentAt: string; reportDate: string | null; alertCount: number; status: string } | null;
  sendWhenEmpty: boolean;
  generatedAt: string;
}

interface DeliveryLog {
  id: number;
  channel: string;
  target: string;
  payloadType: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
  retryCount: number;
  alertCount: number;
  reportDate: string | null;
  metadata: Record<string, unknown> | null;
}

interface DeliveryLogsResponse {
  total: number;
  returned: number;
  stats: { byStatus: Record<string, number>; byChannel: Record<string, number> };
  logs: DeliveryLog[];
}

interface TestResult {
  channel: string;
  status: string;
  error?: string;
  logId?: number;
}

// ─── Channel icon ─────────────────────────────────────────────────

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === 'webhook')   return <Webhook className="h-5 w-5" />;
  if (channel === 'line_text') return <Bell className="h-5 w-5" />;
  if (channel === 'email')     return <Mail className="h-5 w-5" />;
  return <Bell className="h-5 w-5" />;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} 分鐘前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小時前`;
  return `${Math.floor(hrs / 24)} 天前`;
}

// ─── Channel Status Cards ─────────────────────────────────────────

function ChannelCards({ channels, onTest }: {
  channels: ChannelStatus[];
  onTest: (channel: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {channels.map(ch => (
        <GlassCard key={ch.channel} className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <ChannelIcon channel={ch.channel} />
              {ch.label}
            </div>
            <StatusBadge status={ch.configured ? 'configured' : 'not configured'} />
          </div>

          {/* Target (masked) */}
          <div className="text-xs text-muted-foreground space-y-1">
            <div><span className="font-medium">目標：</span>{ch.targetMasked ?? '—'}</div>
            <div><span className="font-medium">格式：</span>{ch.payloadType}</div>
          </div>

          {/* Note (e.g. email stub) */}
          {ch.note && (
            <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded p-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />{ch.note}
            </div>
          )}

          {/* Last delivery */}
          <div className="border-t border-border/30 pt-2 text-xs space-y-1">
            <div className="font-medium text-muted-foreground">上次發送</div>
            {ch.lastDelivery ? (
              <>
                <div className="flex items-center gap-2">
                  <StatusBadge status={ch.lastDelivery.status} />
                  <span className="text-muted-foreground">{relativeTime(ch.lastDelivery.sentAt)}</span>
                </div>
                <div className="text-muted-foreground">
                  {ch.lastDelivery.alertCount} 則提醒
                  {ch.lastDelivery.retryCount > 0 && ` · 重試 ${ch.lastDelivery.retryCount} 次`}
                </div>
                {ch.lastDelivery.errorMessage && (
                  <div className="text-red-600 dark:text-red-400 break-all">{ch.lastDelivery.errorMessage.slice(0, 80)}</div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground">無紀錄</div>
            )}
          </div>

          {/* Test button */}
          <button
            onClick={() => onTest(ch.channel)}
            disabled={!ch.configured}
            className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
              bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            {ch.configured ? '測試發送' : '未設定'}
          </button>
        </GlassCard>
      ))}
    </div>
  );
}

// ─── Test Send Panel ──────────────────────────────────────────────

function TestSendPanel({ onTrigger }: { onTrigger: (channel: string | null) => Promise<TestResult[]> }) {
  const [selected, setSelected] = useState<string>('all');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);

  const handleSend = useCallback(async () => {
    setSending(true);
    setResults(null);
    try {
      const res = await onTrigger(selected === 'all' ? null : selected);
      setResults(res);
    } finally {
      setSending(false);
    }
  }, [selected, onTrigger]);

  return (
    <GlassCard className="p-5 space-y-4">
      <div className="flex items-center gap-2 font-semibold">
        <FlaskConical className="h-4 w-4 text-primary" />
        測試發送
        <span className="text-xs font-normal text-muted-foreground ml-1">— 發送合成測試訊息，非真實提醒</span>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">選擇 Channel</label>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background"
          >
            <option value="all">全部已設定 channels</option>
            <option value="webhook">Webhook</option>
            <option value="line_text">LINE Notify</option>
            <option value="email">Email</option>
          </select>
        </div>
        <button
          onClick={handleSend}
          disabled={sending}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground
            hover:bg-primary/90 disabled:opacity-60 transition-colors text-sm"
        >
          {sending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {sending ? '發送中...' : '發送測試'}
        </button>
      </div>

      {results && (
        <div className="space-y-2 border-t border-border/30 pt-3">
          <div className="text-xs font-medium text-muted-foreground">測試結果</div>
          {results.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {r.status === 'success'
                ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                : r.status === 'skipped'
                ? <Minus className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              }
              <div>
                <span className="font-medium">{r.channel}</span>
                {' — '}
                <StatusBadge status={r.status} />
                {r.error && <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">{r.error}</div>}
                {r.logId && <div className="text-xs text-muted-foreground">Log #{r.logId}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

// ─── Delivery Log Table ───────────────────────────────────────────

const PAGE_SIZE = 15;

function DeliveryLogTable() {
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const params = new URLSearchParams({ limit: String((page + 1) * PAGE_SIZE) });
  if (channelFilter) params.set('channel', channelFilter);
  if (statusFilter)  params.set('status', statusFilter);
  if (dateFilter)    params.set('date', dateFilter);

  const { data, loading, refetch } = useApiData<DeliveryLogsResponse>(
    `/api/notify/delivery-log?${params}`,
    { immediate: true }
  );

  const logs = data?.logs ?? [];
  const visibleLogs = logs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const hasMore = data ? data.total > (page + 1) * PAGE_SIZE : false;

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={channelFilter} onChange={e => { setChannelFilter(e.target.value); setPage(0); }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background">
          <option value="">全部 Channel</option>
          <option value="webhook">Webhook</option>
          <option value="line_text">LINE Notify</option>
          <option value="email">Email</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background">
          <option value="">全部狀態</option>
          <option value="success">成功</option>
          <option value="failed">失敗</option>
          <option value="skipped">略過</option>
        </select>
        <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(0); }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background"
        />
        <button onClick={refetch} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
          <RefreshCw className="h-3 w-3" />重整
        </button>
        {data && <span className="text-xs text-muted-foreground">共 {data.total} 筆</span>}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
          <LoadingSpinner /><span className="text-sm">載入中...</span>
        </div>
      ) : visibleLogs.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <Database className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm text-muted-foreground">
            {data?.total === 0 ? '尚無發送紀錄' : '此篩選條件無符合紀錄'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">使用測試發送面板或等待 daily cron job 觸發後再查詢</p>
        </GlassCard>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  {['ID', '時間', 'Channel', '狀態', '目標', '格式', '提醒數', '報告日期', '重試', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleLogs.map(log => (
                  <React.Fragment key={log.id}>
                    <tr className={`hover:bg-muted/10 transition-colors ${expandedId === log.id ? 'bg-muted/20' : ''}`}>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{log.id}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(log.sentAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1"><ChannelIcon channel={log.channel} />{log.channel}</span>
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={log.status} /></td>
                      <td className="px-3 py-2 max-w-[120px] truncate text-muted-foreground">{maskTarget(log.target)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{log.payloadType}</td>
                      <td className="px-3 py-2 text-center">{log.alertCount}</td>
                      <td className="px-3 py-2 text-muted-foreground">{log.reportDate ?? '—'}</td>
                      <td className="px-3 py-2 text-center">{log.retryCount}</td>
                      <td className="px-3 py-2">
                        {(log.errorMessage || log.metadata) && (
                          <button onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            className="text-muted-foreground hover:text-foreground">
                            {expandedId === log.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr>
                        <td colSpan={10} className="px-4 py-3 bg-muted/20">
                          {log.errorMessage && (
                            <div className="mb-2">
                              <span className="text-xs font-medium text-red-600 dark:text-red-400">錯誤訊息：</span>
                              <span className="text-xs text-red-600 dark:text-red-400 ml-1 break-all">{log.errorMessage}</span>
                            </div>
                          )}
                          {log.metadata && (
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">Metadata：</span>
                              <pre className="text-xs text-muted-foreground mt-1 bg-muted/30 rounded p-2 overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 rounded bg-muted/30 hover:bg-muted/50 disabled:opacity-40 transition-colors">
            ← 上一頁
          </button>
          <span>第 {page + 1} 頁</span>
          <button onClick={() => setPage(p => p + 1)} disabled={!hasMore}
            className="px-3 py-1.5 rounded bg-muted/30 hover:bg-muted/50 disabled:opacity-40 transition-colors">
            下一頁 →
          </button>
        </div>
      )}
    </div>
  );
}

/** Mask target for display — backend already masks, but add client-side guard too */
function maskTarget(target: string): string {
  if (!target || target === 'unconfigured') return '—';
  if (target.startsWith('http')) {
    try {
      const u = new URL(target);
      return `${u.protocol}//${u.hostname.slice(0, 12)}...`;
    } catch { /* fall through */ }
  }
  if (target.includes('@')) {
    const [l, d] = target.split('@');
    return `${l[0]}***@${d}`;
  }
  if (target === 'configured (token hidden)') return target;
  return target.slice(0, 8) + '...';
}

// ─── Recent Activity Summary ──────────────────────────────────────

function ActivitySummary({ status }: { status: NotifyStatus }) {
  const { stats24h, lastAlertDelivery, sendWhenEmpty } = status;

  return (
    <GlassCard className="p-5">
      <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-primary" />
        最近活動（24h）
      </h2>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: '總計發送', value: stats24h.total, color: '' },
          { label: '成功', value: stats24h.success, color: 'text-green-600 dark:text-green-400' },
          { label: '失敗', value: stats24h.failed, color: 'text-red-600 dark:text-red-400' },
          { label: '略過', value: stats24h.skipped, color: 'text-gray-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center p-3 rounded-lg bg-muted/20">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Last daily alert job */}
      <div className="border-t border-border/30 pt-3 space-y-1.5 text-xs">
        <div className="font-medium text-muted-foreground flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />最近一次 daily_alerts job
        </div>
        {lastAlertDelivery ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={lastAlertDelivery.status} />
            <span>{relativeTime(lastAlertDelivery.sentAt)}</span>
            {lastAlertDelivery.reportDate && <span className="text-muted-foreground">({lastAlertDelivery.reportDate})</span>}
            <span className="text-muted-foreground">{lastAlertDelivery.alertCount} 則提醒</span>
          </div>
        ) : (
          <span className="text-muted-foreground">7 天內無發送紀錄</span>
        )}
        <div className="flex items-center gap-1 text-muted-foreground">
          <Info className="h-3 w-3" />
          空 alerts 時發送：{sendWhenEmpty ? '是（NOTIFY_SEND_EMPTY=true）' : '否（預設）'}
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function NotificationsSettingsPage() {
  const { data: status, loading: statusLoading, error: statusError, refetch: refetchStatus } =
    useApiData<NotifyStatus>('/api/notify/status');

  // Test send handler
  const handleTest = useCallback(async (channel: string | null): Promise<TestResult[]> => {
    const url = channel
      ? `/api/notify/send/test?channel=${channel}`
      : '/api/notify/send/test';
    const res = await fetch(url);
    const data = await res.json();
    if (data.channels) return data.channels;
    return [{ channel: channel ?? 'all', status: 'failed', error: data.error ?? 'Unknown error' }];
  }, []);

  // Shortcut: test a single channel from the card button
  const handleTestChannel = useCallback(async (channel: string) => {
    await handleTest(channel);
    refetchStatus();
  }, [handleTest, refetchStatus]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            通知設定
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            管理通知 channel 狀態、測試發送、查閱發送紀錄
          </p>
        </div>
        <button onClick={refetchStatus}
          className="self-start flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-muted/30 hover:bg-muted/50 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />重新整理
        </button>
      </div>

      {/* Section 1: Channel Status */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />Channel 狀態
        </h2>
        {statusLoading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <LoadingSpinner /><span className="text-sm">載入中...</span>
          </div>
        ) : statusError || !status ? (
          <GlassCard className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
            <p className="text-sm text-muted-foreground">{statusError ?? '無法取得 channel 狀態'}</p>
          </GlassCard>
        ) : (
          <ChannelCards channels={status.channels} onTest={handleTestChannel} />
        )}
      </section>

      {/* Section 2: Test Send */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />測試發送
        </h2>
        <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          以下操作將發送合成測試訊息至已設定的 channel。測試不會使用真實 alert 資料，不影響分析功能。
        </div>
        <TestSendPanel onTrigger={handleTest} />
      </section>

      {/* Section 3: Delivery Log */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />發送紀錄
        </h2>
        <DeliveryLogTable />
      </section>

      {/* Section 4: Recent Activity */}
      {status && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />排程活動
          </h2>
          <ActivitySummary status={status} />
        </section>
      )}

      {/* Section 5: Limitations */}
      <GlassCard variant="subtle" className="p-4 text-xs text-muted-foreground space-y-1">
        <div className="font-medium flex items-center gap-1">
          <Info className="h-3.5 w-3.5" />設定說明與限制
        </div>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>通知設定透過環境變數控制（NOTIFY_WEBHOOK_URL / NOTIFY_LINE_TOKEN / NOTIFY_EMAIL_TO）</li>
          <li>Token / 完整 URL 不會顯示於此頁面，僅顯示遮罩摘要</li>
          <li>Email 發送尚未實作，需接設 SMTP 或第三方 Email 服務</li>
          <li>所有通知內容均為研究摘要，不構成投資建議</li>
          <li>daily_alerts job 由 /api/cron/daily-sync 排程觸發（priority 7）</li>
        </ul>
      </GlassCard>
    </div>
  );
}
