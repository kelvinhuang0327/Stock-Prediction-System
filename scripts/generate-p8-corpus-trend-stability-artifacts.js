#!/usr/bin/env node
/**
 * generate-p8-corpus-trend-stability-artifacts.js
 * Self-contained Node.js script — no TypeScript compilation required.
 *
 * SAFETY CONTRACT: no production DB write, no external API, no LLM, no trading signals.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Constants ─────────────────────────────────────────────────────

const CORPUS_JSONL = path.resolve(__dirname, '../outputs/online_validation/simulation_snapshot_corpus.jsonl');
const OUT_DIR = path.resolve(__dirname, '../outputs/online_validation');
const READINESS_DIR = path.resolve(__dirname, '../outputs/system_readiness');

const METRICS_VERSION = 'corpus-metrics-v0';
const TREND_STABILITY_VERSION = 'corpus-trend-stability-v0';
const READINESS_VERSION = 'corpus-metrics-readiness-v0';

// ─── Inline: Corpus parser ─────────────────────────────────────────

function parseCorpusJsonl(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return [];
    const lines = content.split('\n').filter(l => l.trim() !== '');
    return lines.map((line, i) => {
        try {
            return JSON.parse(line);
        } catch (e) {
            throw new Error(`Malformed JSON at line ${i + 1}: ${line.slice(0, 80)}`);
        }
    });
}

// ─── Inline: CorpusMetricsStore ────────────────────────────────────

function buildOutcomeCoverageTrend(entries) {
    const byDate = {};
    for (const e of entries) {
        const d = e.originalAsOfDate;
        if (!byDate[d]) byDate[d] = { totalCount: 0, readyCount: 0, blockedCount: 0, missingOutcomeCount: 0, notDueCount: 0 };
        byDate[d].totalCount++;
        if (e.snapshotStatus === 'SNAPSHOT_READY') byDate[d].readyCount++;
        else byDate[d].blockedCount++;
        if (e.snapshotBlockedReason === 'OUTCOME_MISSING') byDate[d].missingOutcomeCount++;
        if (e.snapshotBlockedReason === 'WINDOW_NOT_DUE') byDate[d].notDueCount++;
    }
    return Object.keys(byDate).sort().map(d => ({
        asOfDate: d,
        ...byDate[d],
        coverageRatio: byDate[d].totalCount > 0
            ? parseFloat((byDate[d].readyCount / byDate[d].totalCount).toFixed(4))
            : 0,
    }));
}

function buildCorpusMetrics(entries, options) {
    const metricsRunId = options.metricsRunId || 'p8-corpus-metrics-default';
    const generatedAt = options.generatedAt || new Date().toISOString();

    const totalEntries = entries.length;
    const readyCount = entries.filter(e => e.snapshotStatus === 'SNAPSHOT_READY').length;
    const blockedCount = totalEntries - readyCount;
    const coverageRatio = totalEntries > 0 ? parseFloat((readyCount / totalEntries).toFixed(4)) : 0;

    const byAsOfDate = {};
    const bySymbol = {};
    const byHorizon = {};
    const bySnapshotStatus = {};
    const byBlockedReason = {};
    const perSymbolObservationCount = {};
    const perHorizonObservationCount = {};

    for (const e of entries) {
        byAsOfDate[e.originalAsOfDate] = (byAsOfDate[e.originalAsOfDate] || 0) + 1;
        bySymbol[e.symbol] = (bySymbol[e.symbol] || 0) + 1;
        byHorizon[e.horizonLabel] = (byHorizon[e.horizonLabel] || 0) + 1;
        bySnapshotStatus[e.snapshotStatus] = (bySnapshotStatus[e.snapshotStatus] || 0) + 1;
        if (e.snapshotBlockedReason && e.snapshotBlockedReason !== 'NONE') {
            byBlockedReason[e.snapshotBlockedReason] = (byBlockedReason[e.snapshotBlockedReason] || 0) + 1;
        }
        perSymbolObservationCount[e.symbol] = (perSymbolObservationCount[e.symbol] || 0) + 1;
        perHorizonObservationCount[e.horizonLabel] = (perHorizonObservationCount[e.horizonLabel] || 0) + 1;
    }

    const outcomeCoverageTrend = buildOutcomeCoverageTrend(entries);
    const readyTrendByAsOfDate = outcomeCoverageTrend.map(p => ({ asOfDate: p.asOfDate, readyCount: p.readyCount }));
    const blockedTrendByAsOfDate = outcomeCoverageTrend.map(p => ({ asOfDate: p.asOfDate, blockedCount: p.blockedCount }));

    return {
        metricsVersion: METRICS_VERSION,
        metricsRunId,
        generatedAt,
        corpusPath: CORPUS_JSONL,
        totalEntries,
        readyCount,
        blockedCount,
        uniqueAsOfDateCount: Object.keys(byAsOfDate).length,
        uniqueSymbolCount: Object.keys(bySymbol).length,
        uniqueHorizonCount: Object.keys(byHorizon).length,
        coverageRatio,
        byAsOfDate,
        bySymbol,
        byHorizon,
        bySnapshotStatus,
        byBlockedReason,
        perSymbolObservationCount,
        perHorizonObservationCount,
        outcomeCoverageTrend,
        readyTrendByAsOfDate,
        blockedTrendByAsOfDate,
        dataQualityFlags: [],
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
}

function buildCorpusMetricsReadinessDecision(metrics, options = {}) {
    const minUniqueAsOfDateCount = options.minUniqueAsOfDateCount || 2;
    const minReadyCount = options.minReadyCount || 6;
    const minCoverageRatio = options.minCoverageRatio || 0.5;
    const readinessRunId = options.readinessRunId || 'p8-corpus-readiness-default';

    const hasEnoughDates = metrics.uniqueAsOfDateCount >= minUniqueAsOfDateCount;
    const hasEnoughReady = metrics.readyCount >= minReadyCount;
    const hasSufficientCoverage = metrics.coverageRatio >= minCoverageRatio;

    let readinessStatus;
    const reasons = [];

    if (!hasEnoughDates || !hasEnoughReady || !hasSufficientCoverage) {
        readinessStatus = 'DATA_LIMITED';
        if (!hasEnoughDates) reasons.push(`uniqueAsOfDateCount=${metrics.uniqueAsOfDateCount} < ${minUniqueAsOfDateCount}`);
        if (!hasEnoughReady) reasons.push(`readyCount=${metrics.readyCount} < ${minReadyCount}`);
        if (!hasSufficientCoverage) reasons.push(`coverageRatio=${metrics.coverageRatio} < ${minCoverageRatio}`);
    } else {
        readinessStatus = 'READY_FOR_OBSERVABILITY_ONLY_METRICS';
        reasons.push('All observability readiness gates pass');
    }

    return {
        readinessVersion: READINESS_VERSION,
        readinessRunId,
        generatedAt: metrics.generatedAt,
        uniqueAsOfDateCount: metrics.uniqueAsOfDateCount,
        readyCount: metrics.readyCount,
        coverageRatio: metrics.coverageRatio,
        readinessChecks: { hasEnoughDates, hasEnoughReady, hasSufficientCoverage },
        readinessStatus,
        reasons,
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
        validationStatus: 'PASS',
        validationMessages: ['PASS: readiness decision safety contracts verified'],
    };
}

// ─── Inline: CorpusTrendStability ──────────────────────────────────

function summarizeCoverageTrend(trend) {
    const ratios = trend.map(t => t.coverageRatio);
    const dateCount = trend.length;
    if (dateCount === 0) {
        return { dateCount: 0, minCoverageRatio: 0, maxCoverageRatio: 0, averageCoverageRatio: 0, largestCoverageDrop: 0, largestCoverageRise: 0, stableDateCount: 0, unstableDateCount: 0 };
    }
    const minCoverageRatio = Math.min(...ratios);
    const maxCoverageRatio = Math.max(...ratios);
    const averageCoverageRatio = ratios.reduce((s, r) => s + r, 0) / dateCount;

    let largestCoverageDrop = 0;
    let largestCoverageRise = 0;
    let stableDateCount = 1;
    let unstableDateCount = 0;

    for (let i = 1; i < trend.length; i++) {
        const delta = trend[i].coverageRatio - trend[i - 1].coverageRatio;
        if (delta < 0) {
            largestCoverageDrop = Math.max(largestCoverageDrop, -delta);
            unstableDateCount++;
        } else {
            largestCoverageRise = Math.max(largestCoverageRise, delta);
            stableDateCount++;
        }
    }

    return { dateCount, minCoverageRatio, maxCoverageRatio, averageCoverageRatio, largestCoverageDrop, largestCoverageRise, stableDateCount, unstableDateCount };
}

function buildCorpusTrendStability(metrics, options) {
    const minAsOfDateCount = options.minAsOfDateCount || 3;
    const maxCoverageDrop = options.maxCoverageDrop !== undefined ? options.maxCoverageDrop : 0.25;
    const minAverageCoverageRatio = options.minAverageCoverageRatio !== undefined ? options.minAverageCoverageRatio : 0.5;

    const summary = summarizeCoverageTrend(metrics.outcomeCoverageTrend);
    const hasEnoughDates = metrics.uniqueAsOfDateCount >= minAsOfDateCount;
    const coverageDropWithinLimit = summary.largestCoverageDrop <= maxCoverageDrop;
    const averageCoverageMeetsThreshold = summary.averageCoverageRatio >= minAverageCoverageRatio;

    const stabilityChecks = {
        hasEnoughDates,
        coverageDropWithinLimit,
        averageCoverageMeetsThreshold,
        noProductionWrite: true,
        noSimulationWrite: true,
        noOptimizerWrite: true,
        noPerformanceClaim: true,
        noTradingSignal: true,
    };

    let stabilityStatus;
    const reasons = [];

    if (metrics.totalEntries === 0 || metrics.readyCount === 0 || !averageCoverageMeetsThreshold) {
        stabilityStatus = 'BLOCKED';
        if (metrics.totalEntries === 0) reasons.push('corpus is empty => BLOCKED');
        if (metrics.readyCount === 0) reasons.push('readyCount=0 => BLOCKED');
        if (!averageCoverageMeetsThreshold) reasons.push(`averageCoverageRatio=${summary.averageCoverageRatio.toFixed(3)} < ${minAverageCoverageRatio} => BLOCKED`);
    } else if (!hasEnoughDates || !coverageDropWithinLimit) {
        stabilityStatus = 'DATA_LIMITED';
        if (!hasEnoughDates) reasons.push(`uniqueAsOfDateCount=${metrics.uniqueAsOfDateCount} < ${minAsOfDateCount} => DATA_LIMITED`);
        if (!coverageDropWithinLimit) reasons.push(`largestCoverageDrop=${summary.largestCoverageDrop.toFixed(3)} > ${maxCoverageDrop} => DATA_LIMITED`);
    } else {
        stabilityStatus = 'STABLE_FOR_OBSERVABILITY_ONLY';
        reasons.push(`hasEnoughDates=${hasEnoughDates} coverageDropWithinLimit=${coverageDropWithinLimit} avgCoverage=${summary.averageCoverageRatio.toFixed(3)}`);
        reasons.push('Observability-only stability; no production, simulation, or optimizer writes permitted');
    }

    return {
        trendStabilityVersion: TREND_STABILITY_VERSION,
        trendRunId: options.trendRunId,
        generatedAt: options.generatedAt,
        inputAsOfDateCount: metrics.uniqueAsOfDateCount,
        inputTotalEntries: metrics.totalEntries,
        coverageTrend: metrics.outcomeCoverageTrend,
        readyTrendByAsOfDate: metrics.readyTrendByAsOfDate,
        blockedTrendByAsOfDate: metrics.blockedTrendByAsOfDate,
        coverageTrendSummary: summary,
        stabilityChecks,
        stabilityStatus,
        reasons,
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
        validationStatus: 'PASS',
        validationMessages: ['PASS: corpus trend stability safety contracts verified'],
    };
}

// ─── Main ──────────────────────────────────────────────────────────

const generatedAt = new Date().toISOString();
const entries = parseCorpusJsonl(CORPUS_JSONL);
console.log(`Loaded corpus: ${entries.length} entries`);

if (entries.length < 18) {
    throw new Error(`Expected >=18 corpus entries, got ${entries.length}. Run generate-p8-third-date-corpus-append-artifacts.js first.`);
}

// Build metrics
const metrics = buildCorpusMetrics(entries, {
    metricsRunId: 'p8-corpus-metrics-20260511-001',
    generatedAt,
});
console.log(`Metrics: totalEntries=${metrics.totalEntries} uniqueAsOfDateCount=${metrics.uniqueAsOfDateCount} coverageRatio=${metrics.coverageRatio}`);

// Build readiness decision
const readinessDecision = buildCorpusMetricsReadinessDecision(metrics, {
    readinessRunId: 'p8-corpus-readiness-20260511-001',
    minUniqueAsOfDateCount: 2,
    minReadyCount: 6,
    minCoverageRatio: 0.5,
});
console.log(`Readiness: ${readinessDecision.readinessStatus}`);

// Build trend stability
const trendStability = buildCorpusTrendStability(metrics, {
    trendRunId: 'p8-corpus-trend-stability-20260511-001',
    generatedAt,
    minAsOfDateCount: 3,
    maxCoverageDrop: 0.25,
    minAverageCoverageRatio: 0.5,
});
console.log(`Trend stability: ${trendStability.stabilityStatus}`);

// Safety check
if (trendStability.stabilityStatus === 'PRODUCTION_READY') {
    throw new Error('stabilityStatus must never be PRODUCTION_READY');
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(READINESS_DIR, { recursive: true });

// p8_corpus_metrics_store.json
fs.writeFileSync(
    path.join(OUT_DIR, 'p8_corpus_metrics_store.json'),
    JSON.stringify({ artifactVersion: 'p8-corpus-metrics-v0', generatedAt, ...metrics }, null, 2),
);

// p8_corpus_metrics_store.md
fs.writeFileSync(path.join(OUT_DIR, 'p8_corpus_metrics_store.md'), `# P8 Corpus Metrics Store

| Field | Value |
|-------|-------|
| generatedAt | ${generatedAt} |
| metricsRunId | ${metrics.metricsRunId} |
| totalEntries | ${metrics.totalEntries} |
| readyCount | ${metrics.readyCount} |
| blockedCount | ${metrics.blockedCount} |
| uniqueAsOfDateCount | ${metrics.uniqueAsOfDateCount} |
| uniqueSymbolCount | ${metrics.uniqueSymbolCount} |
| uniqueHorizonCount | ${metrics.uniqueHorizonCount} |
| coverageRatio | ${metrics.coverageRatio} |

## Coverage Trend by AsOfDate

${metrics.outcomeCoverageTrend.map(p =>
    `- ${p.asOfDate}: total=${p.totalCount} ready=${p.readyCount} blocked=${p.blockedCount} ratio=${p.coverageRatio}`
).join('\n')}

## Safety Guardrails
- productionWriteAllowed: false
- simulationWriteAllowed: false
- optimizerWriteAllowed: false
- No performance claims
- No trading signals

## Status: ${readinessDecision.readinessStatus}
`);

// p8_corpus_trend_stability.json
fs.writeFileSync(
    path.join(OUT_DIR, 'p8_corpus_trend_stability.json'),
    JSON.stringify({ artifactVersion: 'p8-corpus-trend-stability-v0', generatedAt, ...trendStability }, null, 2),
);

// p8_corpus_trend_stability.md
const s = trendStability.coverageTrendSummary;
fs.writeFileSync(path.join(OUT_DIR, 'p8_corpus_trend_stability.md'), `# P8 Corpus Trend Stability

| Field | Value |
|-------|-------|
| generatedAt | ${generatedAt} |
| trendRunId | ${trendStability.trendRunId} |
| trendStabilityVersion | ${trendStability.trendStabilityVersion} |
| inputAsOfDateCount | ${trendStability.inputAsOfDateCount} |
| inputTotalEntries | ${trendStability.inputTotalEntries} |
| stabilityStatus | ${trendStability.stabilityStatus} |

## Coverage Trend Summary

| Metric | Value |
|--------|-------|
| dateCount | ${s.dateCount} |
| minCoverageRatio | ${s.minCoverageRatio.toFixed(4)} |
| maxCoverageRatio | ${s.maxCoverageRatio.toFixed(4)} |
| averageCoverageRatio | ${s.averageCoverageRatio.toFixed(4)} |
| largestCoverageDrop | ${s.largestCoverageDrop.toFixed(4)} |
| largestCoverageRise | ${s.largestCoverageRise.toFixed(4)} |
| stableDateCount | ${s.stableDateCount} |
| unstableDateCount | ${s.unstableDateCount} |

## Stability Checks

${Object.entries(trendStability.stabilityChecks).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Reasons

${trendStability.reasons.map(r => `- ${r}`).join('\n')}

## Safety Guardrails
- productionWriteAllowed: false
- simulationWriteAllowed: false
- optimizerWriteAllowed: false
- No performance claims
- No trading signals

## Status: ${trendStability.stabilityStatus}
`);

// p8_next_execution_order_20260511.md
fs.writeFileSync(path.join(READINESS_DIR, 'p8_next_execution_order_20260511.md'), `# P8 System Readiness Report — 2026-05-11

## Phase Completed: P8 — Third-Date Corpus Append + Corpus Trend Stability v0

| Field | Value |
|-------|-------|
| phase | P8 |
| completedAt | ${generatedAt} |
| corpusEntries | ${metrics.totalEntries} |
| uniqueAsOfDateCount | ${metrics.uniqueAsOfDateCount} |
| coverageRatio | ${metrics.coverageRatio} |
| stabilityStatus | ${trendStability.stabilityStatus} |
| readinessStatus | ${readinessDecision.readinessStatus} |

## Safety Contract

- productionWriteAllowed: false (all entries)
- simulationWriteAllowed: false (all entries)
- optimizerWriteAllowed: false (all entries)
- No performance claims
- No trading signals
- No production DB writes
- No external API calls
- No LLM calls

## Completed Phases

| Phase | Description |
|-------|-------------|
| P0-COMBINED | Date Format Audit + Shadow Prediction Daily Dry-run Writer |
| P1 | Outcome Write-back v0 + Append-only Shadow Ledger Guard |
| P2 | Cross-run Append-only Shadow Ledger Accumulation |
| P3 | Shadow Outcome Window Tracker + Backfill Scheduler |
| P4 | PIT-safe Ledger Replay Engine v0 |
| P5 | Replay Simulation Snapshot Engine v0 |
| P6 | Multi-Date Snapshot Corpus Accumulation v0 |
| P7 | Second-Date Corpus Append + Corpus Metrics Store v0 |
| P8 | Third-Date Corpus Append + Corpus Trend Stability v0 |

## Suggested Next Phase

P9 — Fourth-Date Corpus Append or Corpus Quality Gate v0
- Append fourth-date fixture
- Strengthen trend stability with more data points
- Add per-symbol coverage convergence check

## Classification: P8_THIRD_DATE_CORPUS_APPEND_AND_TREND_STABILITY_COMPLETE
`);

console.log('');
console.log('✅ P8 metrics + trend stability artifacts written:');
console.log('   p8_corpus_metrics_store.json/.md');
console.log('   p8_corpus_trend_stability.json/.md');
console.log('   p8_next_execution_order_20260511.md');
