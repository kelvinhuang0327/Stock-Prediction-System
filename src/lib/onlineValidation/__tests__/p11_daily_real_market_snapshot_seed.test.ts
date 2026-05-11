/**
 * p11_daily_real_market_snapshot_seed.test.ts
 * Tests for DailyRealMarketSnapshotSeed — P11 Online Validation
 */

import {
    buildDailyRealMarketSnapshotSeed,
    validateDailyRealMarketSnapshotSeed,
    SEED_VERSION,
    VALID_HORIZONS,
    VALID_SOURCE_MODES,
} from '../DailyRealMarketSnapshotSeed';

const VALID_TRADING_DAY = '2026-05-15'; // Friday, not a holiday
const VALID_REVIEW_DATE = '2026-07-06';
const VALID_SIM_RUN_ID = 'p11-daily-real-market-simulation-20260515-001';

describe('buildDailyRealMarketSnapshotSeed', () => {
    describe('valid seed for 2026-05-15', () => {
        let seed: ReturnType<typeof buildDailyRealMarketSnapshotSeed>;

        beforeEach(() => {
            seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
                simulationRunId: VALID_SIM_RUN_ID,
                symbols: ['2330', '2454'],
                horizons: ['5D', '20D', '60D'],
                sourceMode: 'EXISTING_LOCAL_DATA_ONLY',
            });
        });

        it('has correct seedVersion', () => {
            expect(seed.seedVersion).toBe(SEED_VERSION);
        });

        it('has correct asOfDate', () => {
            expect(seed.asOfDate).toBe('2026-05-15');
        });

        it('has correct reviewDate', () => {
            expect(seed.reviewDate).toBe('2026-07-06');
        });

        it('has correct simulationRunId', () => {
            expect(seed.simulationRunId).toBe(VALID_SIM_RUN_ID);
        });

        it('has correct symbols', () => {
            expect(seed.symbols).toContain('2330');
            expect(seed.symbols).toContain('2454');
        });

        it('has correct horizons', () => {
            expect(seed.horizons).toContain('5D');
            expect(seed.horizons).toContain('20D');
            expect(seed.horizons).toContain('60D');
        });

        it('has correct sourceMode', () => {
            expect(seed.sourceMode).toBe('EXISTING_LOCAL_DATA_ONLY');
        });

        it('tradingDayStatus.isKnownTradingDay is true', () => {
            expect(seed.tradingDayStatus.isKnownTradingDay).toBe(true);
        });

        it('tradingDayStatus has calendarVersion', () => {
            expect(seed.tradingDayStatus.calendarVersion).toBeTruthy();
        });

        it('validationStatus is PASS', () => {
            expect(seed.validationStatus).toBe('PASS');
        });

        it('guardrails are all true', () => {
            expect(seed.guardrails.noProductionWrite).toBe(true);
            expect(seed.guardrails.noExternalApi).toBe(true);
            expect(seed.guardrails.noOptimizerWrite).toBe(true);
            expect(seed.guardrails.noTradingSignal).toBe(true);
            expect(seed.guardrails.observabilityOnly).toBe(true);
        });
    });

    describe('default values', () => {
        it('uses default symbols when not specified', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
            });
            expect(seed.symbols).toContain('2330');
            expect(seed.symbols).toContain('2454');
        });

        it('uses default horizons when not specified', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
            });
            expect(seed.horizons).toEqual(['5D', '20D', '60D']);
        });

        it('uses default sourceMode EXISTING_LOCAL_DATA_ONLY', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
            });
            expect(seed.sourceMode).toBe('EXISTING_LOCAL_DATA_ONLY');
        });

        it('generates default simulationRunId from asOfDate', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
            });
            expect(seed.simulationRunId).toMatch(/20260515/);
        });
    });

    describe('invalid date rejected', () => {
        it('rejects invalid asOfDate format', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: '20260515',
                reviewDate: VALID_REVIEW_DATE,
            });
            expect(seed.validationStatus).toBe('FAIL');
            expect(seed.validationMessages.join(' ')).toMatch(/YYYY-MM-DD/);
        });

        it('rejects invalid reviewDate format', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: 'not-a-date',
            });
            expect(seed.validationStatus).toBe('FAIL');
        });
    });

    describe('non-trading day rejected', () => {
        it('rejects Saturday (2026-05-16)', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: '2026-05-16',
                reviewDate: VALID_REVIEW_DATE,
            });
            expect(seed.validationStatus).toBe('FAIL');
            expect(seed.tradingDayStatus.isKnownTradingDay).toBe(false);
            expect(seed.validationMessages.join(' ')).toMatch(/not a TWSE trading day/);
        });

        it('rejects Sunday (2026-05-17)', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: '2026-05-17',
                reviewDate: VALID_REVIEW_DATE,
            });
            expect(seed.validationStatus).toBe('FAIL');
            expect(seed.tradingDayStatus.isKnownTradingDay).toBe(false);
        });

        it('rejects known TWSE holiday (2026-05-01 Labor Day)', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: '2026-05-01',
                reviewDate: VALID_REVIEW_DATE,
            });
            expect(seed.validationStatus).toBe('FAIL');
            expect(seed.tradingDayStatus.isKnownTradingDay).toBe(false);
        });
    });

    describe('invalid horizon rejected', () => {
        it('rejects unknown horizon label', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
                horizons: ['5D', '30D'],
            });
            expect(seed.validationStatus).toBe('FAIL');
            expect(seed.validationMessages.join(' ')).toMatch(/invalid horizon/);
        });

        it('rejects empty horizons array', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
                horizons: [],
            });
            expect(seed.validationStatus).toBe('FAIL');
        });

        it('accepts all valid horizons', () => {
            for (const h of VALID_HORIZONS) {
                const seed = buildDailyRealMarketSnapshotSeed({
                    asOfDate: VALID_TRADING_DAY,
                    reviewDate: VALID_REVIEW_DATE,
                    horizons: [h],
                });
                expect(seed.validationStatus).toBe('PASS');
            }
        });
    });

    describe('invalid sourceMode rejected', () => {
        it('rejects unknown sourceMode', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
                sourceMode: 'UNKNOWN_MODE' as any,
            });
            expect(seed.validationStatus).toBe('FAIL');
            expect(seed.validationMessages.join(' ')).toMatch(/invalid sourceMode/);
        });

        it('accepts MOCK_LOCAL', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
                sourceMode: 'MOCK_LOCAL',
            });
            expect(seed.validationStatus).toBe('PASS');
        });

        it('accepts EXISTING_LOCAL_DATA_ONLY', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
                sourceMode: 'EXISTING_LOCAL_DATA_ONLY',
            });
            expect(seed.validationStatus).toBe('PASS');
        });
    });

    describe('guardrails all true', () => {
        it('noProductionWrite is always true', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
            });
            expect(seed.guardrails.noProductionWrite).toBe(true);
        });

        it('noExternalApi is always true', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
            });
            expect(seed.guardrails.noExternalApi).toBe(true);
        });

        it('noOptimizerWrite is always true', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
            });
            expect(seed.guardrails.noOptimizerWrite).toBe(true);
        });

        it('noTradingSignal is always true', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
            });
            expect(seed.guardrails.noTradingSignal).toBe(true);
        });

        it('observabilityOnly is always true', () => {
            const seed = buildDailyRealMarketSnapshotSeed({
                asOfDate: VALID_TRADING_DAY,
                reviewDate: VALID_REVIEW_DATE,
            });
            expect(seed.guardrails.observabilityOnly).toBe(true);
        });
    });
});

describe('validateDailyRealMarketSnapshotSeed', () => {
    it('PASS: valid seed passes validation', () => {
        const seed = buildDailyRealMarketSnapshotSeed({
            asOfDate: VALID_TRADING_DAY,
            reviewDate: VALID_REVIEW_DATE,
        });
        const result = validateDailyRealMarketSnapshotSeed(seed);
        expect(result.validationStatus).toBe('PASS');
    });

    it('FAIL: seed with non-trading day fails', () => {
        const seed = buildDailyRealMarketSnapshotSeed({
            asOfDate: '2026-05-16', // Saturday
            reviewDate: VALID_REVIEW_DATE,
        });
        const result = validateDailyRealMarketSnapshotSeed(seed);
        expect(result.validationStatus).toBe('FAIL');
    });

    it('FAIL: seed with invalid sourceMode fails validation', () => {
        const seed = buildDailyRealMarketSnapshotSeed({
            asOfDate: VALID_TRADING_DAY,
            reviewDate: VALID_REVIEW_DATE,
        });
        (seed as any).sourceMode = 'INVALID';
        const result = validateDailyRealMarketSnapshotSeed(seed);
        expect(result.validationStatus).toBe('FAIL');
    });

    it('forbidden claim in seed fails validation', () => {
        const seed = buildDailyRealMarketSnapshotSeed({
            asOfDate: VALID_TRADING_DAY,
            reviewDate: VALID_REVIEW_DATE,
        });
        (seed as any).customField = 'guaranteed profit edge confirmed';
        const result = validateDailyRealMarketSnapshotSeed(seed);
        expect(result.validationStatus).toBe('FAIL');
        expect(result.validationMessages.join(' ')).toMatch(/forbidden claim/i);
    });
});
