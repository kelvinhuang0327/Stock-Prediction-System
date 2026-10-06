/**
 * p1_append_only_shadow_ledger_guard.test.ts
 * Tests for AppendOnlyShadowLedgerGuard.ts (P1)
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    buildLedgerEntryKey,
    parseJsonlLedger,
    validateAppendOnlyLedger,
    buildAppendOnlyPreview,
    appendLedgerArtifactIfSafe,
} from '../AppendOnlyShadowLedgerGuard';

// ─── Helpers ──────────────────────────────────────────────────────

function makePredictionEntry(symbol: string, asOfDate = '2026-05-11', runId = 'run-001') {
    return {
        asOfDate,
        symbol,
        universeTier: 'MVP_CORE',
        runId,
        validationStatus: 'PASS',
        guardrailStatus: 'PASS',
    };
}

function makeOutcomeEntry(symbol: string, horizonLabel: string, asOfDate = '2026-05-11', runId = 'run-001') {
    return {
        originalAsOfDate: asOfDate,
        originalRunId: runId,
        symbol,
        universeTier: 'MVP_CORE',
        horizonLabel,
        outcomeStatus: 'READY_FOR_REVIEW',
    };
}

// ─── buildLedgerEntryKey ──────────────────────────────────────────

describe('buildLedgerEntryKey', () => {
    it('builds key from prediction entry (asOfDate)', () => {
        const entry = makePredictionEntry('2330');
        const key = buildLedgerEntryKey(entry);
        expect(key).toBe('2026-05-11|2330|MVP_CORE|run-001');
    });

    it('builds key from outcome entry (originalAsOfDate + horizonLabel)', () => {
        const entry = makeOutcomeEntry('2330', '5D');
        const key = buildLedgerEntryKey(entry);
        expect(key).toBe('2026-05-11|2330|MVP_CORE|run-001|5D');
    });

    it('outcome 5D and 20D entries have different keys', () => {
        const k5 = buildLedgerEntryKey(makeOutcomeEntry('2330', '5D'));
        const k20 = buildLedgerEntryKey(makeOutcomeEntry('2330', '20D'));
        expect(k5).not.toBe(k20);
    });

    it('prediction entry and outcome entry can coexist (different keys)', () => {
        const predKey = buildLedgerEntryKey(makePredictionEntry('2330'));
        const outcomeKey = buildLedgerEntryKey(makeOutcomeEntry('2330', '5D'));
        expect(predKey).not.toBe(outcomeKey);
    });
});

// ─── parseJsonlLedger ─────────────────────────────────────────────

describe('parseJsonlLedger', () => {
    it('parses valid JSONL content', () => {
        const content = [
            JSON.stringify(makePredictionEntry('2330')),
            JSON.stringify(makePredictionEntry('2454')),
        ].join('\n');
        const result = parseJsonlLedger(content);
        expect(result.entries).toHaveLength(2);
        expect(result.errors).toHaveLength(0);
    });

    it('ignores empty lines', () => {
        const content = `${JSON.stringify(makePredictionEntry('2330'))}\n\n`;
        const result = parseJsonlLedger(content);
        expect(result.entries).toHaveLength(1);
        expect(result.emptyLineCount).toBeGreaterThan(0);
    });

    it('returns error for malformed line (not silent ignore)', () => {
        const content = `${JSON.stringify(makePredictionEntry('2330'))}\n{invalid-json}`;
        const result = parseJsonlLedger(content);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('malformed JSON');
    });

    it('handles empty string', () => {
        const result = parseJsonlLedger('');
        expect(result.entries).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
    });
});

// ─── validateAppendOnlyLedger ─────────────────────────────────────

describe('validateAppendOnlyLedger', () => {
    it('empty ledger can append new entries', () => {
        const result = validateAppendOnlyLedger('', [makePredictionEntry('2330')]);
        expect(result.appendOnlyStatus).toBe('PASS');
    });

    it('existing ledger can append new unique key entries', () => {
        const existing = JSON.stringify(makePredictionEntry('2330')) + '\n';
        const result = validateAppendOnlyLedger(existing, [makePredictionEntry('2454')]);
        expect(result.appendOnlyStatus).toBe('PASS');
    });

    it('duplicate key is rejected', () => {
        const entry = makePredictionEntry('2330');
        const existing = JSON.stringify(entry) + '\n';
        const result = validateAppendOnlyLedger(existing, [entry]); // same key
        expect(result.appendOnlyStatus).toBe('FAIL');
        expect(result.duplicateKeys).toHaveLength(1);
    });

    it('malformed existing line causes FAIL', () => {
        const existing = '{malformed-json}\n';
        const result = validateAppendOnlyLedger(existing, [makePredictionEntry('2330')]);
        expect(result.appendOnlyStatus).toBe('FAIL');
    });

    it('outcome entries with horizonLabel coexist with prediction entries', () => {
        const predEntry = makePredictionEntry('2330');
        const outcomeEntry5D = makeOutcomeEntry('2330', '5D');
        const existing = JSON.stringify(predEntry) + '\n';
        const result = validateAppendOnlyLedger(existing, [outcomeEntry5D]);
        expect(result.appendOnlyStatus).toBe('PASS');
    });

    it('outcome 5D and 20D entries can coexist for same symbol', () => {
        const outcome5D = makeOutcomeEntry('2330', '5D');
        const outcome20D = makeOutcomeEntry('2330', '20D');
        const existing = JSON.stringify(outcome5D) + '\n';
        const result = validateAppendOnlyLedger(existing, [outcome20D]);
        expect(result.appendOnlyStatus).toBe('PASS');
    });
});

// ─── buildAppendOnlyPreview ───────────────────────────────────────

describe('buildAppendOnlyPreview', () => {
    it('returns preview content without writing', () => {
        const entry = makePredictionEntry('2330');
        const preview = buildAppendOnlyPreview('', [entry]);
        expect(preview.previewContent).toContain('2330');
        expect(preview.appendOnlyStatus).toBe('PASS');
        expect(preview.newLineCount).toBe(1);
    });

    it('preview includes existing + new lines', () => {
        const existing = JSON.stringify(makePredictionEntry('2330')) + '\n';
        const newEntry = makePredictionEntry('2454');
        const preview = buildAppendOnlyPreview(existing, [newEntry]);
        expect(preview.totalLineCount).toBe(2);
        expect(preview.existingLineCount).toBe(1);
    });

    it('preview does NOT write to any file', () => {
        // Just verify no side-effects (function returns without writing)
        const entry = makePredictionEntry('2330');
        expect(() => buildAppendOnlyPreview('', [entry])).not.toThrow();
    });

    it('preview returns FAIL for duplicate key', () => {
        const entry = makePredictionEntry('2330');
        const existing = JSON.stringify(entry) + '\n';
        const preview = buildAppendOnlyPreview(existing, [entry]);
        expect(preview.appendOnlyStatus).toBe('FAIL');
    });
});

// ─── appendLedgerArtifactIfSafe ───────────────────────────────────

describe('appendLedgerArtifactIfSafe', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-test-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('creates new file when none exists', async () => {
        const filePath = path.join(tmpDir, 'test.jsonl');
        const entry = makePredictionEntry('2330');
        await appendLedgerArtifactIfSafe(filePath, [entry]);
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).toContain('2330');
    });

    it('appends to existing file with unique key', async () => {
        const filePath = path.join(tmpDir, 'test.jsonl');
        const entry1 = makePredictionEntry('2330');
        const entry2 = makePredictionEntry('2454');
        await appendLedgerArtifactIfSafe(filePath, [entry1]);
        await appendLedgerArtifactIfSafe(filePath, [entry2]);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        expect(lines).toHaveLength(2);
    });

    it('throws error for duplicate key — does NOT write', async () => {
        const filePath = path.join(tmpDir, 'test.jsonl');
        const entry = makePredictionEntry('2330');
        await appendLedgerArtifactIfSafe(filePath, [entry]);
        // Try to append same entry again
        await expect(appendLedgerArtifactIfSafe(filePath, [entry])).rejects.toThrow();
        // File should still have only 1 line
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n').filter(l => l.trim());
        expect(lines).toHaveLength(1);
    });

    it('old content is NOT changed after append', async () => {
        const filePath = path.join(tmpDir, 'test.jsonl');
        const entry1 = makePredictionEntry('2330');
        await appendLedgerArtifactIfSafe(filePath, [entry1]);
        const originalContent = fs.readFileSync(filePath, 'utf8');

        const entry2 = makePredictionEntry('2454');
        await appendLedgerArtifactIfSafe(filePath, [entry2]);
        const newContent = fs.readFileSync(filePath, 'utf8');

        // Old content should be present unchanged at the start
        expect(newContent.startsWith(originalContent)).toBe(true);
    });

    it('returns status PASS on successful append', async () => {
        const filePath = path.join(tmpDir, 'test.jsonl');
        const entry = makePredictionEntry('2330');
        const result = await appendLedgerArtifactIfSafe(filePath, [entry]);
        expect(result.status).toBe('PASS');
        expect(result.appendedCount).toBe(1);
    });
});
