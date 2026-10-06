/**
 * BackfillWritePathContract.ts — P15 Online Validation
 *
 * Defines write-path boundaries for artifact-only rehearsal and manual review.
 * Production backfill is not enabled in P15.
 */

import type { OutcomeBackfillGovernanceGate } from './OutcomeBackfillGovernanceGate';
import type { BackfillQualityImpactPreview } from './BackfillQualityImpactPreview';
import type { OutcomeBackfillRehearsal } from './OutcomeBackfillRehearsalEngine';

export const BACKFILL_WRITE_PATH_CONTRACT_VERSION = 'backfill-write-path-contract-v0';

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

export interface BackfillWritePathMatrixRow {
    mode: 'ARTIFACT_ONLY_REHEARSAL' | 'MANUAL_REVIEW' | 'PRODUCTION_BACKFILL';
    productionDbWriteAllowed: false;
    corpusJsonlWriteAllowed: false;
    predictionRowWriteAllowed: false;
    strategySignalWriteAllowed: false;
    artifactWriteAllowed: true;
    reason: string;
}

export interface BackfillWritePathContract {
    contractVersion: string;
    contractRunId: string;
    generatedAt: string;
    mode: 'ARTIFACT_ONLY_REHEARSAL';
    allowedOperations: string[];
    forbiddenOperations: string[];
    writePathMatrix: BackfillWritePathMatrixRow[];
    escalationPolicy: {
        manualReviewRequired: true;
        automaticPromotionAllowed: false;
        productionBackfillAllowed: false;
        artifactOnly: true;
        notes: string[];
    };
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface BuildBackfillWritePathContractOptions {
    contractRunId: string;
    generatedAt: string;
}

export interface BackfillWritePathContractValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export function buildBackfillWritePathContract(
    input: {
        governanceGate: OutcomeBackfillGovernanceGate;
        rehearsal: OutcomeBackfillRehearsal;
        qualityImpactPreview: BackfillQualityImpactPreview;
    },
    options: BuildBackfillWritePathContractOptions,
): BackfillWritePathContract {
    const writePathMatrix: BackfillWritePathMatrixRow[] = [
        {
            mode: 'ARTIFACT_ONLY_REHEARSAL',
            productionDbWriteAllowed: false,
            corpusJsonlWriteAllowed: false,
            predictionRowWriteAllowed: false,
            strategySignalWriteAllowed: false,
            artifactWriteAllowed: true,
            reason: 'artifact-only rehearsal',
        },
        {
            mode: 'MANUAL_REVIEW',
            productionDbWriteAllowed: false,
            corpusJsonlWriteAllowed: false,
            predictionRowWriteAllowed: false,
            strategySignalWriteAllowed: false,
            artifactWriteAllowed: true,
            reason: 'manual review package only',
        },
        {
            mode: 'PRODUCTION_BACKFILL',
            productionDbWriteAllowed: false,
            corpusJsonlWriteAllowed: false,
            predictionRowWriteAllowed: false,
            strategySignalWriteAllowed: false,
            artifactWriteAllowed: true,
            reason: 'NOT_ENABLED_IN_P15',
        },
    ];

    const contract: BackfillWritePathContract = {
        contractVersion: BACKFILL_WRITE_PATH_CONTRACT_VERSION,
        contractRunId: options.contractRunId,
        generatedAt: options.generatedAt,
        mode: 'ARTIFACT_ONLY_REHEARSAL',
        allowedOperations: [
            'read corpus',
            'read P14 artifacts',
            'generate governance artifact',
            'generate manual review package',
            'generate preview-only quality impact',
        ],
        forbiddenOperations: [
            'write production DB',
            'write corpus JSONL',
            'write Prediction row',
            'write StrategySignal',
            'call optimizer',
            'auto promote',
            'emit trading signal',
            'claim performance',
        ],
        writePathMatrix,
        escalationPolicy: {
            manualReviewRequired: true,
            automaticPromotionAllowed: false,
            productionBackfillAllowed: false,
            artifactOnly: true,
            notes: [
                'P15 is artifact-only.',
                'Manual review may inspect rehearsal and preview artifacts.',
                'Production backfill is not enabled in this phase.',
            ],
        },
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateBackfillWritePathContract(contract);
    contract.validationStatus = validation.validationStatus;
    contract.validationMessages = validation.validationMessages;

    return contract;
}

export function validateBackfillWritePathContract(
    contract: BackfillWritePathContract,
): BackfillWritePathContractValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    if (contract.mode !== 'ARTIFACT_ONLY_REHEARSAL') {
        messages.push('FAIL: mode must be ARTIFACT_ONLY_REHEARSAL');
        status = 'FAIL';
    }

    for (const row of contract.writePathMatrix) {
        if (row.productionDbWriteAllowed !== false) {
            messages.push(`FAIL: productionDbWriteAllowed must be false: ${row.mode}`);
            status = 'FAIL';
        }
        if (row.corpusJsonlWriteAllowed !== false) {
            messages.push(`FAIL: corpusJsonlWriteAllowed must be false: ${row.mode}`);
            status = 'FAIL';
        }
        if (row.predictionRowWriteAllowed !== false) {
            messages.push(`FAIL: predictionRowWriteAllowed must be false: ${row.mode}`);
            status = 'FAIL';
        }
        if (row.strategySignalWriteAllowed !== false) {
            messages.push(`FAIL: strategySignalWriteAllowed must be false: ${row.mode}`);
            status = 'FAIL';
        }
        if (row.mode === 'PRODUCTION_BACKFILL' && row.reason !== 'NOT_ENABLED_IN_P15') {
            messages.push('FAIL: production backfill reason must be NOT_ENABLED_IN_P15');
            status = 'FAIL';
        }
    }

    if (!contract.escalationPolicy.manualReviewRequired) {
        messages.push('FAIL: manualReviewRequired must be true');
        status = 'FAIL';
    }
    if (contract.escalationPolicy.automaticPromotionAllowed !== false) {
        messages.push('FAIL: automaticPromotionAllowed must be false');
        status = 'FAIL';
    }
    if (contract.escalationPolicy.productionBackfillAllowed !== false) {
        messages.push('FAIL: productionBackfillAllowed must be false');
        status = 'FAIL';
    }
    if (contract.escalationPolicy.artifactOnly !== true) {
        messages.push('FAIL: artifactOnly must be true');
        status = 'FAIL';
    }

    if (hasForbiddenClaim(JSON.stringify(contract))) {
        messages.push('FAIL: forbidden claim detected in backfill write-path contract');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: backfill write-path contract safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}
