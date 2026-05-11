/**
 * ManualReviewActionSchema.ts — P16 Online Validation
 *
 * Defines manual-review-only actions for dashboard / ops. No action may alter
 * any production, corpus, or optimizer write path.
 */

import type { ManualReviewWorkflowBinding } from './ManualReviewWorkflowBinding';

export const MANUAL_REVIEW_ACTION_SCHEMA_VERSION = 'manual-review-action-schema-v0';

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

export type ManualReviewActionId =
    | 'REVIEW_REHEARSAL_ARTIFACT'
    | 'REVIEW_WRITE_PATH_POLICY'
    | 'REVIEW_QUALITY_IMPACT_PREVIEW'
    | 'REQUEST_MORE_DATA'
    | 'ACKNOWLEDGE_DATA_LIMITED'
    | 'APPROVE_PRODUCTION_BACKFILL'
    | 'APPROVE_CORPUS_WRITE'
    | 'APPROVE_OPTIMIZER'
    | 'APPROVE_TRADING_ACTION'
    | 'AUTO_PROMOTE';

export interface ManualReviewAction {
    actionId: ManualReviewActionId;
    label: string;
    description: string;
    enabled: boolean;
    category: 'REVIEW' | 'REQUEST' | 'ACKNOWLEDGE' | 'DISABLED';
    requiresHuman: true;
    writePathEffect: 'NONE';
    productionWriteAllowed: false;
    corpusWriteAllowed: false;
    optimizerAllowed: false;
}

export interface ManualReviewActionGroup {
    groupId: string;
    title: string;
    actionIds: ManualReviewActionId[];
}

export interface ManualReviewActionSchema {
    schemaVersion: string;
    schemaRunId: string;
    generatedAt: string;
    actions: ManualReviewAction[];
    disabledActions: ManualReviewAction[];
    actionGroups: ManualReviewActionGroup[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface BuildManualReviewActionSchemaOptions {
    schemaRunId: string;
    generatedAt: string;
}

export interface ManualReviewActionSchemaValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

function buildAction(
    actionId: ManualReviewActionId,
    label: string,
    description: string,
    enabled: boolean,
    category: ManualReviewAction['category'],
): ManualReviewAction {
    return {
        actionId,
        label,
        description,
        enabled,
        category,
        requiresHuman: true,
        writePathEffect: 'NONE',
        productionWriteAllowed: false,
        corpusWriteAllowed: false,
        optimizerAllowed: false,
    };
}

export function buildManualReviewActionSchema(
    workflowBinding: ManualReviewWorkflowBinding,
    options: BuildManualReviewActionSchemaOptions,
): ManualReviewActionSchema {
    const actions: ManualReviewAction[] = [
        buildAction(
            'REVIEW_REHEARSAL_ARTIFACT',
            'Review Rehearsal Artifact',
            'Inspect the artifact-only rehearsal package.',
            true,
            'REVIEW',
        ),
        buildAction(
            'REVIEW_WRITE_PATH_POLICY',
            'Review Write Path Policy',
            'Inspect the locked write-path contract.',
            true,
            'REVIEW',
        ),
        buildAction(
            'REVIEW_QUALITY_IMPACT_PREVIEW',
            'Review Quality Impact Preview',
            'Inspect the preview-only coverage impact.',
            true,
            'REVIEW',
        ),
        buildAction(
            'REQUEST_MORE_DATA',
            'Request More Data',
            'Ask for more data accumulation before proceeding.',
            true,
            'REQUEST',
        ),
        buildAction(
            'ACKNOWLEDGE_DATA_LIMITED',
            'Acknowledge Data Limited',
            'Acknowledge that the workflow is data limited.',
            true,
            'ACKNOWLEDGE',
        ),
    ];

    const disabledActions: ManualReviewAction[] = [
        buildAction('APPROVE_PRODUCTION_BACKFILL', 'Approve Production Backfill', 'Disabled in this phase.', false, 'DISABLED'),
        buildAction('APPROVE_CORPUS_WRITE', 'Approve Corpus Write', 'Disabled in this phase.', false, 'DISABLED'),
        buildAction('APPROVE_OPTIMIZER', 'Approve Optimizer', 'Disabled in this phase.', false, 'DISABLED'),
        buildAction('APPROVE_TRADING_ACTION', 'Approve Trading Action', 'Disabled in this phase.', false, 'DISABLED'),
        buildAction('AUTO_PROMOTE', 'Auto Promote', 'Disabled in this phase.', false, 'DISABLED'),
    ];

    const schema: ManualReviewActionSchema = {
        schemaVersion: MANUAL_REVIEW_ACTION_SCHEMA_VERSION,
        schemaRunId: options.schemaRunId,
        generatedAt: options.generatedAt,
        actions,
        disabledActions,
        actionGroups: [
            {
                groupId: 'group_manual_review',
                title: 'Manual Review Actions',
                actionIds: [
                    'REVIEW_REHEARSAL_ARTIFACT',
                    'REVIEW_WRITE_PATH_POLICY',
                    'REVIEW_QUALITY_IMPACT_PREVIEW',
                ],
            },
            {
                groupId: 'group_review_followup',
                title: 'Review Follow-Up',
                actionIds: ['REQUEST_MORE_DATA', 'ACKNOWLEDGE_DATA_LIMITED'],
            },
            {
                groupId: 'group_blocked_actions',
                title: 'Blocked Actions',
                actionIds: [
                    'APPROVE_PRODUCTION_BACKFILL',
                    'APPROVE_CORPUS_WRITE',
                    'APPROVE_OPTIMIZER',
                    'APPROVE_TRADING_ACTION',
                    'AUTO_PROMOTE',
                ],
            },
        ],
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateManualReviewActionSchema(schema);
    schema.validationStatus = validation.validationStatus;
    schema.validationMessages = validation.validationMessages;

    return schema;
}

export function validateManualReviewActionSchema(
    schema: ManualReviewActionSchema,
): ManualReviewActionSchemaValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    for (const action of schema.actions) {
        if (action.writePathEffect !== 'NONE') {
            messages.push(`FAIL: enabled action must have writePathEffect NONE: ${action.actionId}`);
            status = 'FAIL';
        }
        if (action.productionWriteAllowed !== false) {
            messages.push(`FAIL: productionWriteAllowed must be false: ${action.actionId}`);
            status = 'FAIL';
        }
        if (action.corpusWriteAllowed !== false) {
            messages.push(`FAIL: corpusWriteAllowed must be false: ${action.actionId}`);
            status = 'FAIL';
        }
        if (action.optimizerAllowed !== false) {
            messages.push(`FAIL: optimizerAllowed must be false: ${action.actionId}`);
            status = 'FAIL';
        }
        if (action.enabled !== true) {
            messages.push(`FAIL: enabled manual-review action must be true: ${action.actionId}`);
            status = 'FAIL';
        }
        if (action.requiresHuman !== true) {
            messages.push(`FAIL: requiresHuman must be true: ${action.actionId}`);
            status = 'FAIL';
        }
    }

    const requiredDisabled = [
        'APPROVE_PRODUCTION_BACKFILL',
        'APPROVE_CORPUS_WRITE',
        'APPROVE_OPTIMIZER',
        'APPROVE_TRADING_ACTION',
        'AUTO_PROMOTE',
    ];
    const disabledIds = new Set(schema.disabledActions.map(action => action.actionId));
    for (const id of requiredDisabled) {
        if (!disabledIds.has(id)) {
            messages.push(`FAIL: required disabled action missing: ${id}`);
            status = 'FAIL';
        }
    }

    for (const action of schema.disabledActions) {
        if (action.enabled !== false) {
            messages.push(`FAIL: disabled action must not be enabled: ${action.actionId}`);
            status = 'FAIL';
        }
        if (action.writePathEffect !== 'NONE') {
            messages.push(`FAIL: disabled action writePathEffect must be NONE: ${action.actionId}`);
            status = 'FAIL';
        }
        if (action.productionWriteAllowed !== false || action.corpusWriteAllowed !== false || action.optimizerAllowed !== false) {
            messages.push(`FAIL: disabled action must not enable writes: ${action.actionId}`);
            status = 'FAIL';
        }
    }

    if (hasForbiddenClaim(JSON.stringify(schema))) {
        messages.push('FAIL: forbidden claim detected in manual review action schema');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: manual review action schema safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}
