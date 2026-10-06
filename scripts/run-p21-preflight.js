'use strict';
// P21-HARDRESET PART A — Pre-flight Gate
// DISCLAIMER: Observability only. Not investment advice.
// productionApplyAllowed=false | productionDbWritten=false
const fs = require('fs');

const OUT = 'outputs/online_validation';
const NOW = new Date().toISOString();

console.log('P21-HARDRESET PART A: Production Migration Approval Review Pre-flight');
console.log('Generated:', NOW);
console.log('');

let allPass = true;
const gates = [];

function gate(name, fn) {
  try {
    const result = fn();
    const pass = !!result;
    const msg = typeof result === 'string' ? result : (pass ? 'OK' : 'FAIL');
    gates.push({ name, status: pass ? 'PASS' : 'FAIL', msg });
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name}${typeof result === 'string' ? ': ' + result : ''}`);
    if (!pass) allPass = false;
  } catch (e) {
    gates.push({ name, status: 'FAIL', msg: e.message });
    console.log(`  [FAIL] ${name}: ${e.message}`);
    allPass = false;
  }
}

function fileExists(path) {
  return fs.existsSync(path);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function lineCount(path) {
  return fs.readFileSync(path, 'utf8').trim().split('\n').length;
}

// ─── A.1 P20 Artifacts ───────────────────────────────────────────────────────
console.log('A.1 P20 Artifacts:');
const P20_ARTIFACTS = [
  `${OUT}/p20pit_impact_final_report.md`,
  `${OUT}/p20pit_impact_comparison.json`,
  `${OUT}/p20pit_impact_changed_cases.json`,
  `${OUT}/p20production_migration_readiness_decision.json`,
];
for (const f of P20_ARTIFACTS) {
  gate(`P20 artifact exists: ${f.split('/').pop()}`, () => fileExists(f) || `NOT FOUND: ${f}`);
}

// ─── A.2 P17/P18/P19 Artifacts ───────────────────────────────────────────────
console.log('\nA.2 P17/P18/P19 Artifacts:');
const PRIOR_ARTIFACTS = [
  `${OUT}/p17monthly_revenue_final_report.md`,
  `${OUT}/p17monthly_revenue_schema_patch.json`,
  `${OUT}/p17monthly_revenue_query_gate_patch.json`,
  `${OUT}/p17monthly_revenue_query_gate_validation.json`,
  `${OUT}/p18monthly_revenue_final_report.md`,
  `${OUT}/p18monthly_revenue_fixture_db_migration.json`,
  `${OUT}/p18monthly_revenue_fixture_db_backfill.json`,
  `${OUT}/p18monthly_revenue_fixture_db_query_gate.json`,
  `${OUT}/p18monthly_revenue_fixture_db_rollback.json`,
  `${OUT}/p19monthly_revenue_pit_guard_validation.json`,
  `${OUT}/p19active_scoring_pit_replay_final_report.md`,
];
for (const f of PRIOR_ARTIFACTS) {
  gate(`Prior artifact exists: ${f.split('/').pop()}`, () => fileExists(f) || `NOT FOUND: ${f}`);
}

// ─── A.3 P20 Conclusions ─────────────────────────────────────────────────────
console.log('\nA.3 P20 Conclusion Verification:');
const dec = readJson(`${OUT}/p20production_migration_readiness_decision.json`);
const cmp = readJson(`${OUT}/p20pit_impact_comparison.json`);
const pit = readJson(`${OUT}/p19monthly_revenue_pit_guard_validation.json`);

gate('P20 classification = P20_READY_FOR_PRODUCTION_MIGRATION_APPROVAL_REVIEW',
  () => dec.classification === 'P20_READY_FOR_PRODUCTION_MIGRATION_APPROVAL_REVIEW' || `got: ${dec.classification}`);
gate('P20 productionApplyAllowed = false',
  () => dec.productionApplyAllowed === false || `got: ${dec.productionApplyAllowed}`);
gate('P20 productionDbWritten = false',
  () => dec.productionDbWritten === false || `got: ${dec.productionDbWritten}`);
gate('P20 corpus shape compatible',
  () => (cmp.corpusShapeComparison && cmp.corpusShapeComparison.shapeCompatible === true) || 'shapeCompatible not true');
gate('P19 PIT validation PASS',
  () => pit.validationStatus === 'PASS' || `got: ${pit.validationStatus}`);
gate('P19 leakage violations = 0',
  () => pit.leakageViolations === 0 || `got: ${pit.leakageViolations}`);
gate('P19 forbidden field violations = 0',
  () => pit.forbiddenFieldViolations === 0 || `got: ${pit.forbiddenFieldViolations}`);
gate('P20 scoring changes = 0',
  () => {
    const snap = cmp.snapshotImpact || {};
    const bucket = cmp.bucketImpact || {};
    const scoreChanged = (snap.scoreChangedCount || 0) + (bucket.bucketChangedCount || 0);
    return scoreChanged === 0 || `scoreChanged: ${scoreChanged}`;
  });

// ─── A.4 Frozen Corpus Checks ────────────────────────────────────────────────
console.log('\nA.4 Frozen Corpus Line Counts:');
const FROZEN = {
  [`${OUT}/simulation_snapshot_corpus.jsonl`]: 60,
  [`${OUT}/p0hardreset_historical_replay_corpus.jsonl`]: 4500,
  [`${OUT}/p1baseline_historical_replay_corpus.jsonl`]: 9900,
  [`${OUT}/p3active_scoring_historical_replay_corpus.jsonl`]: 4500,
  [`${OUT}/p19active_scoring_pit_replay_corpus.jsonl`]: 4500,
};
for (const [path, expected] of Object.entries(FROZEN)) {
  gate(`Frozen: ${path.split('/').pop()} = ${expected} lines`, () => {
    if (!fileExists(path)) return `NOT FOUND: ${path}`;
    const actual = lineCount(path);
    return actual === expected || `expected ${expected}, got ${actual}`;
  });
}

// ─── Output ───────────────────────────────────────────────────────────────────
const passCount = gates.filter(g => g.status === 'PASS').length;
const failCount = gates.filter(g => g.status === 'FAIL').length;

const output = {
  phase: 'P21-HARDRESET',
  part: 'A',
  generatedAt: NOW,
  productionApplyAllowed: false,
  productionDbWritten: false,
  gatesPassed: passCount,
  gatesTotal: gates.length,
  gatesFailed: failCount,
  validationStatus: allPass ? 'PASS' : 'FAIL',
  classification: allPass
    ? 'P21_PREFLIGHT_PASS'
    : 'P21_PRODUCTION_MIGRATION_APPROVAL_BLOCKED_BY_ARTIFACTS',
  gates,
  nextStep: allPass
    ? 'Proceed to P21 Parts B-J'
    : 'Resolve failing gates before proceeding',
};

fs.writeFileSync(`${OUT}/p21production_migration_approval_preflight.json`, JSON.stringify(output, null, 2));

const md = `# P21-HARDRESET Part A: Production Migration Approval Review Pre-flight

> DISCLAIMER: Observability only. Not investment advice. productionApplyAllowed=false | productionDbWritten=false

**Generated**: ${NOW}  
**Status**: ${output.validationStatus}  
**Gates**: ${passCount}/${gates.length} PASS

## Gate Results

| Gate | Status |
|------|--------|
${gates.map(g => `| ${g.name} | ${g.status}${g.msg && g.msg !== 'OK' ? ` (${g.msg})` : ''} |`).join('\n')}

## Classification

**${output.classification}**
`;
fs.writeFileSync(`${OUT}/p21production_migration_approval_preflight.md`, md);

console.log(`\nWritten: ${OUT}/p21production_migration_approval_preflight.json`);
console.log(`Written: ${OUT}/p21production_migration_approval_preflight.md`);
console.log(`\n=== PART A ${allPass ? 'COMPLETE (ALL PASS)' : 'FAILED'} ===`);
console.log(`Gates: ${passCount}/${gates.length}`);
if (!allPass) process.exit(1);
