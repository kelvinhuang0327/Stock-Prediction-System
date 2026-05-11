/**
 * P0-COMBINED Part C — Outcome Write-back Skeleton Tests (updated for v0)
 *
 * Originally tested stub behavior. Updated in P1 to verify that:
 * - All 4 functions are exported and callable
 * - Function signatures match the contract
 * - Basic v0 behavior is consistent
 *
 * @jest-environment node
 */

import {
    planOutcomeWriteBackTargets,
    resolveOutcomePriceAsOf,
    buildOutcomeWriteBackBatch,
    validateOutcomeWriteBackBatch,
    PriceProvider,
} from '../ShadowOutcomeWriteBack';

import { ShadowPredictionLogEntry } from '../ShadowPredictionLogContract';

// ─── Fixtures ─────────────────────────────────────────────────────

const makeStubEntry = (symbol: string): ShadowPredictionLogEntry => ({
    logVersion: 'p002b-v1',
    taskName: 'P0-02B',
    runId: 'stub-run',
    asOfDate: '2026-05-11',
    generatedAt: new Date().toISOString(),
    universeTier: 'MVP_CORE',
    symbol,
    stockName: 'Stub Corp',
    researchBucket: 'Strong',
    scoreSnapshot: {
        researchScore: 70,
        confidenceScore: 60,
        technicalScore: 65,
        chipScore: 62,
        fundamentalScore: 72,
        marketAdjustment: 2,
    },
    confidenceSnapshot: 60,
    factorSnapshot: ['momentum'],
    riskSnapshot: ['sector risk'],
    limitationSnapshot: [],
    dataCoverageSnapshot: {
        coverage: 'full',
        usedSources: ['stockQuote'],
        missingSources: [],
    },
    sourceDateBasis: {
        sourceDate: '2026-05-10',
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
    duplicateKey: `2026-05-11|${symbol}|MVP_CORE|stub-run`,
    writeMode: 'DRY_RUN',
});

const nullPriceProvider: PriceProvider = {
    async getClosePrice() { return null; },
};

// ─── planOutcomeWriteBackTargets ──────────────────────────────────

describe('planOutcomeWriteBackTargets (v0 — was stub)', () => {
    it('is exported and callable', () => {
        expect(typeof planOutcomeWriteBackTargets).toBe('function');
    });

    it('returns targets array for valid entries', () => {
        const entries = [makeStubEntry('2330')];
        const targets = planOutcomeWriteBackTargets(entries, 5);
        expect(Array.isArray(targets)).toBe(true);
    });

    it('5D target has horizonLabel="5D"', () => {
        const entries = [makeStubEntry('2330')];
        const targets = planOutcomeWriteBackTargets(entries, 5);
        expect(targets[0].horizonLabel).toBe('5D');
    });

    it('20D target has horizonLabel="20D"', () => {
        const entries = [makeStubEntry('2330')];
        const targets = planOutcomeWriteBackTargets(entries, 20);
        expect(targets[0].horizonLabel).toBe('20D');
    });

    it('throws for horizonDays=0', () => {
        expect(() => planOutcomeWriteBackTargets([], 0)).toThrow();
    });
});

// ─── resolveOutcomePriceAsOf ──────────────────────────────────────

describe('resolveOutcomePriceAsOf (v0 — was stub)', () => {
    it('is exported and callable', () => {
        expect(typeof resolveOutcomePriceAsOf).toBe('function');
    });

    it('accepts (symbol, targetDate, asOfDate, priceProvider) signature', async () => {
        const result = await resolveOutcomePriceAsOf(
            '2330', '2026-05-18', '2026-06-30', nullPriceProvider,
        );
        expect(result).toBeDefined();
    });

    it('returns MISSING_PRICE when provider returns null', async () => {
        const result = await resolveOutcomePriceAsOf(
            '2330', '2026-05-18', '2026-06-30', nullPriceProvider,
        );
        expect(result.status).toBe('MISSING_PRICE');
    });

    it('returns FUTURE_DATE_BLOCKED when targetDate > asOfDate', async () => {
        const result = await resolveOutcomePriceAsOf(
            '2330', '2026-07-01', '2026-06-30', nullPriceProvider,
        );
        expect(result.status).toBe('FUTURE_DATE_BLOCKED');
    });
});

// ─── buildOutcomeWriteBackBatch ───────────────────────────────────

describe('buildOutcomeWriteBackBatch (v0 — was stub)', () => {
    it('is exported and callable', () => {
        expect(typeof buildOutcomeWriteBackBatch).toBe('function');
    });

    it('returns batch with dryRun=true', async () => {
        const entries = [makeStubEntry('2330')];
        const batch = await buildOutcomeWriteBackBatch(entries, {
            asOfReviewDate: '2026-06-30',
            horizons: [5],
            priceProvider: nullPriceProvider,
            runId: 'stub-batch',
            dryRun: true,
            writeMode: 'OUTCOME_ARTIFACT_ONLY',
        });
        expect(batch.dryRun).toBe(true);
        expect(batch.writeMode).toBe('OUTCOME_ARTIFACT_ONLY');
    });

    it('all outcomes have productionWriteAllowed=false', async () => {
        const entries = [makeStubEntry('2330')];
        const batch = await buildOutcomeWriteBackBatch(entries, {
            asOfReviewDate: '2026-06-30',
            horizons: [5],
            priceProvider: nullPriceProvider,
            runId: 'stub-batch',
            dryRun: true,
            writeMode: 'OUTCOME_ARTIFACT_ONLY',
        });
        for (const o of batch.outcomes) {
            expect(o.productionWriteAllowed).toBe(false);
        }
    });
});

// ─── validateOutcomeWriteBackBatch ────────────────────────────────

describe('validateOutcomeWriteBackBatch (v0 — was stub)', () => {
    it('is exported and callable', () => {
        expect(typeof validateOutcomeWriteBackBatch).toBe('function');
    });

    it('returns PASS for valid dryRun batch', async () => {
        const entries = [makeStubEntry('2330')];
        const batch = await buildOutcomeWriteBackBatch(entries, {
            asOfReviewDate: '2026-06-30',
            horizons: [5],
            priceProvider: nullPriceProvider,
            runId: 'validate-stub',
            dryRun: true,
            writeMode: 'OUTCOME_ARTIFACT_ONLY',
        });
        const result = validateOutcomeWriteBackBatch(batch);
        expect(result.status).toBe('PASS');
    });

    it('returns FAIL if writeMode is not OUTCOME_ARTIFACT_ONLY', async () => {
        const entries = [makeStubEntry('2330')];
        const batch = await buildOutcomeWriteBackBatch(entries, {
            asOfReviewDate: '2026-06-30',
            horizons: [5],
            priceProvider: nullPriceProvider,
            runId: 'validate-stub',
            dryRun: true,
            writeMode: 'OUTCOME_ARTIFACT_ONLY',
        });
        const result = validateOutcomeWriteBackBatch({ ...batch, writeMode: 'OTHER' as any });
        expect(result.status).toBe('FAIL');
    });
});
