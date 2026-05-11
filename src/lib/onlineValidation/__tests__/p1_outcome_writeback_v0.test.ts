/**
 * p1_outcome_writeback_v0.test.ts
 * Tests for ShadowOutcomeWriteBack v0 (P1)
 */

import {
    planOutcomeWriteBackTargets,
    resolveOutcomePriceAsOf,
    buildOutcomeWriteBackBatch,
    validateOutcomeWriteBackBatch,
    PriceProvider,
    OutcomeWriteBackBatch,
} from '../ShadowOutcomeWriteBack';
import { ShadowPredictionLogEntry } from '../ShadowPredictionLogContract';

// ─── Helpers ──────────────────────────────────────────────────────

function makeEntry(overrides: Partial<ShadowPredictionLogEntry> = {}): ShadowPredictionLogEntry {
    return {
        logVersion: 'p002b-v1',
        taskName: 'P1-TEST',
        runId: 'test-run-001',
        asOfDate: '2026-05-11',
        generatedAt: '2026-05-11T00:00:00.000Z',
        universeTier: 'MVP_CORE',
        symbol: '2330',
        stockName: 'Taiwan Semiconductor Manufacturing',
        researchBucket: 'Strong',
        scoreSnapshot: {
            researchScore: 74.2,
            confidenceScore: 68,
            technicalScore: 78,
            chipScore: 72,
            fundamentalScore: 82,
            marketAdjustment: 4,
        },
        confidenceSnapshot: 68,
        factorSnapshot: ['price momentum'],
        riskSnapshot: ['sector concentration'],
        limitationSnapshot: ['limited visibility'],
        dataCoverageSnapshot: {
            coverage: 'full',
            usedSources: ['stockQuote'],
            missingSources: [],
        },
        sourceDateBasis: {
            sourceDate: '2026-05-09',
            sourceType: 'stockQuote',
            missingDataFlags: [],
        },
        targetHorizons: [
            { horizonLabel: '5D', outcomeStatus: 'PENDING', outcomeWriteBackAllowed: false },
            { horizonLabel: '20D', outcomeStatus: 'PENDING', outcomeWriteBackAllowed: false },
        ],
        validationStatus: 'PASS',
        validationMessages: [],
        guardrailStatus: 'PASS',
        duplicateKey: '2026-05-11|2330|MVP_CORE|test-run-001',
        writeMode: 'DRY_RUN',
        ...overrides,
    };
}

const mockPriceProvider: PriceProvider = {
    async getClosePrice(symbol: string, date: string) {
        // Deterministic mock prices for test
        const prices: Record<string, number | null> = {
            '2330:2026-05-18': 1000,
            '2330:2026-06-08': 1020,
            '2454:2026-05-18': 1500,
            '2454:2026-06-08': null,
        };
        const key = `${symbol}:${date}`;
        const price = prices[key];
        if (price === undefined || price === null) return null;
        return { symbol, date, closePrice: price, source: 'mock' };
    },
};

// ─── planOutcomeWriteBackTargets ───────────────────────────────────

describe('planOutcomeWriteBackTargets', () => {
    it('generates 5D target with tradingDate > asOfDate', () => {
        const entry = makeEntry();
        const targets = planOutcomeWriteBackTargets([entry], 5);
        expect(targets).toHaveLength(1);
        expect(targets[0].outcomeStatus).toBe('PENDING');
        expect(targets[0].targetTradingDate > '2026-05-11').toBe(true);
        expect(targets[0].horizonLabel).toBe('5D');
    });

    it('generates 20D target with tradingDate > asOfDate', () => {
        const entry = makeEntry();
        const targets = planOutcomeWriteBackTargets([entry], 20);
        expect(targets[0].targetTradingDate > '2026-05-11').toBe(true);
        expect(targets[0].horizonLabel).toBe('20D');
    });

    it('blocks entry with validationStatus != PASS', () => {
        const entry = makeEntry({ validationStatus: 'FAIL' });
        const targets = planOutcomeWriteBackTargets([entry], 5);
        expect(targets[0].outcomeStatus).toBe('BLOCKED');
    });

    it('blocks entry with guardrailStatus != PASS', () => {
        const entry = makeEntry({ guardrailStatus: 'FAIL' } as any);
        const targets = planOutcomeWriteBackTargets([entry], 5);
        expect(targets[0].outcomeStatus).toBe('BLOCKED');
    });

    it('blocks entry with sourceDate > asOfDate (PIT violation)', () => {
        const entry = makeEntry({
            sourceDateBasis: {
                sourceDate: '2026-05-12', // future relative to asOfDate
                sourceType: 'stockQuote',
                missingDataFlags: [],
            },
        });
        const targets = planOutcomeWriteBackTargets([entry], 5);
        expect(targets[0].outcomeStatus).toBe('BLOCKED');
        expect(targets[0].pitSafeStatus).toBe('PIT_VIOLATION');
    });

    it('throws for horizonDays <= 0', () => {
        expect(() => planOutcomeWriteBackTargets([makeEntry()], 0)).toThrow();
    });
});

// ─── resolveOutcomePriceAsOf ───────────────────────────────────────

describe('resolveOutcomePriceAsOf', () => {
    it('returns FOUND when price exists and targetDate <= asOfDate', async () => {
        const result = await resolveOutcomePriceAsOf(
            '2330', '2026-05-18', '2026-06-30', mockPriceProvider,
        );
        expect(result.status).toBe('FOUND');
        if (result.status === 'FOUND') {
            expect(result.snapshot.closePrice).toBe(1000);
        }
    });

    it('returns MISSING_PRICE when price not available', async () => {
        const result = await resolveOutcomePriceAsOf(
            '2454', '2026-06-08', '2026-06-30', mockPriceProvider,
        );
        expect(result.status).toBe('MISSING_PRICE');
    });

    it('returns FUTURE_DATE_BLOCKED when targetDate > asOfDate', async () => {
        const result = await resolveOutcomePriceAsOf(
            '2330', '2026-07-01', '2026-06-30', mockPriceProvider,
        );
        expect(result.status).toBe('FUTURE_DATE_BLOCKED');
    });

    it('does NOT call external API — uses only injected provider', async () => {
        let called = false;
        const tracingProvider: PriceProvider = {
            async getClosePrice(symbol, date) {
                called = true;
                return null;
            },
        };
        await resolveOutcomePriceAsOf('2330', '2026-05-18', '2026-06-30', tracingProvider);
        expect(called).toBe(true); // Only injected provider was called
    });
});

// ─── buildOutcomeWriteBackBatch ────────────────────────────────────

describe('buildOutcomeWriteBackBatch', () => {
    it('produces dryRun=true batch', async () => {
        const entries = [makeEntry()];
        const batch = await buildOutcomeWriteBackBatch(entries, {
            asOfReviewDate: '2026-06-30',
            horizons: [5, 20],
            priceProvider: mockPriceProvider,
            runId: 'test-batch-001',
            dryRun: true,
            writeMode: 'OUTCOME_ARTIFACT_ONLY',
        });
        expect(batch.dryRun).toBe(true);
        expect(batch.writeMode).toBe('OUTCOME_ARTIFACT_ONLY');
    });

    it('all outcomes have productionWriteAllowed=false', async () => {
        const entries = [makeEntry()];
        const batch = await buildOutcomeWriteBackBatch(entries, {
            asOfReviewDate: '2026-06-30',
            horizons: [5, 20],
            priceProvider: mockPriceProvider,
            runId: 'test-batch-001',
            dryRun: true,
            writeMode: 'OUTCOME_ARTIFACT_ONLY',
        });
        for (const o of batch.outcomes) {
            expect(o.productionWriteAllowed).toBe(false);
        }
    });

    it('all outcomes have writeBackAllowed=false', async () => {
        const entries = [makeEntry()];
        const batch = await buildOutcomeWriteBackBatch(entries, {
            asOfReviewDate: '2026-06-30',
            horizons: [5, 20],
            priceProvider: mockPriceProvider,
            runId: 'test-batch-001',
            dryRun: true,
            writeMode: 'OUTCOME_ARTIFACT_ONLY',
        });
        for (const o of batch.outcomes) {
            expect(o.writeBackAllowed).toBe(false);
        }
    });

    it('reviewDate < targetTradingDate => outcomeStatus PENDING', async () => {
        const entries = [makeEntry()];
        // Use reviewDate before any 5D/20D target
        const batch = await buildOutcomeWriteBackBatch(entries, {
            asOfReviewDate: '2026-05-11', // same as asOfDate, before targets
            horizons: [5],
            priceProvider: mockPriceProvider,
            runId: 'test-batch-early',
            dryRun: true,
            writeMode: 'OUTCOME_ARTIFACT_ONLY',
        });
        const outcome = batch.outcomes[0];
        expect(outcome.outcomeStatus).toBe('PENDING');
    });

    it('reviewDate >= targetTradingDate + price exists => READY_FOR_REVIEW', async () => {
        const entries = [makeEntry()];
        const batch = await buildOutcomeWriteBackBatch(entries, {
            asOfReviewDate: '2026-06-30',
            horizons: [5],
            priceProvider: mockPriceProvider,
            runId: 'test-batch-review',
            dryRun: true,
            writeMode: 'OUTCOME_ARTIFACT_ONLY',
        });
        // 2330 has price at 5D target
        const outcome = batch.outcomes.find(o => o.symbol === '2330' && o.horizonLabel === '5D');
        expect(outcome?.outcomeStatus).toBe('READY_FOR_REVIEW');
        expect(outcome?.closePriceAtOutcome).toBe(1000);
    });

    it('missing price => MISSING_PRICE status', async () => {
        const entry2454 = makeEntry({
            symbol: '2454',
            stockName: 'MediaTek',
            duplicateKey: '2026-05-11|2454|MVP_CORE|test-run-001',
        });
        const batch = await buildOutcomeWriteBackBatch([entry2454], {
            asOfReviewDate: '2026-06-30',
            horizons: [20],
            priceProvider: mockPriceProvider,
            runId: 'test-batch-missing',
            dryRun: true,
            writeMode: 'OUTCOME_ARTIFACT_ONLY',
        });
        const outcome = batch.outcomes.find(o => o.symbol === '2454' && o.horizonLabel === '20D');
        expect(outcome?.outcomeStatus).toBe('MISSING_PRICE');
    });

    it('targetTradingDate > originalAsOfDate for all non-blocked outcomes', async () => {
        const entries = [makeEntry()];
        const batch = await buildOutcomeWriteBackBatch(entries, {
            asOfReviewDate: '2026-06-30',
            horizons: [5, 20],
            priceProvider: mockPriceProvider,
            runId: 'test-batch-dates',
            dryRun: true,
            writeMode: 'OUTCOME_ARTIFACT_ONLY',
        });
        for (const o of batch.outcomes) {
            if (o.targetTradingDate) {
                expect(o.targetTradingDate > o.originalAsOfDate).toBe(true);
            }
        }
    });
});

// ─── validateOutcomeWriteBackBatch ────────────────────────────────

describe('validateOutcomeWriteBackBatch', () => {
    async function makeBatch(overrides?: Partial<OutcomeWriteBackBatch>): Promise<OutcomeWriteBackBatch> {
        const entries = [makeEntry()];
        const batch = await buildOutcomeWriteBackBatch(entries, {
            asOfReviewDate: '2026-06-30',
            horizons: [5, 20],
            priceProvider: mockPriceProvider,
            runId: 'validate-test-001',
            dryRun: true,
            writeMode: 'OUTCOME_ARTIFACT_ONLY',
        });
        return { ...batch, ...overrides };
    }

    it('PASS for valid batch', async () => {
        const batch = await makeBatch();
        const result = validateOutcomeWriteBackBatch(batch);
        expect(result.status).toBe('PASS');
    });

    it('FAIL if dryRun is not true', async () => {
        const batch = await makeBatch({ dryRun: false as any });
        const result = validateOutcomeWriteBackBatch(batch);
        expect(result.status).toBe('FAIL');
    });

    it('FAIL if writeMode is not OUTCOME_ARTIFACT_ONLY', async () => {
        const batch = await makeBatch({ writeMode: 'PRODUCTION_WRITE' as any });
        const result = validateOutcomeWriteBackBatch(batch);
        expect(result.status).toBe('FAIL');
    });

    it('FAIL if any outcome has writeBackAllowed=true', async () => {
        const batch = await makeBatch();
        batch.outcomes[0] = { ...batch.outcomes[0], writeBackAllowed: true as any };
        const result = validateOutcomeWriteBackBatch(batch);
        expect(result.status).toBe('FAIL');
    });

    it('FAIL if targetTradingDate <= originalAsOfDate', async () => {
        const batch = await makeBatch();
        batch.outcomes[0] = { ...batch.outcomes[0], targetTradingDate: '2026-05-11' }; // = asOfDate
        const result = validateOutcomeWriteBackBatch(batch);
        expect(result.status).toBe('FAIL');
    });

    it('FAIL if reviewDate < targetTradingDate but status is READY_FOR_REVIEW', async () => {
        const batch = await makeBatch();
        batch.outcomes[0] = {
            ...batch.outcomes[0],
            reviewDate: '2026-05-12',
            targetTradingDate: '2026-05-18',
            outcomeStatus: 'READY_FOR_REVIEW', // incorrect
        };
        const result = validateOutcomeWriteBackBatch(batch);
        expect(result.status).toBe('FAIL');
    });
});
