#!/usr/bin/env node
/**
 * P7 Second-Date Corpus Append Artifact Generator
 *
 * Self-contained Node entrypoint. Builds a deterministic second-date batch
 * and appends it to the corpus using append-only validation.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '../outputs/online_validation');
const CORPUS_PATH = path.join(BASE_DIR, 'simulation_snapshot_corpus.jsonl');
const BATCH_JSON = path.join(BASE_DIR, 'p7_second_date_snapshot_batch.json');
const BATCH_MD = path.join(BASE_DIR, 'p7_second_date_snapshot_batch.md');
const APPEND_JSON = path.join(BASE_DIR, 'p7_second_date_corpus_append_result.json');
const APPEND_MD = path.join(BASE_DIR, 'p7_second_date_corpus_append_result.md');

const SECOND_DATE_AS_OF_DATE = '2026-05-12';
const SECOND_DATE_REVIEW_DATE = '2026-07-01';
const SECOND_DATE_SIMULATION_RUN_ID = 'p7-second-date-simulation-20260512-001';
const SECOND_DATE_SOURCE_REPLAY_RUN_ID = 'p7-second-date-replay-fixture-20260512-001';
const SECOND_DATE_BATCH_VERSION = 'sim-batch-v0';
const SECOND_DATE_SNAPSHOT_VERSION = 'sim-snapshot-v0';

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
    return FORBIDDEN_PATTERNS.some(pattern => pattern.test(text));
}

function buildCorpusEntryKey(snapshot) {
    return `SIM_CORPUS|${snapshot.simulationRunId}|${snapshot.originalAsOfDate}|${snapshot.symbol}|${snapshot.universeTier}|${snapshot.horizonLabel}`;
}

function buildSecondDateSnapshotSeed(options = {}) {
    return {
        asOfDate: options.asOfDate || SECOND_DATE_AS_OF_DATE,
        reviewDate: options.reviewDate || SECOND_DATE_REVIEW_DATE,
        simulationRunId: options.simulationRunId || SECOND_DATE_SIMULATION_RUN_ID,
        source: 'DETERMINISTIC_TEST_FIXTURE',
        sourceReplayRunId: SECOND_DATE_SOURCE_REPLAY_RUN_ID,
        symbols: ['2330', '2454'],
        horizons: ['5D', '20D', '60D'],
    };
}

function buildSimulationSnapshotKey(seed, symbol, horizonLabel) {
    return `SIM_SNAPSHOT|${seed.sourceReplayRunId}|${seed.asOfDate}|${symbol}|MVP_CORE|${horizonLabel}`;
}

function buildSecondDateSnapshot(seed, symbol, horizonLabel) {
    const isReady =
        (symbol === '2330' && (horizonLabel === '5D' || horizonLabel === '20D')) ||
        (symbol === '2454' && horizonLabel === '5D');
    const snapshotBlockedReason = isReady
        ? 'NONE'
        : horizonLabel === '60D'
            ? 'WINDOW_NOT_DUE'
            : 'OUTCOME_MISSING';
    const simulationSnapshotKey = buildSimulationSnapshotKey(seed, symbol, horizonLabel);
    return {
        simulationSnapshotVersion: SECOND_DATE_SNAPSHOT_VERSION,
        simulationRunId: seed.simulationRunId,
        simulationSnapshotKey,
        replayKey: `REPLAY_DATASET|${seed.asOfDate}|${symbol}|MVP_CORE|${seed.simulationRunId}|${horizonLabel}`,
        originalRunId: seed.simulationRunId,
        originalAsOfDate: seed.asOfDate,
        symbol,
        stockName: symbol === '2330' ? 'Taiwan Semiconductor Manufacturing' : 'MediaTek',
        universeTier: 'MVP_CORE',
        horizonLabel,
        horizonDays: horizonLabel === '5D' ? 5 : horizonLabel === '20D' ? 20 : 60,
        targetTradingDate: horizonLabel === '5D' ? '2026-05-19' : horizonLabel === '20D' ? '2026-06-09' : '2026-08-03',
        reviewDate: seed.reviewDate,
        researchBucket: isReady ? 'Strong' : 'Watch',
        scoreSnapshot: {
            researchScore: isReady ? 73.5 : 41.2,
            confidenceScore: isReady ? 67 : 31,
            technicalScore: isReady ? 76 : 40,
            chipScore: isReady ? 71 : 38,
            fundamentalScore: isReady ? 80 : 39,
            marketAdjustment: isReady ? 4 : -2,
        },
        confidenceSnapshot: isReady ? 67 : 31,
        factorSnapshot: isReady
            ? ['deterministic fixture momentum confirmation', 'observability-only corpus entry']
            : ['deterministic fixture horizon check', 'observability-only corpus entry'],
        riskSnapshot: isReady ? ['sector concentration'] : ['forward visibility limited'],
        limitationSnapshot: ['deterministic second-date fixture'],
        dataCoverageSnapshot: {
            coverage: isReady ? 'full' : 'partial',
            usedSources: ['fixtureQuote', 'fixtureFundamental'],
            missingSources: isReady ? [] : ['outcome'],
        },
        sourceDateBasis: {
            sourceDate: '2026-05-10',
            sourceType: 'DETERMINISTIC_TEST_FIXTURE',
            missingDataFlags: isReady ? [] : ['OUTCOME_PENDING'],
        },
        outcomeSnapshot: {
            closePriceAtPrediction: null,
            closePriceAtOutcome: isReady ? (symbol === '2330' ? 1020 : 980) : null,
            returnPct: isReady ? (symbol === '2330' ? 1.8 : 2.4) : null,
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

function buildSecondDateSimulationSnapshotBatch(seed) {
    const snapshots = [];
    for (const symbol of seed.symbols) {
        for (const horizonLabel of seed.horizons) {
            snapshots.push(buildSecondDateSnapshot(seed, symbol, horizonLabel));
        }
    }

    const snapshotReadyCount = snapshots.filter(snapshot => snapshot.snapshotStatus === 'SNAPSHOT_READY').length;
    const snapshotBlockedCount = snapshots.length - snapshotReadyCount;

    return {
        simulationBatchVersion: SECOND_DATE_BATCH_VERSION,
        simulationRunId: seed.simulationRunId,
        sourceReplayRunId: seed.sourceReplayRunId,
        reviewDate: seed.reviewDate,
        mode: 'SNAPSHOT_ONLY',
        dryRun: true,
        inputRecordCount: snapshots.length,
        snapshotReadyCount,
        snapshotBlockedCount,
        snapshots,
        validationStatus: 'PASS',
        validationMessages: [
            `Deterministic second-date fixture generated: ${snapshots.length} snapshots`,
        ],
    };
}

function validateSecondDateSnapshotBatch(batch) {
    const messages = [];
    let valid = true;

    if (batch.dryRun !== true) {
        messages.push('FAIL: dryRun must be true');
        valid = false;
    }
    if (batch.simulationRunId === 'p5-replay-simulation-20260511-001') {
        messages.push('FAIL: simulationRunId must differ from P5');
        valid = false;
    }
    if (batch.snapshots.length < 6) {
        messages.push(`FAIL: expected at least 6 snapshots, got ${batch.snapshots.length}`);
        valid = false;
    }
    if (batch.snapshotReadyCount < 3) {
        messages.push(`FAIL: expected at least 3 SNAPSHOT_READY, got ${batch.snapshotReadyCount}`);
        valid = false;
    }
    const asOfDates = new Set(batch.snapshots.map(snapshot => snapshot.originalAsOfDate));
    if (asOfDates.size !== 1 || !asOfDates.has(SECOND_DATE_AS_OF_DATE)) {
        messages.push(`FAIL: originalAsOfDate must be ${SECOND_DATE_AS_OF_DATE}`);
        valid = false;
    }
    for (const snapshot of batch.snapshots) {
        if (snapshot.productionWriteAllowed !== false) {
            messages.push(`FAIL: productionWriteAllowed must be false: ${snapshot.simulationSnapshotKey}`);
            valid = false;
        }
        if (snapshot.simulationWriteAllowed !== false) {
            messages.push(`FAIL: simulationWriteAllowed must be false: ${snapshot.simulationSnapshotKey}`);
            valid = false;
        }
        if (snapshot.optimizerWriteAllowed !== false) {
            messages.push(`FAIL: optimizerWriteAllowed must be false: ${snapshot.simulationSnapshotKey}`);
            valid = false;
        }
        if (hasForbiddenClaim(JSON.stringify(snapshot))) {
            messages.push(`FAIL: forbidden claim in snapshot: ${snapshot.simulationSnapshotKey}`);
            valid = false;
        }
    }
    if (hasForbiddenClaim(JSON.stringify(batch))) {
        messages.push('FAIL: forbidden claim in batch');
        valid = false;
    }
    if (valid) messages.push('PASS: deterministic second-date batch safety contracts verified');
    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
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

function normalizeSnapshotForCorpus(snapshot, corpusRunId) {
    return {
        corpusVersion: 'sim-corpus-v0',
        corpusRunId,
        corpusEntryKey: buildCorpusEntryKey(snapshot),
        entryType: 'SIMULATION_SNAPSHOT',
        sourceSimulationRunId: String(snapshot.simulationRunId || ''),
        simulationSnapshotKey: String(snapshot.simulationSnapshotKey || ''),
        replayKey: String(snapshot.replayKey || ''),
        originalRunId: String(snapshot.originalRunId || ''),
        originalAsOfDate: String(snapshot.originalAsOfDate || ''),
        symbol: String(snapshot.symbol || ''),
        stockName: String(snapshot.stockName || ''),
        universeTier: String(snapshot.universeTier || ''),
        horizonLabel: String(snapshot.horizonLabel || ''),
        horizonDays: Number(snapshot.horizonDays || 0),
        targetTradingDate: String(snapshot.targetTradingDate || ''),
        reviewDate: String(snapshot.reviewDate || ''),
        researchBucket: String(snapshot.researchBucket || ''),
        scoreSnapshot: snapshot.scoreSnapshot || {},
        confidenceSnapshot: snapshot.confidenceSnapshot ?? null,
        factorSnapshot: snapshot.factorSnapshot || [],
        riskSnapshot: snapshot.riskSnapshot || [],
        limitationSnapshot: snapshot.limitationSnapshot || [],
        dataCoverageSnapshot: snapshot.dataCoverageSnapshot ?? null,
        sourceDateBasis: snapshot.sourceDateBasis ?? null,
        outcomeSnapshot: snapshot.outcomeSnapshot ?? null,
        snapshotStatus: String(snapshot.snapshotStatus || 'SNAPSHOT_BLOCKED'),
        snapshotBlockedReason: String(snapshot.snapshotBlockedReason || 'UNKNOWN'),
        pitSafeStatus: String(snapshot.pitSafeStatus || 'UNKNOWN'),
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
        createdAt: new Date().toISOString(),
        validationMessages: snapshot.validationMessages || [],
    };
}

function validateCorpusAppend(existingContent, newEntries) {
    const existing = existingContent.trim() ? parseSnapshotCorpusJsonl(existingContent) : [];
    const existingKeys = new Set(existing.map(entry => entry.corpusEntryKey));
    const duplicateKeys = [];
    let valid = true;
    const messages = [];
    const newKeys = new Set();

    for (const entry of newEntries) {
        if (existingKeys.has(entry.corpusEntryKey)) {
            duplicateKeys.push(entry.corpusEntryKey);
            valid = false;
        }
        if (newKeys.has(entry.corpusEntryKey)) {
            duplicateKeys.push(entry.corpusEntryKey);
            valid = false;
        }
        newKeys.add(entry.corpusEntryKey);

        if (entry.productionWriteAllowed !== false ||
            entry.simulationWriteAllowed !== false ||
            entry.optimizerWriteAllowed !== false) {
            messages.push(`FAIL: write lock violation: ${entry.corpusEntryKey}`);
            valid = false;
        }
        if (hasForbiddenClaim(JSON.stringify(entry.validationMessages || []))) {
            messages.push(`FAIL: forbidden claim in validationMessages: ${entry.corpusEntryKey}`);
            valid = false;
        }
    }

    if (valid) messages.push('PASS: corpus append validation passed');
    return { valid, duplicateKeys, messages };
}

function accumulateSnapshotCorpus(snapshotBatch, options) {
    const { corpusPath, corpusRunId, append } = options;
    let existingContent = '';
    let existingEntries = [];
    if (fs.existsSync(corpusPath)) {
        existingContent = fs.readFileSync(corpusPath, 'utf8');
        existingEntries = existingContent.trim() ? parseSnapshotCorpusJsonl(existingContent) : [];
    }
    const existingCount = existingEntries.length;
    const newEntries = snapshotBatch.snapshots.map(snapshot =>
        normalizeSnapshotForCorpus(snapshot, corpusRunId),
    );
    const validation = validateCorpusAppend(existingContent, newEntries);
    if (!validation.valid) {
        return {
            corpusPath,
            corpusRunId,
            ingestionDate: SECOND_DATE_AS_OF_DATE,
            dryRun: true,
            append,
            incomingCount: newEntries.length,
            appendedCount: 0,
            existingCount,
            totalAfterAppend: existingCount,
            duplicateCount: validation.duplicateKeys.length,
            appendStatus: 'FAIL',
            validationMessages: validation.messages,
        };
    }
    if (append) {
        fs.appendFileSync(corpusPath, newEntries.map(entry => JSON.stringify(entry)).join('\n') + '\n', 'utf8');
    }
    return {
        corpusPath,
        corpusRunId,
        ingestionDate: SECOND_DATE_AS_OF_DATE,
        dryRun: true,
        append,
        incomingCount: newEntries.length,
        appendedCount: append ? newEntries.length : 0,
        existingCount,
        totalAfterAppend: existingCount + (append ? newEntries.length : 0),
        duplicateCount: 0,
        appendStatus: 'PASS',
        validationMessages: validation.messages,
    };
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
    console.log('=== P7 Second-Date Corpus Append ===');
    console.log(`corpusPath: ${CORPUS_PATH}`);

    const seed = buildSecondDateSnapshotSeed({
        asOfDate: SECOND_DATE_AS_OF_DATE,
        reviewDate: SECOND_DATE_REVIEW_DATE,
        simulationRunId: SECOND_DATE_SIMULATION_RUN_ID,
    });
    const batch = buildSecondDateSimulationSnapshotBatch(seed);
    const validation = validateSecondDateSnapshotBatch(batch);
    if (!validation.valid) {
        throw new Error(`Second-date batch validation failed: ${validation.messages.join(' | ')}`);
    }

    const incomingKeys = batch.snapshots.map(snapshot => buildCorpusEntryKey(snapshot));
    let existingContent = '';
    let existingEntries = [];
    if (fs.existsSync(CORPUS_PATH)) {
        existingContent = fs.readFileSync(CORPUS_PATH, 'utf8');
        existingEntries = existingContent.trim() ? parseSnapshotCorpusJsonl(existingContent) : [];
    }
    const existingKeys = new Set(existingEntries.map(entry => entry.corpusEntryKey));
    const duplicateKeys = incomingKeys.filter(key => existingKeys.has(key));
    const duplicateDetected = duplicateKeys.length > 0;

    const appendResult = duplicateDetected
        ? {
              corpusPath: CORPUS_PATH,
              corpusRunId: seed.simulationRunId,
              ingestionDate: seed.asOfDate,
              dryRun: true,
              append: true,
              incomingCount: batch.snapshots.length,
              appendedCount: 0,
              existingCount: existingEntries.length,
              totalAfterAppend: existingEntries.length,
              duplicateCount: duplicateKeys.length,
              appendStatus: 'DUPLICATE_KEY_BLOCKED',
              validationMessages: [`DUPLICATE_KEY_BLOCKED: ${duplicateKeys.join(', ')}`],
          }
        : accumulateSnapshotCorpus(
              { snapshots: batch.snapshots },
              {
                  corpusPath: CORPUS_PATH,
                  corpusRunId: seed.simulationRunId,
                  append: true,
                  dryRun: true,
              },
          );

    writeJson(BATCH_JSON, batch);
    writeMd(BATCH_MD, [
        '# P7 Second-Date Snapshot Batch',
        '',
        `**simulationRunId:** ${batch.simulationRunId}`,
        `**sourceReplayRunId:** ${batch.sourceReplayRunId}`,
        `**reviewDate:** ${batch.reviewDate}`,
        `**dryRun:** ${batch.dryRun}`,
        `**inputRecordCount:** ${batch.inputRecordCount}`,
        `**snapshotReadyCount:** ${batch.snapshotReadyCount}`,
        `**snapshotBlockedCount:** ${batch.snapshotBlockedCount}`,
        '',
        '| Symbol | Horizon | Status | Outcome Available | Blocked Reason |',
        '|---|---|---|---|---|',
        ...batch.snapshots.map(snapshot =>
            `| ${snapshot.symbol} | ${snapshot.horizonLabel} | ${snapshot.snapshotStatus} | ${snapshot.outcomeSnapshot.outcomeAvailable} | ${snapshot.snapshotBlockedReason} |`,
        ),
        '',
        '> Deterministic test fixture. No production writes. No performance claims.',
    ]);

    writeJson(APPEND_JSON, {
        ...appendResult,
        appendStatus: duplicateDetected ? 'DUPLICATE_KEY_BLOCKED' : appendResult.appendStatus,
        duplicateKeys,
    });
    writeMd(APPEND_MD, [
        '# P7 Second-Date Corpus Append Result',
        '',
        `**corpusPath:** ${appendResult.corpusPath}`,
        `**appendStatus:** ${duplicateDetected ? 'DUPLICATE_KEY_BLOCKED' : appendResult.appendStatus}`,
        `**incomingCount:** ${appendResult.incomingCount}`,
        `**appendedCount:** ${appendResult.appendedCount}`,
        `**existingCount:** ${appendResult.existingCount}`,
        `**totalAfterAppend:** ${appendResult.totalAfterAppend}`,
        `**duplicateCount:** ${appendResult.duplicateCount}`,
        '',
        '## Validation Messages',
        ...appendResult.validationMessages.map(message => `- ${message}`),
        '',
        '> Observability-only corpus append. No production, simulation, or optimizer writes permitted.',
    ]);

    console.log(`appendStatus: ${duplicateDetected ? 'DUPLICATE_KEY_BLOCKED' : appendResult.appendStatus}`);
    console.log(`existingCount: ${appendResult.existingCount}`);
    console.log(`incomingCount: ${appendResult.incomingCount}`);
    console.log(`appendedCount: ${appendResult.appendedCount}`);
    console.log(`totalAfterAppend: ${appendResult.totalAfterAppend}`);
    console.log(`duplicateCount: ${appendResult.duplicateCount}`);
}

main();
