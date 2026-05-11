/**
 * p14_backfill_quality_impact_preview.test.ts
 * P14 — BackfillQualityImpactPreview tests
 */

import * as fs from 'fs';
import * as path from 'path';

import {
    buildBackfillQualityImpactPreview,
    validateBackfillQualityImpactPreview,
    BACKFILL_QUALITY_IMPACT_PREVIEW_VERSION,
} from '../BackfillQualityImpactPreview';
import { summarizeOutcomeBackfillRehearsal } from '../OutcomeBackfillRehearsalEngine';
import {
    buildOutcomeBackfillRehearsal,
} from '../OutcomeBackfillRehearsalEngine';
import {
    selectOutcomeBackfillCandidates,
} from '../OutcomeBackfillCandidateSelector';
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

describe('BackfillQualityImpactPreview — P14', () => {
    const corpusEntries = loadCorpus();
    const corpusMetrics = loadJson<CorpusMetrics>(P12_METRICS_PATH);
    const corpusQualityGate = loadJson<CorpusQualityGateResult>(P12_QUALITY_PATH);
    const selection = selectOutcomeBackfillCandidates(corpusEntries, {
        selectorRunId: 'p14-selector-20260511-001',
        generatedAt: '2026-05-11T09:00:00.000Z',
        reviewDate: '2026-07-13',
        maxCandidates: 20,
    });
    const rehearsal = buildOutcomeBackfillRehearsal(selection, {
        rehearsalRunId: 'p14-rehearsal-20260511-001',
        generatedAt: '2026-05-11T09:00:00.000Z',
        dryRun: true,
        mockOutcomeProvider: (symbol, horizonLabel) => {
            if (horizonLabel === '20D') {
                return {
                    closePriceAtPrediction: 100,
                    closePriceAtOutcome: 110,
                    returnPct: 0.1,
                    priceSource: 'mock',
                    outcomeAvailable: true,
                };
            }
            return null;
        },
    });
    const summary = summarizeOutcomeBackfillRehearsal(rehearsal);
    const preview = buildBackfillQualityImpactPreview(
        {
            currentCorpusMetrics: corpusMetrics,
            currentCorpusQualityGate: corpusQualityGate,
            rehearsalSummary: summary,
        },
        {
            previewRunId: 'p14-backfill-impact-preview-001',
            generatedAt: '2026-05-11T09:00:00.000Z',
        },
    );

    it('projectedCoverageRatio improves after transitions', () => {
        expect(preview.projectedCoverageRatio).toBeGreaterThan(corpusMetrics.coverageRatio);
    });

    it('no material change when no transitions', () => {
        const noTransitionPreview = buildBackfillQualityImpactPreview(
            {
                currentCorpusMetrics: corpusMetrics,
                currentCorpusQualityGate: corpusQualityGate,
                rehearsalSummary: {
                    ...summary,
                    transitionCounts: {
                        BLOCKED_TO_READY: 0,
                        REMAINS_BLOCKED: summary.rehearsedCount + summary.stillBlockedCount,
                        NO_CHANGE: 0,
                    },
                    readyAfterRehearsalCount: corpusMetrics.readyCount,
                    blockedAfterRehearsalCount: corpusMetrics.blockedCount,
                },
            },
            {
                previewRunId: 'p14-backfill-impact-preview-nochange',
                generatedAt: '2026-05-11T09:00:00.000Z',
            },
        );
        expect(noTransitionPreview.impactStatus).toBe('NO_MATERIAL_CHANGE');
        expect(noTransitionPreview.projectedCoverageRatio).toBeCloseTo(corpusMetrics.coverageRatio, 4);
    });

    it('projectedQualityStatus remains DATA_LIMITED or BLOCKED when below threshold', () => {
        expect(['DATA_LIMITED', 'BLOCKED']).toContain(preview.projectedQualityStatus);
    });

    it('has correct preview version', () => {
        expect(preview.previewVersion).toBe(BACKFILL_QUALITY_IMPACT_PREVIEW_VERSION);
    });

    it('guardrails are all true', () => {
        expect(preview.guardrails.noProductionWrite).toBe(true);
        expect(preview.guardrails.noCorpusWrite).toBe(true);
        expect(preview.guardrails.noOptimizerWrite).toBe(true);
        expect(preview.guardrails.noPerformanceClaim).toBe(true);
        expect(preview.guardrails.noTradingSignal).toBe(true);
        expect(preview.guardrails.observabilityOnly).toBe(true);
    });

    it('validation passes for valid preview', () => {
        expect(preview.validationStatus).toBe('PASS');
        expect(validateBackfillQualityImpactPreview(preview).validationStatus).toBe('PASS');
    });

    it('PRODUCTION_READY is rejected', () => {
        const mutated = { ...preview, projectedQualityStatus: 'PRODUCTION_READY' as any };
        const result = validateBackfillQualityImpactPreview(mutated);
        expect(result.validationStatus).toBe('FAIL');
    });

    it('forbidden claims are rejected', () => {
        const mutated = { ...preview, notes: ['profit', 'outperform'] };
        const result = validateBackfillQualityImpactPreview(mutated as typeof preview);
        expect(result.validationStatus).toBe('FAIL');
    });
});

