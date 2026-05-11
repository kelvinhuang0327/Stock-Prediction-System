#!/usr/bin/env node
/**
 * generate-p6-simulation-snapshot-corpus-artifacts.js
 *
 * P6 Integration Script — Multi-Date Snapshot Corpus Accumulation v0
 *
 * Reads the P5 simulation snapshot batch and accumulates entries into
 * an append-only corpus JSONL with summary and readiness decision.
 *
 * SAFETY CONTRACT:
 * - No production DB write
 * - No external API calls
 * - No LLM calls
 * - No trading signals
 * - No performance claims
 * - productionWriteAllowed: false LOCKED
 * - simulationWriteAllowed: false LOCKED
 * - optimizerWriteAllowed: false LOCKED
 * - dryRun: true
 * - append-only: duplicate key => DUPLICATE_KEY_BLOCKED
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────

const CORPUS_VERSION = 'sim-corpus-v0';
const CORPUS_ENTRY_TYPE = 'SIMULATION_SNAPSHOT';
const CORPUS_READINESS_VERSION = 'corpus-readiness-v0';
const CORPUS_RUN_ID = 'p6-snapshot-corpus-20260511-001';
const INGESTION_DATE = '2026-05-11';

const INPUT_BATCH = path.resolve(process.cwd(), 'outputs/online_validation/p5_simulation_snapshot_batch.json');
const CORPUS_PATH = path.resolve(process.cwd(), 'outputs/online_validation/simulation_snapshot_corpus.jsonl');
const OUT_DIR = path.resolve(process.cwd(), 'outputs/online_validation');
const SYS_DIR = path.resolve(process.cwd(), 'outputs/system_readiness');

// ─── Forbidden claim patterns ─────────────────────────────────────

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
];

function hasForbiddenClaim(text) {
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

// ─── Core logic (inline, no TypeScript deps) ──────────────────────

function buildCorpusEntryKey(snapshot) {
    const runId = String(snapshot.simulationRunId ?? '');
    const asOfDate = String(snapshot.originalAsOfDate ?? '');
    const symbol = String(snapshot.symbol ?? '');
    const tier = String(snapshot.universeTier ?? '');
    const horizon = String(snapshot.horizonLabel ?? '');
    return `SIM_CORPUS|${runId}|${asOfDate}|${symbol}|${tier}|${horizon}`;
}

function normalizeSnapshot(snapshot) {
    return {
        corpusVersion: CORPUS_VERSION,
        corpusRunId: CORPUS_RUN_ID,
        corpusEntryKey: buildCorpusEntryKey(snapshot),
        entryType: CORPUS_ENTRY_TYPE,
        sourceSimulationRunId: String(snapshot.simulationRunId ?? ''),
        simulationSnapshotKey: String(snapshot.simulationSnapshotKey ?? ''),
        replayKey: String(snapshot.replayKey ?? ''),
        originalRunId: String(snapshot.originalRunId ?? ''),
        originalAsOfDate: String(snapshot.originalAsOfDate ?? ''),
        symbol: String(snapshot.symbol ?? ''),
        stockName: String(snapshot.stockName ?? ''),
        universeTier: String(snapshot.universeTier ?? ''),
        horizonLabel: String(snapshot.horizonLabel ?? ''),
        horizonDays: Number(snapshot.horizonDays ?? 0),
        targetTradingDate: String(snapshot.targetTradingDate ?? ''),
        reviewDate: String(snapshot.reviewDate ?? ''),
        researchBucket: String(snapshot.researchBucket ?? ''),
        scoreSnapshot: snapshot.scoreSnapshot ?? {},
        confidenceSnapshot: snapshot.confidenceSnapshot ?? null,
        factorSnapshot: snapshot.factorSnapshot ?? [],
        riskSnapshot: snapshot.riskSnapshot ?? [],
        limitationSnapshot: snapshot.limitationSnapshot ?? [],
        dataCoverageSnapshot: snapshot.dataCoverageSnapshot ?? null,
        sourceDateBasis: snapshot.sourceDateBasis ?? null,
        outcomeSnapshot: snapshot.outcomeSnapshot ?? null,
        snapshotStatus: String(snapshot.snapshotStatus ?? 'SNAPSHOT_BLOCKED'),
        snapshotBlockedReason: String(snapshot.snapshotBlockedReason ?? 'UNKNOWN'),
        pitSafeStatus: String(snapshot.pitSafeStatus ?? 'UNKNOWN'),
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
        createdAt: new Date().toISOString(),
        validationMessages: snapshot.validationMessages ?? [],
        ingestionDate: INGESTION_DATE,
    };
}

function parseJsonl(content) {
    const lines = content.split('\n');
    const entries = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
            entries.push(JSON.parse(line));
        } catch (e) {
            throw new Error(`Malformed JSONL at line ${i + 1}: ${line.slice(0, 80)}`);
        }
    }
    return entries;
}

function summarize(corpusEntries) {
    const byAsOfDate = {};
    const bySymbol = {};
    const byHorizon = {};
    const byResearchBucket = {};
    const bySnapshotStatus = {};
    const byBlockedReason = {};
    const simulationRunIds = new Set();
    const asOfDates = [];
    const targetDates = [];
    let readyCount = 0;
    let blockedCount = 0;
    let outcomeAvailableCount = 0;
    let missingOutcomeCount = 0;

    for (const e of corpusEntries) {
        simulationRunIds.add(e.sourceSimulationRunId);
        byAsOfDate[e.originalAsOfDate] = (byAsOfDate[e.originalAsOfDate] ?? 0) + 1;
        bySymbol[e.symbol] = (bySymbol[e.symbol] ?? 0) + 1;
        byHorizon[e.horizonLabel] = (byHorizon[e.horizonLabel] ?? 0) + 1;
        byResearchBucket[e.researchBucket] = (byResearchBucket[e.researchBucket] ?? 0) + 1;
        bySnapshotStatus[e.snapshotStatus] = (bySnapshotStatus[e.snapshotStatus] ?? 0) + 1;
        byBlockedReason[e.snapshotBlockedReason] = (byBlockedReason[e.snapshotBlockedReason] ?? 0) + 1;

        if (e.snapshotStatus === 'SNAPSHOT_READY') readyCount++;
        else blockedCount++;

        const os = e.outcomeSnapshot;
        if (os && os.outcomeAvailable === true) outcomeAvailableCount++;
        else missingOutcomeCount++;

        if (e.originalAsOfDate) asOfDates.push(e.originalAsOfDate);
        if (e.targetTradingDate) targetDates.push(e.targetTradingDate);
    }

    asOfDates.sort();
    targetDates.sort();

    const totalEntries = corpusEntries.length;
    const coverageRatio = totalEntries > 0 ? readyCount / totalEntries : 0;

    return {
        corpusVersion: CORPUS_VERSION,
        totalEntries,
        readyCount,
        blockedCount,
        uniqueSimulationRunCount: simulationRunIds.size,
        uniqueAsOfDateCount: Object.keys(byAsOfDate).length,
        uniqueSymbolCount: Object.keys(bySymbol).length,
        byAsOfDate,
        bySymbol,
        byHorizon,
        byResearchBucket,
        bySnapshotStatus,
        byBlockedReason,
        outcomeAvailableCount,
        missingOutcomeCount,
        earliestAsOfDate: asOfDates[0] ?? null,
        latestAsOfDate: asOfDates[asOfDates.length - 1] ?? null,
        earliestTargetTradingDate: targetDates[0] ?? null,
        latestTargetTradingDate: targetDates[targetDates.length - 1] ?? null,
        coverageRatio,
    };
}

function buildReadinessDecision(summary) {
    const minReadyCount = 3;
    const minUniqueAsOfDateCount = 1;
    const minUniqueSymbolCount = 2;
    const minCoverageRatio = 0.5;

    const guardrails = {
        noProductionWrite: true,
        noSimulationWrite: true,
        noOptimizerWrite: true,
        noPerformanceClaim: true,
        noTradingSignal: true,
    };

    const reasons = [];
    let corpusReady = false;
    let readinessStatus;

    if (summary.totalEntries === 0 || summary.readyCount === 0) {
        readinessStatus = 'BLOCKED';
        reasons.push(`readyCount=${summary.readyCount} totalEntries=${summary.totalEntries} => BLOCKED`);
    } else {
        const thresholdMessages = [];
        let thresholdsMet = true;

        if (summary.readyCount < minReadyCount) {
            thresholdsMet = false;
            thresholdMessages.push(`readyCount=${summary.readyCount} < minReadyCount=${minReadyCount}`);
        }
        if (summary.uniqueAsOfDateCount < minUniqueAsOfDateCount) {
            thresholdsMet = false;
            thresholdMessages.push(`uniqueAsOfDateCount=${summary.uniqueAsOfDateCount} < min=${minUniqueAsOfDateCount}`);
        }
        if (summary.uniqueSymbolCount < minUniqueSymbolCount) {
            thresholdsMet = false;
            thresholdMessages.push(`uniqueSymbolCount=${summary.uniqueSymbolCount} < min=${minUniqueSymbolCount}`);
        }
        if (summary.coverageRatio < minCoverageRatio) {
            thresholdsMet = false;
            thresholdMessages.push(`coverageRatio=${summary.coverageRatio.toFixed(2)} < min=${minCoverageRatio}`);
        }

        if (thresholdsMet) {
            readinessStatus = 'READY_FOR_OBSERVABILITY_ONLY_CORPUS';
            corpusReady = true;
            reasons.push(`All thresholds met: readyCount=${summary.readyCount} uniqueSymbols=${summary.uniqueSymbolCount} coverageRatio=${summary.coverageRatio.toFixed(2)}`);
            reasons.push('Observability-only corpus. No production, simulation, or optimizer writes permitted.');
        } else {
            readinessStatus = 'DATA_LIMITED';
            corpusReady = false;
            reasons.push(...thresholdMessages);
        }
    }

    return {
        readinessVersion: CORPUS_READINESS_VERSION,
        corpusReady,
        readinessStatus,
        reasons,
        guardrails,
    };
}

function writeJson(filePath, data) {
    const text = JSON.stringify(data, null, 2);
    JSON.parse(text); // verify parseable
    fs.writeFileSync(filePath, text, 'utf8');
    console.log(`  [OK] ${path.basename(filePath)}`);
}

function writeMd(filePath, lines) {
    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
    console.log(`  [OK] ${path.basename(filePath)}`);
}

// ─── Main ─────────────────────────────────────────────────────────

console.log('=== P6 Simulation Snapshot Corpus Accumulation ===');
console.log(`corpusRunId: ${CORPUS_RUN_ID}`);
console.log(`ingestionDate: ${INGESTION_DATE}`);
console.log(`dryRun: true, append: true`);
console.log('');

// 1. Read P5 batch
const batchData = JSON.parse(fs.readFileSync(INPUT_BATCH, 'utf8'));
const snapshots = batchData.snapshots;
console.log(`Input snapshots: ${snapshots.length}`);

// 2. Normalize all snapshots
const newEntries = snapshots.map(normalizeSnapshot);

// 3. Read existing corpus
let existingContent = '';
let existingEntries = [];
if (fs.existsSync(CORPUS_PATH)) {
    existingContent = fs.readFileSync(CORPUS_PATH, 'utf8');
    existingEntries = existingContent.trim() ? parseJsonl(existingContent) : [];
}
const existingCount = existingEntries.length;
const existingKeys = new Set(existingEntries.map(e => e.corpusEntryKey));

// 4. Check for duplicates
const duplicateKeys = [];
const toAppend = [];
const newKeySeen = new Set();

for (const entry of newEntries) {
    if (existingKeys.has(entry.corpusEntryKey) || newKeySeen.has(entry.corpusEntryKey)) {
        duplicateKeys.push(entry.corpusEntryKey);
    } else {
        toAppend.push(entry);
        newKeySeen.add(entry.corpusEntryKey);
    }
}

const accumulationResult = {
    corpusRunId: CORPUS_RUN_ID,
    ingestionDate: INGESTION_DATE,
    dryRun: true,
    append: true,
    incomingCount: newEntries.length,
    appendedCount: 0,
    existingCount,
    totalAfterAppend: existingCount,
    duplicateCount: duplicateKeys.length,
    appendStatus: duplicateKeys.length > 0 ? 'DUPLICATE_KEY_BLOCKED' : 'PASS',
    duplicateKeys,
    validationMessages: [],
};

if (duplicateKeys.length > 0) {
    console.log(`\n[WARN] DUPLICATE_KEY_BLOCKED: ${duplicateKeys.length} duplicate key(s) detected.`);
    console.log('Existing corpus NOT modified. No entries appended.');
    accumulationResult.validationMessages.push(`DUPLICATE_KEY_BLOCKED: ${duplicateKeys.join(', ')}`);
} else {
    // Append to corpus
    const newLines = toAppend.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.appendFileSync(CORPUS_PATH, newLines, 'utf8');
    accumulationResult.appendedCount = toAppend.length;
    accumulationResult.totalAfterAppend = existingCount + toAppend.length;
    accumulationResult.validationMessages.push(`Appended ${toAppend.length} entries to corpus.`);
    console.log(`Appended ${toAppend.length} entries to corpus JSONL.`);
}

// 5. Read corpus for summary
const corpusContent = fs.readFileSync(CORPUS_PATH, 'utf8');
const corpusEntries = parseJsonl(corpusContent);
const summary = summarize(corpusEntries);
const readinessDecision = buildReadinessDecision(summary);

// 6. Write artifacts
console.log('\nWriting artifacts:');
[OUT_DIR, SYS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

writeJson(path.join(OUT_DIR, 'p6_snapshot_corpus_accumulation_result.json'), accumulationResult);
writeJson(path.join(OUT_DIR, 'p6_snapshot_corpus_summary.json'), summary);
writeJson(path.join(OUT_DIR, 'p6_snapshot_corpus_readiness_decision.json'), readinessDecision);

writeMd(path.join(OUT_DIR, 'p6_snapshot_corpus_accumulation_result.md'), [
    '# P6 Snapshot Corpus Accumulation Result',
    '',
    `**corpusRunId:** ${accumulationResult.corpusRunId}`,
    `**ingestionDate:** ${accumulationResult.ingestionDate}`,
    `**appendStatus:** ${accumulationResult.appendStatus}`,
    `**incomingCount:** ${accumulationResult.incomingCount}`,
    `**appendedCount:** ${accumulationResult.appendedCount}`,
    `**existingCount:** ${accumulationResult.existingCount}`,
    `**totalAfterAppend:** ${accumulationResult.totalAfterAppend}`,
    `**duplicateCount:** ${accumulationResult.duplicateCount}`,
    '',
    '## Validation Messages',
    ...accumulationResult.validationMessages.map(m => `- ${m}`),
    '',
    '> Safety: No production write, no simulation write, no optimizer write, no performance claims.',
]);

writeMd(path.join(OUT_DIR, 'p6_snapshot_corpus_summary.md'), [
    '# P6 Snapshot Corpus Summary',
    '',
    `**totalEntries:** ${summary.totalEntries}`,
    `**readyCount:** ${summary.readyCount}`,
    `**blockedCount:** ${summary.blockedCount}`,
    `**uniqueSymbolCount:** ${summary.uniqueSymbolCount}`,
    `**uniqueAsOfDateCount:** ${summary.uniqueAsOfDateCount}`,
    `**coverageRatio:** ${summary.coverageRatio.toFixed(4)}`,
    '',
    '## By Snapshot Status',
    ...Object.entries(summary.bySnapshotStatus).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## By Symbol',
    ...Object.entries(summary.bySymbol).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## By Horizon',
    ...Object.entries(summary.byHorizon).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '> Observability-only. No performance claims.',
]);

writeMd(path.join(OUT_DIR, 'p6_snapshot_corpus_readiness_decision.md'), [
    '# P6 Corpus Readiness Decision',
    '',
    `**readinessStatus:** ${readinessDecision.readinessStatus}`,
    `**corpusReady:** ${readinessDecision.corpusReady}`,
    '',
    '## Reasons',
    ...readinessDecision.reasons.map(r => `- ${r}`),
    '',
    '## Guardrails',
    `- noProductionWrite: ${readinessDecision.guardrails.noProductionWrite}`,
    `- noSimulationWrite: ${readinessDecision.guardrails.noSimulationWrite}`,
    `- noOptimizerWrite: ${readinessDecision.guardrails.noOptimizerWrite}`,
    `- noPerformanceClaim: ${readinessDecision.guardrails.noPerformanceClaim}`,
    `- noTradingSignal: ${readinessDecision.guardrails.noTradingSignal}`,
    '',
    '> corpusReady=true means OBSERVABILITY-ONLY — NOT production-ready.',
]);

writeMd(path.join(SYS_DIR, 'p6_next_execution_order_20260511.md'), [
    '# P6 Next Execution Order — 2026-05-11',
    '',
    '## Completed This Round',
    '- P6 Multi-Date Snapshot Corpus Accumulation v0',
    `- corpusRunId: ${CORPUS_RUN_ID}`,
    `- appendedCount: ${accumulationResult.appendedCount}`,
    `- totalCorpusEntries: ${summary.totalEntries}`,
    `- readinessStatus: ${readinessDecision.readinessStatus}`,
    '',
    '## Next Steps',
    '- P7: Corpus-level Metrics Store (aggregate simulation observations)',
    '- P8: Optimizer Sandbox (parameter sweep on corpus data)',
    '',
    '## Guardrails',
    '- No production write',
    '- No simulation write',
    '- No optimizer write',
    '- No performance claims',
    '- No trading signals',
]);

console.log(`\n[OK] simulation_snapshot_corpus.jsonl (${corpusEntries.length} entries total)`);

// 7. Verify all corpus entries
console.log('\nVerifying corpus JSONL:');
for (let i = 0; i < corpusEntries.length; i++) {
    const e = corpusEntries[i];
    if (e.productionWriteAllowed !== false) throw new Error(`productionWriteAllowed must be false at entry ${i + 1}`);
    if (e.simulationWriteAllowed !== false) throw new Error(`simulationWriteAllowed must be false at entry ${i + 1}`);
    if (e.optimizerWriteAllowed !== false) throw new Error(`optimizerWriteAllowed must be false at entry ${i + 1}`);
    const text = JSON.stringify(e);
    if (hasForbiddenClaim(text)) throw new Error(`Forbidden claim in corpus entry ${i + 1}`);
    console.log(`  Line ${i + 1} OK: ${e.symbol} ${e.horizonLabel} ${e.snapshotStatus}`);
}

// 8. Final summary
console.log('\n=== P6 Final Summary ===');
console.log(`appendStatus: ${accumulationResult.appendStatus}`);
console.log(`incomingCount: ${accumulationResult.incomingCount}`);
console.log(`appendedCount: ${accumulationResult.appendedCount}`);
console.log(`existingCount: ${accumulationResult.existingCount}`);
console.log(`totalCorpusEntries: ${summary.totalEntries}`);
console.log(`readyCount: ${summary.readyCount}`);
console.log(`blockedCount: ${summary.blockedCount}`);
console.log(`uniqueAsOfDateCount: ${summary.uniqueAsOfDateCount}`);
console.log(`uniqueSymbolCount: ${summary.uniqueSymbolCount}`);
console.log(`coverageRatio: ${summary.coverageRatio.toFixed(4)}`);
console.log(`readinessStatus: ${readinessDecision.readinessStatus}`);
console.log(`corpusReady: ${readinessDecision.corpusReady}`);
console.log('\nP6_MULTI_DATE_SNAPSHOT_CORPUS_ACCUMULATION_COMPLETE');
