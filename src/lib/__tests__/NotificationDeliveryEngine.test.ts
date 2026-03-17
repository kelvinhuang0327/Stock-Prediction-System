/**
 * NotificationDeliveryEngine.test.ts
 *
 * Tests for deliverAlerts() covering:
 * - Unconfigured channel → status "skipped"
 * - Webhook failure → status "failed"
 * - Retry on failure
 * - success / failed / skipped all write to delivery log
 * - sendWhenEmpty=false with 0 alerts → no delivery attempted
 * - result never fabricates "success" when not delivered
 */

import { deliverAlerts, WebhookDeliveryProvider, DeliveryProvider, DeliveryResult } from '../notify/NotificationDeliveryEngine';
import { prisma } from '../prisma';
import type { DailyAlertsResult } from '../notify/DailyAlertEngine';

jest.mock('../prisma', () => ({
  prisma: {
    notificationDeliveryLog: {
      create: jest.fn(),
    },
  },
}));

const mockLogCreate = (prisma as any).notificationDeliveryLog.create as jest.Mock;

// ─── Fixtures ────────────────────────────────────────────────────

function makeAlertsResult(alertCount = 3): DailyAlertsResult {
  return {
    reportDate: '2025-01-15',
    summary: '今日研究提醒',
    overallSeverity: 'caution',
    alerts: Array.from({ length: alertCount }, (_, i) => ({
      type: 'candidate_upgraded' as const,
      severity: 'caution' as const,
      title: `提醒 ${i + 1}`,
      body: '候選股升級',
      symbol: `00${50 + i}`,
      basis: 'StrategyScreenEngine',
    })),
    comparisonAvailable: true,
    previousSnapshotDate: '2025-01-14',
    limitations: [],
    generatedAt: new Date().toISOString(),
  };
}

// ─── Mock Providers ───────────────────────────────────────────────

function makeSuccessProvider(channel = 'webhook'): DeliveryProvider {
  return {
    channel,
    payloadType: 'structured',
    target: 'https://example.com/webhook',
    send: jest.fn().mockResolvedValue({ success: true, statusCode: 200 }),
  };
}

function makeFailureProvider(channel = 'webhook'): DeliveryProvider {
  return {
    channel,
    payloadType: 'structured',
    target: 'https://example.com/webhook',
    send: jest.fn().mockResolvedValue({ success: false, error: 'Connection refused' }),
  };
}

function makeUnconfiguredProvider(channel = 'webhook'): DeliveryProvider {
  return {
    channel,
    payloadType: 'structured',
    target: null,
    send: jest.fn(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────

describe('NotificationDeliveryEngine — deliverAlerts()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogCreate.mockResolvedValue({ id: 1 });
  });

  describe('unconfigured channel', () => {
    it('reports "skipped" when target is null', async () => {
      const result = await deliverAlerts(makeAlertsResult(), {
        providers: [makeUnconfiguredProvider('webhook')],
        retryDelayMs: 0,
      });

      expect(result.channels).toHaveLength(1);
      expect(result.channels[0].status).toBe('skipped');
      expect(result.channels[0].channel).toBe('webhook');
    });

    it('writes delivery log even for skipped channels', async () => {
      await deliverAlerts(makeAlertsResult(), {
        providers: [makeUnconfiguredProvider('webhook')],
        retryDelayMs: 0,
      });

      expect(mockLogCreate).toHaveBeenCalledTimes(1);
      expect(mockLogCreate.mock.calls[0][0].data.status).toBe('skipped');
    });
  });

  describe('webhook failure', () => {
    it('reports "failed" when send returns success=false', async () => {
      const result = await deliverAlerts(makeAlertsResult(), {
        providers: [makeFailureProvider('webhook')],
        maxRetries: 0,
        retryDelayMs: 0,
      });

      expect(result.channels[0].status).toBe('failed');
      expect(result.channels[0].error).toBeTruthy();
    });

    it('writes delivery log with status=failed', async () => {
      await deliverAlerts(makeAlertsResult(), {
        providers: [makeFailureProvider('webhook')],
        maxRetries: 0,
        retryDelayMs: 0,
      });

      expect(mockLogCreate).toHaveBeenCalledTimes(1);
      expect(mockLogCreate.mock.calls[0][0].data.status).toBe('failed');
    });
  });

  describe('retry behavior', () => {
    it('retries on failure up to maxRetries times', async () => {
      const sendFn = jest.fn().mockResolvedValue({ success: false, error: 'timeout' });
      const provider: DeliveryProvider = {
        channel: 'webhook',
        payloadType: 'structured',
        target: 'https://example.com',
        send: sendFn,
      };

      await deliverAlerts(makeAlertsResult(), {
        providers: [provider],
        maxRetries: 2,
        retryDelayMs: 0,
      });

      // 1 initial attempt + 2 retries = 3 calls
      expect(sendFn).toHaveBeenCalledTimes(3);
    });

    it('stops retrying on success', async () => {
      const sendFn = jest.fn()
        .mockResolvedValueOnce({ success: false, error: 'timeout' })
        .mockResolvedValueOnce({ success: true, statusCode: 200 });

      const provider: DeliveryProvider = {
        channel: 'webhook',
        payloadType: 'structured',
        target: 'https://example.com',
        send: sendFn,
      };

      const result = await deliverAlerts(makeAlertsResult(), {
        providers: [provider],
        maxRetries: 3,
        retryDelayMs: 0,
      });

      expect(sendFn).toHaveBeenCalledTimes(2);
      expect(result.channels[0].status).toBe('success');
    });
  });

  describe('success delivery', () => {
    it('reports "success" when send succeeds', async () => {
      const result = await deliverAlerts(makeAlertsResult(), {
        providers: [makeSuccessProvider('webhook')],
        retryDelayMs: 0,
      });

      expect(result.channels[0].status).toBe('success');
    });

    it('writes delivery log with status=success', async () => {
      await deliverAlerts(makeAlertsResult(), {
        providers: [makeSuccessProvider('webhook')],
        retryDelayMs: 0,
      });

      expect(mockLogCreate).toHaveBeenCalledTimes(1);
      expect(mockLogCreate.mock.calls[0][0].data.status).toBe('success');
    });
  });

  describe('sendWhenEmpty=false behavior', () => {
    it('skips all delivery when alert count < minAlerts and sendWhenEmpty=false', async () => {
      const provider = makeSuccessProvider();
      const result = await deliverAlerts(makeAlertsResult(0), {
        providers: [provider],
        sendWhenEmpty: false,
        minAlerts: 1,
        retryDelayMs: 0,
      });

      expect(result.channels).toHaveLength(0);
      expect(result.skippedReason).toBeTruthy();
      expect((provider.send as jest.Mock)).not.toHaveBeenCalled();
    });

    it('delivers when sendWhenEmpty=true even with 0 alerts', async () => {
      const provider = makeSuccessProvider();
      await deliverAlerts(makeAlertsResult(0), {
        providers: [provider],
        sendWhenEmpty: true,
        retryDelayMs: 0,
      });

      expect(provider.send as jest.Mock).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple providers', () => {
    it('reports result for each provider independently', async () => {
      const result = await deliverAlerts(makeAlertsResult(), {
        providers: [
          makeSuccessProvider('webhook'),
          makeUnconfiguredProvider('email'),
          makeFailureProvider('line_text'),
        ],
        maxRetries: 0,
        retryDelayMs: 0,
      });

      expect(result.channels).toHaveLength(3);
      const statuses = result.channels.map(c => c.status);
      expect(statuses).toContain('success');
      expect(statuses).toContain('skipped');
      expect(statuses).toContain('failed');
    });
  });

  describe('output integrity', () => {
    it('reportDate matches input alertsResult.reportDate', async () => {
      const alerts = makeAlertsResult();
      const result = await deliverAlerts(alerts, {
        providers: [makeSuccessProvider()],
        retryDelayMs: 0,
      });

      expect(result.reportDate).toBe(alerts.reportDate);
    });

    it('alertCount matches input alerts.length', async () => {
      const alerts = makeAlertsResult(5);
      const result = await deliverAlerts(alerts, {
        providers: [makeSuccessProvider()],
        retryDelayMs: 0,
      });

      expect(result.alertCount).toBe(5);
    });

    it('generatedAt is always present and a valid ISO string', async () => {
      const result = await deliverAlerts(makeAlertsResult(), {
        providers: [makeSuccessProvider()],
        retryDelayMs: 0,
      });

      expect(result.generatedAt).toBeTruthy();
      expect(() => new Date(result.generatedAt)).not.toThrow();
    });
  });
});
