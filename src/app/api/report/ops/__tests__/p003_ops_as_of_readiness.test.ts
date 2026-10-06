/** @jest-environment node */
/**
 * P0-03: /api/report/ops as-of readiness tests
 *
 * Verifies:
 * 1. GET /api/report/ops returns asOfReadiness block
 * 2. asOfReadiness has required fields: asOfDate, futureRowsDetected,
 *    futureRowsExcludedByGate, abnormalHistoricalRowsDetected,
 *    mvpUniverseTierSummary, readinessStatus
 * 3. Future rows detected → readinessStatus = WARN
 * 4. No future rows → readinessStatus = PASS
 * 5. No DB write / external API / LLM
 * 6. No forbidden fields
 *
 * Research tool only. No auto trading. No edge claim. No H001-H012.
 */

import { NextRequest } from 'next/server';

const mockFindFirst = jest.fn();
const mockCount = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    stockQuote: {
      findFirst: mockFindFirst,
      count: mockCount,
    },
    marketRegimeResult: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  },
}));

jest.mock('@/lib/report/OpsReportEngine', () => ({
  buildDailyOpsReport: jest.fn().mockResolvedValue({
    date: '2026-05-07',
    systemHealth: 'OK',
    dataObservability: {},
    regimeSummary: {},
    freshness: {},
  }),
}));

jest.mock('@/lib/time/currentDate', () => ({
  resolveCurrentDate: jest.fn((input?: string | null) => input ?? '2026-05-07'),
}));

jest.mock('@/lib/data/AsOfDataGate', () => ({
  resolveAsOfDate: jest.fn((input?: string) => input ?? '2026-05-07'),
  buildAsOfWhereClause: jest.fn((asOf: string) => ({ date: { lte: asOf.replace(/-/g, '') } })),
}));

jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');
  return {
    ...actual,
    NextResponse: {
      json: jest.fn((data: unknown, init?: ResponseInit) => ({
        json: async () => data,
        status: init?.status ?? 200,
        _data: data,
      })),
    },
  };
});

describe('P0-03: /api/report/ops as-of readiness', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns asOfReadiness block in response', async () => {
    mockFindFirst.mockResolvedValue({ date: '20260507' });
    mockCount.mockResolvedValue(100).mockResolvedValueOnce(100).mockResolvedValueOnce(100);
    const { GET } = await import('@/app/api/report/ops/route');
    const req = new NextRequest('http://localhost/api/report/ops?asOfDate=2026-05-07');
    const res = await GET(req);
    const data = (res as unknown as { _data: Record<string, unknown> })._data;
    expect(data).toHaveProperty('asOfReadiness');
    const readiness = data.asOfReadiness as Record<string, unknown>;
    expect(readiness).toHaveProperty('asOfDate');
    expect(readiness).toHaveProperty('futureRowsDetected');
    expect(readiness).toHaveProperty('futureRowsExcludedByGate');
    expect(readiness).toHaveProperty('abnormalHistoricalRowsDetected');
    expect(readiness).toHaveProperty('mvpUniverseTierSummary');
    expect(readiness).toHaveProperty('readinessStatus');
  });

  it('readinessStatus is PASS when no future rows', async () => {
    // Latest quote date equals asOfDate (20260507) → not future
    mockFindFirst.mockResolvedValue({ date: '20260507' });
    mockCount.mockResolvedValue(500);
    const { GET } = await import('@/app/api/report/ops/route');
    const req = new NextRequest('http://localhost/api/report/ops?asOfDate=2026-05-07');
    const res = await GET(req);
    const data = (res as unknown as { _data: Record<string, unknown> })._data;
    const readiness = data.asOfReadiness as Record<string, unknown>;
    expect(readiness.readinessStatus).toBe('PASS');
    expect(readiness.futureRowsDetected).toBe(false);
  });

  it('readinessStatus is WARN when future rows detected', async () => {
    // Latest quote date is AFTER asOfDate → future row
    mockFindFirst.mockResolvedValue({ date: '20260601' });
    mockCount.mockResolvedValue(600);
    const { GET } = await import('@/app/api/report/ops/route');
    const req = new NextRequest('http://localhost/api/report/ops?asOfDate=2026-05-07');
    const res = await GET(req);
    const data = (res as unknown as { _data: Record<string, unknown> })._data;
    const readiness = data.asOfReadiness as Record<string, unknown>;
    expect(readiness.readinessStatus).toBe('WARN');
    expect(readiness.futureRowsDetected).toBe(true);
    expect(readiness.futureRowsExcludedByGate).toBe(true);
  });

  it('asOfReadiness does not contain forbidden new fields', async () => {
    mockFindFirst.mockResolvedValue({ date: '20260507' });
    mockCount.mockResolvedValue(100);
    const { GET } = await import('@/app/api/report/ops/route');
    const req = new NextRequest('http://localhost/api/report/ops');
    const res = await GET(req);
    const data = (res as unknown as { _data: Record<string, unknown> })._data;
    const str = JSON.stringify(data.asOfReadiness);
    expect(str).not.toMatch(/"guaranteed"/);
    expect(str).not.toMatch(/"auto_trading"/);
    expect(str).not.toMatch(/"win_rate"/);
  });

  it('GET without asOfDate param defaults to resolveAsOfDate()', async () => {
    mockFindFirst.mockResolvedValue({ date: '20260507' });
    mockCount.mockResolvedValue(100);
    const { GET } = await import('@/app/api/report/ops/route');
    // No asOfDate param
    const req = new NextRequest('http://localhost/api/report/ops');
    const res = await GET(req);
    const data = (res as unknown as { _data: Record<string, unknown> })._data;
    expect(data).toHaveProperty('asOfReadiness');
  });
});
