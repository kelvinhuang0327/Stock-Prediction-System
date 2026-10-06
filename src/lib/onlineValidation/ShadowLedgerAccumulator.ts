/**
 * ShadowLedgerAccumulator.ts — P2 Cross-run Append-only Shadow Ledger Accumulation
 *
 * Manages the long-term shadow prediction ledger:
 * - Normalizes daily dry-run entries into a stable long-term format
 * - Accumulates entries across multiple runs (append-only)
 * - Produces ledger summaries for audit
 *
 * SAFETY CONTRACT:
 * - research mode only
 * - no DB write
 * - no external API call
 * - no LLM call
 * - append-only: existing keys cannot be overwritten
 * - existing lines cannot be modified
 * - malformed lines cause FAIL (not silent ignore)
 * - productionWriteAllowed: false — locked
 *
 * Not investment advice. Not a trading system.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    parseJsonlLedger,
    validateAppendOnlyLedger,
    appendLedgerArtifactIfSafe,
    buildAppendOnlyPreview,
} from './AppendOnlyShadowLedgerGuard';

// ─── Constants ────────────────────────────────────────────────────

export const LEDGER_VERSION = 'shadow-ledger-v1';
export const LEDGER_ENTRY_TYPE = 'SHADOW_PREDICTION' as const;
export const DEFAULT_LEDGER_BASE_DIR = 'outputs/online_validation';
export const DEFAULT_LEDGER_NAME = 'shadow_prediction_ledger.jsonl';

// Forbidden claim strings that must never appear in normalized entries
const FORBIDDEN_CLAIM_PATTERNS = [
    /\bbuy\b/i, /\bsell\b/i, /\bsignal\b/i, /\broi\b/i,
    /\bwin_rate\b/i, /\balpha\b/i, /\bedge\b/i, /\bprofit\b/i,
    /\brecommendation\b/i, /\boutperform\b/i, /\bguaranteed\b/i,
    /\bauto.?trading\b/i, /\bexpected_return\b/i, /\bpredicted_return\b/i,
    /\bexpected_profit\b/i, /\bpredicted_profit\b/i,
    /\bproduction.?approved\b/i,
];

// ─── Types ────────────────────────────────────────────────────────

export interface ShadowLedgerPathOptions {
    baseDir?: string;
    ledgerName?: string;
}

export interface ShadowLedgerEntry {
    ledgerVersion: typeof LEDGER_VERSION;
    entryType: typeof LEDGER_ENTRY_TYPE;
    runId: string;
    asOfDate: string;
    generatedAt: string;
    universeTier: string;
    symbol: string;
    stockName: string;
    researchBucket: string;
    scoreSnapshot: Record<string, unknown>;
    confidenceSnapshot: number;
    factorSnapshot: string[];
    riskSnapshot: string[];
    limitationSnapshot: string[];
    dataCoverageSnapshot: {
        coverage: string;
        usedSources: string[];
        missingSources: string[];
    };
    sourceDateBasis: {
        sourceDate: string;
        sourceType: string;
        missingDataFlags: string[];
    };
    targetHorizons: Array<{
        horizonLabel: string;
        outcomeStatus: string;
        outcomeWriteBackAllowed: false;
    }>;
    validationStatus: string;
    guardrailStatus: string;
    duplicateKey: string;
    ledgerKey: string;
    writeMode: string;
    productionWriteAllowed: false;
    createdAt: string;
}

export interface AccumulateOptions {
    ledgerPath: string;
    dryRun: true;
    append: boolean;
    runId: string;
    asOfDate: string;
}

export interface AccumulateResult {
    ledgerPath: string;
    dryRun: true;
    append: boolean;
    incomingCount: number;
    appendedCount: number;
    duplicateCount: number;
    existingCount: number;
    totalAfterAppend: number;
    appendOnlyStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

export interface LedgerSummary {
    totalEntries: number;
    uniqueRunCount: number;
    uniqueAsOfDateCount: number;
    symbolCount: number;
    byAsOfDate: Record<string, number>;
    byRunId: Record<string, number>;
    byResearchBucket: Record<string, number>;
    byValidationStatus: Record<string, number>;
    byGuardrailStatus: Record<string, number>;
    pendingOutcomeCount: number;
    readyOutcomeCount: number;
    malformedLineCount: number;
}

// ─── buildShadowLedgerPath ────────────────────────────────────────

/**
 * Returns the absolute path to the shadow prediction ledger file.
 * Defaults: baseDir=outputs/online_validation, ledgerName=shadow_prediction_ledger.jsonl
 */
export function buildShadowLedgerPath(options?: ShadowLedgerPathOptions): string {
    const baseDir = options?.baseDir ?? DEFAULT_LEDGER_BASE_DIR;
    const ledgerName = options?.ledgerName ?? DEFAULT_LEDGER_NAME;
    return path.resolve(baseDir, ledgerName);
}

// ─── buildLedgerKey ───────────────────────────────────────────────

/**
 * Builds the long-term ledger key for a shadow prediction entry.
 * Format: SHADOW_PREDICTION|asOfDate|symbol|universeTier|runId
 */
export function buildLedgerKey(entry: {
    asOfDate: string;
    symbol: string;
    universeTier: string;
    runId: string;
}): string {
    return `${LEDGER_ENTRY_TYPE}|${entry.asOfDate}|${entry.symbol}|${entry.universeTier}|${entry.runId}`;
}

// ─── normalizeShadowLedgerEntry ───────────────────────────────────

/**
 * Normalizes a ShadowPredictionLogEntry (or raw JSONL record) into a stable
 * long-term ledger entry format.
 *
 * - Adds ledgerVersion, entryType, ledgerKey, productionWriteAllowed, createdAt
 * - Sanitizes forbidden claims from string fields
 * - productionWriteAllowed is always false (type-locked)
 */
export function normalizeShadowLedgerEntry(entry: Record<string, unknown>): ShadowLedgerEntry {
    const runId = (entry['runId'] as string | undefined) ?? '';
    const asOfDate = (entry['asOfDate'] as string | undefined) ?? '';
    const universeTier = (entry['universeTier'] as string | undefined) ?? '';
    const symbol = (entry['symbol'] as string | undefined) ?? '';
    const stockName = (entry['stockName'] as string | undefined) ?? '';
    const researchBucket = sanitizeForbiddenClaims(
        (entry['researchBucket'] as string | undefined) ?? '',
    );
    const ledgerKey = buildLedgerKey({ asOfDate, symbol, universeTier, runId });

    const scoreSnapshot = entry['scoreSnapshot'] as Record<string, unknown> | undefined;
    const sanitizedScore: Record<string, unknown> = {};
    if (scoreSnapshot) {
        for (const [k, v] of Object.entries(scoreSnapshot)) {
            // Rename any forbidden key aliases
            const safeKey = k === 'alphaScore' ? 'researchScore' : k;
            sanitizedScore[safeKey] = v;
        }
    }

    const targetHorizons = (entry['targetHorizons'] as Array<Record<string, unknown>> | undefined) ?? [];
    const normalizedHorizons = targetHorizons.map(h => ({
        horizonLabel: (h['horizonLabel'] as string | undefined) ?? '',
        outcomeStatus: (h['outcomeStatus'] as string | undefined) ?? 'PENDING',
        outcomeWriteBackAllowed: false as const,
    }));

    // Count outcomes
    const dataCovSnap = entry['dataCoverageSnapshot'] as Record<string, unknown> | undefined;
    const srcDateBasis = entry['sourceDateBasis'] as Record<string, unknown> | undefined;

    return {
        ledgerVersion: LEDGER_VERSION,
        entryType: LEDGER_ENTRY_TYPE,
        runId,
        asOfDate,
        generatedAt: (entry['generatedAt'] as string | undefined) ?? new Date().toISOString(),
        universeTier,
        symbol,
        stockName,
        researchBucket,
        scoreSnapshot: sanitizedScore,
        confidenceSnapshot: (entry['confidenceSnapshot'] as number | undefined) ?? 0,
        factorSnapshot: (entry['factorSnapshot'] as string[] | undefined) ?? [],
        riskSnapshot: (entry['riskSnapshot'] as string[] | undefined) ?? [],
        limitationSnapshot: (entry['limitationSnapshot'] as string[] | undefined) ?? [],
        dataCoverageSnapshot: {
            coverage: (dataCovSnap?.['coverage'] as string | undefined) ?? 'unknown',
            usedSources: (dataCovSnap?.['usedSources'] as string[] | undefined) ?? [],
            missingSources: (dataCovSnap?.['missingSources'] as string[] | undefined) ?? [],
        },
        sourceDateBasis: {
            sourceDate: (srcDateBasis?.['sourceDate'] as string | undefined) ?? asOfDate,
            sourceType: (srcDateBasis?.['sourceType'] as string | undefined) ?? 'unknown',
            missingDataFlags: (srcDateBasis?.['missingDataFlags'] as string[] | undefined) ?? [],
        },
        targetHorizons: normalizedHorizons,
        validationStatus: (entry['validationStatus'] as string | undefined) ?? 'UNKNOWN',
        guardrailStatus: (entry['guardrailStatus'] as string | undefined) ?? 'UNKNOWN',
        duplicateKey: (entry['duplicateKey'] as string | undefined) ?? '',
        ledgerKey,
        writeMode: (entry['writeMode'] as string | undefined) ?? 'DRY_RUN',
        productionWriteAllowed: false,
        createdAt: new Date().toISOString(),
    };
}

// ─── accumulateShadowPredictionLedger ────────────────────────────

/**
 * Accumulates shadow prediction entries into the long-term ledger.
 *
 * - Normalizes all incoming entries
 * - Validates append-only contract (no duplicates, no malformed lines)
 * - If append=true: writes to ledger file using appendLedgerArtifactIfSafe
 * - If append=false: only produces a preview (no file write)
 * - Returns full accumulation result
 */
export async function accumulateShadowPredictionLedger(
    entries: Record<string, unknown>[],
    options: AccumulateOptions,
): Promise<AccumulateResult> {
    const { ledgerPath, append, runId, asOfDate } = options;

    // Normalize entries
    const normalized = entries.map(e => normalizeShadowLedgerEntry(e));

    // Read existing ledger content
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    let existingContent = '';
    if (fs.existsSync(ledgerPath)) {
        existingContent = fs.readFileSync(ledgerPath, 'utf8');
    }

    const parseResult = parseJsonlLedger(existingContent);
    const existingCount = parseResult.entries.length;

    // Validate append-only
    const validation = validateAppendOnlyLedger(
        existingContent,
        normalized as unknown as Record<string, unknown>[],
    );

    const duplicateCount = validation.duplicateKeys.length;

    if (!append) {
        // Preview only — do not write
        buildAppendOnlyPreview(
            existingContent,
            normalized as unknown as Record<string, unknown>[],
        );
        return {
            ledgerPath,
            dryRun: true,
            append: false,
            incomingCount: entries.length,
            appendedCount: 0,
            duplicateCount,
            existingCount,
            totalAfterAppend: existingCount,
            appendOnlyStatus: validation.appendOnlyStatus,
            validationMessages: [
                ...validation.messages,
                `INFO: append=false — preview only, no file write`,
                `INFO: runId=${runId}, asOfDate=${asOfDate}`,
            ],
        };
    }

    if (validation.appendOnlyStatus === 'FAIL') {
        return {
            ledgerPath,
            dryRun: true,
            append: true,
            incomingCount: entries.length,
            appendedCount: 0,
            duplicateCount,
            existingCount,
            totalAfterAppend: existingCount,
            appendOnlyStatus: 'FAIL',
            validationMessages: validation.messages,
        };
    }

    // Safe to append
    const appendResult = await appendLedgerArtifactIfSafe(
        ledgerPath,
        normalized as unknown as Record<string, unknown>[],
    );

    return {
        ledgerPath,
        dryRun: true,
        append: true,
        incomingCount: entries.length,
        appendedCount: appendResult.appendedCount,
        duplicateCount,
        existingCount,
        totalAfterAppend: existingCount + appendResult.appendedCount,
        appendOnlyStatus: appendResult.status,
        validationMessages: appendResult.messages,
    };
}

// ─── summarizeShadowLedger ────────────────────────────────────────

/**
 * Parses a JSONL ledger string and produces a summary with statistics.
 */
export function summarizeShadowLedger(content: string): LedgerSummary {
    const parseResult = parseJsonlLedger(content);
    const malformedLineCount = parseResult.errors.length;
    const entries = parseResult.entries;

    const uniqueRuns = new Set<string>();
    const uniqueAsOfDates = new Set<string>();
    const uniqueSymbols = new Set<string>();
    const byAsOfDate: Record<string, number> = {};
    const byRunId: Record<string, number> = {};
    const byResearchBucket: Record<string, number> = {};
    const byValidationStatus: Record<string, number> = {};
    const byGuardrailStatus: Record<string, number> = {};
    let pendingOutcomeCount = 0;
    let readyOutcomeCount = 0;

    for (const entry of entries) {
        const runId = (entry['runId'] as string | undefined) ?? 'unknown';
        const asOfDate = (entry['asOfDate'] as string | undefined) ?? 'unknown';
        const symbol = (entry['symbol'] as string | undefined) ?? 'unknown';
        const researchBucket = (entry['researchBucket'] as string | undefined) ?? 'unknown';
        const validationStatus = (entry['validationStatus'] as string | undefined) ?? 'unknown';
        const guardrailStatus = (entry['guardrailStatus'] as string | undefined) ?? 'unknown';
        const targetHorizons = (entry['targetHorizons'] as Array<Record<string, unknown>> | undefined) ?? [];

        uniqueRuns.add(runId);
        uniqueAsOfDates.add(asOfDate);
        uniqueSymbols.add(symbol);

        byAsOfDate[asOfDate] = (byAsOfDate[asOfDate] ?? 0) + 1;
        byRunId[runId] = (byRunId[runId] ?? 0) + 1;
        byResearchBucket[researchBucket] = (byResearchBucket[researchBucket] ?? 0) + 1;
        byValidationStatus[validationStatus] = (byValidationStatus[validationStatus] ?? 0) + 1;
        byGuardrailStatus[guardrailStatus] = (byGuardrailStatus[guardrailStatus] ?? 0) + 1;

        for (const h of targetHorizons) {
            const status = (h['outcomeStatus'] as string | undefined) ?? 'PENDING';
            if (status === 'PENDING') pendingOutcomeCount++;
            else if (status === 'READY_FOR_REVIEW') readyOutcomeCount++;
        }
    }

    return {
        totalEntries: entries.length,
        uniqueRunCount: uniqueRuns.size,
        uniqueAsOfDateCount: uniqueAsOfDates.size,
        symbolCount: uniqueSymbols.size,
        byAsOfDate,
        byRunId,
        byResearchBucket,
        byValidationStatus,
        byGuardrailStatus,
        pendingOutcomeCount,
        readyOutcomeCount,
        malformedLineCount,
    };
}

// ─── Internal helpers ─────────────────────────────────────────────

function sanitizeForbiddenClaims(text: string): string {
    let result = text;
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
        result = result.replace(pattern, match => `[SANITIZED:${match}]`);
    }
    return result;
}
