import { computeAdaptivePolicy } from '../adaptivePolicy';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    ctoReviewRun: { findMany: jest.fn().mockResolvedValue([]) },
    ctoBacklogItem: { groupBy: jest.fn().mockResolvedValue([]) },
    adaptivePolicyState: { create: jest.fn().mockResolvedValue({}) },
  },
}));

describe('Adaptive Policy - computeAdaptivePolicy', () => {
  it('handles empty runs and persists an adaptivePolicyState', async () => {
    const result = await computeAdaptivePolicy();
    expect(result).toHaveProperty('runsAnalyzed', 0);
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.policyConfidence).toBeDefined();
  });
});
