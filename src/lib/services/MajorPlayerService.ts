import { prisma } from '../prisma';

export interface MajorPlayerAnalysis {
    averageCost: number;
    targetPrice: number;
    strength: number; // 0-100 score
    description: string;
    dominantPlayer?: string; // 外資, 投信, or 自營商
}

export class MajorPlayerService {

    /**
     * Analyze major player behavior to estimate cost and targets
     * @param stockId Stock ID
     * @param asOfDate Optional past date to simulate state (YYYYMMDD)
     */
    async analyze(stockId: string, asOfDate?: string): Promise<MajorPlayerAnalysis | null> {
        // Fetch quotes and institutional chips with date constraint
        const dateFilter = asOfDate ? { lte: asOfDate } : {};

        const [quotes, chips] = await Promise.all([
            prisma.stockQuote.findMany({
                where: {
                    stockId,
                    date: dateFilter
                },
                orderBy: { date: 'desc' },
                take: 60
            }),
            (prisma as any).institutionalChip.findMany({
                where: {
                    stockId,
                    date: dateFilter
                },
                orderBy: { date: 'desc' },
                take: 60
            })
        ]);

        if (quotes.length < 20) return null;

        // Estimate Average Cost and identify dominant player
        let totalBuyingValue = 0;
        let totalBuyingVolume = 0;

        let foreignTotal = 0;
        let trustTotal = 0;
        let dealerTotal = 0;

        // Match chips with quotes by date
        chips.forEach((chip: any) => {
            const quote = quotes.find((q: any) => q.date === chip.date);
            if (quote && chip.totalBuy > 0) {
                totalBuyingValue += (chip.totalBuy * quote.close);
                totalBuyingVolume += chip.totalBuy;
            }

            // Accumulate net buying for attribution (last 20 days focus)
            const chipIndex = chips.indexOf(chip);
            if (chipIndex < 20) {
                foreignTotal += chip.foreignBuy;
                trustTotal += chip.trustBuy;
                dealerTotal += chip.dealerBuy;
            }
        });

        const averageCost = totalBuyingVolume > 0
            ? totalBuyingValue / totalBuyingVolume
            : quotes[0].close;

        // Determine Dominant Player
        let dominantPlayer = "主力";
        const maxBuy = Math.max(foreignTotal, trustTotal, dealerTotal);

        if (maxBuy > 0) {
            if (maxBuy === foreignTotal) dominantPlayer = "外資";
            else if (maxBuy === trustTotal) dominantPlayer = "投信";
            else if (maxBuy === dealerTotal) dominantPlayer = "自營商";
        }

        // Predict Target Price
        const recentChips = chips.slice(0, 10);
        const netBuyTrend = recentChips.reduce((acc: number, curr: any) => acc + curr.totalBuy, 0);

        let margin = 0.10;
        if (netBuyTrend > 5000) margin = 0.20;
        else if (netBuyTrend > 2000) margin = 0.15;

        const sixtyDayHigh = Math.max(...quotes.map((q: any) => q.high));
        const projectedTarget = averageCost * (1 + margin);
        const finalTarget = (projectedTarget + sixtyDayHigh) / 2;

        return {
            averageCost: Number(averageCost.toFixed(2)),
            targetPrice: Number(finalTarget.toFixed(2)),
            strength: Math.min(100, Math.max(0, (netBuyTrend / 10000) * 100 + 50)),
            dominantPlayer,
            description: netBuyTrend > 0
                ? `${dominantPlayer}近期於 ${averageCost.toFixed(1)} 元附近積極佈局，買盤力道強。`
                : `${dominantPlayer}籌碼相對觀望，預估於現價整理機率高。`
        };
    }
}

export const majorPlayerService = new MajorPlayerService();
