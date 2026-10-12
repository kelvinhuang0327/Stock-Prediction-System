/**
 * Unit Tests for Kelly Calculator
 */

import { KellyCalculator, KellyParameters } from '../KellyCalculator';

describe('KellyCalculator', () => {
    let calculator: KellyCalculator;

    beforeEach(() => {
        calculator = new KellyCalculator();
    });

    describe('calculate', () => {
        it('should calculate correct Kelly fraction for 60% win rate with 2:1 odds', () => {
            const params: KellyParameters = {
                winRate: 0.6,
                avgWin: 0.20,  // 20% average win
                avgLoss: 0.10  // 10% average loss
            };

            const result = calculator.calculate(params);

            // Expected: b = 0.20/0.10 = 2, p = 0.6, q = 0.4
            // Kelly = (2*0.6 - 0.4) / 2 = 0.8 / 2 = 0.40
            expect(result.kellyFraction).toBeCloseTo(0.40, 2);
            expect(result.halfKelly).toBeCloseTo(0.20, 2);
            expect(result.recommended).toBeCloseTo(0.20, 2);
        });

        it('should return zero for negative Kelly (insufficient edge)', () => {
            const params: KellyParameters = {
                winRate: 0.4,   // 40% win rate
                avgWin: 0.10,   // 10% wins
                avgLoss: 0.10   // 10% losses - same size, but losing more often
            };

            const result = calculator.calculate(params);

            expect(result.recommended).toBe(0);
            expect(result.reasoning).toContain('Negative Kelly');
        });

        it('should cap at 30% maximum position', () => {
            const params: KellyParameters = {
                winRate: 0.9,   // Very high win rate
                avgWin: 0.30,
                avgLoss: 0.10
            };

            const result = calculator.calculate(params);

            // This would suggest very high Kelly, but should be capped
            expect(result.recommended).toBeLessThanOrEqual(0.30);
            expect(result.reasoning).toContain('Capped at 30%');
        });

        it('should apply confidence adjustment', () => {
            const params: KellyParameters = {
                winRate: 0.6,
                avgWin: 0.20,
                avgLoss: 0.10,
                confidence: 0.5  // 50% confidence
            };

            const result = calculator.calculate(params);
            const fullConfidenceResult = calculator.calculate({
                ...params,
                confidence: 1.0
            });

            // Should be approximately half due to 50% confidence
            expect(result.recommended).toBeLessThan(fullConfidenceResult.recommended);
        });

        it('should assess risk correctly', () => {
            // High Kelly (>0.5) = High Risk
            const highRisk = calculator.calculate({
                winRate: 0.6,
                avgWin: 0.80,
                avgLoss: 0.10
            });
            expect(highRisk.risk).toBe('HIGH');

            // Normal parameters = Low/Medium risk
            const normalRisk = calculator.calculate({
                winRate: 0.6,
                avgWin: 0.15,
                avgLoss: 0.10
            });
            expect(['LOW', 'MEDIUM']).toContain(normalRisk.risk);
        });
    });

    describe('estimateFromBacktest', () => {
        it('should estimate Kelly parameters from trade history', () => {
            const trades = [
                { pnlPct: 0.15 },
                { pnlPct: 0.12 },
                { pnlPct: -0.08 },
                { pnlPct: 0.18 },
                { pnlPct: -0.07 },
                { pnlPct: 0.20 },
                { pnlPct: -0.09 },
                { pnlPct: 0.14 },
                { pnlPct: 0.16 },
                { pnlPct: -0.06 }
            ];

            const params = calculator.estimateFromBacktest(trades);

            expect(params.winRate).toBeCloseTo(0.6, 1); // 6 wins out of 10
            expect(params.avgWin).toBeGreaterThan(0);
            expect(params.avgLoss).toBeGreaterThan(0);
        });

        it('should throw error for insufficient data', () => {
            const trades = [
                { pnlPct: 0.1 },
                { pnlPct: -0.05 }
            ];

            expect(() => calculator.estimateFromBacktest(trades)).toThrow();
        });
    });

    describe('calculateForStock', () => {
        it('should calculate position for stock with confidence score', () => {
            const historicalPerformance: KellyParameters = {
                winRate: 0.65,
                avgWin: 0.18,
                avgLoss: 0.08
            };

            const result = calculator.calculateForStock(historicalPerformance, 75);

            expect(result.recommended).toBeGreaterThan(0);
            expect(result.reasoning).toContain('75% confidence');
        });
    });
});
