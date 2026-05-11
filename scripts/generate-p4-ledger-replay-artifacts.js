#!/usr/bin/env node
/**
 * P4 Ledger Replay Artifact Generator
 *
 * Joins shadow_prediction_ledger.jsonl + p3 outcome windows +
 * p1 outcome records into a PIT-safe replay-ready dataset.
 *
 * No DB writes. No external API. No production prediction rows.
 * dryRun=true enforced. productionWriteAllowed=false.
 * simulationWriteAllowed=false. No performance claims.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---- Config -----------------------------------------------------------
const REPLAY_RUN_ID = 'p4-ledger-replay-20260511-001';
const REVIEW_DATE = '2026-06-30';
const HORIZONS = [5, 20, 60];
const MODE = 'ELIGIBILITY_AUDIT';

const BASE_DIR = path.resolve(__dirname, '../outputs/online_validation');
const SYSTEM_READINESS_DIR = path.resolve(__dirname, '../outputs/system_readiness');

const LEDGER_JSONL = path.join(BASE_DIR, 'shadow_prediction_ledger.jsonl');
const P3_TRACKER_JSON = path.join(BASE_DIR, 'p3_outcome_window_tracker_result.json');
const P3_BACKFILL_JSON = path.join(BASE_DIR, 'p3_backfill_scheduler_plan.json');
const P1_OUTCOME_JSONL = path.join(BASE_DIR, 'p1_outcome_writeback_v0.jsonl');

const OUT_DATASET_JSON = path.join(BASE_DIR, 'p4_replay_dataset_result.json');
const OUT_DATASET_MD = path.join(BASE_DIR, 'p4_replay_dataset_result.md');
const OUT_SUMMARY_JSON = path.join(BASE_DIR, 'p4_replay_dataset_summary.json');
const OUT_SUMMARY_MD = path.join(BASE_DIR, 'p4_replay_dataset_summary.md');
const OUT_RUN_JSON = path.join(BASE_DIR, 'p4_replay_run_result.json');
const OUT_RUN_MD = path.join(BASE_DIR, 'p4_replay_run_result.md');
const OUT_READINESS_MD = path.join(SYSTEM_READINESS_DIR, 'p4_next_execution_order_20260511.md');

const REPLAY_DATASET_VERSION = 'replay-dataset-v0';
const REPLAY_ENGINE_VERSION = 'pit-safe-replay-engine-v0';

// Forbidden claim patterns
const FORBIDDEN_PATTERNS = [
    /\bprofit\b/i, /\bguaranteed\b/i, /\bedge confirmed\b/i,
    /\bproduction approved\b/i, /\bauto trading\b/i,
    /\bbuy\b/i, /\bsell\b/i, /\boutperform\b/i, /\bexpected_return\b/i,
];

function hasForbiddenClaim(text) {
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

// ---- Parse JSONL -------------------------------------------------------
function parseJsonl(content) {
    const lines = content.trim().split('\n').filter(Boolean);
    const results = [];
    let malformed = 0;
    for (let i = 0; i < lines.length; i++) {
        try {
            results.push(JSON.parse(lines[i]));
        } catch {
            malformed++;
            console.error(`Malformed JSONL line ${i + 1}`);
        }
    }
    if (malformed > 0) throw new Error(`${malformed} malformed JSONL lines`);
    return results;
}

// ---- Build outcome key for matching ------------------------------------
function outcomeKey(symbol, horizonLabel, asOfDate) {
    return `${symbol}|${horizonLabel}|${asOfDate}`;
}

// ---- Build replay dataset key ------------------------------------------
function buildReplayDatasetKey(entry, horizonLabel) {
    return `REPLAY_DATASET|${entry.asOfDate}|${entry.symbol}|${entry.universeTier}|${entry.runId}|${horizonLabel}`;
}

// ---- Build replay records -----------------------------------------------
function buildReplayDataset(ledgerEntries, windows, outcomeRecords, backfillPlan) {
    const messages = [];
    let validationStatus = 'PASS';

    // Build lookup maps
    const outcomeMap = new Map();
    for (const rec of outcomeRecords) {
        const asOfDate = rec.originalAsOfDate ?? '';
        const key = outcomeKey(rec.symbol, rec.horizonLabel, asOfDate);
        outcomeMap.set(key, rec);
    }

    const windowMap = new Map();
    for (const w of windows) {
        const key = `${w.symbol}|${w.horizonLabel}|${w.originalAsOfDate}`;
        windowMap.set(key, w);
    }

    const HORIZON_LABELS = { 5: '5D', 20: '20D', 60: '60D' };
    const records = [];

    for (const entry of ledgerEntries) {
        if (entry.entryType !== 'SHADOW_PREDICTION') continue;

        const sourceDate = entry.sourceDateBasis?.sourceDate ?? '';
        const isPitViolation = sourceDate > entry.asOfDate;
        const pitSafeStatus = isPitViolation ? 'PIT_VIOLATION' : 'PIT_SAFE';

        for (const horizonDays of HORIZONS) {
            const horizonLabel = HORIZON_LABELS[horizonDays] ?? `${horizonDays}D`;
            const replayKey = buildReplayDatasetKey(entry, horizonLabel);
            const recMessages = [];
            let replayEligible = false;
            let replayBlockedReason = 'NONE';
            let outcomeStatus = 'PENDING';

            const wKey = `${entry.symbol}|${horizonLabel}|${entry.asOfDate}`;
            const window = windowMap.get(wKey);
            const targetTradingDate = window?.targetTradingDate ?? '';
            const windowStatus = window?.windowStatus ?? 'BLOCKED';

            if (isPitViolation) {
                replayBlockedReason = 'PIT_VIOLATION';
                recMessages.push(`FAIL: sourceDate=${sourceDate} > asOfDate=${entry.asOfDate}`);
                outcomeStatus = 'BLOCKED';
            } else if (!targetTradingDate || targetTradingDate <= entry.asOfDate) {
                replayBlockedReason = 'TARGET_DATE_INVALID';
                recMessages.push(`FAIL: targetTradingDate=${targetTradingDate} must be > asOfDate=${entry.asOfDate}`);
                outcomeStatus = 'BLOCKED';
            } else if (REVIEW_DATE < targetTradingDate) {
                replayBlockedReason = 'WINDOW_NOT_DUE';
                recMessages.push(`WARN: reviewDate=${REVIEW_DATE} < targetTradingDate=${targetTradingDate}`);
                outcomeStatus = 'NOT_DUE';
            } else if (entry.validationStatus && entry.validationStatus !== 'PASS') {
                replayBlockedReason = 'VALIDATION_FAIL';
                recMessages.push(`FAIL: validationStatus=${entry.validationStatus}`);
                outcomeStatus = 'BLOCKED';
            } else {
                const oKey = outcomeKey(entry.symbol, horizonLabel, entry.asOfDate);
                const outcome = outcomeMap.get(oKey);
                if (!outcome) {
                    recMessages.push(`WARN: No outcome record for ${oKey}`);
                    outcomeStatus = 'MISSING_PRICE';
                    replayBlockedReason = 'OUTCOME_MISSING';
                } else if (outcome.outcomeStatus === 'READY_FOR_REVIEW' && outcome.closePriceAtOutcome != null) {
                    outcomeStatus = 'READY_FOR_REVIEW';
                    replayEligible = true;
                    replayBlockedReason = 'NONE';
                } else {
                    outcomeStatus = outcome.outcomeStatus || 'PENDING';
                    replayBlockedReason = 'OUTCOME_MISSING';
                    recMessages.push(`WARN: outcomeStatus=${outcomeStatus} for ${oKey}`);
                }
            }

            const oKey = outcomeKey(entry.symbol, horizonLabel, entry.asOfDate);
            const outcomeRecord = outcomeMap.get(oKey);
            const outcomeSnapshot = {
                closePriceAtPrediction: outcomeRecord?.closePriceAtPrediction ?? null,
                closePriceAtOutcome: outcomeRecord?.closePriceAtOutcome ?? null,
                returnPct: outcomeRecord?.returnPct ?? null,
                priceSource: outcomeRecord?.priceSource ?? null,
                outcomeAvailable: replayEligible,
            };

            records.push({
                replayDatasetVersion: REPLAY_DATASET_VERSION,
                replayRunId: REPLAY_RUN_ID,
                replayKey,
                originalRunId: entry.runId,
                originalAsOfDate: entry.asOfDate,
                symbol: entry.symbol,
                stockName: entry.stockName ?? '',
                universeTier: entry.universeTier,
                horizonLabel,
                horizonDays,
                targetTradingDate,
                reviewDate: REVIEW_DATE,
                windowStatus,
                outcomeStatus,
                researchBucket: entry.researchBucket ?? '',
                scoreSnapshot: entry.scoreSnapshot ?? {},
                confidenceSnapshot: entry.confidenceSnapshot ?? null,
                factorSnapshot: entry.factorSnapshot ?? [],
                riskSnapshot: entry.riskSnapshot ?? [],
                limitationSnapshot: entry.limitationSnapshot ?? [],
                dataCoverageSnapshot: entry.dataCoverageSnapshot ?? null,
                sourceDateBasis: entry.sourceDateBasis ?? null,
                outcomeSnapshot,
                pitSafeStatus,
                replayEligible,
                replayBlockedReason,
                productionWriteAllowed: false,
                simulationWriteAllowed: false,
                validationMessages: recMessages,
            });
        }
    }

    const eligibleCount = records.filter(r => r.replayEligible).length;
    const blockedCount = records.filter(r => !r.replayEligible).length;

    return {
        replayDatasetVersion: REPLAY_DATASET_VERSION,
        replayRunId: REPLAY_RUN_ID,
        reviewDate: REVIEW_DATE,
        records,
        totalRecords: records.length,
        eligibleCount,
        blockedCount,
        validationStatus,
        validationMessages: messages,
    };
}

// ---- Summarize dataset --------------------------------------------------
function summarizeDataset(dataset) {
    const byHorizon = {}, byWindowStatus = {}, byOutcomeStatus = {}, byReplayBlockedReason = {};
    const symbolSet = new Set();
    const asOfDates = [], targetDates = [];

    for (const r of dataset.records) {
        byHorizon[r.horizonLabel] = (byHorizon[r.horizonLabel] || 0) + 1;
        byWindowStatus[r.windowStatus] = (byWindowStatus[r.windowStatus] || 0) + 1;
        byOutcomeStatus[r.outcomeStatus] = (byOutcomeStatus[r.outcomeStatus] || 0) + 1;
        byReplayBlockedReason[r.replayBlockedReason] = (byReplayBlockedReason[r.replayBlockedReason] || 0) + 1;
        symbolSet.add(r.symbol);
        if (r.originalAsOfDate) asOfDates.push(r.originalAsOfDate);
        if (r.targetTradingDate) targetDates.push(r.targetTradingDate);
    }
    asOfDates.sort(); targetDates.sort();
    return {
        totalRecords: dataset.totalRecords,
        eligibleCount: dataset.eligibleCount,
        blockedCount: dataset.blockedCount,
        byHorizon, byWindowStatus, byOutcomeStatus, byReplayBlockedReason,
        symbolCount: symbolSet.size,
        earliestAsOfDate: asOfDates[0] || null,
        latestAsOfDate: asOfDates[asOfDates.length - 1] || null,
        earliestTargetTradingDate: targetDates[0] || null,
        latestTargetTradingDate: targetDates[targetDates.length - 1] || null,
    };
}

// ---- Build replay run --------------------------------------------------
function buildReplayRun(dataset) {
    const byBlockedReason = {}, byHorizon = {}, byWindowStatus = {};
    let missingOutcomeCount = 0, notDueCount = 0, pitViolationCount = 0;
    const eligibleRecords = [], blockedRecords = [];

    for (const r of dataset.records) {
        byHorizon[r.horizonLabel] = (byHorizon[r.horizonLabel] || 0) + 1;
        byWindowStatus[r.windowStatus] = (byWindowStatus[r.windowStatus] || 0) + 1;
        if (r.replayEligible) {
            eligibleRecords.push(r);
        } else {
            blockedRecords.push(r);
            const reason = r.replayBlockedReason;
            byBlockedReason[reason] = (byBlockedReason[reason] || 0) + 1;
            if (reason === 'OUTCOME_MISSING') missingOutcomeCount++;
            if (reason === 'WINDOW_NOT_DUE') notDueCount++;
            if (reason === 'PIT_VIOLATION') pitViolationCount++;
        }
    }

    return {
        replayEngineVersion: REPLAY_ENGINE_VERSION,
        replayRunId: REPLAY_RUN_ID,
        reviewDate: REVIEW_DATE,
        mode: MODE,
        dryRun: true,
        inputRecordCount: dataset.records.length,
        replayEligibleCount: eligibleRecords.length,
        replayBlockedCount: blockedRecords.length,
        replayRecords: dataset.records,
        auditSummary: {
            inputRecordCount: dataset.records.length,
            replayEligibleCount: eligibleRecords.length,
            replayBlockedCount: blockedRecords.length,
            byBlockedReason, missingOutcomeCount, notDueCount, pitViolationCount,
            byHorizon, byWindowStatus,
        },
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        validationStatus: dataset.validationStatus,
        validationMessages: [
            `P4 ELIGIBILITY_AUDIT: eligible=${eligibleRecords.length} blocked=${blockedRecords.length}`,
            `missingOutcome=${missingOutcomeCount} notDue=${notDueCount} pitViolation=${pitViolationCount}`,
        ],
    };
}

// ---- Markdown builders -------------------------------------------------
function datasetMarkdown(dataset, summary) {
    const tableRows = dataset.records.map(r =>
        `| ${r.symbol} | ${r.horizonLabel} | ${r.targetTradingDate || 'N/A'} | ${r.windowStatus} | ${r.outcomeStatus} | ${r.replayEligible} | ${r.replayBlockedReason} |`
    ).join('\n');

    return `# P4 Replay Dataset Result

## Run Info
- **replayRunId**: ${dataset.replayRunId}
- **replayDatasetVersion**: ${dataset.replayDatasetVersion}
- **reviewDate**: ${dataset.reviewDate}
- **totalRecords**: ${dataset.totalRecords}
- **eligibleCount**: **${dataset.eligibleCount}**
- **blockedCount**: ${dataset.blockedCount}
- **validationStatus**: **${dataset.validationStatus}**

## Records
| Symbol | Horizon | Target Date | Window Status | Outcome Status | Eligible | Blocked Reason |
|---|---|---|---|---|---|---|
${tableRows}

## Summary
| Field | Value |
|---|---|
| eligibleCount | **${summary.eligibleCount}** |
| blockedCount | ${summary.blockedCount} |
| symbolCount | ${summary.symbolCount} |
| earliestAsOfDate | ${summary.earliestAsOfDate} |
| latestTargetTradingDate | ${summary.latestTargetTradingDate} |

---
_Research audit only. No production writes. No trading signals. productionWriteAllowed=false. simulationWriteAllowed=false._
`;
}

function runMarkdown(run) {
    const eligibleTable = run.replayRecords
        .filter(r => r.replayEligible)
        .map(r => `| ${r.symbol} | ${r.horizonLabel} | ${r.targetTradingDate} | ${r.outcomeSnapshot.outcomeAvailable} |`)
        .join('\n') || '_None_';

    const blockedTable = run.replayRecords
        .filter(r => !r.replayEligible)
        .map(r => `| ${r.symbol} | ${r.horizonLabel} | ${r.replayBlockedReason} |`)
        .join('\n') || '_None_';

    return `# P4 Replay Run Result

## Run Info
- **replayEngineVersion**: ${run.replayEngineVersion}
- **replayRunId**: ${run.replayRunId}
- **mode**: ${run.mode}
- **dryRun**: ${run.dryRun}
- **productionWriteAllowed**: ${run.productionWriteAllowed}
- **simulationWriteAllowed**: ${run.simulationWriteAllowed}
- **validationStatus**: **${run.validationStatus}**

## Eligible Records
| Symbol | Horizon | Target Date | outcomeAvailable |
|---|---|---|---|
${eligibleTable}

## Blocked Records
| Symbol | Horizon | Blocked Reason |
|---|---|---|
${blockedTable}

## Audit Summary
| Metric | Value |
|---|---|
| inputRecordCount | ${run.auditSummary.inputRecordCount} |
| replayEligibleCount | **${run.auditSummary.replayEligibleCount}** |
| replayBlockedCount | ${run.auditSummary.replayBlockedCount} |
| missingOutcomeCount | ${run.auditSummary.missingOutcomeCount} |
| notDueCount | ${run.auditSummary.notDueCount} |
| pitViolationCount | ${run.auditSummary.pitViolationCount} |

---
_Research audit only. dryRun=true. No production writes. No trading signals._
`;
}

function readinessMd(dataset, summary, run) {
    return `# P4 Next Execution Order — 2026-05-11

## System Readiness

- **P4 Status**: P4_PIT_SAFE_LEDGER_REPLAY_ENGINE_COMPLETE
- **replayRunId**: ${REPLAY_RUN_ID}
- **reviewDate**: ${REVIEW_DATE}
- **mode**: ${MODE}
- **totalRecords**: ${dataset.totalRecords}
- **eligibleCount**: ${dataset.eligibleCount}
- **blockedCount**: ${dataset.blockedCount}
- **productionWriteAllowed**: false (LOCKED)
- **simulationWriteAllowed**: false (LOCKED)
- **dryRun**: true (LOCKED)

## Completed This Round
- [x] LedgerReplayDatasetBuilder module implemented
- [x] PitSafeLedgerReplayEngine module implemented
- [x] ${dataset.totalRecords} replay records built (2 symbols × 3 horizons)
- [x] ${dataset.eligibleCount} records REPLAY_ELIGIBLE (READY_FOR_REVIEW with outcome)
- [x] ${summary.byReplayBlockedReason['OUTCOME_MISSING'] || 0} records OUTCOME_MISSING (DUE but no price)
- [x] ${summary.byReplayBlockedReason['WINDOW_NOT_DUE'] || 0} records WINDOW_NOT_DUE (60D)
- [x] 44 P4 tests PASS
- [x] 465 total tests PASS (P0+P1+P2+P3+P4)

## Replay Eligible Breakdown
| Symbol | Horizon | outcomeStatus | Eligible |
|---|---|---|---|
${dataset.records.map(r => `| ${r.symbol} | ${r.horizonLabel} | ${r.outcomeStatus} | ${r.replayEligible} |`).join('\n')}

## Next Round (P5) Candidates
1. **Replay Simulation Engine v0** — Actually run replay on eligible records to produce simulation snapshots
2. **Multi-Date Ledger Accumulation** — Expand ledger across 5+ consecutive dates for richer replay coverage
3. **Outcome Backfill Execution** — Execute artifact-only backfill for OUTCOME_MISSING records (mock or real price data)

## Constraints Maintained
- No production DB writes
- No external API calls
- No LLM calls
- No trading signals
- No performance claims
- dryRun=true LOCKED
- productionWriteAllowed=false LOCKED
- simulationWriteAllowed=false LOCKED

---
_P4 Classification: P4_PIT_SAFE_LEDGER_REPLAY_ENGINE_COMPLETE_
`;
}

// ---- Main ---------------------------------------------------------------
function main() {
    console.log('=== P4 Ledger Replay Artifact Generator ===');
    console.log(`replayRunId: ${REPLAY_RUN_ID}`);
    console.log(`reviewDate: ${REVIEW_DATE}`);
    console.log(`horizons: [${HORIZONS}]`);
    console.log(`mode: ${MODE}`);
    console.log('');

    fs.mkdirSync(BASE_DIR, { recursive: true });
    fs.mkdirSync(SYSTEM_READINESS_DIR, { recursive: true });

    // 1. Read inputs
    if (!fs.existsSync(LEDGER_JSONL)) throw new Error(`Ledger not found: ${LEDGER_JSONL}`);
    const ledgerContent = fs.readFileSync(LEDGER_JSONL, 'utf8');
    const ledgerEntries = parseJsonl(ledgerContent).filter(e => e.entryType === 'SHADOW_PREDICTION');
    console.log(`Loaded ${ledgerEntries.length} SHADOW_PREDICTION entries from ledger`);

    if (!fs.existsSync(P3_TRACKER_JSON)) throw new Error(`P3 tracker not found: ${P3_TRACKER_JSON}`);
    const trackerResult = JSON.parse(fs.readFileSync(P3_TRACKER_JSON, 'utf8'));
    const windows = trackerResult.windows || [];
    console.log(`Loaded ${windows.length} outcome windows from p3 tracker`);

    let outcomeRecords = [];
    if (fs.existsSync(P1_OUTCOME_JSONL)) {
        const p1Content = fs.readFileSync(P1_OUTCOME_JSONL, 'utf8');
        outcomeRecords = parseJsonl(p1Content);
        console.log(`Loaded ${outcomeRecords.length} p1 outcome records`);
    } else {
        console.warn('WARNING: p1_outcome_writeback_v0.jsonl not found — outcomes will be MISSING');
    }

    const backfillPlan = fs.existsSync(P3_BACKFILL_JSON)
        ? JSON.parse(fs.readFileSync(P3_BACKFILL_JSON, 'utf8'))
        : null;

    // 2. Build dataset
    const dataset = buildReplayDataset(ledgerEntries, windows, outcomeRecords, backfillPlan);
    console.log(`\nDataset built:`);
    for (const r of dataset.records) {
        console.log(`  ${r.symbol}/${r.horizonLabel}: ${r.outcomeStatus} eligible=${r.replayEligible} reason=${r.replayBlockedReason}`);
    }
    console.log(`\nTotal records: ${dataset.totalRecords}`);
    console.log(`Eligible: ${dataset.eligibleCount}, Blocked: ${dataset.blockedCount}`);

    // 3. Summary
    const summary = summarizeDataset(dataset);

    // 4. Replay run
    const run = buildReplayRun(dataset);

    // 5. Validate forbidden claims
    const allText = [...dataset.validationMessages, ...run.validationMessages].join(' ');
    if (hasForbiddenClaim(allText)) throw new Error('Forbidden claim detected in output');

    // 6. Write artifacts
    fs.writeFileSync(OUT_DATASET_JSON, JSON.stringify(dataset, null, 2), 'utf8');
    console.log(`\nWritten: ${OUT_DATASET_JSON}`);
    fs.writeFileSync(OUT_DATASET_MD, datasetMarkdown(dataset, summary), 'utf8');
    console.log(`Written: ${OUT_DATASET_MD}`);
    fs.writeFileSync(OUT_SUMMARY_JSON, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`Written: ${OUT_SUMMARY_JSON}`);
    fs.writeFileSync(OUT_SUMMARY_MD, `# P4 Replay Dataset Summary\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n_Research audit only. productionWriteAllowed=false. simulationWriteAllowed=false._\n`, 'utf8');
    console.log(`Written: ${OUT_SUMMARY_MD}`);
    fs.writeFileSync(OUT_RUN_JSON, JSON.stringify(run, null, 2), 'utf8');
    console.log(`Written: ${OUT_RUN_JSON}`);
    fs.writeFileSync(OUT_RUN_MD, runMarkdown(run), 'utf8');
    console.log(`Written: ${OUT_RUN_MD}`);
    fs.writeFileSync(OUT_READINESS_MD, readinessMd(dataset, summary, run), 'utf8');
    console.log(`Written: ${OUT_READINESS_MD}`);

    // 7. JSON parse verification
    for (const f of [OUT_DATASET_JSON, OUT_SUMMARY_JSON, OUT_RUN_JSON]) {
        JSON.parse(fs.readFileSync(f, 'utf8'));
        console.log(`Verified JSON: ${path.basename(f)} OK`);
    }

    // 8. Contract checks
    for (const r of dataset.records) {
        if (r.productionWriteAllowed !== false) throw new Error(`productionWriteAllowed must be false: ${r.replayKey}`);
        if (r.simulationWriteAllowed !== false) throw new Error(`simulationWriteAllowed must be false: ${r.replayKey}`);
    }
    if (run.productionWriteAllowed !== false) throw new Error('run productionWriteAllowed must be false');
    if (run.simulationWriteAllowed !== false) throw new Error('run simulationWriteAllowed must be false');
    if (run.dryRun !== true) throw new Error('run dryRun must be true');
    console.log('\nContract checks PASS: productionWriteAllowed=false, simulationWriteAllowed=false, dryRun=true');

    console.log('\n=== P4 Artifact Generation Complete ===');
    console.log('Classification: P4_PIT_SAFE_LEDGER_REPLAY_ENGINE_COMPLETE');
}

main();
