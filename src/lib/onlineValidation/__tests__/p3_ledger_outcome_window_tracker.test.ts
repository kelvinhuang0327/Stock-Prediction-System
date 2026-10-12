/**
 * P3 LedgerOutcomeWindowTracker tests
 */

import {
    buildOutcomeWindowKey,
    buildOutcomeWindowsForEntry,
    buildOutcomeWindowsFromLedger,
    summarizeOutcomeWindows,
    validateOutcomeWindowTrackerResult,
    type LedgerEntry,
    type OutcomeWindow,
} from '../LedgerOutcomeWindowTracker';

// ─── Fixtures ────────────────────────────────────────────────────

function makeEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
    return {
        ledgerVersion: 'shadow-ledger-v1',
        entryType: 'SHADOW_PREDICTION',
        runId: 'test-run-001',
        asOfDate: '2026-05-11',
        universeTier: 'MVP_CORE',
        symbol: '2330',
        stockName: 'Taiwan Semiconductor Manufacturing',
        researchBucket: 'Strong',
        ledgerKey: 'SHADOW_PREDICTION|2026-05-11|2330|MVP_CORE|test-run-001',
        validationStatus: 'PASS',
        guardrailStatus: 'PASS',
        sourceDateBasis: {
            sourceDate: '2026-05-09',
            sourceType: 'stockQuote',
            missingDataFlags: [],
        },
        targetHorizons: [
            { horizonLabel: '5D', outcomeStatus: 'PENDING', outcomeWriteBackAllowed: false },
            { horizonLabel: '20D', outcomeStatus: 'PENDING', outcomeWriteBackAllowed: false },
            { horizonLabel: '60D', outcomeStatus: 'PENDING', outcomeWriteBackAllowed: false },
        ],
        productionWriteAllowed: false,
        ...overrides,
    };
}

function makeLedgerJsonl(entries: LedgerEntry[]): string {
    return entries.map(e => JSON.stringify(e)).join('\n');
}

// ─── buildOutcomeWindowKey ─────────────────────────────────────

describe('buildOutcomeWindowKey', () => {
    it('produces deterministic 5D key', () => {
        const entry = makeEntry();
        const key = buildOutcomeWindowKey(entry, 5);
        expect(key).toBe('OUTCOME_WINDOW|2026-05-11|2330|MVP_CORE|test-run-001|5D');
    });

    it('produces deterministic 20D key', () => {
        const entry = makeEntry();
        const key = buildOutcomeWindowKey(entry, 20);
        expect(key).toBe('OUTCOME_WINDOW|2026-05-11|2330|MVP_CORE|test-run-001|20D');
    });

    it('produces deterministic 60D key', () => {
        const entry = makeEntry();
        const key = buildOutcomeWindowKey(entry, 60);
        expect(key).toBe('OUTCOME_WINDOW|2026-05-11|2330|MVP_CORE|test-run-001|60D');
    });

    it('same inputs always produce same key', () => {
        const entry = makeEntry();
        expect(buildOutcomeWindowKey(entry, 5)).toBe(buildOutcomeWindowKey(entry, 5));
    });
});

// ─── buildOutcomeWindowsForEntry ──────────────────────────────

describe('buildOutcomeWindowsForEntry', () => {
    it('generates 3 windows by default [5, 20, 60]', () => {
        const entry = makeEntry();
        const windows = buildOutcomeWindowsForEntry(entry, { reviewDate: '2026-04-01' });
        expect(windows).toHaveLength(3);
        expect(windows.map(w => w.horizonLabel)).toEqual(['5D', '20D', '60D']);
    });

    it('generates custom horizons', () => {
        const entry = makeEntry();
        const windows = buildOutcomeWindowsForEntry(entry, { reviewDate: '2026-04-01', horizons: [5] });
        expect(windows).toHaveLength(1);
        expect(windows[0].horizonLabel).toBe('5D');
    });

    it('targetTradingDate > originalAsOfDate for all horizons', () => {
        const entry = makeEntry();
        const windows = buildOutcomeWindowsForEntry(entry, { reviewDate: '2026-04-01' });
        for (const w of windows) {
            expect(w.targetTradingDate > w.originalAsOfDate).toBe(true);
        }
    });

    it('reviewDate before target => NOT_DUE', () => {
        const entry = makeEntry(); // asOfDate=2026-05-11, 5D target ~2026-05-18
        const windows = buildOutcomeWindowsForEntry(entry, { reviewDate: '2026-05-12', horizons: [5] });
        expect(windows[0].windowStatus).toBe('NOT_DUE');
        expect(windows[0].isDue).toBe(false);
        expect(windows[0].backfillAllowed).toBe(false);
    });

    it('reviewDate on/after target => DUE_FOR_BACKFILL', () => {
        const entry = makeEntry(); // asOfDate=2026-05-11, 5D target ~2026-05-18
        const windows = buildOutcomeWindowsForEntry(entry, { reviewDate: '2026-06-30', horizons: [5] });
        expect(windows[0].windowStatus).toBe('DUE_FOR_BACKFILL');
        expect(windows[0].isDue).toBe(true);
        expect(windows[0].backfillAllowed).toBe(true);
    });

    it('isOverdue true when reviewDate > targetTradingDate', () => {
        const entry = makeEntry();
        const windows = buildOutcomeWindowsForEntry(entry, { reviewDate: '2026-06-30', horizons: [5] });
        expect(windows[0].isOverdue).toBe(true);
    });

    it('invalid validationStatus => BLOCKED', () => {
        const entry = makeEntry({ validationStatus: 'FAIL' });
        const windows = buildOutcomeWindowsForEntry(entry, { reviewDate: '2026-06-30', horizons: [5] });
        expect(windows[0].windowStatus).toBe('BLOCKED');
        expect(windows[0].backfillAllowed).toBe(false);
    });

    it('invalid guardrailStatus => BLOCKED', () => {
        const entry = makeEntry({ guardrailStatus: 'FAIL' });
        const windows = buildOutcomeWindowsForEntry(entry, { reviewDate: '2026-06-30', horizons: [5] });
        expect(windows[0].windowStatus).toBe('BLOCKED');
    });

    it('sourceDate > asOfDate => BLOCKED with PIT_VIOLATION', () => {
        const entry = makeEntry({
            sourceDateBasis: { sourceDate: '2026-05-15', sourceType: 'stockQuote', missingDataFlags: [] },
        });
        const windows = buildOutcomeWindowsForEntry(entry, { reviewDate: '2026-06-30', horizons: [5] });
        expect(windows[0].windowStatus).toBe('BLOCKED');
        expect(windows[0].pitSafeStatus).toBe('PIT_VIOLATION');
    });

    it('productionWriteAllowed always false', () => {
        const entry = makeEntry();
        const windows = buildOutcomeWindowsForEntry(entry, { reviewDate: '2026-06-30' });
        for (const w of windows) {
            expect(w.productionWriteAllowed).toBe(false);
        }
    });

    it('BACKFILLED if targetHorizon outcomeStatus=BACKFILLED', () => {
        const entry = makeEntry({
            targetHorizons: [
                { horizonLabel: '5D', outcomeStatus: 'BACKFILLED', outcomeWriteBackAllowed: false },
            ],
        });
        const windows = buildOutcomeWindowsForEntry(entry, { reviewDate: '2026-06-30', horizons: [5] });
        expect(windows[0].windowStatus).toBe('BACKFILLED');
    });

    it('window includes sourceLedgerKey', () => {
        const entry = makeEntry();
        const windows = buildOutcomeWindowsForEntry(entry, { reviewDate: '2026-06-30', horizons: [5] });
        expect(windows[0].sourceLedgerKey).toBe('SHADOW_PREDICTION|2026-05-11|2330|MVP_CORE|test-run-001');
    });
});

// ─── buildOutcomeWindowsFromLedger ───────────────────────────

describe('buildOutcomeWindowsFromLedger', () => {
    it('parses 2 entries and builds 6 windows (3 horizons each)', () => {
        const e1 = makeEntry({ symbol: '2330' });
        const e2 = makeEntry({ symbol: '2454', runId: 'test-run-002' });
        const content = makeLedgerJsonl([e1, e2]);
        const result = buildOutcomeWindowsFromLedger(content, { reviewDate: '2026-06-30' });
        expect(result.sourceEntryCount).toBe(2);
        expect(result.windowCount).toBe(6);
        expect(result.windows).toHaveLength(6);
    });

    it('skips non-SHADOW_PREDICTION entries', () => {
        const e1 = makeEntry({ symbol: '2330' });
        const other = JSON.stringify({ entryType: 'OTHER', runId: 'x', asOfDate: '2026-05-11', symbol: '1234', universeTier: 'T' });
        const content = JSON.stringify(e1) + '\n' + other;
        const result = buildOutcomeWindowsFromLedger(content, { reviewDate: '2026-06-30' });
        expect(result.sourceEntryCount).toBe(1);
    });

    it('rejects malformed JSONL with FAIL status', () => {
        const good = JSON.stringify(makeEntry({ symbol: '2330' }));
        const bad = 'NOT JSON {{{';
        const content = good + '\n' + bad;
        const result = buildOutcomeWindowsFromLedger(content, { reviewDate: '2026-06-30' });
        expect(result.validationStatus).toBe('FAIL');
        expect(result.validationMessages.some(m => m.includes('Malformed JSONL'))).toBe(true);
        expect(result.windowCount).toBe(0);
    });

    it('invalid reviewDate format => FAIL', () => {
        const content = JSON.stringify(makeEntry());
        const result = buildOutcomeWindowsFromLedger(content, { reviewDate: 'not-a-date' });
        expect(result.validationStatus).toBe('FAIL');
    });

    it('empty ledger content returns 0 windows PASS', () => {
        const result = buildOutcomeWindowsFromLedger('', { reviewDate: '2026-06-30' });
        expect(result.sourceEntryCount).toBe(0);
        expect(result.windowCount).toBe(0);
        expect(result.validationStatus).toBe('PASS');
    });

    it('trackerVersion is set', () => {
        const result = buildOutcomeWindowsFromLedger(JSON.stringify(makeEntry()), { reviewDate: '2026-06-30' });
        expect(result.trackerVersion).toBeDefined();
        expect(typeof result.trackerVersion).toBe('string');
    });
});

// ─── summarizeOutcomeWindows ──────────────────────────────────

describe('summarizeOutcomeWindows', () => {
    it('counts by status', () => {
        const e = makeEntry();
        const duePast = buildOutcomeWindowsForEntry(e, { reviewDate: '2026-06-30', horizons: [5] });
        const notDue = buildOutcomeWindowsForEntry(e, { reviewDate: '2026-05-12', horizons: [5] });
        const all: OutcomeWindow[] = [...duePast, ...notDue];
        const summary = summarizeOutcomeWindows(all);
        expect(summary.totalWindows).toBe(2);
        expect(summary.dueCount).toBe(1);
        expect(summary.notDueCount).toBe(1);
    });

    it('counts by horizon', () => {
        const e = makeEntry();
        const windows = buildOutcomeWindowsForEntry(e, { reviewDate: '2026-06-30' });
        const summary = summarizeOutcomeWindows(windows);
        expect(summary.byHorizon['5D']).toBe(1);
        expect(summary.byHorizon['20D']).toBe(1);
        expect(summary.byHorizon['60D']).toBeDefined();
    });

    it('symbolsDue contains due symbols', () => {
        const e = makeEntry();
        const windows = buildOutcomeWindowsForEntry(e, { reviewDate: '2026-06-30', horizons: [5] });
        const summary = summarizeOutcomeWindows(windows);
        expect(summary.symbolsDue).toContain('2330');
    });

    it('blocked windows increment blockedCount', () => {
        const e = makeEntry({ validationStatus: 'FAIL' });
        const windows = buildOutcomeWindowsForEntry(e, { reviewDate: '2026-06-30', horizons: [5] });
        const summary = summarizeOutcomeWindows(windows);
        expect(summary.blockedCount).toBe(1);
    });

    it('overdueCount increments for overdue windows', () => {
        const e = makeEntry();
        const windows = buildOutcomeWindowsForEntry(e, { reviewDate: '2026-06-30', horizons: [5] });
        const summary = summarizeOutcomeWindows(windows);
        expect(summary.overdueCount).toBeGreaterThan(0);
    });

    it('earliestDueDate and latestDueDate are set', () => {
        const e = makeEntry();
        const windows = buildOutcomeWindowsForEntry(e, { reviewDate: '2026-06-30', horizons: [5, 20] });
        const summary = summarizeOutcomeWindows(windows);
        expect(summary.earliestDueDate).not.toBeNull();
        expect(summary.latestDueDate).not.toBeNull();
    });
});

// ─── validateOutcomeWindowTrackerResult ───────────────────────

describe('validateOutcomeWindowTrackerResult', () => {
    it('PASS for valid result', () => {
        const content = JSON.stringify(makeEntry());
        const result = buildOutcomeWindowsFromLedger(content, { reviewDate: '2026-06-30' });
        const report = validateOutcomeWindowTrackerResult(result);
        expect(report.validationStatus).toBe('PASS');
        expect(report.failures).toHaveLength(0);
    });

    it('FAIL if reviewDate is invalid format', () => {
        const content = JSON.stringify(makeEntry());
        const result = buildOutcomeWindowsFromLedger(content, { reviewDate: '2026-06-30' });
        const tampered = { ...result, reviewDate: 'not-a-date' };
        const report = validateOutcomeWindowTrackerResult(tampered);
        expect(report.validationStatus).toBe('FAIL');
        expect(report.failures.some(f => f.includes('reviewDate'))).toBe(true);
    });

    it('all productionWriteAllowed are false', () => {
        const content = JSON.stringify(makeEntry());
        const result = buildOutcomeWindowsFromLedger(content, { reviewDate: '2026-06-30' });
        for (const w of result.windows) {
            expect(w.productionWriteAllowed).toBe(false);
        }
    });

    it('FAIL if BLOCKED window has backfillAllowed=true (tampered)', () => {
        const e = makeEntry({ validationStatus: 'FAIL' });
        const windows = buildOutcomeWindowsForEntry(e, { reviewDate: '2026-06-30', horizons: [5] });
        const tampered = windows.map(w => ({ ...w, backfillAllowed: true }));
        const result = buildOutcomeWindowsFromLedger(JSON.stringify(e), { reviewDate: '2026-06-30' });
        const tamperedResult = { ...result, windows: tampered };
        const report = validateOutcomeWindowTrackerResult(tamperedResult);
        expect(report.validationStatus).toBe('FAIL');
    });
});
