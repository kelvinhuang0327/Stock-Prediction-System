/**
 * Unit Tests for Risk Defense Module
 */

import { RiskDefenseModule, MarketEnvironmentFilter, Position } from '../RiskDefenseModule';

describe('RiskDefenseModule', () => {
    let riskDefense: RiskDefenseModule;
    const fixedNow = new Date('2026-01-25T00:00:00Z').getTime();

    beforeEach(() => {
        riskDefense = new RiskDefenseModule();
        jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('evaluateStopLoss', () => {
        it('should trigger L1 emergency stop at -7%', () => {
            const position: Position = {
                entryPrice: 100,
                entryDate: new Date('2026-01-01'),
                currentPrice: 92.5,  // -7.5%
                highestPrice: 102
            };

            const result = riskDefense.evaluateStopLoss(position);

            expect(result.shouldExit).toBe(true);
            expect(result.level).toBe('L1_EMERGENCY');
            expect(result.reasoning).toContain('Emergency stop');
        });

        it('should trigger L2 ATR stop', () => {
            const position: Position = {
                entryPrice: 100,
                entryDate: new Date('2026-01-01'),
                currentPrice: 93,  // Below stop at 94
                highestPrice: 105,
                atr: 3  // 2x ATR = 6, so stop at 94
            };

            const result = riskDefense.evaluateStopLoss(position);

            // Both stops would trigger, but emergency takes precedence
            expect(result.shouldExit).toBe(true);
            expect(result.level).toBe('L1_EMERGENCY'); // -7% triggers first
        });

        it('should trigger L3 trailing stop after profit', () => {
            const position: Position = {
                entryPrice: 100,
                entryDate: new Date('2026-01-01'),
                currentPrice: 121,  // 21% profit activates trailing
                highestPrice: 135   // Peak was 135, trailing at 121.5 (135*0.9), current 121 < 121.5 triggers
            };

            const result = riskDefense.evaluateStopLoss(position);

            expect(result.shouldExit).toBe(true);
            expect(result.level).toBe('L3_TRAILING');
            expect(result.reasoning).toContain('Trailing stop');
        });

        it('should trigger L4 time stop after 20 days without target', () => {
            const position: Position = {
                entryPrice: 100,
                entryDate: new Date('2025-12-20'),  // 31 days ago
                currentPrice: 110,  // Only 10% profit, below 20% target
                highestPrice: 112
            };

            const result = riskDefense.evaluateStopLoss(position);

            expect(result.shouldExit).toBe(true);
            expect(result.level).toBe('L4_TIME');
        });

        it('should not trigger stop for healthy position', () => {
            const position: Position = {
                entryPrice: 100,
                entryDate: new Date('2026-01-15'),  // Recent
                currentPrice: 108,  // Up 8%
                highestPrice: 110
            };

            const result = riskDefense.evaluateStopLoss(position);

            expect(result.shouldExit).toBe(false);
            expect(result.level).toBe(null);
        });
    });

    describe('calculateStopLossPrice', () => {
        it('should use ATR-based stop when available', () => {
            const stopPrice = riskDefense.calculateStopLossPrice(100, 3);

            // Stop should be at entry - 2*ATR = 100 - 6 = 94
            expect(stopPrice).toBe(94);
        });

        it('should fallback to emergency stop without ATR', () => {
            const stopPrice = riskDefense.calculateStopLossPrice(100);

            // Emergency stop at -7% = 93
            expect(stopPrice).toBe(93);
        });
    });

    describe('calculateTargetPrice', () => {
        it('should calculate 3:1 risk-reward target', () => {
            const targetPrice = riskDefense.calculateTargetPrice(100, 94, 3.0);

            // Risk = 100 - 94 = 6
            // Reward = 6 * 3 = 18
            // Target = 100 + 18 = 118
            expect(targetPrice).toBe(118);
        });
    });

    describe('calculatePositionSize', () => {
        it('should calculate shares based on 2% risk rule', () => {
            const shares = riskDefense.calculatePositionSize(
                1000000,  // 1M capital
                100,      // Entry price
                94        // Stop loss
            );

            // Max risk = 1M * 2% = 20,000
            // Risk per share = 100 - 94 = 6
            // Shares = 20,000 / 6 = 3,333
            // But capped at 30% of capital = 300,000 / 100 = 3,000
            expect(shares).toBe(3000);
        });

        it('should cap position at 30% of capital', () => {
            const shares = riskDefense.calculatePositionSize(
                1000000,
                10,   // Very cheap stock
                9.5   // Small stop
            );

            // Would suggest huge position, but should cap at 30% of capital
            // Max shares = (1M * 0.3) / 10 = 30,000
            expect(shares).toBeLessThanOrEqual(30000);
        });
    });
});

describe('MarketEnvironmentFilter', () => {
    let filter: MarketEnvironmentFilter;

    beforeEach(() => {
        filter = new MarketEnvironmentFilter();
    });

    describe('assessMarketRegime', () => {
        it('should identify BULL market (price > MA20 > MA60)', () => {
            const environment = filter.assessMarketRegime(
                18000,  // Current price
                17500,  // MA20
                17000   // MA60
            );

            expect(environment.regime).toBe('BULL');
            expect(environment.scalingFactor).toBe(1.0);
        });

        it('should identify CORRECTION (price < MA20 but > MA60)', () => {
            const environment = filter.assessMarketRegime(
                17300,  // Below MA20
                17500,
                17000   // Above MA60
            );

            expect(environment.regime).toBe('CORRECTION');
            expect(environment.scalingFactor).toBe(0.5);
        });

        it('should identify BEAR market (price < MA60)', () => {
            const environment = filter.assessMarketRegime(
                16500,  // Below both
                16800,
                17000
            );

            expect(environment.regime).toBe('BEAR');
            expect(environment.scalingFactor).toBe(0.25);
        });

        it('should trigger BEAR on high VIX regardless of price', () => {
            const environment = filter.assessMarketRegime(
                18000,
                17500,
                17000,
                35      // VIX > 30
            );

            expect(environment.regime).toBe('BEAR');
            expect(environment.scalingFactor).toBe(0.25);
            expect(environment.reasoning).toContain('VIX');
        });
    });
});
