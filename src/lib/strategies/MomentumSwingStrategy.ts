import { Strategy, StockData, StrategyResult, StockQuote } from './types';
import { calculateAllIndicators } from '../technicalIndicators';

export class MomentumSwingStrategy implements Strategy {
    name = 'Momentum Swing (波段快攻)';
    description = 'Short-term swing trading strategy targeting 3-10 day moves based on technical momentum (MA5/10) and volume.';

    async screen(data: StockData[], marketData?: any[]): Promise<StrategyResult[]> {
        const results: StrategyResult[] = [];

        for (const stock of data) {
            const quotes = stock.quotes || [];
            if (quotes.length < 20) continue;

            // Sort ascending for indicators
            const quotesAsc = [...quotes].reverse();
            // Need MA10 specifically
            const indicators = calculateAllIndicators(quotesAsc, {
                sma: [5, 10, 20, 60],
                macd: true
            });
            const last = indicators[indicators.length - 1];
            const prev = indicators[indicators.length - 2];
            const currentClose = last.close;

            // 1. Trend Alignment (MA5 > MA10 > MA20)
            const ma5 = last.ma5 || 0;
            const ma10 = last.ma10 || 0;
            const ma20 = last.ma20 || 0;

            // Allow slight deviations but generally uptrend
            if (currentClose < ma5 || ma5 < ma10) continue; // Basic momentum check
            if (currentClose < ma20) continue; // Must be above monthly trend

            // 2. Volume Spike
            const avgVol5 = indicators.slice(-6, -1).reduce((sum: number, d: any) => sum + d.volume, 0) / 5;
            const volRatio = (avgVol5 > 0) ? last.volume / avgVol5 : 0;

            // Design Choice: Need active volume but not necessarily "Super Explosion" which might be climax
            // Ratio > 1.2 is healthy active.
            if (volRatio < 1.2) continue;

            // 3. Technical Strength (KD or RSI)
            // KD Golden Cross or Strong Zone
            // Simple RSI Strength
            const rsi = last.rsi || 50;
            if (rsi < 55) continue; // Must be in "Strong" zone but not overbought > 85
            if (rsi > 85) continue;

            // 4. Chip Flow (Optional but good)
            const chips = stock.institutionalChips || [];
            const recentChips = chips.slice(0, 3); // Last 3 days
            const chipBuy = recentChips.reduce((acc: number, c: any) => acc + (c.totalBuy || 0), 0);
            const chipStrength = Math.min(100, Math.max(0, (chipBuy / 1000) * 100 + 50)); // Normalize

            // Scoring
            let technicalScore = 60;
            if (volRatio > 2) technicalScore += 10;
            // Use 'osc' (MACD Histogram) or 'dem' (Signal) diff
            // MACD Line is usually (DIF), Signal is (DEM)
            // Bullish: DIF > DEM
            if (last.dif !== undefined && last.dem !== undefined && last.dif > last.dem) technicalScore += 10;
            if (chipBuy > 0) technicalScore += 10;
            if (rsi > 60 && rsi < 80) technicalScore += 10; // Sweet spot

            results.push({
                stockId: stock.stockId,
                name: stock.name,
                revenueYoY: stock.monthlyRevenues?.[0]?.yoyGrowth || 0,
                eps: stock.financialReports?.[0]?.eps || 0,
                chipStrength: Math.round(chipStrength),
                technicalScore,
                reason: `量增 (${volRatio.toFixed(1)}x), RSI強勢 (${rsi.toFixed(1)}), 均線多排`,
                closePrice: currentClose,
                potentialLabel: volRatio > 2.5 ? "🔥 爆量攻擊" : "📈 溫和放量",
                climbPercent: 0, // Simplified for now
                riskScore: 60, // Moderate risk for swing
                riskLevel: 'Medium'
            });
        }

        return results.sort((a, b) => b.technicalScore - a.technicalScore);
    }
}
