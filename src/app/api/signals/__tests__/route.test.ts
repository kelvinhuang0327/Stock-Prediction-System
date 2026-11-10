/** @jest-environment node */

export {};

const mockStockFindMany = jest.fn();
const mockQuoteFindMany = jest.fn();
const mockQuoteFindFirst = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();

jest.mock('next/server', () => ({
    NextResponse: { json: (body: unknown) => ({ json: async () => body }) },
}));

jest.mock('@/lib/prisma', () => ({
    prisma: {
        stock: { findMany: mockStockFindMany },
        stockQuote: { findMany: mockQuoteFindMany, findFirst: mockQuoteFindFirst },
    },
}));

jest.mock('@/lib/cache', () => ({
    apiCache: { get: mockCacheGet, set: mockCacheSet },
}));

function history(count: number, closeAt: (index: number) => number, volumeAt: (index: number) => number = () => 1_000) {
    return Array.from({ length: count }, (_, offset) => {
        const index = count - offset - 1;
        const close = closeAt(index);
        return {
            stockId: 'unused',
            date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
            close,
            high: close + 2,
            low: close - 2,
            volume: volumeAt(index),
        };
    });
}

function request(search = '') {
    return { nextUrl: new URL(`http://localhost/api/signals${search}`) } as never;
}

describe('GET /api/signals', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCacheGet.mockReturnValue(undefined);
        mockStockFindMany.mockResolvedValue([
            { id: 'FLAT', name: 'Flat Co.', industry: 'A' },
            { id: 'UP', name: 'Up Co.', industry: 'B' },
            { id: 'DOWN', name: 'Down Co.', industry: null },
            { id: 'SHORT', name: 'Short Co.', industry: 'C' },
        ]);
        const histories = new Map([
            ['FLAT', history(60, () => 100, () => 1_000)],
            ['UP', history(60, index => 100 + index, index => index >= 57 ? 8_000 : 1_000)],
            ['DOWN', history(60, index => 200 - index, index => index >= 57 ? 8_000 : 1_000)],
            ['SHORT', history(19, index => 20 + index)],
        ]);
        mockQuoteFindMany.mockImplementation(async (args: { where: { stockId: string } }) => histories.get(args.where.stockId) ?? []);
        mockQuoteFindFirst.mockResolvedValue({ date: '2026-02-28' });
    });

    it('calculates signals only for stocks with enough data and returns coverage and indicator details', async () => {
        const { GET } = await import('../route');
        const response = await GET(request());
        const body = await response.json();

        expect(body).toMatchObject({
            source: 'database（TWSE 歷史行情資料）',
            sample_size: 3,
            last_updated: '2026-02-28',
            coverage: { analyzed: 3, sufficient: 3, total: 4, minDays: 60 },
        });
        expect(body.coverage.limitations).toEqual(['僅 3 檔股票有 ≥60 天歷史資料']);
        expect(body.data.map((item: { symbol: string }) => item.symbol)).not.toContain('SHORT');
        expect(body.data.map((item: { symbol: string }) => item.symbol)).toEqual(expect.arrayContaining(['FLAT', 'UP', 'DOWN']));
        expect(body.data[0]).toEqual(expect.objectContaining({
            dataPoints: 60,
            indicators: expect.arrayContaining([
                expect.objectContaining({ name: 'MA20' }),
                expect.objectContaining({ name: 'RSI' }),
                expect.objectContaining({ name: 'MACD' }),
                expect.objectContaining({ name: 'BB' }),
                expect.objectContaining({ name: 'KD' }),
                expect.objectContaining({ name: '成交量' }),
            ]),
            watchPrice: expect.objectContaining({ price: expect.any(Number) }),
            stopLoss: expect.objectContaining({ price: expect.any(Number) }),
        }));
        expect(mockCacheSet).toHaveBeenCalledWith('signals:30:0', body, 300);
    });

    it('applies strength and result limits and caches by query parameters', async () => {
        const { GET } = await import('../route');
        const response = await GET(request('?limit=1&minStrength=101'));
        const body = await response.json();

        expect(body).toMatchObject({
            data: [],
            source: 'empty',
            sample_size: 0,
            coverage: { analyzed: 3, total: 4, minDays: 60 },
        });
        expect(mockCacheSet).toHaveBeenCalledWith('signals:1:101', body, 300);

        mockCacheGet.mockReturnValue({ source: 'cached', data: [] });
        const cachedResponse = await GET(request('?limit=1&minStrength=101'));
        await expect(cachedResponse.json()).resolves.toEqual({ source: 'cached', data: [] });
        expect(mockStockFindMany).toHaveBeenCalledTimes(1);
    });

    it('returns a stable error response when the database query fails', async () => {
        const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockStockFindMany.mockRejectedValue(new Error('db offline'));

        const { GET } = await import('../route');
        const response = await GET(request());

        await expect(response.json()).resolves.toMatchObject({
            data: [],
            source: 'error',
            sample_size: 0,
            coverage: { analyzed: 0, sufficient: 0, total: 0, minDays: 60, limitations: ['資料庫查詢失敗'] },
            last_updated: null,
        });
        expect(log).toHaveBeenCalledWith('Signals API error:', expect.any(Error));
    });
});
