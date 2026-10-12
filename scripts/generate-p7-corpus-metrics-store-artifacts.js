#!/usr/bin/env node
/**
 * P7 Corpus Metrics Store Artifact Generator
 *
 * Self-contained Node entrypoint for observability-only corpus metrics.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '../outputs/online_validation');
const SYSTEM_READINESS_DIR = path.resolve(__dirname, '../outputs/system_readiness');
const CORPUS_PATH = path.join(BASE_DIR, 'simulation_snapshot_corpus.jsonl');
const METRICS_JSON = path.join(BASE_DIR, 'p7_corpus_metrics_store.json');
const METRICS_MD = path.join(BASE_DIR, 'p7_corpus_metrics_store.md');
const DECISION_JSON = path.join(BASE_DIR, 'p7_corpus_metrics_readiness_decision.json');
const DECISION_MD = path.join(BASE_DIR, 'p7_corpus_metrics_readiness_decision.md');
const NEXT_ORDER_MD = path.join(SYSTEM_READINESS_DIR, 'p7_next_execution_order_20260511.md');

const METRICS_RUN_ID = 'p7-corpus-metrics-20260511-001';
const GENERATED_AT = '2026-05-11T13:03:24.267+08:00';

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
    return FORBIDDEN_PATTERNS.some(pattern => pattern.test(text));
}

function parseSnapshotCorpusJsonl(content) {
    const entries = [];
    for (const [index, rawLine] of content.split('\n').entries()) {
        const line = rawLine.trim();
        if (!line) continue;
        try {
            entries.push(JSON.parse(line));
        } catch {
            throw new Error(`Malformed JSONL at line ${index + 1}: ${line.slice(0, 80)}`);
        }
    }
    return entries;
}

function increment(map, key) {
    map[key] = (map[key] || 0) + 1;
}

function buildOutcomeCoverageTrend(corpusEntries) {
    const buckets = {};
    for (const entry of corpusEntries) {
        const asOfDate = entry.originalAsOfDate;
        if (!buckets[asOfDate]) {
            buckets[asOfDate] = {
                asOfDate,
                totalCount: 0,
                readyCount: 0,
                blockedCount: 0,
                coverageRatio: 0,
                missingOutcomeCount: 0,
                notDueCount: 0,
            };
        }
        const bucket = buckets[asOfDate];
        bucket.totalCount += 1;
        if (entry.snapshotStatus === 'SNAPSHOT_READY') bucket.readyCount += 1;
        else bucket.blockedCount += 1;
        const outcomeAvailable = entry.outcomeSnapshot && entry.outcomeSnapshot.outcomeAvailable === true;
        if (!outcomeAvailable) bucket.missingOutcomeCount += 1;
        if (entry.snapshotBlockedReason === 'WINDOW_NOT_DUE') bucket.notDueCount += 1;
    }
    return Object.values(buckets)
        .sort((a, b) => a.asOfDate.localeCompare(b.asOfDate))
        .map(bucket => ({
            ...bucket,
            coverageRatio: bucket.totalCount > 0 ? bucket.readyCount / bucket.totalCount : 0,
        }));
}

function buildCorpusMetrics(corpusEntries, options) {
    const byAsOfDate = {};
    const bySymbol = {};
    const byHorizon = {};
    const bySnapshotStatus = {};
    const byBlockedReason = {};
    const perSymbolObservationCount = {};
    const perHorizonObservationCount = {};
    const symbolSet = new Set();
    const horizonSet = new Set();
    let readyCount = 0;
    let blockedCount = 0;

    for (const entry of corpusEntries) {
        increment(byAsOfDate, entry.originalAsOfDate);
        increment(bySymbol, entry.symbol);
        increment(byHorizon, entry.horizonLabel);
        increment(bySnapshotStatus, entry.snapshotStatus);
        increment(byBlockedReason, entry.snapshotBlockedReason);
        increment(perSymbolObservationCount, entry.symbol);
        increment(perHorizonObservationCount, entry.horizonLabel);
        symbolSet.add(entry.symbol);
        horizonSet.add(entry.horizonLabel);
        if (entry.snapshotStatus === 'SNAPSHOT_READY') readyCount += 1;
        else blockedCount += 1;
    }

    const totalEntries = corpusEntries.length;
    const coverageRatio = totalEntries > 0 ? readyCount / totalEntries : 0;
    const outcomeCoverageTrend = buildOutcomeCoverageTrend(corpusEntries);

    const metrics = {
        metricsVersion: 'corpus-metrics-v0',
        metricsRunId: options.metricsRunId,
        generatedAt: options.generatedAt,
        corpusPath: options.corpusPath,
        totalEntries,
        readyCount,
        blockedCount,
        uniqueAsOfDateCount: Object.keys(byAsOfDate).length,
        uniqueSymbolCount: symbolSet.size,
        uniqueHorizonCount: horizonSet.size,
        coverageRatio,
        byAsOfDate,
        bySymbol,
        byHorizon,
        bySnapshotStatus,
        byBlockedReason,
        perSymbolObservationCount,
        perHorizonObservationCount,
        outcomeCoverageTrend,
        readyTrendByAsOfDate: outcomeCoverageTrend.map(point => ({
            asOfDate: point.asOfDate,
            readyCount: point.readyCount,
        })),
        blockedTrendByAsOfDate: outcomeCoverageTrend.map(point => ({
            asOfDate: point.asOfDate,
            blockedCount: point.blockedCount,
        })),
        dataQualityFlags: [
            totalEntries === 0 ? 'EMPTY_CORPUS' : 'NON_EMPTY_CORPUS',
            outcomeCoverageTrend.length > 1 ? 'MULTI_DATE_CORPUS' : 'SINGLE_DATE_CORPUS',
            readyCount > 0 && blockedCount > 0 ? 'READY_AND_BLOCKED_PRESENT' : 'SINGLE_STATUS_ONLY',
            coverageRatio >= 0.5 ? 'COVERAGE_AT_OR_ABOVE_THRESHOLD' : 'COVERAGE_BELOW_THRESHOLD',
            'OBSERVABILITY_ONLY_METRICS',
        ],
        guardrails: {
            noProductionWrite: true,
            noSimulationWrite: true,
            noOptimizerWrite: true,
            noPerformanceClaim: true,
            noTradingSignal: true,
        },
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateCorpusMetrics(metrics);
    metrics.validationStatus = validation.status;
    metrics.validationMessages = validation.messages;
    return metrics;
}

function buildCorpusMetricsReadinessDecision(metrics, options = {}) {
    const minUniqueAsOfDateCount = options.minUniqueAsOfDateCount ?? 2;
    const minReadyCount = options.minReadyCount ?? 6;
    const minCoverageRatio = options.minCoverageRatio ?? 0.5;
    const guardrails = metrics.guardrails;
    const guardrailsOk =
        guardrails.noProductionWrite &&
        guardrails.noSimulationWrite &&
        guardrails.noOptimizerWrite &&
        guardrails.noPerformanceClaim &&
        guardrails.noTradingSignal;

    const reasons = [];
    let readinessStatus;
    let metricsReady = false;

    if (metrics.totalEntries === 0 || metrics.readyCount === 0) {
        readinessStatus = 'BLOCKED';
        reasons.push(`readyCount=${metrics.readyCount} or totalEntries=${metrics.totalEntries} => BLOCKED`);
    } else if (!guardrailsOk) {
        readinessStatus = 'BLOCKED';
        reasons.push('guardrails failed');
    } else if (
        metrics.uniqueAsOfDateCount >= minUniqueAsOfDateCount &&
        metrics.readyCount >= minReadyCount &&
        metrics.coverageRatio >= minCoverageRatio
    ) {
        readinessStatus = 'READY_FOR_OBSERVABILITY_ONLY_METRICS';
        metricsReady = true;
        reasons.push(`thresholds met: uniqueAsOfDateCount=${metrics.uniqueAsOfDateCount} readyCount=${metrics.readyCount} coverageRatio=${metrics.coverageRatio.toFixed(2)}`);
        reasons.push('Observability-only metrics; no production, simulation, or optimizer writes permitted');
    } else {
        readinessStatus = 'DATA_LIMITED';
        if (metrics.uniqueAsOfDateCount < minUniqueAsOfDateCount) {
            reasons.push(`uniqueAsOfDateCount=${metrics.uniqueAsOfDateCount} < minUniqueAsOfDateCount=${minUniqueAsOfDateCount}`);
        }
        if (metrics.readyCount < minReadyCount) {
            reasons.push(`readyCount=${metrics.readyCount} < minReadyCount=${minReadyCount}`);
        }
        if (metrics.coverageRatio < minCoverageRatio) {
            reasons.push(`coverageRatio=${metrics.coverageRatio.toFixed(2)} < minCoverageRatio=${minCoverageRatio}`);
        }
    }

    return {
        readinessVersion: 'corpus-metrics-readiness-v0',
        metricsReady,
        readinessStatus,
        reasons,
        guardrails,
    };
}

function validateCorpusMetrics(metrics) {
    const messages = [];
    let valid = true;
    const guardrails = metrics.guardrails || {};

    if (!guardrails.noProductionWrite) {
        messages.push('FAIL: noProductionWrite guardrail must be true');
        valid = false;
    }
    if (!guardrails.noSimulationWrite) {
        messages.push('FAIL: noSimulationWrite guardrail must be true');
        valid = false;
    }
    if (!guardrails.noOptimizerWrite) {
        messages.push('FAIL: noOptimizerWrite guardrail must be true');
        valid = false;
    }
    if (!guardrails.noPerformanceClaim) {
        messages.push('FAIL: noPerformanceClaim guardrail must be true');
        valid = false;
    }
    if (!guardrails.noTradingSignal) {
        messages.push('FAIL: noTradingSignal guardrail must be true');
        valid = false;
    }

    const text = JSON.stringify(metrics);
    if (hasForbiddenClaim(text)) {
        messages.push('FAIL: forbidden claim detected in metrics');
        valid = false;
    }
    if (/production write intent/i.test(text)) {
        messages.push('FAIL: production write intent is forbidden');
        valid = false;
    }
    if (/optimizer write intent/i.test(text)) {
        messages.push('FAIL: optimizer write intent is forbidden');
        valid = false;
    }

    if (valid) messages.push('PASS: corpus metrics safety contracts verified');
    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
}

function writeJson(filePath, data) {
    const text = JSON.stringify(data, null, 2);
    JSON.parse(text);
    fs.writeFileSync(filePath, text, 'utf8');
}

function writeMd(filePath, lines) {
    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

function main() {
    console.log('=== P7 Corpus Metrics Store ===');
    console.log(`corpusPath: ${CORPUS_PATH}`);
    console.log(`metricsRunId: ${METRICS_RUN_ID}`);
    console.log(`generatedAt: ${GENERATED_AT}`);

    const corpusContent = fs.readFileSync(CORPUS_PATH, 'utf8');
    const corpusEntries = parseSnapshotCorpusJsonl(corpusContent);
    const metrics = buildCorpusMetrics(corpusEntries, {
        metricsRunId: METRICS_RUN_ID,
        generatedAt: GENERATED_AT,
        corpusPath: CORPUS_PATH,
    });
    const readinessDecision = buildCorpusMetricsReadinessDecision(metrics);

    if (metrics.totalEntries < 12) {
        throw new Error(`Expected corpus to have >= 12 entries, got ${metrics.totalEntries}`);
    }
    if (metrics.uniqueAsOfDateCount < 2) {
        throw new Error(`Expected uniqueAsOfDateCount >= 2, got ${metrics.uniqueAsOfDateCount}`);
    }
    if (metrics.uniqueSymbolCount < 2) {
        throw new Error(`Expected uniqueSymbolCount >= 2, got ${metrics.uniqueSymbolCount}`);
    }
    if (metrics.coverageRatio < 0.5) {
        throw new Error(`Expected coverageRatio >= 0.5, got ${metrics.coverageRatio}`);
    }
    if (readinessDecision.readinessStatus === 'PRODUCTION_READY') {
        throw new Error('PRODUCTION_READY is forbidden');
    }

    writeJson(METRICS_JSON, metrics);
    writeMd(METRICS_MD, [
        '# P7 Corpus Metrics Store',
        '',
        `**metricsRunId:** ${metrics.metricsRunId}`,
        `**generatedAt:** ${metrics.generatedAt}`,
        `**corpusPath:** ${metrics.corpusPath}`,
        `**totalEntries:** ${metrics.totalEntries}`,
        `**readyCount:** ${metrics.readyCount}`,
        `**blockedCount:** ${metrics.blockedCount}`,
        `**uniqueAsOfDateCount:** ${metrics.uniqueAsOfDateCount}`,
        `**uniqueSymbolCount:** ${metrics.uniqueSymbolCount}`,
        `**uniqueHorizonCount:** ${metrics.uniqueHorizonCount}`,
        `**coverageRatio:** ${metrics.coverageRatio.toFixed(4)}`,
        '',
        '## Outcome Coverage Trend',
        ...metrics.outcomeCoverageTrend.map(
            point =>
                `- ${point.asOfDate}: total=${point.totalCount}, ready=${point.readyCount}, blocked=${point.blockedCount}, coverage=${point.coverageRatio.toFixed(4)}, missingOutcome=${point.missingOutcomeCount}, notDue=${point.notDueCount}`,
        ),
        '',
        '## Data Quality Flags',
        ...metrics.dataQualityFlags.map(flag => `- ${flag}`),
        '',
        '> Observability-only metrics. No performance claims. No trading signals.',
    ]);

    writeJson(DECISION_JSON, readinessDecision);
    writeMd(DECISION_MD, [
        '# P7 Corpus Metrics Readiness Decision',
        '',
        `**readinessVersion:** ${readinessDecision.readinessVersion}`,
        `**metricsReady:** ${readinessDecision.metricsReady}`,
        `**readinessStatus:** ${readinessDecision.readinessStatus}`,
        '',
        '## Reasons',
        ...readinessDecision.reasons.map(reason => `- ${reason}`),
        '',
        '## Guardrails',
        `- noProductionWrite: ${readinessDecision.guardrails.noProductionWrite}`,
        `- noSimulationWrite: ${readinessDecision.guardrails.noSimulationWrite}`,
        `- noOptimizerWrite: ${readinessDecision.guardrails.noOptimizerWrite}`,
        `- noPerformanceClaim: ${readinessDecision.guardrails.noPerformanceClaim}`,
        `- noTradingSignal: ${readinessDecision.guardrails.noTradingSignal}`,
        '',
        '> READY_FOR_OBSERVABILITY_ONLY_METRICS does not imply production readiness.',
    ]);

    writeMd(NEXT_ORDER_MD, [
        '# P7 Next Execution Order — 2026-05-11',
        '',
        '## Completed This Round',
        '- Second-date corpus append flow',
        '- Corpus metrics store v0',
        `- corpus entries: ${metrics.totalEntries}`,
        `- uniqueAsOfDateCount: ${metrics.uniqueAsOfDateCount}`,
        `- coverageRatio: ${metrics.coverageRatio.toFixed(4)}`,
        `- readinessStatus: ${readinessDecision.readinessStatus}`,
        '',
        '## Guardrails',
        '- No production write',
        '- No simulation write',
        '- No optimizer write',
        '- No performance claim',
        '- No trading signal',
        '',
        '## Next Steps',
        '- Continue observability-only corpus growth with additional asOfDate fixtures',
        '- Feed metrics store into future simulation metrics and optimizer sandbox phases',
    ]);

    console.log(`readinessStatus: ${readinessDecision.readinessStatus}`);
    console.log(`metricsReady: ${readinessDecision.metricsReady}`);
    console.log(`totalEntries: ${metrics.totalEntries}`);
    console.log(`uniqueAsOfDateCount: ${metrics.uniqueAsOfDateCount}`);
    console.log(`uniqueSymbolCount: ${metrics.uniqueSymbolCount}`);
    console.log(`coverageRatio: ${metrics.coverageRatio.toFixed(4)}`);
}

main();
