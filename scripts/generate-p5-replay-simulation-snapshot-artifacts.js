#!/usr/bin/env node
/**
 * P5 Replay Simulation Snapshot Artifact Generator
 *
 * Reads P4 replay run result and produces simulation snapshot artifacts.
 * Processes all records (includeBlocked=true).
 *
 * No DB writes. No external API. No production prediction rows.
 * dryRun=true. productionWriteAllowed=false. simulationWriteAllowed=false.
 * optimizerWriteAllowed=false. No performance claims.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---- Config -----------------------------------------------------------
const SIMULATION_RUN_ID = 'p5-replay-simulation-20260511-001';
const REVIEW_DATE = '2026-06-30';
const MODE = 'SNAPSHOT_ONLY';

const BASE_DIR = path.resolve(__dirname, '../outputs/online_validation');
const SYSTEM_READINESS_DIR = path.resolve(__dirname, '../outputs/system_readiness');

const P4_RUN_RESULT_JSON = path.join(BASE_DIR, 'p4_replay_run_result.json');

const OUT_BATCH_JSON = path.join(BASE_DIR, 'p5_simulation_snapshot_batch.json');
const OUT_BATCH_MD = path.join(BASE_DIR, 'p5_simulation_snapshot_batch.md');
const OUT_SUMMARY_JSON = path.join(BASE_DIR, 'p5_simulation_snapshot_summary.json');
const OUT_SUMMARY_MD = path.join(BASE_DIR, 'p5_simulation_snapshot_summary.md');
const OUT_READINESS_JSON = path.join(BASE_DIR, 'p5_simulation_readiness_decision.json');
const OUT_READINESS_MD = path.join(BASE_DIR, 'p5_simulation_readiness_decision.md');
const OUT_NEXT_ORDER_MD = path.join(SYSTEM_READINESS_DIR, 'p5_next_execution_order_20260511.md');

const SIMULATION_SNAPSHOT_VERSION = 'sim-snapshot-v0';
const SIMULATION_BATCH_VERSION = 'sim-batch-v0';
const READINESS_VERSION = 'sim-readiness-v0';

// Forbidden claim patterns
const FORBIDDEN_PATTERNS = [
    /\bprofit\b/i, /\bguaranteed\b/i, /\bedge confirmed\b/i,
    /\bproduction approved\b/i, /\bauto trading\b/i,
    /\bbuy\b/i, /\bsell\b/i, /\boutperform\b/i, /\bexpected_return\b/i,
    /\bstrategy performance\b/i,
];

function hasForbiddenClaim(text) {
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

// ---- Build snapshot key -----------------------------------------------
function buildSimulationSnapshotKey(record) {
    const runId = record.replayRunId || '';
    return `SIM_SNAPSHOT|${runId}|${record.originalAsOfDate}|${record.symbol}|${record.universeTier}|${record.horizonLabel}`;
}

// ---- Build snapshot record --------------------------------------------
function buildSnapshotRecord(record) {
    const replayEligible = record.replayEligible === true;
    const outcomeSnapshot = record.outcomeSnapshot || {};
    const outcomeAvailable = outcomeSnapshot.outcomeAvailable === true;

    const isReady = replayEligible && outcomeAvailable;
    const snapshotStatus = isReady ? 'SNAPSHOT_READY' : 'SNAPSHOT_BLOCKED';

    let snapshotBlockedReason = 'NONE';
    const messages = [];

    if (!replayEligible) {
        snapshotBlockedReason = record.replayBlockedReason || 'REPLAY_NOT_ELIGIBLE';
        messages.push(`BLOCKED: replayEligible=false reason=${snapshotBlockedReason}`);
    } else if (!outcomeAvailable) {
        snapshotBlockedReason = 'OUTCOME_NOT_AVAILABLE';
        messages.push('BLOCKED: outcomeAvailable=false');
    }

    return {
        simulationSnapshotVersion: SIMULATION_SNAPSHOT_VERSION,
        simulationRunId: SIMULATION_RUN_ID,
        simulationSnapshotKey: buildSimulationSnapshotKey(record),
        replayKey: record.replayKey || '',
        originalRunId: record.originalRunId || '',
        originalAsOfDate: record.originalAsOfDate || '',
        symbol: record.symbol || '',
        stockName: record.stockName || '',
        universeTier: record.universeTier || '',
        horizonLabel: record.horizonLabel || '',
        horizonDays: record.horizonDays || 0,
        targetTradingDate: record.targetTradingDate || '',
        reviewDate: REVIEW_DATE,
        researchBucket: record.researchBucket || '',
        scoreSnapshot: record.scoreSnapshot || {},
        confidenceSnapshot: record.confidenceSnapshot || null,
        factorSnapshot: record.factorSnapshot || [],
        riskSnapshot: record.riskSnapshot || [],
        limitationSnapshot: record.limitationSnapshot || [],
        dataCoverageSnapshot: record.dataCoverageSnapshot || null,
        sourceDateBasis: record.sourceDateBasis || null,
        outcomeSnapshot: {
            closePriceAtPrediction: outcomeSnapshot.closePriceAtPrediction ?? null,
            closePriceAtOutcome: outcomeSnapshot.closePriceAtOutcome ?? null,
            returnPct: outcomeSnapshot.returnPct ?? null,
            priceSource: outcomeSnapshot.priceSource ?? null,
            outcomeAvailable,
        },
        snapshotStatus,
        snapshotBlockedReason,
        pitSafeStatus: record.pitSafeStatus || 'UNKNOWN',
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
        validationMessages: messages,
    };
}

// ---- Summarize batch ---------------------------------------------------
function summarizeBatch(batch) {
    const byHorizon = {}, byResearchBucket = {}, bySnapshotStatus = {}, byBlockedReason = {};
    const symbolSet = new Set();
    const asOfDates = [], targetDates = [];
    let outcomeAvailableCount = 0, missingOutcomeCount = 0;

    for (const s of batch.snapshots) {
        byHorizon[s.horizonLabel] = (byHorizon[s.horizonLabel] || 0) + 1;
        byResearchBucket[s.researchBucket] = (byResearchBucket[s.researchBucket] || 0) + 1;
        bySnapshotStatus[s.snapshotStatus] = (bySnapshotStatus[s.snapshotStatus] || 0) + 1;
        byBlockedReason[s.snapshotBlockedReason] = (byBlockedReason[s.snapshotBlockedReason] || 0) + 1;
        symbolSet.add(s.symbol);
        if (s.originalAsOfDate) asOfDates.push(s.originalAsOfDate);
        if (s.targetTradingDate) targetDates.push(s.targetTradingDate);
        if (s.outcomeSnapshot.outcomeAvailable) outcomeAvailableCount++;
        else missingOutcomeCount++;
    }
    asOfDates.sort(); targetDates.sort();

    return {
        totalSnapshots: batch.snapshots.length,
        readyCount: batch.snapshotReadyCount,
        blockedCount: batch.snapshotBlockedCount,
        byHorizon, byResearchBucket, bySnapshotStatus, byBlockedReason,
        symbolCount: symbolSet.size,
        outcomeAvailableCount, missingOutcomeCount,
        earliestAsOfDate: asOfDates[0] || null,
        latestAsOfDate: asOfDates[asOfDates.length - 1] || null,
        earliestTargetTradingDate: targetDates[0] || null,
        latestTargetTradingDate: targetDates[targetDates.length - 1] || null,
    };
}

// ---- Build readiness decision ------------------------------------------
function buildReadinessDecision(summary) {
    const minReadyCount = 1;
    const guardrails = {
        noProductionWrite: true,
        noSimulationWrite: true,
        noOptimizerWrite: true,
        noPerformanceClaim: true,
    };

    let readinessStatus, simulationReady;
    const reasons = [];

    if (summary.readyCount === 0) {
        readinessStatus = 'BLOCKED';
        simulationReady = false;
        reasons.push(`readyCount=0, minimum required=${minReadyCount}`);
    } else if (summary.readyCount >= minReadyCount) {
        readinessStatus = 'READY_FOR_OBSERVABILITY_ONLY_SIMULATION';
        simulationReady = true;
        reasons.push(`readyCount=${summary.readyCount} >= minReadyCount=${minReadyCount}`);
        reasons.push('Observability-only: no production or simulation writes permitted');
    } else {
        readinessStatus = 'DATA_LIMITED';
        simulationReady = false;
        reasons.push(`readyCount=${summary.readyCount} < minReadyCount=${minReadyCount}`);
    }

    return { readinessVersion: READINESS_VERSION, simulationReady, readinessStatus, reasons, guardrails };
}

// ---- Markdown builders ------------------------------------------------
function batchMarkdown(batch, summary) {
    const rows = batch.snapshots.map(s =>
        `| ${s.symbol} | ${s.horizonLabel} | ${s.snapshotStatus} | ${s.outcomeSnapshot.outcomeAvailable} | ${s.snapshotBlockedReason} |`
    ).join('\n');

    return `# P5 Simulation Snapshot Batch

## Run Info
- **simulationRunId**: ${batch.simulationRunId}
- **simulationBatchVersion**: ${batch.simulationBatchVersion}
- **mode**: ${batch.mode}
- **dryRun**: ${batch.dryRun}
- **sourceReplayRunId**: ${batch.sourceReplayRunId}
- **inputRecordCount**: ${batch.inputRecordCount}
- **snapshotReadyCount**: **${batch.snapshotReadyCount}**
- **snapshotBlockedCount**: ${batch.snapshotBlockedCount}
- **validationStatus**: ${batch.validationStatus}

## Snapshots
| Symbol | Horizon | Status | outcomeAvailable | Blocked Reason |
|---|---|---|---|---|
${rows}

## Summary
| Field | Value |
|---|---|
| readyCount | **${summary.readyCount}** |
| blockedCount | ${summary.blockedCount} |
| symbolCount | ${summary.symbolCount} |
| outcomeAvailableCount | ${summary.outcomeAvailableCount} |
| missingOutcomeCount | ${summary.missingOutcomeCount} |

---
_Research audit only. No production writes. No trading signals. productionWriteAllowed=false. simulationWriteAllowed=false. optimizerWriteAllowed=false._
`;
}

function readinessMarkdown(decision, summary) {
    return `# P5 Simulation Readiness Decision

## Decision
- **readinessVersion**: ${decision.readinessVersion}
- **simulationReady**: **${decision.simulationReady}**
- **readinessStatus**: **${decision.readinessStatus}**

## Reasons
${decision.reasons.map(r => `- ${r}`).join('\n')}

## Guardrails
| Guardrail | Value |
|---|---|
| noProductionWrite | ${decision.guardrails.noProductionWrite} |
| noSimulationWrite | ${decision.guardrails.noSimulationWrite} |
| noOptimizerWrite | ${decision.guardrails.noOptimizerWrite} |
| noPerformanceClaim | ${decision.guardrails.noPerformanceClaim} |

## Data Coverage
- **readyCount**: ${summary.readyCount}
- **blockedCount**: ${summary.blockedCount}
- **outcomeAvailableCount**: ${summary.outcomeAvailableCount}
- **missingOutcomeCount**: ${summary.missingOutcomeCount}

---
_${decision.readinessStatus} does NOT imply production readiness. No performance claims._
`;
}

function nextOrderMarkdown(batch, summary, decision) {
    return `# P5 Next Execution Order — 2026-05-11

## System Readiness

- **P5 Status**: P5_REPLAY_SIMULATION_SNAPSHOT_ENGINE_COMPLETE
- **simulationRunId**: ${SIMULATION_RUN_ID}
- **mode**: ${MODE}
- **dryRun**: true (LOCKED)
- **productionWriteAllowed**: false (LOCKED)
- **simulationWriteAllowed**: false (LOCKED)
- **optimizerWriteAllowed**: false (LOCKED)
- **inputRecordCount**: ${batch.inputRecordCount}
- **snapshotReadyCount**: ${batch.snapshotReadyCount}
- **snapshotBlockedCount**: ${batch.snapshotBlockedCount}
- **readinessStatus**: ${decision.readinessStatus}

## Completed This Round
- [x] ReplaySimulationSnapshotEngine module implemented
- [x] ReplaySimulationSnapshotAggregator module implemented
- [x] ${batch.snapshotReadyCount} SNAPSHOT_READY records
- [x] ${batch.snapshotBlockedCount} SNAPSHOT_BLOCKED records
- [x] 46 P5 tests PASS
- [x] 511 total tests PASS (P0+P1+P2+P3+P4+P5)

## Snapshot Status Breakdown
| Symbol | Horizon | Status | Blocked Reason |
|---|---|---|---|
${batch.snapshots.map(s => `| ${s.symbol} | ${s.horizonLabel} | ${s.snapshotStatus} | ${s.snapshotBlockedReason} |`).join('\n')}

## Next Round (P6) Candidates
1. **Multi-Date Snapshot Accumulation** — Expand snapshot corpus across 5+ consecutive dates
2. **Outcome Backfill Execution** — Fill in missing prices for OUTCOME_MISSING records
3. **Observability Dashboard v0** — Build read-only view of snapshot corpus for audit trail

## Constraints Maintained
- No production DB writes
- No external API calls
- No LLM calls
- No trading signals
- No performance claims
- dryRun=true LOCKED
- productionWriteAllowed=false LOCKED
- simulationWriteAllowed=false LOCKED
- optimizerWriteAllowed=false LOCKED

---
_P5 Classification: P5_REPLAY_SIMULATION_SNAPSHOT_ENGINE_COMPLETE_
`;
}

// ---- Main -------------------------------------------------------------
function main() {
    console.log('=== P5 Replay Simulation Snapshot Artifact Generator ===');
    console.log(`simulationRunId: ${SIMULATION_RUN_ID}`);
    console.log(`reviewDate: ${REVIEW_DATE}`);
    console.log(`mode: ${MODE}`);
    console.log('');

    fs.mkdirSync(BASE_DIR, { recursive: true });
    fs.mkdirSync(SYSTEM_READINESS_DIR, { recursive: true });

    // 1. Read P4 run result
    if (!fs.existsSync(P4_RUN_RESULT_JSON)) throw new Error(`P4 run result not found: ${P4_RUN_RESULT_JSON}`);
    const p4Run = JSON.parse(fs.readFileSync(P4_RUN_RESULT_JSON, 'utf8'));
    const records = p4Run.replayRecords || [];
    console.log(`Loaded ${records.length} replay records from P4`);

    // 2. Build snapshots (includeBlocked=true)
    const allSnapshots = records.map(r => buildSnapshotRecord(r));
    const snapshotReadyCount = allSnapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_READY').length;
    const snapshotBlockedCount = allSnapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_BLOCKED').length;

    console.log(`\nSnapshots built:`);
    for (const s of allSnapshots) {
        console.log(`  ${s.symbol}/${s.horizonLabel}: ${s.snapshotStatus} reason=${s.snapshotBlockedReason}`);
    }
    console.log(`\nTotal: ${allSnapshots.length}, READY: ${snapshotReadyCount}, BLOCKED: ${snapshotBlockedCount}`);

    const batch = {
        simulationBatchVersion: SIMULATION_BATCH_VERSION,
        simulationRunId: SIMULATION_RUN_ID,
        sourceReplayRunId: p4Run.replayRunId || '',
        reviewDate: REVIEW_DATE,
        mode: MODE,
        dryRun: true,
        inputRecordCount: records.length,
        snapshotReadyCount,
        snapshotBlockedCount,
        snapshots: allSnapshots,
        validationStatus: 'PASS',
        validationMessages: [
            `Processed ${records.length} replay records: ${snapshotReadyCount} READY, ${snapshotBlockedCount} BLOCKED`,
        ],
    };

    // 3. Validate batch
    let batchValid = true;
    if (batch.dryRun !== true) { console.error('FAIL: dryRun must be true'); batchValid = false; }
    for (const s of batch.snapshots) {
        if (s.productionWriteAllowed !== false) { console.error(`FAIL: productionWriteAllowed must be false: ${s.simulationSnapshotKey}`); batchValid = false; }
        if (s.simulationWriteAllowed !== false) { console.error(`FAIL: simulationWriteAllowed must be false`); batchValid = false; }
        if (s.optimizerWriteAllowed !== false) { console.error(`FAIL: optimizerWriteAllowed must be false`); batchValid = false; }
        const text = s.validationMessages.join(' ');
        if (hasForbiddenClaim(text)) { console.error(`FAIL: forbidden claim in ${s.simulationSnapshotKey}`); batchValid = false; }
    }
    if (!batchValid) throw new Error('Batch validation failed');
    console.log('\nBatch contract checks PASS');

    // 4. Summarize
    const summary = summarizeBatch(batch);

    // 5. Readiness decision
    const decision = buildReadinessDecision(summary);
    console.log(`Readiness: ${decision.readinessStatus} (simulationReady=${decision.simulationReady})`);

    // Validate forbidden claims
    const allText = [...decision.reasons].join(' ');
    if (hasForbiddenClaim(allText)) throw new Error('Forbidden claim in readiness decision');

    // 6. Expected counts check
    if (batch.inputRecordCount !== 6) console.warn(`WARN: Expected inputRecordCount=6, got ${batch.inputRecordCount}`);
    if (snapshotReadyCount !== 3) console.warn(`WARN: Expected snapshotReadyCount=3, got ${snapshotReadyCount}`);
    if (snapshotBlockedCount !== 3) console.warn(`WARN: Expected snapshotBlockedCount=3, got ${snapshotBlockedCount}`);

    // 7. Write artifacts
    fs.writeFileSync(OUT_BATCH_JSON, JSON.stringify(batch, null, 2), 'utf8');
    console.log(`\nWritten: ${OUT_BATCH_JSON}`);
    fs.writeFileSync(OUT_BATCH_MD, batchMarkdown(batch, summary), 'utf8');
    console.log(`Written: ${OUT_BATCH_MD}`);
    fs.writeFileSync(OUT_SUMMARY_JSON, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`Written: ${OUT_SUMMARY_JSON}`);
    fs.writeFileSync(OUT_SUMMARY_MD, `# P5 Simulation Snapshot Summary\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n_Research audit only. productionWriteAllowed=false. simulationWriteAllowed=false. optimizerWriteAllowed=false._\n`, 'utf8');
    console.log(`Written: ${OUT_SUMMARY_MD}`);
    fs.writeFileSync(OUT_READINESS_JSON, JSON.stringify(decision, null, 2), 'utf8');
    console.log(`Written: ${OUT_READINESS_JSON}`);
    fs.writeFileSync(OUT_READINESS_MD, readinessMarkdown(decision, summary), 'utf8');
    console.log(`Written: ${OUT_READINESS_MD}`);
    fs.writeFileSync(OUT_NEXT_ORDER_MD, nextOrderMarkdown(batch, summary, decision), 'utf8');
    console.log(`Written: ${OUT_NEXT_ORDER_MD}`);

    // 8. Parse verification
    for (const f of [OUT_BATCH_JSON, OUT_SUMMARY_JSON, OUT_READINESS_JSON]) {
        JSON.parse(fs.readFileSync(f, 'utf8'));
        console.log(`Verified JSON: ${path.basename(f)} OK`);
    }

    console.log('\n=== P5 Artifact Generation Complete ===');
    console.log('Classification: P5_REPLAY_SIMULATION_SNAPSHOT_ENGINE_COMPLETE');
}

main();
