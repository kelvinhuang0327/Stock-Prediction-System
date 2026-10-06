/**
 * @jest-environment node
 *
 * P0-04: /api/report/ops — MarketIndex/MarketRegime as-of readiness tests
 *
 * Validates that the ops route includes P0-04 marketIndexAsOfReadiness block
 * and correctly detects future-dated MarketIndex / MarketRegimeResult rows.
 *
 * - No DB writes
 * - No external API calls
 * - No strategy mutation
 * - No performance claims
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
      _data: data,
    }),
  },
}));

jest.mock('@/lib/report/OpsReportEngine', () => ({
  buildDailyOpsReport: jest.fn().mockResolvedValue({
    reportDate: '2026-05-07',
    status: 'ok',
  }),
}));

jest.mock('@/lib/time/currentDate', () => ({
  resolveCurrentDate: jest.fn((d?: string) => d ?? '2026-05-07'),
}));

jest.mock('@/lib/data/AsOfDataGate', () => ({
  resolveAsOfDate: jest.fn((d?: string) => d ?? '2026-05-07'),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    stockQuote: {
      findFirst: jest.fn().mockResolvedValue({ date: '20260507' }),
      count: jest.fn().mockResolvedValue(1000),
    },
    marketIndex: {
      findFirst: jest.fn(),
    },
    marketRegimeResult: {
      findFirst: jest.fn(),
    },
  },
}));

import { GET } from '../route';
const { prisma } = jest.requireMock('@/lib/prisma');

function makeReq(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/report/ops');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { nextUrl: { searchParams: url.searchParams } } as never;
}

describe('P0-04: /api/report/ops — marketIndex as-of readiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.stockQuote.findFirst as jest.Mock).mockResolvedValue({ date: '20260507' });
    (prisma.stockQuote.count as jest.Mock).mockResolvedValue(1000);
  });

  it('response includes marketIndexAsOfReadiness block', async () => {
    (prisma.marketIndex.findFirst as jest.Mock).mockResolvedValue({ date: '20260507' });
    (prisma.marketRegimeResult.findFirst as jest.Mock).mockResolvedValue({ date: '2026-05-07' });
    const res = await GET(makeReq({ asOfDate: '2026-05-07' }));
    const body = await res.json();
    expect(body.marketIndexAsOfReadiness).toBeDefined();
  });

  it('marketIndex no future rows — readinessStatus PASS', async () => {
    (prisma.marketIndex.findFirst as jest.Mock).mockResolvedValue({ date: '20260507' });
    (prisma.marketRegimeResult.findFirst as jest.Mock).mockResolvedValue({ date: '2026-05-07' });
    const res = await GET(makeReq({ asOfDate: '2026-05-07' }));
    const body = await res.json();
    expect(body.marketIndexAsOfReadiness.readinessStatus).toBe('PASS');
    expect(body.marketIndexAsOfReadiness.marketIndexFutureRowsDetected).toBe(false);
  });

  it('marketIndex future rows present — readinessStatus WARN, futureRowsDetected true', async () => {
    (prisma.marketIndex.findFirst as jest.Mock).mockResolvedValue({ date: '20260518' });
    (prisma.marketRegimeResult.findFirst as jest.Mock).mockResolvedValue({ date: '2026-05-07' });
    const res = await GET(makeReq({ asOfDate: '2026-05-07' }));
    const body = await res.json();
    expect(body.marketIndexAsOfReadiness.readinessStatus).toBe('WARN');
    expect(body.marketIndexAsOfReadiness.marketIndexFutureRowsDetected).toBe(true);
    expect(body.marketIndexAsOfReadiness.marketIndexFutureRowsExcludedByGate).toBe(true);
  });

  it('MarketRegimeResult future row — WARN_FUTURE_EXCLUDED gate status', async () => {
    (prisma.marketIndex.findFirst as jest.Mock).mockResolvedValue({ date: '20260507' });
    (prisma.marketRegimeResult.findFirst as jest.Mock).mockResolvedValue({ date: '2026-05-18' });
    const res = await GET(makeReq({ asOfDate: '2026-05-07' }));
    const body = await res.json();
    expect(body.marketIndexAsOfReadiness.marketRegimeResultFutureRowsDetected).toBe(true);
    expect(body.marketIndexAsOfReadiness.marketRegimeResultGateStatus).toBe('WARN_FUTURE_EXCLUDED');
    expect(body.marketIndexAsOfReadiness.readinessStatus).toBe('WARN');
  });

  it('MarketRegimeResult missing — gate status MISSING', async () => {
    (prisma.marketIndex.findFirst as jest.Mock).mockResolvedValue({ date: '20260507' });
    (prisma.marketRegimeResult.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await GET(makeReq({ asOfDate: '2026-05-07' }));
    const body = await res.json();
    expect(body.marketIndexAsOfReadiness.marketRegimeResultGateStatus).toBe('MISSING');
    expect(body.marketIndexAsOfReadiness.marketRegimeResultSourceDate).toBeNull();
  });

  it('P0-03 asOfReadiness block still present (regression)', async () => {
    (prisma.marketIndex.findFirst as jest.Mock).mockResolvedValue({ date: '20260507' });
    (prisma.marketRegimeResult.findFirst as jest.Mock).mockResolvedValue({ date: '2026-05-07' });
    const res = await GET(makeReq({ asOfDate: '2026-05-07' }));
    const body = await res.json();
    expect(body.asOfReadiness).toBeDefined();
    expect(body.asOfReadiness.asOfDate).toBeDefined();
  });
});
