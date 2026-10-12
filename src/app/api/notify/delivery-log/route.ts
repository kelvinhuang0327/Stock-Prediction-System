/**
 * GET /api/notify/delivery-log
 *
 * Returns recent notification delivery logs.
 *
 * Query params:
 *   - limit?:   number (default 20, max 100)
 *   - channel?: webhook | email | line_text
 *   - status?:  success | failed | skipped
 *   - date?:    YYYY-MM-DD (filter by reportDate)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const channel = searchParams.get('channel') ?? undefined;
    const status  = searchParams.get('status')  ?? undefined;
    const date    = searchParams.get('date')     ?? undefined;

    const where: Record<string, unknown> = {};
    if (channel) where.channel = channel;
    if (status)  where.status  = status;
    if (date)    where.reportDate = date;

    const [logs, total] = await Promise.all([
      prisma.notificationDeliveryLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: limit,
      }),
      prisma.notificationDeliveryLog.count({ where }),
    ]);

    // Summary stats
    const byStatus = logs.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    const byChannel = logs.reduce<Record<string, number>>((acc, l) => {
      acc[l.channel] = (acc[l.channel] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      total,
      returned: logs.length,
      filters: { channel, status, date },
      stats: { byStatus, byChannel },
      logs: logs.map(l => ({
        id: l.id,
        channel: l.channel,
        target: l.target,
        payloadType: l.payloadType,
        status: l.status,
        errorMessage: l.errorMessage,
        sentAt: l.sentAt,
        retryCount: l.retryCount,
        alertCount: l.alertCount,
        reportDate: l.reportDate,
        metadata: l.metadata ? safeParseJson(l.metadata) : null,
      })),
    });
  } catch (error) {
    console.error('[DeliveryLog API] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function safeParseJson(s: string) {
  try { return JSON.parse(s); } catch { return s; }
}
