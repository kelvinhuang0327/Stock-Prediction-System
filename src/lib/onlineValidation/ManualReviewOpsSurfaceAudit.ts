/**
 * ManualReviewOpsSurfaceAudit.ts — P17 Online Validation
 *
 * Safety audit for the manual review surface contract. Verifies that the
 * surface remains review-only and does not imply approval or writes.
 */

import type { ManualReviewSurfaceContract } from './ManualReviewSurfaceContract';

export const MANUAL_REVIEW_OPS_SURFACE_AUDIT_VERSION = 'manual-review-ops-surface-audit-v0';

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

export interface ManualReviewOpsSurfaceAudit {
    auditVersion: string;
    auditRunId: string;
    generatedAt: string;
    checkedSections: string[];
    actionAudit: {
        enabledActionCount: number;
        allEnabledActionsRequireHuman: true;
        allEnabledActionsWritePathEffectNone: true;
        allEnabledActionsProductionWriteFalse: true;
        allEnabledActionsCorpusWriteFalse: true;
        allEnabledActionsOptimizerFalse: true;
    };
    disabledActionAudit: {
        productionBackfillDisabled: true;
        corpusWriteDisabled: true;
        optimizerDisabled: true;
        tradingActionDisabled: true;
        autoPromoteDisabled: true;
    };
    guardrailAudit: {
        allGuardrailsLocked: true;
        allowedNextStepIsManualReviewOnly: true;
        manualReviewOnly: true;
        noProductionExecution: true;
        noCorpusWrite: true;
        noOptimizerTrigger: true;
    };
    forbiddenTokenAudit: {
        pass: boolean;
        checkedText: string;
    };
    auditStatus: 'PASS' | 'WARN' | 'FAIL';
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface BuildManualReviewOpsSurfaceAuditOptions {
    auditRunId: string;
    generatedAt: string;
}

export interface ManualReviewOpsSurfaceAuditValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export function buildManualReviewOpsSurfaceAudit(
    surfaceContract: ManualReviewSurfaceContract,
    options: BuildManualReviewOpsSurfaceAuditOptions,
): ManualReviewOpsSurfaceAudit {
    const enabledActions = surfaceContract.actionSections.flatMap(section => section.items);
    const disabledActions = surfaceContract.disabledActionSections.flatMap(section => section.items);

    const checkedText = JSON.stringify({
        pageTitle: surfaceContract.pageTitle,
        pageSubtitle: surfaceContract.pageSubtitle,
        statusSections: surfaceContract.statusSections,
        warningSections: surfaceContract.warningSections,
        guardrailSections: surfaceContract.guardrailSections,
        auditSections: surfaceContract.auditSections,
    });

    const actionAudit = {
        enabledActionCount: enabledActions.length,
        allEnabledActionsRequireHuman: enabledActions.every(action => action.requiresHuman === true),
        allEnabledActionsWritePathEffectNone: enabledActions.every(action => action.writePathEffect === 'NONE'),
        allEnabledActionsProductionWriteFalse: enabledActions.every(action => action.productionWriteAllowed === false),
        allEnabledActionsCorpusWriteFalse: enabledActions.every(action => action.corpusWriteAllowed === false),
        allEnabledActionsOptimizerFalse: enabledActions.every(action => action.optimizerAllowed === false),
    } as const;

    const disabledActionAudit = {
        productionBackfillDisabled: disabledActions.some(action => action.id === 'APPROVE_PRODUCTION_BACKFILL'),
        corpusWriteDisabled: disabledActions.some(action => action.id === 'APPROVE_CORPUS_WRITE'),
        optimizerDisabled: disabledActions.some(action => action.id === 'APPROVE_OPTIMIZER'),
        tradingActionDisabled: disabledActions.some(action => action.id === 'APPROVE_TRADING_ACTION'),
        autoPromoteDisabled: disabledActions.some(action => action.id === 'AUTO_PROMOTE'),
    } as const;

    const guardrailAudit = {
        allGuardrailsLocked:
            surfaceContract.guardrailSections.some(section =>
                section.items.some(item => item.id === 'guard_manual_required' && item.value === true),
            ) &&
            surfaceContract.guardrailSections.some(section =>
                section.items.some(item => item.id === 'guard_auto_promotion' && item.value === false),
            ) &&
            surfaceContract.guardrailSections.some(section =>
                section.items.some(item => item.id === 'guard_production_backfill' && item.value === false),
            ) &&
            surfaceContract.guardrailSections.some(section =>
                section.items.some(item => item.id === 'guard_corpus_write' && item.value === false),
            ) &&
            surfaceContract.guardrailSections.some(section =>
                section.items.some(item => item.id === 'guard_optimizer' && item.value === false),
            ) &&
            surfaceContract.guardrailSections.some(section =>
                section.items.some(item => item.id === 'guard_production_db' && item.value === false),
            ) &&
            surfaceContract.guardrailSections.some(section =>
                section.items.some(item => item.id === 'guard_prediction_row' && item.value === false),
            ) &&
            surfaceContract.guardrailSections.some(section =>
                section.items.some(item => item.id === 'guard_allowed_next_step' && item.value === 'MANUAL_REVIEW_ONLY'),
            ),
        allowedNextStepIsManualReviewOnly: surfaceContract.guardrailSections.some(section =>
            section.items.some(item => item.id === 'guard_allowed_next_step' && item.value === 'MANUAL_REVIEW_ONLY'),
        ),
        manualReviewOnly: surfaceContract.statusSections.some(section =>
            section.items.some(item => item.id === 'review_only' && item.value === true),
        ),
        noProductionExecution: surfaceContract.warningSections.some(section =>
            section.items.some(item => item.label === 'No Production Execution' && item.value === false),
        ),
        noCorpusWrite: surfaceContract.warningSections.some(section =>
            section.items.some(item => item.label === 'No Corpus Write' && item.value === false),
        ),
        noOptimizerTrigger: surfaceContract.warningSections.some(section =>
            section.items.some(item => item.label === 'No Optimizer Trigger' && item.value === false),
        ),
    } as const;

    const forbiddenTokenAudit = {
        pass: !hasForbiddenClaim(checkedText),
        checkedText,
    };

    const audit: ManualReviewOpsSurfaceAudit = {
        auditVersion: MANUAL_REVIEW_OPS_SURFACE_AUDIT_VERSION,
        auditRunId: options.auditRunId,
        generatedAt: options.generatedAt,
        checkedSections: [
            ...surfaceContract.statusSections.map(section => section.sectionId),
            ...surfaceContract.actionSections.map(section => section.sectionId),
            ...surfaceContract.warningSections.map(section => section.sectionId),
            ...surfaceContract.guardrailSections.map(section => section.sectionId),
            ...surfaceContract.disabledActionSections.map(section => section.sectionId),
            ...surfaceContract.auditSections.map(section => section.sectionId),
        ],
        actionAudit,
        disabledActionAudit,
        guardrailAudit,
        forbiddenTokenAudit,
        auditStatus: 'PASS',
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateManualReviewOpsSurfaceAudit(audit);
    audit.auditStatus = validation.validationStatus;
    audit.validationStatus = validation.validationStatus;
    audit.validationMessages = validation.validationMessages;
    return audit;
}

export function validateManualReviewOpsSurfaceAudit(
    audit: ManualReviewOpsSurfaceAudit,
): ManualReviewOpsSurfaceAuditValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    if (audit.auditStatus === 'FAIL') {
        messages.push('FAIL: auditStatus must not be FAIL');
        status = 'FAIL';
    }

    if (!audit.forbiddenTokenAudit.pass) {
        messages.push('FAIL: forbiddenTokenAudit must pass');
        status = 'FAIL';
    }
    if (hasForbiddenClaim(audit.forbiddenTokenAudit.checkedText)) {
        messages.push('FAIL: forbidden claim detected in checkedText');
        status = 'FAIL';
    }
    if (!audit.guardrailAudit.allGuardrailsLocked) {
        messages.push('FAIL: guardrailAudit must pass');
        status = 'FAIL';
    }
    if (!audit.guardrailAudit.allowedNextStepIsManualReviewOnly || !audit.guardrailAudit.manualReviewOnly || !audit.guardrailAudit.noProductionExecution || !audit.guardrailAudit.noCorpusWrite || !audit.guardrailAudit.noOptimizerTrigger) {
        messages.push('FAIL: guardrail audit must confirm review-only boundary');
        status = 'FAIL';
    }

    if (hasForbiddenClaim(JSON.stringify({
        actionAudit: audit.actionAudit,
        disabledActionAudit: audit.disabledActionAudit,
        guardrailAudit: audit.guardrailAudit,
    }))) {
        messages.push('FAIL: forbidden claim detected in manual review ops surface audit');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: manual review ops surface audit safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}
