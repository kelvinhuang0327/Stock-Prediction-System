/**
 * BackfillManualReviewPackage.ts — P15 Online Validation
 *
 * Prepares a human review package for the artifact-only backfill rehearsal.
 * This package does not authorize any production or corpus write path.
 */

import type { OutcomeBackfillGovernanceGate } from './OutcomeBackfillGovernanceGate';
import type { BackfillWritePathContract } from './BackfillWritePathContract';
import type { OutcomeBackfillCandidateSelection } from './OutcomeBackfillCandidateSelector';
import type { OutcomeBackfillRehearsal, OutcomeBackfillRehearsalSummary } from './OutcomeBackfillRehearsalEngine';
import type { BackfillQualityImpactPreview } from './BackfillQualityImpactPreview';

export const BACKFILL_MANUAL_REVIEW_PACKAGE_VERSION = 'backfill-manual-review-package-v0';

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

export interface BackfillManualReviewDecision {
    decision: string;
    allowed: false;
    reason: string;
}

export interface BackfillManualReviewPackage {
    packageVersion: string;
    packageRunId: string;
    generatedAt: string;
    reviewStatus: 'READY_FOR_HUMAN_REVIEW' | 'DATA_LIMITED' | 'BLOCKED';
    reviewSummary: {
        governanceStatus: string;
        writePathMode: string;
        previewOnly: true;
        blockedToReadyCount: number;
        projectedCoverageRatio: number;
        projectedQualityStatus: string;
    };
    candidateSummary: {
        selectedCount: number;
        symbols: string[];
        horizons: string[];
        currentBlockedReasons: Record<string, number>;
    };
    transitionSummary: OutcomeBackfillRehearsalSummary;
    impactPreviewSummary: {
        currentCoverageRatio: number;
        projectedCoverageRatio: number;
        currentQualityStatus: string;
        projectedQualityStatus: string;
        impactStatus: string;
    };
    risks: string[];
    requiredReviewerDecisions: BackfillManualReviewDecision[];
    forbiddenDecisions: BackfillManualReviewDecision[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface BuildBackfillManualReviewPackageOptions {
    packageRunId: string;
    generatedAt: string;
}

export interface BackfillManualReviewPackageValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

function summarizeCurrentBlockedReasons(
    candidateSelection: OutcomeBackfillCandidateSelection,
): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const candidate of candidateSelection.candidates) {
        counts[candidate.currentBlockedReason] = (counts[candidate.currentBlockedReason] ?? 0) + 1;
    }
    return counts;
}

function buildRequiredReviewerDecisions(): BackfillManualReviewDecision[] {
    return [
        {
            decision: 'confirm rehearsal remains artifact-only',
            allowed: false,
            reason: 'Required for review hygiene',
        },
        {
            decision: 'confirm no corpus write',
            allowed: false,
            reason: 'Required for write-path safety',
        },
        {
            decision: 'confirm no production backfill',
            allowed: false,
            reason: 'Required for phase boundary',
        },
        {
            decision: 'confirm no optimizer trigger',
            allowed: false,
            reason: 'Required for phase boundary',
        },
        {
            decision: 'confirm projected coverage is not performance',
            allowed: false,
            reason: 'Coverage preview is not a performance claim',
        },
    ];
}

function buildForbiddenDecisions(): BackfillManualReviewDecision[] {
    return [
        {
            decision: 'approve production backfill',
            allowed: false,
            reason: 'Not enabled in P15',
        },
        {
            decision: 'approve corpus write',
            allowed: false,
            reason: 'Not enabled in P15',
        },
        {
            decision: 'approve optimizer',
            allowed: false,
            reason: 'Not enabled in P15',
        },
        {
            decision: 'approve trading action',
            allowed: false,
            reason: 'Not enabled in P15',
        },
        {
            decision: 'claim strategy performance',
            allowed: false,
            reason: 'Coverage preview is not performance',
        },
    ];
}

export function buildBackfillManualReviewPackage(
    input: {
        governanceGate: OutcomeBackfillGovernanceGate;
        writePathContract: BackfillWritePathContract;
        candidateSelection: OutcomeBackfillCandidateSelection;
        rehearsal: OutcomeBackfillRehearsal;
        qualityImpactPreview: BackfillQualityImpactPreview;
    },
    options: BuildBackfillManualReviewPackageOptions,
): BackfillManualReviewPackage {
    const transitionSummary = {
        inputCandidateCount: input.rehearsal.inputCandidateCount,
        rehearsedCount: input.rehearsal.rehearsedCount,
        stillBlockedCount: input.rehearsal.stillBlockedCount,
        transitionCounts: input.rehearsal.rehearsalItems.reduce(
            (acc, item) => {
                acc[item.transitionType] = (acc[item.transitionType] ?? 0) + 1;
                return acc;
            },
            {
                BLOCKED_TO_READY: 0,
                REMAINS_BLOCKED: 0,
                NO_CHANGE: 0,
            } as OutcomeBackfillRehearsalSummary['transitionCounts'],
        ),
        byHorizon: input.rehearsal.rehearsalItems.reduce(
            (acc, item) => {
                if (!acc[item.horizonLabel]) acc[item.horizonLabel] = { ready: 0, blocked: 0 };
                if (item.proposedSnapshotStatus === 'SNAPSHOT_READY') acc[item.horizonLabel].ready += 1;
                else acc[item.horizonLabel].blocked += 1;
                return acc;
            },
            {} as OutcomeBackfillRehearsalSummary['byHorizon'],
        ),
        bySymbol: input.rehearsal.rehearsalItems.reduce(
            (acc, item) => {
                if (!acc[item.symbol]) acc[item.symbol] = { ready: 0, blocked: 0 };
                if (item.proposedSnapshotStatus === 'SNAPSHOT_READY') acc[item.symbol].ready += 1;
                else acc[item.symbol].blocked += 1;
                return acc;
            },
            {} as OutcomeBackfillRehearsalSummary['bySymbol'],
        ),
        readyAfterRehearsalCount: input.rehearsal.rehearsalItems.filter(
            item => item.proposedSnapshotStatus === 'SNAPSHOT_READY',
        ).length,
        blockedAfterRehearsalCount: input.rehearsal.rehearsalItems.filter(
            item => item.proposedSnapshotStatus === 'SNAPSHOT_BLOCKED',
        ).length,
    };

    const reviewStatus =
        input.governanceGate.gateStatus === 'READY_FOR_MANUAL_REVIEW'
            ? 'READY_FOR_HUMAN_REVIEW'
            : input.governanceGate.gateStatus === 'DATA_LIMITED'
            ? 'DATA_LIMITED'
            : 'BLOCKED';

    const packageArtifact: BackfillManualReviewPackage = {
        packageVersion: BACKFILL_MANUAL_REVIEW_PACKAGE_VERSION,
        packageRunId: options.packageRunId,
        generatedAt: options.generatedAt,
        reviewStatus,
        reviewSummary: {
            governanceStatus: input.governanceGate.gateStatus,
            writePathMode: input.writePathContract.mode,
            previewOnly: true,
            blockedToReadyCount: input.governanceGate.inputSummary.blockedToReadyCount,
            projectedCoverageRatio: input.qualityImpactPreview.projectedCoverageRatio,
            projectedQualityStatus: input.qualityImpactPreview.projectedQualityStatus,
        },
        candidateSummary: {
            selectedCount: input.candidateSelection.selectedCount,
            symbols: [...new Set(input.candidateSelection.candidates.map(candidate => candidate.symbol))].sort(),
            horizons: [...new Set(input.candidateSelection.candidates.map(candidate => candidate.horizonLabel))].sort(),
            currentBlockedReasons: summarizeCurrentBlockedReasons(input.candidateSelection),
        },
        transitionSummary,
        impactPreviewSummary: {
            currentCoverageRatio: input.qualityImpactPreview.currentCoverageRatio,
            projectedCoverageRatio: input.qualityImpactPreview.projectedCoverageRatio,
            currentQualityStatus: input.qualityImpactPreview.currentQualityStatus,
            projectedQualityStatus: input.qualityImpactPreview.projectedQualityStatus,
            impactStatus: input.qualityImpactPreview.impactStatus,
        },
        risks: [
            'artifact-only rehearsal',
            'manual review required',
            `current quality status: ${input.qualityImpactPreview.currentQualityStatus}`,
            `projected quality status: ${input.qualityImpactPreview.projectedQualityStatus}`,
            'preview-only coverage impact',
        ],
        requiredReviewerDecisions: buildRequiredReviewerDecisions(),
        forbiddenDecisions: buildForbiddenDecisions(),
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateBackfillManualReviewPackage(packageArtifact);
    packageArtifact.validationStatus = validation.validationStatus;
    packageArtifact.validationMessages = validation.validationMessages;

    return packageArtifact;
}

export function validateBackfillManualReviewPackage(
    pkg: BackfillManualReviewPackage,
): BackfillManualReviewPackageValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    if (pkg.reviewStatus === 'PRODUCTION_READY') {
        messages.push('FAIL: reviewStatus must not be PRODUCTION_READY');
        status = 'FAIL';
    }

    if (pkg.reviewStatus === 'BLOCKED' && pkg.reviewSummary.governanceStatus === 'READY_FOR_MANUAL_REVIEW') {
        messages.push('FAIL: reviewStatus cannot be BLOCKED when governance is ready');
        status = 'FAIL';
    }

    for (const decision of pkg.requiredReviewerDecisions) {
        if (decision.allowed !== false) {
            messages.push(`FAIL: required decision must not be allowed: ${decision.decision}`);
            status = 'FAIL';
        }
    }
    for (const decision of pkg.forbiddenDecisions) {
        if (decision.allowed !== false) {
            messages.push(`FAIL: forbidden decision must not be allowed: ${decision.decision}`);
            status = 'FAIL';
        }
    }

    const validationText = JSON.stringify({
        reviewSummary: pkg.reviewSummary,
        candidateSummary: pkg.candidateSummary,
        transitionSummary: pkg.transitionSummary,
        impactPreviewSummary: pkg.impactPreviewSummary,
        risks: pkg.risks,
        requiredReviewerDecisions: pkg.requiredReviewerDecisions.map(item => item.reason),
        forbiddenDecisions: pkg.forbiddenDecisions.map(item => item.reason),
    });

    if (hasForbiddenClaim(validationText)) {
        messages.push('FAIL: forbidden claim detected in backfill manual review package');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: backfill manual review package safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}
