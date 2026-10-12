/**
 * p12_multi_date_daily_append_executor.test.ts
 * Tests for MultiDateDailyAppendExecutor — P12 Online Validation
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    executeMultiDateDailyAppendDryRun,
    validateMultiDateDailyAppendDryRunResult,
    MULTI_DATE_EXECUTOR_VERSION,
} from '../MultiDateDailyAppendExecutor';
import {
    buildMultiDateDailyAppendPlan,
    type MultiDateDailyAppendPlan,
} from '../MultiDateDailyAppendPlan';
import { parseSnapshotCorpusJsonl } from '../SimulationSnapshotCorpusAccumulator';

const BASE_CORPUS_PATH = path.resolve(
    process.cwd(),
    'outputs/online_validation/simulation_snapshot_corpus.jsonl',
);

function makeTempCorpusPath(): string {
    const tmpFile = path.join(os.tmpdir(), `p12_test_corpus_${Date.now()}_${Math.random()}.jsonl`);
    const sourceCorpus = readCorpus(BASE_CORPUS_PATH);
    const fixtureCorpus = sourceCorpus.slice(0, 30);
    fs.writeFileSync(
        tmpFile,
        fixtureCorpus.map(entry => JSON.stringify(entry)).join('\n') + '\n',
        'utf8',
    );
    return tmpFile;
}

function readCorpus(pathname: string) {
    const content = fs.readFileSync(pathname, 'utf8');
    return parseSnapshotCorpusJsonl(content);
}

function buildValidPlan(): MultiDateDailyAppendPlan {
    return buildMultiDateDailyAppendPlan({
        planRunId: 'p12-test-plan-001',
        reviewDateByAsOfDate: {
            '2026-05-18': '2026-07-07',
            '2026-05-19': '2026-07-08',
            '2026-05-20': '2026-07-09',
            '2026-05-21': '2026-07-10',
            '2026-05-22': '2026-07-13',
        },
    });
}

describe('MultiDateDailyAppendExecutor — P12', () => {
    it('executes 5 dates successfully', () => {
        const plan = buildValidPlan();
        const tmpPath = makeTempCorpusPath();

        const result = executeMultiDateDailyAppendDryRun(plan, {
            corpusPath: tmpPath,
            append: true,
            dryRun: true,
        });

        expect(result.executorVersion).toBe(MULTI_DATE_EXECUTOR_VERSION);
        expect(result.dryRun).toBe(true);
        expect(result.append).toBe(true);
        expect(result.requestedDateCount).toBe(5);
        expect(result.successfulDateCount).toBe(5);
        expect(result.blockedDateCount).toBe(0);
        expect(result.failedDateCount).toBe(0);
        expect(result.beforeCorpusCount).toBe(30);
        expect(result.afterCorpusCount).toBe(60);
        expect(result.beforeUniqueAsOfDateCount).toBe(5);
        expect(result.afterUniqueAsOfDateCount).toBe(10);
        expect(result.totalIncomingSnapshots).toBe(30);
        expect(result.totalAppendedSnapshots).toBe(30);
        expect(result.dateResults).toHaveLength(5);
        expect(validateMultiDateDailyAppendDryRunResult(result).validationStatus).toBe('PASS');

        const corpus = readCorpus(tmpPath);
        expect(corpus.length).toBe(60);
        expect(new Set(corpus.map(entry => entry.originalAsOfDate)).size).toBe(10);

        fs.unlinkSync(tmpPath);
    });

    it('append=false does not write', () => {
        const plan = buildValidPlan();
        const tmpPath = makeTempCorpusPath();
        const before = readCorpus(tmpPath).length;

        const result = executeMultiDateDailyAppendDryRun(plan, {
            corpusPath: tmpPath,
            append: false,
            dryRun: true,
        });

        const after = readCorpus(tmpPath).length;
        expect(result.append).toBe(false);
        expect(result.dryRun).toBe(true);
        expect(after).toBe(before);
        expect(result.afterCorpusCount).toBe(result.beforeCorpusCount);
        expect(result.totalAppendedSnapshots).toBe(0);
        expect(validateMultiDateDailyAppendDryRunResult(result).validationStatus).toBe('PASS');

        fs.unlinkSync(tmpPath);
    });

    it('duplicate date is blocked on re-run', () => {
        const plan = buildValidPlan();
        const tmpPath = makeTempCorpusPath();

        const firstResult = executeMultiDateDailyAppendDryRun(plan, {
            corpusPath: tmpPath,
            append: true,
            dryRun: true,
        });
        expect(firstResult.afterCorpusCount).toBe(60);

        const rerun = executeMultiDateDailyAppendDryRun(plan, {
            corpusPath: tmpPath,
            append: true,
            dryRun: true,
        });

        expect(rerun.dateResults[0].appendStatus).toBe('BLOCKED_DUPLICATE');
        expect(rerun.dateResults).toHaveLength(1);
        expect(rerun.blockedDateCount).toBe(1);
        expect(rerun.successfulDateCount).toBe(0);
        expect(rerun.totalAppendedSnapshots).toBe(0);
        expect(rerun.afterCorpusCount).toBe(rerun.beforeCorpusCount);
        expect(validateMultiDateDailyAppendDryRunResult(rerun).validationStatus).toBe('PASS');

        fs.unlinkSync(tmpPath);
    });

    it('stopOnFirstFailure works', () => {
        const plan = buildValidPlan();
        const mutated: MultiDateDailyAppendPlan = {
            ...plan,
            dates: [
                {
                    ...plan.dates[0],
                    asOfDate: '2026-05-15',
                    simulationRunId: 'p12-daily-real-market-simulation-20260515-001',
                },
                ...plan.dates.slice(1),
            ],
        };
        const tmpPath = makeTempCorpusPath();

        const result = executeMultiDateDailyAppendDryRun(mutated, {
            corpusPath: tmpPath,
            append: true,
            dryRun: true,
            stopOnFirstFailure: true,
        });

        expect(result.dateResults).toHaveLength(1);
        expect(result.dateResults[0].appendStatus).toBe('BLOCKED_DUPLICATE');
        expect(result.blockedDateCount).toBe(1);
        expect(result.afterCorpusCount).toBe(result.beforeCorpusCount);

        fs.unlinkSync(tmpPath);
    });

    it('dryRun is always true and guardrails remain active', () => {
        const plan = buildValidPlan();
        const tmpPath = makeTempCorpusPath();

        const result = executeMultiDateDailyAppendDryRun(plan, {
            corpusPath: tmpPath,
            append: true,
            dryRun: true,
        });

        expect(result.dryRun).toBe(true);
        expect(result.guardrails.noProductionWrite).toBe(true);
        expect(result.guardrails.noDbWrite).toBe(true);
        expect(result.guardrails.noExternalApi).toBe(true);
        expect(result.guardrails.noLlm).toBe(true);
        expect(result.guardrails.noOptimizerWrite).toBe(true);
        expect(result.guardrails.noAutoTrading).toBe(true);
        expect(result.guardrails.noPerformanceClaim).toBe(true);
        expect(result.guardrails.observabilityOnly).toBe(true);

        fs.unlinkSync(tmpPath);
    });

    it('forbidden claims are rejected', () => {
        const plan = buildValidPlan();
        const mutated = {
            ...plan,
            validationMessages: ['profit', 'outperform'],
        };
        const tmpPath = makeTempCorpusPath();

        const result = executeMultiDateDailyAppendDryRun(mutated as MultiDateDailyAppendPlan, {
            corpusPath: tmpPath,
            append: true,
            dryRun: true,
        });

        expect(result.validationStatus).toBe('FAIL');
        expect(result.validationMessages.join(' ')).toMatch(/forbidden/i);

        fs.unlinkSync(tmpPath);
    });

    it('does not contain production or optimizer write claims', () => {
        const plan = buildValidPlan();
        const tmpPath = makeTempCorpusPath();

        const result = executeMultiDateDailyAppendDryRun(plan, {
            corpusPath: tmpPath,
            append: true,
            dryRun: true,
        });

        expect(JSON.stringify(result)).not.toMatch(/PRODUCTION_READY/i);
        expect(JSON.stringify(result)).not.toMatch(/\bprofit\b/i);
        expect(JSON.stringify(result)).not.toMatch(/\boutperform\b/i);

        fs.unlinkSync(tmpPath);
    });
});
