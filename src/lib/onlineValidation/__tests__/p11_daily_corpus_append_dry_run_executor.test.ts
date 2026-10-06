/**
 * p11_daily_corpus_append_dry_run_executor.test.ts
 * Tests for DailyCorpusAppendDryRunExecutor — P11 Online Validation
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    executeDailyCorpusAppendDryRun,
    validateDailyCorpusAppendDryRunResult,
    EXECUTOR_VERSION,
} from '../DailyCorpusAppendDryRunExecutor';
import {
    buildDailySnapshotAppendPreview,
    type DailySnapshotAppendPreview,
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

function buildExistingCorpus(asOfDates = ['2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14']): CorpusEntry[] {
    const entries: CorpusEntry[] = [];
    for (const asOfDate of asOfDates) {
        for (const symbol of ['2330', '2454']) {
            for (const horizon of ['5D', '20D', '60D']) {
                entries.push(makeCorpusEntry(asOfDate, symbol, horizon));
            }
        }
    }
    return entries;
}

function buildValidPreview(existingCorpus = buildExistingCorpus()): DailySnapshotAppendPreview {
    return buildDailySnapshotAppendPreview(VALID_SEED, existingCorpus, {
        previewRunId: 'p11-preview-test-001',
        generatedAt: '2026-05-11T06:00:00.000Z',
        includeBlocked: true,
    });
}

function makeTempCorpusPath(existingCorpus: CorpusEntry[]): string {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `p11_test_corpus_${Date.now()}.jsonl`);
    const content = existingCorpus.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(tmpFile, content, 'utf8');
    return tmpFile;
}

const DEFAULT_OPTIONS = (corpusPath: string) => ({
    corpusPath,
    corpusRunId: 'p11-corpus-dry-run-20260515-001',
    ingestionDate: '2026-05-11',
    append: false,
    dryRun: true as const,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('executeDailyCorpusAppendDryRun — preview fail blocks append', () => {
    it('returns BLOCKED_DUPLICATE when preview has DUPLICATE_AS_OF_DATE', () => {
        const duplicateSeed = buildDailyRealMarketSnapshotSeed({
            asOfDate: '2026-05-11', // already in corpus
            reviewDate: '2026-07-06',
        });
        const existingCorpus = buildExistingCorpus();
        const preview = buildDailySnapshotAppendPreview(duplicateSeed, existingCorpus, {
            previewRunId: 'fail-preview-001',
            generatedAt: '2026-05-11T00:00:00.000Z',
        });
        const tmpPath = makeTempCorpusPath(existingCorpus);

        const result = executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: true,
        });

        expect(result.appendStatus).toBe('BLOCKED_DUPLICATE');
        expect(result.appendedCount).toBe(0);
        expect(result.validationStatus).toBe('FAIL');
        expect(result.dryRun).toBe(true);

        fs.unlinkSync(tmpPath);
    });

    it('appendedCount is 0 when preview fails', () => {
        const duplicateSeed = buildDailyRealMarketSnapshotSeed({
            asOfDate: '2026-05-12',
            reviewDate: '2026-07-06',
        });
        const existingCorpus = buildExistingCorpus();
        const preview = buildDailySnapshotAppendPreview(duplicateSeed, existingCorpus, {
            previewRunId: 'fail-preview-002',
            generatedAt: '2026-05-11T00:00:00.000Z',
        });
        const tmpPath = makeTempCorpusPath(existingCorpus);

        const result = executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: true,
        });

        expect(result.appendedCount).toBe(0);
        expect(result.totalAfterAppend).toBe(existingCorpus.length);

        fs.unlinkSync(tmpPath);
    });
});

describe('executeDailyCorpusAppendDryRun — append=false only previews', () => {
    it('appendStatus is PREVIEW_ONLY when append=false', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        const result = executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: false,
        });

        expect(result.appendStatus).toBe('PREVIEW_ONLY');
        expect(result.appendedCount).toBe(0);
        expect(result.dryRun).toBe(true);

        // File should not have grown
        const lines = fs.readFileSync(tmpPath, 'utf8').trim().split('\n').filter(Boolean);
        expect(lines.length).toBe(existingCorpus.length);

        fs.unlinkSync(tmpPath);
    });

    it('validationStatus is PASS for preview-only', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        const result = executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: false,
        });

        expect(result.validationStatus).toBe('PASS');

        fs.unlinkSync(tmpPath);
    });
});

describe('executeDailyCorpusAppendDryRun — append=true appends safely', () => {
    it('appends 6 new entries when preview passes', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        const result = executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: true,
        });

        expect(result.appendStatus).toBe('APPENDED');
        expect(result.appendedCount).toBe(6);
        expect(result.totalAfterAppend).toBe(30);
        expect(result.incomingCount).toBe(6);
        expect(result.existingCount).toBe(24);

        // Verify file actually grew
        const lines = fs.readFileSync(tmpPath, 'utf8').trim().split('\n').filter(Boolean);
        expect(lines.length).toBe(30);

        fs.unlinkSync(tmpPath);
    });

    it('all appended entries have write locks false', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: true,
        });

        const lines = fs.readFileSync(tmpPath, 'utf8').trim().split('\n').filter(Boolean);
        for (const line of lines) {
            const entry = JSON.parse(line);
            expect(entry.productionWriteAllowed).toBe(false);
            expect(entry.simulationWriteAllowed).toBe(false);
            expect(entry.optimizerWriteAllowed).toBe(false);
        }

        fs.unlinkSync(tmpPath);
    });

    it('totalAfterAppend = existingCount + appendedCount', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        const result = executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: true,
        });

        expect(result.totalAfterAppend).toBe(result.existingCount + result.appendedCount);

        fs.unlinkSync(tmpPath);
    });

    it('corpus has 5 unique asOfDates after append', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: true,
        });

        const lines = fs.readFileSync(tmpPath, 'utf8').trim().split('\n').filter(Boolean);
        const dates = new Set(lines.map(l => JSON.parse(l).originalAsOfDate));
        expect(dates.size).toBe(5);
        expect(dates.has('2026-05-15')).toBe(true);

        fs.unlinkSync(tmpPath);
    });
});

describe('duplicate key rejected', () => {
    it('second append of same asOfDate is blocked', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        // First append succeeds
        const r1 = executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: true,
        });
        expect(r1.appendStatus).toBe('APPENDED');

        // Read new corpus to build new existing entries
        const newLines = fs.readFileSync(tmpPath, 'utf8').trim().split('\n').filter(Boolean);
        const newCorpus = newLines.map(l => JSON.parse(l) as CorpusEntry);

        // Build second preview with same seed against updated corpus
        const preview2 = buildDailySnapshotAppendPreview(VALID_SEED, newCorpus, {
            previewRunId: 'p11-preview-second-001',
            generatedAt: '2026-05-11T06:00:00.000Z',
        });

        expect(preview2.appendWouldPass).toBe(false);
        expect(
            preview2.appendBlockReasons.includes('DUPLICATE_AS_OF_DATE') ||
            preview2.appendBlockReasons.includes('DUPLICATE_KEY_BLOCKED')
        ).toBe(true);

        // Attempt second append
        const r2 = executeDailyCorpusAppendDryRun(preview2, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: true,
        });
        expect(r2.appendedCount).toBe(0);
        expect(r2.validationStatus).toBe('FAIL');

        fs.unlinkSync(tmpPath);
    });
});

describe('dryRun always true', () => {
    it('dryRun field is always true in result', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        const result = executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: true,
        });

        expect(result.dryRun).toBe(true);

        fs.unlinkSync(tmpPath);
    });

    it('executorVersion is set', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        const result = executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: false,
        });

        expect(result.executorVersion).toBe(EXECUTOR_VERSION);

        fs.unlinkSync(tmpPath);
    });
});

describe('no truncation', () => {
    it('does not truncate existing content', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: true,
        });

        const lines = fs.readFileSync(tmpPath, 'utf8').trim().split('\n').filter(Boolean);
        // All original entries must still be present
        const originalKeys = existingCorpus.map(e => e.corpusEntryKey);
        const fileKeys = lines.map(l => JSON.parse(l).corpusEntryKey);
        for (const key of originalKeys) {
            expect(fileKeys).toContain(key);
        }

        fs.unlinkSync(tmpPath);
    });
});

describe('validateDailyCorpusAppendDryRunResult', () => {
    it('PASS: valid result passes validation', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        const result = executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: false,
        });

        const validation = validateDailyCorpusAppendDryRunResult(result);
        expect(validation.validationStatus).toBe('PASS');

        fs.unlinkSync(tmpPath);
    });

    it('FAIL: dryRun=false fails validation', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        const result = executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: false,
        });
        (result as any).dryRun = false;

        const validation = validateDailyCorpusAppendDryRunResult(result);
        expect(validation.validationStatus).toBe('FAIL');

        fs.unlinkSync(tmpPath);
    });

    it('FAIL: forbidden claim in result fails validation', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        const result = executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: false,
        });
        (result as any).injectedClaim = 'guaranteed outperform profit';

        const validation = validateDailyCorpusAppendDryRunResult(result);
        expect(validation.validationStatus).toBe('FAIL');

        fs.unlinkSync(tmpPath);
    });

    it('does not contain forbidden claims in normal result', () => {
        const existingCorpus = buildExistingCorpus();
        const preview = buildValidPreview(existingCorpus);
        const tmpPath = makeTempCorpusPath(existingCorpus);

        const result = executeDailyCorpusAppendDryRun(preview, {
            ...DEFAULT_OPTIONS(tmpPath),
            append: false,
        });

        expect(JSON.stringify(result)).not.toMatch(/\bprofit\b/i);
        expect(JSON.stringify(result)).not.toMatch(/\bguaranteed\b/i);
        expect(JSON.stringify(result)).not.toMatch(/PRODUCTION_READY/i);

        fs.unlinkSync(tmpPath);
    });
});
