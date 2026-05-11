/**
 * p13_coverage_recovery_planner.test.ts
 * P13 — CoverageRecoveryPlanner tests
 */

import * as fs from 'fs';
import * as path from 'path';

import {
    buildCoverageRecoveryPlan,
    validateCoverageRecoveryPlan,
    COVERAGE_RECOVERY_PLAN_VERSION,
    type CoverageRecoveryPlan,
} from '../CoverageRecoveryPlanner';
import {
    buildHorizonMaturityTracker,
    type HorizonMaturityTracker,
} from '../HorizonMaturityTracker';
import { parseSnapshotCorpusJsonl } from '../SimulationSnapshotCorpusAccumulator';
import type { CorpusMetrics } from '../CorpusMetricsStore';
import type { CorpusQualityGateResult } from '../CorpusQualityGate';

const CORPUS_PATH = path.resolve(process.cwd(), 'outputs/online_validation/simulation_snapshot_corpus.jsonl');
const P12_METRICS_PATH = path.resolve(process.cwd(), 'outputs/online_validation/p12_corpus_metrics_store.json');
const P12_QUALITY_PATH = path.resolve(process.cwd(), 'outputs/online_validation/p12_corpus_quality_gate.json');

function loadCorpus() {
    return parseSnapshotCorpusJsonl(fs.readFileSync(CORPUS_PATH, 'utf8'));
}

function loadJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function makeTinyTracker(overrides: Partial<HorizonMaturityTracker> = {}): HorizonMaturityTracker {
    return {
        trackerVersion: 'horizon-maturity-tracker-v0',
        trackerRunId: 'tiny-tracker',
        generatedAt: '2026-05-11T08:00:00.000Z',
        reviewDate: '2026-07-13',
        inputCorpusEntryCount: 6,
        totalEntries: 6,
        horizonSummaries: [
            {
                horizonLabel: '60D',
                totalCount: 6,
                readyCount: 0,
                blockedCount: 6,
                coverageRatio: 0,
                blockedReasonCounts: { WINDOW_NOT_DUE: 6 },
                earliestAsOfDate: '2026-05-11',
                latestAsOfDate: '2026-05-11',
                earliestTargetTradingDate: '2026-08-04',
                latestTargetTradingDate: '2026-08-04',
                dueCount: 0,
                notDueCount: 6,
                missingOutcomeCount: 0,
                maturityRatio: 0,
                maturityStatus: 'NOT_DUE_DOMINANT',
            },
        ],
        maturityStatus: 'IMMATURE',
        guardrails: {
            noProductionWrite: true,
            noSimulationWrite: true,
            noOptimizerWrite: true,
            noPerformanceClaim: true,
            noTradingSignal: true,
            observabilityOnly: true,
        },
        validationStatus: 'PASS',
        validationMessages: [],
        ...overrides,
    };
}

describe('CoverageRecoveryPlanner — P13', () => {
    const corpusEntries = loadCorpus();
    const corpusMetrics = loadJson<CorpusMetrics>(P12_METRICS_PATH);
    const corpusQualityGate = loadJson<CorpusQualityGateResult>(P12_QUALITY_PATH);
    const tracker = buildHorizonMaturityTracker(corpusEntries, {
        trackerRunId: 'p13-horizon-maturity-20260511-001',
        generatedAt: '2026-05-11T08:00:00.000Z',
        reviewDate: '2026-07-13',
    });

    const plan = buildCoverageRecoveryPlan(
        {
            horizonMaturityTracker: tracker,
            corpusQualityGate,
            corpusMetrics,
        },
        {
            recoveryRunId: 'p13-coverage-recovery-20260511-001',
            generatedAt: '2026-05-11T08:00:00.000Z',
            targetCoverageRatio: 0.5,
            targetHorizonCoverageGap: 0.35,
            targetUniqueAsOfDateCount: 10,
        },
    );

    it('has the expected plan version', () => {
        expect(plan.recoveryPlanVersion).toBe(COVERAGE_RECOVERY_PLAN_VERSION);
    });

    it('WAIT_FOR_MATURITY for 60D not due', () => {
        const h60d = plan.horizonRecoveryItems.find(item => item.horizonLabel === '60D')!;
        expect(h60d.recoveryNeed).toBe('WAIT_FOR_MATURITY');
        expect(h60d.topBlockedReason).toBe('WINDOW_NOT_DUE');
    });

    it('BACKFILL_MISSING_OUTCOME for missing outcome', () => {
        const tinyPlan = buildCoverageRecoveryPlan(
            {
                horizonMaturityTracker: makeTinyTracker({
                    horizonSummaries: [
                        {
                            horizonLabel: '20D',
                            totalCount: 6,
                            readyCount: 3,
                            blockedCount: 3,
                            coverageRatio: 0.5,
                            blockedReasonCounts: { OUTCOME_MISSING: 3 },
                            earliestAsOfDate: '2026-05-11',
                            latestAsOfDate: '2026-05-11',
                            earliestTargetTradingDate: '2026-06-08',
                            latestTargetTradingDate: '2026-06-08',
                            dueCount: 6,
                            notDueCount: 0,
                            missingOutcomeCount: 3,
                            maturityRatio: 1,
                            maturityStatus: 'MISSING_OUTCOME_DOMINANT',
                        },
                    ],
                    maturityStatus: 'PARTIALLY_MATURE',
                }),
                corpusQualityGate,
                corpusMetrics,
            },
            {
                recoveryRunId: 'p13-coverage-recovery-missing-outcome',
                generatedAt: '2026-05-11T08:00:00.000Z',
                targetCoverageRatio: 0.5,
                targetHorizonCoverageGap: 0.35,
                targetUniqueAsOfDateCount: 10,
            },
        );
        expect(tinyPlan.horizonRecoveryItems[0].recoveryNeed).toBe('BACKFILL_MISSING_OUTCOME');
    });

    it('EXPAND_CORPUS when corpus too small', () => {
        const smallPlan = buildCoverageRecoveryPlan(
            {
                horizonMaturityTracker: makeTinyTracker({
                    inputCorpusEntryCount: 3,
                    totalEntries: 3,
                    horizonSummaries: [
                        {
                            horizonLabel: '5D',
                            totalCount: 3,
                            readyCount: 1,
                            blockedCount: 2,
                            coverageRatio: 1 / 3,
                            blockedReasonCounts: { WINDOW_NOT_DUE: 2 },
                            earliestAsOfDate: '2026-05-11',
                            latestAsOfDate: '2026-05-11',
                            earliestTargetTradingDate: '2026-05-18',
                            latestTargetTradingDate: '2026-05-18',
                            dueCount: 3,
                            notDueCount: 0,
                            missingOutcomeCount: 0,
                            maturityRatio: 1,
                            maturityStatus: 'PARTIAL',
                        },
                    ],
                    maturityStatus: 'PARTIALLY_MATURE',
                }),
                corpusQualityGate,
                corpusMetrics,
            },
            {
                recoveryRunId: 'p13-coverage-recovery-small',
                generatedAt: '2026-05-11T08:00:00.000Z',
                targetCoverageRatio: 0.5,
                targetHorizonCoverageGap: 0.35,
                targetUniqueAsOfDateCount: 10,
            },
        );
        expect(smallPlan.horizonRecoveryItems[0].recoveryNeed).toBe('EXPAND_CORPUS');
    });

    it('guardrails are all true', () => {
        expect(plan.guardrails.noProductionWrite).toBe(true);
        expect(plan.guardrails.noOptimizerWrite).toBe(true);
        expect(plan.guardrails.noPerformanceClaim).toBe(true);
        expect(plan.guardrails.noTradingSignal).toBe(true);
        expect(plan.guardrails.observabilityOnly).toBe(true);
    });

    it('productionWriteAllowed is false', () => {
        for (const item of plan.horizonRecoveryItems) {
            expect(item.productionWriteAllowed).toBe(false);
        }
    });

    it('optimizerWriteAllowed is false', () => {
        for (const item of plan.horizonRecoveryItems) {
            expect(item.optimizerWriteAllowed).toBe(false);
        }
    });

    it('plan status is DATA_LIMITED for current corpus', () => {
        expect(plan.recoveryStatus).toBe('DATA_LIMITED');
    });

    it('PRODUCTION_READY is rejected', () => {
        const tampered = { ...plan, recoveryStatus: 'PRODUCTION_READY' as any };
        const result = validateCoverageRecoveryPlan(tampered);
        expect(result.validationStatus).toBe('FAIL');
        expect(result.validationMessages.join(' ')).toMatch(/PRODUCTION_READY/);
    });

    it('forbidden claims are rejected', () => {
        const tampered = { ...plan, recommendedActions: ['profit', 'outperform'] };
        const result = validateCoverageRecoveryPlan(tampered as CoverageRecoveryPlan);
        expect(result.validationStatus).toBe('FAIL');
        expect(result.validationMessages.join(' ')).toMatch(/forbidden/i);
    });

    it('valid plan passes validation', () => {
        expect(validateCoverageRecoveryPlan(plan).validationStatus).toBe('PASS');
    });
});

