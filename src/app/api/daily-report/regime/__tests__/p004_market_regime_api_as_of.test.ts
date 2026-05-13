/**
 * @jest-environment node
 *
 * P0-04: /api/daily-report/regime — asOf gate tests
 *
 * Validates that the regime API supports asOfDate query param and
 * passes it as an upper bound to getLatestMarketRegimeContext().
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

jest.mock('@/lib/marketRegimeResult', () => ({
  getLatestMarketRegimeContext: jest.fn(),
  computeFreshnessAlert: jest.fn().mockReturnValue({
    alertLevel: 'FRESH',
    freshnessLagDays: 0,
    lastRegimeDate: '2026-05-07',
    currentDate: '2026-05-07',
    message: 'Fresh',
    requiresAction: false,
  }),
}));

jest.mock('@/lib/time/currentDate', () => ({
  resolveCurrentDate: jest.fn((d?: string) => d ?? '2026-05-07'),
}));

import { GET } from '../route';
import { getLatestMarketRegimeContext } from '@/lib/marketRegimeResult';

const mockCtx = getLatestMarketRegimeContext as jest.Mock;

const AVAILABLE_CONTEXT = {
  isAvailable: true,
  date: '2026-05-07',
  regimeLabel: 'BULL',
  confidence: 0.8,
  taiexClose: 20100,
  source: 'nightly-sync',
  version: 'v1',
  freshnessStatus: 'FRESH',
  freshnessLagDays: 0,
  warning: null,
};

const MISSING_CONTEXT = {
  isAvailable: false,
  freshnessStatus: 'MISSING',
  freshnessLagDays: -1,
  warning: 'No records',
};

describe('P0-04: /api/daily-report/regime — asOf gate', () => {
  beforeEach(() => jest.clearAllMocks());

  function makeReq(params: Record<string, string> = {}) {
    const url = new URL('http://localhost/api/daily-report/regime');
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return { nextUrl: { searchParams: url.searchParams } } as never;
  }

  it('passes asOfDate to getLatestMarketRegimeContext when provided', async () => {
    mockCtx.mockResolvedValue(AVAILABLE_CONTEXT);
    await GET(makeReq({ asOfDate: '2026-05-07' }));
    expect(mockCtx).toHaveBeenCalledWith(expect.any(String), '2026-05-07');
  });

  it('passes undefined asOf when asOfDate not in query (backward compat)', async () => {
    mockCtx.mockResolvedValue(AVAILABLE_CONTEXT);
    await GET(makeReq());
    expect(mockCtx).toHaveBeenCalledWith(expect.any(String), undefined);
  });

  it('response includes asOfDate and asOfGateStatus ACTIVE when asOfDate provided', async () => {
    mockCtx.mockResolvedValue(AVAILABLE_CONTEXT);
    const res = await GET(makeReq({ asOfDate: '2026-05-07' }));
    const body = await res.json();
    expect(body.asOfDate).toBe('2026-05-07');
    expect(body.asOfGateStatus).toBe('ACTIVE');
  });

  it('response includes asOfGateStatus NOT_APPLIED when asOfDate not provided', async () => {
    mockCtx.mockResolvedValue(AVAILABLE_CONTEXT);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.asOfGateStatus).toBe('NOT_APPLIED');
  });

  it('response includes sourceDate in regime object', async () => {
    mockCtx.mockResolvedValue(AVAILABLE_CONTEXT);
    const res = await GET(makeReq({ asOfDate: '2026-05-07' }));
    const body = await res.json();
    expect(body.regime.sourceDate).toBe('2026-05-07');
  });

  it('missing context returns asOfGateStatus in missing response', async () => {
    mockCtx.mockResolvedValue(MISSING_CONTEXT);
    const res = await GET(makeReq({ asOfDate: '2026-05-07' }));
    const body = await res.json();
    expect(body.status).toBe('missing');
    expect(body.asOfGateStatus).toBe('ACTIVE');
  });

  it('does not include forbidden performance terms in response', async () => {
    mockCtx.mockResolvedValue(AVAILABLE_CONTEXT);
    const res = await GET(makeReq({ asOfDate: '2026-05-07' }));
    const raw = JSON.stringify(await res.json());
    const forbidden = ['roi', 'win_rate', 'alpha', 'edge', 'profit', 'guaranteed', 'auto trading'];
    forbidden.forEach(term => {
      expect(raw.toLowerCase()).not.toContain(term);
    });
  });
});
