/**
 * T-03 Ops Report API Tests
 *
 * Tests for GET /api/report/ops route.
 *
 * No DB writes. No external API calls. No forbidden fields. No H001-H012.
 */

import { GET } from '@/app/api/report/ops/route';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@/lib/time/currentDate', () => ({
  getCurrentDateISO: () => '2026-05-06',
  resolveCurrentDate: (input?: string | null) => input ?? '2026-05-06',
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data: unknown, init?: { status?: number }) => ({
      _body: data,
      _status: init?.status ?? 200,
      json: async () => data,
      status: init?.status ?? 200,
    })),
  },
}));

jest.mock('@/lib/report/OpsReportEngine', () => ({
  buildDailyOpsReport: jest.fn().mockResolvedValue({
    reportDate: '2026-05-06',
    generatedAt: '2026-05-06T10:00:00.000Z',
    status: 'PASS',
    summary: 'System health PASS. Market regime: BULL. Freshness: FRESH. All guardrails satisfied.',
    marketRegime: {
      regimeLabel: 'BULL',
      confidence: 1.0,
      date: '2026-05-06',
      source: 'PERSISTED_MARKET_REGIME_RESULT',
      freshnessStatus: 'FRESH',
      freshnessLagDays: 0,
      freshnessAlert: {
        alertLevel: 'FRESH',
        freshnessLagDays: 0,
        lastRegimeDate: '2026-05-06',
        currentDate: '2026-05-06',
        message: null,
        requiresAction: false,
      },
      isAvailable: true,
    },
    freshness: {
      marketRegimeFreshness: 'FRESH',
      freshnessLagDays: 0,
      requiresAction: false,
      message: null,
    },
    walkForward: {
      contextAvailable: true,
      sampleDays: 120,
      recordsWithRegimeContext: 120,
      recordsMissingRegimeContext: 0,
      pitSafe: true,
      noBehaviorChange: true,
      note: 'T-10 walk-forward skeleton: 120/120 records enriched.',
    },
    guardrails: {
      noTradingAdvisory: true,
      noBuySellContent: true,
      noPerformanceEvidence: true,
      noLegacyHypotheses: true,
      noForbiddenFields: true,
      noDbWrite: true,
      noExternalApiCall: true,
    },
    dataQuality: {
      marketRegimeResultAvailable: true,
      latestRegimeDate: '2026-05-06',
      freshnessAlertLevel: 'FRESH',
      pitSafe: true,
    },
    readiness: {
      operatorReady: true,
      schedulerReady: true,
      dashboardReady: true,
      hardcodedDateRisk: true,
      notes: ['DEFAULT_CURRENT_DATE is hardcoded.', 'Freshness OK.'],
    },
    nextActions: ['No immediate action required. Continue daily monitoring.'],
    doNotInterpretAs: [
      'This is not a trading advisory.',
      'This is not a buy/sell content.',
      'This is not ROI evidence.',
      'This is not win-rate evidence.',
      'This is not proof of alpha or edge.',
      'This is a system readiness and observability artifact.',
    ],
  }),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

const FORBIDDEN_KEYS = ['buy', 'sell', 'signal', 'roi', 'win_rate', 'alpha', 'edge', 'profit', 'recommendation', 'outperform'];
const H_PATTERN = /H0(0[1-9]|1[0-2])\b/;

function containsForbiddenKey(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(key)) return true;
    if (containsForbiddenKey((obj as Record<string, unknown>)[key])) return true;
  }
  return false;
}

describe('T-03 Ops Report API', () => {
  let response: Awaited<ReturnType<typeof GET>>;
  let body: { status: string; report: ReturnType<typeof import('@/lib/report/OpsReportEngine').buildDailyOpsReport extends () => Promise<infer T> ? () => Promise<T> : never> };

  beforeAll(async () => {
    response = await GET();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body = (response as any)._body;
  });

  // 1. API route returns 200
  test('1. GET /api/report/ops returns status 200', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response as any)._status).toBe(200);
  });

  // 2. Response has status ok
  test('2. response body has status ok', () => {
    expect(body.status).toBe('ok');
  });

  // 3. Response has report field
  test('3. response body has report field', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((body as any).report).toBeDefined();
  });

  // 4. Report includes marketRegime
  test('4. report.marketRegime is present', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((body as any).report.marketRegime).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((body as any).report.marketRegime.regimeLabel).toBe('BULL');
  });

  // 5. Report includes freshness
  test('5. report.freshness is present', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((body as any).report.freshness).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((body as any).report.freshness.marketRegimeFreshness).toBe('FRESH');
  });

  // 6. Report includes walkForward
  test('6. report.walkForward is present', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((body as any).report.walkForward).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((body as any).report.walkForward.sampleDays).toBe(120);
  });

  // 7. Report includes guardrails
  test('7. report.guardrails is present and all true', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (body as any).report.guardrails;
    expect(g).toBeDefined();
    expect(g.noTradingAdvisory).toBe(true);
    expect(g.noBuySellContent).toBe(true);
    expect(g.noPerformanceEvidence).toBe(true);
    expect(g.noLegacyHypotheses).toBe(true);
    expect(g.noForbiddenFields).toBe(true);
    expect(g.noDbWrite).toBe(true);
    expect(g.noExternalApiCall).toBe(true);
  });

  // 8. Report includes doNotInterpretAs
  test('8. report.doNotInterpretAs is present', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dnia = (body as any).report.doNotInterpretAs;
    expect(Array.isArray(dnia)).toBe(true);
    expect(dnia.length).toBeGreaterThan(0);
  });

  // 9. freshnessAlert.alertLevel = FRESH
  test('9. marketRegime.freshnessAlert.alertLevel is FRESH', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((body as any).report.marketRegime.freshnessAlert.alertLevel).toBe('FRESH');
  });

  // 10. No forbidden field keys
  test('10. no forbidden field keys in response body', () => {
    expect(containsForbiddenKey(body)).toBe(false);
  });

  // 11. No H001-H012
  test('11. no H001-H012 in serialized response', () => {
    const serialized = JSON.stringify(body);
    expect(H_PATTERN.test(serialized)).toBe(false);
  });

  // 12. Report status is PASS
  test('12. report.status is PASS', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((body as any).report.status).toBe('PASS');
  });
});
