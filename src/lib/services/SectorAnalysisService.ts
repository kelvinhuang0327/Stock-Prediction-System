
import { prisma } from '../prisma';

export interface SectorData {
    name: string;
    changePercent: number;    // Average 20-day change of components
    relativeStrength: number; // vs Market avg (0-100)
    momentum: number;         // 5-day change trend
    volume: number;           // Total volume
    stockCount: number;
    topStockId?: string;      // Driver of the sector
}

export const SectorAnalysisService = {
    async getSectorRotationData(): Promise<SectorData[]> {
        // 1. Fetch active stocks with recent quotes
        // We look back 30 days to ensure enough data for 20-day change
        const stocks = await prisma.stock.findMany({
            where: {
                industry: { not: null },
                quotes: { some: {} }
            },
            select: {
                id: true,
                name: true,
                industry: true,
                quotes: {
                    orderBy: { date: 'desc' },
                    take: 22 // enough for 20-day calculation
                }
            }
        });

        // 2. Group by Industry
        const sectors: Record<string, typeof stocks> = {};

        for (const stock of stocks) {
            if (!stock.industry) continue;
            // Normalize industry name (remove nulls handled by query, but just safe check)
            const ind = stock.industry;
            if (!sectors[ind]) sectors[ind] = [];
            sectors[ind].push(stock);
        }

        const results: SectorData[] = [];
        let globalAvgChange = 0;
        let validSectorCount = 0;

        // 3. Calculate Metrics per Sector
        for (const [name, components] of Object.entries(sectors)) {
            let totalChange20d = 0;
            let totalChange5d = 0;
            let totalVolume = 0;
            let count = 0;
            let maxChange = -999;
            let topStock = '';

            for (const stock of components) {
                const q = stock.quotes;
                if (q.length < 20) continue;

                const current = q[0].close;
                const prev5 = q[4]?.close || current;
                const prev20 = q[19]?.close || current;

                const chg5 = ((current - prev5) / prev5) * 100;
                const chg20 = ((current - prev20) / prev20) * 100;

                totalChange5d += chg5;
                totalChange20d += chg20;
                totalVolume += q[0].volume;
                count++;

                if (chg20 > maxChange) {
                    maxChange = chg20;
                    topStock = stock.name;
                }
            }

            if (count < 3) continue; // Ignore sectors with too few valid stocks

            const avgChange20d = totalChange20d / count;
            const avgChange5d = totalChange5d / count;

            results.push({
                name,
                changePercent: avgChange20d, // Use 20d as main performance metric
                momentum: avgChange5d,       // Use 5d as short-term momentum
                relativeStrength: 0,         // Calc later
                volume: totalVolume,
                stockCount: count,
                topStockId: topStock
            });

            globalAvgChange += avgChange20d;
            validSectorCount++;
        }

        // 4. Calculate Relative Strength (Normalized 0-100)
        // Simple RS: Compare sector change to average sector change
        if (validSectorCount > 0) {
            globalAvgChange /= validSectorCount;

            // Find min/max for normalization
            let maxDiff = 0.1; // avoid div 0

            const withDiff = results.map(r => {
                const diff = r.changePercent - globalAvgChange;
                if (Math.abs(diff) > maxDiff) maxDiff = Math.abs(diff);
                return { ...r, diff };
            });

            return withDiff.map(r => ({
                ...r,
                relativeStrength: 50 + ((r.diff / maxDiff) * 50) // Scale to 0-100, 50 is avg
            })).sort((a, b) => b.relativeStrength - a.relativeStrength);
        }

        return results;
    }
};
