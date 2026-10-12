/**
 * p14_outcome_backfill_candidate_selector.test.ts
 * P14 — OutcomeBackfillCandidateSelector tests
 */

import * as fs from 'fs';
import * as path from 'path';

import {
    selectOutcomeBackfillCandidates,
    summarizeBackfillCandidateSelection,
    validateOutcomeBackfillCandidateSelection,
    OUTCOME_BACKFILL_CANDIDATE_SELECTOR_VERSION,
} from '../OutcomeBackfillCandidateSelector';
import { parseSnapshotCorpusJsonl } from '../SimulationSnapshotCorpusAccumulator';

const CORPUS_PATH = path.resolve(process.cwd(), 'outputs/online_validation/simulation_snapshot_corpus.jsonl');

function loadCorpus() {
    return parseSnapshotCorpusJsonl(fs.readFileSync(CORPUS_PATH, 'utf8'));
}

describe('OutcomeBackfillCandidateSelector — P14', () => {
    const corpusEntries = loadCorpus();
    const selection = selectOutcomeBackfillCandidates(corpusEntries, {
        selectorRunId: 'p14-selector-20260511-001',
        generatedAt: '2026-05-11T09:00:00.000Z',
        reviewDate: '2026-07-13',
        maxCandidates: 20,
    });

    it('selects 5D / 20D missing outcome candidates', () => {
        expect(selection.candidates.length).toBeGreaterThan(0);
        for (const candidate of selection.candidates) {
            expect(['5D', '20D']).toContain(candidate.horizonLabel);
            expect(candidate.currentBlockedReason).toMatch(/OUTCOME_MISSING|MISSING_OUTCOME/);
        }
    });

    it('excludes 60D by default', () => {
        expect(selection.candidates.find(candidate => candidate.horizonLabel === '60D')).toBeUndefined();
    });

    it('excludes WINDOW_NOT_DUE', () => {
        for (const candidate of selection.candidates) {
            expect(candidate.currentBlockedReason).not.toBe('WINDOW_NOT_DUE');
            expect(candidate.currentBlockedReason).not.toBe('NOT_DUE');
        }
    });

    it('excludes SNAPSHOT_READY', () => {
        for (const candidate of selection.candidates) {
            expect(candidate.currentSnapshotStatus).not.toBe('SNAPSHOT_READY');
        }
    });

    it('respects maxCandidates', () => {
        const capped = selectOutcomeBackfillCandidates(corpusEntries, {
            selectorRunId: 'p14-selector-capped-001',
            generatedAt: '2026-05-11T09:00:00.000Z',
            reviewDate: '2026-07-13',
            maxCandidates: 1,
        });
        expect(capped.selectedCount).toBeLessThanOrEqual(1);
    });

    it('productionWriteAllowed is false', () => {
        for (const candidate of selection.candidates) {
            expect(candidate.productionWriteAllowed).toBe(false);
        }
    });

    it('optimizerWriteAllowed is false', () => {
        for (const candidate of selection.candidates) {
            expect(candidate.optimizerWriteAllowed).toBe(false);
        }
    });

    it('has correct selectorVersion', () => {
        expect(selection.selectorVersion).toBe(OUTCOME_BACKFILL_CANDIDATE_SELECTOR_VERSION);
    });

    it('summary includes symbols and earliest/latest target dates', () => {
        const summary = summarizeBackfillCandidateSelection(selection);
        expect(summary.selectedCount).toBe(selection.selectedCount);
        expect(summary.symbolsSelected.length).toBeGreaterThan(0);
        expect(summary.earliestTargetTradingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(summary.latestTargetTradingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('validation passes for default selection', () => {
        expect(selection.validationStatus).toBe('PASS');
        expect(validateOutcomeBackfillCandidateSelection(selection).validationStatus).toBe('PASS');
    });

    it('forbidden claims are rejected', () => {
        const mutated = {
            ...selection,
            validationMessages: ['profit', 'outperform'],
        };
        const result = validateOutcomeBackfillCandidateSelection(mutated as typeof selection);
        expect(result.validationStatus).toBe('FAIL');
    });
});

