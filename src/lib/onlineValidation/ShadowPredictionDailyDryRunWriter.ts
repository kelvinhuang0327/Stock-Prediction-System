/**
 * ShadowPredictionDailyDryRunWriter.ts — P0-COMBINED
 *
 * Daily dry-run writer for shadow prediction log.
 * Converts StrategyScreenEngine research candidates into auditable daily JSONL artifacts.
 *
 * SAFETY CONTRACT (strict — do not weaken):
 * - research mode only — dry-run only
 * - no production Prediction row write
 * - no StrategySignal write
 * - no DB write
 * - no external API call
 * - no LLM call
 * - no auto trading
 * - no precision prediction claim
 * - no performance claim
 * - no edge claim
 * - writeMode locked to DRY_RUN_ARTIFACT_ONLY
 * - all artifacts go to outputs/online_validation only
 *
 * Not investment advice. Not a trading system.
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

import { resolveAsOfDate } from '@/lib/data/AsOfDataGate';
import {
    accumulateShadowPredictionLedger,
    buildShadowLedgerPath,
    summarizeShadowLedger,
    AccumulateResult,
    LedgerSummary,
} from './ShadowLedgerAccumulator';
import {
    RawResearchCandidate,
    ShadowPredictionLogBatch,
    ShadowPredictionLogEntry,
    ValidationStatusValue,
    sanitizeResearchCandidateForShadowLog,
    buildShadowPredictionLogBatch,
    validateShadowPredictionLogBatch,
    buildShadowPredictionLogArtifact,
    SourceDateBasis,
    TargetHorizon,
} from './ShadowPredictionLogContract';

// ─── Constants ────────────────────────────────────────────────────

export const WRITER_VERSION = 'p0combined-v1';
export const ARTIFACT_OUTPUT_DIR = 'outputs/online_validation';
export const WRITE_MODE = 'DRY_RUN_ARTIFACT_ONLY' as const;
export type DryRunWriteMode = typeof WRITE_MODE;

// ─── Types ────────────────────────────────────────────────────────

export type UniverseTier = 'MVP_CORE' | 'MVP_EXTENDED' | 'RESEARCH_ONLY';

export interface ShadowPredictionDryRunConfig {
    asOfDate: string;                   // YYYY-MM-DD, resolved by resolveAsOfDate()
    runId: string;                      // deterministic or injected
    maxCandidates: number;              // default 20
    universeTier: UniverseTier;
    dryRun: true;                       // always true — locked
    writeMode: DryRunWriteMode;         // always DRY_RUN_ARTIFACT_ONLY — locked
    sourceDateBasis: SourceDateBasis;
    targetHorizons?: TargetHorizon[];
    // Ledger accumulation options
    appendToLedger?: boolean;           // if true, append to long-term shadow ledger
    ledgerPath?: string;                // explicit ledger path (overrides ledgerName)
    ledgerName?: string;                // ledger file name (default: shadow_prediction_ledger.jsonl)
}

export interface ShadowPredictionDryRunResult {
    config: ShadowPredictionDryRunConfig;
    batch: ShadowPredictionLogBatch;
    validationResult: ShadowPredictionDryRunValidationResult;
    summary: ShadowPredictionDryRunSummary;
    jsonlPreview: string;
    ledgerAccumulateResult?: AccumulateResult;
    ledgerSummary?: LedgerSummary;
}

export interface ShadowPredictionDryRunArtifactPaths {
    jsonPath: string;
    jsonlPath: string;
    markdownPath: string;
}

export interface ShadowPredictionDryRunValidationResult {
    status: ValidationStatusValue;
    batchStatus: ValidationStatusValue;
    duplicateKeyStatus: ValidationStatusValue;
    sourceDateBasisStatus: ValidationStatusValue;
    forbiddenFieldStatus: ValidationStatusValue;
    targetHorizonsStatus: ValidationStatusValue;
    messages: string[];
}

export interface ShadowPredictionDryRunSummary {
    asOfDate: string;
    runId: string;
    candidateCount: number;
    writtenLineCount: number;
    duplicateCount: number;
    failedValidationCount: number;
    warningCount: number;
    dryRunOnly: true;
    readinessStatus: 'READY' | 'WARN' | 'NOT_READY';
}

/** Candidate provider interface — allows injection of mock candidates in tests */
export type CandidateProvider = (
    asOfDate: string,
    maxCandidates: number,
    universeTier: UniverseTier,
) => Promise<RawResearchCandidate[]>;

// ─── Default candidate provider (uses static MVP research candidates) ──────

/**
 * Default research candidate provider.
 * Returns a curated static set of MVP research candidates for dry-run purposes.
 * Does NOT call StrategyScreenEngine (which requires DB access).
 * Does NOT call external APIs. Does NOT call LLM.
 *
 * In production integration, this can be replaced with a real StrategyScreenEngine
 * runner via the injectable `candidateProvider` parameter.
 */
export function buildDefaultDryRunCandidates(
    asOfDate: string,
    maxCandidates: number,
    universeTier: UniverseTier,
): RawResearchCandidate[] {
    const sourceDate = asOfDate; // sourceDateBasis is <= asOfDate

    const mvpCandidates: RawResearchCandidate[] = [
        {
            symbol: '2330',
            name: 'Taiwan Semiconductor Manufacturing',
            alphaScore: 74.2,
            recommendationBucket: 'Strong Candidate',
            confidence: 68,
            technicalScore: 78,
            chipScore: 72,
            fundamentalScore: 82,
            marketAdjustment: 4,
            topFactors: ['price momentum above 60-day average', 'institutional concentration improving', 'revenue growth trend'],
            keyRisks: ['sector concentration', 'macro sensitivity'],
            limitations: ['limited forward visibility'],
            dataCoverage: 'full',
            usedSources: ['stockQuote', 'institutionalChip', 'financialReport'],
            missingSources: [],
        },
        {
            symbol: '2454',
            name: 'MediaTek',
            alphaScore: 68.5,
            recommendationBucket: 'Strong Candidate',
            confidence: 62,
            technicalScore: 70,
            chipScore: 65,
            fundamentalScore: 76,
            marketAdjustment: 3,
            topFactors: ['technical structure improving', 'chip flow neutral to positive'],
            keyRisks: ['competitive pressure', 'inventory cycle'],
            limitations: ['chip data T+1 lag'],
            dataCoverage: 'full',
            usedSources: ['stockQuote', 'institutionalChip'],
            missingSources: ['monthlyRevenue'],
        },
        {
            symbol: '2317',
            name: 'Foxconn',
            alphaScore: 55.1,
            recommendationBucket: 'Watch',
            confidence: 48,
            technicalScore: 57,
            chipScore: 52,
            fundamentalScore: 61,
            marketAdjustment: 0,
            topFactors: ['volume stabilizing', 'neutral price action'],
            keyRisks: ['customer concentration', 'margin pressure'],
            limitations: ['revenue data partial'],
            dataCoverage: 'limited',
            usedSources: ['stockQuote'],
            missingSources: ['institutionalChip', 'monthlyRevenue'],
        },
        {
            symbol: '2882',
            name: 'Cathay Financial Holdings',
            alphaScore: 49.8,
            recommendationBucket: 'Watch',
            confidence: 44,
            technicalScore: 48,
            chipScore: 51,
            fundamentalScore: 58,
            marketAdjustment: -2,
            topFactors: ['dividend yield support', 'stable deposit growth'],
            keyRisks: ['interest rate sensitivity', 'insurance loss ratio'],
            limitations: ['financials lag by quarter'],
            dataCoverage: 'limited',
            usedSources: ['stockQuote', 'financialReport'],
            missingSources: ['institutionalChip'],
        },
        {
            symbol: '6505',
            name: 'Formosa Plastics',
            alphaScore: 42.3,
            recommendationBucket: 'Neutral',
            confidence: 38,
            technicalScore: 40,
            chipScore: 44,
            fundamentalScore: 52,
            marketAdjustment: -3,
            topFactors: ['book value support'],
            keyRisks: ['commodity cycle', 'ESG regulatory pressure'],
            limitations: ['revenue data limited'],
            dataCoverage: 'limited',
            usedSources: ['stockQuote'],
            missingSources: ['institutionalChip', 'monthlyRevenue', 'financialReport'],
        },
    ];

    const tierFiltered = universeTier === 'MVP_CORE'
        ? mvpCandidates.filter(c => (c.confidence ?? 0) >= 60)
        : universeTier === 'MVP_EXTENDED'
            ? mvpCandidates.filter(c => (c.confidence ?? 0) >= 40)
            : mvpCandidates;

    return tierFiltered.slice(0, maxCandidates);
}

// ─── Core Functions ───────────────────────────────────────────────

/**
 * buildShadowPredictionDryRunConfig
 *
 * Builds a validated dry-run config.
 * - Supports explicit asOfDate; resolves via resolveAsOfDate() if not provided
 * - Forces dryRun=true, writeMode=DRY_RUN_ARTIFACT_ONLY
 * - Does NOT hardcode today's date
 */
export function buildShadowPredictionDryRunConfig(params?: {
    asOfDate?: string;
    maxCandidates?: number;
    universeTier?: UniverseTier;
    runId?: string;
    appendToLedger?: boolean;
    ledgerPath?: string;
    ledgerName?: string;
}): ShadowPredictionDryRunConfig {
    const resolvedAsOfDate = resolveAsOfDate(params?.asOfDate);
    const runId = params?.runId ?? `dry-run-${resolvedAsOfDate}-${randomUUID().slice(0, 8)}`;

    // sourceDateBasis defaults to asOfDate (conservative — no forward look)
    const sourceDateBasis: SourceDateBasis = {
        sourceDate: resolvedAsOfDate,
        sourceType: 'stockQuote',
        missingDataFlags: [],
    };

    return {
        asOfDate: resolvedAsOfDate,
        runId,
        maxCandidates: params?.maxCandidates ?? 20,
        universeTier: params?.universeTier ?? 'MVP_CORE',
        dryRun: true,
        writeMode: WRITE_MODE,
        sourceDateBasis,
        appendToLedger: params?.appendToLedger ?? false,
        ledgerPath: params?.ledgerPath,
        ledgerName: params?.ledgerName,
    };
}

/**
 * runShadowPredictionDailyDryRun
 *
 * Executes the daily dry-run pipeline:
 * 1. Resolves candidates via injectable provider (or default static set)
 * 2. Applies sanitizeResearchCandidateForShadowLog
 * 3. Builds ShadowPredictionLogBatch via buildShadowPredictionLogBatch
 * 4. Validates via validateShadowPredictionLogBatch
 *
 * Does NOT write to DB, production ledger, external API, or LLM.
 */
export async function runShadowPredictionDailyDryRun(
    config: ShadowPredictionDryRunConfig,
    candidateProvider?: CandidateProvider,
): Promise<ShadowPredictionDryRunResult> {
    const provider = candidateProvider ?? (
        async (asOfDate: string, maxCandidates: number, universeTier: UniverseTier) =>
            buildDefaultDryRunCandidates(asOfDate, maxCandidates, universeTier)
    );

    const rawCandidates = await provider(
        config.asOfDate,
        config.maxCandidates,
        config.universeTier,
    );

    // Sanitize: removes forbidden fields, renames alphaScore→researchScore, etc.
    const sanitized = rawCandidates.map(c => sanitizeResearchCandidateForShadowLog(c));

    // Re-map to RawResearchCandidate shape for buildShadowPredictionLogBatch
    const remappedCandidates: RawResearchCandidate[] = sanitized.map(s => ({
        symbol: s.symbol,
        name: s.stockName,
        alphaScore: s.researchScore,
        recommendationBucket: s.researchBucket,
        confidence: s.confidenceScore,
        technicalScore: s.technicalScore,
        chipScore: s.chipScore,
        fundamentalScore: s.fundamentalScore,
        marketAdjustment: s.marketAdjustment,
        factors: s.factors,
        keyRisks: s.keyRisks,
        limitations: s.limitations,
        dataCoverage: s.dataCoverageSnapshot.coverage,
        usedSources: s.dataCoverageSnapshot.usedSources,
        missingSources: s.dataCoverageSnapshot.missingSources,
    }));

    const batch = buildShadowPredictionLogBatch({
        candidates: remappedCandidates,
        asOfDate: config.asOfDate,
        runId: config.runId,
        universeTier: config.universeTier,
        sourceDateBasis: config.sourceDateBasis,
        targetHorizons: config.targetHorizons,
        maxCandidates: config.maxCandidates,
        runMode: 'DRY_RUN',
    });

    const validationResult = validateShadowPredictionDryRunResult(batch, config.asOfDate);
    const jsonlPreview = buildShadowPredictionJsonlPreview(batch.entries);
    const summary = summarizeShadowPredictionDryRun(config, batch, validationResult);

    let ledgerAccumulateResult: AccumulateResult | undefined;
    let ledgerSummary: LedgerSummary | undefined;

    if (config.appendToLedger) {
        const ledgerPath = config.ledgerPath ?? buildShadowLedgerPath({
            ledgerName: config.ledgerName,
        });
        const rawEntries = batch.entries as unknown as Record<string, unknown>[];
        ledgerAccumulateResult = await accumulateShadowPredictionLedger(rawEntries, {
            ledgerPath,
            dryRun: true,
            append: true,
            runId: config.runId,
            asOfDate: config.asOfDate,
        });

        // Propagate FAIL to summary
        if (ledgerAccumulateResult.appendOnlyStatus === 'FAIL') {
            summary.readinessStatus = 'WARN';
        }

        // Build ledger summary from current ledger content
        if (fs.existsSync(ledgerPath)) {
            const ledgerContent = fs.readFileSync(ledgerPath, 'utf8');
            ledgerSummary = summarizeShadowLedger(ledgerContent);
        }
    }

    return { config, batch, validationResult, summary, jsonlPreview, ledgerAccumulateResult, ledgerSummary };
}

/**
 * buildShadowPredictionDryRunArtifact
 *
 * Writes JSON, JSONL, and Markdown artifacts to outputs/online_validation.
 * Does NOT write to DB or production ledger.
 * Returns artifact paths.
 */
export function buildShadowPredictionDryRunArtifact(
    result: ShadowPredictionDryRunResult,
    outputDir?: string,
): ShadowPredictionDryRunArtifactPaths {
    const dir = outputDir ?? ARTIFACT_OUTPUT_DIR;
    fs.mkdirSync(dir, { recursive: true });

    const artifact = buildShadowPredictionLogArtifact(result.batch);

    // JSON
    const jsonPath = path.join(dir, 'p0combined_shadow_daily_dry_run_result.json');
    fs.writeFileSync(
        jsonPath,
        JSON.stringify(
            {
                writerVersion: WRITER_VERSION,
                writeMode: WRITE_MODE,
                dryRunOnly: true,
                config: result.config,
                summary: result.summary,
                validationResult: result.validationResult,
                batch: artifact.jsonPayload,
            },
            null,
            2,
        ),
        'utf8',
    );

    // JSONL — one entry per line, deterministic ordering
    const jsonlPath = path.join(dir, 'p0combined_shadow_daily_dry_run.jsonl');
    const jsonlContent = artifact.jsonlLines.join('\n') + (artifact.jsonlLines.length > 0 ? '\n' : '');
    fs.writeFileSync(jsonlPath, jsonlContent, 'utf8');

    // Markdown
    const mdPath = path.join(dir, 'p0combined_shadow_daily_dry_run_result.md');
    const mdContent = buildDryRunMarkdown(result);
    fs.writeFileSync(mdPath, mdContent, 'utf8');

    // Ledger accumulation artifacts (P2)
    if (result.ledgerAccumulateResult) {
        const accResult = result.ledgerAccumulateResult;
        const accJsonPath = path.join(dir, 'p2_shadow_ledger_accumulation_result.json');
        fs.writeFileSync(
            accJsonPath,
            JSON.stringify(
                {
                    runId: result.config.runId,
                    asOfDate: result.config.asOfDate,
                    dryRunOnly: true,
                    ...accResult,
                },
                null,
                2,
            ),
            'utf8',
        );

        const accMdPath = path.join(dir, 'p2_shadow_ledger_accumulation_result.md');
        fs.writeFileSync(accMdPath, buildLedgerAccumulationMarkdown(result), 'utf8');
    }

    if (result.ledgerSummary) {
        const summJsonPath = path.join(dir, 'p2_shadow_ledger_summary.json');
        fs.writeFileSync(summJsonPath, JSON.stringify(result.ledgerSummary, null, 2), 'utf8');

        const summMdPath = path.join(dir, 'p2_shadow_ledger_summary.md');
        fs.writeFileSync(summMdPath, buildLedgerSummaryMarkdown(result.ledgerSummary), 'utf8');
    }

    return { jsonPath, jsonlPath, markdownPath: mdPath };
}

/**
 * validateShadowPredictionDryRunResult
 *
 * Validates:
 * - batch status
 * - duplicateKey uniqueness
 * - sourceDateBasis.sourceDate <= asOfDate
 * - no forbidden fields
 * - all targetHorizons = PENDING
 *
 * Returns PASS / WARN / FAIL
 */
export function validateShadowPredictionDryRunResult(
    batch: ShadowPredictionLogBatch,
    asOfDate: string,
): ShadowPredictionDryRunValidationResult {
    const messages: string[] = [];

    // Batch-level validation
    const batchValidation = validateShadowPredictionLogBatch({ entries: batch.entries, asOfDate });
    const batchStatus = batchValidation.status;
    messages.push(...batchValidation.messages);

    // Duplicate key uniqueness
    const keys = batch.entries.map(e => e.duplicateKey);
    const uniqueKeys = new Set(keys);
    const duplicateKeyStatus: ValidationStatusValue = uniqueKeys.size === keys.length ? 'PASS' : 'FAIL';
    if (duplicateKeyStatus === 'FAIL') {
        messages.push('FAIL: duplicate keys detected in batch');
    }

    // sourceDateBasis check
    let sourceDateBasisStatus: ValidationStatusValue = 'PASS';
    for (const entry of batch.entries) {
        if (entry.sourceDateBasis.sourceDate > asOfDate) {
            sourceDateBasisStatus = 'FAIL';
            messages.push(`FAIL: [${entry.symbol}] sourceDate ${entry.sourceDateBasis.sourceDate} > asOfDate ${asOfDate}`);
        }
    }

    // Forbidden fields check (scoreSnapshot must not have forbidden keys)
    const FORBIDDEN_KEYS = new Set(['alphaScore', 'recommendationBucket', 'roi', 'win_rate', 'alpha', 'edge', 'profit']);
    let forbiddenFieldStatus: ValidationStatusValue = 'PASS';
    for (const entry of batch.entries) {
        for (const k of Object.keys(entry.scoreSnapshot)) {
            if (FORBIDDEN_KEYS.has(k)) {
                forbiddenFieldStatus = 'FAIL';
                messages.push(`FAIL: [${entry.symbol}] scoreSnapshot has forbidden field: ${k}`);
            }
        }
        // Check top-level field names
        for (const k of Object.keys(entry)) {
            if (FORBIDDEN_KEYS.has(k)) {
                forbiddenFieldStatus = 'FAIL';
                messages.push(`FAIL: [${entry.symbol}] entry has forbidden field: ${k}`);
            }
        }
    }

    // targetHorizons must all be PENDING
    let targetHorizonsStatus: ValidationStatusValue = 'PASS';
    for (const entry of batch.entries) {
        for (const h of entry.targetHorizons) {
            if (h.outcomeStatus !== 'PENDING') {
                targetHorizonsStatus = 'FAIL';
                messages.push(`FAIL: [${entry.symbol}] horizon ${h.horizonLabel} outcomeStatus must be PENDING`);
            }
            if (h.outcomeWriteBackAllowed !== false) {
                targetHorizonsStatus = 'FAIL';
                messages.push(`FAIL: [${entry.symbol}] horizon ${h.horizonLabel} outcomeWriteBackAllowed must be false`);
            }
        }
    }

    const allStatuses = [batchStatus, duplicateKeyStatus, sourceDateBasisStatus, forbiddenFieldStatus, targetHorizonsStatus];
    const overallStatus: ValidationStatusValue =
        allStatuses.some(s => s === 'FAIL') ? 'FAIL' :
            allStatuses.some(s => s === 'WARN') ? 'WARN' : 'PASS';

    return {
        status: overallStatus,
        batchStatus,
        duplicateKeyStatus,
        sourceDateBasisStatus,
        forbiddenFieldStatus,
        targetHorizonsStatus,
        messages,
    };
}

/**
 * buildShadowPredictionJsonlPreview
 *
 * Converts entries to JSONL string.
 * Each line is a complete, parseable JSON object.
 * Deterministic ordering (sorted by symbol).
 */
export function buildShadowPredictionJsonlPreview(
    entries: ShadowPredictionLogEntry[],
): string {
    const sorted = [...entries].sort((a, b) => a.symbol.localeCompare(b.symbol));
    return sorted.map(e => JSON.stringify(e)).join('\n');
}

/**
 * summarizeShadowPredictionDryRun
 *
 * Builds a summary record for the dry-run.
 * Must contain: asOfDate, runId, candidateCount, writtenLineCount,
 *   duplicateCount, failedValidationCount, warningCount, dryRunOnly, readinessStatus
 * Must NOT contain any performance fields.
 */
export function summarizeShadowPredictionDryRun(
    config: ShadowPredictionDryRunConfig,
    batch: ShadowPredictionLogBatch,
    validationResult: ShadowPredictionDryRunValidationResult,
): ShadowPredictionDryRunSummary {
    const duplicateCount = batch.entries.length - new Set(batch.entries.map(e => e.duplicateKey)).size;
    const failedValidationCount = validationResult.messages.filter(m => m.startsWith('FAIL')).length;
    const warningCount = validationResult.messages.filter(m => m.startsWith('WARN')).length;

    const readinessStatus: ShadowPredictionDryRunSummary['readinessStatus'] =
        validationResult.status === 'PASS' && batch.entryCount > 0 ? 'READY' :
            validationResult.status === 'WARN' ? 'WARN' : 'NOT_READY';

    return {
        asOfDate: config.asOfDate,
        runId: config.runId,
        candidateCount: batch.entries.length,
        writtenLineCount: batch.entries.length,
        duplicateCount,
        failedValidationCount,
        warningCount,
        dryRunOnly: true,
        readinessStatus,
    };
}

// ─── Internal helpers ─────────────────────────────────────────────

function buildDryRunMarkdown(result: ShadowPredictionDryRunResult): string {
    const { config, batch, validationResult, summary } = result;
    return [
        `# P0-COMBINED Shadow Prediction Daily Dry-run Result`,
        ``,
        `> **research mode only — dry-run only — no production Prediction row write**`,
        `> no StrategySignal write — no DB write — no external API — no LLM — no auto trading`,
        `> no precision prediction claim — no performance claim — no edge claim`,
        ``,
        `## Config`,
        `| Field | Value |`,
        `|---|---|`,
        `| asOfDate | ${config.asOfDate} |`,
        `| runId | ${config.runId} |`,
        `| universeTier | ${config.universeTier} |`,
        `| maxCandidates | ${config.maxCandidates} |`,
        `| dryRun | ${config.dryRun} |`,
        `| writeMode | ${config.writeMode} |`,
        ``,
        `## Summary`,
        `| Field | Value |`,
        `|---|---|`,
        `| candidateCount | ${summary.candidateCount} |`,
        `| writtenLineCount | ${summary.writtenLineCount} |`,
        `| duplicateCount | ${summary.duplicateCount} |`,
        `| failedValidationCount | ${summary.failedValidationCount} |`,
        `| warningCount | ${summary.warningCount} |`,
        `| readinessStatus | ${summary.readinessStatus} |`,
        ``,
        `## Validation`,
        `| Check | Status |`,
        `|---|---|`,
        `| Overall | ${validationResult.status} |`,
        `| Batch | ${validationResult.batchStatus} |`,
        `| DuplicateKey | ${validationResult.duplicateKeyStatus} |`,
        `| SourceDateBasis | ${validationResult.sourceDateBasisStatus} |`,
        `| ForbiddenFields | ${validationResult.forbiddenFieldStatus} |`,
        `| TargetHorizons | ${validationResult.targetHorizonsStatus} |`,
        ``,
        `## Entries`,
        ...batch.entries.map(e =>
            `- **${e.symbol}** (${e.stockName}) | researchBucket: ${e.researchBucket} | researchScore: ${e.scoreSnapshot.researchScore} | asOfDate: ${e.asOfDate}`
        ),
        ``,
        `## Guardrail`,
        `- writeMode: ${config.writeMode}`,
        `- dryRunOnly: true`,
        `- No DB write`,
        `- No production Prediction row`,
        `- No StrategySignal write`,
        `- targetHorizons all PENDING`,
        `- outcomeWriteBackAllowed: false for all entries`,
    ].join('\n');
}

function buildLedgerAccumulationMarkdown(result: ShadowPredictionDryRunResult): string {
    const acc = result.ledgerAccumulateResult!;
    return [
        `# P2 Shadow Ledger Accumulation Result`,
        ``,
        `> **append-only — no existing content modified — no production DB write**`,
        ``,
        `## Run Info`,
        `| Field | Value |`,
        `|---|---|`,
        `| runId | ${result.config.runId} |`,
        `| asOfDate | ${result.config.asOfDate} |`,
        `| dryRun | true |`,
        `| append | ${acc.append} |`,
        ``,
        `## Accumulation Result`,
        `| Field | Value |`,
        `|---|---|`,
        `| incomingCount | ${acc.incomingCount} |`,
        `| appendedCount | ${acc.appendedCount} |`,
        `| duplicateCount | ${acc.duplicateCount} |`,
        `| existingCount | ${acc.existingCount} |`,
        `| totalAfterAppend | ${acc.totalAfterAppend} |`,
        `| appendOnlyStatus | ${acc.appendOnlyStatus} |`,
        ``,
        `## Guardrail`,
        `- Append-only: existing entries cannot be overwritten`,
        `- Duplicate keys rejected`,
        `- Malformed JSONL causes FAIL`,
        `- productionWriteAllowed: false for all ledger entries`,
    ].join('\n');
}

function buildLedgerSummaryMarkdown(summary: LedgerSummary): string {
    return [
        `# P2 Shadow Prediction Ledger Summary`,
        ``,
        `> **research audit summary — no performance claim — not investment advice**`,
        ``,
        `## Totals`,
        `| Field | Value |`,
        `|---|---|`,
        `| totalEntries | ${summary.totalEntries} |`,
        `| uniqueRunCount | ${summary.uniqueRunCount} |`,
        `| uniqueAsOfDateCount | ${summary.uniqueAsOfDateCount} |`,
        `| symbolCount | ${summary.symbolCount} |`,
        `| pendingOutcomeCount | ${summary.pendingOutcomeCount} |`,
        `| readyOutcomeCount | ${summary.readyOutcomeCount} |`,
        `| malformedLineCount | ${summary.malformedLineCount} |`,
        ``,
        `## By Research Bucket`,
        ...Object.entries(summary.byResearchBucket).map(([k, v]) => `- ${k}: ${v}`),
        ``,
        `## By Validation Status`,
        ...Object.entries(summary.byValidationStatus).map(([k, v]) => `- ${k}: ${v}`),
        ``,
        `## By Guardrail Status`,
        ...Object.entries(summary.byGuardrailStatus).map(([k, v]) => `- ${k}: ${v}`),
    ].join('\n');
}
