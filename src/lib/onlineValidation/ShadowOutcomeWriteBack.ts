/**
 * ShadowOutcomeWriteBack. P1 Outcome Write-back v0ts 
 *
 * Artifact-only outcome write-back for shadow prediction log entries.
 * Produces 5D / 20D outcome review artifacts. Does NOT write production DB.
 *
 * SAFETY CONTRACT ( do not weaken):strict 
 * - research mode  artifact-onlyonly 
 * - no production DB write
 * - no production Prediction row write
 * - no StrategySignal write
 * - no external API call
 * - no LLM call
 * - PIT-safe: resolveOutcomePriceAsOf enforces asOfDate gate
 * - writeBackAllowed and productionWriteAllowed always false
 * - writeMode locked to OUTCOME_ARTIFACT_ONLY
 * - no performance  no edge  no guaranteed return claimclaim claim 
 *
 * Not investment advice. Not a trading system.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ShadowPredictionLogEntry } from './ShadowPredictionLogContract';
import { addTwseTradingDays, CALENDAR_VERSION } from './TwseTradingCalendar';

// ─── Types ────────────────────────────────────────────────────────

export type OutcomeStatus =
    | 'PENDING'
    | 'READY_FOR_REVIEW'
    | 'MISSING_PRICE'
    | 'BLOCKED';

export type PitSafeStatus =
    | 'PIT_SAFE'
    | 'PIT_VIOLATION'
    | 'PENDING_REVIEW';

export interface PriceProvider {
    getClosePrice(
        symbol: string,
        date: string,
    ): Promise<{ symbol: string; date: string; closePrice: number; source: string } | null>;
}

export interface OutcomeWriteBackTarget {
    runId: string;
    asOfDate: string;
    symbol: string;
    universeTier: string;
    horizonLabel: string;
    horizonDays: number;
    targetTradingDate: string;
    outcomeStatus: OutcomeStatus;
    pitSafeStatus: PitSafeStatus;
    validationMessages: string[];
}

export interface OutcomeWriteBackRecord {
    originalRunId: string;
    originalAsOfDate: string;
    symbol: string;
    universeTier: string;
    horizonLabel: string;
    horizonDays: number;
    targetTradingDate: string;
    reviewDate: string;
    outcomeStatus: OutcomeStatus;
    baseResearchScore: number | null;
    baseResearchBucket: string | null;
    baseConfidenceScore: number | null;
    closePriceAtPrediction: number | null;
    closePriceAtOutcome: number | null;
    returnPct: number | null;
    priceSource: string | null;
    pitSafeStatus: PitSafeStatus;
    writeBackAllowed: false;
    productionWriteAllowed: false;
    validationMessages: string[];
}

export interface OutcomeWriteBackBatchOptions {
    asOfReviewDate: string;
    horizons: number[];
    priceProvider: PriceProvider;
    runId: string;
    dryRun: true;
    writeMode: 'OUTCOME_ARTIFACT_ONLY';
}

export interface OutcomeWriteBackBatch {
    batchVersion: string;
    runId: string;
    asOfReviewDate: string;
    dryRun: true;
    writeMode: 'OUTCOME_ARTIFACT_ONLY';
    entryCount: number;
    outcomeCount: number;
    outcomes: OutcomeWriteBackRecord[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface OutcomeWriteBackValidationResult {
    status: 'PASS' | 'WARN' | 'FAIL';
    messages: string[];
}

// ─── Forbidden claims guard ────────────────────────────────────────

const FORBIDDEN_CLAIMS = [
    'profit', 'guaranteed', 'edge confirmed', 'production approved',
    'auto trading', 'buy', 'sell', 'roi', 'alpha', 'win_rate',
    'outperform', 'expected_return', 'predicted_return',
];

function assertNoForbiddenClaims(text: string): void {
    const lower = text.toLowerCase();
    for (const claim of FORBIDDEN_CLAIMS) {
        if (lower.includes(claim)) {
            throw new Error(`Forbidden claim detected: "${claim}" in "${text}"`);
        }
    }
}

 planOutcomeWriteBackTargets // 

/**
 * planOutcomeWriteBackTargets
 *
 * Plans outcome write-back targets from shadow prediction log entries.
 * Trading days: 5D = 5 TWSE trading days after asOfDate (asOfDate NOT counted as day 1).
 * Only entries with validationStatus=PASS and guardrailStatus=PASS are processed.
 * Only entries where sourceDate <= asOfDate are processed (PIT-safe).
 */
export function planOutcomeWriteBackTargets(
    entries: ShadowPredictionLogEntry[],
    horizonDays: number,
): OutcomeWriteBackTarget[] {
    if (horizonDays <= 0) {
        throw new Error(`planOutcomeWriteBackTargets: horizonDays must be > 0, got ${horizonDays}`);
    }
    const horizonLabel = horizonDays === 5 ? '5D' : horizonDays === 20 ? '20D' : `${horizonDays}D`;
    const targets: OutcomeWriteBackTarget[] = [];

    for (const entry of entries) {
        const messages: string[] = [];

        // Guard: validationStatus must be PASS
        if (entry.validationStatus !== 'PASS') {
            targets.push({
                runId: entry.runId,
                asOfDate: entry.asOfDate,
                symbol: entry.symbol,
                universeTier: entry.universeTier,
                horizonLabel,
                horizonDays,
                targetTradingDate: '',
                outcomeStatus: 'BLOCKED',
                pitSafeStatus: 'PIT_VIOLATION',
                validationMessages: [`BLOCKED: validationStatus=${entry.validationStatus}`],
            });
            continue;
        }

        // Guard: guardrailStatus must be PASS
        if (entry.guardrailStatus !== 'PASS') {
            targets.push({
                runId: entry.runId,
                asOfDate: entry.asOfDate,
                symbol: entry.symbol,
                universeTier: entry.universeTier,
                horizonLabel,
                horizonDays,
                targetTradingDate: '',
                outcomeStatus: 'BLOCKED',
                pitSafeStatus: 'PIT_VIOLATION',
                validationMessages: [`BLOCKED: guardrailStatus=${entry.guardrailStatus}`],
            });
            continue;
        }

        // Guard: sourceDate must not be > asOfDate
        const sourceDate = entry.sourceDateBasis?.sourceDate;
        if (sourceDate && sourceDate > entry.asOfDate) {
            targets.push({
                runId: entry.runId,
                asOfDate: entry.asOfDate,
                symbol: entry.symbol,
                universeTier: entry.universeTier,
                horizonLabel,
                horizonDays,
                targetTradingDate: '',
                outcomeStatus: 'BLOCKED',
                pitSafeStatus: 'PIT_VIOLATION',
                validationMessages: [`BLOCKED: sourceDate ${sourceDate} > asOfDate ${entry.asOfDate}`],
            });
            continue;
        }

        const targetTradingDate = addTwseTradingDays(entry.asOfDate, horizonDays);

        if (targetTradingDate <= entry.asOfDate) {
            messages.push(`WARN: targetTradingDate ${targetTradingDate} <= asOfDate ${entry.asOfDate}`);
        }

        targets.push({
            runId: entry.runId,
            asOfDate: entry.asOfDate,
            symbol: entry.symbol,
            universeTier: entry.universeTier,
            horizonLabel,
            horizonDays,
            targetTradingDate,
            outcomeStatus: 'PENDING',
            pitSafeStatus: 'PIT_SAFE',
            validationMessages: messages,
        });
    }

    return targets;
}

 resolveOutcomePriceAsOf // 

export interface OutcomePriceSnapshot {
    symbol: string;
    date: string;
    closePrice: number;
    source: string;
    asOfGateDate: string;
}

export type ResolvedOutcomePrice =
    | { status: 'FOUND'; snapshot: OutcomePriceSnapshot }
    | { status: 'MISSING_PRICE'; symbol: string; date: string }
    | { status: 'FUTURE_DATE_BLOCKED'; symbol: string; date: string; asOfDate: string };

/**
 * resolveOutcomePriceAsOf
 *
 * Looks up the close price for a symbol on targetDate.
 returns FUTURE_DATE_BLOCKED.
 * Uses injected  never calls external API.priceProvider 
 */
export async function resolveOutcomePriceAsOf(
    symbol: string,
    targetDate: string,
    asOfDate: string,
    priceProvider: PriceProvider,
): Promise<ResolvedOutcomePrice> {
    // PIT gate: targetDate must not exceed asOfDate for review
    if (targetDate > asOfDate) {
        return { status: 'FUTURE_DATE_BLOCKED', symbol, date: targetDate, asOfDate };
    }

    const result = await priceProvider.getClosePrice(symbol, targetDate);
    if (!result) {
        return { status: 'MISSING_PRICE', symbol, date: targetDate };
    }

    return {
        status: 'FOUND',
        snapshot: {
            symbol: result.symbol,
            date: result.date,
            closePrice: result.closePrice,
            source: result.source,
            asOfGateDate: asOfDate,
        },
    };
}

 buildOutcomeWriteBackBatch // 

/**
 * buildOutcomeWriteBackBatch
 *
 * Builds a full outcome write-back batch from shadow prediction entries.
 * artifact- dryRun= writeMode=OUTCOME_ARTIFACT_ONLY.true only 
 * Uses injectable priceProvider (no production DB, no external API).
 */
export async function buildOutcomeWriteBackBatch(
    entries: ShadowPredictionLogEntry[],
    options: OutcomeWriteBackBatchOptions,
): Promise<OutcomeWriteBackBatch> {
    const { asOfReviewDate, horizons, priceProvider, runId } = options;
    const outcomes: OutcomeWriteBackRecord[] = [];
    const batchMessages: string[] = [];

    for (const entry of entries) {
        for (const h of horizons) {
            const targets = planOutcomeWriteBackTargets([entry], h);
            const target = targets[0];

            if (!target || target.outcomeStatus === 'BLOCKED' || !target.targetTradingDate) {
                outcomes.push({
                    originalRunId: entry.runId,
                    originalAsOfDate: entry.asOfDate,
                    symbol: entry.symbol,
                    universeTier: entry.universeTier,
                    horizonLabel: target?.horizonLabel ?? `${h}D`,
                    horizonDays: h,
                    targetTradingDate: target?.targetTradingDate ?? '',
                    reviewDate: asOfReviewDate,
                    outcomeStatus: 'BLOCKED',
                    baseResearchScore: entry.scoreSnapshot?.researchScore ?? null,
                    baseResearchBucket: entry.researchBucket ?? null,
                    baseConfidenceScore: entry.confidenceSnapshot ?? null,
                    closePriceAtPrediction: null,
                    closePriceAtOutcome: null,
                    returnPct: null,
                    priceSource: null,
                    pitSafeStatus: 'PIT_VIOLATION',
                    writeBackAllowed: false,
                    productionWriteAllowed: false,
                    validationMessages: target?.validationMessages ?? ['BLOCKED: entry rejected'],
                });
                continue;
            }

            // Determine outcomeStatus based on reviewDate vs targetTradingDate
            let outcomeStatus: OutcomeStatus = 'PENDING';
            let closePriceAtOutcome: number | null = null;
            let priceSource: string | null = null;
            let pitSafeStatus: PitSafeStatus = 'PIT_SAFE';
            const recordMessages: string[] = [...target.validationMessages];

            if (asOfReviewDate >= target.targetTradingDate) {
                // Target date has  attempt price lookuppassed 
                const priceResult = await resolveOutcomePriceAsOf(
                    entry.symbol,
                    target.targetTradingDate,
                    asOfReviewDate,
                    priceProvider,
                );

                if (priceResult.status === 'FOUND') {
                    outcomeStatus = 'READY_FOR_REVIEW';
                    closePriceAtOutcome = priceResult.snapshot.closePrice;
                    priceSource = priceResult.snapshot.source;
                } else if (priceResult.status === 'MISSING_PRICE') {
                    outcomeStatus = 'MISSING_PRICE';
                    recordMessages.push(`WARN: price not found for ${entry.symbol} on ${target.targetTradingDate}`);
                } else if (priceResult.status === 'FUTURE_DATE_BLOCKED') {
                    outcomeStatus = 'BLOCKED';
                    pitSafeStatus = 'PIT_VIOLATION';
                    recordMessages.push(`BLOCKED: price date ${target.targetTradingDate} > reviewDate ${asOfReviewDate}`);
                }
            } else {
                // Target date is in the future relative to reviewDate
                outcomeStatus = 'PENDING';
                pitSafeStatus = 'PENDING_REVIEW';
                recordMessages.push(`PENDING: targetTradingDate ${target.targetTradingDate} > reviewDate ${asOfReviewDate}`);
            }

            outcomes.push({
                originalRunId: entry.runId,
                originalAsOfDate: entry.asOfDate,
                symbol: entry.symbol,
                universeTier: entry.universeTier,
                horizonLabel: target.horizonLabel,
                horizonDays: h,
                targetTradingDate: target.targetTradingDate,
                reviewDate: asOfReviewDate,
                outcomeStatus,
                baseResearchScore: entry.scoreSnapshot?.researchScore ?? null,
                baseResearchBucket: entry.researchBucket ?? null,
                baseConfidenceScore: entry.confidenceSnapshot ?? null,
                closePriceAtPrediction: null,
                closePriceAtOutcome,
                returnPct: null,
                priceSource,
                pitSafeStatus,
                writeBackAllowed: false,
                productionWriteAllowed: false,
                validationMessages: recordMessages,
            });
        }
    }

    const failCount = outcomes.filter(o => o.outcomeStatus === 'BLOCKED').length;
    const warnCount = outcomes.filter(o => o.outcomeStatus === 'MISSING_PRICE').length;

    return {
        batchVersion: 'p1-outcome-writeback-v0',
        runId,
        asOfReviewDate,
        dryRun: true,
        writeMode: 'OUTCOME_ARTIFACT_ONLY',
        entryCount: entries.length,
        outcomeCount: outcomes.length,
        outcomes,
        validationStatus: failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS',
        validationMessages: batchMessages,
    };
}

 validateOutcomeWriteBackBatch // 

/**
 * validateOutcomeWriteBackBatch
 *
 * Validates a write-back batch before any artifact write.
 * Returns PASS / WARN / FAIL with detailed messages.
 */
export function validateOutcomeWriteBackBatch(
    batch: OutcomeWriteBackBatch,
): OutcomeWriteBackValidationResult {
    const messages: string[] = [];

    // dryRun must be true
    if (batch.dryRun !== true) {
        messages.push('FAIL: dryRun must be true');
    }

    // writeMode must be OUTCOME_ARTIFACT_ONLY
    if (batch.writeMode !== 'OUTCOME_ARTIFACT_ONLY') {
        messages.push(`FAIL: writeMode must be OUTCOME_ARTIFACT_ONLY, got ${batch.writeMode}`);
    }

    for (const outcome of batch.outcomes) {
        // writeBackAllowed must be false
        if (outcome.writeBackAllowed !== false) {
            messages.push(`FAIL: writeBackAllowed must be false for ${outcome.symbol}/${outcome.horizonLabel}`);
        }

        // productionWriteAllowed must be false
        if (outcome.productionWriteAllowed !== false) {
            messages.push(`FAIL: productionWriteAllowed must be false for ${outcome.symbol}/${outcome.horizonLabel}`);
        }

        // targetTradingDate must be > originalAsOfDate (if set)
        if (
            outcome.targetTradingDate &&
            outcome.targetTradingDate <= outcome.originalAsOfDate
        ) {
            messages.push(
                `FAIL: targetTradingDate ${outcome.targetTradingDate} must be > originalAsOfDate ${outcome.originalAsOfDate} for ${outcome.symbol}/${outcome.horizonLabel}`,
            );
        }

        // If reviewDate < targetTradingDate, status must be PENDING
        if (
            outcome.reviewDate < outcome.targetTradingDate &&
            outcome.outcomeStatus !== 'PENDING' &&
            outcome.outcomeStatus !== 'BLOCKED'
        ) {
            messages.push(
                `FAIL: reviewDate ${outcome.reviewDate} < targetTradingDate ${outcome.targetTradingDate} but status is ${outcome.outcomeStatus} for ${outcome.symbol}/${outcome.horizonLabel}`,
            );
        }

        // No forbidden claims in validation messages
        for (const msg of outcome.validationMessages) {
            try {
                assertNoForbiddenClaims(msg);
            } catch (e) {
                messages.push(`FAIL: ${(e as Error).message} in ${outcome.symbol}/${outcome.horizonLabel}`);
            }
        }
    }

    const failCount = messages.filter(m => m.startsWith('FAIL')).length;
    const warnCount = messages.filter(m => m.startsWith('WARN')).length;

    return {
        status: failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS',
        messages,
    };
}

 buildOutcomeWriteBackArtifact // 

/**
 * buildOutcomeWriteBackArtifact
 *
 * Writes JSON, JSONL, and Markdown artifacts to outputs/online_validation/.
 * JSONL is append-only style (each line is a complete JSON object).
 * Does NOT write production DB. Does NOT overwrite existing production ledger.
 */
export function buildOutcomeWriteBackArtifact(batch: OutcomeWriteBackBatch): {
    jsonPath: string;
    jsonlPath: string;
    mdPath: string;
} {
    const outDir = path.join(process.cwd(), 'outputs', 'online_validation');
    fs.mkdirSync(outDir, { recursive: true });

    const jsonPath = path.join(outDir, 'p1_outcome_writeback_v0_result.json');
    const jsonlPath = path.join(outDir, 'p1_outcome_writeback_v0.jsonl');
    const mdPath = path.join(outDir, 'p1_outcome_writeback_v0_result.md');

    // JSON artifact
    fs.writeFileSync(jsonPath, JSON.stringify(batch, null, 2), 'utf8');

    //  one line per outcomeJSONL 
    const jsonlLines = batch.outcomes
        .map(o => JSON.stringify(o))
        .join('\n');
    fs.writeFileSync(jsonlPath, jsonlLines + '\n', 'utf8');

    // Markdown summary
    const statusEmoji: Record<string, string> = {
        PASS: '✅',
        WARN: '⚠️',
        FAIL: '❌',
    };
    const mdLines = [
        `# P1 Outcome Write-back v0 Result`,
        ``,
        `- **Batch Version**: ${batch.batchVersion}`,
        `- **Run ID**: ${batch.runId}`,
        `- **asOfReviewDate**: ${batch.asOfReviewDate}`,
        `- **dryRun**: ${batch.dryRun}`,
        `- **writeMode**: ${batch.writeMode}`,
        `- **entryCount**: ${batch.entryCount}`,
        `- **outcomeCount**: ${batch.outcomeCount}`,
        `- **validationStatus**: ${statusEmoji[batch.validationStatus] ?? ''} ${batch.validationStatus}`,
        ``,
        `## Outcomes`,
        ``,
        `| Symbol | Horizon | Target Date | Status | pitSafe |`,
        `|--------|---------|-------------|--------|---------|`,
        ...batch.outcomes.map(o =>
            `| ${o.symbol} | ${o.horizonLabel} | ${o.targetTradingDate} | ${o.outcomeStatus} | ${o.pitSafeStatus} |`,
        ),
        ``,
        `## Guardrail`,
        ``,
        `- writeBackAllowed: **false** (all records)`,
        `- productionWriteAllowed: **false** (all records)`,
        `- No production DB write`,
        `- No external API call`,
        `- No performance claim`,
        ``,
        `_Not investment advice. Not a trading system._`,
    ];
    fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

    return { jsonPath, jsonlPath, mdPath };
}
