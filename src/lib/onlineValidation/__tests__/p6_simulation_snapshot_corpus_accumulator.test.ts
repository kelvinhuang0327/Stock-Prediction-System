/**
 * p6_simulation_snapshot_corpus_accumulator.test.ts
 *
 * Tests for SimulationSnapshotCorpusAccumulator (P6)
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    buildSnapshotCorpusPath,
    buildCorpusEntryKey,
    normalizeSnapshotForCorpus,
    parseSnapshotCorpusJsonl,
    validateCorpusAppend,
    accumulateSnapshotCorpus,
    CORPUS_VERSION,
} from '../SimulationSnapshotCorpusAccumulator';

// ─── Test fixtures ────────────────────────────────────────────────

const mockReadySnapshot: Record<string, unknown> = {
    simulationRunId: 'p5-replay-simulation-20260511-001',
    simulationSnapshotKey: 'SIM_SNAPSHOT|p4-ledger-replay-20260511-001|2026-05-11|2330|MVP_CORE|5D',
    replayKey: 'REPLAY_DATASET|2026-05-11|2330|MVP_CORE|p2-ledger-accumulation-20260511-001|5D',
    originalRunId: 'p2-ledger-accumulation-20260511-001',
    originalAsOfDate: '2026-05-11',
    symbol: '2330',
    stockName: 'TSMC',
    universeTier: 'MVP_CORE',
    horizonLabel: '5D',
    horizonDays: 5,
    targetTradingDate: '2026-05-18',
    reviewDate: '2026-06-30',
    researchBucket: 'WATCH',
    scoreSnapshot: { researchScore: 0.7 },
    confidenceSnapshot: null,
    factorSnapshot: [],
    riskSnapshot: [],
    limitationSnapshot: [],
    dataCoverageSnapshot: null,
    sourceDateBasis: '2026-05-11',
    outcomeSnapshot: { outcomeAvailable: true, returnPct: 2.5 },
    snapshotStatus: 'SNAPSHOT_READY',
    snapshotBlockedReason: 'NONE',
    pitSafeStatus: 'PIT_SAFE',
    productionWriteAllowed: false,
    simulationWriteAllowed: false,
    optimizerWriteAllowed: false,
    validationMessages: [],
};

const mockBlockedSnapshot: Record<string, unknown> = {
    ...mockReadySnapshot,
    simulationSnapshotKey: 'SIM_SNAPSHOT|p4-ledger-replay-20260511-001|2026-05-11|2330|MVP_CORE|20D',
    horizonLabel: '20D',
    horizonDays: 20,
    snapshotStatus: 'SNAPSHOT_BLOCKED',
    snapshotBlockedReason: 'OUTCOME_MISSING',
    outcomeSnapshot: { outcomeAvailable: false },
};

const makeCorpusEntry = (snapshot: Record<string, unknown> = mockReadySnapshot) =>
    normalizeSnapshotForCorpus(snapshot, {
        corpusRunId: 'p6-snapshot-corpus-20260511-001',
        ingestionDate: '2026-05-11',
    });

// ─── buildSnapshotCorpusPath ──────────────────────────────────────

describe('buildSnapshotCorpusPath', () => {
    it('returns absolute path with default baseDir and name', () => {
        const p = buildSnapshotCorpusPath();
        expect(path.isAbsolute(p)).toBe(true);
        expect(p).toContain('outputs/online_validation');
        expect(p).toContain('simulation_snapshot_corpus.jsonl');
    });

    it('respects custom baseDir and corpusName', () => {
        const p = buildSnapshotCorpusPath({ baseDir: '/tmp/test', corpusName: 'corpus.jsonl' });
        expect(p).toBe(path.resolve('/tmp/test/corpus.jsonl'));
    });
});

// ─── buildCorpusEntryKey ──────────────────────────────────────────

describe('buildCorpusEntryKey', () => {
    it('produces deterministic key', () => {
        const k1 = buildCorpusEntryKey(mockReadySnapshot);
        const k2 = buildCorpusEntryKey(mockReadySnapshot);
        expect(k1).toBe(k2);
    });

    it('starts with SIM_CORPUS prefix', () => {
        const k = buildCorpusEntryKey(mockReadySnapshot);
        expect(k).toMatch(/^SIM_CORPUS\|/);
    });

    it('contains symbol and horizonLabel', () => {
        const k = buildCorpusEntryKey(mockReadySnapshot);
        expect(k).toContain('2330');
        expect(k).toContain('5D');
    });

    it('differs for different horizons', () => {
        const k1 = buildCorpusEntryKey(mockReadySnapshot);
        const k2 = buildCorpusEntryKey(mockBlockedSnapshot);
        expect(k1).not.toBe(k2);
    });
});

// ─── normalizeSnapshotForCorpus ───────────────────────────────────

describe('normalizeSnapshotForCorpus', () => {
    it('sets entryType to SIMULATION_SNAPSHOT', () => {
        const e = makeCorpusEntry();
        expect(e.entryType).toBe('SIMULATION_SNAPSHOT');
    });

    it('keeps all three write locks as false', () => {
        const e = makeCorpusEntry();
        expect(e.productionWriteAllowed).toBe(false);
        expect(e.simulationWriteAllowed).toBe(false);
        expect(e.optimizerWriteAllowed).toBe(false);
    });

    it('forces write locks to false even if input says true', () => {
        const e = normalizeSnapshotForCorpus(
            { ...mockReadySnapshot, productionWriteAllowed: true },
            { corpusRunId: 'test', ingestionDate: '2026-05-11' },
        );
        expect(e.productionWriteAllowed).toBe(false);
        expect(e.simulationWriteAllowed).toBe(false);
        expect(e.optimizerWriteAllowed).toBe(false);
    });

    it('sets corpusVersion', () => {
        const e = makeCorpusEntry();
        expect(e.corpusVersion).toBe(CORPUS_VERSION);
    });

    it('SNAPSHOT_BLOCKED can be normalized (blocked stays blocked)', () => {
        const e = makeCorpusEntry(mockBlockedSnapshot);
        expect(e.snapshotStatus).toBe('SNAPSHOT_BLOCKED');
        expect(e.snapshotBlockedReason).toBe('OUTCOME_MISSING');
        expect(e.productionWriteAllowed).toBe(false);
    });

    it('preserves corpusEntryKey', () => {
        const e = makeCorpusEntry();
        expect(e.corpusEntryKey).toContain('SIM_CORPUS|');
    });
});

// ─── parseSnapshotCorpusJsonl ─────────────────────────────────────

describe('parseSnapshotCorpusJsonl', () => {
    it('parses valid JSONL content', () => {
        const entry = makeCorpusEntry();
        const content = JSON.stringify(entry) + '\n';
        const result = parseSnapshotCorpusJsonl(content);
        expect(result).toHaveLength(1);
        expect(result[0].corpusEntryKey).toBe(entry.corpusEntryKey);
    });

    it('ignores empty lines', () => {
        const entry = makeCorpusEntry();
        const content = '\n' + JSON.stringify(entry) + '\n\n';
        const result = parseSnapshotCorpusJsonl(content);
        expect(result).toHaveLength(1);
    });

    it('rejects malformed line with throw', () => {
        const content = '{"valid": true}\n{not json\n';
        expect(() => parseSnapshotCorpusJsonl(content)).toThrow(/Malformed JSONL/);
    });

    it('returns empty array for empty content', () => {
        expect(parseSnapshotCorpusJsonl('')).toHaveLength(0);
        expect(parseSnapshotCorpusJsonl('   \n  \n')).toHaveLength(0);
    });
});

// ─── validateCorpusAppend ─────────────────────────────────────────

describe('validateCorpusAppend', () => {
    it('accepts new entries with empty existing corpus', () => {
        const e = makeCorpusEntry();
        const result = validateCorpusAppend('', [e]);
        expect(result.status).toBe('PASS');
        expect(result.valid).toBe(true);
        expect(result.duplicateKeys).toHaveLength(0);
    });

    it('rejects duplicate corpusEntryKey against existing corpus', () => {
        const e = makeCorpusEntry();
        const existing = JSON.stringify(e) + '\n';
        const result = validateCorpusAppend(existing, [e]);
        expect(result.status).toBe('FAIL');
        expect(result.duplicateKeys).toContain(e.corpusEntryKey);
    });

    it('rejects duplicate corpusEntryKey within new batch', () => {
        const e = makeCorpusEntry();
        const result = validateCorpusAppend('', [e, e]);
        expect(result.status).toBe('FAIL');
        expect(result.duplicateKeys.length).toBeGreaterThan(0);
    });

    it('rejects entries with productionWriteAllowed=true', () => {
        const e = { ...makeCorpusEntry(), productionWriteAllowed: true as unknown as false };
        const result = validateCorpusAppend('', [e]);
        expect(result.status).toBe('FAIL');
    });

    it('rejects forbidden claims in validationMessages', () => {
        const e = { ...makeCorpusEntry(), validationMessages: ['profit guaranteed'] };
        const result = validateCorpusAppend('', [e]);
        expect(result.status).toBe('FAIL');
    });

    it('accepts SNAPSHOT_BLOCKED entry', () => {
        const e = makeCorpusEntry(mockBlockedSnapshot);
        const result = validateCorpusAppend('', [e]);
        expect(result.status).toBe('PASS');
    });
});

// ─── accumulateSnapshotCorpus ─────────────────────────────────────

describe('accumulateSnapshotCorpus', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p6-test-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('append=false previews but does not write file', () => {
        const corpusPath = path.join(tmpDir, 'corpus.jsonl');
        const result = accumulateSnapshotCorpus(
            { snapshots: [mockReadySnapshot] },
            {
                corpusPath,
                corpusRunId: 'test-run',
                ingestionDate: '2026-05-11',
                append: false,
                dryRun: true,
            },
        );
        expect(result.appendStatus).toBe('PASS');
        expect(result.appendedCount).toBe(0);
        expect(fs.existsSync(corpusPath)).toBe(false);
        expect(result.validationMessages.join(' ')).toMatch(/DRY_RUN_PREVIEW|not written/i);
    });

    it('append=true writes corpus file', () => {
        const corpusPath = path.join(tmpDir, 'corpus.jsonl');
        const result = accumulateSnapshotCorpus(
            { snapshots: [mockReadySnapshot] },
            {
                corpusPath,
                corpusRunId: 'test-run',
                ingestionDate: '2026-05-11',
                append: true,
                dryRun: true,
            },
        );
        expect(result.appendStatus).toBe('PASS');
        expect(result.appendedCount).toBe(1);
        expect(fs.existsSync(corpusPath)).toBe(true);
        const content = fs.readFileSync(corpusPath, 'utf8');
        const parsed = parseSnapshotCorpusJsonl(content);
        expect(parsed).toHaveLength(1);
    });

    it('existing corpus cannot be rewritten — duplicate key blocks', () => {
        const corpusPath = path.join(tmpDir, 'corpus.jsonl');
        accumulateSnapshotCorpus(
            { snapshots: [mockReadySnapshot] },
            { corpusPath, corpusRunId: 'run1', ingestionDate: '2026-05-11', append: true, dryRun: true },
        );
        const result = accumulateSnapshotCorpus(
            { snapshots: [mockReadySnapshot] },
            { corpusPath, corpusRunId: 'run1', ingestionDate: '2026-05-11', append: true, dryRun: true },
        );
        expect(result.appendStatus).toBe('FAIL');
        expect(result.duplicateCount).toBeGreaterThan(0);
        // File should still contain only original entry
        const content = fs.readFileSync(corpusPath, 'utf8');
        const parsed = parseSnapshotCorpusJsonl(content);
        expect(parsed).toHaveLength(1);
    });

    it('incomingCount and existingCount are correct', () => {
        const corpusPath = path.join(tmpDir, 'corpus.jsonl');
        const result = accumulateSnapshotCorpus(
            { snapshots: [mockReadySnapshot, mockBlockedSnapshot] },
            { corpusPath, corpusRunId: 'test-run', ingestionDate: '2026-05-11', append: true, dryRun: true },
        );
        expect(result.incomingCount).toBe(2);
        expect(result.existingCount).toBe(0);
        expect(result.totalAfterAppend).toBe(2);
    });

    it('SNAPSHOT_BLOCKED can enter corpus and remains blocked', () => {
        const corpusPath = path.join(tmpDir, 'corpus.jsonl');
        accumulateSnapshotCorpus(
            { snapshots: [mockBlockedSnapshot] },
            { corpusPath, corpusRunId: 'test-run', ingestionDate: '2026-05-11', append: true, dryRun: true },
        );
        const content = fs.readFileSync(corpusPath, 'utf8');
        const parsed = parseSnapshotCorpusJsonl(content);
        expect(parsed[0].snapshotStatus).toBe('SNAPSHOT_BLOCKED');
        expect(parsed[0].productionWriteAllowed).toBe(false);
    });
});
