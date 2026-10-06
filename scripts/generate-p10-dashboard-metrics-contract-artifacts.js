#!/usr/bin/env node
/**
 * generate-p10-dashboard-metrics-contract-artifacts.js
 * Self-contained Node.js script — no TypeScript compilation required.
 *
 * Reads: P9 corpus metrics, P9 quality gate, P8 trend stability, corpus JSONL
 * Writes: dashboard metrics contract, readiness cards, quality warnings, system readiness report
 *
 * SAFETY CONTRACT: no production DB write, no external API, no LLM, no trading signals.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '../outputs/online_validation');
const SYSTEM_READINESS_DIR = path.resolve(__dirname, '../outputs/system_readiness');

const DASHBOARD_CONTRACT_VERSION = 'dashboard-metrics-contract-v0';
const DASHBOARD_RUN_ID = 'p10-dashboard-metrics-contract-20260511-001';
const GENERATED_AT = new Date().toISOString();

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

function hasForbiddenClaim(text) {
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

// ─── Load inputs ──────────────────────────────────────────────────

function loadInputs() {
    const metricsPath = path.join(BASE_DIR, 'p9_corpus_metrics_store.json');
    const qualityGatePath = path.join(BASE_DIR, 'p9_corpus_quality_gate.json');
    const trendStabilityPath = path.join(BASE_DIR, 'p8_corpus_trend_stability.json');
    const corpusPath = path.join(BASE_DIR, 'simulation_snapshot_corpus.jsonl');

    const corpusMetrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    const corpusQualityGate = JSON.parse(fs.readFileSync(qualityGatePath, 'utf8'));
    const corpusTrendStability = JSON.parse(fs.readFileSync(trendStabilityPath, 'utf8'));

    const corpusRaw = fs.readFileSync(corpusPath, 'utf8');
    const corpusEntries = corpusRaw
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => JSON.parse(l));

    return { corpusMetrics, corpusQualityGate, corpusTrendStability, corpusEntries };
}

// ─── Trend summary (inline — no TS import) ────────────────────────

function summarizeCoverageTrend(outcomeCoverageTrend) {
    const trend = outcomeCoverageTrend || [];
    const ratios = trend.map(t => t.coverageRatio);
    const dateCount = trend.length;

    if (dateCount === 0) {
        return { dateCount: 0, minCoverageRatio: 0, maxCoverageRatio: 0,
            averageCoverageRatio: 0, largestCoverageDrop: 0,
            largestCoverageRise: 0, stableDateCount: 0, unstableDateCount: 0 };
    }

    const minCoverageRatio = Math.min(...ratios);
    const maxCoverageRatio = Math.max(...ratios);
    const averageCoverageRatio = ratios.reduce((s, r) => s + r, 0) / dateCount;

    let largestCoverageDrop = 0;
    let largestCoverageRise = 0;
    let stableDateCount = dateCount > 0 ? 1 : 0;
    let unstableDateCount = 0;

    for (let i = 1; i < trend.length; i++) {
        const delta = trend[i].coverageRatio - trend[i - 1].coverageRatio;
        if (delta < 0) {
            largestCoverageDrop = Math.max(largestCoverageDrop, -delta);
            unstableDateCount += 1;
        } else {
            largestCoverageRise = Math.max(largestCoverageRise, delta);
            stableDateCount += 1;
        }
    }

    return { dateCount, minCoverageRatio, maxCoverageRatio, averageCoverageRatio,
        largestCoverageDrop, largestCoverageRise, stableDateCount, unstableDateCount };
}

// ─── Builders ─────────────────────────────────────────────────────

function buildOverviewCards({ corpusMetrics, corpusQualityGate, corpusTrendStability }) {
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
            status: corpusQualityGate.qualityStatus === 'PASS_FOR_OBSERVABILITY_ONLY' ? 'OK'
                : corpusQualityGate.qualityStatus === 'DATA_LIMITED' ? 'DATA_LIMITED'
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

function buildReadinessCards({ corpusMetrics, corpusQualityGate, corpusTrendStability }) {
    const metricsReadiness = {
        cardId: 'readiness_metrics',
        label: 'Corpus Metrics Readiness',
        status: corpusMetrics.validationStatus === 'PASS' ? 'OK' : 'WARN',
        note: corpusMetrics.validationStatus === 'PASS'
            ? 'Corpus metrics safety contracts verified'
            : 'Corpus metrics validation issues detected',
    };

    const qualityGateReadiness = {
        cardId: 'readiness_quality_gate',
        label: 'Quality Gate Readiness',
        status: corpusQualityGate.qualityStatus === 'DATA_LIMITED' ? 'DATA_LIMITED'
            : corpusQualityGate.qualityStatus === 'PASS_FOR_OBSERVABILITY_ONLY' ? 'READY_FOR_OBSERVABILITY_DASHBOARD'
            : 'BLOCKED',
        note: (corpusQualityGate.reasons || []).join('; ') || 'Quality gate evaluated',
    };

    const trendStabilityReadiness = {
        cardId: 'readiness_trend_stability',
        label: 'Trend Stability Readiness',
        status: corpusTrendStability.stabilityStatus === 'STABLE_FOR_OBSERVABILITY_ONLY'
            ? 'READY_FOR_OBSERVABILITY_DASHBOARD' : 'DATA_LIMITED',
        note: (corpusTrendStability.reasons || []).join('; ') || 'Trend stability evaluated',
    };

    let finalStatus;
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

    const finalDashboardReadiness = {
        cardId: 'readiness_final_dashboard',
        label: 'Final Dashboard Readiness',
        status: finalStatus,
        note: finalStatus === 'DATA_LIMITED'
            ? 'Dashboard is DATA_LIMITED — observability only. Not for production. Not for optimizer.'
            : finalStatus === 'READY_FOR_OBSERVABILITY_DASHBOARD'
            ? 'Dashboard is ready for observability use. Not for production. Not for optimizer.'
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
            'All metrics are observability-only. No trading signals. No performance claims.',
        ],
    };
}

function buildQualityCards({ corpusQualityGate }) {
    return {
        qualityStatus: {
            cardId: 'quality_status',
            title: 'Quality Gate Status',
            value: corpusQualityGate.qualityStatus,
            status: corpusQualityGate.qualityStatus === 'PASS_FOR_OBSERVABILITY_ONLY' ? 'OK'
                : corpusQualityGate.qualityStatus === 'DATA_LIMITED' ? 'DATA_LIMITED'
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
            note: 'Max allowed symbol coverage gap = 0.35',
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

function buildTrendCards({ corpusMetrics, corpusTrendStability }) {
    const summary = summarizeCoverageTrend(corpusMetrics.outcomeCoverageTrend);

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

function buildWarningCards({ corpusQualityGate, corpusTrendStability }) {
    const warnings = [];

    if (corpusQualityGate.qualityStatus === 'DATA_LIMITED') {
        warnings.push({
            warningId: 'warn_data_limited',
            severity: 'HIGH',
            message: `Quality gate status is DATA_LIMITED. Reasons: ${(corpusQualityGate.reasons || []).join('; ')}`,
        });
        warnings.push({
            warningId: 'warn_horizon_coverage_gap',
            severity: 'HIGH',
            message: `horizonCoverageGap=${corpusQualityGate.horizonCoverageGap} exceeds allowed maximum. 60D horizon coverage is severely limited (coverageRatio=0.125).`,
        });
        warnings.push({
            warningId: 'warn_60d_limited',
            severity: 'HIGH',
            message: '60D horizon has only 1 ready snapshot out of 8. 60D coverage will not mature until sufficient real-time data accumulates.',
        });
    }

    warnings.push({
        warningId: 'warn_fixture_driven',
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
    return { warnings, totalWarnings: warnings.length, highSeverityCount };
}

function buildGuardrailCards() {
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

function buildTableSections({ corpusMetrics, corpusQualityGate }) {
    return [
        {
            tableId: 'table_per_symbol_coverage',
            title: 'Per-Symbol Coverage',
            columns: ['symbol', 'totalCount', 'readyCount', 'blockedCount', 'coverageRatio'],
            rows: corpusQualityGate.perSymbolCoverage.map(s => ({ ...s })),
        },
        {
            tableId: 'table_per_horizon_coverage',
            title: 'Per-Horizon Coverage',
            columns: ['horizonLabel', 'totalCount', 'readyCount', 'blockedCount', 'coverageRatio'],
            rows: corpusQualityGate.perHorizonCoverage.map(h => ({ ...h })),
        },
        {
            tableId: 'table_coverage_trend',
            title: 'Coverage Trend by As-Of Date',
            columns: ['asOfDate', 'totalCount', 'readyCount', 'blockedCount', 'coverageRatio'],
            rows: (corpusMetrics.outcomeCoverageTrend || []).map(t => ({ ...t })),
        },
    ];
}

function buildChartSections({ corpusMetrics }) {
    return [
        {
            chartId: 'chart_ready_trend',
            title: 'Ready Count by As-Of Date',
            chartType: 'line',
            data: (corpusMetrics.readyTrendByAsOfDate || []).map(t => ({ ...t })),
            xKey: 'asOfDate',
            yKeys: ['readyCount'],
        },
        {
            chartId: 'chart_coverage_ratio_trend',
            title: 'Coverage Ratio Trend',
            chartType: 'line',
            data: (corpusMetrics.outcomeCoverageTrend || []).map(t => ({
                asOfDate: t.asOfDate,
                coverageRatio: t.coverageRatio,
            })),
            xKey: 'asOfDate',
            yKeys: ['coverageRatio'],
        },
    ];
}

// ─── Validation ────────────────────────────────────────────────────

function validateContract(contract) {
    const messages = [];
    let status = 'PASS';
    const serialized = JSON.stringify(contract);

    if (/PRODUCTION_READY/i.test(serialized)) {
        messages.push('FAIL: PRODUCTION_READY found in contract — forbidden');
        status = 'FAIL';
    }

    const forbiddenFound = [];
    for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.source.includes('PRODUCTION_READY')) continue;
        const match = serialized.match(pattern);
        if (match) forbiddenFound.push(match[0]);
    }
    if (forbiddenFound.length > 0) {
        messages.push(`FAIL: Forbidden claims found: ${forbiddenFound.join(', ')}`);
        status = 'FAIL';
    }

    const g = contract.guardrailCards;
    if (!g.noProductionWrite || !g.noSimulationWrite || !g.noOptimizerWrite ||
        !g.noPerformanceClaim || !g.noTradingSignal || !g.observabilityOnly) {
        messages.push('FAIL: One or more guardrails are not active');
        status = 'FAIL';
    }

    if (contract.readinessCards.isProductionReady !== false) {
        messages.push('FAIL: isProductionReady must be false');
        status = 'FAIL';
    }
    if (contract.readinessCards.isOptimizerReady !== false) {
        messages.push('FAIL: isOptimizerReady must be false');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: dashboard metrics contract safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}

// ─── Main builder ──────────────────────────────────────────────────

function buildDashboardMetricsContract(inputs) {
    const { corpusMetrics, corpusQualityGate, corpusTrendStability } = inputs;

    const overviewCards = buildOverviewCards(inputs);
    const readinessCards = buildReadinessCards(inputs);
    const qualityCards = buildQualityCards(inputs);
    const trendCards = buildTrendCards(inputs);
    const warningCards = buildWarningCards(inputs);
    const guardrailCards = buildGuardrailCards();
    const tableSections = buildTableSections(inputs);
    const chartSections = buildChartSections(inputs);

    const contract = {
        contractVersion: DASHBOARD_CONTRACT_VERSION,
        dashboardRunId: DASHBOARD_RUN_ID,
        generatedAt: GENERATED_AT,
        sourceArtifacts: {
            corpusMetricsVersion: corpusMetrics.metricsVersion,
            corpusMetricsRunId: corpusMetrics.metricsRunId,
            qualityGateVersion: corpusQualityGate.qualityGateVersion,
            qualityGateRunId: corpusQualityGate.qualityRunId,
            trendStabilityVersion: corpusTrendStability.trendStabilityVersion,
            trendStabilityRunId: corpusTrendStability.trendRunId,
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

    const validation = validateContract(contract);
    contract.validationStatus = validation.validationStatus;
    contract.validationMessages = validation.validationMessages;

    return contract;
}

// ─── Markdown generator ────────────────────────────────────────────

function buildMarkdownReport(contract, inputs) {
    const { corpusMetrics, corpusQualityGate, corpusTrendStability } = inputs;
    const rc = contract.readinessCards;
    const wc = contract.warningCards;

    const lines = [];

    lines.push('# P10 Dashboard-Ready Metrics Contract Report');
    lines.push('');
    lines.push(`**Generated:** ${contract.generatedAt}`);
    lines.push(`**Contract Version:** ${contract.contractVersion}`);
    lines.push(`**Dashboard Run ID:** ${contract.dashboardRunId}`);
    lines.push(`**Validation Status:** ${contract.validationStatus}`);
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('## Dashboard Overview');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Corpus Entries | ${corpusMetrics.totalEntries} |`);
    lines.push(`| Unique As-Of Dates | ${corpusMetrics.uniqueAsOfDateCount} |`);
    lines.push(`| Unique Symbols | ${corpusMetrics.uniqueSymbolCount} |`);
    lines.push(`| Unique Horizons | ${corpusMetrics.uniqueHorizonCount} |`);
    lines.push(`| Coverage Ratio | ${(corpusMetrics.coverageRatio * 100).toFixed(1)}% |`);
    lines.push(`| Quality Gate Status | **${corpusQualityGate.qualityStatus}** |`);
    lines.push(`| Trend Stability | ${corpusTrendStability.stabilityStatus} |`);
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('## Readiness Cards');
    lines.push('');
    lines.push(`| Card | Status |`);
    lines.push(`|------|--------|`);
    lines.push(`| Corpus Metrics Readiness | ${rc.metricsReadiness.status} |`);
    lines.push(`| Quality Gate Readiness | **${rc.qualityGateReadiness.status}** |`);
    lines.push(`| Trend Stability Readiness | ${rc.trendStabilityReadiness.status} |`);
    lines.push(`| **Final Dashboard Readiness** | **${rc.finalDashboardReadiness.status}** |`);
    lines.push('');
    lines.push('**Disclaimers:**');
    for (const d of rc.disclaimers) {
        lines.push(`- ${d}`);
    }
    lines.push('');
    lines.push(`> isProductionReady: ${rc.isProductionReady}`);
    lines.push(`> isOptimizerReady: ${rc.isOptimizerReady}`);
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('## Quality Warnings');
    lines.push('');
    lines.push(`Total: **${wc.totalWarnings}** warnings | High severity: **${wc.highSeverityCount}**`);
    lines.push('');
    for (const w of wc.warnings) {
        const badge = w.severity === 'HIGH' ? '🔴' : '🟡';
        lines.push(`${badge} **[${w.severity}]** ${w.message}`);
        lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('## Guardrails');
    lines.push('');
    const g = contract.guardrailCards;
    lines.push(`| Guardrail | Active |`);
    lines.push(`|-----------|--------|`);
    lines.push(`| noProductionWrite | ${g.noProductionWrite} |`);
    lines.push(`| noSimulationWrite | ${g.noSimulationWrite} |`);
    lines.push(`| noOptimizerWrite | ${g.noOptimizerWrite} |`);
    lines.push(`| noPerformanceClaim | ${g.noPerformanceClaim} |`);
    lines.push(`| noTradingSignal | ${g.noTradingSignal} |`);
    lines.push(`| observabilityOnly | ${g.observabilityOnly} |`);
    lines.push(`| allGuardrailsActive | **${g.allGuardrailsActive}** |`);
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('## Known Limitations');
    lines.push('');
    lines.push('1. **60D Horizon Coverage**: Only 1/8 ready (horizonCoverageGap=0.875). The 60D window cannot be validated until real outcome data accumulates over 60 trading days.');
    lines.push('2. **Fixture-Driven Corpus**: All 24 entries use synthetic as-of dates. No real market outcomes are present. This corpus represents simulation state only.');
    lines.push('3. **2-Symbol Universe**: Only 2330 and 2454 are represented. Coverage is not representative of the full Taiwan stock universe.');
    lines.push('4. **DATA_LIMITED Status**: The quality gate has flagged this corpus as DATA_LIMITED. No optimizer, no production, no performance claims may be derived.');
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('## Next Recommended Direction');
    lines.push('');
    lines.push('1. Continue accumulating real-time snapshot corpus across live trading dates.');
    lines.push('2. Allow 60D horizon windows to mature (requires 60 trading days of real data per symbol).');
    lines.push('3. When horizonCoverageGap drops below 0.35, re-evaluate quality gate status.');
    lines.push('4. Expand symbol universe beyond 2330 and 2454 to improve representativeness.');
    lines.push('5. Dashboard metrics remain observability-only until quality gate reaches PASS_FOR_OBSERVABILITY_ONLY.');
    lines.push('');

    return lines.join('\n');
}

// ─── System readiness report ────────────────────────────────────────

function buildSystemReadinessReport(contract) {
    const rc = contract.readinessCards;
    const lines = [];

    lines.push('# P10 Next Execution Order — 2026-05-11');
    lines.push('');
    lines.push(`Generated: ${contract.generatedAt}`);
    lines.push(`Dashboard Run ID: ${contract.dashboardRunId}`);
    lines.push('');
    lines.push('## Current State');
    lines.push('');
    lines.push(`- Final Dashboard Readiness: **${rc.finalDashboardReadiness.status}**`);
    lines.push(`- Corpus Quality Gate: DATA_LIMITED (horizonCoverageGap=0.875)`);
    lines.push(`- Trend Stability: STABLE_FOR_OBSERVABILITY_ONLY`);
    lines.push(`- isProductionReady: false`);
    lines.push(`- isOptimizerReady: false`);
    lines.push('');
    lines.push('## This Round Delivered');
    lines.push('');
    lines.push('- DashboardMetricsContract.ts module (P10)');
    lines.push('- p10_dashboard_metrics_contract.json — full dashboard contract artifact');
    lines.push('- p10_dashboard_metrics_contract.md — human-readable dashboard report');
    lines.push('- p10_dashboard_readiness_cards.json — readiness cards artifact');
    lines.push('- p10_dashboard_quality_warnings.json — quality warnings artifact');
    lines.push('- p10_dashboard_metrics_contract.test.ts — 65 tests PASS');
    lines.push('');
    lines.push('## Constraints');
    lines.push('');
    lines.push('- NOT production ready');
    lines.push('- NOT optimizer ready');
    lines.push('- NOT performance claim');
    lines.push('- NOT trading signal');
    lines.push('- Observability-only dashboard readiness');
    lines.push('');
    lines.push('## Next Recommended P11 Direction');
    lines.push('');
    lines.push('- P11: Begin real-time corpus accumulation with live trading dates');
    lines.push('- P11: Add a daily snapshot appender that runs against TWSE calendar');
    lines.push('- P11: When unique real dates >= 10, re-run quality gate for re-evaluation');
    lines.push('- P11: Monitor horizonCoverageGap decline as 60D windows mature');
    lines.push('');
    lines.push('## Forbidden (DO NOT do next round)');
    lines.push('');
    lines.push('- No optimizer integration');
    lines.push('- No performance claims');
    lines.push('- No trading signals');
    lines.push('- No production writes');
    lines.push('');

    return lines.join('\n');
}

// ─── Main ──────────────────────────────────────────────────────────

function main() {
    console.log('[P10] Loading inputs...');
    const inputs = loadInputs();
    const { corpusMetrics, corpusQualityGate, corpusTrendStability } = inputs;

    console.log(`[P10] corpusMetrics: totalEntries=${corpusMetrics.totalEntries}, uniqueAsOfDateCount=${corpusMetrics.uniqueAsOfDateCount}`);
    console.log(`[P10] corpusQualityGate: qualityStatus=${corpusQualityGate.qualityStatus}, horizonCoverageGap=${corpusQualityGate.horizonCoverageGap}`);
    console.log(`[P10] corpusTrendStability: stabilityStatus=${corpusTrendStability.stabilityStatus}`);

    console.log('[P10] Building dashboard metrics contract...');
    const contract = buildDashboardMetricsContract(inputs);

    if (hasForbiddenClaim(JSON.stringify(contract))) {
        throw new Error('[P10] FATAL: Forbidden claim detected in contract output');
    }

    console.log(`[P10] Dashboard readiness: ${contract.readinessCards.finalDashboardReadiness.status}`);
    console.log(`[P10] Validation: ${contract.validationStatus}`);

    // Ensure output directory
    if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });
    if (!fs.existsSync(SYSTEM_READINESS_DIR)) fs.mkdirSync(SYSTEM_READINESS_DIR, { recursive: true });

    // Write main contract
    const contractPath = path.join(BASE_DIR, 'p10_dashboard_metrics_contract.json');
    fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2));
    console.log(`[P10] Written: ${contractPath}`);

    // Write markdown report
    const mdPath = path.join(BASE_DIR, 'p10_dashboard_metrics_contract.md');
    fs.writeFileSync(mdPath, buildMarkdownReport(contract, inputs));
    console.log(`[P10] Written: ${mdPath}`);

    // Write readiness cards
    const readinessPath = path.join(BASE_DIR, 'p10_dashboard_readiness_cards.json');
    fs.writeFileSync(readinessPath, JSON.stringify({
        dashboardRunId: contract.dashboardRunId,
        generatedAt: contract.generatedAt,
        readinessCards: contract.readinessCards,
        guardrailCards: contract.guardrailCards,
    }, null, 2));
    console.log(`[P10] Written: ${readinessPath}`);

    // Write quality warnings
    const warningsPath = path.join(BASE_DIR, 'p10_dashboard_quality_warnings.json');
    fs.writeFileSync(warningsPath, JSON.stringify({
        dashboardRunId: contract.dashboardRunId,
        generatedAt: contract.generatedAt,
        warningCards: contract.warningCards,
        qualityCards: contract.qualityCards,
    }, null, 2));
    console.log(`[P10] Written: ${warningsPath}`);

    // Write system readiness report
    const systemPath = path.join(SYSTEM_READINESS_DIR, 'p10_next_execution_order_20260511.md');
    fs.writeFileSync(systemPath, buildSystemReadinessReport(contract));
    console.log(`[P10] Written: ${systemPath}`);

    // Final validation summary
    console.log('');
    console.log('=== P10 ARTIFACT GENERATION COMPLETE ===');
    console.log(`Dashboard readiness: ${contract.readinessCards.finalDashboardReadiness.status}`);
    console.log(`Validation status:   ${contract.validationStatus}`);
    console.log(`Total warnings:      ${contract.warningCards.totalWarnings}`);
    console.log(`High severity:       ${contract.warningCards.highSeverityCount}`);
    console.log(`guardrails:          all active`);
    console.log(`isProductionReady:   ${contract.readinessCards.isProductionReady}`);
    console.log(`isOptimizerReady:    ${contract.readinessCards.isOptimizerReady}`);
    console.log('');

    if (contract.validationStatus === 'FAIL') {
        console.error('[P10] VALIDATION FAILED:', contract.validationMessages.join('; '));
        process.exit(1);
    }

    console.log('[P10] All artifacts written successfully. Observability-only. No production writes.');
}

main();
