#!/usr/bin/env node
/**
 * generate-p14-outcome-backfill-rehearsal-artifacts.js
 *
 * P14 outcome backfill rehearsal generator.
 *
 * SAFETY CONTRACT:
 * - research mode only — observability-only
 * - no production DB write — no corpus write — no external API — no LLM
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
const { buildHorizonMaturityTracker } = require('../src/lib/onlineValidation/HorizonMaturityTracker');
const { buildCoverageRecoveryPlan } = require('../src/lib/onlineValidation/CoverageRecoveryPlanner');
const {
    selectOutcomeBackfillCandidates,
    summarizeBackfillCandidateSelection,
} = require('../src/lib/onlineValidation/OutcomeBackfillCandidateSelector');
const {
    buildOutcomeBackfillRehearsal,
    summarizeOutcomeBackfillRehearsal,
} = require('../src/lib/onlineValidation/OutcomeBackfillRehearsalEngine');
const {
    buildBackfillQualityImpactPreview,
} = require('../src/lib/onlineValidation/BackfillQualityImpactPreview');
const {
    buildCorpusMetrics,
} = require('../src/lib/onlineValidation/CorpusMetricsStore');
const {
    buildCorpusQualityGate,
} = require('../src/lib/onlineValidation/CorpusQualityGate');

const BASE_DIR = path.resolve(__dirname, '../outputs/online_validation');
const SYSTEM_READINESS_DIR = path.resolve(__dirname, '../outputs/system_readiness');
const CORPUS_PATH = path.join(BASE_DIR, 'simulation_snapshot_corpus.jsonl');
const P13_TRACKER_PATH = path.join(BASE_DIR, 'p13_horizon_maturity_tracker.json');
const P13_RECOVERY_PLAN_PATH = path.join(BASE_DIR, 'p13_coverage_recovery_plan.json');
const P12_METRICS_PATH = path.join(BASE_DIR, 'p12_corpus_metrics_store.json');
const P12_QUALITY_PATH = path.join(BASE_DIR, 'p12_corpus_quality_gate.json');

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
    return parseSnapshotCorpusJsonl(fs.readFileSync(CORPUS_PATH, 'utf8'));
}

function buildSelectionMarkdown(selection, summary, p13Tracker, p13RecoveryPlan) {
    return [
        '# P14 Outcome Backfill Candidate Selection',
        '',
        '## Scope',
        '',
        '- artifact-only rehearsal selection',
        '- observability-only',
        '- no production DB write',
        '- no corpus write',
        '- no optimizer write',
        '- no live execution',
        '',
        '## Selection',
        '',
        `- selectorRunId: ${selection.selectorRunId}`,
        `- selectedCount: ${selection.selectedCount}`,
        `- skippedCount: ${selection.skippedCount}`,
        `- validationStatus: ${selection.validationStatus}`,
        `- prior maturity status: ${p13Tracker.maturityStatus}`,
        `- prior recovery status: ${p13RecoveryPlan.recoveryStatus}`,
        '',
        '## Summary',
        '',
        `- symbolsSelected: ${summary.symbolsSelected.join(', ') || 'none'}`,
        `- earliestTargetTradingDate: ${summary.earliestTargetTradingDate ?? 'none'}`,
        `- latestTargetTradingDate: ${summary.latestTargetTradingDate ?? 'none'}`,
        '',
        '## Notes',
        '',
        '- only 5D / 20D are eligible by default',
        '- 60D remains excluded unless explicitly enabled',
    ].join('\n');
}

function buildRehearsalMarkdown(rehearsal, summary, p13Tracker) {
    return [
        '# P14 Outcome Backfill Rehearsal',
        '',
        '## Scope',
        '',
        '- artifact-only rehearsal',
        '- dry-run only',
        '- no production DB write',
        '- no corpus write',
        '- no optimizer write',
        '- no live execution',
        '',
        '## Rehearsal',
        '',
        `- rehearsalRunId: ${rehearsal.rehearsalRunId}`,
        `- rehearsedCount: ${rehearsal.rehearsedCount}`,
        `- stillBlockedCount: ${rehearsal.stillBlockedCount}`,
        `- validationStatus: ${rehearsal.validationStatus}`,
        `- maturity status: ${p13Tracker.maturityStatus}`,
        '',
        '## Summary',
        '',
        `- readyAfterRehearsalCount: ${summary.readyAfterRehearsalCount}`,
        `- blockedAfterRehearsalCount: ${summary.blockedAfterRehearsalCount}`,
        '',
        '## Transition Counts',
        '',
        `- BLOCKED_TO_READY: ${summary.transitionCounts.BLOCKED_TO_READY}`,
        `- REMAINS_BLOCKED: ${summary.transitionCounts.REMAINS_BLOCKED}`,
        `- NO_CHANGE: ${summary.transitionCounts.NO_CHANGE}`,
    ].join('\n');
}

function buildImpactMarkdown(preview, p13RecoveryPlan) {
    return [
        '# P14 Backfill Quality Impact Preview',
        '',
        '## Scope',
        '',
        '- preview only',
        '- no corpus write',
        '- no optimizer write',
        '- no live execution',
        '',
        '## Preview',
        '',
        `- previewRunId: ${preview.previewRunId}`,
        `- currentCoverageRatio: ${preview.currentCoverageRatio}`,
        `- projectedCoverageRatio: ${preview.projectedCoverageRatio}`,
        `- impactStatus: ${preview.impactStatus}`,
        `- prior recovery status: ${p13RecoveryPlan.recoveryStatus}`,
        '',
        '## Notes',
        '',
        '- projected coverage is based solely on blocked-to-ready transitions',
        '- this preview does not imply strategy quality',
    ].join('\n');
}

function buildSystemReadinessMarkdown(selection, rehearsal, impactPreview) {
    return [
        '# P14 Next Execution Order — 2026-05-11',
        '',
        '## Current State',
        '',
        `- selected candidates: ${selection.selectedCount}`,
        `- rehearsed transitions: ${rehearsal.rehearsedCount}`,
        `- impact status: ${impactPreview.impactStatus}`,
        `- projected quality: ${impactPreview.projectedQualityStatus}`,
        '',
        '## Next Recommended Direction',
        '',
        '- keep outcome backfill as rehearsal only until the data path is fully governed',
        '- continue watching 5D / 20D maturity transitions',
        '- keep 60D excluded unless explicitly required',
        '',
        '## Constraints',
        '',
        '- no production DB write',
        '- no corpus write',
        '- no optimizer write',
        '- no live execution',
        '- no performance claim',
    ].join('\n');
}

function main() {
    ensureDir(BASE_DIR);
    ensureDir(SYSTEM_READINESS_DIR);

    const corpusEntries = loadCorpusEntries();
    const p13Tracker = loadJson(P13_TRACKER_PATH);
    const p13RecoveryPlan = loadJson(P13_RECOVERY_PLAN_PATH);
    const p12Metrics = loadJson(P12_METRICS_PATH);
    const p12Quality = loadJson(P12_QUALITY_PATH);

    if (corpusEntries.length !== p12Metrics.totalEntries) {
        throw new Error(
            `[P14] corpus count mismatch: corpus=${corpusEntries.length} metrics=${p12Metrics.totalEntries}`,
        );
    }

    console.log('[P14] Selecting backfill candidates...');
    const selection = selectOutcomeBackfillCandidates(corpusEntries, {
        selectorRunId: 'p14-outcome-backfill-selector-20260511-001',
        generatedAt: new Date().toISOString(),
        reviewDate: '2026-07-13',
        allowedHorizons: ['5D', '20D'],
        maxCandidates: 20,
        include60D: false,
    });

    const summary = summarizeBackfillCandidateSelection(selection);
    writeJson(path.join(BASE_DIR, 'p14_backfill_candidate_selection.json'), selection);
    writeText(
        path.join(BASE_DIR, 'p14_backfill_candidate_selection.md'),
        buildSelectionMarkdown(selection, summary, p13Tracker, p13RecoveryPlan),
    );

    console.log('[P14] Running rehearsal...');
    const rehearsal = buildOutcomeBackfillRehearsal(selection, {
        rehearsalRunId: 'p14-outcome-backfill-rehearsal-20260511-001',
        generatedAt: new Date().toISOString(),
        dryRun: true,
        mockOutcomeProvider: (symbol, horizonLabel, targetTradingDate) => {
            if (horizonLabel === '20D') {
                return {
                    closePriceAtPrediction: 100,
                    closePriceAtOutcome: 110,
                    returnPct: 0.1,
                    priceSource: 'mock-deterministic',
                    outcomeAvailable: true,
                };
            }
            return null;
        },
    });

    const rehearsalSummary = summarizeOutcomeBackfillRehearsal(rehearsal);
    writeJson(path.join(BASE_DIR, 'p14_outcome_backfill_rehearsal.json'), rehearsal);
    writeText(
        path.join(BASE_DIR, 'p14_outcome_backfill_rehearsal.md'),
        buildRehearsalMarkdown(rehearsal, rehearsalSummary, p13Tracker),
    );

    console.log('[P14] Building quality impact preview...');
    const impactPreview = buildBackfillQualityImpactPreview(
        {
            currentCorpusMetrics: p12Metrics,
            currentCorpusQualityGate: p12Quality,
            rehearsalSummary,
        },
        {
            previewRunId: 'p14-backfill-quality-impact-preview-20260511-001',
            generatedAt: new Date().toISOString(),
        },
    );

    writeJson(path.join(BASE_DIR, 'p14_backfill_quality_impact_preview.json'), impactPreview);
    writeText(
        path.join(BASE_DIR, 'p14_backfill_quality_impact_preview.md'),
        buildImpactMarkdown(impactPreview, p13RecoveryPlan),
    );

    writeText(
        path.join(SYSTEM_READINESS_DIR, 'p14_next_execution_order_20260511.md'),
        buildSystemReadinessMarkdown(selection, rehearsal, impactPreview),
    );

    const parseCheckFiles = [
        path.join(BASE_DIR, 'p14_backfill_candidate_selection.json'),
        path.join(BASE_DIR, 'p14_outcome_backfill_rehearsal.json'),
        path.join(BASE_DIR, 'p14_backfill_quality_impact_preview.json'),
    ];
    for (const filePath of parseCheckFiles) {
        JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    const corpusAfter = fs.readFileSync(CORPUS_PATH, 'utf8').trim().split('\n').filter(Boolean).length;
    if (corpusAfter !== 60) {
        throw new Error(`[P14] corpus must remain unchanged at 60 lines, got ${corpusAfter}`);
    }

    console.log('[P14] Done.');
}

main();

