/**
 * NotificationDeliveryEngine
 *
 * Delivery layer — receives DailyAlertsResult, formats via NotificationPayloadAdapter,
 * dispatches to configured providers, and writes NotificationDeliveryLog.
 *
 * Design principles:
 * - Providers are pluggable; adding a new channel requires only a new provider class
 * - Formatting logic stays in NotificationPayloadAdapter, NOT here
 * - All failures are logged; none are silently swallowed
 * - Degraded mode: missing config → status "skipped"; provider error → status "failed"
 * - Never fabricates a "success" when delivery was not attempted
 */

import { prisma } from '@/lib/prisma';
import type { DailyAlertsResult } from './DailyAlertEngine';
import {
  formatAsPlainText,
  formatAsMarkdown,
  formatAsStructured,
} from './NotificationPayloadAdapter';

// ─── Provider Interface ───────────────────────────────────────────

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  responseBody?: string;
}

export interface DeliveryProvider {
  readonly channel: string;
  readonly payloadType: 'structured' | 'markdown' | 'plainText';
  /** Returns null if provider is not configured (will be logged as "skipped") */
  readonly target: string | null;
  send(payload: string): Promise<DeliveryResult>;
}

// ─── Webhook Provider ─────────────────────────────────────────────

export class WebhookDeliveryProvider implements DeliveryProvider {
  readonly channel = 'webhook';
  readonly payloadType = 'structured' as const;
  readonly target: string | null;

  private headers: Record<string, string>;
  private timeoutMs: number;

  constructor(options?: { url?: string; headers?: Record<string, string>; timeoutMs?: number }) {
    this.target = options?.url ?? process.env.NOTIFY_WEBHOOK_URL ?? null;
    this.headers = options?.headers ?? this.defaultHeaders();
    this.timeoutMs = options?.timeoutMs ?? 10_000;
  }

  private defaultHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const secret = process.env.NOTIFY_WEBHOOK_SECRET;
    if (secret) h['X-Notify-Secret'] = secret;
    return h;
  }

  async send(payload: string): Promise<DeliveryResult> {
    if (!this.target) {
      return { success: false, error: 'NOTIFY_WEBHOOK_URL not configured' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(this.target, {
        method: 'POST',
        headers: this.headers,
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timer);
      const body = await res.text().catch(() => '');

      if (!res.ok) {
        return { success: false, statusCode: res.status, error: `HTTP ${res.status}`, responseBody: body.slice(0, 500) };
      }
      return { success: true, statusCode: res.status, responseBody: body.slice(0, 200) };
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }
}

// ─── Email Provider ───────────────────────────────────────────────
// Re-export NodemailerEmailProvider as EmailDeliveryProvider so that
// all existing callers (API routes, tests) continue to work unchanged.

export { NodemailerEmailProvider as EmailDeliveryProvider } from './EmailProvider';
import { NodemailerEmailProvider as EmailDeliveryProvider } from './EmailProvider';

// ─── LINE Text Provider (stub) ────────────────────────────────────

export class LineTextDeliveryProvider implements DeliveryProvider {
  readonly channel = 'line_text';
  readonly payloadType = 'plainText' as const;
  readonly target: string | null;

  constructor(options?: { token?: string }) {
    this.target = options?.token ?? process.env.NOTIFY_LINE_TOKEN ?? null;
  }

  async send(payload: string): Promise<DeliveryResult> {
    if (!this.target) {
      return { success: false, error: 'NOTIFY_LINE_TOKEN not configured' };
    }
    try {
      const res = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.target}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ message: payload }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await res.text().catch(() => '');
      if (!res.ok) {
        return { success: false, statusCode: res.status, error: `LINE API ${res.status}`, responseBody: body.slice(0, 300) };
      }
      return { success: true, statusCode: res.status };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// ─── Delivery Engine ──────────────────────────────────────────────

export interface DeliveryEngineOptions {
  providers?: DeliveryProvider[];
  maxRetries?: number;
  retryDelayMs?: number;
  /** If true, send even when alerts array is empty (sends summary-only) */
  sendWhenEmpty?: boolean;
  /** Min alerts required before sending; ignored when sendWhenEmpty=true */
  minAlerts?: number;
}

export interface ChannelDeliveryReport {
  channel: string;
  target: string;
  payloadType: string;
  status: 'success' | 'failed' | 'skipped';
  retryCount: number;
  error?: string;
  logId?: number;
}

export interface DeliveryEngineResult {
  reportDate: string;
  alertCount: number;
  channels: ChannelDeliveryReport[];
  skippedReason?: string;
  generatedAt: string;
}

export async function deliverAlerts(
  alertsResult: DailyAlertsResult,
  options?: DeliveryEngineOptions,
): Promise<DeliveryEngineResult> {
  const maxRetries = options?.maxRetries ?? 2;
  const retryDelayMs = options?.retryDelayMs ?? 2_000;
  const sendWhenEmpty = options?.sendWhenEmpty ?? false;
  const minAlerts = options?.minAlerts ?? 0;

  // Default providers: pick up env-configured channels
  const providers: DeliveryProvider[] = options?.providers ?? [
    new WebhookDeliveryProvider(),
    new EmailDeliveryProvider(),
    new LineTextDeliveryProvider(),
  ];

  const channels: ChannelDeliveryReport[] = [];

  // Skip delivery if no alerts and not forced
  if (!sendWhenEmpty && alertsResult.alerts.length < minAlerts) {
    return {
      reportDate: alertsResult.reportDate,
      alertCount: alertsResult.alerts.length,
      channels,
      skippedReason: `Alert count ${alertsResult.alerts.length} below minimum threshold ${minAlerts}`,
      generatedAt: new Date().toISOString(),
    };
  }

  for (const provider of providers) {
    // Skip unconfigured providers
    if (provider.target === null) {
      const report: ChannelDeliveryReport = {
        channel: provider.channel,
        target: 'unconfigured',
        payloadType: provider.payloadType,
        status: 'skipped',
        retryCount: 0,
        error: `Channel not configured (env var missing)`,
      };
      channels.push(report);
      await writeDeliveryLog(alertsResult, provider, report);
      continue;
    }

    // Build payload
    let payloadStr: string;
    try {
      if (provider.payloadType === 'structured') {
        payloadStr = JSON.stringify(formatAsStructured(alertsResult));
      } else if (provider.payloadType === 'markdown') {
        const md = formatAsMarkdown(alertsResult);
        payloadStr = JSON.stringify(md);
      } else {
        const pt = formatAsPlainText(alertsResult);
        payloadStr = pt.text;
      }
    } catch (fmtErr) {
      const report: ChannelDeliveryReport = {
        channel: provider.channel,
        target: provider.target,
        payloadType: provider.payloadType,
        status: 'failed',
        retryCount: 0,
        error: `Payload format error: ${fmtErr instanceof Error ? fmtErr.message : String(fmtErr)}`,
      };
      channels.push(report);
      await writeDeliveryLog(alertsResult, provider, report);
      continue;
    }

    // Attempt delivery with retry
    let lastResult: DeliveryResult = { success: false, error: 'No attempt made' };
    let attempt = 0;

    while (attempt <= maxRetries) {
      lastResult = await provider.send(payloadStr);
      if (lastResult.success) break;
      attempt++;
      if (attempt <= maxRetries) await sleep(retryDelayMs * attempt);
    }

    const report: ChannelDeliveryReport = {
      channel: provider.channel,
      target: provider.target,
      payloadType: provider.payloadType,
      status: lastResult.success ? 'success' : 'failed',
      retryCount: attempt,
      error: lastResult.success ? undefined : lastResult.error,
    };
    channels.push(report);
    const logEntry = await writeDeliveryLog(alertsResult, provider, report);
    if (logEntry) report.logId = logEntry.id;
  }

  return {
    reportDate: alertsResult.reportDate,
    alertCount: alertsResult.alerts.length,
    channels,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Log Writer ───────────────────────────────────────────────────

async function writeDeliveryLog(
  result: DailyAlertsResult,
  provider: DeliveryProvider,
  report: ChannelDeliveryReport,
) {
  try {
    return await prisma.notificationDeliveryLog.create({
      data: {
        channel: provider.channel,
        target: report.target,
        payloadType: provider.payloadType,
        status: report.status,
        errorMessage: report.error ?? null,
        retryCount: report.retryCount,
        alertCount: result.alerts.length,
        reportDate: result.reportDate,
        metadata: JSON.stringify({
          overallSeverity: result.overallSeverity,
          comparisonAvailable: result.comparisonAvailable,
          summarySnippet: result.summary.slice(0, 100),
        }),
      },
    });
  } catch (dbErr) {
    // Log write failure must not crash delivery engine
    console.error('[DeliveryEngine] Failed to write delivery log:', dbErr);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Returns default providers based on env config (for external use) */
export function buildDefaultProviders(): DeliveryProvider[] {
  return [
    new WebhookDeliveryProvider(),
    new EmailDeliveryProvider(),
    new LineTextDeliveryProvider(),
  ];
}
