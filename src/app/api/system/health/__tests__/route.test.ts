/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    stock: { count: jest.fn() },
    stockQuote: { count: jest.fn(), aggregate: jest.fn() },
    dailyMarketSnapshot: { findFirst: jest.fn(), count: jest.fn() },
    dailyCandidateSnapshot: { findFirst: jest.fn(), count: jest.fn() },
    dailyWatchlistSnapshot: { findFirst: jest.fn(), count: jest.fn() },
    syncLog: { findMany: jest.fn() },
  },
}));
jest.mock('@/lib/prisma-safe', () => ({
  safeChipCount: jest.fn(),
  safeRevenueCount: jest.fn(),
  safeDeliveryLogs: jest.fn(),
  safeDeliveryStatuses: jest.fn(),
}));
jest.mock('@/lib/cache', () => ({ apiCache: { get: jest.fn(), set: jest.fn() } }));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  statSync: jest.fn(),
}));

import { existsSync, statSync } from 'fs';
import { apiCache } from '@/lib/cache';
import { prisma } from '@/lib/prisma';
import { safeChipCount, safeDeliveryLogs, safeDeliveryStatuses, safeRevenueCount } from '@/lib/prisma-safe';
import { GET } from '../route';

const mockCacheGet = apiCache.get as jest.Mock;
const mockCacheSet = apiCache.set as jest.Mock;
const mockExists = existsSync as jest.Mock;
const mockStats = statSync as jest.Mock;
const mockChipCount = safeChipCount as jest.Mock;
const mockRevenueCount = safeRevenueCount as jest.Mock;
const mockDeliveryLogs = safeDeliveryLogs as jest.Mock;
const mockDeliveryStatuses = safeDeliveryStatuses as jest.Mock;
const mockDb = prisma as unknown as {
  stock: { count: jest.Mock };
  stockQuote: { count: jest.Mock; aggregate: jest.Mock };
  dailyMarketSnapshot: { findFirst: jest.Mock; count: jest.Mock };
  dailyCandidateSnapshot: { findFirst: jest.Mock; count: jest.Mock };
  dailyWatchlistSnapshot: { findFirst: jest.Mock; count: jest.Mock };
  syncLog: { findMany: jest.Mock };
};

interface HealthBody {
  generatedAt?: string;
  overallStatus?: string;
  dbSizeMb?: string;
  dataSources?: Array<{ grade: string }>;
  snapshots?: Array<{ fresh: boolean }>;
  recentSync?: Array<{ jobType: string; lastRun: string | null; status: string | null }>;
  notificationChannels?: Array<{
    channel: string;
    configured: boolean;
    lastStatus: string | null;
    lastSentAt: string | null;
  }>;
  last24hDelivery?: { success: number; failed: number; skipped: number };
  knownLimitations?: string[];
  error?: string;
}

const today = new Date().toISOString().slice(0, 10);

function setCounts(stock: number, quotes: number, chips: number, revenue: number): void {
  mockDb.stock.count.mockResolvedValue(stock);
  mockDb.stockQuote.count.mockResolvedValue(quotes);
  mockDb.stockQuote.aggregate.mockResolvedValue({ _min: { date: '2020-01-01' }, _max: { date: today } });
  mockChipCount.mockResolvedValue(chips);
  mockRevenueCount.mockResolvedValue(revenue);
}

async function getBody(): Promise<{ status: number; body: HealthBody }> {
  const response = await GET();
  return { status: response.status, body: await response.json() as HealthBody };
}

describe('GET /api/system/health', () => {
  const env = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env };
    delete process.env.NOTIFY_WEBHOOK_URL;
    delete process.env.NOTIFY_LINE_TOKEN;
    delete process.env.NOTIFY_EMAIL_TO;
    mockCacheGet.mockReturnValue(null);
    mockCacheSet.mockImplementation(() => undefined);
    mockExists.mockReturnValue(true);
    mockStats.mockReturnValue({ size: 1024 * 1024 });
    setCounts(120, 6001, 1001, 501);
    mockDb.dailyMarketSnapshot.findFirst.mockResolvedValue({ snapshotDate: today });
    mockDb.dailyCandidateSnapshot.findFirst.mockResolvedValue({ snapshotDate: today });
    mockDb.dailyWatchlistSnapshot.findFirst.mockResolvedValue(null);
    mockDb.dailyMarketSnapshot.count.mockResolvedValue(3);
    mockDb.dailyCandidateSnapshot.count.mockResolvedValue(7);
    mockDb.dailyWatchlistSnapshot.count.mockResolvedValue(0);
    mockDb.syncLog.findMany.mockResolvedValue([]);
    mockDeliveryLogs.mockResolvedValue([]);
    mockDeliveryStatuses.mockResolvedValue([]);
  });

  afterAll(() => {
    process.env = env;
  });

  test('returns cached health without querying the database', async () => {
    const cached = { overallStatus: 'ok', generatedAt: 'cached' };
    mockCacheGet.mockReturnValue(cached);

    const { status, body } = await getBody();

    expect(status).toBe(200);
    expect(body).toEqual(cached);
    expect(mockDb.stock.count).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  test('aggregates source grades, snapshots, sync, secret-free channels, and delivery status', async () => {
    process.env.NOTIFY_WEBHOOK_URL = 'https://secret.example/hook';
    process.env.NOTIFY_LINE_TOKEN = 'private-line-token';
    process.env.NOTIFY_EMAIL_TO = 'alerts@example.test';
    mockDb.stockQuote.aggregate.mockResolvedValue({ _min: { date: '2026-01-01' }, _max: { date: today } });
    mockDb.dailyCandidateSnapshot.findFirst.mockResolvedValue({ snapshotDate: today });
    mockDb.dailyWatchlistSnapshot.findFirst.mockResolvedValue({ snapshotDate: today });
    mockDb.dailyWatchlistSnapshot.count.mockResolvedValue(2);
    mockDb.syncLog.findMany.mockResolvedValue([
      { endpoint: 'quotes', status: 'failed', syncedAt: new Date('2026-11-10T12:00:00.000Z') },
      { endpoint: 'quotes', status: 'success', syncedAt: new Date('2026-11-09T12:00:00.000Z') },
      { endpoint: 'indices', status: 'failed', syncedAt: new Date('2026-11-08T00:00:00.000Z') },
    ]);
    mockDeliveryLogs.mockResolvedValue([
      { channel: 'webhook', status: 'success', sentAt: new Date('2026-11-10T01:00:00.000Z') },
      { channel: 'webhook', status: 'failed', sentAt: '2026-11-10T02:00:00.000Z' },
      { channel: 'email', status: 'failed', sentAt: '2026-11-10T03:00:00.000Z' },
    ]);
    mockDeliveryStatuses.mockResolvedValue([
      { status: 'success' }, { status: 'skipped' }, { status: 'other' },
    ]);

    const { status, body } = await getBody();

    expect(status).toBe(200);
    expect(body.overallStatus).toBe('ok');
    expect(body.dbSizeMb).toBe('1.00 MB');
    expect(body.dataSources.map((source: { grade: string }) => source.grade)).toEqual(['A', 'A', 'A', 'A']);
    expect(body.snapshots.map((snapshot: { fresh: boolean }) => snapshot.fresh)).toEqual([true, true, true]);
    expect(body.recentSync).toEqual([
      { jobType: 'quotes', lastRun: '2026-11-10T12:00:00.000Z', status: 'failed' },
      { jobType: 'indices', lastRun: '2026-11-08T00:00:00.000Z', status: 'failed' },
    ]);
    expect(body.notificationChannels).toEqual([
      { channel: 'webhook', configured: true, lastStatus: 'success', lastSentAt: '2026-11-10T01:00:00.000Z' },
      { channel: 'line_text', configured: true, lastStatus: null, lastSentAt: null },
      { channel: 'email', configured: true, lastStatus: 'failed', lastSentAt: '2026-11-10T03:00:00.000Z' },
    ]);
    expect(body.last24hDelivery).toEqual({ success: 1, failed: 0, skipped: 1 });
    expect(JSON.stringify(body)).not.toContain('private-line-token');
    expect(JSON.stringify(body)).not.toContain('secret.example');
    expect(mockCacheSet).toHaveBeenCalledWith('system:health', body, 60);
  });

  test('uses lower grades, missing-file metadata, and critical status for empty data', async () => {
    setCounts(10, 600, 101, 51);
    mockExists.mockReturnValue(false);
    const medium = await getBody();
    expect(medium.body.dataSources.map((source: { grade: string }) => source.grade)).toEqual(['B', 'B', 'B', 'B']);
    expect(medium.body.dbSizeMb).toBe('unknown');

    setCounts(0, 1, 1, 1);
    mockDb.dailyMarketSnapshot.findFirst.mockResolvedValue(null);
    mockDb.dailyCandidateSnapshot.findFirst.mockResolvedValue(null);
    mockDb.dailyWatchlistSnapshot.findFirst.mockResolvedValue(null);
    mockDb.stockQuote.aggregate.mockResolvedValue({ _min: { date: null }, _max: { date: null } });
    const low = await getBody();
    expect(low.body.dataSources.map((source: { grade: string }) => source.grade)).toEqual(['D', 'C', 'C', 'C']);
    expect(low.body.overallStatus).toBe('degraded');

    setCounts(0, 0, 0, 0);
    const empty = await getBody();
    expect(empty.body.dataSources.map((source: { grade: string }) => source.grade)).toEqual(['D', 'D', 'D', 'D']);
    expect(empty.body.overallStatus).toBe('critical');
    expect(empty.body.knownLimitations).toHaveLength(3);
    expect(empty.body.notificationChannels.every((channel: { configured: boolean }) => !channel.configured)).toBe(true);
  });

  test('marks missing snapshots and recent delivery failures as degraded', async () => {
    mockDb.dailyMarketSnapshot.findFirst.mockResolvedValue(null);
    mockDb.dailyCandidateSnapshot.findFirst.mockResolvedValue(null);
    mockDeliveryStatuses.mockResolvedValue([{ status: 'failed' }]);

    const { body } = await getBody();

    expect(body.overallStatus).toBe('degraded');
    expect(body.last24hDelivery).toEqual({ success: 0, failed: 1, skipped: 0 });
  });

  test('returns a safe server error when the health query fails', async () => {
    mockDb.stock.count.mockRejectedValue(new Error('database unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { status, body } = await getBody();

    expect(status).toBe(500);
    expect(body).toEqual({ error: '系統健康資料取得失敗' });
    expect(console.error).toHaveBeenCalledWith('[SystemHealth API] Error:', expect.any(Error));
  });
});
