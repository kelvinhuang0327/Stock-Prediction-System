#!/usr/bin/env node
/**
 * generate-p8-third-date-corpus-append-artifacts.js
 * Self-contained Node.js script — no TypeScript compilation required.
 *
 * SAFETY CONTRACT: no production DB write, no external API, no LLM, no trading signals.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Constants ─────────────────────────────────────────────────────

const THIRD_DATE_AS_OF_DATE = '2026-05-13';
const THIRD_DATE_REVIEW_DATE = '2026-07-02';
const THIRD_DATE_SIMULATION_RUN_ID = 'p8-third-date-simulation-20260513-001';
const THIRD_DATE_SOURCE_REPLAY_RUN_ID = 'p8-third-date-replay-fixture-20260513-001';

const SNAPSHOT_VERSION = 'sim-snapshot-v0';
const BATCH_VERSION = 'sim-batch-v0';

const P5_RUN_ID = 'p5-replay-simulation-20260511-001';
const P7_RUN_ID = 'p7-second-date-simulation-20260512-001';

const CORPUS_JSONL = path.resolve(__dirname, '../outputs/online_validation/simulation_snapshot_corpus.jsonl');
const OUT_DIR = path.resolve(__dirname, '../outputs/online_validation');

// ─── Inline: ThirdDateSnapshotBatchFactory ─────────────────────────

function buildThirdDateSnapshotSeed(opts = {}) {
    return {
        asOfDate: opts.asOfDate || THIRD_DATE_AS_OF_DATE,
        reviewDate: opts.reviewDate || THIRD_DATE_REVIEW_DATE,
        simulationRunId: opts.simulationRunId || THIRD_DATE_SIMULATION_RUN_ID,
        source: 'DETERMINISTIC_TEST_FIXTURE',
        sourceReplayRunId: THIRD_DATE_SOURCE_REPLAY_RUN_ID,
        symbols: ['2330', '2454'],
        horizons: ['5D', '20D', '60D'],
    };
}

function buildSnapshot(seed, symbol, horizonLabel) {
    const isReady = symbol === '2330' || (symbol === '2454' && horizonLabel === '5D');
    const snapshotBlockedReason = isReady
        ? 'NONE'
        : horizonLabel === '60D' ? 'WINDOW_NOT_DUE' : 'OUTCOME_MISSING';
    const horizonDays = horizonLabel === '5D' ? 5 : horizonLabel === '20D' ? 20 : 60;
    const targetTradingDate =
        horizonLabel === '5D' ? '2026-05-20'
        : horizonLabel === '20D' ? '2026-06-10'
        : '2026-08-04';

    const simulationSnapshotKey = `SIM_SNAPSHOT|${seed.sourceReplayRunId}|${seed.asOfDate}|${symbol}|MVP_CORE|${horizonLabel}`;

    return {
        simulationSnapshotVersion: SNAPSHOT_VERSION,
        simulationRunId: seed.simulationRunId,
        simulationSnapshotKey,
        replayKey: `REPLAY_DATASET|${seed.asOfDate}|${symbol}|MVP_CORE|${seed.simulationRunId}|${horizonLabel}`,
        originalRunId: seed.simulationRunId,
        originalAsOfDate: seed.asOfDate,
        symbol,
        stockName: symbol === '2330' ? 'Taiwan Semiconductor Manufacturing' : 'MediaTek',
        universeTier: 'MVP_CORE',
        horizonLabel,
        horizonDays,
        targetTradingDate,
        reviewDate: seed.reviewDate,
        researchBucket: isReady ? 'Strong' : 'Watch',
        scoreSnapshot: {
            researchScore: isReady ? 75.0 : 42.5,
            confidenceScore: isReady ? 68 : 32,
            technicalScore: isReady ? 77 : 41,
            chipScore: isReady ? 72 : 39,
            fundamentalScore: isReady ? 81 : 40,
            marketAdjustment: isReady ? 5 : -1,
        },
        confidenceSnapshot: isReady ? 68 : 32,
        factorSnapshot: isReady
            ? ['deterministic fixture day3 momentum', 'observability-only corpus entry']
            : ['deterministic fixture day3 horizon check', 'observability-only corpus entry'],
        riskSnapshot: isReady ? ['sector concentration watch'] : ['forward visibility limited'],
        limitationSnapshot: ['deterministic third-date fixture'],
        dataCoverageSnapshot: {
            coverage: isReady ? 'full' : 'partial',
            usedSources: ['fixtureQuote', 'fixtureFundamental'],
            missingSources: isReady ? [] : ['outcome'],
        },
        sourceDateBasis: {
            sourceDate: '2026-05-12',
            sourceType: 'DETERMINISTIC_TEST_FIXTURE',
            missingDataFlags: isReady ? [] : ['OUTCOME_PENDING'],
        },
        outcomeSnapshot: {
            closePriceAtPrediction: null,
            closePriceAtOutcome: isReady ? (symbol === '2330' ? 1025 : 985) : null,
            returnPct: isReady ? (symbol === '2330' ? 2.1 : 2.7) : null,
            priceSource: 'deterministic-fixture',
            outcomeAvailable: isReady,
        },
        snapshotStatus: isReady ? 'SNAPSHOT_READY' : 'SNAPSHOT_BLOCKED',
        snapshotBlockedReason,
        pitSafeStatus: 'PIT_SAFE',
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
        validationMessages: isReady
            ? ['DETERMINISTIC_TEST_FIXTURE_READY']
            : [`DETERMINISTIC_TEST_FIXTURE_BLOCKED:${snapshotBlockedReason}`],
    };
}

function buildThirdDateSimulationSnapshotBatch(seed) {
    const snapshots = [];
    for (const symbol of seed.symbols) {
        for (const h of seed.horizons) {
            snapshots.push(buildSnapshot(seed, symbol, h));
        }
    }
    const readyCount = snapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_READY').length;
    return {
        simulationBatchVersion: BATCH_VERSION,
        simulationRunId: seed.simulationRunId,
        sourceReplayRunId: seed.sourceReplayRunId,
        reviewDate: seed.reviewDate,
        mode: 'SNAPSHOT_ONLY',
        dryRun: true,
        inputRecordCount: snapshots.length,
        snapshotReadyCount: readyCount,
        snapshotBlockedCount: snapshots.length - readyCount,
        snapshots,
        validationStatus: 'PASS',
        validationMessages: [`Deterministic third-date fixture generated: ${snapshots.length} snapshots`],
    };
}

// ─── Inline: Corpus accumulator helpers ───────────────────────────

function buildCorpusEntryKey(snapshot) {
    const { simulationRunId, originalAsOfDate, symbol, universeTier, horizonLabel } = snapshot;
    return `SIM_CORPUS|${simulationRunId}|${originalAsOfDate}|${symbol}|${universeTier}|${horizonLabel}`;
}

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

function accumulateSnapshotCorpus(snapshots, filePath, generatedAt) {
    const existing = parseCorpusJsonl(filePath);
    const existingKeys = new Set(existing.map(e => e.corpusEntryKey));
    const incoming = [];
    const duplicates = [];

    for (const snap of snapshots) {
        const key = buildCorpusEntryKey(snap);
        if (existingKeys.has(key)) {
            duplicates.push(key);
        } else {
            incoming.push({ ...snap, corpusEntryKey: key });
        }
    }

    if (duplicates.length > 0 && incoming.length === 0) {
        return {
            appendStatus: 'DUPLICATE_KEY_BLOCKED',
            existingCount: existing.length,
            incomingCount: snapshots.length,
            appendedCount: 0,
            duplicateCount: duplicates.length,
            totalAfterAppend: existing.length,
            duplicateKeys: duplicates,
        };
    }

    // Partial append guard: if any duplicates exist, block entirely
    if (duplicates.length > 0) {
        return {
            appendStatus: 'DUPLICATE_KEY_BLOCKED',
            existingCount: existing.length,
            incomingCount: snapshots.length,
            appendedCount: 0,
            duplicateCount: duplicates.length,
            totalAfterAppend: existing.length,
            duplicateKeys: duplicates,
        };
    }

    const appendLines = incoming.map(e => JSON.stringify(e)).join('\n');
    const existingContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const separator = existingContent && !existingContent.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(filePath, separator + appendLines + '\n', 'utf8');

    const after = parseCorpusJsonl(filePath);
    const asOfDates = new Set(after.map(e => e.originalAsOfDate));
    return {
        appendStatus: 'PASS',
        existingCount: existing.length,
        incomingCount: snapshots.length,
        appendedCount: incoming.length,
        duplicateCount: 0,
        totalAfterAppend: after.length,
        uniqueAsOfDateCount: asOfDates.size,
        uniqueAsOfDates: Array.from(asOfDates).sort(),
    };
}

// ─── Main ──────────────────────────────────────────────────────────

const generatedAt = new Date().toISOString();
const seed = buildThirdDateSnapshotSeed({
    asOfDate: THIRD_DATE_AS_OF_DATE,
    reviewDate: THIRD_DATE_REVIEW_DATE,
    simulationRunId: THIRD_DATE_SIMULATION_RUN_ID,
});

// Safety guards
if (seed.simulationRunId === P5_RUN_ID) throw new Error('simulationRunId must differ from P5');
if (seed.simulationRunId === P7_RUN_ID) throw new Error('simulationRunId must differ from P7');

const batch = buildThirdDateSimulationSnapshotBatch(seed);

// Validate batch
if (!batch.dryRun) throw new Error('batch.dryRun must be true');
if (batch.snapshotReadyCount < 3) throw new Error(`expected >=3 SNAPSHOT_READY, got ${batch.snapshotReadyCount}`);

console.log(`Built third-date batch: ${batch.inputRecordCount} snapshots (${batch.snapshotReadyCount} READY, ${batch.snapshotBlockedCount} BLOCKED)`);

// Append to corpus
const corpusResult = accumulateSnapshotCorpus(batch.snapshots, CORPUS_JSONL, generatedAt);
console.log(`Corpus append: ${corpusResult.appendStatus} existingCount=${corpusResult.existingCount} appendedCount=${corpusResult.appendedCount} total=${corpusResult.totalAfterAppend}`);

// ─── Artifacts ────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });

// p8_third_date_snapshot_batch.json
const batchArtifact = {
    artifactVersion: 'p8-third-date-batch-v0',
    generatedAt,
    asOfDate: seed.asOfDate,
    reviewDate: seed.reviewDate,
    simulationRunId: seed.simulationRunId,
    sourceReplayRunId: seed.sourceReplayRunId,
    dryRun: true,
    ...batch,
};
fs.writeFileSync(
    path.join(OUT_DIR, 'p8_third_date_snapshot_batch.json'),
    JSON.stringify(batchArtifact, null, 2),
);

// p8_third_date_snapshot_batch.md
fs.writeFileSync(path.join(OUT_DIR, 'p8_third_date_snapshot_batch.md'), `# P8 Third-Date Snapshot Batch

| Field | Value |
|-------|-------|
| generatedAt | ${generatedAt} |
| asOfDate | ${seed.asOfDate} |
| reviewDate | ${seed.reviewDate} |
| simulationRunId | ${seed.simulationRunId} |
| dryRun | true |
| totalSnapshots | ${batch.inputRecordCount} |
| snapshotReadyCount | ${batch.snapshotReadyCount} |
| snapshotBlockedCount | ${batch.snapshotBlockedCount} |
| validationStatus | ${batch.validationStatus} |

## Safety Guardrails
- productionWriteAllowed: false (all snapshots)
- simulationWriteAllowed: false (all snapshots)
- optimizerWriteAllowed: false (all snapshots)
- No performance claims
- No trading signals

## Classification
DETERMINISTIC_TEST_FIXTURE — Observability Only
`);

// p8_third_date_corpus_append_result.json
const appendArtifact = {
    artifactVersion: 'p8-corpus-append-result-v0',
    generatedAt,
    asOfDate: seed.asOfDate,
    simulationRunId: seed.simulationRunId,
    corpusPath: CORPUS_JSONL,
    ...corpusResult,
    dryRun: true,
    productionWriteAllowed: false,
    simulationWriteAllowed: false,
    optimizerWriteAllowed: false,
};
fs.writeFileSync(
    path.join(OUT_DIR, 'p8_third_date_corpus_append_result.json'),
    JSON.stringify(appendArtifact, null, 2),
);

// p8_third_date_corpus_append_result.md
fs.writeFileSync(path.join(OUT_DIR, 'p8_third_date_corpus_append_result.md'), `# P8 Third-Date Corpus Append Result

| Field | Value |
|-------|-------|
| generatedAt | ${generatedAt} |
| appendStatus | ${corpusResult.appendStatus} |
| existingCount | ${corpusResult.existingCount} |
| incomingCount | ${corpusResult.incomingCount} |
| appendedCount | ${corpusResult.appendedCount} |
| duplicateCount | ${corpusResult.duplicateCount} |
| totalAfterAppend | ${corpusResult.totalAfterAppend} |
| uniqueAsOfDateCount | ${corpusResult.uniqueAsOfDateCount || 'N/A'} |

## Safety Guardrails
- productionWriteAllowed: false
- simulationWriteAllowed: false
- optimizerWriteAllowed: false

## Status
${corpusResult.appendStatus === 'DUPLICATE_KEY_BLOCKED' ? '⛔ DUPLICATE_KEY_BLOCKED — no corpus modification' : '✅ PASS — corpus appended successfully'}
`);

console.log('✅ P8 third-date corpus append artifacts written successfully');
console.log(`   p8_third_date_snapshot_batch.json`);
console.log(`   p8_third_date_snapshot_batch.md`);
console.log(`   p8_third_date_corpus_append_result.json`);
console.log(`   p8_third_date_corpus_append_result.md`);

if (corpusResult.appendStatus === 'DUPLICATE_KEY_BLOCKED') {
    console.log('⛔ DUPLICATE_KEY_BLOCKED — corpus not modified (re-run guard active)');
    process.exit(0);
}

if (corpusResult.totalAfterAppend < 18) {
    throw new Error(`Expected corpus to have >=18 entries after P8, got ${corpusResult.totalAfterAppend}`);
}
if ((corpusResult.uniqueAsOfDateCount || 0) < 3) {
    throw new Error(`Expected >=3 unique asOfDates after P8, got ${corpusResult.uniqueAsOfDateCount}`);
}
console.log(`✅ Corpus verified: ${corpusResult.totalAfterAppend} entries, ${corpusResult.uniqueAsOfDateCount} unique asOfDates`);
