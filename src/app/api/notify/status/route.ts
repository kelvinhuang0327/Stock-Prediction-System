/**
 * GET /api/notify/status
 *
 * Returns channel configuration status and last delivery statistics.
 * Sensitive values (tokens, URLs, emails) are MASKED before returning.
 *
 * This is a read-only status endpoint — no delivery is triggered here.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ─── Masking helpers ──────────────────────────────────────────────

/** Masks a URL: shows scheme + first ~20 chars + '...' */
function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const masked = host.length > 15 ? host.slice(0, 12) + '...' : host;
    return `${u.protocol}//${masked}...`;
  } catch {
    return url.slice(0, 15) + '...';
  }
}

/** Masks email: `first_char***@domain` */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email.slice(0, 3) + '***';
  return `${local[0]}***@${domain}`;
}

// ─── Channel definitions ──────────────────────────────────────────

interface ChannelInfo {
  channel: string;
  label: string;
  payloadType: string;
  configured: boolean;
  targetMasked: string | null;
  note?: string;
}

function buildChannelInfo(): ChannelInfo[] {
  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL ?? null;
  const emailTo = process.env.NOTIFY_EMAIL_TO ?? null;
  const lineToken = process.env.NOTIFY_LINE_TOKEN ?? null;

  return [
    {
      channel: 'webhook',
      label: 'Webhook',
      payloadType: 'structured (JSON)',
      configured: !!webhookUrl,
      targetMasked: webhookUrl ? maskUrl(webhookUrl) : null,
    },
    {
      channel: 'line_text',
      label: 'LINE Notify',
      payloadType: 'plainText',
      configured: !!lineToken,
      targetMasked: lineToken ? 'configured (token hidden)' : null,
    },
    {
      channel: 'email',
      label: 'Email',
      payloadType: 'markdown',
      configured: !!emailTo,
      targetMasked: emailTo ? maskEmail(emailTo) : null,
      note: 'Email delivery not yet implemented — SMTP provider needed',
    },
  ];
}

// ─── Route ────────────────────────────────────────────────────────

export async function GET() {
  try {
    const channels = buildChannelInfo();

    // Last delivery per channel (most recent log entry)
    const recentLogs = await prisma.notificationDeliveryLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 50, // enough to find one per channel
    }).catch(() => []);

    // 24h stats
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs24h = recentLogs.filter(l => new Date(l.sentAt) >= cutoff24h);

    const stats24h = {
      total: logs24h.length,
      success: logs24h.filter(l => l.status === 'success').length,
      failed: logs24h.filter(l => l.status === 'failed').length,
      skipped: logs24h.filter(l => l.status === 'skipped').length,
    };

    // Per-channel last delivery
    const channelStatus = channels.map(ch => {
      const last = recentLogs.find(l => l.channel === ch.channel);
      return {
        ...ch,
        lastDelivery: last
          ? {
              status: last.status,
              sentAt: last.sentAt,
              alertCount: last.alertCount,
              retryCount: last.retryCount,
              errorMessage: last.status !== 'success' ? last.errorMessage : null,
              reportDate: last.reportDate,
            }
          : null,
      };
    });

    // Most recent daily_alerts job activity
    const lastAlertDelivery = recentLogs.find(l =>
      l.reportDate !== null && new Date(l.sentAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    return NextResponse.json({
      channels: channelStatus,
      stats24h,
      lastAlertDelivery: lastAlertDelivery
        ? {
            sentAt: lastAlertDelivery.sentAt,
            reportDate: lastAlertDelivery.reportDate,
            alertCount: lastAlertDelivery.alertCount,
            status: lastAlertDelivery.status,
          }
        : null,
      sendWhenEmpty: process.env.NOTIFY_SEND_EMPTY === 'true',
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Notify Status] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
