import { prisma } from '../src/lib/prisma';

async function ingestFinancials() {
    console.log('--- Ingesting Mock Financial Data (Revenue & EPS) ---');

    const stocks = ['2330', '2454', '2317', '2603', '2881', '3231', '2382'];

    for (const stockId of stocks) {
        // 1. Monthly Revenue (Last 3 months)
        const revenues = [
            { year: 2025, month: 12, revenue: Math.random() * 50000 + 10000, yoyGrowth: Math.random() * 50 + 10 },
            { year: 2025, month: 11, revenue: Math.random() * 50000 + 10000, yoyGrowth: Math.random() * 40 + 5 },
            { year: 2025, month: 10, revenue: Math.random() * 50000 + 10000, yoyGrowth: Math.random() * 30 + 15 },
        ];

        for (const rev of revenues) {
            await (prisma as any).monthlyRevenue.upsert({
                where: { stockId_year_month: { stockId, year: rev.year, month: rev.month } },
                update: rev,
                create: { stockId, ...rev }
            });
        }

        // 2. Financial Reports (EPS)
        const reports = [
            { year: 2025, quarter: 3, eps: Math.random() * 10 + 2, netIncome: Math.random() * 20000 },
            { year: 2025, quarter: 2, eps: Math.random() * 8 + 1, netIncome: Math.random() * 15000 },
        ];

        for (const report of reports) {
            await (prisma as any).financialReport.upsert({
                where: { stockId_year_quarter: { stockId, year: report.year, quarter: report.quarter } },
                update: report,
                create: { stockId, ...report }
            });
        }

        console.log(`Updated ${stockId} financial data.`);
    }

    console.log('Financial Ingestion Complete.');
}

ingestFinancials().catch(console.error);
