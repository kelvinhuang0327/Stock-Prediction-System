/**
 * T-09: MarketRegimeResult API Route Tests
 *
 * Tests /api/daily-report/regime route.
 * No DB writes. No strategy signals. No ROI/win-rate.
 */

// Mock NextResponse before next/server is loaded
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

// Fix test stability: mock date provider so reportDate is deterministic
jest.mock('@/lib/time/currentDate', () => ({
  getCurrentDateISO: () => '2026-05-06',
  resolveCurrentDate: (input?: string | null) => input ?? '2026-05-06',
}));

jest.mock('@/lib/marketRegimeResult', () => ({
  getLatestMarketRegimeContext: jest.fn(),
  computeFreshnessAlert: jest.fn().mockReturnValue({
    alertLevel: 'FRESH',
    freshnessLagDays: 0,
    lastRegimeDate: '2026-05-06',
    currentDate: '2026-05-06',
    message: null,
    requiresAction: false,
  }),
}));

import { GET } from '@/app/api/daily-report/regime/route';
import { getLatestMarketRegimeContext } from '@/lib/marketRegimeResult';

const mockGetLatest = getLatestMarketRegimeContext as jest.Mock;

const FRESH_CONTEXT = {
  isAvailable: true,
  date: '2026-05-06',
  regimeLabel: 'BULL',
  confidence: 1.0,
  taiexClose: 41138.85,
  source: 'P4_03_MARKET_REGIME_CLASSIFIER',
  version: 'p4_03b_v1',
  freshnessStatus: 'FRESH',
  freshnessLagDays: 0,
  warning: null,
};

const MISSING_CONTEXT = {
  isAvailable: false,
  freshnessStatus: 'MISSING',
  freshnessLagDays: -1,
  warning: 'No MarketRegimeResult records found in DB',
};

const FORBIDDEN_FIELDS = [
  'buy', 'sell', 'signal', 'roi', 'win_rate', 'alpha',
  'edge', 'profit', 'recommendation', 'outperform',
];

function flatKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return [key, ...flatKeys(v, key)];
  });
}

beforeEach(() => mockGetLatest.mockReset());

describe('GET /api/daily-report/regime', () => {
  it('returns status=ok with FRESH regime', async () => {
    mockGetLatest.mockResolvedValue(FRESH_CONTEXT);
    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.reportDate).toBe('2026-05-06');
    expect(body.regime).toBeTruthy();
    expect(body.regime.date).toBe('2026-05-06');
    expect(body.regime.regimeLabel).toBe('BULL');
    expect(body.regime.confidence).toBe(1.0);
    expect(body.regime.freshnessStatus).toBe('FRESH');
  });

  it('returns status=missing when no data', async () => {
    mockGetLatest.mockResolvedValue(MISSING_CONTEXT);
    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe('missing');
    expect(body.regime).toBeNull();
  });

  it('includes guardrails in all responses', async () => {
    mockGetLatest.mockResolvedValue(FRESH_CONTEXT);
    const res = await GET();
    const body = await res.json();
    expect(body.guardrails).toBeTruthy();
    expect(body.guardrails.notTradingRecommendation).toBe(true);
    expect(body.guardrails.notBuySellSignal).toBe(true);
    expect(body.guardrails.notPerformanceEvidence).toBe(true);
  });

  it('guardrails present even on missing-data response', async () => {
    mockGetLatest.mockResolvedValue(MISSING_CONTEXT);
    const res = await GET();
    const body = await res.json();
    expect(body.guardrails.notBuySellSignal).toBe(true);
  });

  it('response.regime.date <= 2026-05-06', async () => {
    mockGetLatest.mockResolvedValue(FRESH_CONTEXT);
    const res = await GET();
    const body = await res.json();
    expect(body.regime.date <= '2026-05-06').toBe(true);
  });

  it('confidence between 0 and 1', async () => {
    mockGetLatest.mockResolvedValue(FRESH_CONTEXT);
    const res = await GET();
    const body = await res.json();
    expect(body.regime.confidence).toBeGreaterThanOrEqual(0);
    expect(body.regime.confidence).toBeLessThanOrEqual(1);
  });

  it('freshnessStatus is valid enum', async () => {
    mockGetLatest.mockResolvedValue(FRESH_CONTEXT);
    const res = await GET();
    const body = await res.json();
    const allowed = ['FRESH', 'STALE', 'MISSING', 'FUTURE_DATE_ERROR'];
    expect(allowed).toContain(body.regime.freshnessStatus);
  });

  it('regimeLabel is allowed enum', async () => {
    mockGetLatest.mockResolvedValue(FRESH_CONTEXT);
    const res = await GET();
    const body = await res.json();
    const allowed = ['BULL', 'BEAR', 'SIDEWAYS', 'HIGH_VOLATILITY', 'LOW_CONFIDENCE'];
    expect(allowed).toContain(body.regime.regimeLabel);
  });

  it('does not contain forbidden fields', async () => {
    mockGetLatest.mockResolvedValue(FRESH_CONTEXT);
    const res = await GET();
    const body = await res.json();
    // Check leaf key names exactly (not as substrings)
    const keys = flatKeys(body).map(k => k.split('.').pop()!.toLowerCase());
    FORBIDDEN_FIELDS.forEach(field => {
      expect(keys).not.toContain(field);
    });
  });

  it('does not reference H001-H012 hypothesis codes', async () => {
    mockGetLatest.mockResolvedValue(FRESH_CONTEXT);
    const res = await GET();
    const body = await res.json();
    const jsonStr = JSON.stringify(body);
    for (let i = 1; i <= 12; i++) {
      const code = `H${String(i).padStart(3, '0')}`;
      expect(jsonStr).not.toContain(`"${code}"`);
    }
  });

  it('returns 500 on unexpected error', async () => {
    mockGetLatest.mockRejectedValue(new Error('unexpected'));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.guardrails).toBeTruthy();
  });
});
