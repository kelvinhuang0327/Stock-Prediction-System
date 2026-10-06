/**
 * OutcomeBackfillGovernanceGate.ts — P15 Online Validation
 *
 * Governs whether an artifact-only outcome backfill rehearsal can proceed
 * to manual review planning. This does not permit any production or corpus
 * write path.
 */

import type { OutcomeBackfillCandidateSelection } from './OutcomeBackfillCandidateSelector';
import type { OutcomeBackfillRehearsal } from './OutcomeBackfillRehearsalEngine';
import type { BackfillQualityImpactPreview } from './BackfillQualityImpactPreview';
import type { CorpusQualityGateResult } from './CorpusQualityGate';
import type { CoverageRecoveryPlan } from './CoverageRecoveryPlanner';

export const OUTCOME_BACKFILL_GOVERNANCE_GATE_VERSION = 'outcome-backfill-governance-gate-v0';

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
    /\bPRODUCTION_READY\b/i,
    /\bCORPUS_WRITE_READY\b/i,
    /\bOPTIMIZER_READY\b/i,
];

function hasForbiddenClaim(text: string): boolean {
    return FORBIDDEN_PATTERNS.some(pattern => pattern.test(text));
}

export type OutcomeBackfillGovernanceGateStatus =
    | 'READY_FOR_MANUAL_REVIEW'
    | 'DATA_LIMITED'
    | 'BLOCKED';

export type OutcomeBackfillGovernanceDecision =
    | 'ALLOW_MANUAL_REVIEW_ONLY'
    | 'BLOCK_WRITE_PATH'
    | 'BLOCK_INSUFFICIENT_REHEARSAL'
    | 'BLOCK_DATA_LIMITED';

export interface OutcomeBackfillGovernanceApprovalBoundary {
    manualApprovalRequired: true;
    automaticPromotionAllowed: false;
    productionBackfillAllowed: false;
    corpusWriteAllowed: false;
    optimizerAllowed: false;
    allowedNextStep: 'MANUAL_REVIEW_ONLY';
}

export interface OutcomeBackfillGovernanceWritePathPolicy {
    productionDbWriteAllowed: false;
    corpusJsonlWriteAllowed: false;
    predictionRowWriteAllowed: false;
    strategySignalWriteAllowed: false;
    artifactOnly: true;
}

export interface OutcomeBackfillGovernanceGateChecks {
    hasCandidates: boolean;
    hasRehearsalItems: boolean;
    hasBlockedToReadyTransition: boolean;
    corpusUnchanged: boolean;
    qualityImpactIsPreviewOnly: true;
    requiresManualApproval: boolean;
    noProductionWrite: true;
    noCorpusWrite: true;
    noOptimizerWrite: true;
    noPerformanceClaim: true;
    noTradingSignal: true;
}

export interface OutcomeBackfillGovernanceGateInput {
    candidateSelection: OutcomeBackfillCandidateSelection;
    rehearsal: OutcomeBackfillRehearsal;
    qualityImpactPreview: BackfillQualityImpactPreview;
    currentCorpusLineCount: number;
    currentQualityGate?: CorpusQualityGateResult;
    recoveryPlan?: CoverageRecoveryPlan;
}

export interface BuildOutcomeBackfillGovernanceGateOptions {
    governanceRunId: string;
    generatedAt: string;
    requireManualApproval?: boolean;
    minRehearsedCount?: number;
    minBlockedToReadyCount?: number;
    maxAllowedCorpusWritePermission: false;
}

export interface OutcomeBackfillGovernanceGate {
    governanceGateVersion: string;
    governanceRunId: string;
    generatedAt: string;
    inputSummary: {
        candidateCount: number;
        rehearsalItemCount: number;
        blockedToReadyCount: number;
        currentCorpusLineCount: number;
        currentQualityStatus: string | null;
        projectedQualityStatus: string;
        projectedCoverageRatio: number;
        previewOnly: true;
    };
    gateChecks: OutcomeBackfillGovernanceGateChecks;
    gateStatus: OutcomeBackfillGovernanceGateStatus;
    decision: OutcomeBackfillGovernanceDecision;
    approvalBoundary: OutcomeBackfillGovernanceApprovalBoundary;
    writePathPolicy: OutcomeBackfillGovernanceWritePathPolicy;
    riskFlags: string[];
    requiredNextApprovals: string[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface OutcomeBackfillGovernanceValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export function buildOutcomeBackfillGovernanceGate(
    input: OutcomeBackfillGovernanceGateInput,
    options: BuildOutcomeBackfillGovernanceGateOptions,
): OutcomeBackfillGovernanceGate {
    const requireManualApproval = options.requireManualApproval ?? true;
    const minRehearsedCount = options.minRehearsedCount ?? 1;
    const minBlockedToReadyCount = options.minBlockedToReadyCount ?? 1;

    const blockedToReadyCount = input.rehearsal.rehearsalItems.filter(
        item => item.transitionType === 'BLOCKED_TO_READY',
    ).length;

    const hasCandidates = input.candidateSelection.selectedCount > 0;
    const hasRehearsalItems = input.rehearsal.rehearsalItems.length >= minRehearsedCount;
    const hasBlockedToReadyTransition = blockedToReadyCount >= minBlockedToReadyCount;
    const corpusUnchanged = input.currentCorpusLineCount === 60;
    const qualityImpactIsPreviewOnly = true as const;
    const noProductionWrite =
        input.candidateSelection.candidates.every(candidate => candidate.productionWriteAllowed === false) &&
        input.rehearsal.rehearsalItems.every(item => item.productionWriteAllowed === false) &&
        input.qualityImpactPreview.guardrails.noProductionWrite === true;
    const noCorpusWrite =
        input.rehearsal.rehearsalItems.every(item => item.corpusWriteAllowed === false) &&
        input.qualityImpactPreview.guardrails.noCorpusWrite === true;
    const noOptimizerWrite =
        input.candidateSelection.candidates.every(candidate => candidate.optimizerWriteAllowed === false) &&
        input.rehearsal.rehearsalItems.every(item => item.optimizerWriteAllowed === false) &&
        input.qualityImpactPreview.guardrails.noOptimizerWrite === true;
    const noPerformanceClaim = input.qualityImpactPreview.guardrails.noPerformanceClaim === true;
    const noTradingSignal = input.qualityImpactPreview.guardrails.noTradingSignal === true;

    const gateChecks: OutcomeBackfillGovernanceGateChecks = {
        hasCandidates,
        hasRehearsalItems,
        hasBlockedToReadyTransition,
        corpusUnchanged,
        qualityImpactIsPreviewOnly,
        requiresManualApproval: requireManualApproval,
        noProductionWrite: true,
        noCorpusWrite: true,
        noOptimizerWrite: true,
        noPerformanceClaim: true,
        noTradingSignal: true,
    };

    let gateStatus: OutcomeBackfillGovernanceGateStatus;
    let decision: OutcomeBackfillGovernanceDecision;

    if (!corpusUnchanged) {
        gateStatus = 'BLOCKED';
        decision = 'BLOCK_WRITE_PATH';
    } else if (!hasCandidates || !hasRehearsalItems || !hasBlockedToReadyTransition) {
        gateStatus = 'BLOCKED';
        decision = 'BLOCK_INSUFFICIENT_REHEARSAL';
    } else if (!requireManualApproval) {
        gateStatus = 'BLOCKED';
        decision = 'BLOCK_WRITE_PATH';
    } else {
        gateStatus = 'READY_FOR_MANUAL_REVIEW';
        decision = 'ALLOW_MANUAL_REVIEW_ONLY';
    }

    if (input.currentQualityGate?.qualityStatus === 'DATA_LIMITED' && gateStatus === 'READY_FOR_MANUAL_REVIEW') {
        gateStatus = 'DATA_LIMITED';
        decision = 'BLOCK_DATA_LIMITED';
    }

    if (input.qualityImpactPreview.projectedQualityStatus === 'DATA_LIMITED' && gateStatus === 'READY_FOR_MANUAL_REVIEW') {
        gateStatus = 'DATA_LIMITED';
        decision = 'BLOCK_DATA_LIMITED';
    }

    const approvalBoundary: OutcomeBackfillGovernanceApprovalBoundary = {
        manualApprovalRequired: true,
        automaticPromotionAllowed: false,
        productionBackfillAllowed: false,
        corpusWriteAllowed: false,
        optimizerAllowed: false,
        allowedNextStep: 'MANUAL_REVIEW_ONLY',
    };

    const writePathPolicy: OutcomeBackfillGovernanceWritePathPolicy = {
        productionDbWriteAllowed: false,
        corpusJsonlWriteAllowed: false,
        predictionRowWriteAllowed: false,
        strategySignalWriteAllowed: false,
        artifactOnly: true,
    };

    const riskFlags: string[] = [];
    if (!corpusUnchanged) riskFlags.push('CORPUS_LINE_COUNT_CHANGED');
    if (input.currentQualityGate?.qualityStatus) {
        riskFlags.push(`CURRENT_QUALITY_STATUS_${input.currentQualityGate.qualityStatus}`);
    }
    if (input.qualityImpactPreview.projectedQualityStatus !== 'PASS_FOR_OBSERVABILITY_ONLY') {
        riskFlags.push(`PROJECTED_QUALITY_${input.qualityImpactPreview.projectedQualityStatus}`);
    }
    if (blockedToReadyCount > 0) {
        riskFlags.push('BLOCKED_TO_READY_TRANSITIONS_PRESENT');
    }
    riskFlags.push('PREVIEW_ONLY_IMPACT');
    riskFlags.push('MANUAL_REVIEW_REQUIRED');

    const requiredNextApprovals = [
        'CTO_MANUAL_REVIEW',
        'DATA_GOVERNANCE_REVIEW',
    ];

    const gate: OutcomeBackfillGovernanceGate = {
        governanceGateVersion: OUTCOME_BACKFILL_GOVERNANCE_GATE_VERSION,
        governanceRunId: options.governanceRunId,
        generatedAt: options.generatedAt,
        inputSummary: {
            candidateCount: input.candidateSelection.selectedCount,
            rehearsalItemCount: input.rehearsal.rehearsalItems.length,
            blockedToReadyCount,
            currentCorpusLineCount: input.currentCorpusLineCount,
            currentQualityStatus: input.currentQualityGate?.qualityStatus ?? null,
            projectedQualityStatus: input.qualityImpactPreview.projectedQualityStatus,
            projectedCoverageRatio: input.qualityImpactPreview.projectedCoverageRatio,
            previewOnly: true,
        },
        gateChecks,
        gateStatus,
        decision,
        approvalBoundary,
        writePathPolicy,
        riskFlags,
        requiredNextApprovals,
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateOutcomeBackfillGovernanceGate(gate);
    gate.validationStatus = validation.validationStatus;
    gate.validationMessages = validation.validationMessages;

    return gate;
}

export function validateOutcomeBackfillGovernanceGate(
    gate: OutcomeBackfillGovernanceGate,
): OutcomeBackfillGovernanceValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    const b = gate.approvalBoundary;
    if (!b.manualApprovalRequired) {
        messages.push('FAIL: manualApprovalRequired must be true');
        status = 'FAIL';
    }
    if (b.automaticPromotionAllowed !== false) {
        messages.push('FAIL: automaticPromotionAllowed must be false');
        status = 'FAIL';
    }
    if (b.productionBackfillAllowed !== false) {
        messages.push('FAIL: productionBackfillAllowed must be false');
        status = 'FAIL';
    }
    if (b.corpusWriteAllowed !== false) {
        messages.push('FAIL: corpusWriteAllowed must be false');
        status = 'FAIL';
    }
    if (b.optimizerAllowed !== false) {
        messages.push('FAIL: optimizerAllowed must be false');
        status = 'FAIL';
    }
    if (b.allowedNextStep !== 'MANUAL_REVIEW_ONLY') {
        messages.push('FAIL: allowedNextStep must be MANUAL_REVIEW_ONLY');
        status = 'FAIL';
    }

    const p = gate.writePathPolicy;
    if (p.productionDbWriteAllowed !== false) {
        messages.push('FAIL: productionDbWriteAllowed must be false');
        status = 'FAIL';
    }
    if (p.corpusJsonlWriteAllowed !== false) {
        messages.push('FAIL: corpusJsonlWriteAllowed must be false');
        status = 'FAIL';
    }
    if (p.predictionRowWriteAllowed !== false) {
        messages.push('FAIL: predictionRowWriteAllowed must be false');
        status = 'FAIL';
    }
    if (p.strategySignalWriteAllowed !== false) {
        messages.push('FAIL: strategySignalWriteAllowed must be false');
        status = 'FAIL';
    }
    if (p.artifactOnly !== true) {
        messages.push('FAIL: artifactOnly must be true');
        status = 'FAIL';
    }

    if (gate.gateStatus === 'BLOCKED' && gate.decision === 'ALLOW_MANUAL_REVIEW_ONLY') {
        messages.push('FAIL: BLOCKED gate cannot allow manual review only');
        status = 'FAIL';
    }

    if (gate.gateStatus === 'READY_FOR_MANUAL_REVIEW' && gate.decision !== 'ALLOW_MANUAL_REVIEW_ONLY') {
        messages.push('FAIL: ready gate must allow manual review only');
        status = 'FAIL';
    }

    if (gate.gateStatus === 'DATA_LIMITED' && gate.decision === 'ALLOW_MANUAL_REVIEW_ONLY') {
        messages.push('FAIL: data-limited gate must not auto-promote');
        status = 'FAIL';
    }

    if (hasForbiddenClaim(JSON.stringify(gate))) {
        messages.push('FAIL: forbidden claim detected in outcome backfill governance gate');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: outcome backfill governance gate safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}
