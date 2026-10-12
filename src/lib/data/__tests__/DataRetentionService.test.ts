jest.mock('@/lib/prisma', () => ({
  prisma: {
    dailyMarketSnapshot: {
      count: jest.fn(async () => 0),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    dailyCandidateSnapshot: {
      count: jest.fn(async () => 0),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    dailyWatchlistSnapshot: {
      count: jest.fn(async () => 0),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    portfolioImpactSnapshot: {
      count: jest.fn(async () => 5),
      deleteMany: jest.fn(async () => ({ count: 5 })),
    },
    notificationDeliveryLog: {
      count: jest.fn(async () => 0),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { DataRetentionService } from '../DataRetentionService';

type MockPrisma = typeof prisma & {
  portfolioImpactSnapshot: { deleteMany: jest.Mock };
};

describe('DataRetentionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes portfolio impact snapshot in dryRun cleanup summary', async () => {
    const svc = new DataRetentionService({ dryRun: true });
    const summary = await svc.runAll();

    const table = summary.results.find((r) => r.table === 'PortfolioImpactSnapshot');
    expect(table).toBeDefined();
    expect(table?.scanned).toBe(5);
    expect(table?.deleted).toBe(0);
    expect(table?.dryRun).toBe(true);
    expect((prisma as MockPrisma).portfolioImpactSnapshot.deleteMany).not.toHaveBeenCalled();
  });
});
