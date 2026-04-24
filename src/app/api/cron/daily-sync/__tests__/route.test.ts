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

jest.mock('@/lib/data/SyncScheduler', () => ({
  runAllSyncs: jest.fn(),
}));
jest.mock('@/lib/services/syncService', () => ({
  syncService: {},
}));
jest.mock('@/lib/report/DailySnapshotEngine', () => ({
  createDailySnapshot: jest.fn(),
}));
jest.mock('@/lib/notify/DailyAlertEngine', () => ({
  generateDailyAlerts: jest.fn(),
}));
jest.mock('@/lib/notify/NotificationDeliveryEngine', () => ({
  deliverAlerts: jest.fn(),
}));
jest.mock('@/lib/data/DataRetentionService', () => ({
  DataRetentionService: jest.fn(),
}));
jest.mock('@/lib/events/EventIngestionService', () => ({
  syncAndStoreEvents: jest.fn(),
}));
jest.mock('@/lib/portfolio/PortfolioImpactSnapshotEngine', () => ({
  createPortfolioImpactSnapshot: jest.fn(),
}));

describe('/api/cron/daily-sync buildDailySyncJobs', () => {
  let buildDailySyncJobs: typeof import('../route').buildDailySyncJobs;

  beforeAll(async () => {
    ({ buildDailySyncJobs } = await import('../route'));
  });

  it('includes both portfolio snapshot jobs after daily snapshot', () => {
    const jobs = buildDailySyncJobs();
    const watchlistJob = jobs.find((j) => j.endpoint === 'portfolio_snapshot_watchlist');
    const candidatesJob = jobs.find((j) => j.endpoint === 'portfolio_snapshot_candidates');
    const dailySnapshotJob = jobs.find((j) => j.endpoint === 'daily_snapshot');

    expect(dailySnapshotJob).toBeDefined();
    expect(watchlistJob).toBeDefined();
    expect(candidatesJob).toBeDefined();
    expect(watchlistJob?.priority).toBe(8);
    expect(candidatesJob?.priority).toBe(8);
    expect(jobs.find((j) => j.endpoint === 'daily_alerts')?.priority).toBe(9);
    expect(jobs.find((j) => j.endpoint === 'daily_cleanup')?.priority).toBe(10);
  });
});
