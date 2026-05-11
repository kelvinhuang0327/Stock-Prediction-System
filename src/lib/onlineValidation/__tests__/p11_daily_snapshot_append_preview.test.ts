/**
 * p11_daily_snapshot_append_preview.test.ts
 * Tests for DailySnapshotAppendPreviewBuilder — P11 Online Validation
 */

import {
    buildDailySnapshotAppendPreview,
    validateDailySnapshotAppendPreview,
    PREVIEW_VERSION,
} from '../DailySnapshotAppendPreviewBuilder';
import { buildDailyRealMarketSnapshotSeed } from '../DailyRealMarketSnapshotSeed';
import type { CorpusEntry } from '../SimulationSnapshotCorpusAccumulator';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_SEED = buildDailyRealMarketSnapshotSeed({
    asOfDate: '2026-05-15',
    reviewDate: '2026-07-06',
    simulationRunId: 'p11-daily-real-market-simulation-20260515-001',
    symbols: ['2330', '2454'],
    horizons: ['5D', '20D', '60D'],
    sourceMode: 'EXISTING_LOCAL_DATA_ONLY',
});

const EXISTING_AS_OF_DATES = ['2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14'];

function makeCorpusEntry(asOfDate: string, symbol: string, horizon: string): CorpusEntry {
    const runId = `p5-replay-simulation-20260511-001`;
    const key = `SIM_CORPUS|${runId}|${asOfDate}|${symbol}|MVP_CORE|${horizon}`;
    return {
        corpusVersion: 'sim-corpus-v0',
        corpusRunId: 'p6-snapshot-corpus-20260511-001',
        corpusEntryKey: key,
        entryType: 'SIMULATION_SNAPSHOT',
        sourceSimulationRunId: runId,
        simulationSnapshotKey: `SIM_SNAPSHOT|${runId}|${asOfDate}|${symbol}|MVP_CORE|${horizon}`,
        replayKey: `REPLAY_DATASET|${asOfDate}|${symbol}|MVP_CORE|${runId}|${horizon}`,
        originalRunId: runId,
        originalAsOfDate: asOfDate,
        symbol,
        stockName: symbol === '2330' ? 'Taiwan Semiconductor Manufacturing' : 'MediaTek',
        universeTier: 'MVP_CORE',
        horizonLabel: horizon,
        horizonDays: horizon === '5D' ? 5 : horizon === '20D' ? 20 : 60,
        targetTradingDate: '2026-05-18',
        reviewDate: '2026-06-30',
        researchBucket: 'Strong',
        scoreSnapshot: {},
        confidenceSnapshot: null,
        factorSnapshot: [],
        riskSnapshot: [],
        limitationSnapshot: [],
        dataCoverageSnapshot: null,
        sourceDateBasis: null,
        outcomeSnapshot: null,
        snapshotStatus: 'SNAPSHOT_READY',
        snapshotBlockedReason: 'NONE',
        pitSafeStatus: 'PIT_SAFE',
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
        createdAt: '2026-05-11T06:00:00.000Z',
        validationMessages: [],
    };
}

function buildExistingCorpus(): CorpusEntry[] {
    const entries: CorpusEntry[] = [];
    for (const asOfDate of EXISTING_AS_OF_DATES) {
        for (const symbol of ['2330', '2454']) {
            for (const horizon of ['5D', '20D', '60D']) {
                entries.push(makeCorpusEntry(asOfDate, symbol, horizon));
            }
        }
    }
    return entries;
}

const EXISTING_CORPUS = buildExistingCorpus(); // 24 entries

const DEFAULT_PREVIEW_OPTIONS = {
    previewRunId: 'p11-preview-test-001',
    generatedAt: '2026-05-11T06:00:00.000Z',
    includeBlocked: true,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildDailySnapshotAppendPreview — new asOfDate', () => {
    let preview: ReturnType<typeof buildDailySnapshotAppendPreview>;

    beforeEach(() => {
        preview = buildDailySnapshotAppendPreview(VALID_SEED, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
    });

    it('has correct previewVersion', () => {
        expect(preview.previewVersion).toBe(PREVIEW_VERSION);
    });

    it('proposedSnapshotCount = 6 (2 symbols × 3 horizons)', () => {
        expect(preview.proposedSnapshotCount).toBe(6);
    });

    it('appendWouldPass is true for new asOfDate', () => {
        expect(preview.appendWouldPass).toBe(true);
    });

    it('duplicateKeyCount is 0', () => {
        expect(preview.duplicateKeyCount).toBe(0);
    });

    it('existingCorpusCount is 24', () => {
        expect(preview.existingCorpusCount).toBe(24);
    });

    it('existingUniqueAsOfDateCount is 4', () => {
        expect(preview.existingUniqueAsOfDateCount).toBe(4);
    });

    it('appendBlockReasons contains NONE', () => {
        expect(preview.appendBlockReasons).toContain('NONE');
    });

    it('validationStatus is PASS', () => {
        expect(preview.validationStatus).toBe('PASS');
    });

    it('all proposed snapshots have snapshotStatus=SNAPSHOT_BLOCKED', () => {
        for (const snap of preview.proposedSnapshots) {
            expect(snap.snapshotStatus).toBe('SNAPSHOT_BLOCKED');
        }
    });

    it('all proposed snapshots have snapshotBlockedReason=WINDOW_NOT_DUE', () => {
        for (const snap of preview.proposedSnapshots) {
            expect(snap.snapshotBlockedReason).toBe('WINDOW_NOT_DUE');
        }
    });

    it('proposed snapshots cover all symbols and horizons', () => {
        const keys = preview.proposedSnapshots.map(s => `${s.symbol}|${s.horizonLabel}`);
        expect(keys).toContain('2330|5D');
        expect(keys).toContain('2330|20D');
        expect(keys).toContain('2330|60D');
        expect(keys).toContain('2454|5D');
        expect(keys).toContain('2454|20D');
        expect(keys).toContain('2454|60D');
    });

    it('proposed snapshots have targetTradingDate after asOfDate', () => {
        for (const snap of preview.proposedSnapshots) {
            expect(snap.targetTradingDate > snap.originalAsOfDate).toBe(true);
        }
    });

    it('proposed snapshots write locks are all false', () => {
        for (const snap of preview.proposedSnapshots) {
            expect(snap.productionWriteAllowed).toBe(false);
            expect(snap.simulationWriteAllowed).toBe(false);
            expect(snap.optimizerWriteAllowed).toBe(false);
        }
    });

    it('proposed snapshots have proposedCorpusEntryKey', () => {
        for (const snap of preview.proposedSnapshots) {
            expect(snap.proposedCorpusEntryKey).toMatch(/^SIM_CORPUS\|/);
        }
    });
});

describe('duplicate asOfDate rejected', () => {
    it('appendWouldPass=false when asOfDate already in corpus', () => {
        const duplicateSeed = buildDailyRealMarketSnapshotSeed({
            asOfDate: '2026-05-11', // already in existing corpus
            reviewDate: '2026-07-06',
        });
        const preview = buildDailySnapshotAppendPreview(duplicateSeed, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        expect(preview.appendWouldPass).toBe(false);
        expect(preview.appendBlockReasons).toContain('DUPLICATE_AS_OF_DATE');
        expect(preview.validationStatus).toBe('FAIL');
    });

    it('validationMessages mentions DUPLICATE_AS_OF_DATE', () => {
        const duplicateSeed = buildDailyRealMarketSnapshotSeed({
            asOfDate: '2026-05-12',
            reviewDate: '2026-07-06',
        });
        const preview = buildDailySnapshotAppendPreview(duplicateSeed, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        expect(preview.validationMessages.join(' ')).toMatch(/DUPLICATE_AS_OF_DATE/);
    });
});

describe('duplicate corpusEntryKey rejected', () => {
    it('appendWouldPass=false when corpusEntryKey already exists', () => {
        // Build a corpus with 2026-05-15 entries already present
        const existingWithDuplicate = [
            ...EXISTING_CORPUS,
            makeCorpusEntry('2026-05-15', '2330', '5D'),
        ];
        // Override the key to match what P11 would generate
        const dupEntry = existingWithDuplicate[existingWithDuplicate.length - 1];
        (dupEntry as any).corpusEntryKey = `SIM_CORPUS|p11-daily-real-market-simulation-20260515-001|2026-05-15|2330|MVP_CORE|5D`;
        (dupEntry as any).originalAsOfDate = '2026-05-15';

        const preview = buildDailySnapshotAppendPreview(VALID_SEED, existingWithDuplicate, DEFAULT_PREVIEW_OPTIONS);
        expect(preview.appendWouldPass).toBe(false);
        expect(preview.appendBlockReasons.some(r => r === 'DUPLICATE_KEY_BLOCKED' || r === 'DUPLICATE_AS_OF_DATE')).toBe(true);
    });
});

describe('no production / optimizer readiness', () => {
    it('does not contain PRODUCTION_READY', () => {
        const preview = buildDailySnapshotAppendPreview(VALID_SEED, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        expect(JSON.stringify(preview)).not.toMatch(/PRODUCTION_READY/);
    });

    it('seed isProductionReady is not present (no such field)', () => {
        const preview = buildDailySnapshotAppendPreview(VALID_SEED, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        expect((preview as any).isProductionReady).toBeUndefined();
    });

    it('does not contain optimizer readiness claim', () => {
        const preview = buildDailySnapshotAppendPreview(VALID_SEED, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        expect(JSON.stringify(preview)).not.toMatch(/optimizer_ready/i);
    });
});

describe('forbidden claims rejected', () => {
    it('does not contain profit', () => {
        const preview = buildDailySnapshotAppendPreview(VALID_SEED, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        expect(JSON.stringify(preview)).not.toMatch(/\bprofit\b/i);
    });

    it('does not contain guaranteed', () => {
        const preview = buildDailySnapshotAppendPreview(VALID_SEED, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        expect(JSON.stringify(preview)).not.toMatch(/\bguaranteed\b/i);
    });

    it('does not contain outperform', () => {
        const preview = buildDailySnapshotAppendPreview(VALID_SEED, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        expect(JSON.stringify(preview)).not.toMatch(/\boutperform\b/i);
    });
});

describe('validateDailySnapshotAppendPreview', () => {
    it('PASS: valid preview passes', () => {
        const preview = buildDailySnapshotAppendPreview(VALID_SEED, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        const result = validateDailySnapshotAppendPreview(preview);
        expect(result.validationStatus).toBe('PASS');
    });

    it('FAIL: appendWouldPass=true with non-zero duplicateKeyCount fails', () => {
        const preview = buildDailySnapshotAppendPreview(VALID_SEED, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        (preview as any).duplicateKeyCount = 3;
        const result = validateDailySnapshotAppendPreview(preview);
        expect(result.validationStatus).toBe('FAIL');
    });

    it('FAIL: productionWriteAllowed=true on a snapshot fails', () => {
        const preview = buildDailySnapshotAppendPreview(VALID_SEED, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        (preview.proposedSnapshots[0] as any).productionWriteAllowed = true;
        const result = validateDailySnapshotAppendPreview(preview);
        expect(result.validationStatus).toBe('FAIL');
    });

    it('FAIL: PRODUCTION_READY in preview fails', () => {
        const preview = buildDailySnapshotAppendPreview(VALID_SEED, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        (preview as any).injectedField = 'PRODUCTION_READY';
        const result = validateDailySnapshotAppendPreview(preview);
        expect(result.validationStatus).toBe('FAIL');
    });

    it('proposed snapshots are deterministic', () => {
        const p1 = buildDailySnapshotAppendPreview(VALID_SEED, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        const p2 = buildDailySnapshotAppendPreview(VALID_SEED, EXISTING_CORPUS, DEFAULT_PREVIEW_OPTIONS);
        const keys1 = p1.proposedSnapshots.map(s => s.proposedCorpusEntryKey).sort();
        const keys2 = p2.proposedSnapshots.map(s => s.proposedCorpusEntryKey).sort();
        expect(keys1).toEqual(keys2);
    });
});
