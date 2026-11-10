/** @jest-environment jsdom */

import { twseApi } from '../twseApi';

const dailyRows = [
    {
        Date: '20261110', Code: '2330', Name: '台積電', TradeVolume: '1,000', TradeValue: '100,000',
        OpeningPrice: '100', HighestPrice: '110', LowestPrice: '99', ClosingPrice: '108',
        Change: '8', Transaction: '500',
    },
    {
        Date: '115/11/10', Code: '2317', Name: '鴻海', TradeVolume: '2,000', TradeValue: '200,000',
        OpeningPrice: '--', HighestPrice: '105', LowestPrice: '98', ClosingPrice: '100',
        Change: '-5', Transaction: 'N/A',
    },
];

function response(body: unknown, ok = true): Response {
    return { ok, status: ok ? 200 : 503, statusText: ok ? 'OK' : 'Unavailable', json: async () => body } as Response;
}

describe('twseApi', () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
        twseApi.clearCache();
        fetchMock = jest.fn();
        global.fetch = fetchMock;
        jest.restoreAllMocks();
    });

    it('normalizes daily stock rows and caches the response', async () => {
        fetchMock.mockResolvedValue(response(dailyRows));

        const first = await twseApi.getDailyStocks();
        const second = await twseApi.getDailyStocks();

        expect(first).toEqual([
            expect.objectContaining({
                code: '2330', name: '台積電', date: '2026-11-10', open: 100, high: 110, low: 99,
                close: 108, volume: 1000, tradeValue: 100000, change: 8, transactions: 500,
            }),
            expect.objectContaining({
                code: '2317', date: '2026-11-10', open: 0, change: -5, transactions: 0,
            }),
        ]);
        expect(second).toEqual(first);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/api/twse/exchangeReport/STOCK_DAY_ALL');
    });

    it('clears cache and returns empty results for fetch, status, and shape failures', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        fetchMock.mockRejectedValueOnce(new Error('offline'));
        await expect(twseApi.getDailyStocks()).resolves.toEqual([]);

        fetchMock.mockResolvedValueOnce(response([], false));
        await expect(twseApi.getStockMetrics()).resolves.toEqual([]);

        fetchMock.mockResolvedValueOnce(response({ data: [] }));
        await expect(twseApi.getCompanyInfoList()).resolves.toEqual([]);

        fetchMock.mockResolvedValueOnce(response(dailyRows));
        await twseApi.getDailyStocks();
        twseApi.clearCache();
        fetchMock.mockResolvedValueOnce(response([]));
        await twseApi.getDailyStocks();

        expect(fetchMock).toHaveBeenCalledTimes(5);
        expect(consoleError).toHaveBeenCalled();
    });

    it('parses metrics, company information, market indices, and revenue summaries', async () => {
        fetchMock
            .mockResolvedValueOnce(response([
                { Code: '2330', Name: '台積電', PEratio: '20.5', DividendYield: '--', PBratio: '3.2' },
                { Code: '2317', Name: '鴻海', PEratio: 'N/A', DividendYield: '4.1', PBratio: 'bad' },
            ]))
            .mockResolvedValueOnce(response([{
                公司代號: '2330', 公司名稱: '台灣積體電路製造股份有限公司', 公司簡稱: '台積電',
                產業別: '半導體業', 住址: '新竹市', 董事長: '甲', 總經理: '乙', 發言人: '丙',
                成立日期: '1987', 上市日期: '1994', 實收資本額: '259,000',
                已發行普通股數或TDR原股發行股數: '25,900',
            }]))
            .mockResolvedValueOnce(response([
                { 日期: '115/11/10', 指數: '發行量加權股價指數', 收盤指數: '27,000', 漲跌: '+', 漲跌點數: '100', 漲跌百分比: '0.37' },
            ]))
            .mockResolvedValueOnce(response([{
                公司代號: '2330', 公司名稱: '台積電', 資料年月: '115/10',
                '營業收入-當月營收': '1,234', '營業收入-去年同月增減(%)': '8.5',
                '營業收入-上月比較增減(%)': '-2.1',
            }]));

        await expect(twseApi.getStockMetrics()).resolves.toEqual([
            { code: '2330', name: '台積電', pe: 20.5, dividendYield: null, pb: 3.2 },
            { code: '2317', name: '鴻海', pe: null, dividendYield: 4.1, pb: null },
        ]);
        await expect(twseApi.getCompanyInfoList()).resolves.toEqual([expect.objectContaining({
            code: '2330', shortName: '台積電', industry: '半導體業', capital: 259000, shares: 25900,
        })]);
        await expect(twseApi.getMarketIndices()).resolves.toEqual([
            { name: '發行量加權股價指數', value: 27000, change: 100, changePercent: 0.37 },
        ]);
        await expect(twseApi.getMonthlyRevenueSummary()).resolves.toEqual([
            { code: '2330', name: '台積電', month: '115/10', revenue: 1234, yoyGrowth: 8.5, momGrowth: -2.1 },
        ]);
    });

    it('combines quote and metrics and supports code/name search plus leader rankings', async () => {
        const metrics = [{ Code: '2330', Name: '台積電', PEratio: '20', DividendYield: '2', PBratio: '4' }];
        fetchMock.mockImplementation(async (url: string) => response(
            url.includes('BWIBBU_ALL') ? metrics : dailyRows.concat([
                { ...dailyRows[0], Code: '2454', Name: '聯發科', ClosingPrice: '90', Change: '-10', TradeVolume: '3,000' },
                { ...dailyRows[0], Code: '0000', Name: '指標', ClosingPrice: '0', Change: '0', TradeVolume: '5,000' },
            ]),
        ));

        await expect(twseApi.getStockQuote('missing')).resolves.toBeNull();
        await expect(twseApi.getStockMetricsByCode('missing')).resolves.toBeNull();
        await expect(twseApi.getFullStockData('2330')).resolves.toEqual(expect.objectContaining({
            code: '2330', pe: 20, dividendYield: 2, pb: 4,
        }));
        await expect(twseApi.getFullStockData('missing')).resolves.toBeNull();
        await expect(twseApi.searchStocks('台積')).resolves.toHaveLength(1);
        await expect(twseApi.searchStocks('2317')).resolves.toHaveLength(1);
        await expect(twseApi.getTopGainers(1)).resolves.toEqual([expect.objectContaining({ code: '2330' })]);
        await expect(twseApi.getTopLosers(1)).resolves.toEqual([expect.objectContaining({ code: '2454' })]);
        await expect(twseApi.getVolumeLeaders(1)).resolves.toEqual([expect.objectContaining({ code: '0000' })]);
    });

    it('maps valid quarterly reports and drops incomplete records', async () => {
        fetchMock.mockResolvedValue(response([
            { 公司代號: '2330', 年度: '115', 季別: '2', '基本每股盈餘(元)': '3.4', 稅後淨利: '12,000', 營業利益: '--' },
            { 公司代號: '', 年度: '115', 季別: '2', '基本每股盈餘(元)': '3.4', 稅後淨利: '12,000', 營業利益: '2' },
            { 公司代號: '2317', 年度: '2025', 季別: '4', '基本每股盈餘(元)': '--', 稅後淨利: '1', 營業利益: '2' },
        ]));

        await expect(twseApi.getQuarterlyFinancialReportsSummary()).resolves.toEqual([
            { stockId: '2330', year: 2026, quarter: 2, eps: 3.4, netIncome: 12000, operatingIncome: null },
        ]);
    });

    it('maps monthly history, caches it, handles non-OK responses, and sorts a series', async () => {
        const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const body = {
            stat: 'OK',
            data: [
                ['115/11/03', '1,000', '100,000', '100', '105', '99', '103', '+3', '500'],
                ['115/11/02', '2,000', '200,000', '98', '102', '97', '100', '+2', '600'],
            ],
        };
        fetchMock.mockResolvedValueOnce(response(body));

        const first = await twseApi.getMonthlyHistory('2330', 2026, 11);
        const cached = await twseApi.getMonthlyHistory('2330', 2026, 11);

        expect(first[0]).toEqual(expect.objectContaining({ code: '2330', date: '2026-11-03', volume: 1000, close: 103 }));
        expect(cached).toEqual(first);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        fetchMock.mockResolvedValueOnce(response({ stat: 'NO DATA', data: [] }));
        await expect(twseApi.getMonthlyHistory('2330', 2026, 10)).resolves.toEqual([]);
        fetchMock.mockResolvedValueOnce(response(body));
        const series = await twseApi.getHistorySeries('2330', 1);
        expect(series.map(row => row.date)).toEqual(['2026-11-02', '2026-11-03']);
        expect(consoleLog).toHaveBeenCalled();
    });

    it('returns a fresh OpenAPI snapshot before attempting the website fallback', async () => {
        const today = new Date().toISOString().slice(0, 10);
        jest.spyOn(twseApi, 'getDailyStocks').mockResolvedValue([
            { code: '2330', name: '台積電', date: today, open: 1, high: 1, low: 1, close: 1, volume: 1, tradeValue: 1, change: 0, transactions: 1 },
        ]);
        jest.spyOn(twseApi, 'getMarketIndices').mockResolvedValue([]);

        await expect(twseApi.getLatestMarketSnapshot()).resolves.toEqual(expect.objectContaining({ source: 'openapi', date: today }));
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('falls back to the TWSE website snapshot and preserves signed changes', async () => {
        jest.spyOn(twseApi, 'getDailyStocks').mockResolvedValue([]);
        jest.spyOn(twseApi, 'getMarketIndices').mockResolvedValue([]);
        fetchMock.mockResolvedValue(response({
            stat: 'OK', date: '115/11/10', tables: [
                {
                    fields: ['證券代號', '證券名稱', '成交股數', '成交筆數', '成交金額', '開盤價', '最高價', '最低價', '收盤價', '漲跌(+/-)', '漲跌價差'],
                    data: [['2330', '台積電', '1,000', '100', '100,000', '100', '105', '99', '103', '<span>-</span>', '1.5']],
                },
                {
                    fields: ['指數', '收盤指數', '漲跌(+/-)', '漲跌點數', '漲跌百分比'],
                    data: [['發行量加權股價指數', '27,000', '<span>+</span>', '100', '0.37']],
                },
            ],
        }));

        const snapshot = await twseApi.getLatestMarketSnapshot();

        expect(snapshot).toMatchObject({ date: '2026-11-10', source: 'twse_website' });
        expect(snapshot.quotes[0]).toEqual(expect.objectContaining({ code: '2330', close: 103, change: -1.5 }));
        expect(snapshot.indices[0]).toEqual(expect.objectContaining({ value: 27000, change: 100 }));
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
