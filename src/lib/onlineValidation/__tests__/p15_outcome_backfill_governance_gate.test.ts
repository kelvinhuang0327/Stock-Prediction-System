import * as fs from 'fs';
import * as path from 'path';

import { parseSnapshotCorpusJsonl } from '../SimulationSnapshotCorpusAccumulator';
import { selectOutcomeBackfillCandidates } from '../OutcomeBackfillCandidateSelector';
import { buildOutcomeBackfillRehearsal } from '../OutcomeBackfillRehearsalEngine';
import { buildBackfillQualityImpactPreview } from '../BackfillQualityImpactPreview';
import { buildOutcomeBackfillGovernanceGate, validateOutcomeBackfillGovernanceGate } from '../OutcomeBackfillGovernanceGate';
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

describe('OutcomeBackfillGovernanceGate — P15', () => {
    const corpusEntries = loadCorpus();
    const corpusMetrics = loadJson<CorpusMetrics>(P12_METRICS_PATH);
    const currentQualityGate = loadJson<CorpusQualityGateResult>(P12_QUALITY_PATH);
    const candidateSelection = selectOutcomeBackfillCandidates(corpusEntries, {
        selectorRunId: 'p15-selector-20260511-001',
        generatedAt: '2026-05-11T09:15:00.000Z',
        reviewDate: '2026-07-13',
        maxCandidates: 20,
    });
    const rehearsal = buildOutcomeBackfillRehearsal(candidateSelection, {
        rehearsalRunId: 'p15-rehearsal-20260511-001',
        generatedAt: '2026-05-11T09:15:00.000Z',
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
        ...rehearsal,
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
            previewRunId: 'p15-preview-20260511-001',
            generatedAt: '2026-05-11T09:15:00.000Z',
        },
    );
    const gate = buildOutcomeBackfillGovernanceGate(
        {
            candidateSelection,
            rehearsal,
            qualityImpactPreview: preview,
            currentCorpusLineCount: corpusEntries.length,
            currentQualityGate,
        },
        {
            governanceRunId: 'p15-governance-20260511-001',
            generatedAt: '2026-05-11T09:15:00.000Z',
            requireManualApproval: true,
            minRehearsedCount: 1,
            minBlockedToReadyCount: 1,
            maxAllowedCorpusWritePermission: false,
        },
    );

    it('BLOCKED_TO_READY still only allows manual review', () => {
        expect(gate.gateStatus).toBe('READY_FOR_MANUAL_REVIEW');
        expect(gate.decision).toBe('ALLOW_MANUAL_REVIEW_ONLY');
    });

    it('no corpus write allowed', () => {
        expect(gate.approvalBoundary.corpusWriteAllowed).toBe(false);
        expect(gate.writePathPolicy.corpusJsonlWriteAllowed).toBe(false);
    });

    it('no production backfill allowed', () => {
        expect(gate.approvalBoundary.productionBackfillAllowed).toBe(false);
        expect(gate.writePathPolicy.productionDbWriteAllowed).toBe(false);
    });

    it('corpus line count mismatch blocks', () => {
        const blockedGate = buildOutcomeBackfillGovernanceGate(
            {
                candidateSelection,
                rehearsal,
                qualityImpactPreview: preview,
                currentCorpusLineCount: 59,
                currentQualityGate,
            },
            {
                governanceRunId: 'p15-governance-blocked-001',
                generatedAt: '2026-05-11T09:15:00.000Z',
                requireManualApproval: true,
                minRehearsedCount: 1,
                minBlockedToReadyCount: 1,
                maxAllowedCorpusWritePermission: false,
            },
        );
        expect(blockedGate.gateStatus).toBe('BLOCKED');
        expect(blockedGate.decision).toBe('BLOCK_WRITE_PATH');
    });

    it('projectedCoverageRatio is preview-only', () => {
        expect(gate.inputSummary.previewOnly).toBe(true);
        expect(gate.inputSummary.projectedCoverageRatio).toBe(preview.projectedCoverageRatio);
    });

    it('automaticPromotionAllowed is false', () => {
        expect(gate.approvalBoundary.automaticPromotionAllowed).toBe(false);
    });

    it('validation passes for valid gate', () => {
        expect(gate.validationStatus).toBe('PASS');
        expect(validateOutcomeBackfillGovernanceGate(gate).validationStatus).toBe('PASS');
    });

    it('forbidden claims are rejected', () => {
        const mutated = { ...gate, riskFlags: ['profit', 'outperform'] };
        const result = validateOutcomeBackfillGovernanceGate(mutated as typeof gate);
        expect(result.validationStatus).toBe('FAIL');
    });
});
