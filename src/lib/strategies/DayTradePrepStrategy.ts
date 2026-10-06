import { Strategy, StockData, StrategyResult } from './types';
import { calculateAllIndicators } from '../technicalIndicators';

export class DayTradePrepStrategy implements Strategy {
    name = 'Day Trade Prep (當沖預備)';
    description = 'High volatility candidates for next-day intraday trading.';

    async screen(data: StockData[], marketData?: any[]): Promise<StrategyResult[]> {
        const results: StrategyResult[] = [];

        // Pre-filter: Focus on high volume first to save calculation time
        // Actually for screen we iterate all.

        for (const stock of data) {
            const quotes = stock.quotes || [];
            if (quotes.length < 20) continue;

            const quotesAsc = [...quotes].reverse();
            const indicators = calculateAllIndicators(quotesAsc);
            const last = indicators[indicators.length - 1];
            const currentClose = last.close;

            // 1. High Turnover / Volume Check
            // Absolute volume > 2000 lots (approx, assuming data is in lots/shares?) 
            // Usually mock data volume is shares? No, usually lots in TW logic often. 
            // Let's assume raw number. If mock data volume 5000 = 5000 sheets?
            // Safer to check "Dollar Volume" if possible, but let's stick to simple Volume > 2000
            if (last.volume < 2000) continue;

            // 2. High Volatility (ATR Ratio)
            // Day traders need range.
            const atr = last.atr || 0;
            const atrRatio = (atr / currentClose) * 100;
            if (atrRatio < 2.0) continue; // Must have > 2% daily fluctuation potential

            // 3. Strong Close (Upper Shadow check)
            // Open, Close, High, Low
            // If Close is near High, momentum often carries to next open.
            const bodyTop = Math.max(last.open, last.close);
            const upperShadow = (last.high - bodyTop) / last.close * 100;

            // If upper shadow is huge (>2%), selling pressure is high. Avoid.
            if (upperShadow > 2.5) continue;

            // 4. Calculated Score
            let score = 50;
            if (atrRatio > 3) score += 20; // Very volatile = Good for DT
            if (last.volume > 10000) score += 20; // High liquidity

            // Chip context
            const chips = stock.institutionalChips || [];
            const recentBuy = chips.slice(0, 1).reduce((acc: number, c: any) => acc + (c.totalBuy || 0), 0);
            if (recentBuy > 0) score += 10; // Main players active

            // Previous day change amplitude
            const prev = indicators[indicators.length - 2];
            const changeP = Math.abs((last.close - prev.close) / prev.close * 100);
            if (changeP > 3) score += 10; // Yesterday was active

            results.push({
                stockId: stock.stockId,
                name: stock.name,
                revenueYoY: 0, // Less relevant for DT
                eps: 0,
                chipStrength: 50,
                technicalScore: Math.min(100, score),
                reason: `高波動 (ATR ${atrRatio.toFixed(1)}%), 量大 (${last.volume}), 收盤強勢`,
                closePrice: currentClose,
                potentialLabel: atrRatio > 4 ? "⚡ 極度活潑" : "🌊 當沖熱門",
                riskScore: 90, // Day Trading is high risk
                riskLevel: 'High'
            });
        }

        return results.sort((a, b) => b.technicalScore - a.technicalScore);
    }
}
