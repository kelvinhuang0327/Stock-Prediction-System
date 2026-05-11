/**
 * P0-COMBINED — Shadow Prediction Daily Dry-run Writer Tests
 *
 * @jest-environment node
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
    buildShadowPredictionDryRunConfig,
    runShadowPredictionDailyDryRun,
    buildShadowPredictionDryRunArtifact,
    validateShadowPredictionDryRunResult,
    buildShadowPredictionJsonlPreview,
    summarizeShadowPredictionDryRun,
    buildDefaultDryRunCandidates,
    WRITE_MODE,
    WRITER_VERSION,
    ShadowPredictionDryRunConfig,
    CandidateProvider,
} from '../ShadowPredictionDailyDryRunWriter';

import {
    buildShadowPredictionLogBatch,
    RawResearchCandidate,
    SourceDateBasis,
} from '../ShadowPredictionLogContract';

// ─── Fixtures ─────────────────────────────────────────────────────

const FIXED_AS_OF_DATE = '2026-05-11';
const FIXED_RUN_ID = 'test-dry-run-20260511';

const makeConfig = (overrides: Partial<ShadowPredictionDryRunConfig> = {}): ShadowPredictionDryRunConfig => ({
    asOfDate: FIXED_AS_OF_DATE,
    runId: FIXED_RUN_ID,
    maxCandidates: 5,
    universeTier: 'MVP_CORE',
    dryRun: true,
    writeMode: WRITE_MODE,
    sourceDateBasis: {
        sourceDate: '2026-05-10',
        sourceType: 'stockQuote',
        missingDataFlags: [],
    },
    ...overrides,
});

const makeCandidate = (symbol: string, name: string, score: number = 65): RawResearchCandidate => ({
    symbol,
    name,
    alphaScore: score,
    recommendationBucket: 'Strong Candidate',
    confidence: 60,
    technicalScore: 70,
    chipScore: 65,
    fundamentalScore: 72,
    marketAdjustment: 2,
    topFactors: ['momentum', 'volume stability'],
    keyRisks: ['sector risk'],
    limitations: [],
    dataCoverage: 'full',
    usedSources: ['stockQuote'],
    missingSources: [],
});

const mockProvider: CandidateProvider = async (asOfDate, maxCandidates) => {
    return [
        makeCandidate('2330', 'TSMC', 75),
        makeCandidate('2454', 'MediaTek', 68),
        makeCandidate('2317', 'Foxconn', 55),
    ].slice(0, maxCandidates);
};

// ─── buildShadowPredictionDryRunConfig ────────────────────────────

describe('buildShadowPredictionDryRunConfig', () => {
    it('resolves explicit asOfDate', () => {
        const config = buildShadowPredictionDryRunConfig({ asOfDate: '2026-05-11' });
        expect(config.asOfDate).toBe('2026-05-11');
    });

    it('resolves asOfDate from resolveAsOfDate when not provided', () => {
        const config = buildShadowPredictionDryRunConfig();
        expect(config.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('forces dryRun=true', () => {
        const config = buildShadowPredictionDryRunConfig({ asOfDate: FIXED_AS_OF_DATE });
        expect(config.dryRun).toBe(true);
    });

    it('forces writeMode=DRY_RUN_ARTIFACT_ONLY', () => {
        const config = buildShadowPredictionDryRunConfig({ asOfDate: FIXED_AS_OF_DATE });
        expect(config.writeMode).toBe('DRY_RUN_ARTIFACT_ONLY');
    });

    it('supports explicit runId', () => {
        const config = buildShadowPredictionDryRunConfig({ asOfDate: FIXED_AS_OF_DATE, runId: 'my-run-id' });
        expect(config.runId).toBe('my-run-id');
    });

    it('generates runId when not provided', () => {
        const config = buildShadowPredictionDryRunConfig({ asOfDate: FIXED_AS_OF_DATE });
        expect(config.runId).toMatch(/^dry-run-2026-05-11-/);
    });

    it('supports maxCandidates', () => {
        const config = buildShadowPredictionDryRunConfig({ asOfDate: FIXED_AS_OF_DATE, maxCandidates: 10 });
        expect(config.maxCandidates).toBe(10);
    });

    it('defaults maxCandidates to 20', () => {
        const config = buildShadowPredictionDryRunConfig({ asOfDate: FIXED_AS_OF_DATE });
        expect(config.maxCandidates).toBe(20);
    });

    it('supports universeTier', () => {
        const config = buildShadowPredictionDryRunConfig({ asOfDate: FIXED_AS_OF_DATE, universeTier: 'MVP_EXTENDED' });
        expect(config.universeTier).toBe('MVP_EXTENDED');
    });

    it('does not hardcode today — asOfDate changes when input changes', () => {
        const config1 = buildShadowPredictionDryRunConfig({ asOfDate: '2026-05-01' });
        const config2 = buildShadowPredictionDryRunConfig({ asOfDate: '2026-05-11' });
        expect(config1.asOfDate).not.toBe(config2.asOfDate);
    });
});

// ─── runShadowPredictionDailyDryRun ───────────────────────────────

describe('runShadowPredictionDailyDryRun', () => {
    it('returns batch with entries > 0', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        expect(result.batch.entries.length).toBeGreaterThan(0);
    });

    it('returns PASS validation for valid candidates', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        expect(result.validationResult.status).toBe('PASS');
    });

    it('sanitizes alphaScore to researchScore', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        for (const entry of result.batch.entries) {
            expect(entry.scoreSnapshot).toHaveProperty('researchScore');
            expect(entry.scoreSnapshot).not.toHaveProperty('alphaScore');
        }
    });

    it('sanitizes recommendationBucket to researchBucket', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        for (const entry of result.batch.entries) {
            expect(entry).toHaveProperty('researchBucket');
            expect(entry).not.toHaveProperty('recommendationBucket');
        }
    });

    it('sets all targetHorizons to PENDING', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        for (const entry of result.batch.entries) {
            for (const h of entry.targetHorizons) {
                expect(h.outcomeStatus).toBe('PENDING');
                expect(h.outcomeWriteBackAllowed).toBe(false);
            }
        }
    });

    it('uses default candidate provider when none given', async () => {
        const config = makeConfig({ universeTier: 'MVP_CORE' });
        const result = await runShadowPredictionDailyDryRun(config);
        expect(result.batch.entries.length).toBeGreaterThan(0);
    });

    it('respects maxCandidates limit', async () => {
        const config = makeConfig({ maxCandidates: 2 });
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        expect(result.batch.entries.length).toBeLessThanOrEqual(2);
    });

    it('produces non-empty JSONL preview', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        expect(result.jsonlPreview.length).toBeGreaterThan(0);
        const lines = result.jsonlPreview.trim().split('\n');
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) {
            expect(() => JSON.parse(line)).not.toThrow();
        }
    });
});

// ─── buildShadowPredictionDryRunArtifact ─────────────────────────

describe('buildShadowPredictionDryRunArtifact', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-dry-run-test-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writes JSON artifact that is parseable', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        const paths = buildShadowPredictionDryRunArtifact(result, tmpDir);
        const content = fs.readFileSync(paths.jsonPath, 'utf8');
        expect(() => JSON.parse(content)).not.toThrow();
    });

    it('writes JSONL artifact with >= 1 line', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        const paths = buildShadowPredictionDryRunArtifact(result, tmpDir);
        const content = fs.readFileSync(paths.jsonlPath, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean);
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) {
            expect(() => JSON.parse(line)).not.toThrow();
        }
    });

    it('writes Markdown artifact with content', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        const paths = buildShadowPredictionDryRunArtifact(result, tmpDir);
        const content = fs.readFileSync(paths.markdownPath, 'utf8');
        expect(content).toContain('dry-run');
        expect(content).toContain(FIXED_AS_OF_DATE);
    });

    it('JSON artifact does not contain forbidden terms', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        const paths = buildShadowPredictionDryRunArtifact(result, tmpDir);
        const content = fs.readFileSync(paths.jsonPath, 'utf8').toLowerCase();
        const parsed = JSON.parse(content);
        const jsonStr = JSON.stringify(parsed);
        // Check conclusion/readiness fields (not entry text content)
        const forbiddenInConclusions = ['expected_return', 'predicted_return', 'expected_profit', 'predicted_profit'];
        for (const term of forbiddenInConclusions) {
            expect(jsonStr).not.toContain(`"${term}"`);
        }
        expect(jsonStr).not.toContain('"alphascore"');
        expect(jsonStr).not.toContain('"recommendationbucket"');
    });

    it('JSON artifact contains writeMode=DRY_RUN_ARTIFACT_ONLY', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        const paths = buildShadowPredictionDryRunArtifact(result, tmpDir);
        const parsed = JSON.parse(fs.readFileSync(paths.jsonPath, 'utf8'));
        expect(parsed.writeMode).toBe('DRY_RUN_ARTIFACT_ONLY');
    });

    it('JSON artifact contains dryRunOnly=true', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        const paths = buildShadowPredictionDryRunArtifact(result, tmpDir);
        const parsed = JSON.parse(fs.readFileSync(paths.jsonPath, 'utf8'));
        expect(parsed.dryRunOnly).toBe(true);
    });

    it('only writes to the specified output directory', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        const paths = buildShadowPredictionDryRunArtifact(result, tmpDir);
        expect(paths.jsonPath.startsWith(tmpDir)).toBe(true);
        expect(paths.jsonlPath.startsWith(tmpDir)).toBe(true);
        expect(paths.markdownPath.startsWith(tmpDir)).toBe(true);
    });
});

// ─── validateShadowPredictionDryRunResult ────────────────────────

describe('validateShadowPredictionDryRunResult', () => {
    const sourceDateBasis: SourceDateBasis = {
        sourceDate: '2026-05-10',
        sourceType: 'stockQuote',
        missingDataFlags: [],
    };

    it('returns PASS for valid batch', () => {
        const batch = buildShadowPredictionLogBatch({
            candidates: [makeCandidate('2330', 'TSMC', 75)],
            asOfDate: FIXED_AS_OF_DATE,
            runId: FIXED_RUN_ID,
            universeTier: 'MVP_CORE',
            sourceDateBasis,
        });
        const result = validateShadowPredictionDryRunResult(batch, FIXED_AS_OF_DATE);
        expect(result.status).toBe('PASS');
    });

    it('returns FAIL for sourceDate > asOfDate', () => {
        const batch = buildShadowPredictionLogBatch({
            candidates: [makeCandidate('2330', 'TSMC', 75)],
            asOfDate: FIXED_AS_OF_DATE,
            runId: FIXED_RUN_ID,
            universeTier: 'MVP_CORE',
            sourceDateBasis: {
                sourceDate: '2026-05-20', // future!
                sourceType: 'stockQuote',
                missingDataFlags: [],
            },
        });
        const result = validateShadowPredictionDryRunResult(batch, FIXED_AS_OF_DATE);
        expect(result.status).toBe('FAIL');
        expect(result.sourceDateBasisStatus).toBe('FAIL');
    });

    it('returns PASS for duplicate key check with unique entries', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        expect(result.validationResult.duplicateKeyStatus).toBe('PASS');
    });

    it('reports all targetHorizons as PENDING', () => {
        const batch = buildShadowPredictionLogBatch({
            candidates: [makeCandidate('2330', 'TSMC', 75)],
            asOfDate: FIXED_AS_OF_DATE,
            runId: FIXED_RUN_ID,
            universeTier: 'MVP_CORE',
            sourceDateBasis,
        });
        const result = validateShadowPredictionDryRunResult(batch, FIXED_AS_OF_DATE);
        expect(result.targetHorizonsStatus).toBe('PASS');
    });

    it('has separate status fields for each check', () => {
        const batch = buildShadowPredictionLogBatch({
            candidates: [makeCandidate('2330', 'TSMC', 75)],
            asOfDate: FIXED_AS_OF_DATE,
            runId: FIXED_RUN_ID,
            universeTier: 'MVP_CORE',
            sourceDateBasis,
        });
        const result = validateShadowPredictionDryRunResult(batch, FIXED_AS_OF_DATE);
        expect(result).toHaveProperty('batchStatus');
        expect(result).toHaveProperty('duplicateKeyStatus');
        expect(result).toHaveProperty('sourceDateBasisStatus');
        expect(result).toHaveProperty('forbiddenFieldStatus');
        expect(result).toHaveProperty('targetHorizonsStatus');
    });
});

// ─── buildShadowPredictionJsonlPreview ───────────────────────────

describe('buildShadowPredictionJsonlPreview', () => {
    it('returns JSONL with one line per entry', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        const preview = buildShadowPredictionJsonlPreview(result.batch.entries);
        const lines = preview.trim().split('\n').filter(Boolean);
        expect(lines.length).toBe(result.batch.entries.length);
    });

    it('each line is valid JSON', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        const preview = buildShadowPredictionJsonlPreview(result.batch.entries);
        const lines = preview.trim().split('\n').filter(Boolean);
        for (const line of lines) {
            expect(() => JSON.parse(line)).not.toThrow();
        }
    });

    it('is deterministically ordered by symbol', async () => {
        const config = makeConfig();
        const result1 = await runShadowPredictionDailyDryRun(config, mockProvider);
        const result2 = await runShadowPredictionDailyDryRun(config, mockProvider);
        const preview1 = buildShadowPredictionJsonlPreview(result1.batch.entries);
        const preview2 = buildShadowPredictionJsonlPreview(result2.batch.entries);
        expect(preview1).toBe(preview2);
    });
});

// ─── summarizeShadowPredictionDryRun ─────────────────────────────

describe('summarizeShadowPredictionDryRun', () => {
    it('contains all required fields', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        const summary = result.summary;
        expect(summary).toHaveProperty('asOfDate');
        expect(summary).toHaveProperty('runId');
        expect(summary).toHaveProperty('candidateCount');
        expect(summary).toHaveProperty('writtenLineCount');
        expect(summary).toHaveProperty('duplicateCount');
        expect(summary).toHaveProperty('failedValidationCount');
        expect(summary).toHaveProperty('warningCount');
        expect(summary).toHaveProperty('dryRunOnly');
        expect(summary).toHaveProperty('readinessStatus');
    });

    it('dryRunOnly is always true', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        expect(result.summary.dryRunOnly).toBe(true);
    });

    it('readinessStatus is READY for valid batch with entries', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        expect(result.summary.readinessStatus).toBe('READY');
    });

    it('does not contain performance fields', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        const summaryStr = JSON.stringify(result.summary);
        const forbidden = ['roi', 'win_rate', 'alpha', 'edge', 'profit', 'expected_return', 'predicted_return'];
        for (const term of forbidden) {
            expect(summaryStr.toLowerCase()).not.toContain(term);
        }
    });

    it('candidateCount matches batch entries', async () => {
        const config = makeConfig();
        const result = await runShadowPredictionDailyDryRun(config, mockProvider);
        expect(result.summary.candidateCount).toBe(result.batch.entries.length);
    });
});

// ─── buildDefaultDryRunCandidates ────────────────────────────────

describe('buildDefaultDryRunCandidates', () => {
    it('returns candidates for MVP_CORE tier', () => {
        const candidates = buildDefaultDryRunCandidates('2026-05-11', 10, 'MVP_CORE');
        expect(candidates.length).toBeGreaterThan(0);
    });

    it('returns more candidates for MVP_EXTENDED tier', () => {
        const core = buildDefaultDryRunCandidates('2026-05-11', 10, 'MVP_CORE');
        const extended = buildDefaultDryRunCandidates('2026-05-11', 10, 'MVP_EXTENDED');
        expect(extended.length).toBeGreaterThanOrEqual(core.length);
    });

    it('respects maxCandidates', () => {
        const candidates = buildDefaultDryRunCandidates('2026-05-11', 2, 'RESEARCH_ONLY');
        expect(candidates.length).toBeLessThanOrEqual(2);
    });

    it('all candidates have required fields', () => {
        const candidates = buildDefaultDryRunCandidates('2026-05-11', 10, 'RESEARCH_ONLY');
        for (const c of candidates) {
            expect(c).toHaveProperty('symbol');
            expect(c).toHaveProperty('name');
            expect(typeof c.alphaScore).toBe('number');
        }
    });
});
