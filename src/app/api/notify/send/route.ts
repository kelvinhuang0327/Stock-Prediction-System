/**
 * POST /api/notify/send
 *
 * Triggers delivery of today's (or a specified date's) alerts to all configured channels.
 * Body (optional JSON):
 *   - date?:          YYYY-MM-DD (defaults to today)
 *   - channels?:      string[]   (subset of: webhook / email / line_text)
 *   - sendWhenEmpty?: boolean    (default false — don't send if no alerts)
 *   - minAlerts?:     number     (min alerts required to send, default 0)
 *   - dryRun?:        boolean    (generate payload but skip actual delivery)
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateDailyAlerts } from '@/lib/notify/DailyAlertEngine';
import { AutonomousAlertNotificationAdapter } from '@/lib/jobs/AutonomousAlertNotificationAdapter';
import {
  deliverAlerts,
  WebhookDeliveryProvider,
  EmailDeliveryProvider,
  LineTextDeliveryProvider,
  type DeliveryProvider,
} from '@/lib/notify/NotificationDeliveryEngine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      date,
      channels,
      sendWhenEmpty = false,
      minAlerts = 0,
      dryRun = false,
    } = body as {
      date?: string;
      channels?: string[];
      sendWhenEmpty?: boolean;
      minAlerts?: number;
      dryRun?: boolean;
    };

    // Generate alerts
    const [alertsResult, autonomousDigest] = await Promise.all([
      generateDailyAlerts({ includeWatchlist: true, includeDataWarnings: true }),
      new AutonomousAlertNotificationAdapter().buildDigest(),
    ]);
    const enrichedAlertsResult = autonomousDigest.shouldAttach
      ? { ...alertsResult, autonomousAlerts: autonomousDigest }
      : alertsResult;

    // If date override was requested, note it (engine always uses today's data)
    if (date && date !== alertsResult.reportDate) {
      return NextResponse.json({
        success: false,
        error: `Date override (${date}) not yet supported. DailyAlertEngine always produces today's alerts.`,
        hint: 'To send historical alerts, use the delivery-log API to review past deliveries.',
      }, { status: 400 });
    }

    // Filter providers by requested channels
    const allProviders: DeliveryProvider[] = [
      new WebhookDeliveryProvider(),
      new EmailDeliveryProvider(),
      new LineTextDeliveryProvider(),
    ];

    const providers = channels
      ? allProviders.filter(p => channels.includes(p.channel))
      : allProviders;

    if (providers.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No providers matched requested channels: ${channels?.join(', ')}`,
      }, { status: 400 });
    }

    if (dryRun) {
      // Return what WOULD be sent without actually sending
      return NextResponse.json({
        dryRun: true,
        reportDate: alertsResult.reportDate,
        alertCount: alertsResult.alerts.length + (autonomousDigest.shouldAttach ? autonomousDigest.alerts.length : 0),
        summary: alertsResult.summary,
        overallSeverity: alertsResult.overallSeverity,
        comparisonAvailable: alertsResult.comparisonAvailable,
        channels: providers.map(p => ({
          channel: p.channel,
          configured: p.target !== null,
          target: p.target ? '[configured]' : null,
          payloadType: p.payloadType,
        })),
        note: 'dryRun=true: no delivery was attempted.',
      });
    }

    const result = await deliverAlerts(enrichedAlertsResult, { providers, sendWhenEmpty, minAlerts });

    const successCount = result.channels.filter(c => c.status === 'success').length;
    const failedCount = result.channels.filter(c => c.status === 'failed').length;
    const skippedCount = result.channels.filter(c => c.status === 'skipped').length;

    return NextResponse.json({
      success: failedCount === 0,
      reportDate: result.reportDate,
      alertCount: result.alertCount,
      skippedReason: result.skippedReason,
      deliverySummary: { successCount, failedCount, skippedCount },
      channels: result.channels,
      generatedAt: result.generatedAt,
    });
  } catch (error) {
    console.error('[Notify Send] error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
