/**
 * Multi-Layer Risk Defense System
 * 
 * Implements multiple stop-loss strategies and market environment filters
 * to protect capital and ensure "living long" in the market.
 */

import { StockQuote } from '../strategies/types';

export type StopLossLevel = 'L1_EMERGENCY' | 'L2_ATR' | 'L3_TRAILING' | 'L4_TIME';

export interface StopLossResult {
    shouldExit: boolean;
    level: StopLossLevel | null;
    stopPrice: number | null;
    currentLoss: number;
    reasoning: string;
}

export interface Position {
    entryPrice: number;
    entryDate: Date;
    currentPrice: number;
    highestPrice: number;
    atr?: number;
}

export class RiskDefenseModule {
    // Constants
    private readonly EMERGENCY_STOP_PCT = 0.07;      // -7% hard stop
    private readonly ATR_MULTIPLIER = 2.0;           // 2x ATR for volatility-based stop
    private readonly TRAILING_STOP_PCT = 0.10;       // 10% trailing after profit
    private readonly PROFIT_THRESHOLD = 0.20;        // 20% profit to activate trailing
    private readonly MAX_HOLD_DAYS = 20;             // Time stop after 20 days

    /**
     * Evaluate all stop-loss layers for a position.
     * @param asOf  Override the wall-clock time (used for simulation / fast-forward). Defaults to Date.now().
     */
    evaluateStopLoss(position: Position, asOf?: Date): StopLossResult {
        const { entryPrice, entryDate, currentPrice, highestPrice, atr } = position;

        const currentPnL = (currentPrice - entryPrice) / entryPrice;
        const nowMs = asOf ? asOf.getTime() : Date.now();
        const daysHeld = Math.floor(
            (nowMs - entryDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Layer 1: Emergency Stop Loss (-7%)
        if (currentPnL <= -this.EMERGENCY_STOP_PCT) {
            return {
                shouldExit: true,
                level: 'L1_EMERGENCY',
                stopPrice: entryPrice * (1 - this.EMERGENCY_STOP_PCT),
                currentLoss: currentPnL,
                reasoning: `Emergency stop triggered: Loss ${(currentPnL * 100).toFixed(1)}% exceeds -7% threshold`
            };
        }

        // Layer 2: ATR-Based Dynamic Stop
        if (atr && currentPrice < (entryPrice - this.ATR_MULTIPLIER * atr)) {
            return {
                shouldExit: true,
                level: 'L2_ATR',
                stopPrice: entryPrice - this.ATR_MULTIPLIER * atr,
                currentLoss: currentPnL,
                reasoning: `ATR stop triggered: Price fell below entry - ${this.ATR_MULTIPLIER}×ATR`
            };
        }

        // Layer 3: Trailing Stop (only after sufficient profit)
        if (currentPnL >= this.PROFIT_THRESHOLD) {
            const trailingStopPrice = highestPrice * (1 - this.TRAILING_STOP_PCT);
            if (currentPrice < trailingStopPrice) {
                return {
                    shouldExit: true,
                    level: 'L3_TRAILING',
                    stopPrice: trailingStopPrice,
                    currentLoss: currentPnL,
                    reasoning: `Trailing stop triggered: Protecting ${(currentPnL * 100).toFixed(1)}% profit, fell ${this.TRAILING_STOP_PCT * 100}% from peak`
                };
            }
        }

        // Layer 4: Time Stop
        if (daysHeld >= this.MAX_HOLD_DAYS && currentPnL < this.PROFIT_THRESHOLD) {
            return {
                shouldExit: true,
                level: 'L4_TIME',
                stopPrice: null,
                currentLoss: currentPnL,
                reasoning: `Time stop: Held ${daysHeld} days without reaching ${this.PROFIT_THRESHOLD * 100}% target`
            };
        }

        // No stop triggered
        return {
            shouldExit: false,
            level: null,
            stopPrice: null,
            currentLoss: currentPnL,
            reasoning: 'All stop-loss layers passed, position is safe'
        };
    }

    /**
     * Calculate recommended stop-loss price for a new position
     */
    calculateStopLossPrice(entryPrice: number, atr?: number): number {
        if (atr) {
            // Use ATR-based stop if available
            const atrStop = entryPrice - this.ATR_MULTIPLIER * atr;
            const emergencyStop = entryPrice * (1 - this.EMERGENCY_STOP_PCT);
            // Use the tighter of the two stops
            return Math.max(atrStop, emergencyStop);
        }

        // Fallback to emergency stop
        return entryPrice * (1 - this.EMERGENCY_STOP_PCT);
    }

    /**
     * Calculate target price based on risk-reward ratio
     */
    calculateTargetPrice(
        entryPrice: number,
        stopLossPrice: number,
        riskRewardRatio: number = 3.0
    ): number {
        const risk = entryPrice - stopLossPrice;
        const reward = risk * riskRewardRatio;
        return entryPrice + reward;
    }

    /**
     * Calculate position size based on 2% risk rule
     */
    calculatePositionSize(
        capital: number,
        entryPrice: number,
        stopLossPrice: number,
        maxRiskPct: number = 0.02
    ): number {
        const riskPerShare = entryPrice - stopLossPrice;
        const maxRiskAmount = capital * maxRiskPct;
        const shares = Math.floor(maxRiskAmount / riskPerShare);

        // Ensure we don't exceed reasonable position
        const maxShares = Math.floor((capital * 0.3) / entryPrice);
        return Math.min(shares, maxShares);
    }
}

/**
 * Market Environment Filter
 * Reduces exposure during unfavorable market conditions
 */
export type MarketRegime = 'BULL' | 'NEUTRAL' | 'CORRECTION' | 'BEAR';

export interface MarketEnvironment {
    regime: MarketRegime;
    scalingFactor: number;  // 0.0 to 1.0, multiplier for position sizes
    reasoning: string;
}

export class MarketEnvironmentFilter {
    /**
     * Determine market regime based on index technical analysis
     */
    assessMarketRegime(
        currentPrice: number,
        ma20: number,
        ma60: number,
        vix?: number
    ): MarketEnvironment {
        // VIX-based panic check
        if (vix && vix > 30) {
            return {
                regime: 'BEAR',
                scalingFactor: 0.25,
                reasoning: `High VIX (${vix.toFixed(1)}): Market panic, reduce exposure 75%`
            };
        }

        // Price vs Moving Averages
        const aboveMA20 = currentPrice > ma20;
        const aboveMA60 = currentPrice > ma60;
        const ma20AboveMA60 = ma20 > ma60;

        // Strong Bull: Price > MA20 > MA60
        if (aboveMA20 && aboveMA60 && ma20AboveMA60) {
            return {
                regime: 'BULL',
                scalingFactor: 1.0,
                reasoning: 'Strong uptrend: All systems go'
            };
        }

        // Correction: Price < MA20 but > MA60
        if (!aboveMA20 && aboveMA60) {
            return {
                regime: 'CORRECTION',
                scalingFactor: 0.5,
                reasoning: 'Short-term correction: Reduce exposure 50%'
            };
        }

        // Bear: Price < MA60
        if (!aboveMA60) {
            return {
                regime: 'BEAR',
                scalingFactor: 0.25,
                reasoning: 'Downtrend: Reduce exposure 75%'
            };
        }

        // Neutral: Mixed signals
        return {
            regime: 'NEUTRAL',
            scalingFactor: 0.75,
            reasoning: 'Mixed signals: Moderate caution'
        };
    }
}

// Singleton exports
export const riskDefenseModule = new RiskDefenseModule();
export const marketEnvironmentFilter = new MarketEnvironmentFilter();
