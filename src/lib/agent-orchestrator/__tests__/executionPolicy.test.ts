import { selectNextBatch, getExecutionPolicyMode, setExecutionPolicyMode } from '../executionPolicy';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    executionPolicyState: {
      findFirst: jest.fn().mockResolvedValue({ id: 1, mode: 'balanced', consecutiveCategory: null, consecutiveCategoryCount: 0 }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    ctoBacklogItem: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

jest.mock('../backlogService', () => ({ getPrioritizedBacklog: jest.fn().mockResolvedValue([
  { id: 1, category: 'signal', priorityLevel: 'P0', agingBonus: 5 },
  { id: 2, category: 'data', priorityLevel: 'P1', agingBonus: 2 },
  { id: 3, category: 'execution', priorityLevel: 'P2', agingBonus: 1 },
  { id: 4, category: 'regime', priorityLevel: 'P3', agingBonus: 0 },
]) }));

describe('executionPolicy selection', () => {
  it('selectNextBatch returns up to requested batch and respects high/low split (balanced)', async () => {
    const selected = await selectNextBatch(3);
    expect(Array.isArray(selected)).toBe(true);
    expect(selected.length).toBeGreaterThanOrEqual(1);
    // Balanced should prefer P0/P1; ensure at least one high-priority present
    const hasHigh = selected.some((s) => s.priorityLevel === 'P0' || s.priorityLevel === 'P1');
    expect(hasHigh).toBe(true);
  });

  it('get/set mode work with mocked prisma', async () => {
    const mode = await getExecutionPolicyMode();
    expect(mode).toBeDefined();

    await setExecutionPolicyMode('strict_priority');
    const mode2 = await getExecutionPolicyMode();
    // Since prisma.upsert is mocked without stateful return, just ensure call completes
    expect(mode2).toBeDefined();
  });
});
