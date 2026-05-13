/**
 * Unit tests for runTrainingTaiwanQ1FinancialIngestCheck
 *
 * Exercises the three key branches of the runner:
 *   1. NOT_YET_ACTIVE  — scheduledFor before 2026-05-15
 *   2. NOT_AVAILABLE   — after 2026-05-15 but TWSE returns no Q1 rows
 *   3. ALREADY_COVERED — Q1 rows already exist in DB
 *
 * The INGESTED and INGEST_FAILED branches are integration-level
 * and covered by the syncService tests.
 */

// ─── Module mocks (must precede imports) ─────────────────────────────────────

jest.mock('../../prisma', () => ({
  prisma: {
    jobRunLog: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    financialReport: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../services/syncService', () => ({
  syncService: {
    syncFinancialReportsFromOpenApi: jest.fn(),
  },
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { prisma } from '../../prisma';
import { runTrainingTaiwanQ1FinancialIngestCheck } from '../autonomousJobRunners';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Utility: make the count mock resolve to a given number
function mockQ1Count(n: number): void {
  (mockPrisma.financialReport.count as jest.Mock).mockResolvedValue(n);
}

// Utility: stub findFirst to return null (no data in DB)
function mockFindFirstNull(): void {
  (mockPrisma.financialReport.findFirst as jest.Mock).mockResolvedValue(null);
}

// Utility: stub findFirst to return Q4 2025 as latest
function mockFindFirstQ4_2025(): void {
  (mockPrisma.financialReport.findFirst as jest.Mock).mockResolvedValue({
    year: 2025,
    quarter: 4,
  });
}

// Shared jobRunLog stubs that satisfy runJobWithOrchestration internals
function stubJobRunLog(): void {
  (mockPrisma.jobRunLog.findUnique as jest.Mock).mockResolvedValue(null);
  (mockPrisma.jobRunLog.create as jest.Mock).mockResolvedValue({ id: 1 });
  (mockPrisma.jobRunLog.update as jest.Mock).mockResolvedValue({ id: 1 });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('runTrainingTaiwanQ1FinancialIngestCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubJobRunLog();
  });

  describe('NOT_YET_ACTIVE — before 2026-05-15', () => {
    it('skips with status NOT_YET_ACTIVE when scheduledFor is before activation date', async () => {
      mockFindFirstQ4_2025();
      mockQ1Count(0);

      const result = await runTrainingTaiwanQ1FinancialIngestCheck({
        triggerSource: 'api',
        // Scheduled well before the activation window
        scheduledFor: new Date('2026-05-01T01:00:00.000Z'),
        runMode: 'live_run',
      });

      expect(result.outcome?.status).toBe('NOT_YET_ACTIVE');
      expect(result.outcome?.activeSince).toBe('2026-05-15');
      expect(result.outcome?.ingestedCount).toBe(0);
      expect(result.outcome?.blocker).not.toBeNull();
      // Should not reach the syncService at all
      const { syncService } = await import('../../services/syncService');
      expect(syncService.syncFinancialReportsFromOpenApi).not.toHaveBeenCalled();
    });
  });

  describe('ALREADY_COVERED — Q1 rows already present', () => {
    it('skips without calling syncService when Q1 rows exist', async () => {
      mockFindFirstQ4_2025();
      // 42 Q1 rows already in DB
      mockQ1Count(42);

      const result = await runTrainingTaiwanQ1FinancialIngestCheck({
        triggerSource: 'api',
        scheduledFor: new Date('2026-05-20T01:00:00.000Z'),
        runMode: 'live_run',
      });

      expect(result.outcome?.status).toBe('ALREADY_COVERED');
      expect(result.outcome?.q1RowsBeforeIngest).toBe(42);
      expect(result.outcome?.q1RowsAfterIngest).toBe(42);
      expect(result.outcome?.ingestedCount).toBe(0);
      expect(result.outcome?.nextCheckAt).toBeNull();
      expect(result.outcome?.blocker).toBeNull();
    });
  });

  describe('NOT_AVAILABLE — after activation, TWSE has no Q1 data', () => {
    it('skips gracefully and sets nextCheckAt when TWSE returns empty', async () => {
      mockFindFirstQ4_2025();
      // count for Q1 2026 — 0 rows before and after
      (mockPrisma.financialReport.count as jest.Mock)
        .mockResolvedValueOnce(0)  // before ingest check
        .mockResolvedValueOnce(0); // after syncFinancialReportsFromOpenApi

      const { syncService } = await import('../../services/syncService');
      (syncService.syncFinancialReportsFromOpenApi as jest.Mock).mockResolvedValue({
        success: true,
        count: 0,
        source: 'openapi',
        limitations: [],
      });

      const result = await runTrainingTaiwanQ1FinancialIngestCheck({
        triggerSource: 'api',
        scheduledFor: new Date('2026-05-20T01:00:00.000Z'),
        runMode: 'live_run',
      });

      expect(result.outcome?.status).toBe('NOT_AVAILABLE');
      expect(result.outcome?.ingestedCount).toBe(0);
      expect(result.outcome?.nextCheckAt).not.toBeNull();
      expect(result.outcome?.blocker).not.toBeNull();
      expect(syncService.syncFinancialReportsFromOpenApi).toHaveBeenCalledTimes(1);
    });
  });
});
