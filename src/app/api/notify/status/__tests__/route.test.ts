/** @jest-environment node */

export {};

const mockFindDeliveryLogs = jest.fn();
const mockGetSmtpStatus = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: { notificationDeliveryLog: { findMany: mockFindDeliveryLogs } },
}));

jest.mock('@/lib/notify/EmailProvider', () => ({
  getSmtpConfigStatus: mockGetSmtpStatus,
}));

const ENV_KEYS = ['NOTIFY_WEBHOOK_URL', 'NOTIFY_EMAIL_TO', 'NOTIFY_LINE_TOKEN', 'NOTIFY_SEND_EMPTY'] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));

function clearNotificationEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function delivery(overrides: Record<string, unknown> = {}) {
  return {
    channel: 'webhook',
    status: 'failed',
    sentAt: new Date(Date.now() - 60 * 60 * 1000),
    alertCount: 3,
    retryCount: 1,
    errorMessage: 'temporary failure',
    reportDate: '2026-11-10',
    ...overrides,
  };
}

describe('GET /api/notify/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearNotificationEnv();
    mockGetSmtpStatus.mockReturnValue({ smtpConfigured: false });
    mockFindDeliveryLogs.mockResolvedValue([]);
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('masks configured targets and summarizes recent deliveries by channel', async () => {
    process.env.NOTIFY_WEBHOOK_URL = 'https://notifications.example.com/hook?token=private';
    process.env.NOTIFY_EMAIL_TO = 'alice@example.com';
    process.env.NOTIFY_LINE_TOKEN = 'secret-line-token';
    process.env.NOTIFY_SEND_EMPTY = 'true';
    mockGetSmtpStatus.mockReturnValue({
      smtpConfigured: true,
      smtpHost: 'smtp.example.com',
      smtpPort: 465,
      smtpSecure: true,
    });
    mockFindDeliveryLogs.mockResolvedValue([
      delivery(),
      delivery({
        channel: 'line_text', status: 'success', sentAt: new Date(Date.now() - 30 * 60 * 1000),
        errorMessage: null, reportDate: null,
      }),
      delivery({
        channel: 'email', status: 'skipped', sentAt: new Date(Date.now() - 20 * 60 * 1000),
        reportDate: null,
      }),
      delivery({
        channel: 'webhook', status: 'success', sentAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
        reportDate: null,
      }),
    ]);

    const { GET } = await import('../route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockFindDeliveryLogs).toHaveBeenCalledWith({ orderBy: { sentAt: 'desc' }, take: 50 });
    expect(body.channels).toEqual([
      expect.objectContaining({
        channel: 'webhook', configured: true, targetMasked: 'https://notification......',
        lastDelivery: expect.objectContaining({ status: 'failed', errorMessage: 'temporary failure' }),
      }),
      expect.objectContaining({
        channel: 'line_text', configured: true, targetMasked: 'configured (token hidden)',
        lastDelivery: expect.objectContaining({ status: 'success', errorMessage: null }),
      }),
      expect.objectContaining({
        channel: 'email', configured: true, targetMasked: 'a***@example.com', smtpHost: 'smtp.example.com',
        smtpPort: 465, smtpSecure: true, lastDelivery: expect.objectContaining({ status: 'skipped' }),
      }),
    ]);
    expect(JSON.stringify(body)).not.toContain('private');
    expect(JSON.stringify(body)).not.toContain('secret-line-token');
    expect(body.stats24h).toEqual({ total: 3, success: 1, failed: 1, skipped: 1 });
    expect(body.lastAlertDelivery).toMatchObject({ status: 'failed', reportDate: '2026-11-10', alertCount: 3 });
    expect(body.sendWhenEmpty).toBe(true);
  });

  it('reports missing email recipients and masks malformed targets without exposing credentials', async () => {
    process.env.NOTIFY_WEBHOOK_URL = 'not-a-valid-url-with-a-secret';
    process.env.NOTIFY_EMAIL_TO = 'malformed-address';
    process.env.NOTIFY_LINE_TOKEN = 'line-token';

    const { GET } = await import('../route');
    const response = await GET();
    const body = await response.json();

    expect(body.channels[0]).toMatchObject({
      configured: true,
      targetMasked: 'not-a-valid-url...',
    });
    expect(body.channels[1]).toMatchObject({ configured: true, targetMasked: 'configured (token hidden)' });
    expect(body.channels[2]).toMatchObject({
      configured: false,
      targetMasked: 'mal***',
      note: expect.stringContaining('SMTP 尚未配置'),
    });
    expect(JSON.stringify(body)).not.toContain('with-a-secret');
  });

  it('returns null targets for channels with no configuration', async () => {
    const { GET } = await import('../route');
    const response = await GET();
    const body = await response.json();

    expect(body.channels.map((channel: { configured: boolean; targetMasked: string | null }) => ({
      configured: channel.configured,
      targetMasked: channel.targetMasked,
    }))).toEqual([
      { configured: false, targetMasked: null },
      { configured: false, targetMasked: null },
      { configured: false, targetMasked: null },
    ]);
  });

  it('describes the missing recipient and handles a failed delivery-log query as empty history', async () => {
    process.env.NOTIFY_WEBHOOK_URL = 'https://short.io/private';
    mockFindDeliveryLogs.mockRejectedValue(new Error('database unavailable'));

    const { GET } = await import('../route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.channels[2]).toMatchObject({
      configured: false,
      targetMasked: null,
      note: '尚未設定收件人（NOTIFY_EMAIL_TO）',
    });
    expect(body.channels[0].targetMasked).toBe('https://short.io...');
    expect(body.stats24h).toEqual({ total: 0, success: 0, failed: 0, skipped: 0 });
    expect(body.channels.every((channel: { lastDelivery: unknown }) => channel.lastDelivery === null)).toBe(true);
    expect(body.lastAlertDelivery).toBeNull();
    expect(body.sendWhenEmpty).toBe(false);
  });

  it('returns a safe error response when SMTP configuration cannot be read', async () => {
    mockGetSmtpStatus.mockImplementation(() => { throw new Error('SMTP status unavailable'); });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const { GET } = await import('../route');
      const response = await GET();

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'SMTP status unavailable' });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('uses a generic message when the thrown value is not an Error', async () => {
    mockGetSmtpStatus.mockImplementation(() => { throw Object.create(null); });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const { GET } = await import('../route');
      const response = await GET();

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Unknown error' });
    } finally {
      errorSpy.mockRestore();
    }
  });
});
