/**
 * NotificationPayloadAdapter
 *
 * Formats DailyAlertsResult into delivery-channel-specific payloads.
 * Does NOT send notifications — only formats them.
 *
 * Supported output formats:
 *   - plainText: for LINE Notify, SMS, basic webhook
 *   - markdown:  for email digest, rich webhook
 *   - structured: for dashboard widget, JSON webhook
 *
 * Usage:
 *   import { formatAlerts } from '@/lib/notify/NotificationPayloadAdapter';
 *   const payload = formatAlerts(alertsResult, 'plainText');
 *   // Then pass to your delivery adapter (LINE, email, webhook, etc.)
 */

import type { DailyAlertsResult, DailyAlert, AlertSeverity } from './DailyAlertEngine';

// ─── Types ────────────────────────────────────────────────────────

export type DeliveryChannel = 'line_notify' | 'email' | 'webhook' | 'dashboard';

export interface PlainTextPayload {
  channel: 'line_notify' | 'sms';
  text: string;          // single string, max ~500 chars for LINE
  truncated: boolean;
}

export interface MarkdownPayload {
  channel: 'email' | 'slack';
  subject: string;
  body: string;          // markdown formatted
}

export interface StructuredPayload {
  channel: 'webhook' | 'dashboard';
  reportDate: string;
  overallSeverity: AlertSeverity;
  summary: string;
  alertCount: number;
  warningCount: number;
  cautionCount: number;
  infoCount: number;
  alerts: Array<{
    type: string;
    severity: AlertSeverity;
    title: string;
    body: string;
    symbol?: string;
  }>;
  comparisonAvailable: boolean;
  previousSnapshotDate: string | null;
  limitations: string[];
  generatedAt: string;
  disclaimer: string;
}

const DISCLAIMER = '本提醒為系統自動產生研究摘要，僅供參考，不構成投資建議。';
const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  warning: '⚠️',
  caution: '🔔',
  info: 'ℹ️',
};

// ─── Formatters ───────────────────────────────────────────────────

export function formatAsPlainText(result: DailyAlertsResult): PlainTextPayload {
  const lines: string[] = [
    `📊 台股研究提醒 ${result.reportDate}`,
    `市場環境: ${result.alerts.find(a => a.type === 'market_regime_changed') ? '環境轉變' : '維持穩定'}`,
    ``,
    result.summary,
    ``,
  ];

  const warnings = result.alerts.filter(a => a.severity === 'warning').slice(0, 3);
  const cautions = result.alerts.filter(a => a.severity === 'caution').slice(0, 3);

  if (warnings.length > 0) {
    lines.push('⚠️ 重要提醒:');
    warnings.forEach(a => lines.push(`• ${a.title}`));
    lines.push('');
  }

  if (cautions.length > 0) {
    lines.push('🔔 注意事項:');
    cautions.forEach(a => lines.push(`• ${a.title}`));
    lines.push('');
  }

  if (!result.comparisonAvailable) {
    lines.push('（快照未建立，歷史比較提醒暫不可用）');
    lines.push('');
  }

  lines.push(DISCLAIMER);

  const text = lines.join('\n');
  const MAX_LINE_CHARS = 500;
  const truncated = text.length > MAX_LINE_CHARS;

  return {
    channel: 'line_notify',
    text: truncated ? text.slice(0, MAX_LINE_CHARS - 3) + '...' : text,
    truncated,
  };
}

export function formatAsMarkdown(result: DailyAlertsResult): MarkdownPayload {
  const severityLabel: Record<AlertSeverity, string> = {
    warning: '**⚠️ Warning**',
    caution: '**🔔 Caution**',
    info: 'ℹ️ Info',
  };

  const lines = [
    `# 台股每日研究提醒 ${result.reportDate}`,
    ``,
    `> ${result.summary}`,
    ``,
  ];

  if (!result.comparisonAvailable) {
    lines.push(`> ⚠️ 無前日快照，歷史比較提醒不可用。`);
    lines.push('');
  }

  if (result.alerts.length === 0) {
    lines.push('今日無需關注的提醒項目。');
  } else {
    const groups: Record<AlertSeverity, DailyAlert[]> = { warning: [], caution: [], info: [] };
    result.alerts.forEach(a => groups[a.severity].push(a));

    for (const sev of ['warning', 'caution', 'info'] as AlertSeverity[]) {
      if (groups[sev].length === 0) continue;
      lines.push(`## ${severityLabel[sev]}`);
      groups[sev].forEach(a => {
        lines.push(`### ${a.title}`);
        lines.push(a.body);
        if (a.previousValue && a.currentValue) {
          lines.push(`_變化: ${a.previousValue} → ${a.currentValue}_`);
        }
        lines.push(`_資料來源: ${a.basis}_`);
        lines.push('');
      });
    }
  }

  if (result.limitations.length > 0) {
    lines.push(`## 資料限制`);
    result.limitations.forEach(l => lines.push(`- ${l}`));
    lines.push('');
  }

  lines.push(`---`);
  lines.push(`_${DISCLAIMER}_`);
  lines.push(`_產生時間: ${result.generatedAt}_`);

  const overallLabel = result.overallSeverity === 'warning' ? '⚠️ 需關注'
    : result.overallSeverity === 'caution' ? '🔔 注意' : '✅ 正常';

  return {
    channel: 'email',
    subject: `台股研究提醒 ${result.reportDate} [${overallLabel}] — ${result.alerts.length} 項提醒`,
    body: lines.join('\n'),
  };
}

export function formatAsStructured(result: DailyAlertsResult): StructuredPayload {
  return {
    channel: 'webhook',
    reportDate: result.reportDate,
    overallSeverity: result.overallSeverity,
    summary: result.summary,
    alertCount: result.alerts.length,
    warningCount: result.alerts.filter(a => a.severity === 'warning').length,
    cautionCount: result.alerts.filter(a => a.severity === 'caution').length,
    infoCount: result.alerts.filter(a => a.severity === 'info').length,
    alerts: result.alerts.map(a => ({
      type: a.type,
      severity: a.severity,
      title: a.title,
      body: a.body,
      symbol: a.symbol,
    })),
    comparisonAvailable: result.comparisonAvailable,
    previousSnapshotDate: result.previousSnapshotDate,
    limitations: result.limitations,
    generatedAt: result.generatedAt,
    disclaimer: DISCLAIMER,
  };
}

/** Convenience: format for a specific channel */
export function formatAlerts(
  result: DailyAlertsResult,
  format: 'plainText' | 'markdown' | 'structured',
): PlainTextPayload | MarkdownPayload | StructuredPayload {
  if (format === 'plainText') return formatAsPlainText(result);
  if (format === 'markdown') return formatAsMarkdown(result);
  return formatAsStructured(result);
}

/** Returns severity icon for UI use */
export function severityIcon(sev: AlertSeverity): string {
  return SEVERITY_EMOJI[sev];
}
