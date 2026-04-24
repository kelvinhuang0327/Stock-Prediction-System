import { upsertFinancialReports, type RawFinancialReportInput } from '../src/lib/fundamental/FinancialReportSync';
import { prisma } from '../src/lib/prisma';

async function ingestFinancials() {
    console.log('--- Ingesting Financial Data (research fixture / local seed) ---');

    const reports: RawFinancialReportInput[] = [
        {
            stockId: '2330',
            year: 2025,
            quarter: 4,
            eps: 9.2,
            netIncome: 315000,
            grossMargin: 54.1,
            operatingMargin: 42.3,
            operatingIncome: 428000,
            operatingCashFlow: 505000,
            capitalExpenditure: -180000,
            cashAndCashEquivalents: 620000,
            currentAssets: 980000,
            inventory: 120000,
            currentLiabilities: 420000,
            totalAssets: 3950000,
            totalLiabilities: 1380000,
            totalDebt: 350000,
            shortTermDebt: 90000,
            longTermDebt: 260000,
            interestExpense: 12000,
        },
        {
            stockId: '2454',
            year: 2025,
            quarter: 4,
            eps: 13.4,
            netIncome: 168000,
            grossMargin: 49.8,
            operatingMargin: 25.6,
            operatingIncome: 176000,
            operatingCashFlow: 142000,
            capitalExpenditure: -28000,
            cashAndCashEquivalents: 205000,
            currentAssets: 480000,
            inventory: 36000,
            currentLiabilities: 210000,
            totalAssets: 1180000,
            totalLiabilities: 395000,
            totalDebt: 90000,
            shortTermDebt: 25000,
            longTermDebt: 65000,
            interestExpense: 4500,
        },
        {
            stockId: '2317',
            year: 2025,
            quarter: 4,
            eps: 3.1,
            netIncome: 62000,
            grossMargin: 7.9,
            operatingMargin: 3.2,
            operatingCashFlow: 88000,
            capitalExpenditure: -51000,
            currentAssets: 640000,
            inventory: 150000,
            currentLiabilities: 510000,
            totalAssets: 2680000,
            totalLiabilities: 1760000,
            shortTermDebt: 180000,
            longTermDebt: 420000,
        },
    ];

    const result = await upsertFinancialReports(reports);
    console.log(`Upserted ${result.count} financial reports.`);
    if (result.limitations.length > 0) {
        console.log('Limitations:');
        result.limitations.forEach((item) => console.log(`- ${item}`));
    }
}

ingestFinancials()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
