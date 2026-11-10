jest.mock('../prisma', () => ({
  prisma: {
    stock: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../prisma';
import { stockService } from '../stockService';

const findMany = prisma.stock.findMany as jest.Mock;

describe('StockService sector lookup', () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it('resolves encoded sector names to the database industry', async () => {
    findMany.mockResolvedValue([
      {
        id: '2330',
        name: '台積電',
        industry: '半導體',
        quotes: [{ close: 100, change: 5, volume: 100 }],
        metrics: [{ pe: 20, dividendYield: 1 }],
      },
    ]);

    await expect(stockService.getStocksBySector(encodeURIComponent('半導體'))).resolves.toMatchObject([
      { symbol: '2330', industry: '半導體', price: 100 },
    ]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { industry: '半導體' },
    }));
  });

  it('matches static fallback stocks when a sector name is used', async () => {
    findMany.mockResolvedValue([]);

    await expect(stockService.getStocksBySector('半導體')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ symbol: '2330' })]),
    );
  });
});
