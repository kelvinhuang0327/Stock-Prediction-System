/**
 * ManualReviewWorkflowBinding.ts — P16 Online Validation
 *
 * Converts the P15 manual review package into a workflow binding artifact
 * that dashboard / ops layers can consume. This remains manual-review only.
 */

import type { OutcomeBackfillGovernanceGate } from './OutcomeBackfillGovernanceGate';
import type { BackfillWritePathContract } from './BackfillWritePathContract';
import type { BackfillManualReviewPackage } from './BackfillManualReviewPackage';
import type { BackfillQualityImpactPreview } from './BackfillQualityImpactPreview';
import type { CoverageRecoveryPlan } from './CoverageRecoveryPlanner';

export const MANUAL_REVIEW_WORKFLOW_BINDING_VERSION = 'manual-review-workflow-binding-v0';

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
    /\bproduction ready\b/i,
    /\bcorpus write ready\b/i,
    /\boptimizer ready\b/i,
    /\bPRODUCTION_READY\b/i,
    /\bCORPUS_WRITE_READY\b/i,
    /\bOPTIMIZER_READY\b/i,
];

function hasForbiddenClaim(text: string): boolean {
    return FORBIDDEN_PATTERNS.some(pattern => pattern.test(text));
}

export type ManualReviewWorkflowStatus =
    | 'READY_FOR_MANUAL_REVIEW'
    | 'DATA_LIMITED'
    | 'BLOCKED';

export interface WorkflowStatusCard {
    cardId: string;
    label: string;
    value: string | number | boolean;
    status: 'OK' | 'WARN' | 'BLOCKED' | 'DATA_LIMITED';
    note?: string;
}

export interface ApprovalBoundaryCards {
    manualApprovalRequired: WorkflowStatusCard;
    automaticPromotionAllowed: WorkflowStatusCard;
    productionBackfillAllowed: WorkflowStatusCard;
    corpusWriteAllowed: WorkflowStatusCard;
    optimizerAllowed: WorkflowStatusCard;
    allowedNextStep: WorkflowStatusCard;
}

export interface WritePathCards {
    productionDbWriteAllowed: WorkflowStatusCard;
    corpusJsonlWriteAllowed: WorkflowStatusCard;
    predictionRowWriteAllowed: WorkflowStatusCard;
    strategySignalWriteAllowed: WorkflowStatusCard;
    artifactOnly: WorkflowStatusCard;
}

export interface ManualReviewWorkflowBindingInput {
    governanceGate: OutcomeBackfillGovernanceGate;
    writePathContract: BackfillWritePathContract;
    manualReviewPackage: BackfillManualReviewPackage;
    qualityImpactPreview?: BackfillQualityImpactPreview;
    recoveryPlan?: CoverageRecoveryPlan;
}

export interface BuildManualReviewWorkflowBindingOptions {
    bindingRunId: string;
    generatedAt: string;
    workflowVersion?: string;
}

export interface ManualReviewWorkflowBinding {
    workflowBindingVersion: string;
    bindingRunId: string;
    generatedAt: string;
    sourceArtifacts: {
        governanceGateVersion: string;
        governanceRunId: string;
        writePathContractVersion: string;
        writePathContractRunId: string;
        manualReviewPackageVersion: string;
        manualReviewPackageRunId: string;
        qualityImpactPreviewVersion: string | null;
        recoveryPlanVersion: string | null;
    };
    workflowStatus: ManualReviewWorkflowStatus;
    allowedWorkflowActions: string[];
    blockedWorkflowActions: string[];
    reviewStatusCards: {
        governanceGateStatus: WorkflowStatusCard;
        manualReviewPackageStatus: WorkflowStatusCard;
        decision: WorkflowStatusCard;
        corpusUnchanged: WorkflowStatusCard;
        previewOnlyImpact: WorkflowStatusCard;
        manualApprovalRequired: WorkflowStatusCard;
    };
    approvalBoundaryCards: ApprovalBoundaryCards;
    writePathCards: WritePathCards;
    riskCards: WorkflowStatusCard[];
    requiredReviewerDecisions: BackfillManualReviewPackage['requiredReviewerDecisions'];
    forbiddenReviewerDecisions: BackfillManualReviewPackage['forbiddenDecisions'];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface ManualReviewWorkflowBindingValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

function buildStatusCard(
    cardId: string,
    label: string,
    value: string | number | boolean,
    status: WorkflowStatusCard['status'],
    note?: string,
): WorkflowStatusCard {
    return { cardId, label, value, status, note };
}

export function buildReviewStatusCards(
    input: ManualReviewWorkflowBindingInput,
): ManualReviewWorkflowBinding['reviewStatusCards'] {
    return {
        governanceGateStatus: buildStatusCard(
            'review_governance_gate_status',
            'Governance Gate Status',
            input.governanceGate.gateStatus,
            input.governanceGate.gateStatus === 'READY_FOR_MANUAL_REVIEW'
                ? 'OK'
                : input.governanceGate.gateStatus === 'DATA_LIMITED'
                ? 'DATA_LIMITED'
                : 'BLOCKED',
            'Manual review only; no production approval.',
        ),
        manualReviewPackageStatus: buildStatusCard(
            'review_manual_package_status',
            'Manual Review Package Status',
            input.manualReviewPackage.reviewStatus,
            input.manualReviewPackage.reviewStatus === 'READY_FOR_HUMAN_REVIEW'
                ? 'OK'
                : input.manualReviewPackage.reviewStatus === 'DATA_LIMITED'
                ? 'DATA_LIMITED'
                : 'BLOCKED',
            'Package is for human review only.',
        ),
        decision: buildStatusCard(
            'review_decision',
            'Decision',
            input.governanceGate.decision,
            input.governanceGate.decision === 'ALLOW_MANUAL_REVIEW_ONLY'
                ? 'OK'
                : input.governanceGate.decision === 'BLOCK_DATA_LIMITED'
                ? 'DATA_LIMITED'
                : 'BLOCKED',
            'Decision does not authorize writes.',
        ),
        corpusUnchanged: buildStatusCard(
            'review_corpus_unchanged',
            'Corpus Unchanged',
            input.governanceGate.gateChecks.corpusUnchanged,
            input.governanceGate.gateChecks.corpusUnchanged ? 'OK' : 'BLOCKED',
            'Corpus line count must remain 60.',
        ),
        previewOnlyImpact: buildStatusCard(
            'review_preview_only_impact',
            'Preview-Only Impact',
            input.governanceGate.inputSummary.previewOnly,
            input.governanceGate.inputSummary.previewOnly ? 'OK' : 'BLOCKED',
            'Projected coverage is preview-only, not a performance claim.',
        ),
        manualApprovalRequired: buildStatusCard(
            'review_manual_approval_required',
            'Manual Approval Required',
            input.governanceGate.approvalBoundary.manualApprovalRequired,
            input.governanceGate.approvalBoundary.manualApprovalRequired ? 'OK' : 'BLOCKED',
            'Manual approval remains required.',
        ),
    };
}

export function buildApprovalBoundaryCards(
    input: ManualReviewWorkflowBindingInput,
): ApprovalBoundaryCards {
    const b = input.governanceGate.approvalBoundary;
    return {
        manualApprovalRequired: buildStatusCard(
            'approval_manual_required',
            'Manual Approval Required',
            b.manualApprovalRequired,
            b.manualApprovalRequired ? 'OK' : 'BLOCKED',
        ),
        automaticPromotionAllowed: buildStatusCard(
            'approval_auto_promotion',
            'Automatic Promotion Allowed',
            b.automaticPromotionAllowed,
            b.automaticPromotionAllowed ? 'WARN' : 'OK',
        ),
        productionBackfillAllowed: buildStatusCard(
            'approval_production_backfill',
            'Production Backfill Allowed',
            b.productionBackfillAllowed,
            b.productionBackfillAllowed ? 'WARN' : 'OK',
        ),
        corpusWriteAllowed: buildStatusCard(
            'approval_corpus_write',
            'Corpus Write Allowed',
            b.corpusWriteAllowed,
            b.corpusWriteAllowed ? 'WARN' : 'OK',
        ),
        optimizerAllowed: buildStatusCard(
            'approval_optimizer_allowed',
            'Optimizer Allowed',
            b.optimizerAllowed,
            b.optimizerAllowed ? 'WARN' : 'OK',
        ),
        allowedNextStep: buildStatusCard(
            'approval_next_step',
            'Allowed Next Step',
            b.allowedNextStep,
            b.allowedNextStep === 'MANUAL_REVIEW_ONLY' ? 'OK' : 'BLOCKED',
        ),
    };
}

export function buildWritePathCards(
    input: ManualReviewWorkflowBindingInput,
): WritePathCards {
    const p = input.governanceGate.writePathPolicy;
    return {
        productionDbWriteAllowed: buildStatusCard(
            'writepath_production_db',
            'Production DB Write Allowed',
            p.productionDbWriteAllowed,
            p.productionDbWriteAllowed ? 'WARN' : 'OK',
        ),
        corpusJsonlWriteAllowed: buildStatusCard(
            'writepath_corpus_jsonl',
            'Corpus JSONL Write Allowed',
            p.corpusJsonlWriteAllowed,
            p.corpusJsonlWriteAllowed ? 'WARN' : 'OK',
        ),
        predictionRowWriteAllowed: buildStatusCard(
            'writepath_prediction_row',
            'Prediction Row Write Allowed',
            p.predictionRowWriteAllowed,
            p.predictionRowWriteAllowed ? 'WARN' : 'OK',
        ),
        strategySignalWriteAllowed: buildStatusCard(
            'writepath_strategy_signal',
            'Strategy Signal Write Allowed',
            p.strategySignalWriteAllowed,
            p.strategySignalWriteAllowed ? 'WARN' : 'OK',
        ),
        artifactOnly: buildStatusCard(
            'writepath_artifact_only',
            'Artifact Only',
            p.artifactOnly,
            p.artifactOnly ? 'OK' : 'BLOCKED',
        ),
    };
}

export function buildManualReviewWorkflowBinding(
    input: ManualReviewWorkflowBindingInput,
    options: BuildManualReviewWorkflowBindingOptions,
): ManualReviewWorkflowBinding {
    const allowedWorkflowActions = [
        'REVIEW_REHEARSAL_ARTIFACT',
        'REVIEW_WRITE_PATH_POLICY',
        'REVIEW_QUALITY_IMPACT_PREVIEW',
        'REQUEST_MORE_DATA',
        'ACKNOWLEDGE_DATA_LIMITED',
    ];
    const blockedWorkflowActions = [
        'PRODUCTION_DB_WRITE',
        'CORPUS_WRITE',
        'PREDICTION_ROW_WRITE',
        'STRATEGY_SIGNAL_WRITE',
        'OPTIMIZER_TRIGGER',
        'AUTO_PROMOTE',
        'TRADING_ACTION',
        'PRODUCTION_BACKFILL',
    ];

    let workflowStatus: ManualReviewWorkflowStatus;
    if (input.governanceGate.gateStatus === 'READY_FOR_MANUAL_REVIEW') {
        workflowStatus = 'READY_FOR_MANUAL_REVIEW';
    } else if (input.governanceGate.gateStatus === 'DATA_LIMITED') {
        workflowStatus = 'DATA_LIMITED';
    } else {
        workflowStatus = 'BLOCKED';
    }

    if (input.manualReviewPackage.reviewStatus === 'BLOCKED') {
        workflowStatus = 'BLOCKED';
    }

    if (input.manualReviewPackage.reviewStatus === 'DATA_LIMITED' && workflowStatus === 'READY_FOR_MANUAL_REVIEW') {
        workflowStatus = 'DATA_LIMITED';
    }

    const binding: ManualReviewWorkflowBinding = {
        workflowBindingVersion: options.workflowVersion ?? MANUAL_REVIEW_WORKFLOW_BINDING_VERSION,
        bindingRunId: options.bindingRunId,
        generatedAt: options.generatedAt,
        sourceArtifacts: {
            governanceGateVersion: input.governanceGate.governanceGateVersion,
            governanceRunId: input.governanceGate.governanceRunId,
            writePathContractVersion: input.writePathContract.contractVersion,
            writePathContractRunId: input.writePathContract.contractRunId,
            manualReviewPackageVersion: input.manualReviewPackage.packageVersion,
            manualReviewPackageRunId: input.manualReviewPackage.packageRunId,
            qualityImpactPreviewVersion: input.qualityImpactPreview?.previewVersion ?? null,
            recoveryPlanVersion: input.recoveryPlan?.recoveryPlanVersion ?? null,
        },
        workflowStatus,
        allowedWorkflowActions,
        blockedWorkflowActions,
        reviewStatusCards: buildReviewStatusCards(input),
        approvalBoundaryCards: buildApprovalBoundaryCards(input),
        writePathCards: buildWritePathCards(input),
        riskCards: [
            buildStatusCard(
                'risk_governance',
                'Governance Status',
                input.governanceGate.gateStatus,
                input.governanceGate.gateStatus === 'BLOCKED' ? 'BLOCKED' : 'WARN',
                'Manual review only.',
            ),
            buildStatusCard(
                'risk_preview_only',
                'Preview-Only Impact',
                input.governanceGate.inputSummary.previewOnly,
                'OK',
                'Impact is preview-only.',
            ),
            buildStatusCard(
                'risk_no_write',
                'No Write Path',
                false,
                'OK',
                'All write paths remain blocked.',
            ),
        ],
        requiredReviewerDecisions: input.manualReviewPackage.requiredReviewerDecisions,
        forbiddenReviewerDecisions: input.manualReviewPackage.forbiddenDecisions,
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateManualReviewWorkflowBinding(binding);
    binding.validationStatus = validation.validationStatus;
    binding.validationMessages = validation.validationMessages;

    return binding;
}

export function validateManualReviewWorkflowBinding(
    binding: ManualReviewWorkflowBinding,
): ManualReviewWorkflowBindingValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    if (binding.workflowStatus === 'PRODUCTION_READY' || binding.workflowStatus === 'APPROVED') {
        messages.push('FAIL: workflowStatus must not be production-ready or approved');
        status = 'FAIL';
    }

    const allowedText = binding.allowedWorkflowActions.join(' ');
    if (/(production|corpus|optimizer|trading)/i.test(allowedText)) {
        messages.push('FAIL: allowed workflow actions must remain manual-review only');
        status = 'FAIL';
    }

    const blockedText = binding.blockedWorkflowActions.join(' ');
    if (!/(production|corpus|optimizer|trading)/i.test(blockedText)) {
        messages.push('FAIL: blocked workflow actions must include production/corpus/optimizer/trading');
        status = 'FAIL';
    }

    const approvalCards = binding.approvalBoundaryCards;
    if (approvalCards.manualApprovalRequired.value !== true) {
        messages.push('FAIL: manualApprovalRequired must be true');
        status = 'FAIL';
    }
    if (approvalCards.automaticPromotionAllowed.value !== false) {
        messages.push('FAIL: automaticPromotionAllowed must be false');
        status = 'FAIL';
    }
    if (approvalCards.productionBackfillAllowed.value !== false) {
        messages.push('FAIL: productionBackfillAllowed must be false');
        status = 'FAIL';
    }
    if (approvalCards.corpusWriteAllowed.value !== false) {
        messages.push('FAIL: corpusWriteAllowed must be false');
        status = 'FAIL';
    }
    if (approvalCards.optimizerAllowed.value !== false) {
        messages.push('FAIL: optimizerAllowed must be false');
        status = 'FAIL';
    }
    if (approvalCards.allowedNextStep.value !== 'MANUAL_REVIEW_ONLY') {
        messages.push('FAIL: allowedNextStep must be MANUAL_REVIEW_ONLY');
        status = 'FAIL';
    }

    const writeCards = binding.writePathCards;
    if (writeCards.productionDbWriteAllowed.value !== false) {
        messages.push('FAIL: productionDbWriteAllowed must be false');
        status = 'FAIL';
    }
    if (writeCards.corpusJsonlWriteAllowed.value !== false) {
        messages.push('FAIL: corpusJsonlWriteAllowed must be false');
        status = 'FAIL';
    }
    if (writeCards.predictionRowWriteAllowed.value !== false) {
        messages.push('FAIL: predictionRowWriteAllowed must be false');
        status = 'FAIL';
    }
    if (writeCards.strategySignalWriteAllowed.value !== false) {
        messages.push('FAIL: strategySignalWriteAllowed must be false');
        status = 'FAIL';
    }
    if (writeCards.artifactOnly.value !== true) {
        messages.push('FAIL: artifactOnly must be true');
        status = 'FAIL';
    }

    const validationText = JSON.stringify({
        sourceArtifacts: binding.sourceArtifacts,
        workflowStatus: binding.workflowStatus,
        allowedWorkflowActions: binding.allowedWorkflowActions,
        blockedWorkflowActions: binding.blockedWorkflowActions,
        reviewStatusCards: binding.reviewStatusCards,
        approvalBoundaryCards: binding.approvalBoundaryCards,
        writePathCards: binding.writePathCards,
        riskCards: binding.riskCards,
    });

    if (hasForbiddenClaim(validationText)) {
        messages.push('FAIL: forbidden claim detected in manual review workflow binding');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: manual review workflow binding safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}
