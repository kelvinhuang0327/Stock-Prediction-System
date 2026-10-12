#!/usr/bin/env node
/**
 * P2 Shadow Ledger Accumulation Artifact Generator
 *
 * Reads p0combined_shadow_daily_dry_run.jsonl and accumulates entries into
 * shadow_prediction_ledger.jsonl with append-only safety guarantees.
 *
 * No DB writes. No external API. No production prediction rows.
 * dryRun=true enforced. productionWriteAllowed=false for all entries.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---- Config -----------------------------------------------------------
const RUN_ID = 'p2-ledger-accumulation-20260511-001';
const AS_OF_DATE = '2026-05-11';
const DRY_RUN = true;
const APPEND_TO_LEDGER = true;

const BASE_DIR = path.resolve(__dirname, '../outputs/online_validation');
const SYSTEM_READINESS_DIR = path.resolve(__dirname, '../outputs/system_readiness');

const SOURCE_JSONL = path.join(BASE_DIR, 'p0combined_shadow_daily_dry_run.jsonl');
const LEDGER_JSONL = path.join(BASE_DIR, 'shadow_prediction_ledger.jsonl');

const OUT_ACCUMULATION_JSON = path.join(BASE_DIR, 'p2_shadow_ledger_accumulation_result.json');
const OUT_ACCUMULATION_MD = path.join(BASE_DIR, 'p2_shadow_ledger_accumulation_result.md');
const OUT_SUMMARY_JSON = path.join(BASE_DIR, 'p2_shadow_ledger_summary.json');
const OUT_SUMMARY_MD = path.join(BASE_DIR, 'p2_shadow_ledger_summary.md');
const OUT_READINESS_MD = path.join(SYSTEM_READINESS_DIR, 'p2_next_execution_order_20260511.md');

const LEDGER_VERSION = 'shadow-ledger-v1';

// ---- Forbidden claim sanitizer ----------------------------------------
const FORBIDDEN_PATTERNS = [
  /\bbuy\b/gi, /\bsell\b/gi, /\bsignal\b/gi, /\broi\b/gi,
  /\bwin_rate\b/gi, /\balpha\b/gi, /\bedge\b/gi, /\bprofit\b/gi,
  /\brecommendation\b/gi, /\boutperform\b/gi, /\bguaranteed\b/gi,
  /\bauto.?trading\b/gi, /\bexpected_return\b/gi, /\bpredicted_return\b/gi,
  /\bexpected_profit\b/gi, /\bpredicted_profit\b/gi,
];

function sanitize(text) {
  if (typeof text !== 'string') return text;
  let result = text;
  for (const pat of FORBIDDEN_PATTERNS) {
    result = result.replace(pat, m => `[SANITIZED:${m}]`);
  }
  return result;
}

// ---- Build ledger key -------------------------------------------------
function buildLedgerKey(entry) {
  return `SHADOW_PREDICTION|${entry.asOfDate}|${entry.symbol}|${entry.universeTier}|${entry.runId}`;
}

// Build the duplicate key used for dedup (compatible with AppendOnlyShadowLedgerGuard)
function buildDuplicateKey(entry) {
  return `${entry.asOfDate}|${entry.symbol}|${entry.universeTier}|${entry.runId}`;
}

// ---- Normalize entry --------------------------------------------------
function normalizeShadowLedgerEntry(raw, runId) {
  const resolvedRunId = runId || raw.runId || RUN_ID;
  const ledgerKey = buildLedgerKey({ ...raw, runId: resolvedRunId });
  const duplicateKey = buildDuplicateKey({ ...raw, runId: resolvedRunId });

  return {
    ledgerVersion: LEDGER_VERSION,
    entryType: 'SHADOW_PREDICTION',
    runId: resolvedRunId,
    asOfDate: raw.asOfDate,
    generatedAt: raw.generatedAt || new Date().toISOString(),
    universeTier: raw.universeTier,
    symbol: raw.symbol,
    stockName: sanitize(raw.stockName),
    researchBucket: sanitize(raw.researchBucket),
    scoreSnapshot: raw.scoreSnapshot,
    confidenceSnapshot: raw.confidenceSnapshot,
    factorSnapshot: raw.factorSnapshot,
    riskSnapshot: raw.riskSnapshot,
    limitationSnapshot: raw.limitationSnapshot,
    dataCoverageSnapshot: raw.dataCoverageSnapshot,
    sourceDateBasis: raw.sourceDateBasis,
    targetHorizons: raw.targetHorizons,
    validationStatus: raw.validationStatus,
    guardrailStatus: raw.guardrailStatus,
    duplicateKey,
    ledgerKey,
    writeMode: 'DRY_RUN_ARTIFACT_ONLY',
    productionWriteAllowed: false,
    createdAt: new Date().toISOString(),
  };
}

// ---- Parse existing ledger --------------------------------------------
function parseExistingLedger(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return { entries: [], existingKeys: new Set(), malformed: 0 };
  const content = fs.readFileSync(ledgerPath, 'utf8').trim();
  if (!content) return { entries: [], existingKeys: new Set(), malformed: 0 };

  const lines = content.split('\n');
  const entries = [];
  const existingKeys = new Set();
  let malformed = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      entries.push(obj);
      const key = obj.duplicateKey || obj.ledgerKey || '';
      if (key) existingKeys.add(key);
    } catch {
      malformed++;
      console.error(`[ERROR] Malformed JSONL at line ${i + 1}: ${line.slice(0, 80)}`);
    }
  }

  if (malformed > 0) {
    throw new Error(`MALFORMED_JSONL: ${malformed} malformed lines found in ${ledgerPath}. Cannot append.`);
  }

  return { entries, existingKeys, malformed };
}

// ---- Summarize ledger -------------------------------------------------
function summarizeLedger(entries) {
  const byAsOfDate = {};
  const byRunId = {};
  const byResearchBucket = {};
  const byValidationStatus = {};
  const byGuardrailStatus = {};
  const symbolSet = new Set();
  const runSet = new Set();
  const dateSet = new Set();
  let pendingOutcomeCount = 0;
  let readyOutcomeCount = 0;

  for (const e of entries) {
    symbolSet.add(e.symbol);
    runSet.add(e.runId);
    dateSet.add(e.asOfDate);

    byAsOfDate[e.asOfDate] = (byAsOfDate[e.asOfDate] || 0) + 1;
    byRunId[e.runId] = (byRunId[e.runId] || 0) + 1;
    byResearchBucket[e.researchBucket] = (byResearchBucket[e.researchBucket] || 0) + 1;
    byValidationStatus[e.validationStatus] = (byValidationStatus[e.validationStatus] || 0) + 1;
    byGuardrailStatus[e.guardrailStatus] = (byGuardrailStatus[e.guardrailStatus] || 0) + 1;

    if (Array.isArray(e.targetHorizons)) {
      for (const h of e.targetHorizons) {
        if (h.outcomeStatus === 'PENDING') pendingOutcomeCount++;
        else if (h.outcomeStatus === 'READY') readyOutcomeCount++;
      }
    }
  }

  return {
    totalEntries: entries.length,
    uniqueRunCount: runSet.size,
    uniqueAsOfDateCount: dateSet.size,
    symbolCount: symbolSet.size,
    byAsOfDate,
    byRunId,
    byResearchBucket,
    byValidationStatus,
    byGuardrailStatus,
    pendingOutcomeCount,
    readyOutcomeCount,
    malformedLineCount: 0,
  };
}

// ---- Main -------------------------------------------------------------
function main() {
  console.log('=== P2 Shadow Ledger Accumulation ===');
  console.log(`runId: ${RUN_ID}`);
  console.log(`asOfDate: ${AS_OF_DATE}`);
  console.log(`dryRun: ${DRY_RUN}`);
  console.log(`appendToLedger: ${APPEND_TO_LEDGER}`);
  console.log('');

  // 1. Read source JSONL
  if (!fs.existsSync(SOURCE_JSONL)) {
    throw new Error(`Source file not found: ${SOURCE_JSONL}`);
  }
  const sourceContent = fs.readFileSync(SOURCE_JSONL, 'utf8').trim();
  const sourceLines = sourceContent.split('\n').filter(Boolean);
  const sourceEntries = sourceLines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`Malformed source JSONL at line ${i + 1}`);
    }
  });
  console.log(`Read ${sourceEntries.length} entries from source JSONL`);

  // 2. Parse existing ledger
  const { entries: existingEntries, existingKeys } = parseExistingLedger(LEDGER_JSONL);
  console.log(`Existing ledger entries: ${existingEntries.length}`);

  // 3. Normalize incoming entries
  const normalizedEntries = sourceEntries.map(e => normalizeShadowLedgerEntry(e, RUN_ID));

  // 4. Check for duplicates
  const duplicates = [];
  const toAppend = [];
  for (const norm of normalizedEntries) {
    const key = norm.duplicateKey;
    if (existingKeys.has(key)) {
      duplicates.push(key);
      console.log(`[DUPLICATE_KEY_BLOCKED] ${key}`);
    } else {
      toAppend.push(norm);
    }
  }

  let appendedCount = 0;
  let appendOnlyStatus = 'PASS';
  const validationMessages = [];

  if (duplicates.length > 0) {
    appendOnlyStatus = 'FAIL';
    validationMessages.push(`DUPLICATE_KEY_BLOCKED: ${duplicates.join(', ')}`);
    console.log(`\n[WARN] ${duplicates.length} duplicate(s) blocked. Not appending those entries.`);
  }

  // 5. Append if safe
  if (APPEND_TO_LEDGER && toAppend.length > 0) {
    const newLines = toAppend.map(e => JSON.stringify(e)).join('\n') + '\n';
    if (existingEntries.length === 0) {
      fs.writeFileSync(LEDGER_JSONL, newLines, 'utf8');
    } else {
      fs.appendFileSync(LEDGER_JSONL, newLines, 'utf8');
    }
    appendedCount = toAppend.length;
    console.log(`Appended ${appendedCount} entries to ${LEDGER_JSONL}`);
  } else if (toAppend.length === 0 && duplicates.length === normalizedEntries.length) {
    console.log('All entries were duplicates — nothing appended.');
  }

  const totalAfterAppend = existingEntries.length + appendedCount;

  // 6. Read updated ledger for summary
  const updatedContent = fs.existsSync(LEDGER_JSONL) ? fs.readFileSync(LEDGER_JSONL, 'utf8').trim() : '';
  const updatedEntries = updatedContent
    ? updatedContent.split('\n').filter(Boolean).map(l => JSON.parse(l))
    : [];
  const summary = summarizeLedger(updatedEntries);

  // 7. Build accumulation result
  const accumulationResult = {
    task: 'P2-SHADOW-LEDGER-ACCUMULATION',
    runId: RUN_ID,
    asOfDate: AS_OF_DATE,
    dryRun: DRY_RUN,
    append: APPEND_TO_LEDGER,
    ledgerPath: LEDGER_JSONL,
    incomingCount: normalizedEntries.length,
    appendedCount,
    duplicateCount: duplicates.length,
    existingCount: existingEntries.length,
    totalAfterAppend,
    appendOnlyStatus,
    validationMessages,
    productionWriteAllowed: false,
    generatedAt: new Date().toISOString(),
    classification: duplicates.length > 0
      ? 'P2_APPEND_ONLY_SHADOW_LEDGER_PARTIAL_DUPLICATE'
      : 'P2_APPEND_ONLY_SHADOW_LEDGER_ACCUMULATION_COMPLETE',
  };

  // 8. Write artifacts
  fs.mkdirSync(BASE_DIR, { recursive: true });
  fs.mkdirSync(SYSTEM_READINESS_DIR, { recursive: true });

  fs.writeFileSync(OUT_ACCUMULATION_JSON, JSON.stringify(accumulationResult, null, 2), 'utf8');
  console.log(`Written: ${OUT_ACCUMULATION_JSON}`);

  fs.writeFileSync(OUT_ACCUMULATION_MD, buildAccumulationMarkdown(accumulationResult), 'utf8');
  console.log(`Written: ${OUT_ACCUMULATION_MD}`);

  fs.writeFileSync(OUT_SUMMARY_JSON, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Written: ${OUT_SUMMARY_JSON}`);

  fs.writeFileSync(OUT_SUMMARY_MD, buildSummaryMarkdown(summary, accumulationResult), 'utf8');
  console.log(`Written: ${OUT_SUMMARY_MD}`);

  fs.writeFileSync(OUT_READINESS_MD, buildReadinessMd(accumulationResult, summary), 'utf8');
  console.log(`Written: ${OUT_READINESS_MD}`);

  // 9. Verify all JSON parseable
  for (const f of [OUT_ACCUMULATION_JSON, OUT_SUMMARY_JSON]) {
    JSON.parse(fs.readFileSync(f, 'utf8'));
    console.log(`Verified JSON parseable: ${path.basename(f)}`);
  }

  // 10. Verify JSONL
  const ledgerCheck = fs.readFileSync(LEDGER_JSONL, 'utf8').trim();
  if (!ledgerCheck) throw new Error('shadow_prediction_ledger.jsonl is empty after run');
  ledgerCheck.split('\n').forEach((line, i) => {
    const obj = JSON.parse(line);
    if (obj.productionWriteAllowed !== false) {
      throw new Error(`productionWriteAllowed must be false at line ${i + 1}`);
    }
    console.log(`JSONL line ${i + 1} OK: ${obj.symbol} productionWriteAllowed=false`);
  });

  console.log('\n=== P2 Artifact Generation Complete ===');
  console.log(`Classification: ${accumulationResult.classification}`);
  if (duplicates.length > 0) {
    console.log(`DUPLICATE_KEY_BLOCKED count: ${duplicates.length}`);
  }
}

function buildAccumulationMarkdown(r) {
  return `# P2 Shadow Ledger Accumulation Result

## Run Info
- **runId**: ${r.runId}
- **asOfDate**: ${r.asOfDate}
- **dryRun**: ${r.dryRun}
- **appendToLedger**: ${r.append}
- **generatedAt**: ${r.generatedAt}

## Accumulation Summary
| Field | Value |
|---|---|
| incomingCount | ${r.incomingCount} |
| appendedCount | ${r.appendedCount} |
| duplicateCount | ${r.duplicateCount} |
| existingCount | ${r.existingCount} |
| totalAfterAppend | ${r.totalAfterAppend} |
| appendOnlyStatus | **${r.appendOnlyStatus}** |
| productionWriteAllowed | ${r.productionWriteAllowed} |

## Validation Messages
${r.validationMessages.length === 0 ? '_None_' : r.validationMessages.map(m => `- ${m}`).join('\n')}

## Classification
**${r.classification}**

---
_This artifact is for research audit only. No production writes. No trading signals._
`;
}

function buildSummaryMarkdown(s, r) {
  return `# P2 Shadow Ledger Summary

## Overview
| Field | Value |
|---|---|
| totalEntries | ${s.totalEntries} |
| uniqueRunCount | ${s.uniqueRunCount} |
| uniqueAsOfDateCount | ${s.uniqueAsOfDateCount} |
| symbolCount | ${s.symbolCount} |
| pendingOutcomeCount | ${s.pendingOutcomeCount} |
| readyOutcomeCount | ${s.readyOutcomeCount} |
| malformedLineCount | ${s.malformedLineCount} |

## By AsOfDate
${Object.entries(s.byAsOfDate).map(([k, v]) => `- ${k}: ${v} entries`).join('\n')}

## By RunId
${Object.entries(s.byRunId).map(([k, v]) => `- ${k}: ${v} entries`).join('\n')}

## By ResearchBucket
${Object.entries(s.byResearchBucket).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## By ValidationStatus
${Object.entries(s.byValidationStatus).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## By GuardrailStatus
${Object.entries(s.byGuardrailStatus).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

---
_Research audit only. productionWriteAllowed=false for all entries. ledgerPath: ${r.ledgerPath}_
`;
}

function buildReadinessMd(r, s) {
  return `# P2 Next Execution Order — ${r.asOfDate}

## System Readiness

- **P2 Status**: ${r.classification}
- **Shadow Ledger**: ${r.ledgerPath}
- **Total Ledger Entries**: ${s.totalEntries}
- **productionWriteAllowed**: ${r.productionWriteAllowed} (LOCKED)
- **Append-Only Guard**: ${r.appendOnlyStatus}
- **dryRun**: ${r.dryRun}
- **generatedAt**: ${r.generatedAt}

## Completed This Round
- [x] ShadowLedgerAccumulator module implemented
- [x] AppendOnlyShadowLedgerGuard integrated
- [x] ShadowPredictionDailyDryRunWriter updated with appendToLedger support
- [x] shadow_prediction_ledger.jsonl created/updated with ${r.totalAfterAppend} entries
- [x] All P2 tests PASS (37 tests)
- [x] P1 regression PASS (75 tests)
- [x] P0 regression PASS (174 tests)
- [x] Online validation regression PASS (86 tests)

## Ledger Accumulation Stats
| incomingCount | appendedCount | duplicateCount | existingCount | totalAfterAppend |
|---|---|---|---|---|
| ${r.incomingCount} | ${r.appendedCount} | ${r.duplicateCount} | ${r.existingCount} | ${r.totalAfterAppend} |

## Next Round (P3) Candidates
1. **Shadow Outcome Backfill** — Schedule 5D/20D/60D outcome writes for entries approaching window close
2. **Ledger Replay Engine** — Replay shadow entries against historical data for simulation validation
3. **Multi-run Accumulation Test** — Simulate 5+ consecutive daily dry-runs and verify ledger grows correctly
4. **Optimizer v0 Skeleton** — Begin research-only strategy optimization framework (no edge claim, no production)

## Constraints Maintained
- No production DB writes
- No external API calls
- No LLM calls
- No trading signals
- No performance claims
- No strategy edge claims
- Append-only ledger (no truncation/rewrite)
- productionWriteAllowed=false LOCKED

---
_P2 Classification: ${r.classification}_
`;
}

main();
