/**
 * /api/system/health — Unified system health summary
 *
 * Aggregates data from:
 * - DB table counts (data availability)
 * - DailyMarketSnapshot / DailyCandidateSnapshot (snapshot freshness)
 * - NotificationDeliveryLog (last delivery status)
 * - SyncLog (last sync status)
 * - Notification channel config (configured / not configured only — no secrets)
 *
 * Does NOT expose secrets, tokens, or full URLs.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'system:health';
const CACHE_TTL = 60; // 1 minute

interface ChannelHealth {
  channel: string;
  configured: boolean;
  lastStatus: string | null;
  lastSentAt: string | null;
}

interface DataSourceHealth {
  id: string;
  table: string;
  rowCount: number;
  lastDate: string | null;
  grade: 'A' | 'B' | 'C' | 'D';
  usable: boolean;
}

interface SnapshotHealth {
  type: string;
  latestDate: string | null;
  rowCount: number;
  fresh: boolean; // within last 2 days
}

interface SyncHealth {
  jobType: string;
  lastRun: string | null;
  status: string | null;
}

interface SystemHealthResponse {
  generatedAt: string;
  overallStatus: 'ok' | 'degraded' | 'critical';
  dbSizeMb: string;
  dataSources: DataSourceHealth[];
  snapshots: SnapshotHealth[];
  recentSync: SyncHealth[];
  notificationChannels: ChannelHealth[];
  last24hDelivery: {
    success: number;
    failed: number;
    skipped: number;
  };
  knownLimitations: string[];
}

export async function GET() {
  const cached = apiCache.get<SystemHealthResponse>(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
    const since24h = new Date(Date.now() - 86400000).toISOString();

    // ── DB size ───────────────────────────────────────────────────
    let dbSizeMb = 'unknown';
    try {
      const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        dbSizeMb = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
      }
    } catch {}

    // ── Data sources ──────────────────────────────────────────────
    const [
      stockCount,
      quoteCount,
      quoteDates,
      chipCount,
      revCount,
    ] = await Promise.all([
      prisma.stock.count(),
      prisma.stockQuote.count(),
      prisma.stockQuote.aggregate({ _min: { date: true }, _max: { date: true } }),
      (prisma as any).institutionalChip?.count().catch(() => 0) ?? Promise.resolve(0),
      (prisma as any).monthlyRevenue?.count().catch(() => 0) ?? Promise.resolve(0),
    ]);

    const dataSources: DataSourceHealth[] = [
      {
        id: 'stock_master', table: 'Stock',
        rowCount: stockCount, lastDate: null,
        grade: stockCount > 100 ? 'A' : stockCount > 0 ? 'B' : 'D',
        usable: stockCount > 0,
      },
      {
        id: 'stock_quote', table: 'StockQuote',
        rowCount: quoteCount,
        lastDate: quoteDates._max.date ?? null,
        grade: quoteCount > 5000 ? 'A' : quoteCount > 500 ? 'B' : quoteCount > 0 ? 'C' : 'D',
        usable: quoteCount > 0,
      },
      {
        id: 'institutional_chip', table: 'InstitutionalChip',
        rowCount: chipCount, lastDate: null,
        grade: chipCount > 1000 ? 'A' : chipCount > 100 ? 'B' : chipCount > 0 ? 'C' : 'D',
        usable: chipCount > 0,
      },
      {
        id: 'monthly_revenue', table: 'MonthlyRevenue',
        rowCount: revCount, lastDate: null,
        grade: revCount > 500 ? 'A' : revCount > 50 ? 'B' : revCount > 0 ? 'C' : 'D',
        usable: revCount > 0,
      },
    ];

    // ── Snapshots ─────────────────────────────────────────────────
    const [latestMarket, latestCandidate, latestWatchlist] = await Promise.all([
      prisma.dailyMarketSnapshot.findFirst({ orderBy: { snapshotDate: 'desc' }, select: { snapshotDate: true } }),
      prisma.dailyCandidateSnapshot.findFirst({ orderBy: { snapshotDate: 'desc' }, select: { snapshotDate: true } }),
      prisma.dailyWatchlistSnapshot.findFirst({ orderBy: { snapshotDate: 'desc' }, select: { snapshotDate: true } }),
    ]);

    const [marketCount, candidateCount, watchlistCount] = await Promise.all([
      prisma.dailyMarketSnapshot.count(),
      prisma.dailyCandidateSnapshot.count(),
      prisma.dailyWatchlistSnapshot.count(),
    ]);

    const snapshots: SnapshotHealth[] = [
      {
        type: 'market', latestDate: latestMarket?.snapshotDate ?? null,
        rowCount: marketCount,
        fresh: !!latestMarket && latestMarket.snapshotDate >= twoDaysAgo,
      },
      {
        type: 'candidates', latestDate: latestCandidate?.snapshotDate ?? null,
        rowCount: candidateCount,
        fresh: !!latestCandidate && latestCandidate.snapshotDate >= twoDaysAgo,
      },
      {
        type: 'watchlist', latestDate: latestWatchlist?.snapshotDate ?? null,
        rowCount: watchlistCount,
        fresh: !!latestWatchlist && latestWatchlist.snapshotDate >= twoDaysAgo,
      },
    ];

    // ── Recent sync jobs ──────────────────────────────────────────
    const syncLogs = await prisma.syncLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
      select: { jobType: true, status: true, timestamp: true },
    });

    const syncMap = new Map<string, { lastRun: string; status: string }>();
    for (const log of syncLogs) {
      if (!syncMap.has(log.jobType)) {
        syncMap.set(log.jobType, { lastRun: log.timestamp, status: log.status });
      }
    }

    const recentSync: SyncHealth[] = Array.from(syncMap.entries()).map(([jobType, v]) => ({
      jobType, lastRun: v.lastRun, status: v.status,
    }));

    // ── Notification channels (no secrets) ───────────────────────
    const deliveryLogs = await (prisma as any).notificationDeliveryLog?.findMany({
      orderBy: { sentAt: 'desc' },
      take: 30,
      select: { channel: true, status: true, sentAt: true },
    }).catch(() => []) ?? [];

    const channelLastMap = new Map<string, { status: string; sentAt: string }>();
    for (const log of deliveryLogs) {
      if (!channelLastMap.has(log.channel)) {
        channelLastMap.set(log.channel, { status: log.status, sentAt: log.sentAt });
      }
    }

    const KNOWN_CHANNELS = ['webhook', 'line_text', 'email'];
    const notificationChannels: ChannelHealth[] = KNOWN_CHANNELS.map(ch => {
      const last = channelLastMap.get(ch);
      const configured = ch === 'webhook'
        ? !!process.env.NOTIFY_WEBHOOK_URL
        : ch === 'line_text'
        ? !!process.env.NOTIFY_LINE_TOKEN
        : ch === 'email'
        ? !!process.env.NOTIFY_EMAIL_TO
        : false;
      return {
        channel: ch,
        configured,
        lastStatus: last?.status ?? null,
        lastSentAt: last?.sentAt ?? null,
      };
    });

    // ── Last 24h delivery summary ─────────────────────────────────
    const recent24h = await (prisma as any).notificationDeliveryLog?.findMany({
      where: { sentAt: { gte: since24h } },
      select: { status: true },
    }).catch(() => []) ?? [];

    const last24hDelivery = { success: 0, failed: 0, skipped: 0 };
    for (const r of recent24h) {
      if (r.status === 'success') last24hDelivery.success++;
      else if (r.status === 'failed') last24hDelivery.failed++;
      else if (r.status === 'skipped') last24hDelivery.skipped++;
    }

    // ── Overall status ────────────────────────────────────────────
    const hasUsableData = dataSources.filter(d => d.usable).length >= 2;
    const hasFreshSnapshot = snapshots.some(s => s.fresh);
    const hasRecentFailures = last24hDelivery.failed > 0;

    const overallStatus: 'ok' | 'degraded' | 'critical' = !hasUsableData
      ? 'critical'
      : (!hasFreshSnapshot || hasRecentFailures)
      ? 'degraded'
      : 'ok';

    // ── Limitations ───────────────────────────────────────────────
    const knownLimitations: string[] = [];
    if (quoteCount === 0) knownLimitations.push('StockQuote 無資料，技術分析功能受限');
    if (!latestCandidate) knownLimitations.push('尚無候選股快照，比較功能不可用');
    if (chipCount === 0) knownLimitations.push('法人資料不足，籌碼分析受限');

    const response: SystemHealthResponse = {
      generatedAt: new Date().toISOString(),
      overallStatus,
      dbSizeMb,
      dataSources,
      snapshots,
      recentSync,
      notificationChannels,
      last24hDelivery,
      knownLimitations,
    };

    apiCache.set(CACHE_KEY, response, CACHE_TTL);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[SystemHealth API] Error:', error);
    return NextResponse.json({ error: '系統健康資料取得失敗' }, { status: 500 });
  }
}
