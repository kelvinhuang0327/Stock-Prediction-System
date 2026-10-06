/**
 * p3active_scoring_historical_replay_writer.test.ts — P3-HARDRESET PART F (Test 2 of 2)
 *
 * Tests for ShadowPredictionHistoricalReplayWriter with P3 active scoring.
 *
 * Coverage:
 * - useActiveScoringSnapshot=true → corpus line has activeScoringSnapshot and scoringCompletenessStatus
 * - EMPTY snapshot still writes corpus line (no silent skip)
 * - outputFilename override works
 * - scoringCompletenessDistribution returned when useActiveScoringSnapshot=true
 * - activeScoringProvider is injectable (no real DB calls in tests)
 * - duplicateKey = symbol|asOfDate|horizonDays deterministic
 * - createdAt = asOfDate + "T00:00:00.000Z" deterministic
 * - P0 corpus file NOT modified
 * - frozen corpus file NOT created in tmpDir
 * - No mock-deterministic priceSource in output
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
    buildHistoricalReplayConfig,
    runHistoricalReplayShadowWrite,
    HistoricalReplayConfig,
    AsOfDateCandidate,
    UniverseEntry,
    OUTPUT_CORPUS_FILENAME,
    FROZEN_CORPUS_FILENAME,
} from '../ShadowPredictionHistoricalReplayWriter';

import {
    ActiveScoringSnapshot,
    ACTIVE_SCORING_BUILDER_VERSION,
    ACTIVE_SCORING_ENGINE_SOURCE,
    ACTIVE_SCORING_MODE,
} from '../ActiveScoringSnapshotBuilder';

import { ResolverOptions } from '../RealPriceOutcomeResolver';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'p3-writer-test-'));
}

function makeHistoricalAsOfDates(dates: string[]): AsOfDateCandidate[] {
    return dates.map(d => ({
        asOfDate: d,
        outcome5dDate: d,
        outcome20dDate: d,
        outcome60dDate: d,
        outcome5dAvailable: true,
        outcome20dAvailable: true,
        outcome60dAvailable: true,
    }));
}

function makeUniverse(symbols: string[]): UniverseEntry[] {
    return symbols.map(s => ({
        symbol: s,
        quoteDays: 200,
        chipDays: 150,
        overlapDays: 180,
    }));
}

/** Builds a Prisma mock for price resolution */
function buildMockPrisma(db: Record<string, number>) {
    const mockFindFirst = jest.fn().mockImplementation(async (args: {
        where?: { stockId?: string; date?: { lte?: string } };
    }) => {
        const stockId = args?.where?.stockId;
        const date = args?.where?.date?.lte;
        if (!stockId || !date) return null;
        const matching = Object.entries(db)
            .filter(([k]) => {
                const [sym, d] = k.split(':');
                return sym === stockId && d <= date;
            })
            .sort(([ka], [kb]) => kb.localeCompare(ka));
        if (matching.length === 0) return null;
        const [key, close] = matching[0];
        const [, rowDate] = key.split(':');
        return { stockId, date: rowDate, close, open: close, high: close, low: close, volume: 1000 };
    });
    return { stockQuote: { findFirst: mockFindFirst } };
}

/** Build a mock ActiveScoringSnapshot (COMPLETE) */
function buildMockCompleteSnapshot(symbol: string, asOfDate: string): ActiveScoringSnapshot {
    return {
        builderVersion: ACTIVE_SCORING_BUILDER_VERSION,
        symbol,
        asOfDate,
        scoringMode: ACTIVE_SCORING_MODE,
        scoringEngineSource: ACTIVE_SCORING_ENGINE_SOURCE,
        researchBucket: 'Strong Candidate',
        alphaScore: 72,
        scoreSnapshot: {
            researchScore: 72,
            confidenceScore: 0,
            technicalScore: 65,
            chipScore: 75,
            fundamentalScore: 0,
            marketAdjustment: 0,
        },
        signalSnapshot: ['MA 趨勢', 'RSI(14)'],
        factorSnapshot: ['MA 趨勢: 多頭 (MA20>MA60)', 'RSI(14): 55.2 (偏多)'],
        reasonSnapshot: '技術偏多',
        limitations: [],
        dataCoverage: 'full',
        dataPoints: 500,
        usedSources: ['StockQuote', 'InstitutionalChip'],
        missingSources: [],
        pitGateDate: asOfDate,
        scoringAvailable: true,
        completenessStatus: 'COMPLETE',
        scoringNote: `dataCoverage=full dataPoints=500 recommendation=偏多`,
    };
}

/** Build a mock ActiveScoringSnapshot (EMPTY) */
function buildMockEmptySnapshot(symbol: string, asOfDate: string): ActiveScoringSnapshot {
    return {
        builderVersion: ACTIVE_SCORING_BUILDER_VERSION,
        symbol,
        asOfDate,
        scoringMode: ACTIVE_SCORING_MODE,
        scoringEngineSource: ACTIVE_SCORING_ENGINE_SOURCE,
        researchBucket: 'Insufficient Data',
        alphaScore: 0,
        scoreSnapshot: {
            researchScore: 0,
            confidenceScore: 0,
            technicalScore: 0,
            chipScore: 0,
            fundamentalScore: 0,
            marketAdjustment: 0,
        },
        signalSnapshot: [],
        factorSnapshot: [],
        reasonSnapshot: '',
        limitations: ['active-scoring-error: DB unavailable'],
        dataCoverage: 'insufficient',
        dataPoints: 0,
        usedSources: [],
        missingSources: ['StockQuote'],
        pitGateDate: asOfDate,
        scoringAvailable: false,
        completenessStatus: 'EMPTY',
        scoringNote: 'error=DB unavailable',
    };
}

// ─── Test data ────────────────────────────────────────────────────────────

const TEST_SYMBOLS = ['2330', '2317'];
const TEST_DATES = ['2024-01-15', '2024-02-15'];
const TEST_HORIZONS = [5, 20, 60];

function buildTestDb(): Record<string, number> {
    const db: Record<string, number> = {};
    for (const sym of TEST_SYMBOLS) {
        for (const d of TEST_DATES) {
            db[`${sym}:${d}`] = 100 + TEST_SYMBOLS.indexOf(sym) * 10;
        }
    }
    return db;
}

// ─── Test suite ────────────────────────────────────────────────────────────

describe('ShadowPredictionHistoricalReplayWriter — P3 Active Scoring (PART F)', () => {
    let tmpDir: string;
    let resolverOptions: ResolverOptions;

    beforeEach(() => {
        tmpDir = makeTmpDir();
        const mockPrisma = buildMockPrisma(buildTestDb());
        resolverOptions = {
            prisma: mockPrisma as unknown as ResolverOptions['prisma'],
            today: '2025-01-01',
        };
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // ── useActiveScoringSnapshot=true ────────────────────────────────────

    it('corpus line has activeScoringSnapshot when useActiveScoringSnapshot=true', async () => {
        const mockProvider = jest.fn().mockImplementation(
            async (symbol: string, asOfDate: string) => buildMockCompleteSnapshot(symbol, asOfDate)
        );

        const config = buildHistoricalReplayConfig({
            outputDir: tmpDir,
            historicalAsOfDates: makeHistoricalAsOfDates(TEST_DATES),
            universe: makeUniverse(TEST_SYMBOLS),
            horizons: TEST_HORIZONS,
            today: '2025-01-01',
            resolverOptions,
            useActiveScoringSnapshot: true,
            activeScoringProvider: mockProvider,
            outputFilename: 'p3test_corpus.jsonl',
        });

        await runHistoricalReplayShadowWrite(config);

        const lines = fs.readFileSync(path.join(tmpDir, 'p3test_corpus.jsonl'), 'utf8')
            .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

        for (const line of lines) {
            expect(line.activeScoringSnapshot).toBeDefined();
            expect(line.activeScoringSnapshot.builderVersion).toBe(ACTIVE_SCORING_BUILDER_VERSION);
        }
    });

    it('corpus line has scoringCompletenessStatus when useActiveScoringSnapshot=true', async () => {
        const mockProvider = jest.fn().mockImplementation(
            async (symbol: string, asOfDate: string) => buildMockCompleteSnapshot(symbol, asOfDate)
        );

        const config = buildHistoricalReplayConfig({
            outputDir: tmpDir,
            historicalAsOfDates: makeHistoricalAsOfDates(TEST_DATES),
            universe: makeUniverse(TEST_SYMBOLS),
            horizons: TEST_HORIZONS,
            today: '2025-01-01',
            resolverOptions,
            useActiveScoringSnapshot: true,
            activeScoringProvider: mockProvider,
            outputFilename: 'p3test_corpus.jsonl',
        });

        await runHistoricalReplayShadowWrite(config);

        const lines = fs.readFileSync(path.join(tmpDir, 'p3test_corpus.jsonl'), 'utf8')
            .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

        for (const line of lines) {
            expect(line.scoringCompletenessStatus).toBeDefined();
            expect(['COMPLETE', 'PARTIAL', 'EMPTY']).toContain(line.scoringCompletenessStatus);
        }
    });

    it('EMPTY snapshot still writes corpus line (no silent skip)', async () => {
        // Inject an EMPTY snapshot provider
        const mockProvider = jest.fn().mockImplementation(
            async (symbol: string, asOfDate: string) => buildMockEmptySnapshot(symbol, asOfDate)
        );

        const config = buildHistoricalReplayConfig({
            outputDir: tmpDir,
            historicalAsOfDates: makeHistoricalAsOfDates(TEST_DATES),
            universe: makeUniverse(TEST_SYMBOLS),
            horizons: TEST_HORIZONS,
            today: '2025-01-01',
            resolverOptions,
            useActiveScoringSnapshot: true,
            activeScoringProvider: mockProvider,
            outputFilename: 'p3empty_corpus.jsonl',
        });

        const result = await runHistoricalReplayShadowWrite(config);

        // All lines must still be written even when snapshot is EMPTY
        const expected = TEST_SYMBOLS.length * TEST_DATES.length * TEST_HORIZONS.length;
        expect(result.linesWritten).toBe(expected);

        const lines = fs.readFileSync(path.join(tmpDir, 'p3empty_corpus.jsonl'), 'utf8')
            .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
        expect(lines).toHaveLength(expected);
        // All should have EMPTY status
        for (const line of lines) {
            expect(line.scoringCompletenessStatus).toBe('EMPTY');
        }
    });

    it('scoringCompletenessDistribution is returned when useActiveScoringSnapshot=true', async () => {
        const mockProvider = jest.fn().mockImplementation(
            async (symbol: string, asOfDate: string) => buildMockCompleteSnapshot(symbol, asOfDate)
        );

        const config = buildHistoricalReplayConfig({
            outputDir: tmpDir,
            historicalAsOfDates: makeHistoricalAsOfDates(TEST_DATES),
            universe: makeUniverse(TEST_SYMBOLS),
            horizons: TEST_HORIZONS,
            today: '2025-01-01',
            resolverOptions,
            useActiveScoringSnapshot: true,
            activeScoringProvider: mockProvider,
            outputFilename: 'p3test_corpus2.jsonl',
        });

        const result = await runHistoricalReplayShadowWrite(config);

        expect(result.scoringCompletenessDistribution).toBeDefined();
        // Since mock returns COMPLETE snapshots, expect COMPLETE count > 0
        const dist = result.scoringCompletenessDistribution!;
        const total = (dist['COMPLETE'] ?? 0) + (dist['PARTIAL'] ?? 0) + (dist['EMPTY'] ?? 0);
        expect(total).toBeGreaterThan(0);
    });

    it('outputFilename override works — creates correct file', async () => {
        const customFilename = 'p3custom_filename_test.jsonl';
        const mockProvider = jest.fn().mockImplementation(
            async (symbol: string, asOfDate: string) => buildMockCompleteSnapshot(symbol, asOfDate)
        );

        const config = buildHistoricalReplayConfig({
            outputDir: tmpDir,
            historicalAsOfDates: makeHistoricalAsOfDates(TEST_DATES),
            universe: makeUniverse(TEST_SYMBOLS),
            horizons: TEST_HORIZONS,
            today: '2025-01-01',
            resolverOptions,
            useActiveScoringSnapshot: true,
            activeScoringProvider: mockProvider,
            outputFilename: customFilename,
        });

        await runHistoricalReplayShadowWrite(config);

        expect(fs.existsSync(path.join(tmpDir, customFilename))).toBe(true);
        // The default P0 filename should NOT be created
        expect(fs.existsSync(path.join(tmpDir, OUTPUT_CORPUS_FILENAME))).toBe(false);
    });

    it('activeScoringProvider is called with (symbol, asOfDate) — PIT-safe per-entry call', async () => {
        const mockProvider = jest.fn().mockImplementation(
            async (symbol: string, asOfDate: string) => buildMockCompleteSnapshot(symbol, asOfDate)
        );

        const config = buildHistoricalReplayConfig({
            outputDir: tmpDir,
            historicalAsOfDates: makeHistoricalAsOfDates(TEST_DATES),
            universe: makeUniverse(TEST_SYMBOLS),
            horizons: TEST_HORIZONS,
            today: '2025-01-01',
            resolverOptions,
            useActiveScoringSnapshot: true,
            activeScoringProvider: mockProvider,
            outputFilename: 'p3_pit_test.jsonl',
        });

        await runHistoricalReplayShadowWrite(config);

        // Provider should be called once per symbol×date (not per horizon)
        const expectedCalls = TEST_SYMBOLS.length * TEST_DATES.length;
        expect(mockProvider).toHaveBeenCalledTimes(expectedCalls);

        // Each call should pass symbol and asOfDate
        for (const call of mockProvider.mock.calls) {
            expect(typeof call[0]).toBe('string'); // symbol
            expect(typeof call[1]).toBe('string'); // asOfDate
            expect(call[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD
        }
    });

    // ── duplicateKey determinism ───────────────────────────────────────────

    it('duplicateKey = symbol|asOfDate|horizonDays (deterministic)', async () => {
        const mockProvider = jest.fn().mockImplementation(
            async (symbol: string, asOfDate: string) => buildMockCompleteSnapshot(symbol, asOfDate)
        );

        const config = buildHistoricalReplayConfig({
            outputDir: tmpDir,
            historicalAsOfDates: makeHistoricalAsOfDates(TEST_DATES),
            universe: makeUniverse(TEST_SYMBOLS),
            horizons: TEST_HORIZONS,
            today: '2025-01-01',
            resolverOptions,
            useActiveScoringSnapshot: true,
            activeScoringProvider: mockProvider,
            outputFilename: 'p3_dedup_test.jsonl',
        });

        await runHistoricalReplayShadowWrite(config);

        const lines = fs.readFileSync(path.join(tmpDir, 'p3_dedup_test.jsonl'), 'utf8')
            .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

        for (const line of lines) {
            const expected = `${line.symbol}|${line.originalAsOfDate}|${line.outcomeSnapshot.horizonDays}`;
            expect(line.duplicateKey).toBe(expected);
        }
    });

    // ── createdAt determinism ──────────────────────────────────────────────

    it('createdAt = asOfDate + "T00:00:00.000Z" (deterministic)', async () => {
        const mockProvider = jest.fn().mockImplementation(
            async (symbol: string, asOfDate: string) => buildMockCompleteSnapshot(symbol, asOfDate)
        );

        const config = buildHistoricalReplayConfig({
            outputDir: tmpDir,
            historicalAsOfDates: makeHistoricalAsOfDates(TEST_DATES),
            universe: makeUniverse(TEST_SYMBOLS),
            horizons: TEST_HORIZONS,
            today: '2025-01-01',
            resolverOptions,
            useActiveScoringSnapshot: true,
            activeScoringProvider: mockProvider,
            outputFilename: 'p3_createdat_test.jsonl',
        });

        await runHistoricalReplayShadowWrite(config);

        const lines = fs.readFileSync(path.join(tmpDir, 'p3_createdat_test.jsonl'), 'utf8')
            .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

        for (const line of lines) {
            expect(line.createdAt).toBe(`${line.originalAsOfDate}T00:00:00.000Z`);
        }
    });

    // ── No mock-deterministic ──────────────────────────────────────────────

    it('no mock-deterministic priceSource in output', async () => {
        const mockProvider = jest.fn().mockImplementation(
            async (symbol: string, asOfDate: string) => buildMockCompleteSnapshot(symbol, asOfDate)
        );

        const config = buildHistoricalReplayConfig({
            outputDir: tmpDir,
            historicalAsOfDates: makeHistoricalAsOfDates(TEST_DATES),
            universe: makeUniverse(TEST_SYMBOLS),
            horizons: TEST_HORIZONS,
            today: '2025-01-01',
            resolverOptions,
            useActiveScoringSnapshot: true,
            activeScoringProvider: mockProvider,
            outputFilename: 'p3_nodet_test.jsonl',
        });

        await runHistoricalReplayShadowWrite(config);

        const lines = fs.readFileSync(path.join(tmpDir, 'p3_nodet_test.jsonl'), 'utf8')
            .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

        for (const line of lines) {
            expect(line.entryPriceSource).not.toBe('mock-deterministic');
            if (line.outcomeSnapshot?.priceSource) {
                expect(line.outcomeSnapshot.priceSource).not.toBe('mock-deterministic');
            }
        }
    });

    // ── Frozen corpus protection ───────────────────────────────────────────

    it('does NOT create simulation_snapshot_corpus.jsonl (frozen corpus) in tmpDir', async () => {
        const mockProvider = jest.fn().mockImplementation(
            async (symbol: string, asOfDate: string) => buildMockCompleteSnapshot(symbol, asOfDate)
        );

        const config = buildHistoricalReplayConfig({
            outputDir: tmpDir,
            historicalAsOfDates: makeHistoricalAsOfDates(TEST_DATES),
            universe: makeUniverse(TEST_SYMBOLS),
            horizons: TEST_HORIZONS,
            today: '2025-01-01',
            resolverOptions,
            useActiveScoringSnapshot: true,
            activeScoringProvider: mockProvider,
            outputFilename: 'p3_frozen_test.jsonl',
        });

        await runHistoricalReplayShadowWrite(config);

        // Frozen corpus must NOT be written
        expect(fs.existsSync(path.join(tmpDir, FROZEN_CORPUS_FILENAME))).toBe(false);
    });

    it('does NOT write to p0hardreset_historical_replay_corpus.jsonl (P0 frozen)', async () => {
        const mockProvider = jest.fn().mockImplementation(
            async (symbol: string, asOfDate: string) => buildMockCompleteSnapshot(symbol, asOfDate)
        );

        const config = buildHistoricalReplayConfig({
            outputDir: tmpDir,
            historicalAsOfDates: makeHistoricalAsOfDates(TEST_DATES),
            universe: makeUniverse(TEST_SYMBOLS),
            horizons: TEST_HORIZONS,
            today: '2025-01-01',
            resolverOptions,
            useActiveScoringSnapshot: true,
            activeScoringProvider: mockProvider,
            outputFilename: 'p3_p0safe_test.jsonl',
        });

        await runHistoricalReplayShadowWrite(config);

        // P0 default corpus filename must NOT be created in tmpDir
        expect(fs.existsSync(path.join(tmpDir, OUTPUT_CORPUS_FILENAME))).toBe(false);
    });

    // ── Score values from active scoring ──────────────────────────────────

    it('corpus line scoreSnapshot.researchScore matches activeScoringSnapshot.alphaScore', async () => {
        const mockProvider = jest.fn().mockImplementation(
            async (symbol: string, asOfDate: string) => buildMockCompleteSnapshot(symbol, asOfDate)
        );

        const config = buildHistoricalReplayConfig({
            outputDir: tmpDir,
            historicalAsOfDates: makeHistoricalAsOfDates(TEST_DATES),
            universe: makeUniverse(TEST_SYMBOLS),
            horizons: TEST_HORIZONS,
            today: '2025-01-01',
            resolverOptions,
            useActiveScoringSnapshot: true,
            activeScoringProvider: mockProvider,
            outputFilename: 'p3_score_test.jsonl',
        });

        await runHistoricalReplayShadowWrite(config);

        const lines = fs.readFileSync(path.join(tmpDir, 'p3_score_test.jsonl'), 'utf8')
            .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

        for (const line of lines) {
            // The mock returns alphaScore=72 for all COMPLETE snapshots
            expect(line.scoreSnapshot.researchScore).toBe(72);
        }
    });

    // ── All lines written ─────────────────────────────────────────────────

    it('correct total lines written (symbols × dates × horizons)', async () => {
        const mockProvider = jest.fn().mockImplementation(
            async (symbol: string, asOfDate: string) => buildMockCompleteSnapshot(symbol, asOfDate)
        );

        const config = buildHistoricalReplayConfig({
            outputDir: tmpDir,
            historicalAsOfDates: makeHistoricalAsOfDates(TEST_DATES),
            universe: makeUniverse(TEST_SYMBOLS),
            horizons: TEST_HORIZONS,
            today: '2025-01-01',
            resolverOptions,
            useActiveScoringSnapshot: true,
            activeScoringProvider: mockProvider,
            outputFilename: 'p3_count_test.jsonl',
        });

        const result = await runHistoricalReplayShadowWrite(config);

        const expected = TEST_SYMBOLS.length * TEST_DATES.length * TEST_HORIZONS.length;
        expect(result.linesWritten).toBe(expected);
    });
});
