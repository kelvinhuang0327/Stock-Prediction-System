/**
 * ManualReviewSurfaceContract.ts — P17 Online Validation
 *
 * Converts the P16 workflow binding into a UI / ops surface contract. This is
 * display-only and must not imply approval or any write path.
 */

import type { ManualReviewWorkflowBinding } from './ManualReviewWorkflowBinding';
import type { ManualReviewActionSchema } from './ManualReviewActionSchema';
import type { WorkflowStatusCard } from './ManualReviewWorkflowBinding';

export const MANUAL_REVIEW_SURFACE_CONTRACT_VERSION = 'manual-review-surface-contract-v0';

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
    /\bapproved\b/i,
    /\bPRODUCTION_READY\b/i,
    /\bCORPUS_WRITE_READY\b/i,
    /\bOPTIMIZER_READY\b/i,
];

function hasForbiddenClaim(text: string): boolean {
    return FORBIDDEN_PATTERNS.some(pattern => pattern.test(text));
}

export type ManualReviewSurfaceStatus =
    | 'READY_FOR_MANUAL_REVIEW_SURFACE'
    | 'DATA_LIMITED'
    | 'BLOCKED';

export interface SurfaceSectionItem {
    id: string;
    label: string;
    value: string | number | boolean;
    status?: 'OK' | 'WARN' | 'BLOCKED' | 'DATA_LIMITED';
    note?: string;
    enabled?: boolean;
    requiresHuman?: true;
    writePathEffect?: 'NONE';
    productionWriteAllowed?: false;
    corpusWriteAllowed?: false;
    optimizerAllowed?: false;
}

export interface SurfaceSection {
    sectionId: string;
    title: string;
    items: SurfaceSectionItem[];
}

export interface ManualReviewSurfaceContractInput {
    workflowBinding: ManualReviewWorkflowBinding;
    actionSchema: ManualReviewActionSchema;
    statusCards?: Record<string, WorkflowStatusCard>;
}

export interface BuildManualReviewSurfaceContractOptions {
    surfaceRunId: string;
    generatedAt: string;
    surfaceVersion?: string;
}

export interface ManualReviewSurfaceContract {
    surfaceContractVersion: string;
    surfaceRunId: string;
    generatedAt: string;
    sourceArtifacts: {
        workflowBindingVersion: string;
        workflowBindingRunId: string;
        actionSchemaVersion: string;
        actionSchemaRunId: string;
        statusCardsPresent: boolean;
    };
    surfaceStatus: ManualReviewSurfaceStatus;
    pageTitle: string;
    pageSubtitle: string;
    statusSections: SurfaceSection[];
    actionSections: SurfaceSection[];
    warningSections: SurfaceSection[];
    guardrailSections: SurfaceSection[];
    disabledActionSections: SurfaceSection[];
    auditSections: SurfaceSection[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface ManualReviewSurfaceContractValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

function buildItem(
    id: string,
    label: string,
    value: string | number | boolean,
    status?: SurfaceSectionItem['status'],
    note?: string,
    enabled?: boolean,
): SurfaceSectionItem {
    return {
        id,
        label,
        value,
        status,
        note,
        enabled,
        requiresHuman: enabled === undefined ? undefined : true,
        writePathEffect: enabled === undefined ? undefined : 'NONE',
        productionWriteAllowed: enabled === undefined ? undefined : false,
        corpusWriteAllowed: enabled === undefined ? undefined : false,
        optimizerAllowed: enabled === undefined ? undefined : false,
    };
}

export function buildStatusSections(
    input: ManualReviewSurfaceContractInput,
): SurfaceSection[] {
    const binding = input.workflowBinding;
    const statusCards = input.statusCards ?? binding.reviewStatusCards;
    return [
        {
            sectionId: 'status_overview',
            title: 'Manual Review Status',
            items: [
                buildItem('workflow_status', 'Workflow Status', binding.workflowStatus, binding.workflowStatus === 'READY_FOR_MANUAL_REVIEW' ? 'OK' : binding.workflowStatus === 'DATA_LIMITED' ? 'DATA_LIMITED' : 'BLOCKED'),
                buildItem('review_status', 'Review Status', statusCards.manualReviewPackageStatus.value as string, statusCards.manualReviewPackageStatus.status),
                buildItem('gate_status', 'Gate Status', statusCards.governanceGateStatus.value as string, statusCards.governanceGateStatus.status),
                buildItem('decision', 'Decision', statusCards.decision.value as string, statusCards.decision.status),
                buildItem('corpus_unchanged', 'Corpus Unchanged', statusCards.corpusUnchanged.value as boolean, statusCards.corpusUnchanged.status),
                buildItem('review_only', 'Review Only Indicator', true, 'OK', 'Manual review only, not approval complete.'),
            ],
        },
    ];
}

export function buildActionSections(
    input: ManualReviewSurfaceContractInput,
): SurfaceSection[] {
    return [
        {
            sectionId: 'actions_enabled',
            title: 'Enabled Review Actions',
            items: input.actionSchema.actions.map(action =>
                buildItem(
                    action.actionId,
                    action.label,
                    action.enabled,
                    'OK',
                    action.description,
                    true,
                ),
            ),
        },
    ];
}

export function buildDisabledActionSections(
    input: ManualReviewSurfaceContractInput,
): SurfaceSection[] {
    return [
        {
            sectionId: 'actions_disabled',
            title: 'Disabled Actions',
            items: input.actionSchema.disabledActions.map(action =>
                buildItem(
                    action.actionId,
                    action.label,
                    action.enabled,
                    'BLOCKED',
                    action.description,
                    false,
                ),
            ),
        },
    ];
}

export function buildWarningSections(
    input: ManualReviewSurfaceContractInput,
): SurfaceSection[] {
    const binding = input.workflowBinding;
    const warnings: SurfaceSectionItem[] = [
        buildItem('warn_not_approval', 'Manual Review Is Not Approval Complete', true, 'WARN', 'Manual review remains a review-only state.'),
        buildItem('warn_no_production', 'No Production Execution', false, 'WARN', 'Production execution is disabled.'),
        buildItem('warn_no_corpus_write', 'No Corpus Write', false, 'WARN', 'Corpus write is disabled.'),
        buildItem('warn_no_optimizer', 'No Optimizer Trigger', false, 'WARN', 'Optimizer trigger is disabled.'),
        buildItem('warn_preview_only', 'Projected Coverage Is Preview-Only', binding.reviewStatusCards.previewOnlyImpact.value as boolean, 'WARN', 'Coverage preview is not a performance claim.'),
    ];

    return [
        {
            sectionId: 'warnings',
            title: 'Warnings',
            items: warnings,
        },
    ];
}

function buildGuardrailSections(
    input: ManualReviewSurfaceContractInput,
): SurfaceSection[] {
    const b = input.workflowBinding.approvalBoundaryCards;
    const w = input.workflowBinding.writePathCards;
    return [
        {
            sectionId: 'guardrails',
            title: 'Guardrails',
            items: [
                buildItem('guard_manual_required', 'Manual Approval Required', b.manualApprovalRequired.value as boolean, 'OK'),
                buildItem('guard_auto_promotion', 'Automatic Promotion Allowed', b.automaticPromotionAllowed.value as boolean, 'OK'),
                buildItem('guard_production_backfill', 'Production Backfill Allowed', b.productionBackfillAllowed.value as boolean, 'OK'),
                buildItem('guard_corpus_write', 'Corpus Write Allowed', b.corpusWriteAllowed.value as boolean, 'OK'),
                buildItem('guard_optimizer', 'Optimizer Allowed', b.optimizerAllowed.value as boolean, 'OK'),
                buildItem('guard_allowed_next_step', 'Allowed Next Step', b.allowedNextStep.value as string, 'OK'),
                buildItem('guard_production_db', 'Production DB Write Allowed', w.productionDbWriteAllowed.value as boolean, 'OK'),
                buildItem('guard_prediction_row', 'Prediction Row Write Allowed', w.predictionRowWriteAllowed.value as boolean, 'OK'),
            ],
        },
    ];
}

function buildAuditSections(
    input: ManualReviewSurfaceContractInput,
): SurfaceSection[] {
    return [
        {
            sectionId: 'audit_source',
            title: 'Source Artifacts',
            items: [
                buildItem('audit_workflow_binding', 'Workflow Binding Version', input.workflowBinding.workflowBindingVersion, 'OK'),
                buildItem('audit_action_schema', 'Action Schema Version', input.actionSchema.schemaVersion, 'OK'),
                buildItem('audit_surface_only', 'Surface Only', true, 'OK', 'Display only. No approval complete.'),
            ],
        },
    ];
}

export function buildManualReviewSurfaceContract(
    input: ManualReviewSurfaceContractInput,
    options: BuildManualReviewSurfaceContractOptions,
): ManualReviewSurfaceContract {
    let surfaceStatus: ManualReviewSurfaceStatus;
    if (input.workflowBinding.workflowStatus === 'READY_FOR_MANUAL_REVIEW') {
        surfaceStatus = 'READY_FOR_MANUAL_REVIEW_SURFACE';
    } else if (input.workflowBinding.workflowStatus === 'DATA_LIMITED') {
        surfaceStatus = 'DATA_LIMITED';
    } else {
        surfaceStatus = 'BLOCKED';
    }

    const contract: ManualReviewSurfaceContract = {
        surfaceContractVersion: options.surfaceVersion ?? MANUAL_REVIEW_SURFACE_CONTRACT_VERSION,
        surfaceRunId: options.surfaceRunId,
        generatedAt: options.generatedAt,
        sourceArtifacts: {
            workflowBindingVersion: input.workflowBinding.workflowBindingVersion,
            workflowBindingRunId: input.workflowBinding.bindingRunId,
            actionSchemaVersion: input.actionSchema.schemaVersion,
            actionSchemaRunId: input.actionSchema.schemaRunId,
            statusCardsPresent: Boolean(input.statusCards),
        },
        surfaceStatus,
        pageTitle: 'Manual Review Surface',
        pageSubtitle: 'Review-only UI surface for artifact inspection and follow-up.',
        statusSections: buildStatusSections(input),
        actionSections: buildActionSections(input),
        warningSections: buildWarningSections(input),
        guardrailSections: buildGuardrailSections(input),
        disabledActionSections: buildDisabledActionSections(input),
        auditSections: buildAuditSections(input),
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateManualReviewSurfaceContract(contract);
    contract.validationStatus = validation.validationStatus;
    contract.validationMessages = validation.validationMessages;
    return contract;
}

export function validateManualReviewSurfaceContract(
    contract: ManualReviewSurfaceContract,
): ManualReviewSurfaceContractValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    if (contract.surfaceStatus === 'APPROVED' || contract.surfaceStatus === 'PRODUCTION_READY') {
        messages.push('FAIL: surfaceStatus must not be approved or production ready');
        status = 'FAIL';
    }

    const enabledActions = contract.actionSections.flatMap(section => section.items);
    for (const action of enabledActions) {
        if (action.enabled !== true) {
            messages.push(`FAIL: enabled action must remain enabled: ${action.id}`);
            status = 'FAIL';
        }
        if (action.writePathEffect !== 'NONE') {
            messages.push(`FAIL: enabled action writePathEffect must be NONE: ${action.id}`);
            status = 'FAIL';
        }
        if (action.productionWriteAllowed !== false || action.corpusWriteAllowed !== false || action.optimizerAllowed !== false) {
            messages.push(`FAIL: enabled action must not allow writes: ${action.id}`);
            status = 'FAIL';
        }
    }

    const disabledIds = new Set(contract.disabledActionSections.flatMap(section => section.items.map(item => item.id)));
    const requiredDisabled = [
        'APPROVE_PRODUCTION_BACKFILL',
        'APPROVE_CORPUS_WRITE',
        'APPROVE_OPTIMIZER',
        'APPROVE_TRADING_ACTION',
        'AUTO_PROMOTE',
    ];
    for (const id of requiredDisabled) {
        if (!disabledIds.has(id)) {
            messages.push(`FAIL: required disabled action missing: ${id}`);
            status = 'FAIL';
        }
    }

    const safeText = JSON.stringify({
        pageTitle: contract.pageTitle,
        pageSubtitle: contract.pageSubtitle,
        statusSections: contract.statusSections,
        warningSections: contract.warningSections,
        guardrailSections: contract.guardrailSections,
        auditSections: contract.auditSections,
    });
    if (hasForbiddenClaim(safeText)) {
        messages.push('FAIL: forbidden claim detected in manual review surface contract');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: manual review surface contract safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}
