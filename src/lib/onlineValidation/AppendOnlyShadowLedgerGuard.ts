/**
 * AppendOnlyShadowLedgerGuard.ts — P1 Append-only Shadow Ledger Guard
 *
 * Ensures shadow prediction JSONL files are strictly append-only.
 * Prevents overwriting or modifying existing entries.
 *
 * SAFETY CONTRACT:
 * - research mode only
 * - no DB write
 * - no external API call
 * - no LLM call
 * - append-only: existing keys cannot be overwritten
 * - existing lines cannot be modified
 * - malformed lines cause FAIL (not silent ignore)
 *
 * Not investment advice. Not a trading system.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────

export type AppendOnlyStatus = 'PASS' | 'FAIL';

export interface LedgerParseResult {
    entries: Record<string, unknown>[];
    errors: string[];
    lineCount: number;
    emptyLineCount: number;
}

export interface AppendOnlyValidationResult {
    appendOnlyStatus: AppendOnlyStatus;
    messages: string[];
    duplicateKeys: string[];
    newEntryCount: number;
    existingEntryCount: number;
}

export interface AppendOnlyPreview {
    previewContent: string;
    newLineCount: number;
    totalLineCount: number;
    existingLineCount: number;
    appendOnlyStatus: AppendOnlyStatus;
    messages: string[];
}

// ─── buildLedgerEntryKey ──────────────────────────────────────────

/**
 * buildLedgerEntryKey
 *
 * Builds a unique key for a ledger entry.
 * Format: originalAsOfDate|symbol|universeTier|runId[|horizonLabel]
 *
 * Works for both prediction entries (no horizonLabel) and outcome entries
 * (with horizonLabel, e.g. "5D" or "20D").
 */
export function buildLedgerEntryKey(entry: Record<string, unknown>): string {
    // Support both prediction entries (asOfDate) and outcome entries (originalAsOfDate)
    const asOfDate =
        (entry['originalAsOfDate'] as string | undefined) ??
        (entry['asOfDate'] as string | undefined) ??
        '';

    const symbol = (entry['symbol'] as string | undefined) ?? '';

    const universeTier =
        (entry['universeTier'] as string | undefined) ?? '';

    const runId =
        (entry['originalRunId'] as string | undefined) ??
        (entry['runId'] as string | undefined) ??
        '';

    const horizonLabel = (entry['horizonLabel'] as string | undefined) ?? '';

    const parts = [asOfDate, symbol, universeTier, runId];
    if (horizonLabel) parts.push(horizonLabel);

    return parts.join('|');
}

// ─── parseJsonlLedger ─────────────────────────────────────────────

/**
 * parseJsonlLedger
 *
 * Parses a JSONL string into an array of objects.
 * Empty lines are skipped (not errors).
 * Malformed lines are returned as errors (not silently ignored).
 */
export function parseJsonlLedger(content: string): LedgerParseResult {
    const lines = content.split('\n');
    const entries: Record<string, unknown>[] = [];
    const errors: string[] = [];
    let emptyLineCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            emptyLineCount++;
            continue;
        }
        try {
            const parsed = JSON.parse(line);
            entries.push(parsed as Record<string, unknown>);
        } catch {
            errors.push(`Line ${i + 1}: malformed JSON — "${line.slice(0, 80)}..."`);
        }
    }

    return {
        entries,
        errors,
        lineCount: lines.length,
        emptyLineCount,
    };
}

// ─── validateAppendOnlyLedger ─────────────────────────────────────

/**
 * validateAppendOnlyLedger
 *
 * Validates that newEntries can safely be appended to existingContent.
 * Returns FAIL if:
 * - existing content has malformed lines
 * - any new entry has a duplicate key matching an existing entry
 * - any new entry has a malformed / un-keyable structure
 */
export function validateAppendOnlyLedger(
    existingContent: string,
    newEntries: Record<string, unknown>[],
    _options?: { strict?: boolean },
): AppendOnlyValidationResult {
    const messages: string[] = [];
    const duplicateKeys: string[] = [];

    // Parse existing ledger
    const parseResult = parseJsonlLedger(existingContent);

    if (parseResult.errors.length > 0) {
        for (const err of parseResult.errors) {
            messages.push(`FAIL: existing ledger has malformed line — ${err}`);
        }
        return {
            appendOnlyStatus: 'FAIL',
            messages,
            duplicateKeys,
            newEntryCount: newEntries.length,
            existingEntryCount: parseResult.entries.length,
        };
    }

    // Build existing key set
    const existingKeys = new Set<string>();
    for (const entry of parseResult.entries) {
        existingKeys.add(buildLedgerEntryKey(entry));
    }

    // Validate new entries
    for (const entry of newEntries) {
        const key = buildLedgerEntryKey(entry);
        if (!key.replace(/\|/g, '').trim()) {
            messages.push(`FAIL: new entry has no valid key — ${JSON.stringify(entry).slice(0, 80)}`);
            continue;
        }
        if (existingKeys.has(key)) {
            duplicateKeys.push(key);
            messages.push(`FAIL: duplicate key rejected — ${key}`);
        }
    }

    const failCount = messages.filter(m => m.startsWith('FAIL')).length;
    return {
        appendOnlyStatus: failCount > 0 ? 'FAIL' : 'PASS',
        messages,
        duplicateKeys,
        newEntryCount: newEntries.length,
        existingEntryCount: parseResult.entries.length,
    };
}

// ─── buildAppendOnlyPreview ───────────────────────────────────────

/**
 * buildAppendOnlyPreview
 *
 * Generates a preview of the appended JSONL content.
 * Does NOT write any file.
 */
export function buildAppendOnlyPreview(
    existingContent: string,
    newEntries: Record<string, unknown>[],
): AppendOnlyPreview {
    const validation = validateAppendOnlyLedger(existingContent, newEntries);
    const existingLines = existingContent.trim() ? existingContent.trim().split('\n') : [];
    const newLines = newEntries.map(e => JSON.stringify(e));

    const previewLines = [...existingLines, ...newLines];
    const previewContent = previewLines.join('\n') + '\n';

    return {
        previewContent,
        newLineCount: newLines.length,
        totalLineCount: previewLines.length,
        existingLineCount: existingLines.length,
        appendOnlyStatus: validation.appendOnlyStatus,
        messages: validation.messages,
    };
}

// ─── appendLedgerArtifactIfSafe ───────────────────────────────────

/**
 * appendLedgerArtifactIfSafe
 *
 * Appends newEntries to the JSONL file at filePath if validation passes.
 * - If file does not exist: creates it
 * - If file exists: validates append-only rules, then appends
 * - If validation FAILS: throws error, does NOT write
 * - Never truncates or rewrites old content
 *
 * Returns a result object with append status and entry counts.
 */
export async function appendLedgerArtifactIfSafe(
    filePath: string,
    newEntries: Record<string, unknown>[],
    _options?: { createIfMissing?: boolean },
): Promise<{
    status: AppendOnlyStatus;
    filePath: string;
    appendedCount: number;
    messages: string[];
}> {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    let existingContent = '';
    if (fs.existsSync(filePath)) {
        existingContent = fs.readFileSync(filePath, 'utf8');
    }

    // Validate before writing
    const validation = validateAppendOnlyLedger(existingContent, newEntries);

    if (validation.appendOnlyStatus === 'FAIL') {
        throw new Error(
            `appendLedgerArtifactIfSafe: validation FAIL — cannot append to ${filePath}.\n` +
                validation.messages.join('\n'),
        );
    }

    // Safe to append
    const newLines = newEntries.map(e => JSON.stringify(e)).join('\n');
    const appendText = newLines + '\n';

    fs.appendFileSync(filePath, appendText, 'utf8');

    return {
        status: 'PASS',
        filePath,
        appendedCount: newEntries.length,
        messages: validation.messages,
    };
}
