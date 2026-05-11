/**
 * BackfillQualityImpactPreview.ts — P14 Online Validation
 *
 * Projects the observability-only quality impact if rehearsal transitions were
 * eventually formalized. This is a preview only and does not modify corpus
 * state or imply strategy performance.
 */

import type { CorpusMetrics } from './CorpusMetricsStore';
import type { CorpusQualityGateResult } from './CorpusQualityGate';
import type { OutcomeBackfillRehearsalSummary } from './OutcomeBackfillRehearsalEngine';

export const BACKFILL_QUALITY_IMPACT_PREVIEW_VERSION = 'backfill-quality-impact-preview-v0';

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
];

function hasForbiddenClaim(text: string): boolean {
    return FORBIDDEN_PATTERNS.some(pattern => pattern.test(text));
}

export type BackfillImpactStatus =
    | 'IMPROVES_COVERAGE'
    | 'NO_MATERIAL_CHANGE'
    | 'STILL_DATA_LIMITED'
    | 'BLOCKED';

export type ProjectedQualityStatus =
    | 'PASS_FOR_OBSERVABILITY_ONLY'
    | 'DATA_LIMITED'
    | 'BLOCKED';

export interface BackfillQualityImpactPreview {
    previewVersion: string;
    previewRunId: string;
    generatedAt: string;
    currentCoverageRatio: number;
    projectedCoverageRatio: number;
    currentQualityStatus: string;
    projectedQualityStatus: ProjectedQualityStatus;
    projectedReadyCount: number;
    projectedBlockedCount: number;
    projectedHorizonCoverageGap: number;
    impactStatus: BackfillImpactStatus;
    notes: string[];
    guardrails: {
        noProductionWrite: true;
        noCorpusWrite: true;
        noOptimizerWrite: true;
        noPerformanceClaim: true;
        noTradingSignal: true;
        observabilityOnly: true;
    };
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface BuildBackfillQualityImpactPreviewOptions {
    previewRunId: string;
    generatedAt: string;
}

export interface BackfillQualityImpactPreviewValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

function projectHorizonCoverageGap(
    currentQualityGate: CorpusQualityGateResult,
    rehearsalSummary: OutcomeBackfillRehearsalSummary,
): number {
    const projected = currentQualityGate.perHorizonCoverage.map(horizon => {
        const transitions = rehearsalSummary.byHorizon[horizon.horizonLabel]?.ready ?? 0;
        const projectedReady = horizon.readyCount + transitions;
        const projectedTotal = horizon.totalCount;
        return projectedTotal > 0 ? projectedReady / projectedTotal : 0;
    });

    if (projected.length < 2) return 0;
    return parseFloat((Math.max(...projected) - Math.min(...projected)).toFixed(4));
}

export function buildBackfillQualityImpactPreview(
    input: {
        currentCorpusMetrics: CorpusMetrics;
        currentCorpusQualityGate: CorpusQualityGateResult;
        rehearsalSummary: OutcomeBackfillRehearsalSummary;
    },
    options: BuildBackfillQualityImpactPreviewOptions,
): BackfillQualityImpactPreview {
    const currentCoverageRatio = input.currentCorpusMetrics.coverageRatio;
    const transitionGain = input.rehearsalSummary.transitionCounts.BLOCKED_TO_READY;
    const projectedReadyCount = input.currentCorpusMetrics.readyCount + transitionGain;
    const projectedBlockedCount = Math.max(0, input.currentCorpusMetrics.blockedCount - transitionGain);
    const projectedCoverageRatio =
        input.currentCorpusMetrics.totalEntries > 0
            ? projectedReadyCount / input.currentCorpusMetrics.totalEntries
            : 0;
    const projectedHorizonCoverageGap = projectHorizonCoverageGap(
        input.currentCorpusQualityGate,
        input.rehearsalSummary,
    );

    let projectedQualityStatus: ProjectedQualityStatus;
    if (projectedCoverageRatio >= 0.5 && projectedHorizonCoverageGap <= 0.35) {
        projectedQualityStatus = 'PASS_FOR_OBSERVABILITY_ONLY';
    } else if (projectedCoverageRatio < 0.5) {
        projectedQualityStatus = input.currentCorpusQualityGate.qualityStatus === 'BLOCKED'
            ? 'BLOCKED'
            : 'DATA_LIMITED';
    } else {
        projectedQualityStatus = 'DATA_LIMITED';
    }

    let impactStatus: BackfillImpactStatus;
    if (transitionGain > 0 && projectedCoverageRatio > currentCoverageRatio) {
        impactStatus = 'IMPROVES_COVERAGE';
    } else if (transitionGain === 0) {
        impactStatus = 'NO_MATERIAL_CHANGE';
    } else if (projectedQualityStatus === 'BLOCKED') {
        impactStatus = 'BLOCKED';
    } else {
        impactStatus = 'STILL_DATA_LIMITED';
    }

    const preview: BackfillQualityImpactPreview = {
        previewVersion: BACKFILL_QUALITY_IMPACT_PREVIEW_VERSION,
        previewRunId: options.previewRunId,
        generatedAt: options.generatedAt,
        currentCoverageRatio,
        projectedCoverageRatio,
        currentQualityStatus: input.currentCorpusQualityGate.qualityStatus,
        projectedQualityStatus,
        projectedReadyCount,
        projectedBlockedCount,
        projectedHorizonCoverageGap,
        impactStatus,
        notes: [
            'Preview only: does not modify corpus or production data.',
            'Projected coverage is based solely on BLOCKED_TO_READY transitions from rehearsal.',
        ],
        guardrails: {
            noProductionWrite: true,
            noCorpusWrite: true,
            noOptimizerWrite: true,
            noPerformanceClaim: true,
            noTradingSignal: true,
            observabilityOnly: true,
        },
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateBackfillQualityImpactPreview(preview);
    preview.validationStatus = validation.validationStatus;
    preview.validationMessages = validation.validationMessages;

    return preview;
}

export function validateBackfillQualityImpactPreview(
    preview: BackfillQualityImpactPreview,
): BackfillQualityImpactPreviewValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    const g = preview.guardrails;
    if (!g.noProductionWrite) {
        messages.push('FAIL: noProductionWrite guardrail must be true');
        status = 'FAIL';
    }
    if (!g.noCorpusWrite) {
        messages.push('FAIL: noCorpusWrite guardrail must be true');
        status = 'FAIL';
    }
    if (!g.noOptimizerWrite) {
        messages.push('FAIL: noOptimizerWrite guardrail must be true');
        status = 'FAIL';
    }
    if (!g.noPerformanceClaim) {
        messages.push('FAIL: noPerformanceClaim guardrail must be true');
        status = 'FAIL';
    }
    if (!g.noTradingSignal) {
        messages.push('FAIL: noTradingSignal guardrail must be true');
        status = 'FAIL';
    }
    if (!g.observabilityOnly) {
        messages.push('FAIL: observabilityOnly guardrail must be true');
        status = 'FAIL';
    }

    if ((preview.projectedQualityStatus as string) === 'PRODUCTION_READY') {
        messages.push('FAIL: projectedQualityStatus must not be PRODUCTION_READY');
        status = 'FAIL';
    }

    if (hasForbiddenClaim(JSON.stringify(preview))) {
        messages.push('FAIL: forbidden claim detected in backfill impact preview');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: backfill quality impact preview safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}
