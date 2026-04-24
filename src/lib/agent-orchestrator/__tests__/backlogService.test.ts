import { insertBacklogItem, batchInsertBacklogItems } from '../backlogService';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    ctoBacklogItem: {
      upsert: jest.fn().mockImplementation(async ({ create }) => ({ id: 123, ...create })),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
    },
  },
}));

const sampleInput = {
  findingId: 'find-1',
  source: 'test',
  severity: 'MEDIUM',
  impactScore: 50,
  urgency: 'ROUTINE',
  category: 'data',
};

describe('Backlog Service', () => {
  it('insertBacklogItem returns a record with priority fields', async () => {
    const row = await insertBacklogItem(sampleInput as any);
    expect(row).toHaveProperty('priorityScore');
    expect(row).toHaveProperty('priorityLevel');
    expect(row.findingId).toBe(sampleInput.findingId);
  });

  it('batchInsertBacklogItems creates multiple items and returns count', async () => {
    const count = await batchInsertBacklogItems([sampleInput as any, { ...sampleInput, findingId: 'find-2' }]);
    expect(count).toBe(2);
  });
});
