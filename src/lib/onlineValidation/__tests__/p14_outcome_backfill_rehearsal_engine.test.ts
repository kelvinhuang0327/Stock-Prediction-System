/**
 * p14_outcome_backfill_rehearsal_engine.test.ts
 * P14 — OutcomeBackfillRehearsalEngine tests
 */

import * as fs from 'fs';
import * as path from 'path';

import {
    buildOutcomeBackfillRehearsal,
    summarizeOutcomeBackfillRehearsal,
    validateOutcomeBackfillRehearsal,
    OUTCOME_BACKFILL_REHEARSAL_VERSION,
    type RehearsalOutcomeSnapshot,
} from '../OutcomeBackfillRehearsalEngine';
import {
    selectOutcomeBackfillCandidates,
} from '../OutcomeBackfillCandidateSelector';
import { parseSnapshotCorpusJsonl } from '../SimulationSnapshotCorpusAccumulator';

const CORPUS_PATH = path.resolve(process.cwd(), 'outputs/online_validation/simulation_snapshot_corpus.jsonl');

function loadCorpus() {
    return parseSnapshotCorpusJsonl(fs.readFileSync(CORPUS_PATH, 'utf8'));
}

describe('OutcomeBackfillRehearsalEngine — P14', () => {
    const corpusEntries = loadCorpus();
    const selection = selectOutcomeBackfillCandidates(corpusEntries, {
        selectorRunId: 'p14-selector-20260511-001',
        generatedAt: '2026-05-11T09:00:00.000Z',
        reviewDate: '2026-07-13',
        maxCandidates: 20,
    });
    const readySymbol = selection.candidates[0]?.symbol ?? '0000';
    const readyTargetTradingDate = selection.candidates[0]?.targetTradingDate ?? '1900-01-01';
    const readyHorizonLabel = selection.candidates[0]?.horizonLabel ?? '20D';

    const rehearsal = buildOutcomeBackfillRehearsal(selection, {
        rehearsalRunId: 'p14-rehearsal-20260511-001',
        generatedAt: '2026-05-11T09:00:00.000Z',
        dryRun: true,
        mockOutcomeProvider: (symbol, horizonLabel, targetTradingDate) => {
            if (
                horizonLabel === readyHorizonLabel &&
                symbol === readySymbol &&
                targetTradingDate === readyTargetTradingDate
            ) {
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

    it('candidate with mock outcome becomes BLOCKED_TO_READY', () => {
        const item = rehearsal.rehearsalItems.find(row => row.transitionType === 'BLOCKED_TO_READY');
        expect(item).toBeDefined();
        expect(item?.proposedSnapshotStatus).toBe('SNAPSHOT_READY');
        expect(item?.proposedOutcomeSnapshot).toBeTruthy();
    });

    it('candidate without mock outcome remains blocked', () => {
        const item = rehearsal.rehearsalItems.find(row => row.transitionType === 'REMAINS_BLOCKED');
        expect(item).toBeDefined();
        expect(item?.proposedSnapshotStatus).toBe('SNAPSHOT_BLOCKED');
    });

    it('proposed SNAPSHOT_READY requires outcomeSnapshot', () => {
        for (const item of rehearsal.rehearsalItems) {
            if (item.proposedSnapshotStatus === 'SNAPSHOT_READY') {
                expect(item.proposedOutcomeSnapshot).toBeTruthy();
            }
        }
    });

    it('dryRun is true', () => {
        expect(rehearsal.dryRun).toBe(true);
    });

    it('productionWriteAllowed is false', () => {
        for (const item of rehearsal.rehearsalItems) {
            expect(item.productionWriteAllowed).toBe(false);
        }
    });

    it('corpusWriteAllowed is false', () => {
        for (const item of rehearsal.rehearsalItems) {
            expect(item.corpusWriteAllowed).toBe(false);
        }
    });

    it('optimizerWriteAllowed is false', () => {
        for (const item of rehearsal.rehearsalItems) {
            expect(item.optimizerWriteAllowed).toBe(false);
        }
    });

    it('has correct rehearsal version', () => {
        expect(rehearsal.rehearsalVersion).toBe(OUTCOME_BACKFILL_REHEARSAL_VERSION);
    });

    it('summary counts transitions', () => {
        const summary = summarizeOutcomeBackfillRehearsal(rehearsal);
        expect(summary.inputCandidateCount).toBe(rehearsal.inputCandidateCount);
        expect(summary.readyAfterRehearsalCount).toBeGreaterThanOrEqual(1);
        expect(summary.blockedAfterRehearsalCount).toBeGreaterThanOrEqual(0);
    });

    it('validation passes for valid rehearsal', () => {
        expect(rehearsal.validationStatus).toBe('PASS');
        expect(validateOutcomeBackfillRehearsal(rehearsal).validationStatus).toBe('PASS');
    });

    it('forbidden claims are rejected', () => {
        const mutated = {
            ...rehearsal,
            validationMessages: ['profit', 'outperform'],
        };
        const result = validateOutcomeBackfillRehearsal(mutated as typeof rehearsal);
        expect(result.validationStatus).toBe('FAIL');
    });
});
