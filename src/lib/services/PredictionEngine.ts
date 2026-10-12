import { prisma } from '../prisma';
import { calculateAllIndicators } from '../technicalIndicators';
import { llmAnalyzer } from './LLMAnalyzer';
import { majorPlayerService, MajorPlayerAnalysis } from './MajorPlayerService';
import { newsService } from './NewsService';
import { StockDataPoint } from '@/types/stock';

export interface PredictionResult {
    stockId: string;
    technicalScore: number;
    newsScore: number;
    totalScore: number;
    signal: 'BUY' | 'SELL' | 'HOLD' | 'CAUTION';
    factors: any;
    confidence: number;
    majorPlayer?: MajorPlayerAnalysis;
}

export class PredictionEngine {

    /**
     * Generate a hybrid prediction for a given stock
     * @param stockId Stock ID
     * @param asOfDate Optional past date to simulate state (YYYYMMDD)
     */
    async predict(stockId: string, asOfDate?: string): Promise<PredictionResult> {
        const dateFilter = asOfDate ? { lte: asOfDate } : {};

        // 1. Fetch data
        const quotes = await prisma.stockQuote.findMany({
            where: {
                stockId,
                date: dateFilter
            },
            orderBy: { date: 'desc' },
            take: 60
        });

        const db = prisma as any;

        // Fetch news: Use live news only if asOfDate is today or null
        const isToday = !asOfDate || asOfDate === new Date().toISOString().split('T')[0].replace(/-/g, '');

        let news;
        if (isToday) {
            const liveNews = await newsService.fetchLatestNews(stockId, 5);
            news = liveNews.length > 0 ? liveNews : await db.newsEvent.findMany({
                where: { stockId },
                orderBy: { publishedAt: 'desc' },
                take: 10
            });
        } else {
            // For backtesting, we must use stored news records from that time
            // Normalize asOfDate to YYYY-MM-DD for consistency
            const normalizedDate = asOfDate.includes('-') ? asOfDate : `${asOfDate.slice(0, 4)}-${asOfDate.slice(4, 6)}-${asOfDate.slice(6, 8)}`;
            const contextDate = new Date(`${normalizedDate}T23:59:59Z`);

            news = await db.newsEvent.findMany({
                where: {
                    stockId,
                    publishedAt: { lte: contextDate }
                },
                orderBy: { publishedAt: 'desc' },
                take: 10
            });
        }

        const techScore = this.calculateTechnicalScore(quotes.reverse());
        const newsScore = await this.calculateNewsScore(news);
        const majorPlayer = await majorPlayerService.analyze(stockId, asOfDate);

        // Combine weighting: 50% Tech, 30% News, 20% Major Player
        const chipStrength = majorPlayer?.strength || 50;
        const totalScore = (techScore * 0.5) + (newsScore * 0.3) + (chipStrength * 0.2);

        const signal = this.deriveSignal(totalScore, techScore, newsScore);

        return {
            stockId,
            technicalScore: Math.round(techScore),
            newsScore: Math.round(newsScore),
            totalScore: Math.round(totalScore),
            signal,
            // Confidence derived from signal convergence, not hardcoded
            confidence: this.calculateConfidence(techScore, newsScore, majorPlayer?.strength ?? 0, news.length),
            majorPlayer: majorPlayer || undefined,
            factors: {
                techFactors: "RSI and MA based scoring",
                newsCount: news.length,
                newsAnalysis: news.length > 0 ? "Analyzed with LLM Engine" : "No recent news found",
                chipStrength: majorPlayer?.strength
            }
        };
    }

    private calculateTechnicalScore(quotes: any[]): number {
        if (quotes.length < 20) return 50;

        const indicators = calculateAllIndicators(quotes);
        const last: any = indicators[indicators.length - 1];

        let score = 50;

        // RSI contribution
        if (last.rsi !== undefined) {
            if (last.rsi < 30) score += 20;
            else if (last.rsi > 70) score -= 20;
            else if (last.rsi > 50) score += 5;
        }

        // MACD contribution
        if (last.macd !== undefined && last.macdSignal !== undefined) {
            if (last.macd > last.macdSignal) score += 10;
            else score -= 10;
        }

        // MA contribution
        if (last.ma20 !== undefined) {
            if (last.close > last.ma20) score += 10;
            if (last.ma60 !== undefined && last.ma20 > last.ma60) score += 10;
        }

        return Math.min(100, Math.max(0, score));
    }

    private async calculateNewsScore(news: any[]): Promise<number> {
        if (news.length === 0) return 50;

        const results = await Promise.all(
            news.map(item => llmAnalyzer.analyzeNews(item.title, item.summary || ""))
        );

        const averageSentiment = results.reduce((acc: number, curr: any) => acc + curr.sentiment, 0) / results.length;

        return (averageSentiment + 1) * 50;
    }

    private deriveSignal(total: number, tech: number, news: number): 'BUY' | 'SELL' | 'HOLD' | 'CAUTION' {
        if (total > 68) return 'BUY';
        if (total < 32) return 'SELL';

        if (tech > 70 && news < 30) return 'CAUTION';
        if (tech < 30 && news > 70) return 'CAUTION';

        return 'HOLD';
    }

    /**
     * Calculate confidence based on signal convergence rather than a fixed value.
     * Higher confidence when multiple signals agree.
     * Range: 0.2 (minimal data/conflicting signals) to 0.85 (strong convergence).
     * Note: Never returns 1.0 because no model has perfect confidence.
     */
    private calculateConfidence(
        techScore: number,
        newsScore: number,
        chipStrength: number,
        newsCount: number
    ): number {
        let confidence = 0.3; // base confidence

        // Signal convergence: if tech and news agree on direction, boost confidence
        const techBullish = techScore > 60;
        const techBearish = techScore < 40;
        const newsBullish = newsScore > 60;
        const newsBearish = newsScore < 40;
        const chipBullish = chipStrength > 50;

        const bullishSignals = [techBullish, newsBullish, chipBullish].filter(Boolean).length;
        const bearishSignals = [techBearish, newsBearish, !chipBullish].filter(Boolean).length;
        const maxAgreement = Math.max(bullishSignals, bearishSignals);

        // More agreeing signals = higher confidence
        if (maxAgreement >= 3) confidence += 0.3;
        else if (maxAgreement >= 2) confidence += 0.15;

        // Penalize if no news data available
        if (newsCount === 0) confidence -= 0.1;
        // Slight boost for having multiple news sources
        else if (newsCount >= 3) confidence += 0.05;

        // Extreme tech scores are more confident than neutral
        const techDeviation = Math.abs(techScore - 50) / 50;
        confidence += techDeviation * 0.15;

        // Clamp to [0.2, 0.85] — never claim certainty
        return Math.round(Math.max(0.2, Math.min(0.85, confidence)) * 100) / 100;
    }
}

export const predictionEngine = new PredictionEngine();
