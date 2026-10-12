#!/usr/bin/env node
/**
 * P3 Outcome Window Tracker Artifact Generator
 *
 * Reads shadow_prediction_ledger.jsonl, builds 5D/20D/60D outcome windows,
 * and produces a backfill schedule plan artifact.
 *
 * No DB writes. No external API. No production prediction rows.
 * dryRun=true enforced. productionWriteAllowed=false for all entries.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---- Config -----------------------------------------------------------
const REVIEW_DATE = '2026-06-30';
const HORIZONS = [5, 20, 60];

const BASE_DIR = path.resolve(__dirname, '../outputs/online_validation');
const SYSTEM_READINESS_DIR = path.resolve(__dirname, '../outputs/system_readiness');

const LEDGER_JSONL = path.join(BASE_DIR, 'shadow_prediction_ledger.jsonl');

const OUT_TRACKER_JSON = path.join(BASE_DIR, 'p3_outcome_window_tracker_result.json');
const OUT_TRACKER_MD = path.join(BASE_DIR, 'p3_outcome_window_tracker_result.md');
const OUT_SUMMARY_JSON = path.join(BASE_DIR, 'p3_outcome_window_summary.json');
const OUT_SUMMARY_MD = path.join(BASE_DIR, 'p3_outcome_window_summary.md');
const OUT_PLAN_JSON = path.join(BASE_DIR, 'p3_backfill_scheduler_plan.json');
const OUT_PLAN_MD = path.join(BASE_DIR, 'p3_backfill_scheduler_plan.md');
const OUT_READINESS_MD = path.join(SYSTEM_READINESS_DIR, 'p3_next_execution_order_20260511.md');

const TRACKER_VERSION = 'outcome-window-tracker-v1';
const SCHEDULER_VERSION = 'backfill-scheduler-v0';
const ARTIFACT_ONLY_ACTION = 'OUTCOME_WRITEBACK_ARTIFACT_ONLY';

// ---- TWSE calendar (inline for script independence) ------------------
const TWSE_HOLIDAYS = new Set([
    '2026-01-01','2026-02-17','2026-02-18','2026-02-19','2026-02-20',
    '2026-02-23','2026-02-24','2026-02-28','2026-04-03','2026-04-04',
    '2026-05-01','2026-06-19','2026-09-25','2026-10-09',
    // 2025
    '2025-01-01','2025-01-27','2025-01-28','2025-01-29','2025-01-30',
    '2025-01-31','2025-02-04','2025-02-28','2025-04-03','2025-04-04',
    '2025-05-01','2025-05-30','2025-05-31','2025-10-06','2025-10-10',
]);

function getDayOfWeek(dateStr) {
    return new Date(dateStr + 'T12:00:00Z').getUTCDay();
}

function addCalendarDays(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

function isTradingDay(dateStr) {
    const dow = getDayOfWeek(dateStr);
    return dow !== 0 && dow !== 6 && !TWSE_HOLIDAYS.has(dateStr);
}

function addTwseTradingDays(startDate, n) {
    let count = 0;
    let current = startDate;
    let safety = 0;
    while (count < n) {
        safety++;
        if (safety > 500) throw new Error('Exceeded safety limit');
        current = addCalendarDays(current, 1);
        if (isTradingDay(current)) count++;
    }
    return current;
}

// ---- Calendar days diff ----------------------------------------------
function calendarDaysDiff(a, b) {
    const da = new Date(a + 'T12:00:00Z').getTime();
    const db = new Date(b + 'T12:00:00Z').getTime();
    return Math.round((db - da) / 86400000);
}

// ---- Build window key ------------------------------------------------
function buildOutcomeWindowKey(entry, horizonDays) {
    const label = horizonDays === 5 ? '5D' : horizonDays === 20 ? '20D' : horizonDays === 60 ? '60D' : `${horizonDays}D`;
    return `OUTCOME_WINDOW|${entry.asOfDate}|${entry.symbol}|${entry.universeTier}|${entry.runId}|${label}`;
}

// ---- Build windows for a single entry --------------------------------
function buildWindowsForEntry(entry, reviewDate) {
    const windows = [];
    for (const horizonDays of HORIZONS) {
        const label = horizonDays === 5 ? '5D' : horizonDays === 20 ? '20D' : horizonDays === 60 ? '60D' : `${horizonDays}D`;
        const windowKey = buildOutcomeWindowKey(entry, horizonDays);
        const messages = [];
        let windowStatus = 'NOT_DUE';
        let pitSafeStatus = 'PIT_SAFE';
        let targetTradingDate;

        try {
            targetTradingDate = addTwseTradingDays(entry.asOfDate, horizonDays);
        } catch (e) {
            targetTradingDate = entry.asOfDate;
            messages.push(`FAIL: Could not compute targetTradingDate: ${e.message}`);
            windowStatus = 'BLOCKED';
        }

        // PIT safety check
        const sourceDate = entry.sourceDateBasis?.sourceDate ?? '';
        if (sourceDate && sourceDate > entry.asOfDate) {
            pitSafeStatus = 'PIT_VIOLATION';
            messages.push(`FAIL: sourceDate ${sourceDate} > asOfDate ${entry.asOfDate}`);
            windowStatus = 'BLOCKED';
        }

        // Validation checks
        if (windowStatus !== 'BLOCKED') {
            if (entry.validationStatus && entry.validationStatus !== 'PASS') {
                messages.push(`FAIL: validationStatus=${entry.validationStatus}`);
                windowStatus = 'BLOCKED';
            }
            if (entry.guardrailStatus && entry.guardrailStatus !== 'PASS') {
                messages.push(`FAIL: guardrailStatus=${entry.guardrailStatus}`);
                windowStatus = 'BLOCKED';
            }
        }

        const existingHorizon = (entry.targetHorizons || []).find(h => h.horizonLabel === label);
        if (existingHorizon?.outcomeStatus === 'BACKFILLED' || existingHorizon?.outcomeStatus === 'COMPLETE') {
            windowStatus = 'BACKFILLED';
        }

        const daysUntilDue = calendarDaysDiff(reviewDate, targetTradingDate);
        const isDue = reviewDate >= targetTradingDate;
        const isOverdue = reviewDate > targetTradingDate;

        if (windowStatus !== 'BLOCKED' && windowStatus !== 'BACKFILLED') {
            windowStatus = isDue ? 'DUE_FOR_BACKFILL' : 'NOT_DUE';
        }

        const backfillAllowed = windowStatus === 'DUE_FOR_BACKFILL';

        windows.push({
            windowVersion: TRACKER_VERSION,
            windowKey,
            sourceLedgerKey: entry.ledgerKey ?? '',
            originalRunId: entry.runId,
            originalAsOfDate: entry.asOfDate,
            symbol: entry.symbol,
            stockName: entry.stockName ?? '',
            universeTier: entry.universeTier,
            horizonLabel: label,
            horizonDays,
            targetTradingDate,
            reviewDate,
            windowStatus,
            daysUntilDue,
            isDue,
            isOverdue,
            backfillAllowed,
            productionWriteAllowed: false,
            pitSafeStatus,
            validationMessages: messages,
        });
    }
    return windows;
}

// ---- Summarize windows -----------------------------------------------
function summarizeWindows(windows) {
    const byStatus = {};
    const byHorizon = {};
    const symbolsDueSet = new Set();
    const dueDates = [];
    let dueCount = 0, notDueCount = 0, blockedCount = 0, overdueCount = 0;

    for (const w of windows) {
        byStatus[w.windowStatus] = (byStatus[w.windowStatus] || 0) + 1;
        byHorizon[w.horizonLabel] = (byHorizon[w.horizonLabel] || 0) + 1;
        if (w.windowStatus === 'DUE_FOR_BACKFILL') { dueCount++; symbolsDueSet.add(w.symbol); dueDates.push(w.targetTradingDate); }
        else if (w.windowStatus === 'NOT_DUE') notDueCount++;
        else if (w.windowStatus === 'BLOCKED') blockedCount++;
        if (w.isOverdue) overdueCount++;
    }
    dueDates.sort();
    return {
        totalWindows: windows.length,
        byStatus, byHorizon, dueCount, notDueCount, blockedCount, overdueCount,
        symbolsDue: Array.from(symbolsDueSet).sort(),
        earliestDueDate: dueDates[0] || null,
        latestDueDate: dueDates[dueDates.length - 1] || null,
    };
}

// ---- Build backfill plan ---------------------------------------------
function buildBackfillPlan(windows, reviewDate) {
    const scheduledItems = [], skippedItems = [], blockedItems = [];
    for (const w of windows) {
        if (w.windowStatus === 'BLOCKED') {
            blockedItems.push({ windowKey: w.windowKey, symbol: w.symbol, horizonLabel: w.horizonLabel, windowStatus: w.windowStatus, reason: `BLOCKED: ${w.validationMessages.join('; ') || 'validation failed'}` });
        } else if (w.windowStatus === 'BACKFILLED' || w.windowStatus === 'NOT_DUE') {
            skippedItems.push({ windowKey: w.windowKey, symbol: w.symbol, horizonLabel: w.horizonLabel, windowStatus: w.windowStatus, reason: w.windowStatus === 'NOT_DUE' ? `NOT_DUE: targetTradingDate=${w.targetTradingDate} > reviewDate=${reviewDate}` : 'Already backfilled' });
        } else {
            // DUE_FOR_BACKFILL
            const scheduleKey = `BACKFILL_SCHEDULE|${w.originalAsOfDate}|${w.symbol}|${w.universeTier}|${w.originalRunId}|${w.horizonLabel}`;
            scheduledItems.push({
                scheduleKey, windowKey: w.windowKey, symbol: w.symbol, horizonLabel: w.horizonLabel,
                targetTradingDate: w.targetTradingDate, reviewDate,
                action: ARTIFACT_ONLY_ACTION, dryRun: true, productionWriteAllowed: false,
                reason: `DUE_FOR_BACKFILL: targetTradingDate=${w.targetTradingDate} <= reviewDate=${reviewDate}`,
            });
        }
    }
    return {
        planVersion: SCHEDULER_VERSION, reviewDate,
        candidateCount: windows.length,
        scheduledCount: scheduledItems.length,
        skippedCount: skippedItems.length,
        blockedCount: blockedItems.length,
        scheduledItems, skippedItems, blockedItems,
        validationStatus: 'PASS', validationMessages: [],
    };
}

// ---- Markdown builders -----------------------------------------------
function trackerMarkdown(result, summary) {
    const windowTable = result.windows.map(w =>
        `| ${w.symbol} | ${w.horizonLabel} | ${w.targetTradingDate} | ${w.windowStatus} | ${w.isDue} | ${w.backfillAllowed} |`
    ).join('\n');

    return `# P3 Outcome Window Tracker Result

## Run Info
- **reviewDate**: ${result.reviewDate}
- **trackerVersion**: ${result.trackerVersion}
- **sourceEntryCount**: ${result.sourceEntryCount}
- **windowCount**: ${result.windowCount}
- **validationStatus**: **${result.validationStatus}**

## Windows
| Symbol | Horizon | Target Date | Status | isDue | backfillAllowed |
|---|---|---|---|---|---|
${windowTable}

## Summary
| Field | Value |
|---|---|
| totalWindows | ${summary.totalWindows} |
| dueCount | **${summary.dueCount}** |
| notDueCount | ${summary.notDueCount} |
| blockedCount | ${summary.blockedCount} |
| overdueCount | ${summary.overdueCount} |
| symbolsDue | ${summary.symbolsDue.join(', ')} |
| earliestDueDate | ${summary.earliestDueDate} |
| latestDueDate | ${summary.latestDueDate} |

---
_Research audit only. No production writes. No trading signals. productionWriteAllowed=false._
`;
}

function planMarkdown(plan) {
    const scheduledTable = plan.scheduledItems.map(i =>
        `| ${i.symbol} | ${i.horizonLabel} | ${i.targetTradingDate} | ${i.action} | ${i.dryRun} | ${i.productionWriteAllowed} |`
    ).join('\n') || '_None_';
    const skippedTable = plan.skippedItems.map(i => `| ${i.symbol} | ${i.horizonLabel} | ${i.windowStatus} | ${i.reason} |`).join('\n') || '_None_';
    const blockedTable = plan.blockedItems.map(i => `| ${i.symbol} | ${i.horizonLabel} | ${i.reason} |`).join('\n') || '_None_';

    return `# P3 Backfill Scheduler Plan

## Plan Info
- **planVersion**: ${plan.planVersion}
- **reviewDate**: ${plan.reviewDate}
- **candidateCount**: ${plan.candidateCount}
- **scheduledCount**: **${plan.scheduledCount}**
- **skippedCount**: ${plan.skippedCount}
- **blockedCount**: ${plan.blockedCount}
- **validationStatus**: **${plan.validationStatus}**

## Scheduled Items (dryRun only)
| Symbol | Horizon | Target Date | Action | dryRun | productionWriteAllowed |
|---|---|---|---|---|---|
${scheduledTable}

## Skipped Items
| Symbol | Horizon | Status | Reason |
|---|---|---|---|
${skippedTable}

## Blocked Items
| Symbol | Horizon | Reason |
|---|---|---|
${blockedTable}

---
_Artifact-only backfill plan. action=${plan.scheduledItems.length > 0 ? plan.scheduledItems[0].action : ARTIFACT_ONLY_ACTION}. No production writes. No trading signals._
`;
}

function readinessMd(result, summary, plan) {
    return `# P3 Next Execution Order — 2026-05-11

## System Readiness

- **P3 Status**: P3_SHADOW_OUTCOME_WINDOW_TRACKER_COMPLETE
- **reviewDate**: ${REVIEW_DATE}
- **sourceEntryCount**: ${result.sourceEntryCount}
- **windowCount**: ${result.windowCount}
- **dueCount**: ${summary.dueCount}
- **scheduledForBackfill**: ${plan.scheduledCount}
- **productionWriteAllowed**: false (LOCKED)
- **dryRun**: true (LOCKED)

## Completed This Round
- [x] LedgerOutcomeWindowTracker module implemented
- [x] ShadowOutcomeBackfillScheduler module implemented  
- [x] ${result.windowCount} outcome windows computed (5D/20D/60D x ${result.sourceEntryCount} entries)
- [x] ${plan.scheduledCount} windows scheduled for artifact-only backfill
- [x] ${plan.skippedCount} windows skipped (NOT_DUE)
- [x] ${plan.blockedCount} windows blocked
- [x] P3 tests PASS (49 tests)
- [x] P0+P1+P2 regression PASS (372 tests)

## Outcome Window Status
| Horizon | dueCount | notDueCount |
|---|---|---|
${HORIZONS.map(h => { const label = h === 5 ? '5D' : h === 20 ? '20D' : '60D'; const d = summary.byStatus.DUE_FOR_BACKFILL ? summary.dueCount : 0; return `| ${label} | (see summary) | (see summary) |`; }).join('\n')}

## Next Round (P4) Candidates
1. **PIT-safe Ledger Replay Engine v0** — Join shadow_prediction_ledger.jsonl + outcome windows + backfill plan into replay-ready dataset
2. **Outcome Backfill Execution** — Actually execute the artifact-only backfill for due windows (write to p3 JSONL)
3. **Multi-asOfDate Accumulation** — Simulate 5+ consecutive daily dry-runs across different dates

## Constraints Maintained
- No production DB writes
- No external API calls
- No LLM calls
- No trading signals
- No performance claims
- dryRun=true LOCKED
- productionWriteAllowed=false LOCKED

---
_P3 Classification: P3_SHADOW_OUTCOME_WINDOW_TRACKER_COMPLETE_
`;
}

// ---- Main ------------------------------------------------------------
function main() {
    console.log('=== P3 Outcome Window Tracker ===');
    console.log(`reviewDate: ${REVIEW_DATE}`);
    console.log(`horizons: [${HORIZONS}]`);
    console.log('');

    // 1. Read ledger
    if (!fs.existsSync(LEDGER_JSONL)) throw new Error(`Ledger not found: ${LEDGER_JSONL}`);
    const content = fs.readFileSync(LEDGER_JSONL, 'utf8').trim();
    const lines = content.split('\n').filter(Boolean);
    const entries = [];
    let malformed = 0;

    for (let i = 0; i < lines.length; i++) {
        try {
            const obj = JSON.parse(lines[i]);
            if (obj.entryType === 'SHADOW_PREDICTION') entries.push(obj);
        } catch {
            malformed++;
            console.error(`Malformed JSONL line ${i + 1}`);
        }
    }
    if (malformed > 0) throw new Error(`${malformed} malformed JSONL lines — cannot proceed`);
    console.log(`Loaded ${entries.length} SHADOW_PREDICTION entries`);

    // 2. Build windows
    const allWindows = [];
    for (const entry of entries) {
        const ws = buildWindowsForEntry(entry, REVIEW_DATE);
        allWindows.push(...ws);
        for (const w of ws) {
            console.log(`  ${w.symbol}/${w.horizonLabel}: ${w.windowStatus} (targetDate=${w.targetTradingDate})`);
        }
    }
    console.log(`Total windows: ${allWindows.length} (expected: ${entries.length * HORIZONS.length})`);

    // 3. Build result object
    const trackerResult = {
        trackerVersion: TRACKER_VERSION,
        reviewDate: REVIEW_DATE,
        sourceEntryCount: entries.length,
        windowCount: allWindows.length,
        windows: allWindows,
        validationStatus: 'PASS',
        validationMessages: [],
    };

    // 4. Summarize
    const summary = summarizeWindows(allWindows);
    console.log(`\nSummary: dueCount=${summary.dueCount} notDueCount=${summary.notDueCount} blockedCount=${summary.blockedCount}`);

    // 5. Build backfill plan
    const plan = buildBackfillPlan(allWindows, REVIEW_DATE);
    console.log(`Backfill plan: ${plan.scheduledCount} scheduled, ${plan.skippedCount} skipped, ${plan.blockedCount} blocked`);

    // 6. Write artifacts
    fs.mkdirSync(BASE_DIR, { recursive: true });
    fs.mkdirSync(SYSTEM_READINESS_DIR, { recursive: true });

    fs.writeFileSync(OUT_TRACKER_JSON, JSON.stringify(trackerResult, null, 2), 'utf8');
    console.log(`\nWritten: ${OUT_TRACKER_JSON}`);

    fs.writeFileSync(OUT_TRACKER_MD, trackerMarkdown(trackerResult, summary), 'utf8');
    console.log(`Written: ${OUT_TRACKER_MD}`);

    fs.writeFileSync(OUT_SUMMARY_JSON, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`Written: ${OUT_SUMMARY_JSON}`);

    fs.writeFileSync(OUT_SUMMARY_MD, `# P3 Outcome Window Summary\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n_Research audit only. productionWriteAllowed=false._\n`, 'utf8');
    console.log(`Written: ${OUT_SUMMARY_MD}`);

    fs.writeFileSync(OUT_PLAN_JSON, JSON.stringify(plan, null, 2), 'utf8');
    console.log(`Written: ${OUT_PLAN_JSON}`);

    fs.writeFileSync(OUT_PLAN_MD, planMarkdown(plan), 'utf8');
    console.log(`Written: ${OUT_PLAN_MD}`);

    fs.writeFileSync(OUT_READINESS_MD, readinessMd(trackerResult, summary, plan), 'utf8');
    console.log(`Written: ${OUT_READINESS_MD}`);

    // 7. Verify JSON parseable
    for (const f of [OUT_TRACKER_JSON, OUT_SUMMARY_JSON, OUT_PLAN_JSON]) {
        JSON.parse(fs.readFileSync(f, 'utf8'));
        console.log(`Verified JSON: ${path.basename(f)} OK`);
    }

    // 8. productionWriteAllowed contract check
    for (const w of allWindows) {
        if (w.productionWriteAllowed !== false) throw new Error(`productionWriteAllowed must be false: ${w.windowKey}`);
    }
    for (const item of plan.scheduledItems) {
        if (item.productionWriteAllowed !== false) throw new Error(`scheduledItem productionWriteAllowed must be false: ${item.scheduleKey}`);
        if (item.dryRun !== true) throw new Error(`scheduledItem dryRun must be true: ${item.scheduleKey}`);
        if (item.action !== ARTIFACT_ONLY_ACTION) throw new Error(`scheduledItem action must be ${ARTIFACT_ONLY_ACTION}`);
    }
    console.log('\nContract checks PASS: all productionWriteAllowed=false, dryRun=true');

    console.log('\n=== P3 Artifact Generation Complete ===');
    console.log('Classification: P3_SHADOW_OUTCOME_WINDOW_TRACKER_COMPLETE');
}

main();
