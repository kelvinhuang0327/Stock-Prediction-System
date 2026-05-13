/**
 * T-11: FreshnessAlert API Route Tests
 *
 * Tests that GET /api/daily-report/regime includes freshnessAlert.
 * No DB writes. No strategy signals. No ROI/win-rate.
 */

import { GET } from '../route';

jest.mock('@/lib/time/currentDate', () => ({
  getCurrentDateISO: () => '2026-05-06',
  resolveCurrentDate: (input?: string | null) => input ?? '2026-05-06',
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      _body: body,
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('@/lib/marketRegimeResult', () => ({
  getLatestMarketRegimeContext: jest.fn(),
  computeFreshnessAlert: jest.fn(),
}));

import { getLatestMarketRegimeContext, computeFreshnessAlert } from '@/lib/marketRegimeResult';

const mockGetCtx = getLatestMarketRegimeContext as jest.Mock;
const mockComputeAlert = computeFreshnessAlert as jest.Mock;

const SAMPLE_CTX = {
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

const FRESH_ALERT = {
  alertLevel: 'FRESH',
  freshnessLagDays: 0,
  lastRegimeDate: '2026-05-06',
  currentDate: '2026-05-06',
  message: null,
  requiresAction: false,
};

const MISSING_ALERT = {
  alertLevel: 'MISSING',
  freshnessLagDays: null,
  lastRegimeDate: null,
  currentDate: '2026-05-06',
  message: 'No MarketRegimeResult found.',
  requiresAction: true,
};

const FORBIDDEN_FIELDS = [
  'buy', 'sell', 'signal', 'roi', 'win_rate', 'alpha',
  'edge', 'profit', 'recommendation', 'outperform',
];

beforeEach(() => {
  mockGetCtx.mockReset();
  mockComputeAlert.mockReset();
});

function collectKeys(obj: unknown, keys: Set<string> = new Set()): Set<string> {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      keys.add(k);
      collectKeys(v, keys);
    }
  }
  return keys;
}

describe('GET /api/daily-report/regime (T-11 freshnessAlert)', () => {
  it('response includes freshnessAlert for available regime', async () => {
    mockGetCtx.mockResolvedValue(SAMPLE_CTX);
    mockComputeAlert.mockReturnValue(FRESH_ALERT);
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveProperty('freshnessAlert');
    expect(body.freshnessAlert.alertLevel).toBe('FRESH');
  });

  it('freshnessAlert.alertLevel is FRESH for current latest regime', async () => {
    mockGetCtx.mockResolvedValue(SAMPLE_CTX);
    mockComputeAlert.mockReturnValue(FRESH_ALERT);
    const res = await GET();
    const body = await res.json();
    expect(body.freshnessAlert.alertLevel).toBe('FRESH');
    expect(body.freshnessAlert.requiresAction).toBe(false);
  });

  it('missing-data response includes freshnessAlert.alertLevel = MISSING', async () => {
    mockGetCtx.mockResolvedValue({
      isAvailable: false,
      freshnessStatus: 'MISSING',
      freshnessLagDays: -1,
      warning: 'No MarketRegimeResult records found in DB',
    });
    mockComputeAlert.mockReturnValue(MISSING_ALERT);
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveProperty('freshnessAlert');
    expect(body.freshnessAlert.alertLevel).toBe('MISSING');
    expect(body.freshnessAlert.requiresAction).toBe(true);
  });

  it('T-09 fields are still present: status, reportDate, regime, guardrails', async () => {
    mockGetCtx.mockResolvedValue(SAMPLE_CTX);
    mockComputeAlert.mockReturnValue(FRESH_ALERT);
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('reportDate');
    expect(body).toHaveProperty('regime');
    expect(body).toHaveProperty('guardrails');
  });

  it('response guardrails are still present', async () => {
    mockGetCtx.mockResolvedValue(SAMPLE_CTX);
    mockComputeAlert.mockReturnValue(FRESH_ALERT);
    const res = await GET();
    const body = await res.json();
    expect(body.guardrails).toHaveProperty('notTradingRecommendation', true);
    expect(body.guardrails).toHaveProperty('notBuySellSignal', true);
    expect(body.guardrails).toHaveProperty('notPerformanceEvidence', true);
  });

  it('no forbidden fields in API response', async () => {
    mockGetCtx.mockResolvedValue(SAMPLE_CTX);
    mockComputeAlert.mockReturnValue(FRESH_ALERT);
    const res = await GET();
    const body = await res.json();
    const allKeys = collectKeys(body);
    FORBIDDEN_FIELDS.forEach(field => {
      expect(allKeys).not.toContain(field);
    });
  });

  it('freshnessAlert has required fields', async () => {
    mockGetCtx.mockResolvedValue(SAMPLE_CTX);
    mockComputeAlert.mockReturnValue(FRESH_ALERT);
    const res = await GET();
    const body = await res.json();
    const fa = body.freshnessAlert;
    expect(fa).toHaveProperty('alertLevel');
    expect(fa).toHaveProperty('freshnessLagDays');
    expect(fa).toHaveProperty('lastRegimeDate');
    expect(fa).toHaveProperty('currentDate');
    expect(fa).toHaveProperty('message');
    expect(fa).toHaveProperty('requiresAction');
  });
});
