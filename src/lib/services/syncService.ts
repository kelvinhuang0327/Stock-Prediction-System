import { prisma } from '../prisma';
import { twseApi } from '../api/twseApi';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildMonthlyRevenueReleaseDatePayload } from '@/lib/onlineValidation/p29k/MonthlyRevenueReleaseDatePolicy';
import {
    upsertFinancialReports,
    type RawFinancialReportInput,
} from '@/lib/fundamental/FinancialReportSync';

export const syncService = {
    async syncFinancialReportsFromOpenApi() {
        const start = Date.now();
        try {
            const rows = await twseApi.getQuarterlyFinancialReportsSummary();
            if (rows.length === 0) {
                await this.logSync('FinancialReports', 'success', 0, Date.now() - start, 'openapi financial report summary empty');
                return {
                    success: true,
                    count: 0,
                    source: 'openapi',
                    limitations: ['TWSE 財報摘要端點目前回傳空資料。'],
                };
            }

            const result = await upsertFinancialReports(
                rows.map((row): RawFinancialReportInput => ({
                    stockId: row.stockId,
                    year: row.year,
                    quarter: row.quarter,
                    eps: row.eps,
                    netIncome: row.netIncome,
                    operatingIncome: row.operatingIncome,
                })),
            );
            await this.logSync('FinancialReports', 'success', result.count, Date.now() - start, 'source=openapi:t187ap14_L');
            return { success: true, count: result.count, source: 'openapi', limitations: result.limitations };
        } catch (error) {
            const message = String(error);
            await this.logSync('FinancialReports', 'failed', 0, Date.now() - start, message);
            return {
                success: false,
                count: 0,
                source: 'openapi',
                error,
                limitations: ['TWSE 財報摘要同步失敗。'],
            };
        }
    },

    async resolveFinancialReportFilePath(filePath?: string): Promise<string | null> {
        const candidates = [
            filePath,
            process.env.FINANCIAL_REPORTS_FILE,
            path.join(process.cwd(), 'data', 'financial_reports.json'),
            path.join(process.cwd(), 'data', 'fundamental', 'financial_reports.json'),
            path.join(process.cwd(), 'datasets', 'financial_reports.json'),
            path.join(process.cwd(), 'scripts', 'data', 'financial_reports.json'),
        ].filter((item): item is string => Boolean(item));

        for (const candidate of candidates) {
            try {
                await access(candidate);
                return candidate;
            } catch {
                // Try next candidate.
            }
        }

        return null;
    },

    async logSync(endpoint: string, status: 'success' | 'failed', records: number, duration: number, error?: string) {
        try {
            await prisma.syncLog.create({
                data: {
                    endpoint,
                    status,
                    records,
                    duration,
                    error,
                },
            });
        } catch (e) {
            console.error('Failed to log sync:', e);
        }
    },

    async syncBasicInfo() {
        const start = Date.now();
        try {
            const companies = await twseApi.getCompanyInfoList();
            let count = 0;

            for (const company of companies) {
                // Handle potentially missing dates or format them if needed, keeping it simple for now
                await prisma.stock.upsert({
                    where: { id: company.code },
                    update: {
                        name: company.name,
                        shortName: company.shortName,
                        industry: company.industry,
                        shares: company.shares,
                        capital: company.capital,
                        listingDate: company.listingDate,
                    },
                    create: {
                        id: company.code,
                        name: company.name,
                        shortName: company.shortName,
                        industry: company.industry,
                        shares: company.shares || 0,
                        capital: company.capital || 0,
                        listingDate: company.listingDate,
                    },
                });
                count++;
            }

            await this.logSync('BasicInfo', 'success', count, Date.now() - start);
            return { success: true, count };
        } catch (error) {
            await this.logSync('BasicInfo', 'failed', 0, Date.now() - start, String(error));
            console.error('Basic Info Sync Failed:', error);
            return { success: false, error };
        }
    },

    async syncDailyQuotes() {
        const start = Date.now();
        try {
            const snapshot = await twseApi.getLatestMarketSnapshot();
            const quotes = snapshot.quotes;
            if (!quotes.length) throw new Error('No quotes fetched');

            let count = 0;

            // Ensure stocks exist first (optional, but good for referential integrity if enforced)
            // For now, we assume basic info sync runs first or we use `connectOrCreate` if we want strictness.
            // To simplify, we'll try to create the stock if it doesn't exist with minimal info.

            for (const quote of quotes) {
                // Use transaction or simple upsert. For mass data, createMany is better but SQLite doesn't support skipDuplicates well with Prisma in all versions easily.
                // We will loop for now as 1000 records is manageable.

                // Ensure stock exists
                await prisma.stock.upsert({
                    where: { id: quote.code },
                    update: {},
                    create: {
                        id: quote.code,
                        name: quote.name,
                    }
                });

                await prisma.stockQuote.upsert({
                    where: {
                        stockId_date: {
                            stockId: quote.code,
                            date: quote.date,
                        },
                    },
                    update: {
                        open: quote.open,
                        high: quote.high,
                        low: quote.low,
                        close: quote.close,
                        volume: quote.volume,
                        tradeValue: quote.tradeValue,
                        change: quote.change,
                        transactions: quote.transactions,
                    },
                    create: {
                        stockId: quote.code,
                        date: quote.date,
                        open: quote.open,
                        high: quote.high,
                        low: quote.low,
                        close: quote.close,
                        volume: quote.volume,
                        tradeValue: quote.tradeValue,
                        change: quote.change,
                        transactions: quote.transactions,
                    },
                });
                count++;
            }

            await this.logSync('DailyQuotes', 'success', count, Date.now() - start, `source=${snapshot.source};date=${snapshot.date}`);
            return { success: true, count, source: snapshot.source, date: snapshot.date };
        } catch (error) {
            await this.logSync('DailyQuotes', 'failed', 0, Date.now() - start, String(error));
            console.error('Daily Quotes Sync Failed:', error);
            return { success: false, error };
        }
    },

    async syncMetrics() {
        const start = Date.now();
        try {
            const metrics = await twseApi.getStockMetrics();
            // Need date for metrics. API results don't always have date field in return, so we might check if endpoint gives date.
            // BWIBBU_ALL usually is snapshot for "today" or latest trading day.
            // We will use current date formatted or derive from API response if possible.
            // twseApi doesn't seem to pass date for metrics currently.
            // Let's assume today's date for storage, or ideally fetch date from syncDailyQuotes first to get "market date".

            // Hack: fetch one quote to get the market date
            const snapshot = await twseApi.getLatestMarketSnapshot();
            const marketDate = snapshot.date || new Date().toISOString().split('T')[0];

            let count = 0;
            for (const item of metrics) {
                // Ensure stock exists
                await prisma.stock.upsert({
                    where: { id: item.code },
                    update: {},
                    create: {
                        id: item.code,
                        name: item.name,
                    }
                });

                await prisma.stockMetrics.upsert({
                    where: {
                        stockId_date: {
                            stockId: item.code,
                            date: marketDate,
                        },
                    },
                    update: {
                        pe: item.pe,
                        pb: item.pb,
                        dividendYield: item.dividendYield,
                    },
                    create: {
                        stockId: item.code,
                        date: marketDate,
                        pe: item.pe,
                        pb: item.pb,
                        dividendYield: item.dividendYield,
                    },
                });
                count++;
            }

            await this.logSync('StockMetrics', 'success', count, Date.now() - start, `date=${marketDate}`);
            return { success: true, count, date: marketDate };
        } catch (error) {
            await this.logSync('StockMetrics', 'failed', 0, Date.now() - start, String(error));
            console.error('Stock Metrics Sync Failed:', error);
            return { success: false, error };
        }
    },

    async syncMarketIndices() {
        const start = Date.now();
        try {
            const snapshot = await twseApi.getLatestMarketSnapshot();
            const indices = snapshot.indices;
            const marketDate = snapshot.date;

            if (!marketDate) throw new Error("Could not determine market date");

            let count = 0;
            for (const index of indices) {
                await prisma.marketIndex.upsert({
                    where: {
                        name_date: {
                            name: index.name,
                            date: marketDate,
                        },
                    },
                    update: {
                        value: index.value,
                        change: index.change,
                        changePercent: index.changePercent,
                    },
                    create: {
                        name: index.name,
                        date: marketDate,
                        value: index.value,
                        change: index.change,
                        changePercent: index.changePercent,
                    },
                });
                count++;
            }

            await this.logSync('MarketIndices', 'success', count, Date.now() - start, `source=${snapshot.source};date=${marketDate}`);
            return { success: true, count, source: snapshot.source, date: marketDate };
        } catch (error) {
            await this.logSync('MarketIndices', 'failed', 0, Date.now() - start, String(error));
            console.error('Market Index Sync Failed:', error);
            return { success: false, error };
        }
    },

    async syncRealRevenue() {
        const start = Date.now();
        console.log('Syncing real monthly revenue data...');
        try {
            const revenues = await twseApi.getMonthlyRevenueSummary();
            let count = 0;

            for (const rev of revenues) {
                const year = parseInt(rev.month.slice(0, 3)) + 1911;
                const month = parseInt(rev.month.slice(3));
                // P29K: Compute inferred releaseDate (INFERRED_NEXT_MONTH_10TH).
                // TWSE getMonthlyRevenueSummary() never provides an explicit releaseDate.
                // Taiwan statutory rule: monthly revenue released by 10th of following month.
                const releaseDatePayload = buildMonthlyRevenueReleaseDatePayload(year, month);

                await prisma.monthlyRevenue.upsert({
                    where: {
                        stockId_year_month: {
                            stockId: rev.code,
                            year,
                            month
                        }
                    },
                    update: {
                        revenue: rev.revenue,
                        yoyGrowth: rev.yoyGrowth,
                        momGrowth: rev.momGrowth,
                        releaseDate: releaseDatePayload.releaseDate,
                        releaseDateSource: releaseDatePayload.releaseDateSource,
                        releaseDateConfidence: releaseDatePayload.releaseDateConfidence,
                    },
                    create: {
                        stockId: rev.code,
                        year,
                        month,
                        revenue: rev.revenue,
                        yoyGrowth: rev.yoyGrowth,
                        momGrowth: rev.momGrowth,
                        releaseDate: releaseDatePayload.releaseDate,
                        releaseDateSource: releaseDatePayload.releaseDateSource,
                        releaseDateConfidence: releaseDatePayload.releaseDateConfidence,
                    }
                });
                count++;
            }

            await this.logSync('RealRevenue', 'success', count, Date.now() - start);
            return { success: true, count };
        } catch (error) {
            await this.logSync('RealRevenue', 'failed', 0, Date.now() - start, String(error));
            console.error('Real Revenue Sync Failed:', error);
            return { success: false, error };
        }
    },

    async syncFinancialReportsFromLocalFile(filePath?: string) {
        const start = Date.now();
        const targetPath = await this.resolveFinancialReportFilePath(filePath);
        if (!targetPath) {
            await this.logSync('FinancialReports', 'success', 0, Date.now() - start, 'local financial report dataset not found; fallback to openapi');
            return this.syncFinancialReportsFromOpenApi();
        }

        try {
            const raw = await readFile(targetPath, 'utf8');
            const parsed = JSON.parse(raw);
            const rows = Array.isArray(parsed)
                ? parsed as RawFinancialReportInput[]
                : Array.isArray(parsed?.reports)
                    ? parsed.reports as RawFinancialReportInput[]
                    : [];

            if (rows.length === 0) {
                await this.logSync('FinancialReports', 'success', 0, Date.now() - start, 'financial report dataset empty; fallback to openapi');
                return this.syncFinancialReportsFromOpenApi();
            }

            const result = await upsertFinancialReports(rows);
            await this.logSync('FinancialReports', 'success', result.count, Date.now() - start, `source=${targetPath}`);
            return { success: true, count: result.count, source: 'local_file', limitations: result.limitations };
        } catch (error) {
            const message = String(error);
            if (message.includes('ENOENT')) {
                await this.logSync('FinancialReports', 'success', 0, Date.now() - start, 'local financial report dataset not found; fallback to openapi');
                return this.syncFinancialReportsFromOpenApi();
            }

            await this.logSync('FinancialReports', 'failed', 0, Date.now() - start, message);
            console.error('Financial Reports Sync Failed:', error);
            return { success: false, count: 0, source: 'local_file', error, limitations: ['financial report 同步失敗。'] };
        }
    },

    /**
     * syncInstitutionalChip — 同步單日三大法人買賣超
     *
     * 資料來源：TWSE T86 (https://www.twse.com.tw/rwd/zh/fund/T86)
     * 欄位對應：foreignBuy = 外資淨買賣超, trustBuy = 投信淨買賣超,
     *           dealerBuy = 自營商買賣超合計, totalBuy = 三大法人買賣超合計
     *
     * 注意：若非交易日則 API 回傳空資料，此為正常行為。
     */
    async syncInstitutionalChip(dateStr?: string): Promise<{ success: boolean; count: number; date: string; error?: unknown }> {
        const start = Date.now();
        // Default to today in YYYYMMDD
        const targetDate = dateStr ?? new Date().toISOString().replace(/-/g, '').slice(0, 8);
        const isoDate = `${targetDate.slice(0, 4)}-${targetDate.slice(4, 6)}-${targetDate.slice(6, 8)}`;

        try {
            const url = `https://www.twse.com.tw/rwd/zh/fund/T86?date=${targetDate}&selectType=ALL&response=json`;
            const resp = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(20000),
            });

            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

            const data = await resp.json() as {
                stat?: string;
                data?: string[][];
            };
            if (data?.stat !== 'OK' || !Array.isArray(data?.data) || data.data.length === 0) {
                // Non-trading day or no data — not an error
                await this.logSync('institutional_chip', 'success', 0, Date.now() - start,
                    `Non-trading day or no data for ${targetDate}`);
                return { success: true, count: 0, date: isoDate };
            }

            // Collect valid stock IDs to avoid FK violations
            const validStocks = await prisma.stock.findMany({ select: { id: true } });
            const validIds = new Set(validStocks.map(s => s.id));

            let count = 0;
            const upserts: Promise<unknown>[] = [];

            for (const row of data.data) {
                try {
                    // T86 columns: [證券代號, 名稱, 外資買進, 外資賣出, 外資淨買賣超,
                    //               投信買進, 投信賣出, 投信淨買賣超, 自營商買賣超, 三大法人買賣超]
                    const stockId = String(row[0]).trim();
                    if (!validIds.has(stockId)) continue;

                    const clean = (s: string) =>
                        parseFloat(String(s).replace(/,/g, '').replace(/--/g, '0')) || 0;

                    const foreignBuy = clean(row[4]);  // 外資淨買賣超
                    const trustBuy   = clean(row[7]);  // 投信淨買賣超
                    const dealerBuy  = clean(row[8]);  // 自營商買賣超
                    const totalBuy   = clean(row[9]);  // 三大法人買賣超

                    upserts.push(
                        prisma.institutionalChip.upsert({
                            where: { stockId_date: { stockId, date: isoDate } },
                            update: { foreignBuy, trustBuy, dealerBuy, totalBuy },
                            create: { stockId, date: isoDate, foreignBuy, trustBuy, dealerBuy, totalBuy },
                        }).then(() => { count++; })
                    );
                } catch { /* skip malformed row */ }
            }

            // Run in batches of 50 to avoid overwhelming SQLite
            const batchSize = 50;
            for (let i = 0; i < upserts.length; i += batchSize) {
                await Promise.all(upserts.slice(i, i + batchSize));
            }

            await this.logSync('institutional_chip', 'success', count, Date.now() - start);
            console.log(`[syncService] institutional_chip ${isoDate}: ${count} records`);
            return { success: true, count, date: isoDate };
        } catch (error) {
            await this.logSync('institutional_chip', 'failed', 0, Date.now() - start, String(error));
            console.error('[syncService] institutional_chip failed:', error);
            return { success: false, count: 0, date: isoDate, error };
        }
    },

    async syncAll() {
        console.log('Starting full sync...');
        const basicInfo = await this.syncBasicInfo();
        const dailyQuotes = await this.syncDailyQuotes();
        const metrics = await this.syncMetrics();
        const indices = await this.syncMarketIndices();
        const realRevenue = await this.syncRealRevenue();
        const financialReports = await this.syncFinancialReportsFromLocalFile();
        const chip = await this.syncInstitutionalChip();

        return {
            basicInfo,
            dailyQuotes,
            metrics,
            indices,
            realRevenue,
            financialReports,
            chip,
        };
    },

    async syncStockHistory(symbol: string, months: number = 3) {
        const start = Date.now();
        try {
            const history = await twseApi.getHistorySeries(symbol, months);
            if (!history || !history.length) return { success: true, count: 0 };

            let count = 0;
            for (const quote of history) {
                await prisma.stockQuote.upsert({
                    where: {
                        stockId_date: {
                            stockId: symbol,
                            date: quote.date,
                        },
                    },
                    update: {
                        open: quote.open || 0,
                        high: quote.high || 0,
                        low: quote.low || 0,
                        close: quote.close || 0,
                        volume: quote.volume || 0,
                        tradeValue: quote.tradeValue || 0,
                        change: quote.change || 0,
                        transactions: quote.transactions || 0,
                    },
                    create: {
                        stockId: symbol,
                        date: quote.date,
                        open: quote.open || 0,
                        high: quote.high || 0,
                        low: quote.low || 0,
                        close: quote.close || 0,
                        volume: quote.volume || 0,
                        tradeValue: quote.tradeValue || 0,
                        change: quote.change || 0,
                        transactions: quote.transactions || 0,
                    },
                });
                count++;
            }

            await this.logSync(`History_${symbol}`, 'success', count, Date.now() - start);
            return { success: true, count };
        } catch (error) {
            await this.logSync(`History_${symbol}`, 'failed', 0, Date.now() - start, String(error));
            return { success: false, error };
        }
    }
};
