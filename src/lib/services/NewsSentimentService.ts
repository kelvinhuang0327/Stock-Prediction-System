
import { prisma } from '../prisma';

export interface SentimentAnalysis {
    score: number;       // -100 to 100
    label: string;       // Bullish, Bearish, Neutral
    headline: string;    // Generated headline
    factors: string[];   // Why?
}

export class NewsSentimentService {

    /**
     * Simulates an AI analyzing recent news and financial reports
     */
    async analyze(stockId: string): Promise<SentimentAnalysis> {
        // Fetch real data to base "AI" opinion on
        const stock = await prisma.stock.findUnique({
            where: { id: stockId },
            include: {
                monthlyRevenues: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 1 },
                quotes: { orderBy: { date: 'desc' }, take: 5 },
                institutionalChips: { orderBy: { date: 'desc' }, take: 1 }
            }
        });

        if (!stock) return { score: 0, label: 'Neutral', headline: 'No Data Available', factors: [] };

        const factors: string[] = [];
        let score = 0;

        // 1. Revenue Sentiment
        const rev = stock.monthlyRevenues[0];
        if (rev && rev.yoyGrowth) {
            if (rev.yoyGrowth > 50) {
                score += 40;
                factors.push(`Explosive Growth: Revenue up ${rev.yoyGrowth.toFixed(1)}% YoY`);
            } else if (rev.yoyGrowth > 20) {
                score += 20;
                factors.push(`Strong Growth: Revenue up ${rev.yoyGrowth.toFixed(1)}% YoY`);
            } else if (rev.yoyGrowth < -10) {
                score -= 20;
                factors.push(`Weakness: Revenue down ${rev.yoyGrowth.toFixed(1)}% YoY`);
            }
        }

        // 2. Price Momentum Sentiment
        const quotes = stock.quotes;
        if (quotes.length >= 5) {
            const current = quotes[0].close;
            const prev = quotes[4].close;
            const chg = ((current - prev) / prev) * 100;

            if (chg > 10) {
                score += 30;
                factors.push(`Momentum: Stock rallied ${chg.toFixed(1)}% in 5 days`);
            } else if (chg < -5) {
                score -= 20;
                factors.push(`Correction: Stock dropped ${chg.toFixed(1)}% recently`);
            }
        }

        // 3. Institutional Sentiment
        const chips = stock.institutionalChips[0];
        if (chips) {
            if (chips.totalBuy > 0) {
                score += 10;
                factors.push('Institutional Accumulation Detected');
            } else if (chips.totalBuy < 0) {
                score -= 10;
                factors.push('Institutional Selling Detected');
            }
        }

        // 4. Generate AI Headline based on score
        let label = 'Neutral';
        let headline = `${stock.name} remains steady amid market volatility.`;

        if (score >= 50) {
            label = 'Very Bullish';
            headline = `AI Alert: ${stock.name} showing surge signals with record growth!`;
        } else if (score >= 20) {
            label = 'Bullish';
            headline = `${stock.name} attracts attention with solid performance.`;
        } else if (score <= -20) {
            label = 'Bearish';
            headline = `Caution advised for ${stock.name} as indicators weaken.`;
        }

        return {
            score,
            label,
            headline,
            factors
        };
    }
}

export const newsSentimentService = new NewsSentimentService();
