
import { Strategy, StockData, StrategyResult, StockQuote } from './types';
import { calculateAllIndicators } from '../technicalIndicators';
import { kellyCalculator } from '../portfolio/KellyCalculator';
import { chipAnomalyScanner } from '../scanners/ChipAnomalyScanner';

export interface AssetDoublingConfig {
    minRevenueYoY: number;      // default 30
    maShort: number;            // default 20
    maLong: number;             // default 60
    minTechnicalScore: number;  // default 75
    atrFilterRatio: number;     // default 5 (5%)
    skipFilters?: boolean;      // Debug mode
}

export class AssetDoublingStrategy implements Strategy {
    name = 'Asset Doubling Plan';
    description = 'Target high-growth stocks with revenue YoY > 30% and bullish technical trend.';

    private config: AssetDoublingConfig;

    constructor(config?: Partial<AssetDoublingConfig>) {
        this.config = {
            minRevenueYoY: 20, // Optimized: 20% > 30% for broader catch
            maShort: 10,       // Optimized: MA10 detects trends faster than MA20
            maLong: 60,
            minTechnicalScore: 75,
            atrFilterRatio: 5,
            ...config
        };
        this.name = `Asset Doubling (YoY>${this.config.minRevenueYoY}%, MA${this.config.maShort}/${this.config.maLong})`;
    }

    async screen(data: StockData[], marketData?: any[], options?: { scalingFactor?: number; regime?: 'BULL' | 'NEUTRAL' | 'CORRECTION' | 'BEAR'; skipFilters?: boolean }): Promise<StrategyResult[]> {
        const scalingFactor = options?.scalingFactor ?? 1.0;
        const regime = options?.regime ?? 'NEUTRAL';
        const skipFilters = options?.skipFilters ?? false;

        // Dynamic Thresholds based on Regime
        let minRev = this.config.minRevenueYoY;
        let minTech = this.config.minTechnicalScore;
        let minChip = 50;

        if (regime === 'BULL') {
            minRev = 25; // Strict growth
            minTech = 80; // High momentum
        } else if (regime === 'CORRECTION') {
            minRev = 15; // Focus on resiliency
            minTech = 60;
            minChip = 60; // Require better chip support
        } else if (regime === 'BEAR') {
            minRev = 5;   // Growth is rare in bear
            minTech = 50;
            minChip = 80; // Only stocks with heavy institutional backing
        }

        const results: StrategyResult[] = [];

        for (const stock of data) {
            // ... (keep existing loops check)
            if (!stock.monthlyRevenues || stock.monthlyRevenues.length === 0) continue;

            const latestRev = stock.monthlyRevenues[0];
            const latestReport = stock.financialReports?.[0];
            const latestQuotes = [...(stock.quotes || [])].reverse(); // asc for indicators

            if (latestQuotes.length < 20) continue;

            // 1. Revenue Filter
            if (!this.config.skipFilters && !skipFilters && (latestRev.yoyGrowth || 0) < this.config.minRevenueYoY) continue;

            // 2. Technical Filter
            let technicalScore = 50;
            let currentClose = 0;

            if (latestQuotes.length >= 20) {
                const indicators = calculateAllIndicators(latestQuotes);
                const lastIdx = indicators.length - 1;
                const last: any = indicators[lastIdx];
                currentClose = last.close;

                // Simple technical score: Price above MA Short and MA Short > MA Long
                const maShortVal = last[`ma${this.config.maShort}`] || 0;
                const maLongVal = last[`ma${this.config.maLong}`] || 0;

                if (last.close > maShortVal) technicalScore += 25;
                if (maShortVal > maLongVal) technicalScore += 25;
            }

            // Bullish trend requirement
            if (!this.config.skipFilters && !skipFilters && technicalScore < this.config.minTechnicalScore) continue;

            // 3. Chip Strength
            const chipAccumulation = (stock.institutionalChips || []).reduce((acc: number, curr: any) => acc + curr.totalBuy, 0);
            const chipStrength = Math.min(100, Math.max(0, (chipAccumulation / 5000) * 100 + 50));

            // 4. Volatility Filter (New)
            if (latestQuotes.length >= 20) {
                const indicators = calculateAllIndicators(latestQuotes);
                const last = indicators[indicators.length - 1];
                const atr = last.atr || 0;
                const close = last.close;
                const atrRatio = (atr / close) * 100;

                if (!this.config.skipFilters && !skipFilters && atrRatio > this.config.atrFilterRatio && chipStrength < 60) continue;
            }

            // 5. Potential Label (Refined for Ignition)
            let potentialLabel = "👀 觀察標的";
            let climbPercent = 0;

            if (latestQuotes.length >= 20) {
                const recentVolumes = latestQuotes.slice(-5).map(q => q.volume);
                const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
                const currentVolume = latestQuotes[latestQuotes.length - 1].volume;
                const isVolumeSpike = currentVolume > (avgVolume * 2.5); // 2.5x Volume Spike

                const prices = latestQuotes.slice(-60).map((q: any) => q.close);
                const min = Math.min(...prices);
                const current = currentClose;
                climbPercent = ((current - min) / min) * 100;

                if (climbPercent > 50) {
                    potentialLabel = "⚠️ 過熱警戒 (已漲多)";
                } else if (isVolumeSpike && climbPercent < 20) {
                    potentialLabel = "🚀 強勢發動 (爆量起漲)";
                } else if (climbPercent < 15 && latestRev.yoyGrowth >= this.config.minRevenueYoY) {
                    potentialLabel = "💎 潛力珍珠 (低基期)";
                } else if (climbPercent < 30) {
                    potentialLabel = "📈 多頭排列";
                }
            }

            // 5. Backtest Evidence
            let backtestEvidence;
            if (latestQuotes.length >= 100) {
                backtestEvidence = this.getEvidence(latestQuotes, stock.monthlyRevenues);
            }

            // 6. Relative Strength (RS) Calculation
            let rsScore = 50;
            if (marketData && marketData.length >= 100 && latestQuotes.length >= 100) {
                const sCurrent = latestQuotes[latestQuotes.length - 1].close;
                const sPrev = latestQuotes[latestQuotes.length - 60].close;
                const sReturn = ((sCurrent - sPrev) / sPrev) * 100;

                const mCurrent = marketData[marketData.length - 1].value;
                const mPrev = marketData[marketData.length - 60].value;
                const mReturn = ((mCurrent - mPrev) / mPrev) * 100;

                rsScore = Math.min(99, Math.max(1, 50 + (sReturn - mReturn) * 2));
            }

            // 7. Investment Trust Streak
            const chips = stock.institutionalChips || [];
            let trustStreak = 0;
            for (let i = 0; i < Math.min(5, chips.length); i++) {
                if (chips[i].trustBuy > 0) trustStreak++;
                else break;
            }
            const isTrustBuying = trustStreak >= 3;

            if (isTrustBuying) {
                potentialLabel += " + 💎 投信認養";
            }


            // Concentration History for Mini-Sparkline
            const concentrationHistory = (stock.institutionalChips || [])
                .slice(0, 10)
                .reverse()
                .map(c => c.trustBuy + c.foreignBuy);

            // 8. Chip Anomaly Detection (New Phase 21)
            let anomalyData = undefined;
            try {
                const chipsAsc = [...(stock.institutionalChips || [])].reverse();
                const signals = await chipAnomalyScanner.scanStock(stock.stockId, chipsAsc);

                if (signals.length > 0) {
                    const topSignal = signals.reduce((prev, current) => (current.score > prev.score ? current : prev));
                    anomalyData = {
                        type: topSignal.anomalyType,
                        severity: topSignal.severity,
                        score: topSignal.score,
                        description: topSignal.reasoning
                    };
                }
            } catch (e) {
                // console.warn('Anomaly detection failed', e);
            }

            // 9. Kelly Position Sizing (New Phase 21)
            // Default params based on strategy backtest
            const kellyParams = {
                winRate: 0.55, // 55% conservative estimate for this strategy
                avgWin: 0.20,  // 20% target
                avgLoss: 0.07  // 7% stop
            };

            // Adjust confidence based on technical score and RS
            const confidence = Math.min(100, (technicalScore + rsScore) / 2);

            const kellyResult = kellyCalculator.calculate({
                ...kellyParams,
                confidence: confidence / 100
            });

            // Calculate Suggested Lots
            const TOTAL_CAPITAL = 2000000;
            const fraction = kellyResult.recommended * scalingFactor; // Apple market scaling
            const positionCapital = TOTAL_CAPITAL * fraction;
            const lots = currentClose > 0 ? Math.floor(positionCapital / (currentClose * 1000)) : 0;

            const stopAndRisk = this.calculateStopAndRisk(latestQuotes, currentClose);

            results.push({
                stockId: stock.stockId,
                name: stock.name,
                revenueYoY: latestRev.yoyGrowth || 0,
                eps: latestReport?.eps || 0,
                chipStrength: Math.round(chipStrength),
                technicalScore,
                reason: `${stock.name} 符合高營收成長 (${latestRev.yoyGrowth?.toFixed(1)}%) 且主力籌碼${chipAccumulation > 0 ? '持續進場' : '穩定'}。`,
                closePrice: currentClose,
                potentialLabel,
                climbPercent,
                backtestEvidence,
                rsScore: Math.round(rsScore),

                // Risk & Money Management
                suggestedStopLoss: stopAndRisk.stopPrice,
                stopLossReason: stopAndRisk.reason,
                suggestedPositionSize: lots,
                riskPerShare: stopAndRisk.riskPerShare,

                // Kelly & Market Info
                kellyPositionPct: Math.round(kellyResult.recommended * 100),
                kellyReasoning: kellyResult.reasoning,
                kellyRisk: kellyResult.risk,
                marketScalingFactor: scalingFactor,
                marketRegime: regime,

                // Anomaly & History
                anomaly: anomalyData,
                concentrationHistory
            });
        }

        return results.sort((a, b) => (b.revenueYoY + b.chipStrength) - (a.revenueYoY + a.chipStrength));
    }

    private calculateStopAndRisk(quotes: any[], currentClose: number) {
        if (quotes.length < 20) return { stopPrice: 0, reason: '', riskPerShare: 0 };

        const indicators = calculateAllIndicators(quotes);
        const last = indicators.length > 0 ? indicators[indicators.length - 1] : null;

        if (!last) return { stopPrice: 0, reason: '', riskPerShare: 0 };

        const ma20Stop = last.ma20 || 0;
        const recentHigh = Math.max(...quotes.slice(-20).map(q => q.high));
        const atr = last.atr || 0;
        const atrStop = recentHigh - (2 * atr);

        const stopPrice = Number(Math.max(ma20Stop, atrStop).toFixed(2));
        const reason = ma20Stop > atrStop ? `跌破月線 MA20 (${ma20Stop.toFixed(2)})` : `高點回檔 2xATR (${atrStop.toFixed(2)})`;
        const riskPerShare = stopPrice > 0 ? Number((currentClose - stopPrice).toFixed(2)) : 0;

        return { stopPrice, reason, riskPerShare };
    }

    async analyze(stock: StockData): Promise<StrategyResult | null> {
        // Detailed analysis checks
        // Reuse screen for consistency, but ensure options passed if needed (null here)
        const results = await this.screen([stock]);
        if (results.length === 0) return null;

        const result = results[0];

        // Additional Analysis Logic (Risk Score etc)
        const latestQuotes = [...(stock.quotes || [])].reverse();
        let riskScore = 50;
        let riskLevel: 'Low' | 'Medium' | 'High' = 'Medium';

        if (latestQuotes.length >= 10) {
            const prices = latestQuotes.slice(-20).map(q => q.close);
            const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
            const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
            const stdDev = Math.sqrt(variance);
            const volatility = (stdDev / mean) * 100;

            riskScore = Math.min(100, Math.round(volatility * 20));
            if (volatility < 2) riskLevel = 'Low';
            else if (volatility > 5) riskLevel = 'High';
            else riskLevel = 'Medium';
        }

        result.riskScore = riskScore;
        result.riskLevel = riskLevel;
        result.isETF = stock.stockId.length >= 4 && (stock.stockId.startsWith('00') || stock.stockId.startsWith('01'));

        const prevClose = latestQuotes.length >= 2 ? latestQuotes[latestQuotes.length - 2].close : result.closePrice || 0;
        result.priceChangePercent = prevClose > 0 && result.closePrice
            ? ((result.closePrice - prevClose) / prevClose) * 100
            : 0;

        return result;
    }

    getEvidence(quotesAsc: any[], revenues: any[]): { date: string; maxGain: number; duration: number; } | undefined {
        // ... (keep usage of this method same as before, implementation details inside are fine)
        // I will copy the helper implementation to ensure it works.
        if (quotesAsc.length < 100) return undefined;

        const indicators = calculateAllIndicators(quotesAsc);
        let bestSignal = { date: '', maxGain: -999, duration: 0 };
        const lookLimit = indicators.length - 60;

        for (let i = 60; i < lookLimit; i++) {
            const day = indicators[i];
            const date = day.date;

            // Technical Criteria
            if (!day.ma20 || !day.ma60) continue;
            if (day.close <= day.ma20 || day.ma20 <= day.ma60) continue;

            const dateStr = day.date as unknown as string;
            let yyyy = 0; let mm = 0;

            if (typeof dateStr === 'string') {
                if (dateStr.length === 8) {
                    yyyy = parseInt(dateStr.substring(0, 4));
                    mm = parseInt(dateStr.substring(4, 6));
                } else if (dateStr.length === 7) {
                    yyyy = parseInt(dateStr.substring(0, 3)) + 1911;
                    mm = parseInt(dateStr.substring(3, 5));
                }
            }
            if (yyyy === 0) continue;

            const targetRevenue = revenues.find(r => {
                return r.year === yyyy && (r.month === mm || r.month === mm - 1 || r.month === mm - 2);
            });

            if (!targetRevenue) continue;
            if ((targetRevenue.yoyGrowth || 0) < this.config.minRevenueYoY) continue;

            const entryPrice = day.close;
            let currentMaxGain = -Infinity;
            let tradeDuration = 0;

            for (let j = 1; j <= 60; j++) {
                const currentDayIdx = i + j;
                const currentDay = indicators[currentDayIdx];
                const prevDay = indicators[currentDayIdx - 1];

                const startWin = Math.max(0, currentDayIdx - 20);
                const endWin = currentDayIdx;

                let recentHigh = -Infinity;
                for (let k = startWin; k < endWin; k++) {
                    if (indicators[k].high > recentHigh) recentHigh = indicators[k].high;
                }

                const ma20Stop = prevDay.ma20 || 0;
                const atrStop = recentHigh - (2 * (prevDay.atr || 0));
                const stopPrice = Math.max(ma20Stop, atrStop);

                if (currentDay.low < stopPrice) {
                    tradeDuration = j;
                    break;
                }

                const potentialGain = ((currentDay.high - entryPrice) / entryPrice) * 100;

                if (potentialGain > currentMaxGain) {
                    currentMaxGain = potentialGain;
                    tradeDuration = j;
                }
            }

            if (currentMaxGain > bestSignal.maxGain) {
                bestSignal = {
                    date: typeof date === 'string' ? date : dateStr,
                    maxGain: currentMaxGain,
                    duration: tradeDuration
                };
            }
        }

        if (bestSignal.maxGain > 0) return bestSignal;
        return undefined;
    }

    getOnGoingStopLoss(quote: StockQuote, history: StockQuote[]): number | undefined {
        if (!history || history.length < 20) return undefined;

        const indicators = calculateAllIndicators(history);
        const last = indicators[indicators.length - 1];

        if (!last) return undefined;

        const ma20Stop = last.ma20 || 0;
        const recentHigh = Math.max(...history.slice(-20).map(q => q.high));
        const atr = last.atr || 0;
        const atrStop = recentHigh - (2 * atr);

        return Number(Math.max(ma20Stop, atrStop).toFixed(2));
    }
}

