import * as fs from 'fs';
import * as path from 'path';

import { parseSnapshotCorpusJsonl } from '../SimulationSnapshotCorpusAccumulator';
import { selectOutcomeBackfillCandidates } from '../OutcomeBackfillCandidateSelector';
import { buildOutcomeBackfillRehearsal } from '../OutcomeBackfillRehearsalEngine';
import { buildBackfillQualityImpactPreview } from '../BackfillQualityImpactPreview';
import { buildOutcomeBackfillGovernanceGate } from '../OutcomeBackfillGovernanceGate';
import { buildBackfillWritePathContract } from '../BackfillWritePathContract';
import { buildBackfillManualReviewPackage } from '../BackfillManualReviewPackage';
import { buildManualReviewWorkflowBinding } from '../ManualReviewWorkflowBinding';
import {
    buildManualReviewActionSchema,
    validateManualReviewActionSchema,
} from '../ManualReviewActionSchema';
import type { CorpusMetrics } from '../CorpusMetricsStore';
import type { CorpusQualityGateResult } from '../CorpusQualityGate';
import type { OutcomeBackfillRehearsalSummary } from '../OutcomeBackfillRehearsalEngine';

const CORPUS_PATH = path.resolve(process.cwd(), 'outputs/online_validation/simulation_snapshot_corpus.jsonl');
const P12_METRICS_PATH = path.resolve(process.cwd(), 'outputs/online_validation/p12_corpus_metrics_store.json');
const P12_QUALITY_PATH = path.resolve(process.cwd(), 'outputs/online_validation/p12_corpus_quality_gate.json');

function loadCorpus() {
    return parseSnapshotCorpusJsonl(fs.readFileSync(CORPUS_PATH, 'utf8'));
}

function loadJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('ManualReviewActionSchema — P16', () => {
    const corpusEntries = loadCorpus();
    const corpusMetrics = loadJson<CorpusMetrics>(P12_METRICS_PATH);
    const currentQualityGate = loadJson<CorpusQualityGateResult>(P12_QUALITY_PATH);
    const candidateSelection = selectOutcomeBackfillCandidates(corpusEntries, {
        selectorRunId: 'p16-selector-20260511-001',
        generatedAt: '2026-05-11T10:00:00.000Z',
        reviewDate: '2026-07-13',
        maxCandidates: 20,
    });
    const rehearsal = buildOutcomeBackfillRehearsal(candidateSelection, {
        rehearsalRunId: 'p16-rehearsal-20260511-001',
        generatedAt: '2026-05-11T10:00:00.000Z',
        dryRun: true,
        mockOutcomeProvider: (symbol, horizonLabel, targetTradingDate) => {
            if (horizonLabel === '20D' && symbol === candidateSelection.candidates[0]?.symbol && targetTradingDate === candidateSelection.candidates[0]?.targetTradingDate) {
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
    const rehearsalSummary: OutcomeBackfillRehearsalSummary = {
        inputCandidateCount: rehearsal.inputCandidateCount,
        rehearsedCount: rehearsal.rehearsedCount,
        stillBlockedCount: rehearsal.stillBlockedCount,
        transitionCounts: {
            BLOCKED_TO_READY: rehearsal.rehearsalItems.filter(item => item.transitionType === 'BLOCKED_TO_READY').length,
            REMAINS_BLOCKED: rehearsal.rehearsalItems.filter(item => item.transitionType === 'REMAINS_BLOCKED').length,
            NO_CHANGE: rehearsal.rehearsalItems.filter(item => item.transitionType === 'NO_CHANGE').length,
        },
        byHorizon: rehearsal.rehearsalItems.reduce((acc, item) => {
            if (!acc[item.horizonLabel]) acc[item.horizonLabel] = { ready: 0, blocked: 0 };
            if (item.proposedSnapshotStatus === 'SNAPSHOT_READY') acc[item.horizonLabel].ready += 1;
            else acc[item.horizonLabel].blocked += 1;
            return acc;
        }, {} as Record<string, { ready: number; blocked: number }>),
        bySymbol: rehearsal.rehearsalItems.reduce((acc, item) => {
            if (!acc[item.symbol]) acc[item.symbol] = { ready: 0, blocked: 0 };
            if (item.proposedSnapshotStatus === 'SNAPSHOT_READY') acc[item.symbol].ready += 1;
            else acc[item.symbol].blocked += 1;
            return acc;
        }, {} as Record<string, { ready: number; blocked: number }>),
        readyAfterRehearsalCount: rehearsal.rehearsalItems.filter(item => item.proposedSnapshotStatus === 'SNAPSHOT_READY').length,
        blockedAfterRehearsalCount: rehearsal.rehearsalItems.filter(item => item.proposedSnapshotStatus === 'SNAPSHOT_BLOCKED').length,
    };
    const preview = buildBackfillQualityImpactPreview(
        {
            currentCorpusMetrics: corpusMetrics,
            currentCorpusQualityGate: currentQualityGate,
            rehearsalSummary,
        },
        {
            previewRunId: 'p16-preview-20260511-001',
            generatedAt: '2026-05-11T10:00:00.000Z',
        },
    );
    const governanceGate = buildOutcomeBackfillGovernanceGate(
        {
            candidateSelection,
            rehearsal,
            qualityImpactPreview: preview,
            currentCorpusLineCount: corpusEntries.length,
            currentQualityGate,
        },
        {
            governanceRunId: 'p16-governance-20260511-001',
            generatedAt: '2026-05-11T10:00:00.000Z',
            requireManualApproval: true,
            minRehearsedCount: 1,
            minBlockedToReadyCount: 1,
            maxAllowedCorpusWritePermission: false,
        },
    );
    const writePathContract = buildBackfillWritePathContract(
        { governanceGate, rehearsal, qualityImpactPreview: preview },
        { contractRunId: 'p16-contract-20260511-001', generatedAt: '2026-05-11T10:00:00.000Z' },
    );
    const manualReviewPackage = buildBackfillManualReviewPackage(
        {
            governanceGate,
            writePathContract,
            candidateSelection,
            rehearsal,
            qualityImpactPreview: preview,
        },
        { packageRunId: 'p16-package-20260511-001', generatedAt: '2026-05-11T10:00:00.000Z' },
    );
    const binding = buildManualReviewWorkflowBinding(
        {
            governanceGate,
            writePathContract,
            manualReviewPackage,
            qualityImpactPreview: preview,
            recoveryPlan: JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'outputs/online_validation/p13_coverage_recovery_plan.json'), 'utf8')),
        },
        { bindingRunId: 'p16-binding-20260511-001', generatedAt: '2026-05-11T10:00:00.000Z' },
    );
    const schema = buildManualReviewActionSchema(binding, {
        schemaRunId: 'p16-schema-20260511-001',
        generatedAt: '2026-05-11T10:00:00.000Z',
    });

    it('allowed actions all writePathEffect NONE', () => {
        for (const action of schema.actions) {
            expect(action.writePathEffect).toBe('NONE');
        }
    });

    it('disabled actions include production backfill / corpus write / optimizer / trading action', () => {
        const ids = schema.disabledActions.map(action => action.actionId);
        expect(ids).toEqual(expect.arrayContaining([
            'APPROVE_PRODUCTION_BACKFILL',
            'APPROVE_CORPUS_WRITE',
            'APPROVE_OPTIMIZER',
            'APPROVE_TRADING_ACTION',
        ]));
    });

    it('enabled actions require human', () => {
        for (const action of schema.actions) {
            expect(action.requiresHuman).toBe(true);
        }
    });

    it('productionWriteAllowed is false', () => {
        for (const action of schema.actions) {
            expect(action.productionWriteAllowed).toBe(false);
        }
    });

    it('corpusWriteAllowed is false', () => {
        for (const action of schema.actions) {
            expect(action.corpusWriteAllowed).toBe(false);
        }
    });

    it('optimizerAllowed is false', () => {
        for (const action of schema.actions) {
            expect(action.optimizerAllowed).toBe(false);
        }
    });

    it('validation passes for valid schema', () => {
        expect(schema.validationStatus).toBe('PASS');
        expect(validateManualReviewActionSchema(schema).validationStatus).toBe('PASS');
    });

    it('forbidden claims rejected', () => {
        const mutated = { ...schema, actions: [...schema.actions, { ...schema.actions[0], label: 'profit' }] };
        const result = validateManualReviewActionSchema(mutated as typeof schema);
        expect(result.validationStatus).toBe('FAIL');
    });
});
