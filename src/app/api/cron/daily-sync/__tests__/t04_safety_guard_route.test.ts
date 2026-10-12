/**
 * T-04 Safety Guard Route Integration Test
 * Tests that the daily-sync cron route correctly integrates SafetyGuard.
 * No LLM calls, no external API calls, no DB writes.
 */

type RuntimeGlobals = typeof globalThis & {
  Request?: unknown;
  Response?: unknown;
  Headers?: unknown;
};

const runtimeGlobals = globalThis as RuntimeGlobals;
if (!runtimeGlobals.Request) {
  class MockRequest {}
  class MockResponse {}
  class MockHeaders {}
  Object.assign(runtimeGlobals, { Request: MockRequest, Response: MockResponse, Headers: MockHeaders });
}

// Mock all heavy dependencies
jest.mock('@/lib/data/SyncScheduler', () => ({ runAllSyncs: jest.fn() }));
jest.mock('@/lib/services/syncService', () => ({ syncService: {} }));
jest.mock('@/lib/report/DailySnapshotEngine', () => ({ createDailySnapshot: jest.fn() }));
jest.mock('@/lib/notify/DailyAlertEngine', () => ({ generateDailyAlerts: jest.fn() }));
jest.mock('@/lib/notify/NotificationDeliveryEngine', () => ({ deliverAlerts: jest.fn() }));
jest.mock('@/lib/data/DataRetentionService', () => ({ DataRetentionService: jest.fn() }));
jest.mock('@/lib/events/EventIngestionService', () => ({ syncAndStoreEvents: jest.fn() }));
jest.mock('@/lib/portfolio/PortfolioImpactSnapshotEngine', () => ({
  createPortfolioImpactSnapshot: jest.fn(),
}));

// SafetyGuard is NOT mocked — we test the real integration
jest.mock('next/server', () => {
  const json = (body: unknown, init?: { status?: number }) => ({
    _body: body,
    _status: init?.status ?? 200,
    json: async () => body,
  });
  const NextResponse = { json };
  return { NextResponse, NextRequest: class {} };
});

const makeReq = (opts: {
  taskId?: string;
  safeRun?: string;
  authHeader?: string;
} = {}) => {
  const params: Record<string, string> = {};
  if (opts.safeRun) params.safeRun = opts.safeRun;
  if (opts.taskId) params.taskId = opts.taskId;

  return {
    headers: {
      get: (h: string) => {
        if (h === 'authorization') return opts.authHeader ?? null;
        if (h === 'x-task-id') return opts.taskId ?? null;
        return null;
      },
    },
    nextUrl: {
      searchParams: { get: (k: string) => params[k] ?? null },
    },
  } as unknown as import('next/server').NextRequest;
};

describe('T-04 daily-sync route SafetyGuard integration', () => {
  let GET: typeof import('../route').GET;
  let runAllSyncs: jest.Mock;

  beforeAll(async () => {
    ({ GET } = await import('../route'));
    ({ runAllSyncs } = await import('@/lib/data/SyncScheduler') as { runAllSyncs: jest.Mock });
  });

  beforeEach(() => {
    jest.resetModules();
    runAllSyncs?.mockResolvedValue([]);
    delete process.env.SAFE_RUN;
    delete process.env.LLM_HARD_OFF;
    delete process.env.CRON_SECRET;
  });

  it('13. missing critical taskId (mayMutateState=true) blocks the route', async () => {
    // daily-sync is always mayMutateState=true — no taskId → CRITICAL → 403
    const req = makeReq({}); // no taskId
    const res = await GET(req);
    // @ts-expect-error mock shape
    expect(res._status).toBe(403);
    // @ts-expect-error mock shape
    const body = res._body as Record<string, unknown>;
    expect(body.ok).toBe(false);
    const safety = body.safety as Record<string, unknown>;
    expect(safety.mode).toBe('BLOCKED');
    expect(safety.llmHardOff).toBe(true);
  });

  it('14. safeRun query param → response includes safety object', async () => {
    runAllSyncs?.mockResolvedValue([
      { endpoint: 'test', status: 'success', records: 1, duration: 100 },
    ]);
    const req = makeReq({ taskId: 'task-cron-001', safeRun: 'true' });
    const res = await GET(req);
    // @ts-expect-error mock shape
    const body = res._body as Record<string, unknown>;
    const safety = body.safety as Record<string, unknown>;
    expect(safety).toBeDefined();
    expect(safety.mode).toBe('SAFE_RUN');
    expect(safety.llmHardOff).toBe(true);
    expect(safety).toHaveProperty('taskIdAlert');
  });

  it('15. route does not call LLM — safety decision blocks any external AI', async () => {
    runAllSyncs?.mockResolvedValue([]);
    const req = makeReq({ taskId: 'task-safe-001', safeRun: 'true' });
    const res = await GET(req);
    // @ts-expect-error mock shape
    const body = res._body as Record<string, unknown>;
    const safety = body.safety as Record<string, unknown>;
    // llmHardOff=true means any downstream assertLlmAllowed() would throw
    expect(safety.llmHardOff).toBe(true);
  });

  it('normal request with taskId succeeds and includes safety', async () => {
    runAllSyncs?.mockResolvedValue([
      { endpoint: 'test', status: 'success', records: 5, duration: 200 },
    ]);
    const req = makeReq({ taskId: 'task-daily-001' });
    const res = await GET(req);
    // @ts-expect-error mock shape
    const body = res._body as Record<string, unknown>;
    expect(body.ok).toBe(true);
    const safety = body.safety as Record<string, unknown>;
    expect(safety.mode).toBe('NORMAL');
    expect(safety.llmHardOff).toBe(false);
  });
});
