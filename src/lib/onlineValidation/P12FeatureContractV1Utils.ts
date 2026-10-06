/**
 * P12FeatureContractV1Utils.ts
 * P26A-HARDRESET — P12 PIT Feature Contract v1 Refresh
 *
 * Supersedes P12PitFeatureContractUtils.ts (v0).
 * Key change: MonthlyRevenue status upgraded from HIGH_RISK → REPAIRED_2026_05_12,
 * reflecting the releaseDate column addition and PIT gate repair in P17/P24/P25.
 *
 * This module is pure: no DB access, no external calls, no randomness.
 *
 * NO investment recommendations. NO ROI / win-rate / profit / outperform claims.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type PitStatusV1 =
    | 'ALREADY_PIT_GATED'
    | 'REPAIRED_2026_05_12'
    | 'STILL_HIGH_RISK_NOT_PIT_GATED'
    | 'INFORMATIONAL_ONLY';

export type PitRiskLevelV1 = 'LOW' | 'MEDIUM' | 'HIGH' | 'REPAIRED';

export interface FeatureSourceV1 {
    sourceName: string;
    pitStatus: PitStatusV1;
    pitRiskLevel: PitRiskLevelV1;
    asOfGateRule: string;
    gateField: string | null;
    entersAlphaScore: boolean;
    entersReasonOrFactorSnapshot: boolean;
    activeSnapshotFields: string[];
    notes: string;
    supersededV0Notes?: string;
    repairReferences?: string[];
}

export interface P12ContractV1 {
    contractVersion: 'p12-pit-feature-contract-v1';
    generatedAt: string;
    supersedes: 'p12-pit-feature-contract-v0';
    disclaimer: string;
    featureSources: FeatureSourceV1[];
    knownStaleness: string[];
    nonGoals: string[];
    verdict: 'CONTRACT_V1_COMPLETE' | 'CONTRACT_V1_PARTIAL';
}

export interface ContractV1Summary {
    totalSources: number;
    byPitStatus: Record<PitStatusV1, number>;
    byRiskLevel: Record<PitRiskLevelV1, number>;
    sourcesEnteringAlphaScore: string[];
    sourcesEnteringReasonOnly: string[];
    highRiskRemaining: string[];
    repairedSources: string[];
    verdict: P12ContractV1['verdict'];
}

// ─── Feature Source Definitions ──────────────────────────────────────────────

const FEATURE_SOURCES_V1: FeatureSourceV1[] = [
    {
        sourceName: 'StockQuote',
        pitStatus: 'ALREADY_PIT_GATED',
        pitRiskLevel: 'LOW',
        asOfGateRule: 'WHERE date <= asOfDate (YYYYMMDD string, lexicographic)',
        gateField: 'date',
        entersAlphaScore: true,
        entersReasonOrFactorSnapshot: true,
        activeSnapshotFields: [
            'technicalScore', 'momentumScore', 'scoreSnapshot.technicalScore',
            'factorSnapshot[MA 趨勢]', 'factorSnapshot[MA20 位置]',
            'factorSnapshot[RSI(14)]', 'factorSnapshot[MACD]',
            'factorSnapshot[近 20 日動能]', 'factorSnapshot[近 5 日報酬]',
            'factorSnapshot[量能變化]', 'factorSnapshot[波動率]',
            'factorSnapshot[近期最大回撤]',
        ],
        notes: 'Fully PIT-gated. Provides technical sub-scores and all technical factor entries.',
    },
    {
        sourceName: 'MarketRegime',
        pitStatus: 'ALREADY_PIT_GATED',
        pitRiskLevel: 'LOW',
        asOfGateRule: 'detectRegime(asOf) — regime calculated from TAIEX quotes up to asOfDate',
        gateField: 'asOf parameter in detectRegime()',
        entersAlphaScore: true,
        entersReasonOrFactorSnapshot: true,
        activeSnapshotFields: [
            'scoreSnapshot.marketAdjustment',
            'factorSnapshot[Market Regime]',
            'factorSnapshot[Regime Confidence]',
        ],
        notes: 'PIT-safe via asOf parameter. Regime affects marketAdjustment in alphaScore.',
    },
    {
        sourceName: 'InstitutionalChip',
        pitStatus: 'ALREADY_PIT_GATED',
        pitRiskLevel: 'LOW',
        asOfGateRule: 'WHERE date <= asOfDate (YYYYMMDD string)',
        gateField: 'date',
        entersAlphaScore: true,
        entersReasonOrFactorSnapshot: true,
        activeSnapshotFields: [
            'chipScore', 'scoreSnapshot.chipScore',
            'factorSnapshot[法人近 10 日買超]',
        ],
        notes: 'Fully PIT-gated. chipScore = 0 if fewer than 5 chip records available.',
    },
    {
        sourceName: 'MonthlyRevenue',
        pitStatus: 'REPAIRED_2026_05_12',
        pitRiskLevel: 'REPAIRED',
        asOfGateRule: 'WHERE releaseDate <= asOfDate (DateTime field added P24). Fallback: releaseDate INFERRED as (year/month+1/10) when missing.',
        gateField: 'releaseDate',
        entersAlphaScore: true,
        entersReasonOrFactorSnapshot: true,
        activeSnapshotFields: [
            'scoreSnapshot (revenueScore component when revenueCount >= 13)',
            'factorSnapshot[營收年增率]',
        ],
        notes: 'REPAIRED in P17/P24/P25. releaseDate column added to schema. PIT gate now enforced via filterMonthlyRevenueAvailableAsOf(). Records without releaseDate use inferred date (10th of following month). P26A brings MonthlyRevenue into reason/factor snapshot.',
        supersededV0Notes: 'v0 described MonthlyRevenue as HIGH-RISK pending repair. This is now superseded.',
        repairReferences: ['P17-HARDRESET', 'P24-HARDRESET', 'P25-HARDRESET'],
    },
    {
        sourceName: 'FinancialReport',
        pitStatus: 'STILL_HIGH_RISK_NOT_PIT_GATED',
        pitRiskLevel: 'HIGH',
        asOfGateRule: 'NOT IMPLEMENTED — FinancialReport is not currently used in scoring',
        gateField: null,
        entersAlphaScore: false,
        entersReasonOrFactorSnapshot: false,
        activeSnapshotFields: [],
        notes: 'STILL HIGH RISK. FinancialReport (EPS, P/E, book value) is not currently used in RuleBasedStockAnalyzer or SignalFusionEngine scoring. If activated, must add publishedDate gate before asOfDate.',
    },
    {
        sourceName: 'NewsEvent',
        pitStatus: 'STILL_HIGH_RISK_NOT_PIT_GATED',
        pitRiskLevel: 'HIGH',
        asOfGateRule: 'Should gate by publishedAt, NOT ingestedAt. Not currently used in scoring.',
        gateField: 'publishedAt (if activated)',
        entersAlphaScore: false,
        entersReasonOrFactorSnapshot: false,
        activeSnapshotFields: [],
        notes: 'STILL HIGH RISK. NewsEvent has publishedAt and ingestedAt fields. ingestedAt is NOT PIT-safe (DB write time). If activated in scoring, must gate by publishedAt <= asOfDate only.',
    },
];

// ─── Contract Builder ─────────────────────────────────────────────────────────

/**
 * buildP12ContractV1
 *
 * Returns the P12 PIT feature contract v1.
 * Pure function — always returns same result for same inputs.
 */
export function buildP12ContractV1(generatedAt?: string): P12ContractV1 {
    return {
        contractVersion: 'p12-pit-feature-contract-v1',
        generatedAt: generatedAt ?? new Date().toISOString(),
        supersedes: 'p12-pit-feature-contract-v0',
        disclaimer:
            'This contract documents PIT (Point-In-Time) compliance status for feature sources. ' +
            'No investment recommendations. No ROI, win-rate, alpha, profit, outperform, buy, or sell claims. ' +
            'Research instrument only.',
        featureSources: FEATURE_SOURCES_V1.map(src => ({
            ...src,
            activeSnapshotFields: [...src.activeSnapshotFields],
            ...(src.repairReferences ? { repairReferences: [...src.repairReferences] } : {}),
        })),
        knownStaleness: [
            'v0 MonthlyRevenue HIGH-RISK description is superseded by this v1 contract.',
            'v0 "MonthlyRevenue pending high-risk repair" language is no longer accurate as of 2026-05-12.',
            'FinancialReport and NewsEvent remain NOT in scoring — their risk levels are unchanged from v0.',
        ],
        nonGoals: [
            'Does not add FinancialReport or NewsEvent to scoring',
            'No activation date committed for FinancialReport or NewsEvent PIT gating repair',
            'Does not describe outcome fields (outcomePrice, returnPct, realizedReturnClass)',
            'Does not add any factor not already computed by RuleBasedStockAnalyzer + SignalFusionEngine',
        ],
        verdict: 'CONTRACT_V1_COMPLETE',
    };
}

// ─── Summary Generator ───────────────────────────────────────────────────────

/**
 * buildContractV1Summary
 *
 * Returns a summary object for quick inspection of the v1 contract.
 */
export function buildContractV1Summary(contract: P12ContractV1): ContractV1Summary {
    const byPitStatus: Record<PitStatusV1, number> = {
        ALREADY_PIT_GATED: 0,
        REPAIRED_2026_05_12: 0,
        STILL_HIGH_RISK_NOT_PIT_GATED: 0,
        INFORMATIONAL_ONLY: 0,
    };
    const byRiskLevel: Record<PitRiskLevelV1, number> = {
        LOW: 0, MEDIUM: 0, HIGH: 0, REPAIRED: 0,
    };

    const sourcesEnteringAlphaScore: string[] = [];
    const sourcesEnteringReasonOnly: string[] = [];
    const highRiskRemaining: string[] = [];
    const repairedSources: string[] = [];

    for (const src of contract.featureSources) {
        byPitStatus[src.pitStatus] = (byPitStatus[src.pitStatus] ?? 0) + 1;
        byRiskLevel[src.pitRiskLevel] = (byRiskLevel[src.pitRiskLevel] ?? 0) + 1;

        if (src.entersAlphaScore) sourcesEnteringAlphaScore.push(src.sourceName);
        else if (src.entersReasonOrFactorSnapshot) sourcesEnteringReasonOnly.push(src.sourceName);

        if (src.pitStatus === 'STILL_HIGH_RISK_NOT_PIT_GATED') highRiskRemaining.push(src.sourceName);
        if (src.pitStatus === 'REPAIRED_2026_05_12') repairedSources.push(src.sourceName);
    }

    return {
        totalSources: contract.featureSources.length,
        byPitStatus,
        byRiskLevel,
        sourcesEnteringAlphaScore,
        sourcesEnteringReasonOnly,
        highRiskRemaining,
        repairedSources,
        verdict: contract.verdict,
    };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ContractV1ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * validateContractV1
 *
 * Checks that the contract satisfies structural invariants.
 */
export function validateContractV1(contract: P12ContractV1): ContractV1ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Must have v1 version
    if (contract.contractVersion !== 'p12-pit-feature-contract-v1') {
        errors.push(`contractVersion must be p12-pit-feature-contract-v1, got: ${contract.contractVersion}`);
    }

    // MonthlyRevenue must be REPAIRED
    const mr = contract.featureSources.find(s => s.sourceName === 'MonthlyRevenue');
    if (!mr) {
        errors.push('MonthlyRevenue feature source not found in v1 contract');
    } else {
        if (mr.pitStatus !== 'REPAIRED_2026_05_12') {
            errors.push(`MonthlyRevenue pitStatus must be REPAIRED_2026_05_12, got: ${mr.pitStatus}`);
        }
    }

    // FinancialReport must still be HIGH_RISK
    const fr = contract.featureSources.find(s => s.sourceName === 'FinancialReport');
    if (fr && fr.pitStatus !== 'STILL_HIGH_RISK_NOT_PIT_GATED') {
        warnings.push('FinancialReport is no longer marked STILL_HIGH_RISK — verify this is intentional');
    }

    // NewsEvent must still be HIGH_RISK
    const ne = contract.featureSources.find(s => s.sourceName === 'NewsEvent');
    if (ne && ne.pitStatus !== 'STILL_HIGH_RISK_NOT_PIT_GATED') {
        warnings.push('NewsEvent is no longer marked STILL_HIGH_RISK — verify this is intentional');
    }

    // No outcome fields allowed
    const FORBIDDEN_FIELDS = ['outcomePrice', 'returnPct', 'realizedReturnClass'];
    for (const src of contract.featureSources) {
        for (const field of src.activeSnapshotFields) {
            for (const forbidden of FORBIDDEN_FIELDS) {
                if (field.includes(forbidden)) {
                    errors.push(`Forbidden outcome field "${forbidden}" found in ${src.sourceName}.activeSnapshotFields`);
                }
            }
        }
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * getMonthlyRevenueV1Status
 *
 * Returns the PIT status of MonthlyRevenue in v1. Used for quick assertion in tests.
 */
export function getMonthlyRevenueV1Status(contract: P12ContractV1): PitStatusV1 | null {
    return contract.featureSources.find(s => s.sourceName === 'MonthlyRevenue')?.pitStatus ?? null;
}

/**
 * getHighRiskSourceNames
 *
 * Returns names of all sources with STILL_HIGH_RISK_NOT_PIT_GATED status.
 */
export function getHighRiskSourceNames(contract: P12ContractV1): string[] {
    return contract.featureSources
        .filter(s => s.pitStatus === 'STILL_HIGH_RISK_NOT_PIT_GATED')
        .map(s => s.sourceName);
}
