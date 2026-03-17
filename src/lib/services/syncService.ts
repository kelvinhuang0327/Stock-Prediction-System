import { prisma } from '../prisma';
import { twseApi, StockQuote as TWSEQuote } from '../api/twseApi';

export const syncService = {
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
            const quotes = await twseApi.getDailyStocks();
            if (!quotes.length) throw new Error('No quotes fetched');

            const dateStr = quotes[0].date; // Assuming all quotes are from same day
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

            await this.logSync('DailyQuotes', 'success', count, Date.now() - start);
            return { success: true, count };
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
            const quotes = await twseApi.getDailyStocks();
            const marketDate = quotes[0]?.date || new Date().toISOString().split('T')[0].replace(/-/g, '');

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

            await this.logSync('StockMetrics', 'success', count, Date.now() - start);
            return { success: true, count };
        } catch (error) {
            await this.logSync('StockMetrics', 'failed', 0, Date.now() - start, String(error));
            console.error('Stock Metrics Sync Failed:', error);
            return { success: false, error };
        }
    },

    async syncMarketIndices() {
        const start = Date.now();
        try {
            const indices = await twseApi.getMarketIndices();
            // Same issue with date, usually MI_INDEX result includes date? 
            // twseApi maps it. Let's assume we need to handle date. 
            // indices from twseApi.ts model: MarketIndex { name, value, change, changePercent } - no date!
            // I should update twseApi.ts or just invoke getDailyStocks to get market date.

            const quotes = await twseApi.getDailyStocks();
            const marketDate = quotes[0]?.date;

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

            await this.logSync('MarketIndices', 'success', count, Date.now() - start);
            return { success: true, count };
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

                await (prisma as any).monthlyRevenue.upsert({
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
                        momGrowth: rev.momGrowth
                    },
                    create: {
                        stockId: rev.code,
                        year,
                        month,
                        revenue: rev.revenue,
                        yoyGrowth: rev.yoyGrowth,
                        momGrowth: rev.momGrowth
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

    async syncAll() {
        console.log('Starting full sync...');
        const basicInfo = await this.syncBasicInfo();
        const dailyQuotes = await this.syncDailyQuotes();
        const metrics = await this.syncMetrics();
        const indices = await this.syncMarketIndices();
        const realRevenue = await this.syncRealRevenue();

        return {
            basicInfo,
            dailyQuotes,
            metrics,
            indices,
            realRevenue,
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
