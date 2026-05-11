/**
 * p10_dashboard_metrics_contract.test.ts
 *
 * Tests for DashboardMetricsContract — P10 Online Validation
 */

import {
    buildDashboardMetricsContract,
    buildOverviewCards,
    buildReadinessCards,
    buildQualityCards,
    buildTrendCards,
    buildWarningCards,
    buildGuardrailCards,
    validateDashboardMetricsContract,
    DASHBOARD_CONTRACT_VERSION,
    type DashboardMetricsContractInput,
    type DashboardMetricsContract,
} from '../DashboardMetricsContract';

import type { CorpusMetrics } from '../CorpusMetricsStore';
import type { CorpusQualityGateResult } from '../CorpusQualityGate';
import type { CorpusTrendStabilityResult } from '../CorpusTrendStability';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_CORPUS_METRICS: CorpusMetrics = {
    metricsVersion: 'corpus-metrics-v0',
    metricsRunId: 'test-metrics-run-001',
    generatedAt: '2026-05-11T06:00:00.000Z',
    corpusPath: '/outputs/online_validation/simulation_snapshot_corpus.jsonl',
    totalEntries: 24,
    readyCount: 14,
    blockedCount: 10,
    uniqueAsOfDateCount: 4,
    uniqueSymbolCount: 2,
    uniqueHorizonCount: 3,
    coverageRatio: 0.5833,
    byAsOfDate: { '2026-05-11': 6, '2026-05-12': 6, '2026-05-13': 6, '2026-05-14': 6 },
    bySymbol: { '2330': 12, '2454': 12 },
    byHorizon: { '5D': 8, '20D': 8, '60D': 8 },
    bySnapshotStatus: { SNAPSHOT_READY: 14, SNAPSHOT_BLOCKED: 10 },
    byBlockedReason: { NONE: 14, WINDOW_NOT_DUE: 7, OUTCOME_MISSING: 3 },
    perSymbolObservationCount: { '2330': 12, '2454': 12 },
    perHorizonObservationCount: { '5D': 8, '20D': 8, '60D': 8 },
    outcomeCoverageTrend: [
        { asOfDate: '2026-05-11', totalCount: 6, readyCount: 3, blockedCount: 3, coverageRatio: 0.5, missingOutcomeCount: 3, notDueCount: 2 },
        { asOfDate: '2026-05-12', totalCount: 6, readyCount: 3, blockedCount: 3, coverageRatio: 0.5, missingOutcomeCount: 3, notDueCount: 2 },
        { asOfDate: '2026-05-13', totalCount: 6, readyCount: 4, blockedCount: 2, coverageRatio: 0.6667, missingOutcomeCount: 2, notDueCount: 1 },
        { asOfDate: '2026-05-14', totalCount: 6, readyCount: 4, blockedCount: 2, coverageRatio: 0.6667, missingOutcomeCount: 2, notDueCount: 2 },
    ],
    readyTrendByAsOfDate: [
        { asOfDate: '2026-05-11', readyCount: 3 },
        { asOfDate: '2026-05-12', readyCount: 3 },
        { asOfDate: '2026-05-13', readyCount: 4 },
        { asOfDate: '2026-05-14', readyCount: 4 },
    ],
    blockedTrendByAsOfDate: [
        { asOfDate: '2026-05-11', blockedCount: 3 },
        { asOfDate: '2026-05-12', blockedCount: 3 },
        { asOfDate: '2026-05-13', blockedCount: 2 },
        { asOfDate: '2026-05-14', blockedCount: 2 },
    ],
    dataQualityFlags: ['NON_EMPTY_CORPUS', 'MULTI_DATE_CORPUS', 'OBSERVABILITY_ONLY_METRICS'],
    guardrails: {
        noProductionWrite: true,
        noSimulationWrite: true,
        noOptimizerWrite: true,
        noPerformanceClaim: true,
        noTradingSignal: true,
    },
    validationStatus: 'PASS',
    validationMessages: ['PASS: corpus metrics safety contracts verified'],
};

const MOCK_QUALITY_GATE_DATA_LIMITED: CorpusQualityGateResult = {
    qualityGateVersion: 'corpus-quality-gate-v0',
    qualityRunId: 'test-quality-gate-001',
    generatedAt: '2026-05-11T06:00:00.000Z',
    inputTotalEntries: 24,
    inputAsOfDateCount: 4,
    inputSymbolCount: 2,
    inputHorizonCount: 3,
    coverageRatio: 0.5833,
    perSymbolCoverage: [
        { symbol: '2330', totalCount: 12, readyCount: 9, blockedCount: 3, coverageRatio: 0.75 },
        { symbol: '2454', totalCount: 12, readyCount: 5, blockedCount: 7, coverageRatio: 0.4167 },
    ],
    perHorizonCoverage: [
        { horizonLabel: '5D', totalCount: 8, readyCount: 8, blockedCount: 0, coverageRatio: 1 },
        { horizonLabel: '20D', totalCount: 8, readyCount: 5, blockedCount: 3, coverageRatio: 0.625 },
        { horizonLabel: '60D', totalCount: 8, readyCount: 1, blockedCount: 7, coverageRatio: 0.125 },
    ],
    symbolCoverageGap: 0.3333,
    horizonCoverageGap: 0.875,
    qualityChecks: {
        hasEnoughDates: true,
        hasEnoughSymbols: true,
        hasEnoughHorizons: true,
        coverageMeetsThreshold: true,
        symbolCoverageGapWithinLimit: true,
        horizonCoverageGapWithinLimit: false,
        noProductionWrite: true,
        noSimulationWrite: true,
        noOptimizerWrite: true,
        noPerformanceClaim: true,
        noTradingSignal: true,
    },
    qualityStatus: 'DATA_LIMITED',
    reasons: ['horizonCoverageGap=0.875 > maxHorizonCoverageGap=0.35 => DATA_LIMITED'],
    validationStatus: 'PASS',
    validationMessages: ['PASS: corpus quality gate safety contracts verified'],
};

const MOCK_QUALITY_GATE_PASS: CorpusQualityGateResult = {
    ...MOCK_QUALITY_GATE_DATA_LIMITED,
    qualityRunId: 'test-quality-gate-pass-001',
    horizonCoverageGap: 0.1,
    qualityChecks: { ...MOCK_QUALITY_GATE_DATA_LIMITED.qualityChecks, horizonCoverageGapWithinLimit: true },
    qualityStatus: 'PASS_FOR_OBSERVABILITY_ONLY',
    reasons: [],
};

const MOCK_TREND_STABILITY: CorpusTrendStabilityResult = {
    trendStabilityVersion: 'corpus-trend-stability-v0',
    trendRunId: 'test-trend-stability-001',
    generatedAt: '2026-05-11T06:00:00.000Z',
    inputAsOfDateCount: 3,
    inputTotalEntries: 18,
    coverageTrend: [
        { asOfDate: '2026-05-11', totalCount: 6, readyCount: 3, blockedCount: 3, coverageRatio: 0.5, missingOutcomeCount: 1, notDueCount: 2 },
        { asOfDate: '2026-05-12', totalCount: 6, readyCount: 3, blockedCount: 3, coverageRatio: 0.5, missingOutcomeCount: 1, notDueCount: 2 },
        { asOfDate: '2026-05-13', totalCount: 6, readyCount: 4, blockedCount: 2, coverageRatio: 0.6667, missingOutcomeCount: 1, notDueCount: 1 },
    ],
    readyTrendByAsOfDate: [
        { asOfDate: '2026-05-11', readyCount: 3 },
        { asOfDate: '2026-05-12', readyCount: 3 },
        { asOfDate: '2026-05-13', readyCount: 4 },
    ],
    blockedTrendByAsOfDate: [
        { asOfDate: '2026-05-11', blockedCount: 3 },
        { asOfDate: '2026-05-12', blockedCount: 3 },
        { asOfDate: '2026-05-13', blockedCount: 2 },
    ],
    stabilityChecks: {
        hasEnoughDates: true,
        coverageDropWithinLimit: true,
        averageCoverageMeetsThreshold: true,
        noProductionWrite: true,
        noSimulationWrite: true,
        noOptimizerWrite: true,
        noPerformanceClaim: true,
        noTradingSignal: true,
    },
    stabilityStatus: 'STABLE_FOR_OBSERVABILITY_ONLY',
    reasons: ['hasEnoughDates=true coverageDropWithinLimit=true', 'Observability-only stability'],
    validationStatus: 'PASS',
    validationMessages: ['PASS: corpus trend stability safety contracts verified'],
};

const DATA_LIMITED_INPUT: DashboardMetricsContractInput = {
    corpusMetrics: MOCK_CORPUS_METRICS,
    corpusQualityGate: MOCK_QUALITY_GATE_DATA_LIMITED,
    corpusTrendStability: MOCK_TREND_STABILITY,
};

const PASS_INPUT: DashboardMetricsContractInput = {
    ...DATA_LIMITED_INPUT,
    corpusQualityGate: MOCK_QUALITY_GATE_PASS,
};

const DEFAULT_OPTIONS = {
    dashboardRunId: 'p10-test-run-001',
    generatedAt: '2026-05-11T06:00:00.000Z',
    contractVersion: DASHBOARD_CONTRACT_VERSION,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildOverviewCards', () => {
    it('includes totalEntries', () => {
        const cards = buildOverviewCards(DATA_LIMITED_INPUT);
        expect(cards.totalEntries.value).toBe(24);
        expect(cards.totalEntries.cardId).toBe('overview_total_entries');
    });

    it('includes uniqueAsOfDateCount', () => {
        const cards = buildOverviewCards(DATA_LIMITED_INPUT);
        expect(cards.uniqueAsOfDateCount.value).toBe(4);
        expect(cards.uniqueAsOfDateCount.cardId).toBe('overview_unique_as_of_date_count');
    });

    it('includes uniqueSymbolCount', () => {
        const cards = buildOverviewCards(DATA_LIMITED_INPUT);
        expect(cards.uniqueSymbolCount.value).toBe(2);
        expect(cards.uniqueSymbolCount.cardId).toBe('overview_unique_symbol_count');
    });

    it('includes uniqueHorizonCount', () => {
        const cards = buildOverviewCards(DATA_LIMITED_INPUT);
        expect(cards.uniqueHorizonCount.value).toBe(3);
        expect(cards.uniqueHorizonCount.cardId).toBe('overview_unique_horizon_count');
    });

    it('includes coverageRatio', () => {
        const cards = buildOverviewCards(DATA_LIMITED_INPUT);
        expect(typeof cards.coverageRatio.value).toBe('number');
        expect(cards.coverageRatio.value).toBeGreaterThan(0);
    });

    it('includes qualityStatus', () => {
        const cards = buildOverviewCards(DATA_LIMITED_INPUT);
        expect(cards.qualityStatus.value).toBe('DATA_LIMITED');
    });

    it('includes trendStabilityStatus', () => {
        const cards = buildOverviewCards(DATA_LIMITED_INPUT);
        expect(cards.trendStabilityStatus.value).toBe('STABLE_FOR_OBSERVABILITY_ONLY');
    });

    it('sets qualityStatus card to DATA_LIMITED when gate is DATA_LIMITED', () => {
        const cards = buildOverviewCards(DATA_LIMITED_INPUT);
        expect(cards.qualityStatus.status).toBe('DATA_LIMITED');
    });
});

describe('buildReadinessCards — DATA_LIMITED preservation', () => {
    it('preserves DATA_LIMITED when quality gate is DATA_LIMITED', () => {
        const cards = buildReadinessCards(DATA_LIMITED_INPUT);
        expect(cards.finalDashboardReadiness.status).toBe('DATA_LIMITED');
    });

    it('does not output PRODUCTION_READY', () => {
        const cards = buildReadinessCards(DATA_LIMITED_INPUT);
        expect(cards.finalDashboardReadiness.status).not.toBe('PRODUCTION_READY');
        expect(JSON.stringify(cards)).not.toMatch(/PRODUCTION_READY/);
    });

    it('isProductionReady is always false', () => {
        const cardsDataLimited = buildReadinessCards(DATA_LIMITED_INPUT);
        const cardsPass = buildReadinessCards(PASS_INPUT);
        expect(cardsDataLimited.isProductionReady).toBe(false);
        expect(cardsPass.isProductionReady).toBe(false);
    });

    it('isOptimizerReady is always false', () => {
        const cardsDataLimited = buildReadinessCards(DATA_LIMITED_INPUT);
        const cardsPass = buildReadinessCards(PASS_INPUT);
        expect(cardsDataLimited.isOptimizerReady).toBe(false);
        expect(cardsPass.isOptimizerReady).toBe(false);
    });

    it('includes disclaimers that dashboard readiness does not imply production readiness', () => {
        const cards = buildReadinessCards(DATA_LIMITED_INPUT);
        const disclaimerText = cards.disclaimers.join(' ');
        expect(disclaimerText).toMatch(/production readiness/i);
    });

    it('includes disclaimers that dashboard readiness does not imply optimizer readiness', () => {
        const cards = buildReadinessCards(DATA_LIMITED_INPUT);
        const disclaimerText = cards.disclaimers.join(' ');
        expect(disclaimerText).toMatch(/optimizer readiness/i);
    });

    it('produces READY_FOR_OBSERVABILITY_DASHBOARD when quality gate passes', () => {
        const cards = buildReadinessCards(PASS_INPUT);
        expect(cards.finalDashboardReadiness.status).toBe('READY_FOR_OBSERVABILITY_DASHBOARD');
    });

    it('qualityGateReadiness is DATA_LIMITED when gate is DATA_LIMITED', () => {
        const cards = buildReadinessCards(DATA_LIMITED_INPUT);
        expect(cards.qualityGateReadiness.status).toBe('DATA_LIMITED');
    });
});

describe('buildWarningCards', () => {
    it('includes horizonCoverageGap warning', () => {
        const cards = buildWarningCards(DATA_LIMITED_INPUT);
        const warningText = cards.warnings.map(w => w.message).join(' ');
        expect(warningText).toMatch(/horizonCoverageGap/);
    });

    it('includes 60D coverage limitation warning', () => {
        const cards = buildWarningCards(DATA_LIMITED_INPUT);
        const warningText = cards.warnings.map(w => w.message).join(' ');
        expect(warningText).toMatch(/60D/);
    });

    it('includes fixture-driven corpus warning', () => {
        const cards = buildWarningCards(DATA_LIMITED_INPUT);
        const warningText = cards.warnings.map(w => w.message).join(' ');
        expect(warningText).toMatch(/fixture.driven|synthetic/i);
    });

    it('includes not production readiness warning', () => {
        const cards = buildWarningCards(DATA_LIMITED_INPUT);
        const warningText = cards.warnings.map(w => w.message).join(' ');
        expect(warningText).toMatch(/production readiness/i);
    });

    it('includes not optimizer readiness warning', () => {
        const cards = buildWarningCards(DATA_LIMITED_INPUT);
        const warningText = cards.warnings.map(w => w.message).join(' ');
        expect(warningText).toMatch(/optimizer readiness/i);
    });

    it('has high severity warnings when DATA_LIMITED', () => {
        const cards = buildWarningCards(DATA_LIMITED_INPUT);
        expect(cards.highSeverityCount).toBeGreaterThan(0);
    });

    it('always includes fixture warning even when quality gate passes', () => {
        const cards = buildWarningCards(PASS_INPUT);
        const warningText = cards.warnings.map(w => w.message).join(' ');
        expect(warningText).toMatch(/fixture.driven|synthetic/i);
    });

    it('totalWarnings is positive', () => {
        const cards = buildWarningCards(DATA_LIMITED_INPUT);
        expect(cards.totalWarnings).toBeGreaterThan(0);
    });
});

describe('buildGuardrailCards', () => {
    it('noProductionWrite is true', () => {
        const cards = buildGuardrailCards();
        expect(cards.noProductionWrite).toBe(true);
    });

    it('noSimulationWrite is true', () => {
        const cards = buildGuardrailCards();
        expect(cards.noSimulationWrite).toBe(true);
    });

    it('noOptimizerWrite is true', () => {
        const cards = buildGuardrailCards();
        expect(cards.noOptimizerWrite).toBe(true);
    });

    it('noPerformanceClaim is true', () => {
        const cards = buildGuardrailCards();
        expect(cards.noPerformanceClaim).toBe(true);
    });

    it('noTradingSignal is true', () => {
        const cards = buildGuardrailCards();
        expect(cards.noTradingSignal).toBe(true);
    });

    it('observabilityOnly is true', () => {
        const cards = buildGuardrailCards();
        expect(cards.observabilityOnly).toBe(true);
    });

    it('allGuardrailsActive is true', () => {
        const cards = buildGuardrailCards();
        expect(cards.allGuardrailsActive).toBe(true);
    });
});

describe('validateDashboardMetricsContract', () => {
    it('PASS: valid contract passes validation', () => {
        const contract = buildDashboardMetricsContract(DATA_LIMITED_INPUT, DEFAULT_OPTIONS);
        const result = validateDashboardMetricsContract(contract);
        expect(result.validationStatus).toBe('PASS');
    });

    it('FAIL: PRODUCTION_READY in contract is rejected', () => {
        const contract = buildDashboardMetricsContract(DATA_LIMITED_INPUT, DEFAULT_OPTIONS);
        // Manually inject forbidden status
        (contract.readinessCards.finalDashboardReadiness as any).status = 'PRODUCTION_READY';
        const result = validateDashboardMetricsContract(contract);
        expect(result.validationStatus).toBe('FAIL');
        expect(result.validationMessages.join(' ')).toMatch(/PRODUCTION_READY/);
    });

    it('FAIL: disabled guardrail is rejected', () => {
        const contract = buildDashboardMetricsContract(DATA_LIMITED_INPUT, DEFAULT_OPTIONS);
        (contract.guardrailCards as any).noProductionWrite = false;
        const result = validateDashboardMetricsContract(contract);
        expect(result.validationStatus).toBe('FAIL');
        expect(result.validationMessages.join(' ')).toMatch(/guardrail/i);
    });

    it('contract JSON is parseable', () => {
        const contract = buildDashboardMetricsContract(DATA_LIMITED_INPUT, DEFAULT_OPTIONS);
        expect(() => JSON.parse(JSON.stringify(contract))).not.toThrow();
    });

    it('dashboard readiness does not imply production readiness', () => {
        const contract = buildDashboardMetricsContract(DATA_LIMITED_INPUT, DEFAULT_OPTIONS);
        expect(contract.readinessCards.isProductionReady).toBe(false);
        const serialized = JSON.stringify(contract);
        expect(serialized).not.toMatch(/PRODUCTION_READY/);
    });
});

describe('buildDashboardMetricsContract — full contract', () => {
    let contract: DashboardMetricsContract;

    beforeEach(() => {
        contract = buildDashboardMetricsContract(DATA_LIMITED_INPUT, DEFAULT_OPTIONS);
    });

    it('has correct contractVersion', () => {
        expect(contract.contractVersion).toBe(DASHBOARD_CONTRACT_VERSION);
    });

    it('has dashboardRunId', () => {
        expect(contract.dashboardRunId).toBe('p10-test-run-001');
    });

    it('has generatedAt', () => {
        expect(contract.generatedAt).toBe('2026-05-11T06:00:00.000Z');
    });

    it('sourceArtifacts references both metrics and quality gate run IDs', () => {
        expect(contract.sourceArtifacts.corpusMetricsRunId).toBe('test-metrics-run-001');
        expect(contract.sourceArtifacts.qualityGateRunId).toBe('test-quality-gate-001');
    });

    it('validationStatus is PASS', () => {
        expect(contract.validationStatus).toBe('PASS');
    });

    it('tableSections is non-empty', () => {
        expect(contract.tableSections.length).toBeGreaterThan(0);
    });

    it('chartSections is non-empty', () => {
        expect(contract.chartSections.length).toBeGreaterThan(0);
    });

    it('overviewCards has 7 fields', () => {
        const keys = Object.keys(contract.overviewCards);
        expect(keys).toContain('totalEntries');
        expect(keys).toContain('uniqueAsOfDateCount');
        expect(keys).toContain('uniqueSymbolCount');
        expect(keys).toContain('uniqueHorizonCount');
        expect(keys).toContain('coverageRatio');
        expect(keys).toContain('qualityStatus');
        expect(keys).toContain('trendStabilityStatus');
    });

    it('is deterministic — same input produces same output', () => {
        const contract2 = buildDashboardMetricsContract(DATA_LIMITED_INPUT, DEFAULT_OPTIONS);
        expect(JSON.stringify(contract)).toBe(JSON.stringify(contract2));
    });

    it('does not contain any forbidden claim: profit', () => {
        expect(JSON.stringify(contract)).not.toMatch(/\bprofit\b/i);
    });

    it('does not contain any forbidden claim: guaranteed', () => {
        expect(JSON.stringify(contract)).not.toMatch(/\bguaranteed\b/i);
    });

    it('does not contain any forbidden claim: edge confirmed', () => {
        expect(JSON.stringify(contract)).not.toMatch(/edge confirmed/i);
    });

    it('does not contain any forbidden claim: auto trading', () => {
        expect(JSON.stringify(contract)).not.toMatch(/auto trading/i);
    });

    it('does not contain any forbidden claim: outperform', () => {
        expect(JSON.stringify(contract)).not.toMatch(/\boutperform\b/i);
    });

    it('does not contain any forbidden claim: expected_return', () => {
        expect(JSON.stringify(contract)).not.toMatch(/expected_return/i);
    });

    it('does not contain any forbidden claim: strategy performance', () => {
        expect(JSON.stringify(contract)).not.toMatch(/strategy performance/i);
    });
});

describe('buildQualityCards', () => {
    it('includes qualityStatus', () => {
        const cards = buildQualityCards(DATA_LIMITED_INPUT);
        expect(cards.qualityStatus.value).toBe('DATA_LIMITED');
    });

    it('includes coverageRatio', () => {
        const cards = buildQualityCards(DATA_LIMITED_INPUT);
        expect(typeof cards.coverageRatio.value).toBe('number');
    });

    it('includes symbolCoverageGap', () => {
        const cards = buildQualityCards(DATA_LIMITED_INPUT);
        expect(cards.symbolCoverageGap.value).toBe(0.3333);
    });

    it('includes horizonCoverageGap', () => {
        const cards = buildQualityCards(DATA_LIMITED_INPUT);
        expect(cards.horizonCoverageGap.value).toBe(0.875);
    });

    it('includes perSymbolCoverage summary', () => {
        const cards = buildQualityCards(DATA_LIMITED_INPUT);
        expect(cards.perSymbolCoverage.length).toBe(2);
        expect(cards.perSymbolCoverage[0].symbol).toBe('2330');
    });

    it('includes perHorizonCoverage summary', () => {
        const cards = buildQualityCards(DATA_LIMITED_INPUT);
        expect(cards.perHorizonCoverage.length).toBe(3);
        const labels = cards.perHorizonCoverage.map(h => h.horizonLabel);
        expect(labels).toContain('5D');
        expect(labels).toContain('20D');
        expect(labels).toContain('60D');
    });

    it('includes validationStatus', () => {
        const cards = buildQualityCards(DATA_LIMITED_INPUT);
        expect(cards.validationStatus.value).toBe('PASS');
    });
});

describe('buildTrendCards', () => {
    it('includes trend stability status', () => {
        const cards = buildTrendCards(DATA_LIMITED_INPUT);
        expect(cards.stabilityStatus.value).toBe('STABLE_FOR_OBSERVABILITY_ONLY');
    });

    it('includes averageCoverageRatio', () => {
        const cards = buildTrendCards(DATA_LIMITED_INPUT);
        expect(typeof cards.averageCoverageRatio.value).toBe('number');
        expect(cards.averageCoverageRatio.value).toBeGreaterThan(0);
    });

    it('includes largestCoverageDrop', () => {
        const cards = buildTrendCards(DATA_LIMITED_INPUT);
        expect(typeof cards.largestCoverageDrop.value).toBe('number');
    });

    it('includes dateCount', () => {
        const cards = buildTrendCards(DATA_LIMITED_INPUT);
        expect(cards.dateCount.value).toBe(4);
    });

    it('includes stability checks', () => {
        const cards = buildTrendCards(DATA_LIMITED_INPUT);
        expect(cards.stabilityChecks).toHaveProperty('hasEnoughDates');
        expect(cards.stabilityChecks).toHaveProperty('coverageDropWithinLimit');
    });

    it('includes validationStatus', () => {
        const cards = buildTrendCards(DATA_LIMITED_INPUT);
        expect(cards.validationStatus.value).toBe('PASS');
    });
});
