/**
 * SimulationSnapshotCorpusAccumulator.ts — P6 Online Validation
 *
 * Accumulates P5 simulation snapshot batches into a multi-date append-only
 * corpus JSONL artifact.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - append-only: existing entries cannot be overwritten
 * - duplicate key => FAIL
 * - malformed JSONL => FAIL (not silent ignore)
 * - productionWriteAllowed: false LOCKED
 * - simulationWriteAllowed: false LOCKED
 * - optimizerWriteAllowed: false LOCKED
 */

import * as fs from 'fs';
import * as path from 'path';

export const CORPUS_VERSION = 'sim-corpus-v0';
export const CORPUS_ENTRY_TYPE = 'SIMULATION_SNAPSHOT';

// ─── Forbidden claim patterns ──────────────────────────────────────

const FORBIDDEN_PATTERNS = [
    /\bprofit\b/i,
    /\bguaranteed\b/i,
    /\bedge confirmed\b/i,
    /\bproduction approved\b/i,
    /\bauto trading\b/i,
    /\bbuy\b/i,
    /\bsell\b/i,
    /\boutperform\b/i,
    /\bexpected_return\b/i,
    /\bstrategy performance\b/i,
];

function hasForbiddenClaim(text: string): boolean {
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

// ─── Types ────────────────────────────────────────────────────────

export interface CorpusPathOptions {
    baseDir?: string;
    corpusName?: string;
}

export interface NormalizeOptions {
    corpusRunId: string;
    corpusVersion?: string;
    ingestionDate: string;
}

export interface CorpusEntry {
    corpusVersion: string;
    corpusRunId: string;
    corpusEntryKey: string;
    entryType: typeof CORPUS_ENTRY_TYPE;
    sourceSimulationRunId: string;
    simulationSnapshotKey: string;
    replayKey: string;
    originalRunId: string;
    originalAsOfDate: string;
    symbol: string;
    stockName: string;
    universeTier: string;
    horizonLabel: string;
    horizonDays: number;
    targetTradingDate: string;
    reviewDate: string;
    researchBucket: string;
    scoreSnapshot: Record<string, unknown>;
    confidenceSnapshot: unknown;
    factorSnapshot: unknown[];
    riskSnapshot: unknown[];
    limitationSnapshot: unknown[];
    dataCoverageSnapshot: unknown;
    sourceDateBasis: unknown;
    outcomeSnapshot: unknown;
    snapshotStatus: string;
    snapshotBlockedReason: string;
    pitSafeStatus: string;
    productionWriteAllowed: false;
    simulationWriteAllowed: false;
    optimizerWriteAllowed: false;
    createdAt: string;
    validationMessages: string[];
}

export interface ValidateCorpusAppendOptions {
    allowDuplicates?: boolean;
}

export interface CorpusAppendValidationResult {
    valid: boolean;
    status: 'PASS' | 'FAIL';
    duplicateKeys: string[];
    messages: string[];
}

export interface AccumulateOptions {
    corpusPath: string;
    corpusRunId: string;
    ingestionDate: string;
    append: boolean;
    dryRun: true;
}

export interface AccumulationResult {
    corpusPath: string;
    corpusRunId: string;
    ingestionDate: string;
    dryRun: true;
    append: boolean;
    incomingCount: number;
    appendedCount: number;
    existingCount: number;
    totalAfterAppend: number;
    duplicateCount: number;
    appendStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

// ─── Exports ──────────────────────────────────────────────────────

/**
 * Returns the absolute path for the corpus JSONL file.
 */
export function buildSnapshotCorpusPath(options: CorpusPathOptions = {}): string {
    const baseDir = options.baseDir ?? path.resolve(process.cwd(), 'outputs/online_validation');
    const corpusName = options.corpusName ?? 'simulation_snapshot_corpus.jsonl';
    return path.resolve(baseDir, corpusName);
}

/**
 * Builds a deterministic corpus entry key.
 * Format: SIM_CORPUS|simulationRunId|originalAsOfDate|symbol|universeTier|horizonLabel
 */
export function buildCorpusEntryKey(snapshot: Record<string, unknown>): string {
    const runId = String(snapshot['simulationRunId'] ?? '');
    const asOfDate = String(snapshot['originalAsOfDate'] ?? '');
    const symbol = String(snapshot['symbol'] ?? '');
    const tier = String(snapshot['universeTier'] ?? '');
    const horizon = String(snapshot['horizonLabel'] ?? '');
    return `SIM_CORPUS|${runId}|${asOfDate}|${symbol}|${tier}|${horizon}`;
}

/**
 * Normalizes a simulation snapshot record into a corpus entry.
 * Three write locks are LOCKED to false unconditionally.
 */
export function normalizeSnapshotForCorpus(
    snapshot: Record<string, unknown>,
    options: NormalizeOptions,
): CorpusEntry {
    const corpusEntryKey = buildCorpusEntryKey(snapshot);
    const corpusVersion = options.corpusVersion ?? CORPUS_VERSION;

    return {
        corpusVersion,
        corpusRunId: options.corpusRunId,
        corpusEntryKey,
        entryType: CORPUS_ENTRY_TYPE,
        sourceSimulationRunId: String(snapshot['simulationRunId'] ?? ''),
        simulationSnapshotKey: String(snapshot['simulationSnapshotKey'] ?? ''),
        replayKey: String(snapshot['replayKey'] ?? ''),
        originalRunId: String(snapshot['originalRunId'] ?? ''),
        originalAsOfDate: String(snapshot['originalAsOfDate'] ?? ''),
        symbol: String(snapshot['symbol'] ?? ''),
        stockName: String(snapshot['stockName'] ?? ''),
        universeTier: String(snapshot['universeTier'] ?? ''),
        horizonLabel: String(snapshot['horizonLabel'] ?? ''),
        horizonDays: Number(snapshot['horizonDays'] ?? 0),
        targetTradingDate: String(snapshot['targetTradingDate'] ?? ''),
        reviewDate: String(snapshot['reviewDate'] ?? ''),
        researchBucket: String(snapshot['researchBucket'] ?? ''),
        scoreSnapshot: (snapshot['scoreSnapshot'] as Record<string, unknown>) ?? {},
        confidenceSnapshot: snapshot['confidenceSnapshot'] ?? null,
        factorSnapshot: (snapshot['factorSnapshot'] as unknown[]) ?? [],
        riskSnapshot: (snapshot['riskSnapshot'] as unknown[]) ?? [],
        limitationSnapshot: (snapshot['limitationSnapshot'] as unknown[]) ?? [],
        dataCoverageSnapshot: snapshot['dataCoverageSnapshot'] ?? null,
        sourceDateBasis: snapshot['sourceDateBasis'] ?? null,
        outcomeSnapshot: snapshot['outcomeSnapshot'] ?? null,
        snapshotStatus: String(snapshot['snapshotStatus'] ?? 'SNAPSHOT_BLOCKED'),
        snapshotBlockedReason: String(snapshot['snapshotBlockedReason'] ?? 'UNKNOWN'),
        pitSafeStatus: String(snapshot['pitSafeStatus'] ?? 'UNKNOWN'),
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
        createdAt: new Date().toISOString(),
        validationMessages: (snapshot['validationMessages'] as string[]) ?? [],
    };
}

/**
 * Parses corpus JSONL content. Empty lines ignored. Malformed lines throw.
 */
export function parseSnapshotCorpusJsonl(content: string): CorpusEntry[] {
    const lines = content.split('\n');
    const entries: CorpusEntry[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
            entries.push(JSON.parse(line) as CorpusEntry);
        } catch {
            throw new Error(`Malformed JSONL at line ${i + 1}: ${line.slice(0, 80)}`);
        }
    }
    return entries;
}

/**
 * Validates that new entries can be safely appended to an existing corpus.
 * Rejects duplicate keys and forbidden claims.
 */
export function validateCorpusAppend(
    existingContent: string,
    newEntries: CorpusEntry[],
    _options: ValidateCorpusAppendOptions = {},
): CorpusAppendValidationResult {
    const messages: string[] = [];
    const duplicateKeys: string[] = [];
    let valid = true;

    // Parse existing corpus (throws on malformed)
    const existing = existingContent.trim() ? parseSnapshotCorpusJsonl(existingContent) : [];
    const existingKeys = new Set(existing.map(e => e.corpusEntryKey));

    // Check new entries
    const newKeys = new Set<string>();
    for (const entry of newEntries) {
        // Duplicate against existing corpus
        if (existingKeys.has(entry.corpusEntryKey)) {
            duplicateKeys.push(entry.corpusEntryKey);
            messages.push(`FAIL: duplicate corpusEntryKey in existing corpus: ${entry.corpusEntryKey}`);
            valid = false;
        }
        // Duplicate within new batch
        if (newKeys.has(entry.corpusEntryKey)) {
            duplicateKeys.push(entry.corpusEntryKey);
            messages.push(`FAIL: duplicate corpusEntryKey within new batch: ${entry.corpusEntryKey}`);
            valid = false;
        }
        newKeys.add(entry.corpusEntryKey);

        // Write lock checks
        if (entry.productionWriteAllowed !== false) {
            messages.push(`FAIL: productionWriteAllowed must be false: ${entry.corpusEntryKey}`);
            valid = false;
        }
        if (entry.simulationWriteAllowed !== false) {
            messages.push(`FAIL: simulationWriteAllowed must be false: ${entry.corpusEntryKey}`);
            valid = false;
        }
        if (entry.optimizerWriteAllowed !== false) {
            messages.push(`FAIL: optimizerWriteAllowed must be false: ${entry.corpusEntryKey}`);
            valid = false;
        }

        // Forbidden claims
        const text = entry.validationMessages.join(' ');
        if (hasForbiddenClaim(text)) {
            messages.push(`FAIL: forbidden claim in entry: ${entry.corpusEntryKey}`);
            valid = false;
        }
    }

    if (valid) messages.push('PASS: corpus append validation passed');

    return {
        valid,
        status: valid ? 'PASS' : 'FAIL',
        duplicateKeys,
        messages,
    };
}

/**
 * Accumulates snapshots from a batch into the corpus.
 * append=false: preview only. append=true: write to corpusPath.
 * Never truncates or rewrites existing content.
 */
export function accumulateSnapshotCorpus(
    snapshotBatch: { snapshots: Record<string, unknown>[] },
    options: AccumulateOptions,
): AccumulationResult {
    const { corpusPath, corpusRunId, ingestionDate, append } = options;
    const messages: string[] = [];

    // Read existing corpus
    let existingContent = '';
    let existingCount = 0;
    if (fs.existsSync(corpusPath)) {
        existingContent = fs.readFileSync(corpusPath, 'utf8');
        const existing = existingContent.trim() ? parseSnapshotCorpusJsonl(existingContent) : [];
        existingCount = existing.length;
    }

    // Normalize incoming snapshots
    const newEntries = snapshotBatch.snapshots.map(s =>
        normalizeSnapshotForCorpus(s, {
            corpusRunId,
            ingestionDate,
            corpusVersion: CORPUS_VERSION,
        }),
    );
    const incomingCount = newEntries.length;

    // Validate append
    const validation = validateCorpusAppend(existingContent, newEntries);
    messages.push(...validation.messages);

    if (!validation.valid) {
        return {
            corpusPath,
            corpusRunId,
            ingestionDate,
            dryRun: true,
            append,
            incomingCount,
            appendedCount: 0,
            existingCount,
            totalAfterAppend: existingCount,
            duplicateCount: validation.duplicateKeys.length,
            appendStatus: 'FAIL',
            validationMessages: messages,
        };
    }

    // Write if append=true
    if (append) {
        const newLines = newEntries.map(e => JSON.stringify(e)).join('\n') + '\n';
        fs.appendFileSync(corpusPath, newLines, 'utf8');
        messages.push(`Appended ${incomingCount} entries to ${corpusPath}`);
    } else {
        messages.push(`DRY_RUN_PREVIEW: would append ${incomingCount} entries (not written)`);
    }

    return {
        corpusPath,
        corpusRunId,
        ingestionDate,
        dryRun: true,
        append,
        incomingCount,
        appendedCount: append ? incomingCount : 0,
        existingCount,
        totalAfterAppend: existingCount + (append ? incomingCount : 0),
        duplicateCount: 0,
        appendStatus: 'PASS',
        validationMessages: messages,
    };
}
