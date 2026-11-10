/** @jest-environment node */

export {};

const mockListComputedAlerts = jest.fn();
const mockListHistory = jest.fn();
const mockBuildHistorySummary = jest.fn();

jest.mock('@/lib/jobs/AutonomousAlertService', () => ({
  AutonomousAlertService: jest.fn().mockImplementation(() => ({
    listAlerts: mockListComputedAlerts,
  })),
}));

jest.mock('@/lib/jobs/JobAlertService', () => ({
  JobAlertService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/lib/jobs/JobAlertHistoryService', () => ({
  JobAlertHistoryService: jest.fn().mockImplementation(() => ({
    listHistory: mockListHistory,
    buildSummary: mockBuildHistorySummary,
  })),
}));

const detectedAt = new Date('2026-11-10T00:00:00.000Z');
const computedAlert = {
  jobName: 'daily_sync',
  severity: 'warning' as const,
  message: 'The daily sync has not completed.',
  detectedAt,
};

function request(query = ''): Request {
  return new Request(`http://localhost/api/autonomous/alerts${query ? `?${query}` : ''}`);
}

describe('GET /api/autonomous/alerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListComputedAlerts.mockResolvedValue({
      alerts: [computedAlert],
      limitations: ['computed source is delayed'],
      generatedAt: detectedAt,
      healthSummary: { unhealthy: 1 },
    });
    mockListHistory.mockResolvedValue([]);
    mockBuildHistorySummary.mockResolvedValue({ total: 0 });
  });

  it('parses supported filters and pagination, then falls back to computed alerts', async () => {
    const { GET } = await import('../route');
    const response = await GET(request(
      'jobName=%20daily_sync%20&severity=warning&status=all&onlyActive=true&limit=25&offset=5&sort=occurrenceCount&direction=asc',
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockListComputedAlerts).toHaveBeenCalledWith({
      jobName: 'daily_sync', severity: 'warning', status: 'all', onlyActive: true,
    }, expect.any(Date));
    expect(mockListHistory).toHaveBeenCalledWith({
      jobName: 'daily_sync', severity: 'warning', status: 'all', onlyActive: true,
      includeResolved: true, limit: 25, offset: 5, sortBy: 'occurrenceCount', sortDir: 'asc',
    });
    expect(body).toMatchObject({
      source: 'computed',
      alerts: [{
        id: -1, jobName: 'daily_sync', status: 'active', occurrenceCount: 1,
        detectedAt: detectedAt.toISOString(),
      }],
      summary: { total: 1, critical: 0, warning: 1, info: 0 },
      pagination: { limit: 25, offset: 5, returned: 1 },
      limitations: [
        'computed source is delayed',
        'No persisted job alerts yet; falling back to computed alerts.',
      ],
      healthSummary: { unhealthy: 1 },
    });
    expect(mockBuildHistorySummary).toHaveBeenCalledWith({ jobName: 'daily_sync', severity: 'warning' });
  });

  it.each([
    ['severity=info', 'info'],
    ['severity=critical', 'critical'],
    ['status=active', 'active'],
    ['status=resolved', 'resolved'],
    ['status=suppressed', 'suppressed'],
    ['sort=latest', 'latest'],
    ['sort=firstDetectedAt', 'firstDetectedAt'],
    ['onlyActive=false', false],
  ])('accepts supported query value %s', async (query, expected) => {
    const { GET } = await import('../route');
    await GET(request(query));

    const requestedFilter = mockListComputedAlerts.mock.calls[0][0];
    if (query.startsWith('severity=')) expect(requestedFilter.severity).toBe(expected);
    if (query.startsWith('status=')) expect(requestedFilter.status).toBe(expected);
    if (query.startsWith('onlyActive=')) expect(requestedFilter.onlyActive).toBe(expected);
    if (query.startsWith('sort=')) expect(mockListHistory.mock.calls[0][0].sortBy).toBe(expected);
    if (query === 'status=resolved') expect(mockListHistory.mock.calls[0][0].includeResolved).toBe(true);
  });

  it('uses persisted rows, explicit includeResolved, and defaults malformed values safely', async () => {
    const persistedAlert = {
      id: 7,
      jobName: 'daily_sync',
      severity: 'critical' as const,
      status: 'resolved' as const,
      firstDetectedAt: detectedAt,
      lastDetectedAt: detectedAt,
      occurrenceCount: 3,
    };
    mockListHistory.mockResolvedValue([persistedAlert]);

    const { GET } = await import('../route');
    const response = await GET(request(
      'jobName=%20&severity=unknown&status=unknown&onlyActive=maybe&includeResolved=false&limit=-4&offset=nope&sort=unknown&direction=up',
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockListComputedAlerts).toHaveBeenCalledWith({
      jobName: undefined, severity: undefined, status: undefined, onlyActive: undefined,
    }, expect.any(Date));
    expect(mockListHistory).toHaveBeenCalledWith({
      jobName: undefined, severity: undefined, status: undefined, onlyActive: undefined,
      includeResolved: false, limit: 200, offset: 0, sortBy: undefined, sortDir: 'desc',
    });
    expect(body).toMatchObject({
      source: 'persisted',
      alerts: [{
        ...persistedAlert,
        firstDetectedAt: detectedAt.toISOString(),
        lastDetectedAt: detectedAt.toISOString(),
      }],
      summary: { total: 1, critical: 1, warning: 0, info: 0 },
      limitations: ['computed source is delayed'],
    });
  });

  it('handles an empty computed result without optional limitation metadata', async () => {
    mockListComputedAlerts.mockResolvedValue({ alerts: [], generatedAt: detectedAt, healthSummary: null });

    const { GET } = await import('../route');
    const response = await GET(request('status=active'));
    const body = await response.json();

    expect(mockListHistory.mock.calls[0][0].includeResolved).toBe(false);
    expect(body).toMatchObject({
      source: 'computed',
      alerts: [],
      summary: { total: 0, critical: 0, warning: 0, info: 0 },
      limitations: ['No persisted job alerts yet; falling back to computed alerts.'],
    });
  });

  it('returns a 500 response when alert loading fails', async () => {
    mockListComputedAlerts.mockRejectedValue(new Error('service unavailable'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const { GET } = await import('../route');
      const response = await GET(request());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Failed to load autonomous alerts' });
      expect(mockListHistory).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
