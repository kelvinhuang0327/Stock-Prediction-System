/**
 * GET /api/notify/send/test
 *
 * Sends a synthetic test alert to all configured channels.
 * Used for verifying provider configuration without waiting for real alerts.
 *
 * Query params:
 *   - channel?: webhook | email | line_text (default: all configured)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  deliverAlerts,
  WebhookDeliveryProvider,
  EmailDeliveryProvider,
  LineTextDeliveryProvider,
  type DeliveryProvider,
} from '@/lib/notify/NotificationDeliveryEngine';
import type { DailyAlertsResult } from '@/lib/notify/DailyAlertEngine';

export const dynamic = 'force-dynamic';

const TEST_ALERTS_RESULT: DailyAlertsResult = {
  reportDate: new Date().toISOString().split('T')[0],
  comparisonAvailable: false,
  previousSnapshotDate: null,
  summary: '【測試訊息】此為系統通知測試，非真實研究提醒。請確認您已收到此訊息。',
  overallSeverity: 'info',
  alerts: [
    {
      type: 'data_quality_warning',
      severity: 'info',
      title: '系統通知測試',
      body: '此為 /api/notify/send/test 觸發的測試訊息。若您收到此通知，代表通知系統設定正常。',
      basis: 'Test endpoint',
      comparisonBased: false,
    },
  ],
  limitations: ['此為測試訊息，非真實分析結果'],
  generatedAt: new Date().toISOString(),
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelFilter = searchParams.get('channel');

    const allProviders: DeliveryProvider[] = [
      new WebhookDeliveryProvider(),
      new EmailDeliveryProvider(),
      new LineTextDeliveryProvider(),
    ];

    const providers = channelFilter
      ? allProviders.filter(p => p.channel === channelFilter)
      : allProviders;

    if (providers.length === 0) {
      return NextResponse.json({ success: false, error: `Unknown channel: ${channelFilter}` }, { status: 400 });
    }

    const result = await deliverAlerts(TEST_ALERTS_RESULT, {
      providers,
      sendWhenEmpty: true,
      minAlerts: 0,
    });

    return NextResponse.json({
      test: true,
      channels: result.channels.map(c => ({
        channel: c.channel,
        status: c.status,
        error: c.error,
        logId: c.logId,
      })),
      note: 'Test message sent. Check delivery-log API for details.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
