#!/usr/bin/env node
/**
 * generate-p13-horizon-maturity-coverage-recovery-artifacts.js
 *
 * P13 horizon maturity tracker and coverage recovery planner generator.
 *
 * SAFETY CONTRACT:
 * - research mode only — observability-only
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

const { parseSnapshotCorpusJsonl } = require('../src/lib/onlineValidation/SimulationSnapshotCorpusAccumulator');
const { buildHorizonMaturityTracker, summarizeBlockedReasonsByHorizon } = require('../src/lib/onlineValidation/HorizonMaturityTracker');
const { buildCoverageRecoveryPlan } = require('../src/lib/onlineValidation/CoverageRecoveryPlanner');

const BASE_DIR = path.resolve(__dirname, '../outputs/online_validation');
const SYSTEM_READINESS_DIR = path.resolve(__dirname, '../outputs/system_readiness');
const CORPUS_PATH = path.join(BASE_DIR, 'simulation_snapshot_corpus.jsonl');
const P12_METRICS_PATH = path.join(BASE_DIR, 'p12_corpus_metrics_store.json');
const P12_QUALITY_PATH = path.join(BASE_DIR, 'p12_corpus_quality_gate.json');
const P12_DASHBOARD_PATH = path.join(BASE_DIR, 'p12_dashboard_metrics_contract.json');

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function writeText(filePath, text) {
    fs.writeFileSync(filePath, text, 'utf8');
}

function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadCorpusEntries() {
    const content = fs.readFileSync(CORPUS_PATH, 'utf8');
    return parseSnapshotCorpusJsonl(content);
}

function buildTrackerMarkdown(tracker, blockedReasonSummaries, dashboardContract) {
    const lines = [
        '# P13 Horizon Maturity Tracker',
        '',
        '## Scope',
        '',
        '- observability-only tracker',
        '- dry-run analysis only',
        '- no production DB write',
        '- no optimizer write',
        '- no live execution',
        '- no performance claim',
        '',
        '## Tracker',
        '',
        `- trackerRunId: ${tracker.trackerRunId}`,
        `- reviewDate: ${tracker.reviewDate}`,
        `- totalEntries: ${tracker.totalEntries}`,
        `- maturityStatus: ${tracker.maturityStatus}`,
        `- validationStatus: ${tracker.validationStatus}`,
        '',
        '## Horizon Summaries',
        '',
        '| horizon | total | ready | blocked | coverage | due | notDue | maturity | topBlockedReason |',
        '|---|---:|---:|---:|---:|---:|---:|---|---|',
        ...tracker.horizonSummaries.map(row =>
            `| ${row.horizonLabel} | ${row.totalCount} | ${row.readyCount} | ${row.blockedCount} | ${row.coverageRatio.toFixed(4)} | ${row.dueCount} | ${row.notDueCount} | ${row.maturityStatus} | ${blockedReasonSummaries.find(x => x.horizonLabel === row.horizonLabel)?.topBlockedReason ?? 'NONE'} |`,
        ),
        '',
        '## Dashboard Context',
        '',
        `- prior dashboard readiness: ${dashboardContract.readinessCards.finalDashboardReadiness.status}`,
        `- quality gate: ${dashboardContract.qualityCards.qualityStatus.value}`,
        `- warning count: ${dashboardContract.warningCards.totalWarnings}`,
        '',
        '## Notes',
        '',
        '- 60D is not due dominant in the current corpus view',
        '- this artifact is not production ready',
        '- this artifact is not optimizer input',
    ];
    return lines.join('\n');
}

function buildRecoveryMarkdown(plan) {
    const lines = [
        '# P13 Coverage Recovery Plan',
        '',
        '## Scope',
        '',
        '- observability-only recovery plan',
        '- dry-run planning only',
        '- no production DB write',
        '- no optimizer write',
        '- no live execution',
        '- no performance claim',
        '',
        '## Plan',
        '',
        `- recoveryRunId: ${plan.recoveryRunId}`,
        `- recoveryStatus: ${plan.recoveryStatus}`,
        `- currentCoverageRatio: ${plan.currentCoverageRatio}`,
        `- targetCoverageRatio: ${plan.targetCoverageRatio}`,
        `- currentHorizonCoverageGap: ${plan.currentHorizonCoverageGap}`,
        `- targetHorizonCoverageGap: ${plan.targetHorizonCoverageGap}`,
        `- currentUniqueAsOfDateCount: ${plan.currentUniqueAsOfDateCount}`,
        `- targetUniqueAsOfDateCount: ${plan.targetUniqueAsOfDateCount}`,
        '',
        '## Horizon Recovery Items',
        '',
        '| horizon | currentCoverage | targetCoverage | blocked | topBlockedReason | recoveryNeed | nextStep |',
        '|---|---:|---:|---:|---|---|---|',
        ...plan.horizonRecoveryItems.map(item =>
            `| ${item.horizonLabel} | ${item.currentCoverageRatio.toFixed(4)} | ${item.targetCoverageRatio.toFixed(4)} | ${item.blockedCount} | ${item.topBlockedReason} | ${item.recoveryNeed} | ${item.estimatedNextStep} |`,
        ),
        '',
        '## Blockers',
        '',
        ...(plan.blockers.length > 0 ? plan.blockers.map(item => `- ${item}`) : ['- none']),
        '',
        '## Recommended Actions',
        '',
        ...(plan.recommendedActions.length > 0 ? plan.recommendedActions.map(item => `- ${item}`) : ['- none']),
    ];
    return lines.join('\n');
}

function buildSystemReadinessMarkdown(tracker, plan) {
    return [
        '# P13 Next Execution Order — 2026-05-11',
        '',
        '## Current State',
        '',
        `- tracker maturity status: ${tracker.maturityStatus}`,
        `- recovery status: ${plan.recoveryStatus}`,
        `- 60D horizon status: ${tracker.horizonSummaries.find(row => row.horizonLabel === '60D')?.maturityStatus ?? 'UNKNOWN'}`,
        `- coverageRatio: ${plan.currentCoverageRatio}`,
        `- horizonCoverageGap: ${plan.currentHorizonCoverageGap}`,
        '',
        '## Next Recommended Direction',
        '',
        '- wait for horizon maturity to improve',
        '- keep corpus append-only and observability-only',
        '- keep blocked-reason tracking explicit',
        '',
        '## Constraints',
        '',
        '- no production DB write',
        '- no optimizer write',
        '- no live execution',
        '- no performance claim',
    ].join('\n');
}

function main() {
    ensureDir(BASE_DIR);
    ensureDir(SYSTEM_READINESS_DIR);

    const corpusEntries = loadCorpusEntries();
    const p12Metrics = loadJson(P12_METRICS_PATH);
    const p12Quality = loadJson(P12_QUALITY_PATH);
    const p12Dashboard = loadJson(P12_DASHBOARD_PATH);

    if (corpusEntries.length !== p12Metrics.totalEntries) {
        throw new Error(
            `[P13] corpus count mismatch: corpus=${corpusEntries.length} metrics=${p12Metrics.totalEntries}`,
        );
    }

    console.log('[P13] Building horizon maturity tracker...');
    const tracker = buildHorizonMaturityTracker(corpusEntries, {
        trackerRunId: 'p13-horizon-maturity-20260511-001',
        generatedAt: new Date().toISOString(),
        reviewDate: '2026-07-13',
        horizons: ['5D', '20D', '60D'],
    });
    const blockedReasonSummaries = summarizeBlockedReasonsByHorizon(corpusEntries);

    const trackerPath = path.join(BASE_DIR, 'p13_horizon_maturity_tracker.json');
    writeJson(trackerPath, tracker);
    writeText(path.join(BASE_DIR, 'p13_horizon_maturity_tracker.md'), buildTrackerMarkdown(tracker, blockedReasonSummaries, p12Dashboard));
    writeJson(path.join(BASE_DIR, 'p13_blocked_reason_by_horizon.json'), blockedReasonSummaries);

    console.log('[P13] Building coverage recovery plan...');
    const plan = buildCoverageRecoveryPlan(
        {
            horizonMaturityTracker: tracker,
            corpusQualityGate: p12Quality,
            corpusMetrics: p12Metrics,
        },
        {
            recoveryRunId: 'p13-coverage-recovery-20260511-001',
            generatedAt: new Date().toISOString(),
            targetCoverageRatio: 0.5,
            targetHorizonCoverageGap: 0.35,
            targetUniqueAsOfDateCount: 10,
        },
    );

    writeJson(path.join(BASE_DIR, 'p13_coverage_recovery_plan.json'), plan);
    writeText(path.join(BASE_DIR, 'p13_coverage_recovery_plan.md'), buildRecoveryMarkdown(plan));
    writeText(path.join(SYSTEM_READINESS_DIR, 'p13_next_execution_order_20260511.md'), buildSystemReadinessMarkdown(tracker, plan));

    const parseCheckFiles = [
        trackerPath,
        path.join(BASE_DIR, 'p13_blocked_reason_by_horizon.json'),
        path.join(BASE_DIR, 'p13_coverage_recovery_plan.json'),
    ];
    for (const filePath of parseCheckFiles) {
        JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    console.log('[P13] Done.');
}

main();

