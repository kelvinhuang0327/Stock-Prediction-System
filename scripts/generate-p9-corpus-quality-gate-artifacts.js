#!/usr/bin/env node
/**
 * generate-p9-corpus-quality-gate-artifacts.js
 * Self-contained Node.js script — no TypeScript compilation required.
 *
 * SAFETY CONTRACT: no production DB write, no external API, no LLM, no trading signals.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '../outputs/online_validation');
const SYSTEM_READINESS_DIR = path.resolve(__dirname, '../outputs/system_readiness');
const CORPUS_PATH = path.join(BASE_DIR, 'simulation_snapshot_corpus.jsonl');

const METRICS_RUN_ID = 'p9-corpus-metrics-20260511-001';
const QUALITY_RUN_ID = 'p9-corpus-quality-gate-20260511-001';
const QUALITY_GATE_VERSION = 'corpus-quality-gate-v0';

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

// ─── JSONL parser ─────────────────────────────────────────────────

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

// ─── Inline: CorpusMetricsStore ───────────────────────────────────

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

function validateCorpusMetrics(metrics) {
    const messages = [];
    let valid = true;
    const guardrails = metrics.guardrails || {};
    if (!guardrails.noProductionWrite) { messages.push('FAIL: noProductionWrite'); valid = false; }
    if (!guardrails.noSimulationWrite) { messages.push('FAIL: noSimulationWrite'); valid = false; }
    if (!guardrails.noOptimizerWrite) { messages.push('FAIL: noOptimizerWrite'); valid = false; }
    if (!guardrails.noPerformanceClaim) { messages.push('FAIL: noPerformanceClaim'); valid = false; }
    if (!guardrails.noTradingSignal) { messages.push('FAIL: noTradingSignal'); valid = false; }
    if (hasForbiddenClaim(JSON.stringify(metrics))) { messages.push('FAIL: forbidden claim'); valid = false; }
    if (valid) messages.push('PASS: corpus metrics safety contracts verified');
    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
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
        readyTrendByAsOfDate: outcomeCoverageTrend.map(p => ({ asOfDate: p.asOfDate, readyCount: p.readyCount })),
        blockedTrendByAsOfDate: outcomeCoverageTrend.map(p => ({ asOfDate: p.asOfDate, blockedCount: p.blockedCount })),
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

// ─── Inline: CorpusQualityGate ────────────────────────────────────

function summarizePerSymbolCoverage(corpusEntries) {
    const bySymbol = {};
    for (const entry of corpusEntries) {
        if (!bySymbol[entry.symbol]) bySymbol[entry.symbol] = { total: 0, ready: 0 };
        bySymbol[entry.symbol].total++;
        if (entry.snapshotStatus === 'SNAPSHOT_READY') bySymbol[entry.symbol].ready++;
    }
    return Object.entries(bySymbol)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([symbol, { total, ready }]) => ({
            symbol,
            totalCount: total,
            readyCount: ready,
            blockedCount: total - ready,
            coverageRatio: total > 0 ? parseFloat((ready / total).toFixed(4)) : 0,
        }));
}

function summarizePerHorizonCoverage(corpusEntries) {
    const byHorizon = {};
    for (const entry of corpusEntries) {
        if (!byHorizon[entry.horizonLabel]) byHorizon[entry.horizonLabel] = { total: 0, ready: 0 };
        byHorizon[entry.horizonLabel].total++;
        if (entry.snapshotStatus === 'SNAPSHOT_READY') byHorizon[entry.horizonLabel].ready++;
    }
    const horizonOrder = { '5D': 0, '20D': 1, '60D': 2 };
    return Object.entries(byHorizon)
        .sort(([a], [b]) => (horizonOrder[a] ?? 99) - (horizonOrder[b] ?? 99))
        .map(([horizonLabel, { total, ready }]) => ({
            horizonLabel,
            totalCount: total,
            readyCount: ready,
            blockedCount: total - ready,
            coverageRatio: total > 0 ? parseFloat((ready / total).toFixed(4)) : 0,
        }));
}

function validateCorpusQualityGate(result) {
    const messages = [];
    let valid = true;
    const checks = result.qualityChecks || {};
    if (!checks.noProductionWrite) { messages.push('FAIL: noProductionWrite'); valid = false; }
    if (!checks.noSimulationWrite) { messages.push('FAIL: noSimulationWrite'); valid = false; }
    if (!checks.noOptimizerWrite) { messages.push('FAIL: noOptimizerWrite'); valid = false; }
    if (!checks.noPerformanceClaim) { messages.push('FAIL: noPerformanceClaim'); valid = false; }
    if (!checks.noTradingSignal) { messages.push('FAIL: noTradingSignal'); valid = false; }
    if (result.qualityStatus === 'PRODUCTION_READY') { messages.push('FAIL: PRODUCTION_READY forbidden'); valid = false; }
    if (hasForbiddenClaim(JSON.stringify(result))) { messages.push('FAIL: forbidden claim'); valid = false; }
    if (valid) messages.push('PASS: corpus quality gate safety contracts verified');
    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
}

function buildCorpusQualityGate(metrics, corpusEntries, options) {
    const minAsOfDateCount = options.minAsOfDateCount ?? 4;
    const minSymbolCount = options.minSymbolCount ?? 2;
    const minHorizonCount = options.minHorizonCount ?? 3;
    const minCoverageRatio = options.minCoverageRatio ?? 0.5;
    const maxSymbolCoverageGap = options.maxSymbolCoverageGap ?? 0.35;
    const maxHorizonCoverageGap = options.maxHorizonCoverageGap ?? 0.35;

    const perSymbolCoverage = summarizePerSymbolCoverage(corpusEntries);
    const perHorizonCoverage = summarizePerHorizonCoverage(corpusEntries);

    const symbolRatios = perSymbolCoverage.map(s => s.coverageRatio);
    const horizonRatios = perHorizonCoverage.map(h => h.coverageRatio);

    const symbolCoverageGap =
        symbolRatios.length >= 2
            ? parseFloat((Math.max(...symbolRatios) - Math.min(...symbolRatios)).toFixed(4))
            : 0;
    const horizonCoverageGap =
        horizonRatios.length >= 2
            ? parseFloat((Math.max(...horizonRatios) - Math.min(...horizonRatios)).toFixed(4))
            : 0;

    const hasEnoughDates = metrics.uniqueAsOfDateCount >= minAsOfDateCount;
    const hasEnoughSymbols = metrics.uniqueSymbolCount >= minSymbolCount;
    const hasEnoughHorizons = metrics.uniqueHorizonCount >= minHorizonCount;
    const coverageMeetsThreshold = metrics.coverageRatio >= minCoverageRatio;
    const symbolCoverageGapWithinLimit = symbolCoverageGap <= maxSymbolCoverageGap;
    const horizonCoverageGapWithinLimit = horizonCoverageGap <= maxHorizonCoverageGap;

    const qualityChecks = {
        hasEnoughDates,
        hasEnoughSymbols,
        hasEnoughHorizons,
        coverageMeetsThreshold,
        symbolCoverageGapWithinLimit,
        horizonCoverageGapWithinLimit,
        noProductionWrite: true,
        noSimulationWrite: true,
        noOptimizerWrite: true,
        noPerformanceClaim: true,
        noTradingSignal: true,
    };

    const reasons = [];
    let qualityStatus;

    if (metrics.totalEntries === 0 || metrics.readyCount === 0 || !coverageMeetsThreshold) {
        qualityStatus = 'BLOCKED';
        if (metrics.totalEntries === 0) reasons.push('corpus is empty => BLOCKED');
        if (metrics.readyCount === 0) reasons.push('readyCount=0 => BLOCKED');
        if (!coverageMeetsThreshold) reasons.push(`coverageRatio=${metrics.coverageRatio} < minCoverageRatio=${minCoverageRatio} => BLOCKED`);
    } else if (!hasEnoughDates || !hasEnoughSymbols || !hasEnoughHorizons || !symbolCoverageGapWithinLimit || !horizonCoverageGapWithinLimit) {
        qualityStatus = 'DATA_LIMITED';
        if (!hasEnoughDates) reasons.push(`uniqueAsOfDateCount=${metrics.uniqueAsOfDateCount} < minAsOfDateCount=${minAsOfDateCount} => DATA_LIMITED`);
        if (!hasEnoughSymbols) reasons.push(`uniqueSymbolCount=${metrics.uniqueSymbolCount} < minSymbolCount=${minSymbolCount} => DATA_LIMITED`);
        if (!hasEnoughHorizons) reasons.push(`uniqueHorizonCount=${metrics.uniqueHorizonCount} < minHorizonCount=${minHorizonCount} => DATA_LIMITED`);
        if (!symbolCoverageGapWithinLimit) reasons.push(`symbolCoverageGap=${symbolCoverageGap} > maxSymbolCoverageGap=${maxSymbolCoverageGap} => DATA_LIMITED`);
        if (!horizonCoverageGapWithinLimit) reasons.push(`horizonCoverageGap=${horizonCoverageGap} > maxHorizonCoverageGap=${maxHorizonCoverageGap} => DATA_LIMITED`);
    } else {
        qualityStatus = 'PASS_FOR_OBSERVABILITY_ONLY';
        reasons.push(`All quality gates pass: dates=${metrics.uniqueAsOfDateCount} symbols=${metrics.uniqueSymbolCount} horizons=${metrics.uniqueHorizonCount} coverage=${metrics.coverageRatio}`);
        reasons.push('Observability-only quality gate; no production, simulation, or optimizer writes permitted');
    }

    const result = {
        qualityGateVersion: QUALITY_GATE_VERSION,
        qualityRunId: options.qualityRunId,
        generatedAt: options.generatedAt,
        inputTotalEntries: metrics.totalEntries,
        inputAsOfDateCount: metrics.uniqueAsOfDateCount,
        inputSymbolCount: metrics.uniqueSymbolCount,
        inputHorizonCount: metrics.uniqueHorizonCount,
        coverageRatio: metrics.coverageRatio,
        perSymbolCoverage,
        perHorizonCoverage,
        symbolCoverageGap,
        horizonCoverageGap,
        qualityChecks,
        qualityStatus,
        reasons,
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateCorpusQualityGate(result);
    result.validationStatus = validation.status;
    result.validationMessages = validation.messages;
    return result;
}

// ─── Helpers ──────────────────────────────────────────────────────

function writeJson(filePath, data) {
    const text = JSON.stringify(data, null, 2);
    JSON.parse(text); // verify parseable
    fs.writeFileSync(filePath, text, 'utf8');
}

function writeMd(filePath, lines) {
    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

// ─── Main ──────────────────────────────────────────────────────────

function main() {
    const generatedAt = new Date().toISOString();

    console.log('=== P9 Corpus Quality Gate ===');
    console.log(`corpusPath: ${CORPUS_PATH}`);
    console.log(`metricsRunId: ${METRICS_RUN_ID}`);
    console.log(`qualityRunId: ${QUALITY_RUN_ID}`);
    console.log(`generatedAt: ${generatedAt}`);

    fs.mkdirSync(BASE_DIR, { recursive: true });
    fs.mkdirSync(SYSTEM_READINESS_DIR, { recursive: true });

    // Read and parse corpus
    const corpusContent = fs.readFileSync(CORPUS_PATH, 'utf8');
    const corpusEntries = parseSnapshotCorpusJsonl(corpusContent);

    // Build metrics
    const metrics = buildCorpusMetrics(corpusEntries, {
        metricsRunId: METRICS_RUN_ID,
        generatedAt,
        corpusPath: CORPUS_PATH,
    });

    // Validate preconditions
    if (metrics.totalEntries < 24) {
        throw new Error(`Expected corpus to have >=24 entries, got ${metrics.totalEntries}`);
    }
    if (metrics.uniqueAsOfDateCount < 4) {
        throw new Error(`Expected uniqueAsOfDateCount >=4, got ${metrics.uniqueAsOfDateCount}`);
    }
    if (metrics.uniqueSymbolCount < 2) {
        throw new Error(`Expected uniqueSymbolCount >=2, got ${metrics.uniqueSymbolCount}`);
    }
    if (metrics.uniqueHorizonCount < 3) {
        throw new Error(`Expected uniqueHorizonCount >=3, got ${metrics.uniqueHorizonCount}`);
    }
    if (metrics.coverageRatio < 0.5) {
        throw new Error(`Expected coverageRatio >=0.5, got ${metrics.coverageRatio}`);
    }

    // Build quality gate
    const qualityGate = buildCorpusQualityGate(metrics, corpusEntries, {
        qualityRunId: QUALITY_RUN_ID,
        generatedAt,
        minAsOfDateCount: 4,
        minSymbolCount: 2,
        minHorizonCount: 3,
        minCoverageRatio: 0.5,
        maxSymbolCoverageGap: 0.35,
        maxHorizonCoverageGap: 0.35,
    });

    if (qualityGate.qualityStatus === 'PRODUCTION_READY') {
        throw new Error('PRODUCTION_READY is forbidden');
    }
    if (qualityGate.validationStatus !== 'PASS') {
        throw new Error(`Quality gate validation failed: ${qualityGate.validationMessages.join('; ')}`);
    }

    // ─── Write p9_corpus_metrics_store.json/.md ───────────────────

    writeJson(path.join(BASE_DIR, 'p9_corpus_metrics_store.json'), metrics);
    writeMd(path.join(BASE_DIR, 'p9_corpus_metrics_store.md'), [
        '# P9 Corpus Metrics Store',
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

    // ─── Write p9_corpus_quality_gate.json/.md ───────────────────

    writeJson(path.join(BASE_DIR, 'p9_corpus_quality_gate.json'), qualityGate);
    writeMd(path.join(BASE_DIR, 'p9_corpus_quality_gate.md'), [
        '# P9 Corpus Quality Gate',
        '',
        `**qualityGateVersion:** ${qualityGate.qualityGateVersion}`,
        `**qualityRunId:** ${qualityGate.qualityRunId}`,
        `**generatedAt:** ${qualityGate.generatedAt}`,
        `**qualityStatus:** ${qualityGate.qualityStatus}`,
        `**validationStatus:** ${qualityGate.validationStatus}`,
        '',
        '## Coverage Summary',
        `- totalEntries: ${qualityGate.inputTotalEntries}`,
        `- asOfDateCount: ${qualityGate.inputAsOfDateCount}`,
        `- symbolCount: ${qualityGate.inputSymbolCount}`,
        `- horizonCount: ${qualityGate.inputHorizonCount}`,
        `- coverageRatio: ${qualityGate.coverageRatio.toFixed(4)}`,
        `- symbolCoverageGap: ${qualityGate.symbolCoverageGap}`,
        `- horizonCoverageGap: ${qualityGate.horizonCoverageGap}`,
        '',
        '## Per-Symbol Coverage',
        ...qualityGate.perSymbolCoverage.map(s =>
            `- ${s.symbol}: total=${s.totalCount}, ready=${s.readyCount}, blocked=${s.blockedCount}, ratio=${s.coverageRatio.toFixed(4)}`,
        ),
        '',
        '## Per-Horizon Coverage',
        ...qualityGate.perHorizonCoverage.map(h =>
            `- ${h.horizonLabel}: total=${h.totalCount}, ready=${h.readyCount}, blocked=${h.blockedCount}, ratio=${h.coverageRatio.toFixed(4)}`,
        ),
        '',
        '## Quality Checks',
        ...Object.entries(qualityGate.qualityChecks).map(([k, v]) => `- ${k}: ${v}`),
        '',
        '## Reasons',
        ...qualityGate.reasons.map(r => `- ${r}`),
        '',
        '> Observability-only quality gate. No performance claims. No production writes.',
    ]);

    // ─── Write p9_next_execution_order_20260511.md ─────────────────

    writeMd(path.join(SYSTEM_READINESS_DIR, 'p9_next_execution_order_20260511.md'), [
        '# P9 Next Execution Order — 2026-05-11',
        '',
        '## Completed This Round',
        '- Fourth-date corpus append (2026-05-14)',
        '- Corpus quality gate v0',
        `- corpus entries: ${metrics.totalEntries}`,
        `- uniqueAsOfDateCount: ${metrics.uniqueAsOfDateCount}`,
        `- coverageRatio: ${metrics.coverageRatio.toFixed(4)}`,
        `- qualityStatus: ${qualityGate.qualityStatus}`,
        '',
        '## Quality Gate Summary',
        `- hasEnoughDates: ${qualityGate.qualityChecks.hasEnoughDates}`,
        `- hasEnoughSymbols: ${qualityGate.qualityChecks.hasEnoughSymbols}`,
        `- hasEnoughHorizons: ${qualityGate.qualityChecks.hasEnoughHorizons}`,
        `- coverageMeetsThreshold: ${qualityGate.qualityChecks.coverageMeetsThreshold}`,
        `- symbolCoverageGapWithinLimit: ${qualityGate.qualityChecks.symbolCoverageGapWithinLimit}`,
        `- horizonCoverageGapWithinLimit: ${qualityGate.qualityChecks.horizonCoverageGapWithinLimit}`,
        '',
        '## Guardrails (ALL ENFORCED)',
        '- No production write',
        '- No simulation write',
        '- No optimizer write',
        '- No performance claim',
        '- No trading signal',
        '',
        '## Next Steps',
        '- P10: Dashboard-ready Metrics Contract v0',
        '- Convert corpus metrics / trend stability / quality gate into UI-ready artifact',
        '- Maintain observability-only status — do not enter optimizer',
    ]);

    // ─── Summary ─────────────────────────────────────────────────

    console.log(`\n✅ P9 corpus quality gate artifacts written successfully`);
    console.log(`   p9_corpus_metrics_store.json/.md`);
    console.log(`   p9_corpus_quality_gate.json/.md`);
    console.log(`   p9_next_execution_order_20260511.md`);
    console.log(`\nResults:`);
    console.log(`   totalEntries: ${metrics.totalEntries}`);
    console.log(`   uniqueAsOfDateCount: ${metrics.uniqueAsOfDateCount}`);
    console.log(`   uniqueSymbolCount: ${metrics.uniqueSymbolCount}`);
    console.log(`   uniqueHorizonCount: ${metrics.uniqueHorizonCount}`);
    console.log(`   coverageRatio: ${metrics.coverageRatio.toFixed(4)}`);
    console.log(`   symbolCoverageGap: ${qualityGate.symbolCoverageGap}`);
    console.log(`   horizonCoverageGap: ${qualityGate.horizonCoverageGap}`);
    console.log(`   qualityStatus: ${qualityGate.qualityStatus}`);
    console.log(`   validationStatus: ${qualityGate.validationStatus}`);
}

main();
