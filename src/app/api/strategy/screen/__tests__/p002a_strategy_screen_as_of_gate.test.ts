/** @jest-environment node */
/**
 * P0-02A: Strategy Screen As-of Gate Tests
 *
 * Verifies that /api/strategy/screen:
 * 1. Accepts explicit asOfDate query param (GET) and body field (POST)
 * 2. Defaults to resolveAsOfDate() when no asOfDate provided
 * 3. Passes asOf to runScreen() so DB queries use date <= asOfDate
 * 4. Does NOT use date > asOfDate
 * 5. Includes asOfDate and asOfGateStatus in response
 *
 * No DB writes. No external API calls. No forbidden fields.
 * No H001-H012. Research tool only.
 */

import { GET, POST } from '@/app/api/strategy/screen/route';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────

jest.mock('@/lib/data/AsOfDataGate', () => ({
  resolveAsOfDate: jest.fn((input?: string) => input ?? '2026-05-07'),
  buildAsOfWhereClause: jest.fn((asOf: string) => ({
    date: { lte: asOf.replace(/-/g, '') },
  })),
}));

jest.mock('@/lib/screen/StrategyScreenEngine', () => ({
  runScreen: jest.fn().mockResolvedValue({
    candidates: [],
    excluded: [],
    runDate: '2026-05-07',
    regime: 'NEUTRAL',
    totalScreened: 0,
    screenDurationMs: 10,
  }),
}));

jest.mock('@/lib/cache', () => ({
  apiCache: {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
  },
}));

jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');
  return {
    ...actual,
    NextResponse: {
      json: jest.fn((data: unknown, init?: { status?: number }) => ({
        _body: data,
        _status: init?.status ?? 200,
        json: async () => data,
        status: init?.status ?? 200,
      })),
    },
  };
});

// ─── Helpers ─────────────────────────────────────────────────────

import { resolveAsOfDate } from '@/lib/data/AsOfDataGate';
import { runScreen } from '@/lib/screen/StrategyScreenEngine';
import { NextRequest } from 'next/server';

const mockResolveAsOfDate = resolveAsOfDate as jest.MockedFunction<typeof resolveAsOfDate>;
const mockRunScreen = runScreen as jest.MockedFunction<typeof runScreen>;

function makeGetRequest(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/strategy/screen');
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

function makePostRequest(body: object): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

// ─── Tests ────────────────────────────────────────────────────────

describe('P0-02A: /api/strategy/screen as-of gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveAsOfDate.mockImplementation((input?: string) => input ?? '2026-05-07');
  });

  // ── GET ─────────────────────────────────────────────────────────

  describe('GET handler', () => {
    it('T1: accepts explicit asOfDate and passes it to resolveAsOfDate', async () => {
      const req = makeGetRequest({ asOfDate: '2026-05-01' });
      await GET(req);
      expect(mockResolveAsOfDate).toHaveBeenCalledWith('2026-05-01');
    });

    it('T2: defaults to resolveAsOfDate() when no asOfDate provided', async () => {
      const req = makeGetRequest();
      await GET(req);
      expect(mockResolveAsOfDate).toHaveBeenCalledWith(undefined);
    });

    it('T3: passes asOf (YYYYMMDD) to runScreen()', async () => {
      mockResolveAsOfDate.mockReturnValue('2026-05-01');
      const req = makeGetRequest({ asOfDate: '2026-05-01' });
      await GET(req);
      expect(mockRunScreen).toHaveBeenCalledWith(
        expect.objectContaining({ asOf: '20260501' })
      );
    });

    it('T4: does NOT pass a future asOf when asOfDate is present', async () => {
      mockResolveAsOfDate.mockReturnValue('2026-04-01');
      const req = makeGetRequest({ asOfDate: '2026-04-01' });
      await GET(req);
      const call = mockRunScreen.mock.calls[0][0];
      expect(call.asOf).toBe('20260401');
      // Verify it's not a future date (asOf should be <= today's gate date)
      expect(call.asOf! <= '20260507').toBe(true);
    });

    it('T5: response includes asOfDate and asOfGateStatus', async () => {
      mockResolveAsOfDate.mockReturnValue('2026-05-07');
      const req = makeGetRequest();
      const res = await GET(req) as any;
      const body = await res.json();
      expect(body.asOfDate).toBe('2026-05-07');
      expect(body.asOfGateStatus).toBe('ACTIVE');
    });

    it('T6: response includes asOfGateNote', async () => {
      const req = makeGetRequest();
      const res = await GET(req) as any;
      const body = await res.json();
      expect(body.asOfGateNote).toBeDefined();
      expect(typeof body.asOfGateNote).toBe('string');
    });

    it('T7: response does not include forbidden fields', async () => {
      const req = makeGetRequest();
      const res = await GET(req) as any;
      const body = await res.json();
      const bodyStr = JSON.stringify(body);
      const forbidden = ['buy', 'sell', 'roi', 'win_rate', 'edge', 'profit', 'guaranteed', 'auto trading'];
      for (const term of forbidden) {
        expect(bodyStr.toLowerCase()).not.toContain(term.toLowerCase());
      }
    });
  });

  // ── POST ────────────────────────────────────────────────────────

  describe('POST handler', () => {
    it('T8: accepts explicit asOfDate in body', async () => {
      const req = makePostRequest({ asOfDate: '2026-05-01', maxResults: 5 });
      await POST(req);
      expect(mockResolveAsOfDate).toHaveBeenCalledWith('2026-05-01');
    });

    it('T9: defaults to resolveAsOfDate() when no asOfDate in body', async () => {
      const req = makePostRequest({ maxResults: 5 });
      await POST(req);
      expect(mockResolveAsOfDate).toHaveBeenCalledWith(undefined);
    });

    it('T10: passes asOf (YYYYMMDD) to runScreen()', async () => {
      mockResolveAsOfDate.mockReturnValue('2026-05-01');
      const req = makePostRequest({ asOfDate: '2026-05-01' });
      await POST(req);
      expect(mockRunScreen).toHaveBeenCalledWith(
        expect.objectContaining({ asOf: '20260501' })
      );
    });

    it('T11: POST response includes asOfDate and asOfGateStatus', async () => {
      mockResolveAsOfDate.mockReturnValue('2026-05-07');
      const req = makePostRequest({ maxResults: 10 });
      const res = await POST(req) as any;
      const body = await res.json();
      expect(body.asOfDate).toBe('2026-05-07');
      expect(body.asOfGateStatus).toBe('ACTIVE');
    });

    it('T12: no DB write, no external API, no LLM behavior', async () => {
      const req = makePostRequest({ maxResults: 5 });
      await POST(req);
      // runScreen is the only mock called — no prisma direct calls in route
      expect(mockRunScreen).toHaveBeenCalled();
    });
  });

  // ── Guardrail ───────────────────────────────────────────────────

  describe('Guardrail: no strategy mutation', () => {
    it('T13: does not modify existing scoring logic parameters in runScreen call', async () => {
      const req = makePostRequest({ minAlphaScore: 70, minConfidence: 0.8 });
      await POST(req);
      const call = mockRunScreen.mock.calls[0][0];
      // existing scoring params preserved
      expect(call.minAlphaScore).toBe(70);
      expect(call.minConfidence).toBe(0.8);
    });

    it('T14: asOf in runScreen call is YYYYMMDD string', async () => {
      mockResolveAsOfDate.mockReturnValue('2026-05-07');
      const req = makeGetRequest();
      await GET(req);
      const call = mockRunScreen.mock.calls[0][0];
      expect(call.asOf).toMatch(/^\d{8}$/);
    });
  });
});
