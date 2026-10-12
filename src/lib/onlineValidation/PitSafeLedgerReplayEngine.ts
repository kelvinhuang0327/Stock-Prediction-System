/**
 * PitSafeLedgerReplayEngine.ts — P4 Online Validation
 *
 * Produces a replay run artifact from a replay-ready dataset.
 * Supports DATASET_ONLY and ELIGIBILITY_AUDIT modes.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No auto trading — no performance claims — no strategy conclusions
 * - dryRun: true LOCKED
 * - productionWriteAllowed: false LOCKED
 * - simulationWriteAllowed: false LOCKED
 */

import { ReplayDataset, ReplayRecord } from './LedgerReplayDatasetBuilder';

// ─── Version ──────────────────────────────────────────────────────

export const REPLAY_ENGINE_VERSION = 'pit-safe-replay-engine-v0';

// ─── Forbidden claim patterns ──────────────────────────────────────

const FORBIDDEN_PATTERNS = [
    /\bprofit\b/i, /\bguaranteed\b/i, /\bedge confirmed\b/i,
    /\bproduction approved\b/i, /\bauto trading\b/i,
    /\bbuy\b/i, /\bsell\b/i, /\boutperform\b/i, /\bexpected_return\b/i,
    /\bstrategy performance conclusion\b/i,
];

function hasForbiddenClaim(text: string): boolean {
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

// ─── Types ────────────────────────────────────────────────────────

export type ReplayMode = 'DATASET_ONLY' | 'ELIGIBILITY_AUDIT';

export interface ReplayRunOptions {
    replayRunId: string;
    reviewDate: string;
    mode: ReplayMode;
    dryRun: true;
}

export interface ReplayEligibilityAudit {
    auditVersion: string;
    eligibleRecords: ReplayRecord[];
    blockedRecords: ReplayRecord[];
    blockedReasons: Record<string, number>;
    missingOutcomeCount: number;
    notDueCount: number;
    pitViolationCount: number;
    eligibleCount: number;
    blockedCount: number;
    productionWriteAllowed: false;
    simulationWriteAllowed: false;
    validationMessages: string[];
}

export interface ReplayAuditSummary {
    inputRecordCount: number;
    replayEligibleCount: number;
    replayBlockedCount: number;
    byBlockedReason: Record<string, number>;
    missingOutcomeCount: number;
    notDueCount: number;
    pitViolationCount: number;
    byHorizon: Record<string, number>;
    byWindowStatus: Record<string, number>;
}

export interface ReplayRun {
    replayEngineVersion: string;
    replayRunId: string;
    reviewDate: string;
    mode: ReplayMode;
    dryRun: true;
    inputRecordCount: number;
    replayEligibleCount: number;
    replayBlockedCount: number;
    replayRecords: ReplayRecord[];
    auditSummary: ReplayAuditSummary;
    productionWriteAllowed: false;
    simulationWriteAllowed: false;
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface ValidateReplayRunResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
    forbiddenClaimFound: boolean;
}

// ─── Build Replay Run ─────────────────────────────────────────────

export function buildReplayRun(dataset: ReplayDataset, options: ReplayRunOptions): ReplayRun {
    const { replayRunId, reviewDate, mode, dryRun } = options;
    const messages: string[] = [];
    let validationStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    if (!['DATASET_ONLY', 'ELIGIBILITY_AUDIT'].includes(mode)) {
        validationStatus = 'FAIL';
        messages.push(`FAIL: Invalid mode=${mode}. Must be DATASET_ONLY or ELIGIBILITY_AUDIT`);
        return {
            replayEngineVersion: REPLAY_ENGINE_VERSION,
            replayRunId, reviewDate, mode, dryRun,
            inputRecordCount: 0,
            replayEligibleCount: 0,
            replayBlockedCount: 0,
            replayRecords: [],
            auditSummary: buildAuditSummary([]),
            productionWriteAllowed: false,
            simulationWriteAllowed: false,
            validationStatus, validationMessages: messages,
        };
    }

    if (!dryRun) {
        validationStatus = 'FAIL';
        messages.push('FAIL: dryRun must be true');
    }

    const replayRecords = dataset.records;
    const eligibleRecords = replayRecords.filter(r => r.replayEligible);
    const blockedRecords = replayRecords.filter(r => !r.replayEligible);

    if (dataset.validationStatus === 'FAIL') {
        validationStatus = 'FAIL';
        messages.push(...dataset.validationMessages);
    } else if (dataset.validationStatus === 'WARN') {
        validationStatus = validationStatus === 'FAIL' ? 'FAIL' : 'WARN';
        messages.push(...dataset.validationMessages);
    }

    const auditSummary = buildAuditSummary(replayRecords);

    if (validationStatus === 'PASS') {
        messages.push(`PASS: Replay run built in ${mode} mode. eligible=${eligibleRecords.length} blocked=${blockedRecords.length}`);
    }

    return {
        replayEngineVersion: REPLAY_ENGINE_VERSION,
        replayRunId,
        reviewDate,
        mode,
        dryRun,
        inputRecordCount: replayRecords.length,
        replayEligibleCount: eligibleRecords.length,
        replayBlockedCount: blockedRecords.length,
        replayRecords,
        auditSummary,
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        validationStatus,
        validationMessages: messages,
    };
}

// ─── Build Eligibility Audit ──────────────────────────────────────

export function buildReplayEligibilityAudit(dataset: ReplayDataset): ReplayEligibilityAudit {
    const eligibleRecords = dataset.records.filter(r => r.replayEligible);
    const blockedRecords = dataset.records.filter(r => !r.replayEligible);

    const blockedReasons: Record<string, number> = {};
    let missingOutcomeCount = 0;
    let notDueCount = 0;
    let pitViolationCount = 0;

    for (const r of blockedRecords) {
        const reason = r.replayBlockedReason;
        blockedReasons[reason] = (blockedReasons[reason] || 0) + 1;
        if (reason === 'OUTCOME_MISSING') missingOutcomeCount++;
        if (reason === 'WINDOW_NOT_DUE') notDueCount++;
        if (reason === 'PIT_VIOLATION') pitViolationCount++;
    }

    const messages: string[] = [
        `AUDIT: eligible=${eligibleRecords.length} blocked=${blockedRecords.length}`,
        `AUDIT: missingOutcome=${missingOutcomeCount} notDue=${notDueCount} pitViolation=${pitViolationCount}`,
    ];

    return {
        auditVersion: REPLAY_ENGINE_VERSION,
        eligibleRecords,
        blockedRecords,
        blockedReasons,
        missingOutcomeCount,
        notDueCount,
        pitViolationCount,
        eligibleCount: eligibleRecords.length,
        blockedCount: blockedRecords.length,
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        validationMessages: messages,
    };
}

// ─── Validate Replay Run ──────────────────────────────────────────

export function validateReplayRun(run: ReplayRun): ValidateReplayRunResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    let forbiddenClaimFound = false;

    // dryRun must be true
    if (run.dryRun !== true) {
        status = 'FAIL';
        messages.push('FAIL: dryRun must be true');
    }

    // productionWriteAllowed/simulationWriteAllowed
    if (run.productionWriteAllowed !== false) {
        status = 'FAIL';
        messages.push('FAIL: productionWriteAllowed must be false');
    }
    if (run.simulationWriteAllowed !== false) {
        status = 'FAIL';
        messages.push('FAIL: simulationWriteAllowed must be false');
    }

    // mode
    if (!['DATASET_ONLY', 'ELIGIBILITY_AUDIT'].includes(run.mode)) {
        status = 'FAIL';
        messages.push(`FAIL: Invalid mode=${run.mode}`);
    }

    // Check records
    for (const r of run.replayRecords) {
        if (r.productionWriteAllowed !== false) {
            status = 'FAIL';
            messages.push(`FAIL: productionWriteAllowed must be false for record ${r.replayKey}`);
        }
        if (r.simulationWriteAllowed !== false) {
            status = 'FAIL';
            messages.push(`FAIL: simulationWriteAllowed must be false for record ${r.replayKey}`);
        }
    }

    // Check forbidden claims
    const allText = [
        ...run.validationMessages,
        ...run.replayRecords.flatMap(r => r.validationMessages),
    ].join(' ');

    if (hasForbiddenClaim(allText)) {
        forbiddenClaimFound = true;
        status = 'FAIL';
        messages.push('FAIL: Forbidden claim found in replay run output');
    }

    if (status === 'PASS') messages.push('PASS: All replay run validation checks passed');

    return { validationStatus: status, validationMessages: messages, forbiddenClaimFound };
}

// ─── Internal: Build audit summary ────────────────────────────────

function buildAuditSummary(records: ReplayRecord[]): ReplayAuditSummary {
    const byBlockedReason: Record<string, number> = {};
    const byHorizon: Record<string, number> = {};
    const byWindowStatus: Record<string, number> = {};
    let missingOutcomeCount = 0, notDueCount = 0, pitViolationCount = 0;

    for (const r of records) {
        byHorizon[r.horizonLabel] = (byHorizon[r.horizonLabel] || 0) + 1;
        byWindowStatus[r.windowStatus] = (byWindowStatus[r.windowStatus] || 0) + 1;
        if (!r.replayEligible) {
            const reason = r.replayBlockedReason;
            byBlockedReason[reason] = (byBlockedReason[reason] || 0) + 1;
            if (reason === 'OUTCOME_MISSING') missingOutcomeCount++;
            if (reason === 'WINDOW_NOT_DUE') notDueCount++;
            if (reason === 'PIT_VIOLATION') pitViolationCount++;
        }
    }

    return {
        inputRecordCount: records.length,
        replayEligibleCount: records.filter(r => r.replayEligible).length,
        replayBlockedCount: records.filter(r => !r.replayEligible).length,
        byBlockedReason,
        missingOutcomeCount,
        notDueCount,
        pitViolationCount,
        byHorizon,
        byWindowStatus,
    };
}
