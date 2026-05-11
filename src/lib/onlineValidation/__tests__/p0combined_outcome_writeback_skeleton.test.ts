/**
 * P0-COMBINED Part C — Outcome Write-back Skeleton Tests
 *
 * Stubs only — all functions throw NOT_YET_IMPLEMENTED.
 * These tests verify the skeleton contract (types + throw behavior).
 *
 * @jest-environment node
 */

import {
    planOutcomeWriteBackTargets,
    resolveOutcomePriceAsOf,
    buildOutcomeWriteBackBatch,
    validateOutcomeWriteBackBatch,
    OutcomeHorizonDays,
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

// ─── planOutcomeWriteBackTargets ──────────────────────────────────

describe('planOutcomeWriteBackTargets (stub)', () => {
    it('throws NOT_YET_IMPLEMENTED', () => {
        const entries = [makeStubEntry('2330')];
        expect(() => planOutcomeWriteBackTargets(entries, 5)).toThrow('NOT_YET_IMPLEMENTED');
    });

    it('throws for 20D horizon too', () => {
        const entries = [makeStubEntry('2330')];
        expect(() => planOutcomeWriteBackTargets(entries, 20)).toThrow('NOT_YET_IMPLEMENTED');
    });

    it('error message contains function name', () => {
        expect(() => planOutcomeWriteBackTargets([], 5)).toThrow('planOutcomeWriteBackTargets');
    });
});

// ─── resolveOutcomePriceAsOf ──────────────────────────────────────

describe('resolveOutcomePriceAsOf (stub)', () => {
    it('throws NOT_YET_IMPLEMENTED', async () => {
        await expect(
            resolveOutcomePriceAsOf('2330', '2026-05-16', '2026-05-16')
        ).rejects.toThrow('NOT_YET_IMPLEMENTED');
    });

    it('error message contains function name', async () => {
        await expect(
            resolveOutcomePriceAsOf('2330', '2026-05-16', '2026-05-16')
        ).rejects.toThrow('resolveOutcomePriceAsOf');
    });

    it('stub accepts (symbol, targetDate, asOfDate) signature', async () => {
        // Verify the function signature is present (type-level test)
        await expect(
            resolveOutcomePriceAsOf('2454', '2026-06-11', '2026-06-11')
        ).rejects.toThrow('NOT_YET_IMPLEMENTED');
    });
});

// ─── buildOutcomeWriteBackBatch ───────────────────────────────────

describe('buildOutcomeWriteBackBatch (stub)', () => {
    it('throws NOT_YET_IMPLEMENTED', () => {
        const entries = [makeStubEntry('2330')];
        expect(() => buildOutcomeWriteBackBatch(entries)).toThrow('NOT_YET_IMPLEMENTED');
    });

    it('error message contains function name', () => {
        expect(() => buildOutcomeWriteBackBatch([])).toThrow('buildOutcomeWriteBackBatch');
    });
});

// ─── validateOutcomeWriteBackBatch ────────────────────────────────

describe('validateOutcomeWriteBackBatch (stub)', () => {
    it('throws NOT_YET_IMPLEMENTED', () => {
        const stubBatch = {
            batchVersion: 'stub',
            runId: 'stub',
            asOfDate: '2026-05-11',
            generatedAt: new Date().toISOString(),
            records: [],
            batchValidationStatus: 'PASS' as const,
            batchValidationMessages: [],
            writeBackAllowed: false as const,
        };
        expect(() => validateOutcomeWriteBackBatch(stubBatch)).toThrow('NOT_YET_IMPLEMENTED');
    });

    it('error message contains function name', () => {
        const stubBatch = {
            batchVersion: 'stub',
            runId: 'stub',
            asOfDate: '2026-05-11',
            generatedAt: new Date().toISOString(),
            records: [],
            batchValidationStatus: 'PASS' as const,
            batchValidationMessages: [],
            writeBackAllowed: false as const,
        };
        expect(() => validateOutcomeWriteBackBatch(stubBatch)).toThrow('validateOutcomeWriteBackBatch');
    });
});
