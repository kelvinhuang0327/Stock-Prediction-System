/**
 * p2_shadow_daily_writer_ledger_integration.test.ts — P2 Integration tests
 *
 * Tests: runShadowPredictionDailyDryRun appendToLedger integration
 * No DB write, no external API, no LLM.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    buildShadowPredictionDryRunConfig,
    runShadowPredictionDailyDryRun,
    CandidateProvider,
} from '../ShadowPredictionDailyDryRunWriter';
import { RawResearchCandidate } from '../ShadowPredictionLogContract';

// ─── Fixtures ─────────────────────────────────────────────────────

function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-writer-integration-'));
}

function makeTestCandidates(): RawResearchCandidate[] {
    return [
        {
            symbol: '2330',
            name: 'Taiwan Semiconductor Manufacturing',
            alphaScore: 74.2,
            recommendationBucket: 'Strong Candidate',
            confidence: 68,
            technicalScore: 78,
            chipScore: 72,
            fundamentalScore: 82,
            marketAdjustment: 4,
            topFactors: ['price momentum above 60-day average'],
            keyRisks: ['sector concentration'],
            limitations: ['limited forward visibility'],
            dataCoverage: 'full',
            usedSources: ['stockQuote'],
            missingSources: [],
        },
        {
            symbol: '2454',
            name: 'MediaTek',
            alphaScore: 68.5,
            recommendationBucket: 'Strong Candidate',
            confidence: 62,
            technicalScore: 70,
            chipScore: 65,
            fundamentalScore: 76,
            marketAdjustment: 3,
            topFactors: ['technical structure improving'],
            keyRisks: ['competitive pressure'],
            limitations: ['chip data T+1 lag'],
            dataCoverage: 'full',
            usedSources: ['stockQuote'],
            missingSources: [],
        },
    ];
}

const mockCandidateProvider: CandidateProvider = async () => makeTestCandidates();

// ─── appendToLedger=false ─────────────────────────────────────────

describe('runShadowPredictionDailyDryRun with appendToLedger=false', () => {
    it('does not write to long-term ledger', async () => {
        const tmpDir = makeTmpDir();
        const ledgerPath = path.join(tmpDir, 'shadow_prediction_ledger.jsonl');

        const config = buildShadowPredictionDryRunConfig({
            asOfDate: '2026-05-11',
            runId: 'test-no-append-001',
            appendToLedger: false,
            ledgerPath,
        });

        await runShadowPredictionDailyDryRun(config, mockCandidateProvider);

        expect(fs.existsSync(ledgerPath)).toBe(false);
    });

    it('returns ledgerAccumulateResult as undefined', async () => {
        const config = buildShadowPredictionDryRunConfig({
            asOfDate: '2026-05-11',
            runId: 'test-no-append-002',
            appendToLedger: false,
        });
        const result = await runShadowPredictionDailyDryRun(config, mockCandidateProvider);
        expect(result.ledgerAccumulateResult).toBeUndefined();
    });
});

// ─── appendToLedger=true ──────────────────────────────────────────

describe('runShadowPredictionDailyDryRun with appendToLedger=true', () => {
    it('writes to shadow_prediction_ledger.jsonl', async () => {
        const tmpDir = makeTmpDir();
        const ledgerPath = path.join(tmpDir, 'shadow_prediction_ledger.jsonl');

        const config = buildShadowPredictionDryRunConfig({
            asOfDate: '2026-05-11',
            runId: 'test-append-001',
            appendToLedger: true,
            ledgerPath,
        });

        const result = await runShadowPredictionDailyDryRun(config, mockCandidateProvider);

        expect(result.ledgerAccumulateResult).toBeDefined();
        expect(result.ledgerAccumulateResult!.appendOnlyStatus).toBe('PASS');
        expect(fs.existsSync(ledgerPath)).toBe(true);

        const content = fs.readFileSync(ledgerPath, 'utf8').trim();
        const lines = content.split('\n');
        expect(lines.length).toBeGreaterThan(0);
    });

    it('all written entries have productionWriteAllowed=false', async () => {
        const tmpDir = makeTmpDir();
        const ledgerPath = path.join(tmpDir, 'shadow_prediction_ledger.jsonl');

        const config = buildShadowPredictionDryRunConfig({
            asOfDate: '2026-05-11',
            runId: 'test-append-prod-guard-001',
            appendToLedger: true,
            ledgerPath,
        });

        await runShadowPredictionDailyDryRun(config, mockCandidateProvider);

        const content = fs.readFileSync(ledgerPath, 'utf8').trim();
        const lines = content.split('\n');
        for (const line of lines) {
            const entry = JSON.parse(line);
            expect(entry.productionWriteAllowed).toBe(false);
        }
    });

    it('duplicate rerun with same runId/asOfDate/symbol fails append guard', async () => {
        const tmpDir = makeTmpDir();
        const ledgerPath = path.join(tmpDir, 'shadow_prediction_ledger.jsonl');

        const config = buildShadowPredictionDryRunConfig({
            asOfDate: '2026-05-11',
            runId: 'test-dedup-run-001',
            appendToLedger: true,
            ledgerPath,
        });

        // First run
        const result1 = await runShadowPredictionDailyDryRun(config, mockCandidateProvider);
        expect(result1.ledgerAccumulateResult!.appendOnlyStatus).toBe('PASS');

        // Same config — same runId — should fail dedup
        const result2 = await runShadowPredictionDailyDryRun(config, mockCandidateProvider);
        expect(result2.ledgerAccumulateResult!.appendOnlyStatus).toBe('FAIL');
        expect(result2.ledgerAccumulateResult!.duplicateCount).toBeGreaterThan(0);
        expect(result2.ledgerAccumulateResult!.appendedCount).toBe(0);
    });

    it('second run with different runId appends successfully', async () => {
        const tmpDir = makeTmpDir();
        const ledgerPath = path.join(tmpDir, 'shadow_prediction_ledger.jsonl');

        // Run 1
        const config1 = buildShadowPredictionDryRunConfig({
            asOfDate: '2026-05-11',
            runId: 'test-run-A',
            appendToLedger: true,
            ledgerPath,
        });
        const r1 = await runShadowPredictionDailyDryRun(config1, mockCandidateProvider);
        expect(r1.ledgerAccumulateResult!.appendOnlyStatus).toBe('PASS');

        // Run 2 — different runId
        const config2 = buildShadowPredictionDryRunConfig({
            asOfDate: '2026-05-12',
            runId: 'test-run-B',
            appendToLedger: true,
            ledgerPath,
        });
        const r2 = await runShadowPredictionDailyDryRun(config2, mockCandidateProvider);
        expect(r2.ledgerAccumulateResult!.appendOnlyStatus).toBe('PASS');

        const content = fs.readFileSync(ledgerPath, 'utf8').trim();
        const lineCount = content.split('\n').length;
        expect(lineCount).toBeGreaterThanOrEqual(2); // at least 2 runs appended
    });

    it('ledger summary has totalEntries > 0', async () => {
        const tmpDir = makeTmpDir();
        const ledgerPath = path.join(tmpDir, 'shadow_prediction_ledger.jsonl');

        const config = buildShadowPredictionDryRunConfig({
            asOfDate: '2026-05-11',
            runId: 'test-summary-001',
            appendToLedger: true,
            ledgerPath,
        });

        const result = await runShadowPredictionDailyDryRun(config, mockCandidateProvider);

        expect(result.ledgerSummary).toBeDefined();
        expect(result.ledgerSummary!.totalEntries).toBeGreaterThan(0);
    });

    it('no external API / no DB write contract maintained', async () => {
        // This test validates the contract by verifying the config has dryRun=true
        // and the result has no production write indicators
        const tmpDir = makeTmpDir();
        const ledgerPath = path.join(tmpDir, 'shadow_prediction_ledger.jsonl');

        const config = buildShadowPredictionDryRunConfig({
            asOfDate: '2026-05-11',
            runId: 'test-contract-001',
            appendToLedger: true,
            ledgerPath,
        });

        expect(config.dryRun).toBe(true);
        expect(config.writeMode).toBe('DRY_RUN_ARTIFACT_ONLY');

        const result = await runShadowPredictionDailyDryRun(config, mockCandidateProvider);
        expect(result.summary.dryRunOnly).toBe(true);

        const content = fs.readFileSync(ledgerPath, 'utf8').trim();
        const lines = content.split('\n');
        for (const line of lines) {
            const entry = JSON.parse(line);
            expect(entry.productionWriteAllowed).toBe(false);
            // No forbidden write fields
            expect(entry).not.toHaveProperty('productionApproved');
            expect(entry).not.toHaveProperty('tradingSignal');
        }
    });
});
