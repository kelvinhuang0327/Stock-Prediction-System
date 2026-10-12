#!/usr/bin/env node
/**
 * _p19_artifact_validation.js — P19-HARDRESET PART H
 *
 * Validates all P19 JSON/JSONL artifacts can be parsed and contain required fields.
 * Verifies frozen corpus line counts unchanged.
 */
'use strict';
const fs = require('fs');

const gates = { total: 0, passed: 0, failed: [] };
function gate(name, condition, details) {
  gates.total++;
  if (condition) { gates.passed++; console.log(`  [PASS] ${name}`); }
  else { console.log(`  [FAIL] ${name}: ${details}`); gates.failed.push({ name, details }); }
  return condition;
}

console.log('\n=== P19-HARDRESET PART H: Artifact Validation ===\n');

// JSON artifacts
const jsonArtifacts = [
  {
    path: 'outputs/online_validation/p19active_scoring_pit_replay_preflight.json',
    requiredFields: ['preflightStatus'],
  },
  {
    path: 'outputs/online_validation/p19active_scoring_pit_replay_summary.json',
    requiredFields: ['scoringCompletenessStatusDistribution', 'validationStatus', 'gatesPassed'],
  },
  {
    path: 'outputs/online_validation/p19monthly_revenue_pit_guard_validation.json',
    requiredFields: ['validationStatus', 'checkedRows', 'leakageViolations'],
  },
  {
    path: 'outputs/online_validation/p19active_scoring_pit_replay_field_inspection.json',
    requiredFields: ['shapeCompatibility', 'p19ReadyForP20Comparison', 'scoringCompletenessStatusDistribution'],
  },
];

for (const { path, requiredFields } of jsonArtifacts) {
  const exists = fs.existsSync(path);
  gate(`${path} exists`, exists, 'file not found');
  if (!exists) continue;

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(path, 'utf8'));
    gate(`${path} is valid JSON`, true, '');
  } catch (e) {
    gate(`${path} is valid JSON`, false, e.message);
    continue;
  }

  for (const field of requiredFields) {
    gate(`${path} has '${field}'`, field in parsed, `field missing`);
  }
}

// JSONL corpus
const corpusPath = 'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl';
gate('P19 corpus exists', fs.existsSync(corpusPath), 'not found');
if (fs.existsSync(corpusPath)) {
  const lines = fs.readFileSync(corpusPath, 'utf8').trim().split('\n');
  gate('P19 corpus has 4500+ lines', lines.length >= 4500, `actual: ${lines.length}`);
  
  let parseErrors = 0;
  for (const l of lines) {
    try { JSON.parse(l); } catch { parseErrors++; }
  }
  gate('All P19 corpus lines parse as valid JSON', parseErrors === 0, `${parseErrors} parse errors`);

  // Spot-check fields in first and last row
  const first = JSON.parse(lines[0]);
  const last = JSON.parse(lines[lines.length - 1]);
  gate('First row has pitReplayRunId', 'pitReplayRunId' in first, 'missing');
  gate('First row has monthlyRevenuePitGateStatus', 'monthlyRevenuePitGateStatus' in first, 'missing');
  gate('First row productionApplyAllowed=false', first.productionApplyAllowed === false, `actual: ${first.productionApplyAllowed}`);
  gate('Last row has pitReplayRunId', 'pitReplayRunId' in last, 'missing');
  gate('Last row productionApplyAllowed=false', last.productionApplyAllowed === false, `actual: ${last.productionApplyAllowed}`);
}

// MD artifacts
const mdArtifacts = [
  'outputs/online_validation/p19active_scoring_pit_replay_summary.md',
  'outputs/online_validation/p19monthly_revenue_pit_guard_validation.md',
  'outputs/online_validation/p19active_scoring_pit_replay_field_inspection.md',
];
for (const mdPath of mdArtifacts) {
  gate(`${mdPath} exists`, fs.existsSync(mdPath), 'not found');
  if (fs.existsSync(mdPath)) {
    const content = fs.readFileSync(mdPath, 'utf8');
    gate(`${mdPath} has content`, content.length > 100, `only ${content.length} chars`);
    gate(`${mdPath} has DISCLAIMER`, /DISCLAIMER/i.test(content), 'missing DISCLAIMER');
  }
}

// Frozen corpus line counts
const frozenExpected = [
  { path: 'outputs/online_validation/simulation_snapshot_corpus.jsonl', lines: 60 },
  { path: 'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl', lines: 4500 },
  { path: 'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl', lines: 9900 },
  { path: 'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl', lines: 4500 },
];

for (const { path, lines } of frozenExpected) {
  if (!fs.existsSync(path)) { gate(`${path} unchanged`, false, 'not found'); continue; }
  const actual = fs.readFileSync(path, 'utf8').trim().split('\n').length;
  gate(`${path} = ${lines} lines (unchanged)`, actual === lines, `actual: ${actual}`);
}

// Validation statuses
for (const { path } of jsonArtifacts) {
  if (!fs.existsSync(path)) continue;
  const parsed = JSON.parse(fs.readFileSync(path, 'utf8'));
  if ('validationStatus' in parsed) {
    const ok = parsed.validationStatus === 'PASS' || parsed.validationStatus === 'ALL_PASS';
    gate(`${path} validationStatus=PASS`, ok, `actual: ${parsed.validationStatus}`);
  }
  if ('preflightStatus' in parsed) {
    gate(`${path} preflightStatus=PASS`, parsed.preflightStatus === 'PASS',
      `actual: ${parsed.preflightStatus}`);
  }
}

const validationStatus = gates.failed.length === 0 ? 'PASS' : 'FAIL';
console.log(`\n[RESULT] Gates: ${gates.passed}/${gates.total} PASS`);
console.log(`[RESULT] Artifact Validation Status: ${validationStatus}`);
if (gates.failed.length > 0) {
  console.error('\nFAILED:');
  for (const f of gates.failed) console.error(`  - ${f.name}: ${f.details}`);
  process.exit(1);
}
