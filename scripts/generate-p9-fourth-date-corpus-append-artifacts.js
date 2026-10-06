#!/usr/bin/env node
/**
 * generate-p9-fourth-date-corpus-append-artifacts.js
 * Self-contained Node.js script — no TypeScript compilation required.
 *
 * SAFETY CONTRACT: no production DB write, no external API, no LLM, no trading signals.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Constants ─────────────────────────────────────────────────────

const FOURTH_DATE_AS_OF_DATE = '2026-05-14';
const FOURTH_DATE_REVIEW_DATE = '2026-07-03';
const FOURTH_DATE_SIMULATION_RUN_ID = 'p9-fourth-date-simulation-20260514-001';
const FOURTH_DATE_SOURCE_REPLAY_RUN_ID = 'p9-fourth-date-replay-fixture-20260514-001';

const SNAPSHOT_VERSION = 'sim-snapshot-v0';
const BATCH_VERSION = 'sim-batch-v0';

const P5_RUN_ID = 'p5-replay-simulation-20260511-001';
const P7_RUN_ID = 'p7-second-date-simulation-20260512-001';
const P8_RUN_ID = 'p8-third-date-simulation-20260513-001';

const CORPUS_JSONL = path.resolve(__dirname, '../outputs/online_validation/simulation_snapshot_corpus.jsonl');
const OUT_DIR = path.resolve(__dirname, '../outputs/online_validation');

// ─── Inline: FourthDateSnapshotBatchFactory ────────────────────────

function buildFourthDateSnapshotSeed(opts = {}) {
    return {
        asOfDate: opts.asOfDate || FOURTH_DATE_AS_OF_DATE,
        reviewDate: opts.reviewDate || FOURTH_DATE_REVIEW_DATE,
        simulationRunId: opts.simulationRunId || FOURTH_DATE_SIMULATION_RUN_ID,
        source: 'DETERMINISTIC_TEST_FIXTURE',
        sourceReplayRunId: FOURTH_DATE_SOURCE_REPLAY_RUN_ID,
        symbols: ['2330', '2454'],
        horizons: ['5D', '20D', '60D'],
    };
}

function buildSnapshot(seed, symbol, horizonLabel) {
    // Fourth date: both symbols fully ready for 5D and 20D; 60D remains blocked
    const isReady = horizonLabel === '5D' || horizonLabel === '20D';
    const snapshotBlockedReason = isReady ? 'NONE' : 'WINDOW_NOT_DUE';
    const horizonDays = horizonLabel === '5D' ? 5 : horizonLabel === '20D' ? 20 : 60;
    const targetTradingDate =
        horizonLabel === '5D'
            ? '2026-05-21'
            : horizonLabel === '20D'
                ? '2026-06-11'
                : '2026-08-05';

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
            researchScore: isReady ? 78.0 : 45.0,
            confidenceScore: isReady ? 71 : 34,
            technicalScore: isReady ? 80 : 43,
            chipScore: isReady ? 74 : 41,
            fundamentalScore: isReady ? 83 : 42,
            marketAdjustment: isReady ? 6 : -1,
        },
        confidenceSnapshot: isReady ? 71 : 34,
        factorSnapshot: isReady
            ? ['deterministic fixture day4 momentum', 'observability-only corpus entry']
            : ['deterministic fixture day4 horizon check', 'observability-only corpus entry'],
        riskSnapshot: isReady ? ['sector concentration watch'] : ['forward visibility limited'],
        limitationSnapshot: ['deterministic fourth-date fixture'],
        dataCoverageSnapshot: {
            coverage: isReady ? 'full' : 'partial',
            usedSources: ['fixtureQuote', 'fixtureFundamental'],
            missingSources: isReady ? [] : ['outcome'],
        },
        sourceDateBasis: {
            sourceDate: '2026-05-13',
            sourceType: 'DETERMINISTIC_TEST_FIXTURE',
            missingDataFlags: isReady ? [] : ['OUTCOME_PENDING'],
        },
        outcomeSnapshot: {
            closePriceAtPrediction: null,
            closePriceAtOutcome: isReady ? (symbol === '2330' ? 1030 : 990) : null,
            returnPct: isReady ? (symbol === '2330' ? 1.8 : 2.3) : null,
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

function buildFourthDateSimulationSnapshotBatch(seed) {
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
        validationMessages: [`Deterministic fourth-date fixture generated: ${snapshots.length} snapshots`],
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

    // Block if any duplicates (partial or full)
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
const seed = buildFourthDateSnapshotSeed({
    asOfDate: FOURTH_DATE_AS_OF_DATE,
    reviewDate: FOURTH_DATE_REVIEW_DATE,
    simulationRunId: FOURTH_DATE_SIMULATION_RUN_ID,
});

// Safety guards
if (seed.simulationRunId === P5_RUN_ID) throw new Error('simulationRunId must differ from P5');
if (seed.simulationRunId === P7_RUN_ID) throw new Error('simulationRunId must differ from P7');
if (seed.simulationRunId === P8_RUN_ID) throw new Error('simulationRunId must differ from P8');

const batch = buildFourthDateSimulationSnapshotBatch(seed);

// Validate batch
if (!batch.dryRun) throw new Error('batch.dryRun must be true');
if (batch.snapshotReadyCount < 3) throw new Error(`expected >=3 SNAPSHOT_READY, got ${batch.snapshotReadyCount}`);
if (batch.snapshots.length < 6) throw new Error(`expected >=6 snapshots, got ${batch.snapshots.length}`);

console.log(`Built fourth-date batch: ${batch.inputRecordCount} snapshots (${batch.snapshotReadyCount} READY, ${batch.snapshotBlockedCount} BLOCKED)`);

// Append to corpus
const corpusResult = accumulateSnapshotCorpus(batch.snapshots, CORPUS_JSONL, generatedAt);
console.log(`Corpus append: ${corpusResult.appendStatus} existingCount=${corpusResult.existingCount} appendedCount=${corpusResult.appendedCount} total=${corpusResult.totalAfterAppend}`);

// ─── Artifacts ────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });

// p9_fourth_date_snapshot_batch.json
const batchArtifact = {
    artifactVersion: 'p9-fourth-date-batch-v0',
    generatedAt,
    asOfDate: seed.asOfDate,
    reviewDate: seed.reviewDate,
    simulationRunId: seed.simulationRunId,
    sourceReplayRunId: seed.sourceReplayRunId,
    dryRun: true,
    ...batch,
};
fs.writeFileSync(
    path.join(OUT_DIR, 'p9_fourth_date_snapshot_batch.json'),
    JSON.stringify(batchArtifact, null, 2),
);

// p9_fourth_date_snapshot_batch.md
fs.writeFileSync(path.join(OUT_DIR, 'p9_fourth_date_snapshot_batch.md'), `# P9 Fourth-Date Snapshot Batch

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

// p9_fourth_date_corpus_append_result.json
const appendArtifact = {
    artifactVersion: 'p9-corpus-append-result-v0',
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
    path.join(OUT_DIR, 'p9_fourth_date_corpus_append_result.json'),
    JSON.stringify(appendArtifact, null, 2),
);

// p9_fourth_date_corpus_append_result.md
fs.writeFileSync(path.join(OUT_DIR, 'p9_fourth_date_corpus_append_result.md'), `# P9 Fourth-Date Corpus Append Result

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

console.log('✅ P9 fourth-date corpus append artifacts written successfully');
console.log(`   p9_fourth_date_snapshot_batch.json`);
console.log(`   p9_fourth_date_snapshot_batch.md`);
console.log(`   p9_fourth_date_corpus_append_result.json`);
console.log(`   p9_fourth_date_corpus_append_result.md`);

if (corpusResult.appendStatus === 'DUPLICATE_KEY_BLOCKED') {
    console.log('⛔ DUPLICATE_KEY_BLOCKED — corpus not modified (re-run guard active)');
    process.exit(0);
}

if (corpusResult.totalAfterAppend < 24) {
    throw new Error(`Expected corpus to have >=24 entries after P9, got ${corpusResult.totalAfterAppend}`);
}
if ((corpusResult.uniqueAsOfDateCount || 0) < 4) {
    throw new Error(`Expected >=4 unique asOfDates after P9, got ${corpusResult.uniqueAsOfDateCount}`);
}
console.log(`✅ Corpus verified: ${corpusResult.totalAfterAppend} entries, ${corpusResult.uniqueAsOfDateCount} unique asOfDates`);
