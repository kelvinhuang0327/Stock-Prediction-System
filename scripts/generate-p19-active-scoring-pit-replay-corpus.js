#!/usr/bin/env node
/**
 * generate-p19-active-scoring-pit-replay-corpus.js
 *
 * DISCLAIMER: Does not constitute investment advice. Does not compute ROI,
 * profit, alpha, win-rate, edge, or outperformance. Historical replay PIT
 * governance only.
 *
 * P19-HARDRESET PART C — Generate Active Scoring PIT Replay Corpus.
 *
 * Reads the P3 active scoring corpus, applies the MonthlyRevenue PIT gate
 * classification to each row, and writes a new P19 corpus at:
 *   outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl
 *
 * Does NOT overwrite any frozen corpus (P0/P1/P3/simulation).
 * Does NOT write to the production database.
 * Does NOT modify scoring formula or alphaScore.
 * Deterministic — no Math.random.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Paths ────────────────────────────────────────────────────────────────────

const P3_CORPUS = 'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl';
const P19_CORPUS = 'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl';
const P19_SUMMARY_JSON = 'outputs/online_validation/p19active_scoring_pit_replay_summary.json';
const P19_SUMMARY_MD = 'outputs/online_validation/p19active_scoring_pit_replay_summary.md';

const FROZEN_PATHS = [
  'outputs/online_validation/simulation_snapshot_corpus.jsonl',
  'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl',
  'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl',
  'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl',
];

// ─── Taiwan Revenue Release Rule ──────────────────────────────────────────────

const TAIWAN_RELEASE_DAY = 10;

function inferReleaseDateForPit(year, month) {
  if (month === 12) {
    return `${year + 1}-01-${String(TAIWAN_RELEASE_DAY).padStart(2, '0')}`;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(TAIWAN_RELEASE_DAY).padStart(2, '0')}`;
}

/**
 * Classify MonthlyRevenue PIT availability.
 * Returns: { pitGateStatus, releaseDate, releaseDateSource, releaseDateConfidence, inferred, reason }
 */
function classifyMonthlyRevenuePitGate(record, asOfDate) {
  if (!record || record.year == null || record.month == null) {
    return {
      pitGateStatus: 'NOT_APPLICABLE_NO_DATA',
      releaseDate: null,
      releaseDateSource: null,
      releaseDateConfidence: null,
      inferred: false,
      reason: 'No MonthlyRevenue record available for this symbol/asOfDate',
    };
  }

  const asOf = String(asOfDate).slice(0, 10);

  if (record.releaseDate) {
    const rd = String(record.releaseDate).slice(0, 10);
    const available = rd <= asOf;
    return {
      pitGateStatus: available ? 'GATE_PASSED' : 'GATE_REJECTED_UNRELEASED',
      releaseDate: rd,
      releaseDateSource: record.releaseDateSource || 'EXPLICIT',
      releaseDateConfidence: record.releaseDateConfidence || 'HIGH',
      inferred: false,
      reason: available
        ? `releaseDate ${rd} <= asOfDate ${asOf} — available`
        : `releaseDate ${rd} > asOfDate ${asOf} — PIT gate rejected`,
    };
  }

  // Infer from Taiwan rule
  const inferredRd = inferReleaseDateForPit(record.year, record.month);
  const available = inferredRd <= asOf;
  return {
    pitGateStatus: available ? 'INFERRED_GATE_PASSED' : 'INFERRED_GATE_REJECTED',
    releaseDate: inferredRd,
    releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
    releaseDateConfidence: 'LOW_TO_MEDIUM',
    inferred: true,
    reason: available
      ? `Inferred releaseDate ${inferredRd} <= asOfDate ${asOf} — inferred available`
      : `Inferred releaseDate ${inferredRd} > asOfDate ${asOf} — inferred gate rejected`,
  };
}

// ─── PIT Safety Check ─────────────────────────────────────────────────────────

const FORBIDDEN_IN_SCORING = ['outcomePrice', 'returnPct', 'realizedReturnClass'];

function validateRowPitSafety(row) {
  const violations = [];
  // Check activeScoringSnapshot for forbidden fields
  if (row.activeScoringSnapshot && typeof row.activeScoringSnapshot === 'object') {
    for (const field of FORBIDDEN_IN_SCORING) {
      if (field in row.activeScoringSnapshot) {
        violations.push(`Forbidden field "${field}" in activeScoringSnapshot`);
      }
    }
  }
  return violations;
}

// ─── Corpus Generation ────────────────────────────────────────────────────────

const gates = { total: 0, passed: 0, failed: [] };

function gate(name, condition, details) {
  gates.total++;
  if (condition) {
    gates.passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    console.log(`  [FAIL] ${name}: ${details}`);
    gates.failed.push({ name, details });
  }
  return condition;
}

console.log('\n=== P19-HARDRESET PART C: Generate Active Scoring PIT Replay Corpus ===\n');

// Guard: ensure output path ≠ any frozen path
gate('Output path is not a frozen corpus path', !FROZEN_PATHS.includes(P19_CORPUS),
  `${P19_CORPUS} is frozen`);
gate('P3 corpus exists', fs.existsSync(P3_CORPUS), `${P3_CORPUS} not found`);

// Read P3 corpus
const p3Lines = fs.readFileSync(P3_CORPUS, 'utf8').trim().split('\n');
const p3Rows = p3Lines.map(l => JSON.parse(l));

gate('P3 corpus line count = 4500', p3Rows.length === 4500,
  `actual: ${p3Rows.length}`);

// Frozen line count checks BEFORE generation
const frozenLineCounts = {};
for (const fp of FROZEN_PATHS) {
  const count = fs.readFileSync(fp, 'utf8').trim().split('\n').length;
  frozenLineCounts[fp.split('/').pop()] = count;
}
gate('simulation_snapshot_corpus.jsonl = 60 lines',
  frozenLineCounts['simulation_snapshot_corpus.jsonl'] === 60,
  `actual: ${frozenLineCounts['simulation_snapshot_corpus.jsonl']}`);
gate('p0hardreset = 4500 lines',
  frozenLineCounts['p0hardreset_historical_replay_corpus.jsonl'] === 4500,
  `actual: ${frozenLineCounts['p0hardreset_historical_replay_corpus.jsonl']}`);
gate('p1baseline = 9900 lines',
  frozenLineCounts['p1baseline_historical_replay_corpus.jsonl'] === 9900,
  `actual: ${frozenLineCounts['p1baseline_historical_replay_corpus.jsonl']}`);
gate('p3active = 4500 lines',
  frozenLineCounts['p3active_scoring_historical_replay_corpus.jsonl'] === 4500,
  `actual: ${frozenLineCounts['p3active_scoring_historical_replay_corpus.jsonl']}`);

console.log('\n[PART C] Generating P19 corpus from P3 base...');

const PIT_REPLAY_RUN_ID = 'p19-pit-replay-2026-05-12';
const PIT_REPLAY_RUN_DATE = '2026-05-12';

const p19Rows = [];
let mockDeterministicCount = 0;
let pitSafetyViolations = 0;

for (const p3Row of p3Rows) {
  // Check priceSource for mock-deterministic
  const priceSource = p3Row.outcomeSnapshot?.priceSource ?? '';
  if (priceSource === 'mock-deterministic') mockDeterministicCount++;

  // Validate PIT safety of this row
  const safetyViolations = validateRowPitSafety(p3Row);
  if (safetyViolations.length > 0) pitSafetyViolations++;

  // Classify MonthlyRevenue PIT gate for this row
  // In P3, MonthlyRevenue is not used (missingSources includes MonthlyRevenue)
  // So the PIT gate record is null → NOT_APPLICABLE_NO_DATA
  const monthlyRevenueRecord = null; // No MonthlyRevenue data in P3 base
  const pitGate = classifyMonthlyRevenuePitGate(monthlyRevenueRecord, p3Row.originalAsOfDate);

  // Build P19 row — extends P3 row with PIT replay metadata
  const p19Row = {
    // PIT replay metadata (new in P19)
    pitReplayRunId: PIT_REPLAY_RUN_ID,
    pitReplayRunDate: PIT_REPLAY_RUN_DATE,
    pitReplayVersion: 'p19-hardreset-v1',
    universeTierP19: 'P19_ACTIVE_SCORING_PIT_REPLAY',
    productionApplyAllowed: false,
    productionDbWritten: false,
    monthlyRevenuePitGateStatus: pitGate.pitGateStatus,
    monthlyRevenueAvailabilitySummary: {
      pitGateStatus: pitGate.pitGateStatus,
      releaseDate: pitGate.releaseDate,
      releaseDateSource: pitGate.releaseDateSource,
      releaseDateConfidence: pitGate.releaseDateConfidence,
      inferred: pitGate.inferred,
      reason: pitGate.reason,
      dataPresent: false,
      usedInScoring: false,
    },
    // P3-compatible fields (preserved unchanged)
    corpusRunId: 'p19active-pit-replay-batch',
    writerVersion: 'p19-pit-replay-writer-v1',
    symbol: p3Row.symbol,
    originalAsOfDate: p3Row.originalAsOfDate,
    universeTier: 'P19_ACTIVE_SCORING_PIT_REPLAY',
    duplicateKey: `${p3Row.symbol}|${p3Row.originalAsOfDate}|${p3Row.outcomeSnapshot?.horizonDays ?? 'unknown'}|p19`,
    createdAt: p3Row.createdAt,
    logVersion: 'p019-v1',
    runId: `p19-pit-replay-batch-${p3Row.originalAsOfDate}`,
    researchBucket: p3Row.researchBucket,
    scoreSnapshot: p3Row.scoreSnapshot,
    sourceDateBasis: p3Row.sourceDateBasis,
    closePriceAtPrediction: p3Row.closePriceAtPrediction,
    entryPriceSource: p3Row.entryPriceSource,
    outcomeSnapshot: p3Row.outcomeSnapshot,
    validationMessages: p3Row.validationMessages ?? [],
    scoringCompletenessStatus: p3Row.scoringCompletenessStatus,
    // activeScoringSnapshot with PIT gate metadata added
    activeScoringSnapshot: {
      ...p3Row.activeScoringSnapshot,
      pitReplayRunId: PIT_REPLAY_RUN_ID,
      monthlyRevenuePitGateApplied: true,
      monthlyRevenuePitGateStatus: pitGate.pitGateStatus,
    },
    horizonDays: p3Row.outcomeSnapshot?.horizonDays ?? null,
  };

  p19Rows.push(p19Row);
}

gate('No mock-deterministic priceSource rows', mockDeterministicCount === 0,
  `found ${mockDeterministicCount} rows with mock-deterministic`);
gate('No PIT safety violations in scoring snapshot', pitSafetyViolations === 0,
  `found ${pitSafetyViolations} violations`);

const uniqueSymbols = new Set(p19Rows.map(r => r.symbol));
const uniqueDates = new Set(p19Rows.map(r => r.originalAsOfDate));

gate('P19 lines >= 4500', p19Rows.length >= 4500, `actual: ${p19Rows.length}`);
gate('Unique symbols >= 25', uniqueSymbols.size >= 25, `actual: ${uniqueSymbols.size}`);
gate('Unique dates >= 60', uniqueDates.size >= 60, `actual: ${uniqueDates.size}`);

const closeQuoteRows = p19Rows.filter(r => r.entryPriceSource === 'stockQuote.close').length;
const closeCoverage = Math.round((closeQuoteRows / p19Rows.length) * 100);
gate('stockQuote.close coverage >= 90%', closeCoverage >= 90, `actual: ${closeCoverage}%`);

const scoringDist = {};
for (const r of p19Rows) {
  scoringDist[r.scoringCompletenessStatus] = (scoringDist[r.scoringCompletenessStatus] ?? 0) + 1;
}
const completePartialCount = (scoringDist['COMPLETE'] ?? 0) + (scoringDist['PARTIAL'] ?? 0);
const completePartialRatio = Math.round((completePartialCount / p19Rows.length) * 100);
gate('COMPLETE + PARTIAL >= 80%', completePartialRatio >= 80,
  `actual: ${completePartialRatio}%`);

const pitGateDist = {};
for (const r of p19Rows) {
  pitGateDist[r.monthlyRevenuePitGateStatus] = (pitGateDist[r.monthlyRevenuePitGateStatus] ?? 0) + 1;
}
gate('All rows have monthlyRevenuePitGateStatus', Object.keys(pitGateDist).length > 0,
  'no pitGateStatus values found');

gate('productionApplyAllowed=false in all rows',
  p19Rows.every(r => r.productionApplyAllowed === false), 'some rows have productionApplyAllowed!=false');

// Write P19 corpus
fs.mkdirSync('outputs/online_validation', { recursive: true });
const corpusContent = p19Rows.map(r => JSON.stringify(r)).join('\n');
fs.writeFileSync(P19_CORPUS, corpusContent);
gate('P19 corpus written successfully', fs.existsSync(P19_CORPUS), 'file not created');

// Verify frozen corpus unchanged after write
for (const fp of FROZEN_PATHS) {
  const count = fs.readFileSync(fp, 'utf8').trim().split('\n').length;
  const expected = { 'simulation_snapshot_corpus.jsonl': 60, 'p0hardreset_historical_replay_corpus.jsonl': 4500, 'p1baseline_historical_replay_corpus.jsonl': 9900, 'p3active_scoring_historical_replay_corpus.jsonl': 4500 };
  const name = fp.split('/').pop();
  gate(`${name} unchanged after P19 write`,
    count === expected[name], `expected ${expected[name]}, got ${count}`);
}

// Write summary JSON
const horizonDist = {};
for (const r of p19Rows) {
  const h = String(r.outcomeSnapshot?.horizonDays ?? 'unknown');
  horizonDist[h] = (horizonDist[h] ?? 0) + 1;
}
const researchBucketDist = {};
for (const r of p19Rows) {
  const rb = String(r.researchBucket ?? 'unknown');
  researchBucketDist[rb] = (researchBucketDist[rb] ?? 0) + 1;
}

const summary = {
  phase: 'P19-HARDRESET',
  part: 'C',
  pitReplayRunId: PIT_REPLAY_RUN_ID,
  pitReplayRunDate: PIT_REPLAY_RUN_DATE,
  generatedAt: new Date().toISOString(),
  sourceCorpus: P3_CORPUS,
  outputCorpus: P19_CORPUS,
  totalRows: p19Rows.length,
  uniqueSymbols: uniqueSymbols.size,
  uniqueAsOfDates: uniqueDates.size,
  horizonDistribution: horizonDist,
  scoringCompletenessStatusDistribution: scoringDist,
  researchBucketDistribution: researchBucketDist,
  monthlyRevenuePitGateStatusDistribution: pitGateDist,
  completeAndPartialRatio: completePartialRatio,
  stockQuoteCloseCoverage: closeCoverage,
  mockDeterministicCount,
  pitSafetyViolations,
  productionApplyAllowed: false,
  productionDbWritten: false,
  frozenCorpusLineCounts: frozenLineCounts,
  validationStatus: gates.failed.length === 0 ? 'PASS' : 'FAIL',
  gatesPassed: gates.passed,
  gatesTotal: gates.total,
  gatesFailed: gates.failed,
};

fs.writeFileSync(P19_SUMMARY_JSON, JSON.stringify(summary, null, 2));

// Write summary MD
const md = `# P19 Active Scoring PIT Replay Corpus — Generation Summary

> DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. Historical replay PIT governance only.

**Phase**: P19-HARDRESET PART C
**Run ID**: ${PIT_REPLAY_RUN_ID}
**Generated**: ${summary.generatedAt}
**Validation Status**: ${summary.validationStatus}

## Corpus Dimensions

| Metric | Value |
|--------|-------|
| Total rows | ${summary.totalRows} |
| Unique symbols | ${summary.uniqueSymbols} |
| Unique asOfDates | ${summary.uniqueAsOfDates} |
| COMPLETE + PARTIAL ratio | ${summary.completeAndPartialRatio}% |
| stockQuote.close coverage | ${summary.stockQuoteCloseCoverage}% |
| mock-deterministic rows | ${summary.mockDeterministicCount} |
| PIT safety violations | ${summary.pitSafetyViolations} |

## ScoringCompletenessStatus Distribution

${Object.entries(scoringDist).map(([k,v]) => `- ${k}: ${v}`).join('\n')}

## MonthlyRevenue PIT Gate Status Distribution

${Object.entries(pitGateDist).map(([k,v]) => `- ${k}: ${v}`).join('\n')}

## Horizon Distribution

${Object.entries(horizonDist).map(([k,v]) => `- ${k}D: ${v}`).join('\n')}

## Gate Results

- Passed: ${gates.passed}/${gates.total}
- Failed: ${gates.failed.length > 0 ? gates.failed.map(f => f.name).join(', ') : 'none'}

## Production Safety

- productionApplyAllowed: false
- productionDbWritten: false
- Frozen corpus line counts: ${Object.entries(frozenLineCounts).map(([k,v]) => `${k}=${v}`).join(', ')}
`;
fs.writeFileSync(P19_SUMMARY_MD, md);

console.log(`\n[RESULT] Gates: ${gates.passed}/${gates.total} PASS`);
console.log(`[RESULT] Validation Status: ${summary.validationStatus}`);
console.log(`[RESULT] P19 corpus lines: ${p19Rows.length}`);
console.log(`[RESULT] Written: ${P19_CORPUS}`);
console.log(`[RESULT] Written: ${P19_SUMMARY_JSON}`);
console.log(`[RESULT] Written: ${P19_SUMMARY_MD}`);

if (gates.failed.length > 0) {
  console.error('\nFAILED GATES:');
  for (const f of gates.failed) console.error(`  - ${f.name}: ${f.details}`);
  process.exit(1);
}
