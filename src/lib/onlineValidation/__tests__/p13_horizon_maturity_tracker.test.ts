/**
 * p13_horizon_maturity_tracker.test.ts
 * P13 — HorizonMaturityTracker tests
 */

import * as fs from 'fs';
import * as path from 'path';

import {
    buildHorizonMaturityTracker,
    summarizeBlockedReasonsByHorizon,
    validateHorizonMaturityTracker,
    HORIZON_MATURITY_TRACKER_VERSION,
} from '../HorizonMaturityTracker';
import { parseSnapshotCorpusJsonl } from '../SimulationSnapshotCorpusAccumulator';

const CORPUS_PATH = path.resolve(process.cwd(), 'outputs/online_validation/simulation_snapshot_corpus.jsonl');

function loadCorpus() {
    const content = fs.readFileSync(CORPUS_PATH, 'utf8');
    return parseSnapshotCorpusJsonl(content);
}

describe('HorizonMaturityTracker — P13', () => {
    const corpusEntries = loadCorpus();
    const tracker = buildHorizonMaturityTracker(corpusEntries, {
        trackerRunId: 'p13-horizon-maturity-20260511-001',
        generatedAt: '2026-05-11T08:00:00.000Z',
        reviewDate: '2026-07-13',
    });

    it('builds summaries for 5D / 20D / 60D', () => {
        expect(tracker.horizonSummaries.map(s => s.horizonLabel)).toEqual(['5D', '20D', '60D']);
    });

    it('coverageRatio is calculated correctly', () => {
        const h5d = tracker.horizonSummaries.find(s => s.horizonLabel === '5D')!;
        const h20d = tracker.horizonSummaries.find(s => s.horizonLabel === '20D')!;
        const h60d = tracker.horizonSummaries.find(s => s.horizonLabel === '60D')!;

        expect(h5d.coverageRatio).toBeCloseTo(8 / 20, 4);
        expect(h20d.coverageRatio).toBeCloseTo(5 / 20, 4);
        expect(h60d.coverageRatio).toBeCloseTo(1 / 20, 4);
    });

    it('maturityRatio is calculated correctly', () => {
        const h5d = tracker.horizonSummaries.find(s => s.horizonLabel === '5D')!;
        const h20d = tracker.horizonSummaries.find(s => s.horizonLabel === '20D')!;
        const h60d = tracker.horizonSummaries.find(s => s.horizonLabel === '60D')!;

        expect(h5d.maturityRatio).toBeCloseTo(1, 4);
        expect(h20d.maturityRatio).toBeCloseTo(1, 4);
        expect(h60d.maturityRatio).toBeCloseTo(0, 4);
    });

    it('60D is not due dominant', () => {
        const h60d = tracker.horizonSummaries.find(s => s.horizonLabel === '60D')!;
        expect(h60d.maturityStatus).toBe('NOT_DUE_DOMINANT');
        expect(h60d.notDueCount).toBe(20);
        expect(h60d.dueCount).toBe(0);
    });

    it('blocked reason counts are correct', () => {
        const summaries = summarizeBlockedReasonsByHorizon(corpusEntries);
        const h20d = summaries.find(s => s.horizonLabel === '20D')!;
        expect(h20d.blockedReasonCounts['WINDOW_NOT_DUE']).toBe(12);
        expect(h20d.blockedReasonCounts['OUTCOME_MISSING']).toBe(3);
        expect(h20d.blockedReasonCounts['NONE']).toBeUndefined();
        expect(h20d.topBlockedReason).toBe('WINDOW_NOT_DUE');
    });

    it('totalEntries matches input', () => {
        expect(tracker.totalEntries).toBe(corpusEntries.length);
        expect(tracker.inputCorpusEntryCount).toBe(corpusEntries.length);
    });

    it('overall maturity status is PARTIALLY_MATURE', () => {
        expect(tracker.maturityStatus).toBe('PARTIALLY_MATURE');
    });

    it('has correct trackerVersion', () => {
        expect(tracker.trackerVersion).toBe(HORIZON_MATURITY_TRACKER_VERSION);
    });

    it('validationStatus is PASS for valid tracker', () => {
        expect(tracker.validationStatus).toBe('PASS');
        expect(validateHorizonMaturityTracker(tracker).validationStatus).toBe('PASS');
    });

    it('guardrails are all true', () => {
        expect(tracker.guardrails.noProductionWrite).toBe(true);
        expect(tracker.guardrails.noSimulationWrite).toBe(true);
        expect(tracker.guardrails.noOptimizerWrite).toBe(true);
        expect(tracker.guardrails.noPerformanceClaim).toBe(true);
        expect(tracker.guardrails.noTradingSignal).toBe(true);
        expect(tracker.guardrails.observabilityOnly).toBe(true);
    });

    it('PRODUCTION_READY is rejected', () => {
        const tampered = { ...tracker, maturityStatus: 'PRODUCTION_READY' as any };
        const result = validateHorizonMaturityTracker(tampered);
        expect(result.validationStatus).toBe('FAIL');
        expect(result.validationMessages.join(' ')).toMatch(/PRODUCTION_READY/);
    });

    it('forbidden claims are rejected', () => {
        const tampered = {
            ...tracker,
            validationMessages: ['profit', 'outperform'],
        } as typeof tracker;
        const result = validateHorizonMaturityTracker(tampered);
        expect(result.validationStatus).toBe('FAIL');
        expect(result.validationMessages.join(' ')).toMatch(/forbidden/i);
    });
});

