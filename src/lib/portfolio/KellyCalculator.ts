/**
 * Kelly Criterion Position Sizing Calculator
 * 
 * Implements the Kelly formula: f* = (bp - q) / b
 * where:
 * - f* = optimal position size (fraction of capital)
 * - b = odds received (profit/loss ratio)
 * - p = probability of winning
 * - q = probability of losing (1 - p)
 */

export interface KellyParameters {
    winRate: number;        // 0.0 to 1.0
    avgWin: number;         // Average winning trade %
    avgLoss: number;        // Average losing trade % (positive number)
    confidence?: number;    // Optional confidence adjustment (0.0 to 1.0)
}

export interface PositionSizingResult {
    kellyFraction: number;      // Full Kelly %
    halfKelly: number;          // Conservative Half-Kelly %
    recommended: number;        // Final recommendation with safety caps
    reasoning: string;
    risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
}

export class KellyCalculator {
    private readonly MAX_POSITION = 0.30;  // 30% max for any single stock
    private readonly MIN_POSITION = 0.05;  // 5% min to make it worthwhile
    private readonly KELLY_FRACTION = 0.5; // Use Half-Kelly by default

    /**
     * Calculate optimal position size using Kelly Criterion
     */
    calculate(params: KellyParameters): PositionSizingResult {
        const { winRate, avgWin, avgLoss, confidence = 1.0 } = params;

        // Validate inputs
        if (winRate <= 0 || winRate >= 1) {
            return this.createNoPositionResult('Invalid win rate');
        }

        if (avgWin <= 0 || avgLoss <= 0) {
            return this.createNoPositionResult('Invalid profit/loss values');
        }

        // Calculate odds (b = profit/loss ratio)
        const oddsReceived = avgWin / avgLoss;
        const lossRate = 1 - winRate;

        // Kelly formula: f* = (bp - q) / b
        const kellyFull = (oddsReceived * winRate - lossRate) / oddsReceived;

        // If Kelly is negative, don't bet
        if (kellyFull <= 0) {
            return this.createNoPositionResult(
                `Negative Kelly (${(kellyFull * 100).toFixed(1)}%): Edge is insufficient`
            );
        }

        // Apply Half-Kelly for safety
        const halfKelly = kellyFull * this.KELLY_FRACTION;

        // Apply confidence adjustment (if strategy has lower confidence)
        const adjusted = halfKelly * confidence;

        // Cap at maximum position
        const capped = Math.min(adjusted, this.MAX_POSITION);

        // Final recommendation
        let recommended = capped;
        let reasoning = `Full Kelly: ${(kellyFull * 100).toFixed(1)}%, using Half-Kelly for safety`;

        // Don't recommend if too small
        if (recommended < this.MIN_POSITION) {
            return this.createNoPositionResult(
                `Position too small (${(recommended * 100).toFixed(1)}%), not worth the complexity`
            );
        }

        // Determine risk level
        const risk = this.assessRisk(kellyFull, winRate);

        if (capped < adjusted) {
            reasoning += `. Capped at ${this.MAX_POSITION * 100}% for safety`;
        }

        if (confidence < 1.0) {
            reasoning += `. Adjusted for ${(confidence * 100).toFixed(0)}% confidence`;
        }

        return {
            kellyFraction: kellyFull,
            halfKelly,
            recommended,
            reasoning,
            risk
        };
    }

    /**
     * Estimate Kelly parameters from historical backtest results
     */
    estimateFromBacktest(trades: Array<{ pnlPct: number }>): KellyParameters {
        if (trades.length < 10) {
            throw new Error('Need at least 10 trades to estimate Kelly parameters');
        }

        const wins = trades.filter(t => t.pnlPct > 0);
        const losses = trades.filter(t => t.pnlPct <= 0);

        const winRate = wins.length / trades.length;
        const avgWin = wins.reduce((sum, t) => sum + t.pnlPct, 0) / wins.length || 0.1;
        const avgLoss = Math.abs(
            losses.reduce((sum, t) => sum + t.pnlPct, 0) / losses.length || 0.05
        );

        return {
            winRate: Math.max(0.1, Math.min(0.9, winRate)), // Clamp to reasonable range
            avgWin: Math.abs(avgWin),
            avgLoss: Math.abs(avgLoss)
        };
    }

    /**
     * Calculate position size for a specific stock with confidence score
     */
    calculateForStock(
        historicalPerformance: KellyParameters,
        currentConfidence: number
    ): PositionSizingResult {
        return this.calculate({
            ...historicalPerformance,
            confidence: currentConfidence / 100 // Convert 0-100 to 0-1
        });
    }

    private createNoPositionResult(reason: string): PositionSizingResult {
        return {
            kellyFraction: 0,
            halfKelly: 0,
            recommended: 0,
            reasoning: reason,
            risk: 'LOW'
        };
    }

    private assessRisk(kellyFraction: number, winRate: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
        // High Kelly + Low Win Rate = Extreme Risk
        if (kellyFraction > 0.4 && winRate < 0.5) return 'EXTREME';

        // High Kelly suggests aggressive betting
        if (kellyFraction > 0.5) return 'HIGH';
        if (kellyFraction > 0.3) return 'MEDIUM';

        return 'LOW';
    }
}

// Singleton export
export const kellyCalculator = new KellyCalculator();
