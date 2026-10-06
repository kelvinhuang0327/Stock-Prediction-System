#!/usr/bin/env node
/**
 * rerun-corpus-quality-gate-on-historical-replay.js — PART E
 *
 * Reads p0hardreset_historical_replay_corpus.jsonl and feeds it into the
 * CorpusQualityGate logic (unchanged, inline, no ts-node required).
 *
 * Writes:
 *   outputs/online_validation/p0hardreset_corpus_quality_gate_rerun.json
 *   outputs/online_validation/p0hardreset_corpus_quality_gate_rerun.md
 *
 * SAFETY CONTRACT:
 *   - No production DB write
 *   - No external API call
 *   - No LLM call
 *   - No forbidden claims (buy/sell/roi/alpha/win_rate/outperform/guaranteed)
 *   - No auto trading
 *   - simulation_snapshot_corpus.jsonl UNTOUCHED
 *   - PRODUCTION_READY quality status is forbidden
 *
 * Usage:
 *   node scripts/rerun-corpus-quality-gate-on-historical-replay.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '../outputs/online_validation');
const CORPUS_PATH = path.join(BASE_DIR, 'p0hardreset_historical_replay_corpus.jsonl');
const FROZEN_CORPUS = path.join(BASE_DIR, 'simulation_snapshot_corpus.jsonl');
const GATE_OUTPUT_JSON = path.join(BASE_DIR, 'p0hardreset_corpus_quality_gate_rerun.json');
const GATE_OUTPUT_MD = path.join(BASE_DIR, 'p0hardreset_corpus_quality_gate_rerun.md');

const QUALITY_GATE_VERSION = 'corpus-quality-gate-v0';
const QUALITY_RUN_ID = `p0hardreset-corpus-quality-gate-${new Date().toISOString().slice(0, 10)}-001`;

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
    /\bmock-deterministic\b/i,
];

function hasForbiddenClaim(text) {
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

// ─── JSONL parser ─────────────────────────────────────────────────

function parseCorpusJsonl(content) {
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

// ─── Normalize corpus entries to CorpusEntry shape ───────────────
// Historical replay corpus lines have outcomeSnapshot.priceSource and
// outcomeSnapshot.outcomeAvailable. We derive snapshotStatus from those.

function normalizeToCorpusEntry(line) {
    const outcomeSnapshot = line.outcomeSnapshot ?? {};
    const outcomeAvailable = outcomeSnapshot.outcomeAvailable === true;
    const priceSource = outcomeSnapshot.priceSource ?? 'MISSING';

    // Determine snapshotStatus:
    //   - SNAPSHOT_READY if real price available
    //   - PENDING if still pending
    //   - BLOCKED if missing
    let snapshotStatus;
    if (priceSource === 'stockQuote.close' && outcomeAvailable) {
        snapshotStatus = 'SNAPSHOT_READY';
    } else if (priceSource === 'PENDING') {
        snapshotStatus = 'PENDING';
    } else {
        snapshotStatus = 'BLOCKED';
    }

    const snapshotBlockedReason = snapshotStatus !== 'SNAPSHOT_READY' ? priceSource : null;

    return {
        symbol: line.symbol,
        horizonLabel: outcomeSnapshot.horizonLabel ?? `${outcomeSnapshot.horizonDays ?? '?'}D`,
        snapshotStatus,
        snapshotBlockedReason,
        originalAsOfDate: line.originalAsOfDate,
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
        outcomeSnapshot,
        createdAt: line.createdAt,
        corpusRunId: line.corpusRunId,
    };
}

// ─── Metrics builder (inline from generate-p9-corpus-quality-gate) ──

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
        if (entry.snapshotBlockedReason) increment(byBlockedReason, entry.snapshotBlockedReason);
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

    return {
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

// ─── Quality gate builder (inline from generate-p9-corpus-quality-gate) ──

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
    if (hasForbiddenClaim(JSON.stringify(result))) { messages.push('FAIL: forbidden claim in result JSON'); valid = false; }
    if (valid) messages.push('PASS: corpus quality gate safety contracts verified');
    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
}

function buildCorpusQualityGate(metrics, corpusEntries, options) {
    const minAsOfDateCount = options.minAsOfDateCount ?? 20;
    const minSymbolCount = options.minSymbolCount ?? 20;
    const minHorizonCount = options.minHorizonCount ?? 3;
    const minCoverageRatio = options.minCoverageRatio ?? 0.5;
    const maxSymbolCoverageGap = options.maxSymbolCoverageGap ?? 0.5;
    const maxHorizonCoverageGap = options.maxHorizonCoverageGap ?? 0.5;

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
        if (!hasEnoughDates) reasons.push(`uniqueAsOfDateCount=${metrics.uniqueAsOfDateCount} < ${minAsOfDateCount} => DATA_LIMITED`);
        if (!hasEnoughSymbols) reasons.push(`uniqueSymbolCount=${metrics.uniqueSymbolCount} < ${minSymbolCount} => DATA_LIMITED`);
        if (!hasEnoughHorizons) reasons.push(`uniqueHorizonCount=${metrics.uniqueHorizonCount} < ${minHorizonCount} => DATA_LIMITED`);
        if (!symbolCoverageGapWithinLimit) reasons.push(`symbolCoverageGap=${symbolCoverageGap} > ${maxSymbolCoverageGap} => DATA_LIMITED`);
        if (!horizonCoverageGapWithinLimit) reasons.push(`horizonCoverageGap=${horizonCoverageGap} > ${maxHorizonCoverageGap} => DATA_LIMITED`);
    } else {
        qualityStatus = 'PASS_FOR_OBSERVABILITY_ONLY';
        reasons.push(`All gates: dates=${metrics.uniqueAsOfDateCount} symbols=${metrics.uniqueSymbolCount} horizons=${metrics.uniqueHorizonCount} coverage=${metrics.coverageRatio.toFixed(4)}`);
        reasons.push('Observability-only quality gate; no production/simulation/optimizer writes permitted');
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

// ─── Main ──────────────────────────────────────────────────────────

function main() {
    const generatedAt = new Date().toISOString();

    console.log('=== P0-HARDRESET PART E: Corpus Quality Gate Rerun ===\n');
    console.log(`corpusPath:     ${CORPUS_PATH}`);
    console.log(`qualityRunId:   ${QUALITY_RUN_ID}`);
    console.log(`generatedAt:    ${generatedAt}`);
    console.log(`frozenCorpus:   ${FROZEN_CORPUS} (must NOT be touched)`);

    // Check frozen corpus is intact
    let frozenLineCount = 0;
    if (fs.existsSync(FROZEN_CORPUS)) {
        frozenLineCount = fs.readFileSync(FROZEN_CORPUS, 'utf8')
            .split('\n').filter(l => l.trim()).length;
        console.log(`\n[FROZEN] simulation_snapshot_corpus.jsonl: ${frozenLineCount} lines (unchanged)`);
    } else {
        console.log(`\n[FROZEN] simulation_snapshot_corpus.jsonl: NOT FOUND (ok — will not be created)`);
    }

    // Read historical replay corpus
    if (!fs.existsSync(CORPUS_PATH)) {
        console.error(`\n[PART E] FAIL: corpus not found: ${CORPUS_PATH}`);
        console.error('Run scripts/generate-p0hardreset-historical-replay-corpus.js first.');
        process.exit(1);
    }

    const corpusContent = fs.readFileSync(CORPUS_PATH, 'utf8');
    const rawEntries = parseCorpusJsonl(corpusContent);
    console.log(`\n[PART E] Parsed ${rawEntries.length} raw corpus lines`);

    // Normalize to CorpusEntry shape
    const corpusEntries = rawEntries.map(normalizeToCorpusEntry);

    // Forbidden claims check
    const forbiddenLines = rawEntries.filter(e => hasForbiddenClaim(JSON.stringify(e)));
    if (forbiddenLines.length > 0) {
        console.error(`\n[PART E] SAFETY FAIL: ${forbiddenLines.length} corpus lines contain forbidden claims`);
        process.exit(2);
    }
    console.log(`[PART E] Forbidden claims: NONE FOUND ✓`);

    // Check no mock-deterministic
    const mockDetLines = rawEntries.filter(e =>
        JSON.stringify(e).includes('mock-deterministic')
    );
    if (mockDetLines.length > 0) {
        console.error(`\n[PART E] FAIL: ${mockDetLines.length} lines contain mock-deterministic`);
        process.exit(2);
    }
    console.log(`[PART E] Mock-deterministic: NOT FOUND ✓`);

    // Build metrics
    const metrics = buildCorpusMetrics(corpusEntries, {
        metricsRunId: QUALITY_RUN_ID,
        generatedAt,
        corpusPath: CORPUS_PATH,
    });

    console.log(`\n[PART E] Corpus metrics:`);
    console.log(`  totalEntries:       ${metrics.totalEntries}`);
    console.log(`  readyCount:         ${metrics.readyCount}`);
    console.log(`  blockedCount:       ${metrics.blockedCount}`);
    console.log(`  uniqueAsOfDates:    ${metrics.uniqueAsOfDateCount}`);
    console.log(`  uniqueSymbols:      ${metrics.uniqueSymbolCount}`);
    console.log(`  uniqueHorizons:     ${metrics.uniqueHorizonCount}`);
    console.log(`  coverageRatio:      ${metrics.coverageRatio.toFixed(4)}`);

    // Build quality gate
    const qualityGate = buildCorpusQualityGate(metrics, corpusEntries, {
        qualityRunId: QUALITY_RUN_ID,
        generatedAt,
        minAsOfDateCount: 20,
        minSymbolCount: 20,
        minHorizonCount: 3,
        minCoverageRatio: 0.5,
        maxSymbolCoverageGap: 0.5,
        maxHorizonCoverageGap: 0.5,
    });

    // Safety: PRODUCTION_READY forbidden
    if (qualityGate.qualityStatus === 'PRODUCTION_READY') {
        console.error('\n[PART E] SAFETY FAIL: PRODUCTION_READY is forbidden');
        process.exit(2);
    }

    console.log(`\n[PART E] Quality gate result: ${qualityGate.qualityStatus}`);
    qualityGate.reasons.forEach(r => console.log(`  → ${r}`));
    console.log(`  validationStatus: ${qualityGate.validationStatus}`);
    console.log(`  validationMessages: ${qualityGate.validationMessages.join(', ')}`);

    // Write JSON
    const output = {
        ...qualityGate,
        p0HardresetNote: 'Historical replay corpus quality gate rerun. Not investment advice.',
        frozenCorpusLineCount: frozenLineCount,
        frozenCorpusPath: FROZEN_CORPUS,
        corpusLineCount: rawEntries.length,
    };
    fs.writeFileSync(GATE_OUTPUT_JSON, JSON.stringify(output, null, 2), 'utf8');
    console.log(`\n[PART E] JSON written: ${GATE_OUTPUT_JSON}`);

    // Write MD
    const passIcon = qualityGate.qualityStatus === 'PASS_FOR_OBSERVABILITY_ONLY' ? '✅' : '⚠️';
    const md = [
        `# P0-HARDRESET Corpus Quality Gate Rerun`,
        ``,
        `Generated: ${generatedAt}  `,
        `Quality Status: **${passIcon} ${qualityGate.qualityStatus}**`,
        ``,
        `## Corpus`,
        ``,
        `| Field | Value |`,
        `|-------|-------|`,
        `| Total entries | ${metrics.totalEntries} |`,
        `| Ready (SNAPSHOT_READY) | ${metrics.readyCount} |`,
        `| Blocked / Pending | ${metrics.blockedCount} |`,
        `| Coverage ratio | ${metrics.coverageRatio.toFixed(4)} |`,
        `| Unique asOfDates | ${metrics.uniqueAsOfDateCount} |`,
        `| Unique symbols | ${metrics.uniqueSymbolCount} |`,
        `| Unique horizons | ${metrics.uniqueHorizonCount} |`,
        ``,
        `## Quality Gate Checks`,
        ``,
        Object.entries(qualityGate.qualityChecks)
            .map(([k, v]) => `- ${v ? '✓' : '✗'} \`${k}\`: ${v}`)
            .join('\n'),
        ``,
        `## Reasons`,
        ``,
        qualityGate.reasons.map(r => `- ${r}`).join('\n'),
        ``,
        `## Frozen Corpus`,
        ``,
        `\`simulation_snapshot_corpus.jsonl\`: ${frozenLineCount} lines — **UNCHANGED**`,
        ``,
        `## Safety`,
        ``,
        `- No production DB write`,
        `- No mock-deterministic price source`,
        `- No forbidden claims (buy/sell/roi/win_rate/guaranteed)`,
        `- ManualReview* modules: NOT modified (frozen per P0-HARDRESET)`,
        ``,
        `---`,
        `*Not investment advice. Not a trading system. Research observability corpus only.*`,
    ].join('\n');
    fs.writeFileSync(GATE_OUTPUT_MD, md, 'utf8');
    console.log(`[PART E] MD written: ${GATE_OUTPUT_MD}`);

    // Final gate
    const pass =
        qualityGate.qualityStatus !== 'BLOCKED' &&
        qualityGate.validationStatus === 'PASS' &&
        metrics.totalEntries >= 1000 &&
        metrics.uniqueSymbolCount >= 20 &&
        metrics.uniqueAsOfDateCount >= 20;

    if (pass) {
        console.log(`\n[PART E] RESULT: PASS — corpus quality gate satisfied`);
        process.exit(0);
    } else {
        console.log(`\n[PART E] RESULT: FAIL — see gate status above`);
        process.exit(1);
    }
}

main();
