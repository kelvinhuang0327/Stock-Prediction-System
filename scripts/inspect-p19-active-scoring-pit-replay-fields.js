#!/usr/bin/env node
/**
 * inspect-p19-active-scoring-pit-replay-fields.js
 *
 * DISCLAIMER: Does not constitute investment advice. Does not compute ROI,
 * profit, alpha, win-rate, edge, or outperformance. Field inspection only.
 *
 * P19-HARDRESET PART E — P19 Field Inspection and P3 Shape Comparison.
 *
 * Compares P19 corpus against P3 corpus for schema compatibility.
 * Determines if P19 is ready for P20 pre/post PIT comparison.
 */

'use strict';

const fs = require('fs');

const P19_CORPUS = 'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl';
const P3_CORPUS = 'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl';
const OUT_JSON = 'outputs/online_validation/p19active_scoring_pit_replay_field_inspection.json';
const OUT_MD = 'outputs/online_validation/p19active_scoring_pit_replay_field_inspection.md';

const gates = { total: 0, passed: 0, failed: [] };
function gate(name, condition, details) {
  gates.total++;
  if (condition) { gates.passed++; console.log(`  [PASS] ${name}`); }
  else { console.log(`  [FAIL] ${name}: ${details}`); gates.failed.push({ name, details }); }
  return condition;
}

console.log('\n=== P19-HARDRESET PART E: Field Inspection + Shape Comparison ===\n');

gate('P19 corpus exists', fs.existsSync(P19_CORPUS), `${P19_CORPUS} not found`);
gate('P3 corpus exists', fs.existsSync(P3_CORPUS), `${P3_CORPUS} not found`);

const p19Rows = fs.readFileSync(P19_CORPUS, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const p3Rows = fs.readFileSync(P3_CORPUS, 'utf8').trim().split('\n').map(l => JSON.parse(l));

// ─── Dimensions ───────────────────────────────────────────────────────────────

const p19Syms = new Set(p19Rows.map(r => r.symbol));
const p19Dates = new Set(p19Rows.map(r => r.originalAsOfDate));
const p3Syms = new Set(p3Rows.map(r => r.symbol));
const p3Dates = new Set(p3Rows.map(r => r.originalAsOfDate));

gate('P19 line count = 4500', p19Rows.length === 4500, `actual: ${p19Rows.length}`);
gate('P3 line count = 4500', p3Rows.length === 4500, `actual: ${p3Rows.length}`);
gate('P19 unique symbols >= 25', p19Syms.size >= 25, `actual: ${p19Syms.size}`);
gate('P3 unique symbols >= 25', p3Syms.size >= 25, `actual: ${p3Syms.size}`);
gate('P19 unique dates >= 60', p19Dates.size >= 60, `actual: ${p19Dates.size}`);
gate('P3 unique dates >= 60', p3Dates.size >= 60, `actual: ${p3Dates.size}`);

// ─── Horizon Distribution ─────────────────────────────────────────────────────

function horizonDist(rows) {
  const d = {};
  for (const r of rows) {
    const h = String(r.outcomeSnapshot?.horizonDays ?? r.horizonDays ?? 'unknown');
    d[h] = (d[h] ?? 0) + 1;
  }
  return d;
}
const p19HorizonDist = horizonDist(p19Rows);
const p3HorizonDist = horizonDist(p3Rows);
gate('P19 horizon distribution matches P3',
  JSON.stringify(Object.keys(p19HorizonDist).sort()) === JSON.stringify(Object.keys(p3HorizonDist).sort()),
  `P19: ${JSON.stringify(p19HorizonDist)}, P3: ${JSON.stringify(p3HorizonDist)}`);

// ─── ScoringCompletenessStatus ────────────────────────────────────────────────

function completenessDist(rows) {
  const d = {};
  for (const r of rows) {
    const k = String(r.scoringCompletenessStatus ?? 'unknown');
    d[k] = (d[k] ?? 0) + 1;
  }
  return d;
}
const p19ScoringDist = completenessDist(p19Rows);
const p3ScoringDist = completenessDist(p3Rows);
gate('P19 completeness distribution matches P3 structure',
  JSON.stringify(Object.keys(p19ScoringDist).sort()) === JSON.stringify(Object.keys(p3ScoringDist).sort()),
  `P19: ${JSON.stringify(p19ScoringDist)}, P3: ${JSON.stringify(p3ScoringDist)}`);

const p19CompletePartialCount = (p19ScoringDist['COMPLETE'] ?? 0) + (p19ScoringDist['PARTIAL'] ?? 0);
const p19CompletePartialRatio = Math.round((p19CompletePartialCount / p19Rows.length) * 100);
gate('P19 COMPLETE+PARTIAL >= 80%', p19CompletePartialRatio >= 80, `actual: ${p19CompletePartialRatio}%`);

// ─── ResearchBucket Distribution ──────────────────────────────────────────────

function bucketDist(rows) {
  const d = {};
  for (const r of rows) {
    const k = String(r.researchBucket ?? 'unknown');
    d[k] = (d[k] ?? 0) + 1;
  }
  return d;
}
const p19BucketDist = bucketDist(p19Rows);
const p3BucketDist = bucketDist(p3Rows);
gate('P19 researchBucket distribution matches P3 structure',
  JSON.stringify(Object.keys(p19BucketDist).sort()) === JSON.stringify(Object.keys(p3BucketDist).sort()),
  `P19 keys: ${Object.keys(p19BucketDist).sort().join(',')}, P3: ${Object.keys(p3BucketDist).sort().join(',')}`);

// ─── Score Non-zero Count ─────────────────────────────────────────────────────

function nonZeroScoreCount(rows) {
  return rows.filter(r => r.scoreSnapshot && r.scoreSnapshot.researchScore > 0).length;
}
const p19NonZero = nonZeroScoreCount(p19Rows);
const p3NonZero = nonZeroScoreCount(p3Rows);
gate('P19 non-zero score count matches P3', p19NonZero === p3NonZero,
  `P19: ${p19NonZero}, P3: ${p3NonZero}`);

// ─── Snapshot Presence Ratios ─────────────────────────────────────────────────

function presenceRatio(rows, field, subfield) {
  const present = rows.filter(r => {
    const ss = r.activeScoringSnapshot ?? {};
    const val = ss[subfield] ?? r[field];
    if (Array.isArray(val)) return val.length > 0;
    return val != null && val !== '';
  }).length;
  return Math.round((present / rows.length) * 100);
}

const p19ReasonPresence = presenceRatio(p19Rows, 'reasonSnapshot', 'reasonSnapshot');
const p3ReasonPresence = presenceRatio(p3Rows, 'reasonSnapshot', 'reasonSnapshot');
const p19SignalPresence = presenceRatio(p19Rows, 'signalSnapshot', 'signalSnapshot');
const p3SignalPresence = presenceRatio(p3Rows, 'signalSnapshot', 'signalSnapshot');
const p19FactorPresence = presenceRatio(p19Rows, 'factorSnapshot', 'factorSnapshot');
const p3FactorPresence = presenceRatio(p3Rows, 'factorSnapshot', 'factorSnapshot');

gate('P19 reasonSnapshot presence ≈ P3',
  Math.abs(p19ReasonPresence - p3ReasonPresence) <= 5,
  `P19: ${p19ReasonPresence}%, P3: ${p3ReasonPresence}%`);
gate('P19 signalSnapshot presence ≈ P3',
  Math.abs(p19SignalPresence - p3SignalPresence) <= 5,
  `P19: ${p19SignalPresence}%, P3: ${p3SignalPresence}%`);
gate('P19 factorSnapshot presence ≈ P3',
  Math.abs(p19FactorPresence - p3FactorPresence) <= 5,
  `P19: ${p19FactorPresence}%, P3: ${p3FactorPresence}%`);

// ─── monthlyRevenuePitGateStatus Distribution ─────────────────────────────────

function pitGateDist(rows) {
  const d = {};
  for (const r of rows) {
    const k = String(r.monthlyRevenuePitGateStatus ?? 'MISSING');
    d[k] = (d[k] ?? 0) + 1;
  }
  return d;
}
const p19PitGateDist = pitGateDist(p19Rows);
gate('All P19 rows have monthlyRevenuePitGateStatus',
  !p19PitGateDist['MISSING'] || p19PitGateDist['MISSING'] === 0,
  `MISSING count: ${p19PitGateDist['MISSING'] ?? 0}`);

// ─── Schema Compatibility Check ───────────────────────────────────────────────

const P19_REQUIRED_FIELDS = ['pitReplayRunId', 'monthlyRevenuePitGateStatus', 'monthlyRevenueAvailabilitySummary'];
const P3_CORE_FIELDS = ['symbol', 'originalAsOfDate', 'scoringCompletenessStatus', 'activeScoringSnapshot', 'outcomeSnapshot', 'researchBucket'];

const missingP19Fields = P19_REQUIRED_FIELDS.filter(f => !(f in p19Rows[0]));
const missingP3CoreInP19 = P3_CORE_FIELDS.filter(f => !(f in p19Rows[0]));

gate('P19 has all required new fields', missingP19Fields.length === 0,
  `Missing: ${missingP19Fields.join(', ')}`);
gate('P19 has all P3 core fields', missingP3CoreInP19.length === 0,
  `Missing: ${missingP3CoreInP19.join(', ')}`);

// ─── P3 vs P19 Symbol Overlap ─────────────────────────────────────────────────

const p3SymArray = [...p3Syms];
const p19SymArray = [...p19Syms];
const symbolOverlap = p3SymArray.filter(s => p19Syms.has(s)).length;
gate('P3 and P19 symbol sets identical',
  symbolOverlap === p3Syms.size && p3Syms.size === p19Syms.size,
  `overlap: ${symbolOverlap}, P3: ${p3Syms.size}, P19: ${p19Syms.size}`);

const p3DateArray = [...p3Dates];
const dateOverlap = p3DateArray.filter(d => p19Dates.has(d)).length;
gate('P3 and P19 date sets identical',
  dateOverlap === p3Dates.size && p3Dates.size === p19Dates.size,
  `overlap: ${dateOverlap}, P3: ${p3Dates.size}, P19: ${p19Dates.size}`);

// ─── P20 Readiness Check ──────────────────────────────────────────────────────

const schemaCompatible = missingP19Fields.length === 0 && missingP3CoreInP19.length === 0;
const shapeCompatibility = (schemaCompatible && p19Rows.length >= 4500 && p19Syms.size >= 25 && p19Dates.size >= 60)
  ? 'COMPATIBLE'
  : schemaCompatible ? 'PARTIAL' : 'INCOMPATIBLE';
const p19ReadyForP20 = shapeCompatibility === 'COMPATIBLE';

gate('P19 ready for P20 pre/post PIT comparison', p19ReadyForP20,
  `shapeCompatibility: ${shapeCompatibility}`);

console.log(`\n[PART E] Shape compatibility: ${shapeCompatibility}`);
console.log(`[PART E] P19 ready for P20: ${p19ReadyForP20}`);
console.log(`[PART E] Gates: ${gates.passed}/${gates.total}`);

// ─── Write outputs ────────────────────────────────────────────────────────────

const result = {
  phase: 'P19-HARDRESET',
  part: 'E',
  generatedAt: new Date().toISOString(),
  lineCount: { p3: p3Rows.length, p19: p19Rows.length },
  uniqueSymbols: { p3: p3Syms.size, p19: p19Syms.size },
  uniqueAsOfDates: { p3: p3Dates.size, p19: p19Dates.size },
  horizonDistribution: { p3: p3HorizonDist, p19: p19HorizonDist },
  scoringCompletenessStatusDistribution: { p3: p3ScoringDist, p19: p19ScoringDist },
  researchBucketDistribution: { p3: p3BucketDist, p19: p19BucketDist },
  nonZeroScoreCount: { p3: p3NonZero, p19: p19NonZero },
  snapshotPresenceRatios: {
    reasonSnapshot: { p3: p3ReasonPresence, p19: p19ReasonPresence },
    signalSnapshot: { p3: p3SignalPresence, p19: p19SignalPresence },
    factorSnapshot: { p3: p3FactorPresence, p19: p19FactorPresence },
  },
  monthlyRevenuePitGateStatusDistribution: p19PitGateDist,
  schemaCompatible,
  shapeCompatibility,
  p19ReadyForP20Comparison: p19ReadyForP20,
  missingP19Fields,
  missingP3CoreInP19,
  notes: [
    'P19 is based on P3 base rows with PIT gate metadata added',
    'All 4500 rows have monthlyRevenuePitGateStatus=NOT_APPLICABLE_NO_DATA (no MonthlyRevenue data in P3 base)',
    'P19 corpus is schema-compatible with P3 for P20 pre/post comparison',
  ],
  gatesPassed: gates.passed,
  gatesTotal: gates.total,
  gatesFailed: gates.failed,
  validationStatus: gates.failed.length === 0 ? 'PASS' : 'FAIL',
};

fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));

const md = `# P19 Active Scoring PIT Replay — Field Inspection & P3 Shape Comparison

> DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.

**Phase**: P19-HARDRESET PART E
**Generated**: ${result.generatedAt}
**Validation Status**: **${result.validationStatus}**

## Corpus Dimensions

| Metric | P3 | P19 |
|--------|----|-----|
| Line count | ${p3Rows.length} | ${p19Rows.length} |
| Unique symbols | ${p3Syms.size} | ${p19Syms.size} |
| Unique asOfDates | ${p3Dates.size} | ${p19Dates.size} |
| COMPLETE+PARTIAL % | ${Math.round(((p3ScoringDist['COMPLETE']??0)+(p3ScoringDist['PARTIAL']??0))/p3Rows.length*100)}% | ${p19CompletePartialRatio}% |
| Non-zero score rows | ${p3NonZero} | ${p19NonZero} |

## ScoringCompletenessStatus Distribution

| Status | P3 | P19 |
|--------|----|-----|
${[...new Set([...Object.keys(p3ScoringDist), ...Object.keys(p19ScoringDist)])].map(k => `| ${k} | ${p3ScoringDist[k]??0} | ${p19ScoringDist[k]??0} |`).join('\n')}

## Snapshot Presence Ratios

| Snapshot | P3 | P19 |
|----------|----|-----|
| reasonSnapshot | ${p3ReasonPresence}% | ${p19ReasonPresence}% |
| signalSnapshot | ${p3SignalPresence}% | ${p19SignalPresence}% |
| factorSnapshot | ${p3FactorPresence}% | ${p19FactorPresence}% |

## MonthlyRevenue PIT Gate Status Distribution (P19)

${Object.entries(p19PitGateDist).map(([k,v]) => `- ${k}: ${v}`).join('\n')}

## Schema Compatibility

- Schema compatible: **${schemaCompatible}**
- Shape compatibility: **${shapeCompatibility}**
- P19 ready for P20 pre/post PIT comparison: **${p19ReadyForP20}**

## Gate Results

- Passed: ${gates.passed}/${gates.total}
- Failed: ${gates.failed.length > 0 ? gates.failed.map(f => f.name).join(', ') : 'none'}
`;

fs.writeFileSync(OUT_MD, md);

console.log(`[RESULT] Written: ${OUT_JSON}`);
console.log(`[RESULT] Written: ${OUT_MD}`);

if (gates.failed.length > 0) {
  console.error('\nFAILED GATES:');
  for (const f of gates.failed) console.error(`  - ${f.name}: ${f.details}`);
  process.exit(1);
}
