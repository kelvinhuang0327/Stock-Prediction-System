/**
 * TWSE (Taiwan Stock Exchange) API Client
 * 臺灣證券交易所 OpenAPI 客戶端
 * 
 * Documentation: https://openapi.twse.com.tw/
 */

// Type definitions for TWSE API responses
export interface TWSEDailyStock {
    Date: string;       // 日期
    Code: string;       // 證券代號
    Name: string;       // 證券名稱
    TradeVolume: string; // 成交股數
    TradeValue: string;  // 成交金額
    OpeningPrice: string; // 開盤價
    HighestPrice: string; // 最高價
    LowestPrice: string;  // 最低價
    ClosingPrice: string; // 收盤價
    Change: string;       // 漲跌價差
    Transaction: string;  // 成交筆數
}

export interface TWSEPERatio {
    Date: string;
    Code: string;
    Name: string;
    PEratio: string;       // 本益比
    DividendYield: string; // 殖利率(%)
    PBratio: string;       // 股價淨值比
}

export interface TWSECompanyInfo {
    公司代號: string;
    公司名稱: string;
    公司簡稱: string;
    產業別: string;
    住址: string;
    董事長: string;
    總經理: string;
    發言人: string;
    成立日期: string;
    上市日期: string;
    實收資本額: string;
    已發行普通股數或TDR原股發行股數: string;
}

export interface TWSEMarketIndex {
    日期: string;
    指數: string;
    收盤指數: string;
    漲跌: string;
    漲跌點數: string;
    漲跌百分比: string;
}

export interface TWSERevenue {
    出表日期: string;
    資料年月: string;
    公司代號: string;
    公司名稱: string;
    產業別: string;
    "營業收入-當月營收": string;
    "營業收入-上月營收": string;
    "營業收入-去年當月營收": string;
    "營業收入-上月比較增減(%)": string;
    "營業收入-去年同月增減(%)": string;
    "累計營業收入-當月累計營收": string;
    "累計營業收入-去年累計營收": string;
    "累計營業收入-前期比較增減(%)": string;
    備註: string;
}

export interface TWSEFinancialReportSummary {
    出表日期: string;
    年度: string;
    季別: string;
    公司代號: string;
    公司名稱: string;
    產業別: string;
    "基本每股盈餘(元)": string;
    營業收入?: string;
    營業利益?: string;
    稅後淨利: string;
}

// Normalized data types for internal use
export interface StockQuote {
    code: string;
    name: string;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    tradeValue: number;
    change: number;
    transactions: number;
}

export interface StockMetrics {
    code: string;
    name: string;
    pe: number | null;
    dividendYield: number | null;
    pb: number | null;
}

export interface CompanyInfo {
    code: string;
    name: string;
    shortName: string;
    industry: string;
    address: string;
    chairman: string;
    ceo: string;
    listingDate: string;
    capital: number;
    shares: number;
}

export interface MarketIndex {
    name: string;
    value: number;
    change: number;
    changePercent: number;
}

interface LatestMarketSnapshot {
    date: string;
    quotes: StockQuote[];
    indices: MarketIndex[];
    source: 'openapi' | 'twse_website';
}

export interface MonthlyRevenueSummary {
    code: string;
    name: string;
    month: string;
    revenue: number;
    yoyGrowth: number;
    momGrowth: number;
}

export interface QuarterlyFinancialReportSummary {
    stockId: string;
    year: number;
    quarter: number;
    eps: number;
    netIncome: number;
    operatingIncome: number | null;
}

// API Base URL - using Next.js API route proxy to avoid CORS on client, direct URL on server
const isServer = typeof window === 'undefined';
const API_BASE = isServer ? 'https://openapi.twse.com.tw/v1' : '/api/twse';

// Helper to parse numeric strings from TWSE data
const parseNumber = (val: string | undefined): number => {
    if (!val || val === '--' || val === 'N/A' || val === '') return 0;
    const cleaned = val.replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};

const parseNullableNumber = (val: string | undefined): number | null => {
    if (!val || val === '--' || val === 'N/A' || val === '') return null;
    const cleaned = val.replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
};

const stripHtml = (val: string | undefined): string => {
    if (!val) return '';
    return val.replace(/<[^>]*>/g, '').trim();
};

const parseTwseDateToIso = (input: string | undefined): string | null => {
    if (!input) return null;
    const raw = input.trim();
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    if (/^\d{8}$/.test(raw)) {
        return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }

    if (/^\d{7}$/.test(raw)) {
        const year = Number(raw.slice(0, 3)) + 1911;
        return `${year}-${raw.slice(3, 5)}-${raw.slice(5, 7)}`;
    }

    const slashParts = raw.split('/');
    if (slashParts.length === 3) {
        const [yearText, month, day] = slashParts;
        const yearNum = Number(yearText);
        if (!Number.isFinite(yearNum)) return null;
        const year = yearText.length <= 3 ? yearNum + 1911 : yearNum;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
};

const isMarketDateStale = (dateIso: string | undefined, maxLagDays: number = 4): boolean => {
    if (!dateIso) return true;
    const dt = new Date(`${dateIso}T00:00:00+08:00`);
    if (Number.isNaN(dt.getTime())) return true;
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - dt.getTime()) / (24 * 60 * 60 * 1000));
    return diffDays > maxLagDays;
};

class TWSEApiClient {
    private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
    private cacheDuration = 5 * 60 * 1000; // 5 minutes cache

    private async fetchWithCache<T>(endpoint: string, cacheKey: string): Promise<T | null> {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.data as T;
        }

        try {
            const response = await fetch(`${API_BASE}${endpoint}`);
            if (!response.ok) {
                console.error(`TWSE API error: ${response.status}`);
                return null;
            }
            const data = await response.json();
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            console.error('TWSE API fetch error:', error);
            return null;
        }
    }

    private async fetchWebsiteDailyMarketSnapshot(dateYmd: string): Promise<LatestMarketSnapshot | null> {
        const cacheKey = `website_snapshot_${dateYmd}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.data as LatestMarketSnapshot;
        }

        const url = `https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=${dateYmd}&type=ALLBUT0999&response=json`;
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(20000),
            });
            if (!response.ok) return null;

            const json = await response.json() as {
                stat?: string;
                date?: string;
                tables?: Array<{ fields?: string[]; data?: string[][] }>;
            };
            if (json.stat !== 'OK' || !Array.isArray(json.tables)) return null;

            const marketDate = parseTwseDateToIso(json.date ?? dateYmd);
            if (!marketDate) return null;

            const quoteTable = json.tables.find((table) =>
                Array.isArray(table.fields) &&
                table.fields.includes('證券代號') &&
                table.fields.includes('收盤價')
            );
            const quotes: StockQuote[] = Array.isArray(quoteTable?.data)
                ? quoteTable!.data
                    .filter((row) => Array.isArray(row) && row.length >= 11)
                    .map((row) => {
                        const sign = stripHtml(row[9]);
                        const rawChange = Math.abs(parseNumber(row[10]));
                        const change = sign.includes('-') ? -rawChange : rawChange;
                        return {
                            code: row[0],
                            name: row[1],
                            date: marketDate,
                            volume: parseNumber(row[2]),
                            transactions: parseNumber(row[3]),
                            tradeValue: parseNumber(row[4]),
                            open: parseNumber(row[5]),
                            high: parseNumber(row[6]),
                            low: parseNumber(row[7]),
                            close: parseNumber(row[8]),
                            change,
                        };
                    })
                : [];

            const indexTables = json.tables.filter((table) =>
                Array.isArray(table.fields) &&
                table.fields.includes('收盤指數') &&
                table.fields.some((field) => field.includes('指數')) &&
                Array.isArray(table.data)
            );
            const indices: MarketIndex[] = indexTables.flatMap((table) =>
                (table.data ?? [])
                    .filter((row) => Array.isArray(row) && row.length >= 5)
                    .map((row) => {
                        const sign = stripHtml(row[2]);
                        const rawChange = Math.abs(parseNumber(row[3]));
                        const change = sign.includes('-') ? -rawChange : rawChange;
                        return {
                            name: row[0],
                            value: parseNumber(row[1]),
                            change,
                            changePercent: parseNumber(row[4]),
                        };
                    })
            );

            if (quotes.length === 0) return null;

            const snapshot: LatestMarketSnapshot = {
                date: marketDate,
                quotes,
                indices,
                source: 'twse_website',
            };
            this.cache.set(cacheKey, { data: snapshot, timestamp: Date.now() });
            return snapshot;
        } catch {
            return null;
        }
    }

    async getLatestMarketSnapshot(): Promise<LatestMarketSnapshot> {
        const openapiQuotes = await this.getDailyStocks();
        const openapiIndices = await this.getMarketIndices();
        const openapiDate = openapiQuotes[0]?.date;
        if (openapiQuotes.length > 0 && !isMarketDateStale(openapiDate)) {
            return {
                date: openapiDate,
                quotes: openapiQuotes,
                indices: openapiIndices,
                source: 'openapi',
            };
        }

        const today = new Date();
        for (let lag = 0; lag <= 10; lag += 1) {
            const d = new Date(today);
            d.setDate(today.getDate() - lag);
            const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
            const snapshot = await this.fetchWebsiteDailyMarketSnapshot(ymd);
            if (snapshot?.quotes.length) {
                return snapshot;
            }
        }

        return {
            date: openapiDate ?? '',
            quotes: openapiQuotes,
            indices: openapiIndices,
            source: 'openapi',
        };
    }

    /**
     * Get daily trading data for all listed stocks
     * 上市個股日成交資訊
     */
    async getDailyStocks(): Promise<StockQuote[]> {
        const data = await this.fetchWithCache<TWSEDailyStock[]>(
            '/exchangeReport/STOCK_DAY_ALL',
            'daily_stocks'
        );

        if (!data || !Array.isArray(data)) return [];

        return data.map(item => ({
            code: item.Code,
            name: item.Name,
            date: parseTwseDateToIso(item.Date) ?? item.Date,
            open: parseNumber(item.OpeningPrice),
            high: parseNumber(item.HighestPrice),
            low: parseNumber(item.LowestPrice),
            close: parseNumber(item.ClosingPrice),
            volume: parseNumber(item.TradeVolume),
            tradeValue: parseNumber(item.TradeValue),
            change: parseNumber(item.Change),
            transactions: parseNumber(item.Transaction),
        }));
    }

    /**
     * Get PE ratio, dividend yield, and PB ratio for all stocks
     * 本益比、殖利率及股價淨值比
     */
    async getStockMetrics(): Promise<StockMetrics[]> {
        const data = await this.fetchWithCache<TWSEPERatio[]>(
            '/exchangeReport/BWIBBU_ALL',
            'stock_metrics'
        );

        if (!data || !Array.isArray(data)) return [];

        return data.map(item => ({
            code: item.Code,
            name: item.Name,
            pe: parseNullableNumber(item.PEratio),
            dividendYield: parseNullableNumber(item.DividendYield),
            pb: parseNullableNumber(item.PBratio),
        }));
    }

    /**
     * Get company basic information
     * 上市公司基本資料
     */
    async getCompanyInfoList(): Promise<CompanyInfo[]> {
        const data = await this.fetchWithCache<TWSECompanyInfo[]>(
            '/opendata/t187ap03_L',
            'company_info'
        );

        if (!data || !Array.isArray(data)) return [];

        return data.map(item => ({
            code: item.公司代號,
            name: item.公司名稱,
            shortName: item.公司簡稱,
            industry: item.產業別,
            address: item.住址,
            chairman: item.董事長,
            ceo: item.總經理,
            listingDate: item.上市日期,
            capital: parseNumber(item.實收資本額),
            shares: parseNumber(item.已發行普通股數或TDR原股發行股數),
        }));
    }

    /**
     * Get market indices
     * 大盤統計資訊
     */
    async getMarketIndices(): Promise<MarketIndex[]> {
        const data = await this.fetchWithCache<TWSEMarketIndex[]>(
            '/exchangeReport/MI_INDEX',
            'market_indices'
        );

        if (!data || !Array.isArray(data)) return [];

        return data.map(item => ({
            name: item.指數,
            value: parseNumber(item.收盤指數),
            change: parseNumber(item.漲跌點數),
            changePercent: parseNumber(item.漲跌百分比),
        }));
    }

    /**
     * Get single stock quote by code
     */
    async getStockQuote(code: string): Promise<StockQuote | null> {
        const stocks = await this.getDailyStocks();
        return stocks.find(s => s.code === code) || null;
    }

    /**
     * Get single stock metrics by code
     */
    async getStockMetricsByCode(code: string): Promise<StockMetrics | null> {
        const metrics = await this.getStockMetrics();
        return metrics.find(m => m.code === code) || null;
    }

    /**
     * Get combined stock data with quote and metrics
     */
    async getFullStockData(code: string): Promise<(StockQuote & Partial<StockMetrics>) | null> {
        const [quote, metrics] = await Promise.all([
            this.getStockQuote(code),
            this.getStockMetricsByCode(code),
        ]);

        if (!quote) return null;

        return {
            ...quote,
            pe: metrics?.pe,
            dividendYield: metrics?.dividendYield,
            pb: metrics?.pb,
        };
    }

    /**
     * Search stocks by code or name
     */
    async searchStocks(query: string): Promise<StockQuote[]> {
        const stocks = await this.getDailyStocks();
        const q = query.toLowerCase();
        return stocks.filter(
            s => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
        ).slice(0, 20);
    }

    /**
     * Get top gainers
     */
    async getTopGainers(limit: number = 10): Promise<StockQuote[]> {
        const stocks = await this.getDailyStocks();
        return stocks
            .filter(s => s.close > 0)
            .sort((a, b) => {
                const aPercent = a.close > 0 ? (a.change / (a.close - a.change)) * 100 : 0;
                const bPercent = b.close > 0 ? (b.change / (b.close - b.change)) * 100 : 0;
                return bPercent - aPercent;
            })
            .slice(0, limit);
    }

    /**
     * Get top losers
     */
    async getTopLosers(limit: number = 10): Promise<StockQuote[]> {
        const stocks = await this.getDailyStocks();
        return stocks
            .filter(s => s.close > 0)
            .sort((a, b) => {
                const aPercent = a.close > 0 ? (a.change / (a.close - a.change)) * 100 : 0;
                const bPercent = b.close > 0 ? (b.change / (b.close - b.change)) * 100 : 0;
                return aPercent - bPercent;
            })
            .slice(0, limit);
    }

    /**
     * Get volume leaders
     */
    async getVolumeLeaders(limit: number = 10): Promise<StockQuote[]> {
        const stocks = await this.getDailyStocks();
        return stocks.sort((a, b) => b.volume - a.volume).slice(0, limit);
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
    }
    /**
     * Get monthly stock trading history
     * 個股日成交資訊 (From TWSE Website API, not OpenAPI)
     * @param code Stock code
     * @param year Year (e.g., 2023)
     * @param month Month (1-12)
     */
    async getMonthlyHistory(code: string, year: number, month: number): Promise<StockQuote[]> {
        const dateStr = `${year}${month.toString().padStart(2, '0')}01`;
        const cacheKey = `history_${code}_${dateStr}`;

        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.data as StockQuote[];
        }

        try {
            // Use TWSE official website API (RWD API acts as backend for their frontend)
            // https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=20240101&stockNo=2330&response=json
            // Note: This URL structure might change, but currently standard.
            // Using a CORS proxy if client-side, or direct if server-side.
            // Since we plan to call this from our API route (Server-side), direct fetch is fine.

            const url = `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=${dateStr}&stockNo=${code}&response=json`;
            console.log(`[TWSE API Debug] Fetching URL: ${url}`);
            console.log(`[TWSE API Debug] DateStr: ${dateStr}, Code: ${code}`);

            const response = await fetch(url);
            if (!response.ok) {
                console.error(`[TWSE API] Failed: ${response.status} ${response.statusText}`);
                throw new Error(`Fetch failed: ${response.status}`);
            }

            const json = await response.json();
            console.log(`[TWSE API] Response stat: ${json.stat}`);

            // Response format: { stat: "OK", date: "20240101", title: "...", fields: [...], data: [ ["113/01/02", "590,000", ...], ... ] }
            if (json.stat !== 'OK') {
                console.warn(`[TWSE API] History API returned clean stat: ${json.stat}`);
                return [];
            }

            // Map data to StockQuote
            // Fields: ["日期", "成交股數", "成交金額", "開盤價", "最高價", "最低價", "收盤價", "漲跌價差", "成交筆數"]
            // Note: Date is in ROC format (e.g. 113/01/02)
            const result: StockQuote[] = json.data.map((row: string[]) => {
                const rocDate = row[0];
                const parts = rocDate.split('/');
                const year = parseInt(parts[0]) + 1911;
                const date = `${year}-${parts[1]}-${parts[2]}`; // YYYY-MM-DD

                return {
                    code,
                    name: code, // Name not in this response
                    date,
                    volume: parseNumber(row[1]),
                    tradeValue: parseNumber(row[2]),
                    open: parseNumber(row[3]),
                    high: parseNumber(row[4]),
                    low: parseNumber(row[5]),
                    close: parseNumber(row[6]),
                    change: parseNumber(row[7]),
                    transactions: parseNumber(row[8]),
                };
            });

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;

        } catch (error) {
            console.error('TWSE History Fetch Error:', error);
            // Fallback: If fetch fails (e.g. rate limit), return empty
            return [];
        }
    }
    /**
     * Get historical data series for multiple months
     * Allows fetching past N months of data for technical analysis
     */
    async getHistorySeries(code: string, months: number = 3): Promise<StockQuote[]> {
        const today = new Date();
        const results: StockQuote[] = [];

        // Fetch sequentially to avoid rate limiting
        for (let i = 0; i < months; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthlyData = await this.getMonthlyHistory(code, d.getFullYear(), d.getMonth() + 1);
            results.push(...monthlyData);

            // Add a small delay between requests
            if (i < months - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        // Flatten and sort by date (oldest to newest)
        return results
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Get monthly revenue summary for all listed companies
     * 上市公司每月營業收入彙總表
     */
    async getMonthlyRevenueSummary(): Promise<MonthlyRevenueSummary[]> {
        const data = await this.fetchWithCache<TWSERevenue[]>(
            '/opendata/t187ap05_L',
            'revenue_summary'
        );

        if (!data || !Array.isArray(data)) return [];

        return data.map(item => ({
            code: item.公司代號,
            name: item.公司名稱,
            month: item.資料年月,
            revenue: parseNumber(item["營業收入-當月營收"]),
            yoyGrowth: parseNumber(item["營業收入-去年同月增減(%)"]),
            momGrowth: parseNumber(item["營業收入-上月比較增減(%)"])
        }));
    }

    /**
     * Get quarterly financial report summary for listed companies
     * 上市公司簡明綜合損益表（摘要）
     */
    async getQuarterlyFinancialReportsSummary(): Promise<QuarterlyFinancialReportSummary[]> {
        const data = await this.fetchWithCache<TWSEFinancialReportSummary[]>(
            '/opendata/t187ap14_L',
            'financial_report_summary'
        );

        if (!data || !Array.isArray(data)) return [];

        return data
            .map((item) => {
                const rawYear = parseNumber(item.年度);
                const year = rawYear < 1911 ? rawYear + 1911 : rawYear;
                const quarter = parseNumber(item.季別);
                const stockId = String(item.公司代號 ?? '').trim();
                const eps = parseNullableNumber(item['基本每股盈餘(元)']);
                const netIncome = parseNullableNumber(item.稅後淨利);
                if (!stockId || !year || !quarter || eps === null || netIncome === null) {
                    return null;
                }
                return {
                    stockId,
                    year,
                    quarter,
                    eps,
                    netIncome,
                    operatingIncome: parseNullableNumber(item.營業利益),
                };
            })
            .filter((item): item is QuarterlyFinancialReportSummary => item !== null);
    }
}

// Export singleton instance
export const twseApi = new TWSEApiClient();
