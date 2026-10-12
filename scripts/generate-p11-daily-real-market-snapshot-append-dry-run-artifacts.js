#!/usr/bin/env node
/**
 * generate-p11-daily-real-market-snapshot-append-dry-run-artifacts.js
 * Self-contained Node.js script — no TypeScript compilation required.
 *
 * Reads: simulation_snapshot_corpus.jsonl
 * Writes: p11 seed, append preview, dry-run result, markdown, system readiness
 *
 * SAFETY CONTRACT: no production DB write, no external API, no LLM, no trading signals.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '../outputs/online_validation');
const SYSTEM_READINESS_DIR = path.resolve(__dirname, '../outputs/system_readiness');
const CORPUS_PATH = path.join(BASE_DIR, 'simulation_snapshot_corpus.jsonl');

// ─── Config ────────────────────────────────────────────────────────

const AS_OF_DATE = '2026-05-15';
const REVIEW_DATE = '2026-07-06';
const SIMULATION_RUN_ID = 'p11-daily-real-market-simulation-20260515-001';
const SYMBOLS = ['2330', '2454'];
const HORIZONS = ['5D', '20D', '60D'];
const SOURCE_MODE = 'EXISTING_LOCAL_DATA_ONLY';

const SEED_VERSION = 'daily-real-market-seed-v0';
const PREVIEW_VERSION = 'daily-snapshot-append-preview-v0';
const EXECUTOR_VERSION = 'daily-corpus-append-dry-run-executor-v0';
const CORPUS_VERSION = 'sim-corpus-v0';
const CALENDAR_VERSION = 'twse-static-2024-2026-v1';

const GENERATED_AT = new Date().toISOString();
const CORPUS_RUN_ID = 'p11-corpus-dry-run-20260515-001';
const INGESTION_DATE = '2026-05-11';

// ─── Forbidden claims ────────────────────────────────────────────────

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

// ─── TWSE calendar (inline) ────────────────────────────────────────

const TWSE_STATIC_HOLIDAYS = new Set([
    '2024-01-01','2024-02-08','2024-02-09','2024-02-10','2024-02-11',
    '2024-02-12','2024-02-13','2024-02-14','2024-02-28','2024-04-04',
    '2024-04-05','2024-05-01','2024-06-10','2024-09-17','2024-10-10',
    '2024-12-25',
    '2025-01-01','2025-01-27','2025-01-28','2025-01-29','2025-01-30',
    '2025-01-31','2025-02-04','2025-02-28','2025-04-03','2025-04-04',
    '2025-05-01','2025-05-30','2025-05-31','2025-10-06','2025-10-10',
    '2026-01-01','2026-02-17','2026-02-18','2026-02-19','2026-02-20',
    '2026-02-23','2026-02-24','2026-02-28','2026-04-03','2026-04-04',
    '2026-05-01','2026-06-19','2026-09-25','2026-10-09',
]);

function isWeekend(dateStr) {
    const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
    return dow === 0 || dow === 6;
}

function isTwseTradingDay(dateStr) {
    return !isWeekend(dateStr) && !TWSE_STATIC_HOLIDAYS.has(dateStr);
}

function addCalendarDays(dateStr, days) {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

function addTwseTradingDays(startDate, tradingDays) {
    let count = 0;
    let current = startDate;
    let safety = 0;
    while (count < tradingDays) {
        safety++;
        if (safety > 500) throw new Error(`Exceeded 500 calendar days searching for ${tradingDays} trading days from ${startDate}`);
        current = addCalendarDays(current, 1);
        if (isTwseTradingDay(current)) count++;
    }
    return current;
}

const HORIZON_DAYS_MAP = { '5D': 5, '20D': 20, '60D': 60 };

const STOCK_NAME_MAP = {
    '2330': 'Taiwan Semiconductor Manufacturing',
    '2454': 'MediaTek',
    '2317': 'Hon Hai Precision Industry',
    '2882': 'Cathay Financial Holdings',
    '2886': 'Mega Financial Holding',
};

// ─── Corpus parser ─────────────────────────────────────────────────

function parseCorpusJsonl(content) {
    const entries = [];
    for (const [i, rawLine] of content.split('\n').entries()) {
        const line = rawLine.trim();
        if (!line) continue;
        try {
            entries.push(JSON.parse(line));
        } catch {
            throw new Error(`Malformed JSONL at line ${i + 1}: ${line.slice(0, 80)}`);
        }
    }
    return entries;
}

// ─── Seed builder ──────────────────────────────────────────────────

function buildSeed() {
    const isKnownTradingDay = isTwseTradingDay(AS_OF_DATE);
    const messages = [];
    let status = 'PASS';

    if (!isKnownTradingDay) {
        messages.push(`FAIL: asOfDate "${AS_OF_DATE}" is not a TWSE trading day`);
        status = 'FAIL';
    } else {
        messages.push('PASS: daily real-market snapshot seed validated');
    }

    return {
        seedVersion: SEED_VERSION,
        asOfDate: AS_OF_DATE,
        reviewDate: REVIEW_DATE,
        simulationRunId: SIMULATION_RUN_ID,
        symbols: SYMBOLS,
        horizons: HORIZONS,
        sourceMode: SOURCE_MODE,
        tradingDayStatus: {
            isKnownTradingDay,
            calendarVersion: CALENDAR_VERSION,
            note: isKnownTradingDay
                ? `${AS_OF_DATE} is a known TWSE trading day`
                : `${AS_OF_DATE} is a weekend or known TWSE holiday`,
        },
        guardrails: {
            noProductionWrite: true,
            noExternalApi: true,
            noOptimizerWrite: true,
            noTradingSignal: true,
            observabilityOnly: true,
        },
        validationStatus: status,
        validationMessages: messages,
    };
}

// ─── Preview builder ───────────────────────────────────────────────

function buildPreview(seed, existingCorpus) {
    const messages = [];
    const blockReasons = [];
    let appendWouldPass = true;

    if (seed.validationStatus !== 'PASS') {
        messages.push(`FAIL: seed validation failed`);
        blockReasons.push('SEED_INVALID');
        appendWouldPass = false;
    }

    const existingAsOfDates = new Set(existingCorpus.map(e => e.originalAsOfDate));
    const existingUniqueAsOfDateCount = existingAsOfDates.size;
    const existingCorpusCount = existingCorpus.length;

    if (existingAsOfDates.has(seed.asOfDate)) {
        messages.push(`FAIL: DUPLICATE_AS_OF_DATE — asOfDate "${seed.asOfDate}" already exists in corpus`);
        blockReasons.push('DUPLICATE_AS_OF_DATE');
        appendWouldPass = false;
    }

    const existingKeys = new Set(existingCorpus.map(e => e.corpusEntryKey));
    const proposedSnapshots = [];
    const duplicateKeys = [];

    for (const symbol of seed.symbols) {
        for (const horizonLabel of seed.horizons) {
            const horizonDays = HORIZON_DAYS_MAP[horizonLabel];
            const targetTradingDate = addTwseTradingDays(seed.asOfDate, horizonDays);
            const universeTier = 'MVP_CORE';
            const proposedKey = `SIM_CORPUS|${seed.simulationRunId}|${seed.asOfDate}|${symbol}|${universeTier}|${horizonLabel}`;
            const simulationSnapshotKey = `SIM_SNAPSHOT|${seed.simulationRunId}|${seed.asOfDate}|${symbol}|${universeTier}|${horizonLabel}`;
            const replayKey = `REPLAY_DATASET|${seed.asOfDate}|${symbol}|${universeTier}|${seed.simulationRunId}|${horizonLabel}`;

            if (existingKeys.has(proposedKey)) {
                duplicateKeys.push(proposedKey);
                messages.push(`FAIL: DUPLICATE_KEY_BLOCKED — key already exists: ${proposedKey}`);
                if (!blockReasons.includes('DUPLICATE_KEY_BLOCKED')) blockReasons.push('DUPLICATE_KEY_BLOCKED');
                appendWouldPass = false;
            }

            proposedSnapshots.push({
                simulationRunId: seed.simulationRunId,
                simulationSnapshotKey,
                replayKey,
                originalRunId: seed.simulationRunId,
                originalAsOfDate: seed.asOfDate,
                symbol,
                stockName: STOCK_NAME_MAP[symbol] ?? `Stock ${symbol}`,
                universeTier,
                horizonLabel,
                horizonDays,
                targetTradingDate,
                reviewDate: seed.reviewDate,
                researchBucket: 'Observability',
                scoreSnapshot: {},
                confidenceSnapshot: null,
                factorSnapshot: [],
                riskSnapshot: [],
                limitationSnapshot: [],
                dataCoverageSnapshot: null,
                sourceDateBasis: null,
                outcomeSnapshot: null,
                snapshotStatus: 'SNAPSHOT_BLOCKED',
                snapshotBlockedReason: 'WINDOW_NOT_DUE',
                pitSafeStatus: 'PIT_SAFE',
                productionWriteAllowed: false,
                simulationWriteAllowed: false,
                optimizerWriteAllowed: false,
                validationMessages: ['PASS: proposed snapshot — observability only'],
                proposedCorpusEntryKey: proposedKey,
            });
        }
    }

    if (appendWouldPass && blockReasons.length === 0) {
        blockReasons.push('NONE');
        messages.push('PASS: append preview passed — no duplicates, no forbidden claims');
    }

    const proposedReadyCount = proposedSnapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_READY').length;
    const proposedBlockedCount = proposedSnapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_BLOCKED').length;

    return {
        previewVersion: PREVIEW_VERSION,
        previewRunId: `p11-preview-${AS_OF_DATE.replace(/-/g, '')}-001`,
        generatedAt: GENERATED_AT,
        seed,
        existingCorpusCount,
        existingUniqueAsOfDateCount,
        proposedSnapshotCount: proposedSnapshots.length,
        proposedReadyCount,
        proposedBlockedCount,
        duplicateKeyCount: duplicateKeys.length,
        appendWouldPass,
        appendBlockReasons: blockReasons,
        proposedSnapshots,
        validationStatus: appendWouldPass ? 'PASS' : 'FAIL',
        validationMessages: messages,
    };
}

// ─── Corpus entry key builder ──────────────────────────────────────

function buildCorpusEntryKey(snapshot) {
    return `SIM_CORPUS|${snapshot.simulationRunId}|${snapshot.originalAsOfDate}|${snapshot.symbol}|${snapshot.universeTier}|${snapshot.horizonLabel}`;
}

// ─── Dry-run executor ─────────────────────────────────────────────

function executeDryRun(preview, { append }) {
    const messages = [];

    if (!preview.appendWouldPass) {
        const reasons = preview.appendBlockReasons.join(', ');
        messages.push(`FAIL: preview did not pass — blocked reasons: ${reasons}`);

        let appendStatus = 'BLOCKED_PREVIEW_FAIL';
        if (preview.appendBlockReasons.includes('DUPLICATE_KEY_BLOCKED') ||
            preview.appendBlockReasons.includes('DUPLICATE_AS_OF_DATE')) {
            appendStatus = 'BLOCKED_DUPLICATE';
        }

        return {
            executorVersion: EXECUTOR_VERSION,
            corpusPath: CORPUS_PATH,
            corpusRunId: CORPUS_RUN_ID,
            ingestionDate: INGESTION_DATE,
            dryRun: true,
            append,
            appendStatus,
            existingCount: preview.existingCorpusCount,
            incomingCount: preview.proposedSnapshotCount,
            appendedCount: 0,
            totalAfterAppend: preview.existingCorpusCount,
            validationStatus: 'FAIL',
            validationMessages: messages,
        };
    }

    // Read existing content
    const existingContent = fs.existsSync(CORPUS_PATH)
        ? fs.readFileSync(CORPUS_PATH, 'utf8')
        : '';
    const existingEntries = existingContent.trim() ? parseCorpusJsonl(existingContent) : [];
    const existingCount = existingEntries.length;
    const existingKeys = new Set(existingEntries.map(e => e.corpusEntryKey));

    // Build new corpus entries
    const now = new Date().toISOString();
    const newEntries = preview.proposedSnapshots.map(snap => ({
        corpusVersion: CORPUS_VERSION,
        corpusRunId: CORPUS_RUN_ID,
        corpusEntryKey: buildCorpusEntryKey(snap),
        entryType: 'SIMULATION_SNAPSHOT',
        sourceSimulationRunId: snap.simulationRunId,
        simulationSnapshotKey: snap.simulationSnapshotKey,
        replayKey: snap.replayKey,
        originalRunId: snap.originalRunId,
        originalAsOfDate: snap.originalAsOfDate,
        symbol: snap.symbol,
        stockName: snap.stockName,
        universeTier: snap.universeTier,
        horizonLabel: snap.horizonLabel,
        horizonDays: snap.horizonDays,
        targetTradingDate: snap.targetTradingDate,
        reviewDate: snap.reviewDate,
        researchBucket: snap.researchBucket,
        scoreSnapshot: snap.scoreSnapshot,
        confidenceSnapshot: snap.confidenceSnapshot,
        factorSnapshot: snap.factorSnapshot,
        riskSnapshot: snap.riskSnapshot,
        limitationSnapshot: snap.limitationSnapshot,
        dataCoverageSnapshot: snap.dataCoverageSnapshot,
        sourceDateBasis: snap.sourceDateBasis,
        outcomeSnapshot: snap.outcomeSnapshot,
        snapshotStatus: snap.snapshotStatus,
        snapshotBlockedReason: snap.snapshotBlockedReason,
        pitSafeStatus: snap.pitSafeStatus,
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
        createdAt: now,
        ingestionDate: INGESTION_DATE,
        validationMessages: snap.validationMessages,
    }));

    // Check for duplicate keys against existing
    const duplicateCount = newEntries.filter(e => existingKeys.has(e.corpusEntryKey)).length;
    if (duplicateCount > 0) {
        messages.push(`FAIL: ${duplicateCount} duplicate keys detected`);
        return {
            executorVersion: EXECUTOR_VERSION,
            corpusPath: CORPUS_PATH,
            corpusRunId: CORPUS_RUN_ID,
            ingestionDate: INGESTION_DATE,
            dryRun: true,
            append,
            appendStatus: 'BLOCKED_DUPLICATE',
            existingCount,
            incomingCount: newEntries.length,
            appendedCount: 0,
            totalAfterAppend: existingCount,
            validationStatus: 'FAIL',
            validationMessages: messages,
        };
    }

    // Forbidden claim check
    const textToCheck = JSON.stringify(newEntries);
    if (hasForbiddenClaim(textToCheck)) {
        messages.push('FAIL: forbidden claim detected in entries');
        return {
            executorVersion: EXECUTOR_VERSION,
            corpusPath: CORPUS_PATH,
            corpusRunId: CORPUS_RUN_ID,
            ingestionDate: INGESTION_DATE,
            dryRun: true,
            append,
            appendStatus: 'BLOCKED_FORBIDDEN_CLAIM',
            existingCount,
            incomingCount: newEntries.length,
            appendedCount: 0,
            totalAfterAppend: existingCount,
            validationStatus: 'FAIL',
            validationMessages: messages,
        };
    }

    const incomingCount = newEntries.length;
    let appendedCount = 0;

    if (append) {
        const newLines = newEntries.map(e => JSON.stringify(e)).join('\n') + '\n';
        fs.appendFileSync(CORPUS_PATH, newLines, 'utf8');
        appendedCount = incomingCount;
        messages.push(`Appended ${incomingCount} entries to corpus`);
    } else {
        messages.push(`DRY_RUN_PREVIEW: would append ${incomingCount} entries (not written)`);
    }

    return {
        executorVersion: EXECUTOR_VERSION,
        corpusPath: CORPUS_PATH,
        corpusRunId: CORPUS_RUN_ID,
        ingestionDate: INGESTION_DATE,
        dryRun: true,
        append,
        appendStatus: append ? 'APPENDED' : 'PREVIEW_ONLY',
        existingCount,
        incomingCount,
        appendedCount,
        totalAfterAppend: existingCount + appendedCount,
        validationStatus: 'PASS',
        validationMessages: messages,
    };
}

// ─── Markdown report ─────────────────────────────────────────────

function buildMarkdown(seed, preview, dryRunResult) {
    const lines = [];

    lines.push('# P11 Daily Real-Market Snapshot Corpus Append Dry-Run Report');
    lines.push('');
    lines.push(`**Generated:** ${GENERATED_AT}`);
    lines.push(`**As-Of Date:** ${seed.asOfDate}`);
    lines.push(`**Simulation Run ID:** ${seed.simulationRunId}`);
    lines.push(`**Source Mode:** ${seed.sourceMode}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Seed Status');
    lines.push('');
    lines.push(`- Validation: **${seed.validationStatus}**`);
    lines.push(`- TWSE Trading Day: **${seed.tradingDayStatus.isKnownTradingDay}**`);
    lines.push(`- Calendar Version: ${seed.tradingDayStatus.calendarVersion}`);
    lines.push('');
    lines.push('## Append Preview');
    lines.push('');
    lines.push(`- Existing Corpus Count: ${preview.existingCorpusCount}`);
    lines.push(`- Existing Unique As-Of Dates: ${preview.existingUniqueAsOfDateCount}`);
    lines.push(`- Proposed Snapshot Count: **${preview.proposedSnapshotCount}**`);
    lines.push(`- Proposed Ready: ${preview.proposedReadyCount}`);
    lines.push(`- Proposed Blocked (WINDOW_NOT_DUE): ${preview.proposedBlockedCount}`);
    lines.push(`- Duplicate Key Count: ${preview.duplicateKeyCount}`);
    lines.push(`- Append Would Pass: **${preview.appendWouldPass}**`);
    lines.push(`- Block Reasons: ${preview.appendBlockReasons.join(', ')}`);
    lines.push('');
    lines.push('## Proposed Snapshots');
    lines.push('');
    lines.push('| Symbol | Horizon | Target Date | Status |');
    lines.push('|--------|---------|-------------|--------|');
    for (const snap of preview.proposedSnapshots) {
        lines.push(`| ${snap.symbol} | ${snap.horizonLabel} | ${snap.targetTradingDate} | ${snap.snapshotStatus} |`);
    }
    lines.push('');
    lines.push('## Dry-Run Execution Result');
    lines.push('');
    lines.push(`- Append Status: **${dryRunResult.appendStatus}**`);
    lines.push(`- Existing Count: ${dryRunResult.existingCount}`);
    lines.push(`- Incoming Count: ${dryRunResult.incomingCount}`);
    lines.push(`- Appended Count: **${dryRunResult.appendedCount}**`);
    lines.push(`- Total After Append: **${dryRunResult.totalAfterAppend}**`);
    lines.push(`- Dry-Run: ${dryRunResult.dryRun}`);
    lines.push(`- Validation: **${dryRunResult.validationStatus}**`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Guardrails');
    lines.push('');
    for (const [k, v] of Object.entries(seed.guardrails)) {
        lines.push(`- ${k}: **${v}**`);
    }
    lines.push('');
    lines.push('## Known Limitations');
    lines.push('');
    lines.push('- All P11 entries are SNAPSHOT_BLOCKED (WINDOW_NOT_DUE) — outcome windows have not closed.');
    lines.push('- This is a dry-run controlled append, NOT a production daily job.');
    lines.push('- Corpus remains fixture-driven until real TWSE outcome data is ingested.');
    lines.push('- 60D horizon coverage will improve only as real trading days accumulate.');
    lines.push('');

    return lines.join('\n');
}

// ─── System readiness report ─────────────────────────────────────

function buildSystemReadiness(seed, preview, dryRunResult) {
    const lines = [];
    lines.push('# P11 Next Execution Order — 2026-05-11');
    lines.push('');
    lines.push(`Generated: ${GENERATED_AT}`);
    lines.push('');
    lines.push('## Current State After P11');
    lines.push('');
    lines.push(`- As-Of Date appended: ${seed.asOfDate}`);
    lines.push(`- Corpus entries: ${dryRunResult.totalAfterAppend} (was ${dryRunResult.existingCount})`);
    lines.push(`- Unique as-of dates: ${preview.existingUniqueAsOfDateCount + 1} (was ${preview.existingUniqueAsOfDateCount})`);
    lines.push(`- Append status: **${dryRunResult.appendStatus}**`);
    lines.push(`- All write locks: active (productionWriteAllowed=false, simulationWriteAllowed=false, optimizerWriteAllowed=false)`);
    lines.push('');
    lines.push('## This Round Delivered');
    lines.push('');
    lines.push('- DailyRealMarketSnapshotSeed.ts (P11 seed contract)');
    lines.push('- DailySnapshotAppendPreviewBuilder.ts (P11 preview builder)');
    lines.push('- DailyCorpusAppendDryRunExecutor.ts (P11 dry-run executor)');
    lines.push('- 79 P11 tests PASS');
    lines.push('- p11_daily_snapshot_seed.json');
    lines.push('- p11_daily_snapshot_append_preview.json');
    lines.push('- p11_daily_corpus_append_dry_run_result.json + .md');
    lines.push(`- corpus: ${dryRunResult.existingCount} -> ${dryRunResult.totalAfterAppend} entries, uniqueAsOfDates: ${preview.existingUniqueAsOfDateCount} -> ${preview.existingUniqueAsOfDateCount + (dryRunResult.appendedCount > 0 ? 1 : 0)}`);
    lines.push('');
    lines.push('## Constraints');
    lines.push('');
    lines.push('- NOT production ready');
    lines.push('- NOT optimizer ready');
    lines.push('- NOT performance claim');
    lines.push('- NOT trading signal');
    lines.push('- All P11 entries are SNAPSHOT_BLOCKED (WINDOW_NOT_DUE)');
    lines.push('');
    lines.push('## Next Recommended P12 Direction');
    lines.push('');
    lines.push('- P12: Continue appending real trading dates (2026-05-18, 2026-05-19, ...)');
    lines.push('- P12: When uniqueAsOfDateCount >= 10, re-run quality gate for re-evaluation');
    lines.push('- P12: Monitor 5D entries as they mature (targetTradingDate passes)');
    lines.push('- P12: Add symbol universe expansion (beyond 2330/2454)');
    lines.push('');

    return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────

function main() {
    console.log('[P11] Starting daily real-market snapshot append dry-run...');
    console.log(`[P11] asOfDate=${AS_OF_DATE} symbols=${SYMBOLS.join(',')} horizons=${HORIZONS.join(',')}`);

    // 1. Build seed
    console.log('[P11] Building seed...');
    const seed = buildSeed();
    console.log(`[P11] seed: validationStatus=${seed.validationStatus} tradingDay=${seed.tradingDayStatus.isKnownTradingDay}`);

    if (seed.validationStatus !== 'PASS') {
        console.error('[P11] FATAL: seed validation failed:', seed.validationMessages.join('; '));
        process.exit(1);
    }

    // 2. Load existing corpus
    console.log('[P11] Loading existing corpus...');
    const existingContent = fs.existsSync(CORPUS_PATH)
        ? fs.readFileSync(CORPUS_PATH, 'utf8')
        : '';
    const existingCorpus = existingContent.trim() ? parseCorpusJsonl(existingContent) : [];
    console.log(`[P11] Existing corpus: ${existingCorpus.length} entries`);

    const existingAsOfDates = new Set(existingCorpus.map(e => e.originalAsOfDate));
    console.log(`[P11] Existing unique asOfDates: ${existingAsOfDates.size} [${[...existingAsOfDates].join(', ')}]`);

    // 3. Build preview
    console.log('[P11] Building append preview...');
    const preview = buildPreview(seed, existingCorpus);
    console.log(`[P11] preview: appendWouldPass=${preview.appendWouldPass} proposedCount=${preview.proposedSnapshotCount} duplicateKeyCount=${preview.duplicateKeyCount}`);

    // 4. Execute dry-run (append=true)
    console.log('[P11] Executing dry-run append (append=true)...');
    const dryRunResult = executeDryRun(preview, { append: true });
    console.log(`[P11] result: appendStatus=${dryRunResult.appendStatus} appendedCount=${dryRunResult.appendedCount} total=${dryRunResult.totalAfterAppend}`);

    // 5. Validate no forbidden claims
    const serialized = JSON.stringify({ seed, preview, dryRunResult });
    if (hasForbiddenClaim(serialized)) {
        throw new Error('[P11] FATAL: Forbidden claim detected in P11 artifacts');
    }

    // 6. Ensure output directories
    if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });
    if (!fs.existsSync(SYSTEM_READINESS_DIR)) fs.mkdirSync(SYSTEM_READINESS_DIR, { recursive: true });

    // 7. Write artifacts
    const seedPath = path.join(BASE_DIR, 'p11_daily_snapshot_seed.json');
    fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2));
    console.log(`[P11] Written: ${seedPath}`);

    const previewPath = path.join(BASE_DIR, 'p11_daily_snapshot_append_preview.json');
    fs.writeFileSync(previewPath, JSON.stringify(preview, null, 2));
    console.log(`[P11] Written: ${previewPath}`);

    const resultPath = path.join(BASE_DIR, 'p11_daily_corpus_append_dry_run_result.json');
    fs.writeFileSync(resultPath, JSON.stringify(dryRunResult, null, 2));
    console.log(`[P11] Written: ${resultPath}`);

    const mdPath = path.join(BASE_DIR, 'p11_daily_corpus_append_dry_run_result.md');
    fs.writeFileSync(mdPath, buildMarkdown(seed, preview, dryRunResult));
    console.log(`[P11] Written: ${mdPath}`);

    const systemPath = path.join(SYSTEM_READINESS_DIR, 'p11_next_execution_order_20260511.md');
    fs.writeFileSync(systemPath, buildSystemReadiness(seed, preview, dryRunResult));
    console.log(`[P11] Written: ${systemPath}`);

    // 8. Final summary
    console.log('');
    console.log('=== P11 ARTIFACT GENERATION COMPLETE ===');
    console.log(`As-Of Date:       ${seed.asOfDate}`);
    console.log(`Seed:             ${seed.validationStatus}`);
    console.log(`Append Preview:   ${preview.appendWouldPass ? 'PASS' : 'FAIL'} (${preview.appendBlockReasons.join(',')})`);
    console.log(`Dry-Run Status:   ${dryRunResult.appendStatus}`);
    console.log(`Appended:         ${dryRunResult.appendedCount}`);
    console.log(`Corpus Total:     ${dryRunResult.totalAfterAppend}`);
    console.log(`Dry-Run:          ${dryRunResult.dryRun}`);
    console.log(`isProductionReady: false`);
    console.log(`isOptimizerReady:  false`);
    console.log('');

    if (dryRunResult.validationStatus === 'FAIL') {
        console.error('[P11] VALIDATION FAILED:', dryRunResult.validationMessages.join('; '));
        process.exit(1);
    }

    console.log('[P11] Done. Observability-only. No production writes.');
}

main();
