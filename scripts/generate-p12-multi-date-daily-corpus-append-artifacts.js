#!/usr/bin/env node
/**
 * generate-p12-multi-date-daily-corpus-append-artifacts.js
 *
 * P12 multi-date real-market snapshot corpus continuation generator.
 *
 * SAFETY CONTRACT:
 * - research mode only — dry-run append only
 * - no production DB write — no external API — no LLM
 * - no optimizer write — no auto trading — no performance claim
 */

'use strict';

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true,
});

require('ts-node/register/transpile-only');
require('tsconfig-paths/register');

const fs = require('fs');
const path = require('path');

const {
    buildMultiDateDailyAppendPlan,
} = require('../src/lib/onlineValidation/MultiDateDailyAppendPlan');
const {
    executeMultiDateDailyAppendDryRun,
    validateMultiDateDailyAppendDryRunResult,
} = require('../src/lib/onlineValidation/MultiDateDailyAppendExecutor');
const {
    parseSnapshotCorpusJsonl,
    buildSnapshotCorpusPath,
} = require('../src/lib/onlineValidation/SimulationSnapshotCorpusAccumulator');
const {
    buildCorpusMetrics,
} = require('../src/lib/onlineValidation/CorpusMetricsStore');
const {
    buildCorpusQualityGate,
} = require('../src/lib/onlineValidation/CorpusQualityGate');
const {
    buildCorpusTrendStability,
} = require('../src/lib/onlineValidation/CorpusTrendStability');
const {
    buildDashboardMetricsContract,
} = require('../src/lib/onlineValidation/DashboardMetricsContract');

const BASE_DIR = path.resolve(__dirname, '../outputs/online_validation');
const SYSTEM_READINESS_DIR = path.resolve(__dirname, '../outputs/system_readiness');
const CORPUS_PATH = buildSnapshotCorpusPath({ baseDir: BASE_DIR });

const AS_OF_DATES = [
    '2026-05-18',
    '2026-05-19',
    '2026-05-20',
    '2026-05-21',
    '2026-05-22',
];

const REVIEW_DATE_BY_AS_OF_DATE = {
    '2026-05-18': '2026-07-07',
    '2026-05-19': '2026-07-08',
    '2026-05-20': '2026-07-09',
    '2026-05-21': '2026-07-10',
    '2026-05-22': '2026-07-13',
};

const PLAN_RUN_ID = 'p12-multi-date-daily-append-plan-20260511-001';
const DASHBOARD_RUN_ID = 'p12-dashboard-metrics-20260511-001';
const METRICS_RUN_ID = 'p12-corpus-metrics-20260511-001';
const QUALITY_RUN_ID = 'p12-corpus-quality-20260511-001';
const TREND_RUN_ID = 'p12-corpus-trend-20260511-001';

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function writeText(filePath, text) {
    fs.writeFileSync(filePath, text, 'utf8');
}

function loadCorpusEntries() {
    const content = fs.existsSync(CORPUS_PATH) ? fs.readFileSync(CORPUS_PATH, 'utf8') : '';
    return content.trim() ? parseSnapshotCorpusJsonl(content) : [];
}

function buildResultMarkdown(plan, result, metrics, qualityGate, dashboardContract) {
    return [
        '# P12 Multi-Date Daily Corpus Append Result',
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Scope',
        '',
        '- P12 multi-date real-market snapshot corpus continuation',
        '- research mode only',
        '- dry-run append only',
        '- no production DB write',
        '- no optimizer write',
        '- no live execution',
        '- no performance claim',
        '',
        '## Plan',
        '',
        `- planRunId: ${plan.planRunId}`,
        `- asOfDateCount: ${plan.asOfDateCount}`,
        `- expectedSnapshotCount: ${plan.expectedSnapshotCount}`,
        `- sourceMode: ${plan.sourceMode}`,
        '',
        '## Batch Result',
        '',
        `- requestedDateCount: ${result.requestedDateCount}`,
        `- successfulDateCount: ${result.successfulDateCount}`,
        `- blockedDateCount: ${result.blockedDateCount}`,
        `- failedDateCount: ${result.failedDateCount}`,
        `- totalIncomingSnapshots: ${result.totalIncomingSnapshots}`,
        `- totalAppendedSnapshots: ${result.totalAppendedSnapshots}`,
        `- beforeCorpusCount: ${result.beforeCorpusCount}`,
        `- afterCorpusCount: ${result.afterCorpusCount}`,
        `- beforeUniqueAsOfDateCount: ${result.beforeUniqueAsOfDateCount}`,
        `- afterUniqueAsOfDateCount: ${result.afterUniqueAsOfDateCount}`,
        `- validationStatus: ${result.validationStatus}`,
        '',
        '## Date Results',
        '',
        '| asOfDate | previewStatus | appendStatus | incoming | appended | duplicateKeys |',
        '|---|---|---|---:|---:|---:|',
        ...result.dateResults.map(row =>
            `| ${row.asOfDate} | ${row.previewStatus} | ${row.appendStatus} | ${row.incomingCount} | ${row.appendedCount} | ${row.duplicateKeyCount} |`,
        ),
        '',
        '## Quality Refresh',
        '',
        `- qualityStatus: ${qualityGate.qualityStatus}`,
        `- coverageRatio: ${qualityGate.coverageRatio}`,
        `- horizonCoverageGap: ${qualityGate.horizonCoverageGap}`,
        `- symbolCoverageGap: ${qualityGate.symbolCoverageGap}`,
        `- uniqueAsOfDateCount: ${metrics.uniqueAsOfDateCount}`,
        `- totalEntries: ${metrics.totalEntries}`,
        '',
        '## Dashboard Refresh',
        '',
        `- finalDashboardReadiness: ${dashboardContract.readinessCards.finalDashboardReadiness.status}`,
        `- dashboard validation: ${dashboardContract.validationStatus}`,
        `- warnings: ${dashboardContract.warningCards.totalWarnings}`,
        '',
        '## Guardrails',
        '',
        `- noProductionWrite: ${result.guardrails.noProductionWrite}`,
        `- noDbWrite: ${result.guardrails.noDbWrite}`,
        `- noExternalApi: ${result.guardrails.noExternalApi}`,
        `- noLlm: ${result.guardrails.noLlm}`,
        `- noOptimizerWrite: ${result.guardrails.noOptimizerWrite}`,
        `- noAutoTrading: ${result.guardrails.noAutoTrading}`,
        `- noPerformanceClaim: ${result.guardrails.noPerformanceClaim}`,
        `- observabilityOnly: ${result.guardrails.observabilityOnly}`,
        '',
        '## Notes',
        '',
        '- duplicate protection remains active on re-run',
        '- write locks remain false across the corpus',
        '- this output is not production-ready and not an optimizer input',
    ].join('\n');
}

function buildSystemReadinessMarkdown(plan, result, metrics, qualityGate, dashboardContract) {
    return [
        '# P12 Next Execution Order — 2026-05-11',
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Current State',
        '',
        `- corpus entries: ${result.afterCorpusCount}`,
        `- unique as-of dates: ${result.afterUniqueAsOfDateCount}`,
        `- qualityStatus: ${qualityGate.qualityStatus}`,
        `- dashboard readiness: ${dashboardContract.readinessCards.finalDashboardReadiness.status}`,
        '',
        '## Delivered',
        '',
        '- MultiDateDailyAppendPlan',
        '- MultiDateDailyAppendExecutor',
        '- refreshed corpus metrics',
        '- refreshed quality gate',
        '- refreshed dashboard contract',
        '',
        '## Constraints',
        '',
        '- no production DB write',
        '- no optimizer write',
        '- no live execution',
        '- no performance claim',
        '- duplicate append protection enforced',
        '',
        '## Next Recommended Direction',
        '',
        '- improve horizon maturity coverage so 60D can move past blocked-only fixtures',
        '- continue observability-only corpus continuation',
        '- keep corpus append-only and audit-friendly',
        '',
        `Plan run: ${plan.planRunId}`,
    ].join('\n');
}

function main() {
    ensureDir(BASE_DIR);
    ensureDir(SYSTEM_READINESS_DIR);

    console.log('[P12] Building multi-date append plan...');
    const plan = buildMultiDateDailyAppendPlan({
        planRunId: PLAN_RUN_ID,
        asOfDates: AS_OF_DATES,
        reviewDateByAsOfDate: REVIEW_DATE_BY_AS_OF_DATE,
        sourceMode: 'EXISTING_LOCAL_DATA_ONLY',
    });

    const planPath = path.join(BASE_DIR, 'p12_multi_date_daily_append_plan.json');
    writeJson(planPath, plan);
    console.log(`[P12] Written: ${planPath}`);

    if (plan.validationStatus !== 'PASS') {
        throw new Error(`[P12] Plan validation failed: ${plan.validationMessages.join('; ')}`);
    }

    console.log('[P12] Executing multi-date dry-run append...');
    const result = executeMultiDateDailyAppendDryRun(plan, {
        corpusPath: CORPUS_PATH,
        append: true,
        dryRun: true,
        stopOnFirstFailure: true,
    });

    const resultValidation = validateMultiDateDailyAppendDryRunResult(result);
    if (resultValidation.validationStatus !== 'PASS') {
        throw new Error(`[P12] Dry-run result validation failed: ${resultValidation.validationMessages.join('; ')}`);
    }

    const resultPath = path.join(BASE_DIR, 'p12_multi_date_daily_append_result.json');
    writeJson(resultPath, result);
    console.log(`[P12] Written: ${resultPath}`);

    const afterCorpusEntries = loadCorpusEntries();
    if (afterCorpusEntries.length !== result.afterCorpusCount) {
        throw new Error(
            `[P12] Corpus count mismatch: file=${afterCorpusEntries.length} result=${result.afterCorpusCount}`,
        );
    }

    console.log('[P12] Rebuilding metrics, quality gate, trend stability, and dashboard contract...');
    const metrics = buildCorpusMetrics(afterCorpusEntries, {
        metricsRunId: METRICS_RUN_ID,
        generatedAt: new Date().toISOString(),
        corpusPath: CORPUS_PATH,
    });
    const qualityGate = buildCorpusQualityGate(metrics, afterCorpusEntries, {
        qualityRunId: QUALITY_RUN_ID,
        generatedAt: new Date().toISOString(),
    });
    const trendStability = buildCorpusTrendStability(metrics, {
        trendRunId: TREND_RUN_ID,
        generatedAt: new Date().toISOString(),
    });
    const dashboardContract = buildDashboardMetricsContract(
        {
            corpusMetrics: metrics,
            corpusQualityGate: qualityGate,
            corpusTrendStability: trendStability,
            corpusEntries: afterCorpusEntries,
        },
        {
            dashboardRunId: DASHBOARD_RUN_ID,
            generatedAt: new Date().toISOString(),
        },
    );

    writeJson(path.join(BASE_DIR, 'p12_corpus_metrics_store.json'), metrics);
    writeJson(path.join(BASE_DIR, 'p12_corpus_quality_gate.json'), qualityGate);
    writeJson(path.join(BASE_DIR, 'p12_dashboard_metrics_contract.json'), dashboardContract);

    const resultMdPath = path.join(BASE_DIR, 'p12_multi_date_daily_append_result.md');
    writeText(resultMdPath, buildResultMarkdown(plan, result, metrics, qualityGate, dashboardContract));
    console.log(`[P12] Written: ${resultMdPath}`);

    const readinessPath = path.join(SYSTEM_READINESS_DIR, 'p12_next_execution_order_20260511.md');
    writeText(readinessPath, buildSystemReadinessMarkdown(plan, result, metrics, qualityGate, dashboardContract));
    console.log(`[P12] Written: ${readinessPath}`);

    console.log('');
    console.log('=== P12 ARTIFACT GENERATION COMPLETE ===');
    console.log(`Plan status:      ${plan.validationStatus}`);
    console.log(`Append status:    ${result.validationStatus}`);
    console.log(`Corpus total:     ${result.afterCorpusCount}`);
    console.log(`Unique as-of:     ${result.afterUniqueAsOfDateCount}`);
    console.log(`Quality status:   ${qualityGate.qualityStatus}`);
    console.log(`Dashboard ready:  ${dashboardContract.readinessCards.finalDashboardReadiness.status}`);
}

main();
