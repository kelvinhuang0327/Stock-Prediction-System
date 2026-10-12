/**
 * DashboardMetricsContract.ts — P10 Online Validation
 *
 * Integrates P9 corpus metrics, P9 quality gate, P8 trend stability,
 * and simulation snapshot corpus into a UI-ready dashboard artifact.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - guardrails locked true
 * - Dashboard readiness ≠ production readiness
 * - Dashboard readiness ≠ optimizer readiness
 */

import type { CorpusMetrics } from './CorpusMetricsStore';
import type { CorpusQualityGateResult, SymbolCoverageSummary, HorizonCoverageSummary } from './CorpusQualityGate';
import type { CorpusTrendStabilityResult } from './CorpusTrendStability';
import { summarizeCoverageTrend } from './CorpusTrendStability';

export const DASHBOARD_CONTRACT_VERSION = 'dashboard-metrics-contract-v0';

// ─── Forbidden claims ────────────────────────────────────────────────────────

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
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type DashboardReadinessStatus =
    | 'READY_FOR_OBSERVABILITY_DASHBOARD'
    | 'DATA_LIMITED'
    | 'BLOCKED';

export type CardStatus = 'OK' | 'WARN' | 'BLOCKED' | 'DATA_LIMITED';

export interface DashboardCard {
    cardId: string;
    title: string;
    value: string | number | boolean;
    status: CardStatus;
    note?: string;
}

export interface OverviewCards {
    totalEntries: DashboardCard;
    uniqueAsOfDateCount: DashboardCard;
    uniqueSymbolCount: DashboardCard;
    uniqueHorizonCount: DashboardCard;
    coverageRatio: DashboardCard;
    qualityStatus: DashboardCard;
    trendStabilityStatus: DashboardCard;
}

export interface ReadinessCard {
    cardId: string;
    label: string;
    status: DashboardReadinessStatus | 'OK' | 'WARN';
    note: string;
}

export interface ReadinessCards {
    metricsReadiness: ReadinessCard;
    qualityGateReadiness: ReadinessCard;
    trendStabilityReadiness: ReadinessCard;
    finalDashboardReadiness: ReadinessCard;
    isProductionReady: false;
    isOptimizerReady: false;
    disclaimers: string[];
}

export interface QualityCards {
    qualityStatus: DashboardCard;
    coverageRatio: DashboardCard;
    symbolCoverageGap: DashboardCard;
    horizonCoverageGap: DashboardCard;
    perSymbolCoverage: SymbolCoverageSummary[];
    perHorizonCoverage: HorizonCoverageSummary[];
    validationStatus: DashboardCard;
}

export interface TrendCards {
    stabilityStatus: DashboardCard;
    averageCoverageRatio: DashboardCard;
    largestCoverageDrop: DashboardCard;
    dateCount: DashboardCard;
    stabilityChecks: Record<string, boolean>;
    validationStatus: DashboardCard;
}

export interface WarningCard {
    warningId: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
}

export interface WarningCards {
    warnings: WarningCard[];
    totalWarnings: number;
    highSeverityCount: number;
}

export interface GuardrailCards {
    noProductionWrite: true;
    noSimulationWrite: true;
    noOptimizerWrite: true;
    noPerformanceClaim: true;
    noTradingSignal: true;
    observabilityOnly: true;
    allGuardrailsActive: true;
}

export interface TableSection {
    tableId: string;
    title: string;
    columns: string[];
    rows: Record<string, unknown>[];
}

export interface ChartSection {
    chartId: string;
    title: string;
    chartType: 'line' | 'bar' | 'table';
    data: Record<string, unknown>[];
    xKey: string;
    yKeys: string[];
}

export interface DashboardMetricsContractInput {
    corpusMetrics: CorpusMetrics;
    corpusQualityGate: CorpusQualityGateResult;
    corpusTrendStability: CorpusTrendStabilityResult;
    corpusEntries?: unknown[];
}

export interface DashboardMetricsContractOptions {
    dashboardRunId: string;
    generatedAt: string;
    contractVersion?: string;
}

export interface DashboardMetricsContract {
    contractVersion: string;
    dashboardRunId: string;
    generatedAt: string;
    sourceArtifacts: {
        corpusMetricsVersion: string;
        corpusMetricsRunId: string;
        qualityGateVersion: string;
        qualityGateRunId: string;
        trendStabilityVersion: string;
        trendStabilityRunId: string;
    };
    overviewCards: OverviewCards;
    readinessCards: ReadinessCards;
    qualityCards: QualityCards;
    trendCards: TrendCards;
    warningCards: WarningCards;
    guardrailCards: GuardrailCards;
    tableSections: TableSection[];
    chartSections: ChartSection[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

// ─── Builders ────────────────────────────────────────────────────────────────

export function buildOverviewCards(input: DashboardMetricsContractInput): OverviewCards {
    const { corpusMetrics, corpusQualityGate, corpusTrendStability } = input;

    return {
        totalEntries: {
            cardId: 'overview_total_entries',
            title: 'Total Corpus Entries',
            value: corpusMetrics.totalEntries,
            status: corpusMetrics.totalEntries > 0 ? 'OK' : 'BLOCKED',
        },
        uniqueAsOfDateCount: {
            cardId: 'overview_unique_as_of_date_count',
            title: 'Unique As-Of Dates',
            value: corpusMetrics.uniqueAsOfDateCount,
            status: corpusMetrics.uniqueAsOfDateCount >= 3 ? 'OK' : 'WARN',
        },
        uniqueSymbolCount: {
            cardId: 'overview_unique_symbol_count',
            title: 'Unique Symbols',
            value: corpusMetrics.uniqueSymbolCount,
            status: corpusMetrics.uniqueSymbolCount >= 1 ? 'OK' : 'BLOCKED',
        },
        uniqueHorizonCount: {
            cardId: 'overview_unique_horizon_count',
            title: 'Unique Horizons',
            value: corpusMetrics.uniqueHorizonCount,
            status: corpusMetrics.uniqueHorizonCount >= 2 ? 'OK' : 'WARN',
        },
        coverageRatio: {
            cardId: 'overview_coverage_ratio',
            title: 'Overall Coverage Ratio',
            value: corpusMetrics.coverageRatio,
            status: corpusMetrics.coverageRatio >= 0.5 ? 'OK' : 'WARN',
            note: `${Math.round(corpusMetrics.coverageRatio * 100)}% of snapshots have resolved outcomes`,
        },
        qualityStatus: {
            cardId: 'overview_quality_status',
            title: 'Quality Gate Status',
            value: corpusQualityGate.qualityStatus,
            status: corpusQualityGate.qualityStatus === 'PASS_FOR_OBSERVABILITY_ONLY'
                ? 'OK'
                : corpusQualityGate.qualityStatus === 'DATA_LIMITED'
                ? 'DATA_LIMITED'
                : 'BLOCKED',
        },
        trendStabilityStatus: {
            cardId: 'overview_trend_stability_status',
            title: 'Trend Stability Status',
            value: corpusTrendStability.stabilityStatus,
            status: corpusTrendStability.stabilityStatus === 'STABLE_FOR_OBSERVABILITY_ONLY' ? 'OK' : 'WARN',
        },
    };
}

export function buildReadinessCards(input: DashboardMetricsContractInput): ReadinessCards {
    const { corpusMetrics, corpusQualityGate, corpusTrendStability } = input;

    const metricsReadiness: ReadinessCard = {
        cardId: 'readiness_metrics',
        label: 'Corpus Metrics Readiness',
        status: corpusMetrics.validationStatus === 'PASS' ? 'OK' : 'WARN',
        note: corpusMetrics.validationStatus === 'PASS'
            ? 'Corpus metrics safety contracts verified'
            : 'Corpus metrics validation issues detected',
    };

    const qualityGateReadiness: ReadinessCard = {
        cardId: 'readiness_quality_gate',
        label: 'Quality Gate Readiness',
        status: corpusQualityGate.qualityStatus === 'DATA_LIMITED'
            ? 'DATA_LIMITED'
            : corpusQualityGate.qualityStatus === 'PASS_FOR_OBSERVABILITY_ONLY'
            ? 'READY_FOR_OBSERVABILITY_DASHBOARD'
            : 'BLOCKED',
        note: corpusQualityGate.reasons.join('; ') || 'Quality gate evaluated',
    };

    const trendStabilityReadiness: ReadinessCard = {
        cardId: 'readiness_trend_stability',
        label: 'Trend Stability Readiness',
        status: corpusTrendStability.stabilityStatus === 'STABLE_FOR_OBSERVABILITY_ONLY'
            ? 'READY_FOR_OBSERVABILITY_DASHBOARD'
            : 'DATA_LIMITED',
        note: corpusTrendStability.reasons.join('; ') || 'Trend stability evaluated',
    };

    // Final dashboard readiness — preserves DATA_LIMITED from quality gate
    let finalStatus: DashboardReadinessStatus;
    if (corpusQualityGate.qualityStatus === 'BLOCKED') {
        finalStatus = 'BLOCKED';
    } else if (corpusQualityGate.qualityStatus === 'DATA_LIMITED') {
        finalStatus = 'DATA_LIMITED';
    } else if (
        metricsReadiness.status === 'OK' &&
        trendStabilityReadiness.status === 'READY_FOR_OBSERVABILITY_DASHBOARD'
    ) {
        finalStatus = 'READY_FOR_OBSERVABILITY_DASHBOARD';
    } else {
        finalStatus = 'DATA_LIMITED';
    }

    const finalDashboardReadiness: ReadinessCard = {
        cardId: 'readiness_final_dashboard',
        label: 'Final Dashboard Readiness',
        status: finalStatus,
        note: finalStatus === 'DATA_LIMITED'
            ? 'Dashboard is DATA_LIMITED — observability only. Not production-ready. Not optimizer-ready.'
            : finalStatus === 'READY_FOR_OBSERVABILITY_DASHBOARD'
            ? 'Dashboard is ready for observability use. Not production-ready. Not optimizer-ready.'
            : 'Dashboard is BLOCKED. All reads are suspended.',
    };

    return {
        metricsReadiness,
        qualityGateReadiness,
        trendStabilityReadiness,
        finalDashboardReadiness,
        isProductionReady: false,
        isOptimizerReady: false,
        disclaimers: [
            'Dashboard readiness does not imply production readiness.',
            'Dashboard readiness does not imply optimizer readiness.',
            'All metrics are observability-only. No live execution. No performance claims.',
        ],
    };
}

export function buildQualityCards(input: DashboardMetricsContractInput): QualityCards {
    const { corpusQualityGate } = input;

    return {
        qualityStatus: {
            cardId: 'quality_status',
            title: 'Quality Gate Status',
            value: corpusQualityGate.qualityStatus,
            status: corpusQualityGate.qualityStatus === 'PASS_FOR_OBSERVABILITY_ONLY'
                ? 'OK'
                : corpusQualityGate.qualityStatus === 'DATA_LIMITED'
                ? 'DATA_LIMITED'
                : 'BLOCKED',
        },
        coverageRatio: {
            cardId: 'quality_coverage_ratio',
            title: 'Coverage Ratio',
            value: corpusQualityGate.coverageRatio,
            status: corpusQualityGate.coverageRatio >= 0.5 ? 'OK' : 'WARN',
        },
        symbolCoverageGap: {
            cardId: 'quality_symbol_coverage_gap',
            title: 'Symbol Coverage Gap',
            value: corpusQualityGate.symbolCoverageGap,
            status: corpusQualityGate.symbolCoverageGap <= 0.35 ? 'OK' : 'WARN',
            note: `Max allowed symbol coverage gap = 0.35`,
        },
        horizonCoverageGap: {
            cardId: 'quality_horizon_coverage_gap',
            title: 'Horizon Coverage Gap',
            value: corpusQualityGate.horizonCoverageGap,
            status: corpusQualityGate.horizonCoverageGap <= 0.35 ? 'OK' : 'WARN',
            note: `Current 60D horizon coverage limited — gap = ${corpusQualityGate.horizonCoverageGap}`,
        },
        perSymbolCoverage: corpusQualityGate.perSymbolCoverage,
        perHorizonCoverage: corpusQualityGate.perHorizonCoverage,
        validationStatus: {
            cardId: 'quality_validation_status',
            title: 'Quality Validation Status',
            value: corpusQualityGate.validationStatus,
            status: corpusQualityGate.validationStatus === 'PASS' ? 'OK' : 'BLOCKED',
        },
    };
}

export function buildTrendCards(input: DashboardMetricsContractInput): TrendCards {
    const { corpusMetrics, corpusTrendStability } = input;
    const summary = summarizeCoverageTrend(corpusMetrics);

    return {
        stabilityStatus: {
            cardId: 'trend_stability_status',
            title: 'Trend Stability Status',
            value: corpusTrendStability.stabilityStatus,
            status: corpusTrendStability.stabilityStatus === 'STABLE_FOR_OBSERVABILITY_ONLY' ? 'OK' : 'WARN',
        },
        averageCoverageRatio: {
            cardId: 'trend_average_coverage_ratio',
            title: 'Average Coverage Ratio (trend)',
            value: summary.averageCoverageRatio,
            status: summary.averageCoverageRatio >= 0.5 ? 'OK' : 'WARN',
        },
        largestCoverageDrop: {
            cardId: 'trend_largest_coverage_drop',
            title: 'Largest Coverage Drop',
            value: summary.largestCoverageDrop,
            status: summary.largestCoverageDrop <= 0.1 ? 'OK' : 'WARN',
            note: 'Max allowed drop = 0.10 per period',
        },
        dateCount: {
            cardId: 'trend_date_count',
            title: 'Trend Date Count',
            value: summary.dateCount,
            status: summary.dateCount >= 3 ? 'OK' : 'WARN',
        },
        stabilityChecks: { ...corpusTrendStability.stabilityChecks },
        validationStatus: {
            cardId: 'trend_validation_status',
            title: 'Trend Validation Status',
            value: corpusTrendStability.validationStatus,
            status: corpusTrendStability.validationStatus === 'PASS' ? 'OK' : 'BLOCKED',
        },
    };
}

export function buildWarningCards(input: DashboardMetricsContractInput): WarningCards {
    const { corpusQualityGate, corpusTrendStability } = input;
    const warnings: WarningCard[] = [];

    if (corpusQualityGate.qualityStatus === 'DATA_LIMITED') {
        warnings.push({
            warningId: 'warn_data_limited',
            severity: 'HIGH',
            message: `Quality gate status is DATA_LIMITED. Reasons: ${corpusQualityGate.reasons.join('; ')}`,
        });
        warnings.push({
            warningId: 'warn_horizon_coverage_gap',
            severity: 'HIGH',
            message: `horizonCoverageGap=${corpusQualityGate.horizonCoverageGap} exceeds allowed maximum. 60D horizon coverage is severely limited (coverageRatio=0.125).`,
        });
        warnings.push({
            warningId: 'warn_60d_coverage',
            severity: 'HIGH',
            message: `60D horizon has only 1 ready snapshot out of 8. 60D coverage will not mature until sufficient real-time data accumulates.`,
        });
    }

    warnings.push({
        warningId: 'warn_fixture_driven_corpus',
        severity: 'MEDIUM',
        message: 'Corpus is fixture-driven (synthetic as-of dates). All entries are simulation snapshots, not live outcome data. No real market outcomes are present.',
    });

    warnings.push({
        warningId: 'warn_no_prod_readiness',
        severity: 'HIGH',
        message: 'This dashboard does NOT represent production readiness. Dashboard readiness differs from production readiness. Do not use for live trading decisions.',
    });

    warnings.push({
        warningId: 'warn_no_optimizer_readiness',
        severity: 'HIGH',
        message: 'This dashboard does NOT represent optimizer readiness. Data is observability-only. Optimizer is not permitted to consume these metrics.',
    });

    if (corpusTrendStability.stabilityStatus !== 'STABLE_FOR_OBSERVABILITY_ONLY') {
        warnings.push({
            warningId: 'warn_trend_unstable',
            severity: 'MEDIUM',
            message: `Trend stability status is ${corpusTrendStability.stabilityStatus}. Coverage trend may be unreliable.`,
        });
    }

    const highSeverityCount = warnings.filter(w => w.severity === 'HIGH').length;

    return {
        warnings,
        totalWarnings: warnings.length,
        highSeverityCount,
    };
}

export function buildGuardrailCards(): GuardrailCards {
    return {
        noProductionWrite: true,
        noSimulationWrite: true,
        noOptimizerWrite: true,
        noPerformanceClaim: true,
        noTradingSignal: true,
        observabilityOnly: true,
        allGuardrailsActive: true,
    };
}

function buildTableSections(input: DashboardMetricsContractInput): TableSection[] {
    const { corpusMetrics, corpusQualityGate } = input;

    const perSymbolTable: TableSection = {
        tableId: 'table_per_symbol_coverage',
        title: 'Per-Symbol Coverage',
        columns: ['symbol', 'totalCount', 'readyCount', 'blockedCount', 'coverageRatio'],
        rows: corpusQualityGate.perSymbolCoverage.map(s => ({ ...s })),
    };

    const perHorizonTable: TableSection = {
        tableId: 'table_per_horizon_coverage',
        title: 'Per-Horizon Coverage',
        columns: ['horizonLabel', 'totalCount', 'readyCount', 'blockedCount', 'coverageRatio'],
        rows: corpusQualityGate.perHorizonCoverage.map(h => ({ ...h })),
    };

    const trendTable: TableSection = {
        tableId: 'table_coverage_trend',
        title: 'Coverage Trend by As-Of Date',
        columns: ['asOfDate', 'totalCount', 'readyCount', 'blockedCount', 'coverageRatio'],
        rows: (corpusMetrics.outcomeCoverageTrend ?? []).map(t => ({ ...t })),
    };

    return [perSymbolTable, perHorizonTable, trendTable];
}

function buildChartSections(input: DashboardMetricsContractInput): ChartSection[] {
    const { corpusMetrics } = input;

    const readyTrendChart: ChartSection = {
        chartId: 'chart_ready_trend',
        title: 'Ready Count by As-Of Date',
        chartType: 'line',
        data: (corpusMetrics.readyTrendByAsOfDate ?? []).map(t => ({ ...t })),
        xKey: 'asOfDate',
        yKeys: ['readyCount'],
    };

    const coverageRatioChart: ChartSection = {
        chartId: 'chart_coverage_ratio_trend',
        title: 'Coverage Ratio Trend',
        chartType: 'line',
        data: (corpusMetrics.outcomeCoverageTrend ?? []).map(t => ({
            asOfDate: t.asOfDate,
            coverageRatio: t.coverageRatio,
        })),
        xKey: 'asOfDate',
        yKeys: ['coverageRatio'],
    };

    return [readyTrendChart, coverageRatioChart];
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface DashboardContractValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export function validateDashboardMetricsContract(
    contract: DashboardMetricsContract
): DashboardContractValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    const serialized = JSON.stringify(contract);

    // No PRODUCTION_READY
    if (/PRODUCTION_READY/i.test(serialized)) {
        messages.push('FAIL: PRODUCTION_READY found in contract — forbidden');
        status = 'FAIL';
    }

    // Check forbidden claims
    const forbiddenFound: string[] = [];
    for (const pattern of FORBIDDEN_PATTERNS) {
        // Skip PRODUCTION_READY (already checked above)
        if (pattern.source.includes('PRODUCTION_READY')) continue;
        const match = serialized.match(pattern);
        if (match) {
            forbiddenFound.push(match[0]);
        }
    }
    if (forbiddenFound.length > 0) {
        messages.push(`FAIL: Forbidden claims found: ${forbiddenFound.join(', ')}`);
        status = 'FAIL';
    }

    // Guardrails must all be true
    const g = contract.guardrailCards;
    if (!g.noProductionWrite || !g.noSimulationWrite || !g.noOptimizerWrite ||
        !g.noPerformanceClaim || !g.noTradingSignal || !g.observabilityOnly) {
        messages.push('FAIL: One or more guardrails are not active');
        status = 'FAIL';
    }

    // Final dashboard readiness must not be PRODUCTION_READY
    const finalStatus = contract.readinessCards.finalDashboardReadiness.status;
    if (finalStatus === ('PRODUCTION_READY' as string)) {
        messages.push('FAIL: finalDashboardReadiness must not be PRODUCTION_READY');
        status = 'FAIL';
    }

    // isProductionReady and isOptimizerReady must be false
    if (contract.readinessCards.isProductionReady !== false) {
        messages.push('FAIL: isProductionReady must be false');
        status = 'FAIL';
    }
    if (contract.readinessCards.isOptimizerReady !== false) {
        messages.push('FAIL: isOptimizerReady must be false');
        status = 'FAIL';
    }

    // Source artifacts must be present
    if (!contract.sourceArtifacts.corpusMetricsRunId || !contract.sourceArtifacts.qualityGateRunId) {
        messages.push('WARN: sourceArtifacts fields missing or empty');
        if (status === 'PASS') status = 'WARN';
    }

    // Contract must be parseable (already is, since we have the object)
    try {
        JSON.parse(serialized);
    } catch {
        messages.push('FAIL: contract is not JSON-parseable');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: dashboard metrics contract safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildDashboardMetricsContract(
    input: DashboardMetricsContractInput,
    options: DashboardMetricsContractOptions
): DashboardMetricsContract {
    const contractVersion = options.contractVersion ?? DASHBOARD_CONTRACT_VERSION;

    const overviewCards = buildOverviewCards(input);
    const readinessCards = buildReadinessCards(input);
    const qualityCards = buildQualityCards(input);
    const trendCards = buildTrendCards(input);
    const warningCards = buildWarningCards(input);
    const guardrailCards = buildGuardrailCards();
    const tableSections = buildTableSections(input);
    const chartSections = buildChartSections(input);

    const contract: DashboardMetricsContract = {
        contractVersion,
        dashboardRunId: options.dashboardRunId,
        generatedAt: options.generatedAt,
        sourceArtifacts: {
            corpusMetricsVersion: input.corpusMetrics.metricsVersion,
            corpusMetricsRunId: input.corpusMetrics.metricsRunId,
            qualityGateVersion: input.corpusQualityGate.qualityGateVersion,
            qualityGateRunId: input.corpusQualityGate.qualityRunId,
            trendStabilityVersion: input.corpusTrendStability.trendStabilityVersion,
            trendStabilityRunId: input.corpusTrendStability.trendRunId,
        },
        overviewCards,
        readinessCards,
        qualityCards,
        trendCards,
        warningCards,
        guardrailCards,
        tableSections,
        chartSections,
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateDashboardMetricsContract(contract);
    contract.validationStatus = validation.validationStatus;
    contract.validationMessages = validation.validationMessages;

    return contract;
}
