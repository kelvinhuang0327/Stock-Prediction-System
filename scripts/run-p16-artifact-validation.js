'use strict';
/**
 * run-p16-artifact-validation.js
 * PART H: Validate all P16 artifacts and frozen corpus integrity.
 */
const fs   = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'outputs', 'online_validation');
let gates  = 0;
let passed = 0;

function check(label, fn) {
  gates++;
  try {
    fn();
    console.log(`  [PASS] ${label}`);
    passed++;
  } catch (e) {
    console.log(`  [FAIL] ${label}: ${e.message}`);
  }
}

// ── JSON parse all P16 artifacts ──
const p16JsonFiles = [
  'p16monthly_revenue_dry_run_preflight.json',
  'p16monthly_revenue_fixture_migration_dry_run.json',
  'p16monthly_revenue_backfill_dry_run.json',
  'p16monthly_revenue_query_gate_dry_run.json',
];
for (const fname of p16JsonFiles) {
  check(`JSON parse: ${fname}`, () => {
    const content = fs.readFileSync(path.join(OUT, fname), 'utf8');
    JSON.parse(content); // throws if invalid
  });
}

// ── P16 key invariants ──
const migration = JSON.parse(fs.readFileSync(path.join(OUT, 'p16monthly_revenue_fixture_migration_dry_run.json'), 'utf8'));
const backfill  = JSON.parse(fs.readFileSync(path.join(OUT, 'p16monthly_revenue_backfill_dry_run.json'), 'utf8'));
const query     = JSON.parse(fs.readFileSync(path.join(OUT, 'p16monthly_revenue_query_gate_dry_run.json'), 'utf8'));
const preflight = JSON.parse(fs.readFileSync(path.join(OUT, 'p16monthly_revenue_dry_run_preflight.json'), 'utf8'));

check('migration.productionApplyAllowed === false', () => {
  if (migration.productionApplyAllowed !== false) throw new Error(`got ${migration.productionApplyAllowed}`);
});
check('migration.dryRunOnly === true', () => {
  if (migration.dryRunOnly !== true) throw new Error(`got ${migration.dryRunOnly}`);
});
check('migration.validationStatus === PASS', () => {
  if (migration.validationStatus !== 'PASS') throw new Error(`got ${migration.validationStatus}`);
});
check('migration 11/11 gates pass', () => {
  if (!migration.allGatesPass) throw new Error('not all gates pass');
});
check('backfill.productionDbWritten === false', () => {
  if (backfill.productionDbWritten !== false) throw new Error(`got ${backfill.productionDbWritten}`);
});
check('backfill.dryRunOnly === true', () => {
  if (backfill.dryRunOnly !== true) throw new Error(`got ${backfill.dryRunOnly}`);
});
check('backfill.validationStatus === PASS', () => {
  if (backfill.validationStatus !== 'PASS') throw new Error(`got ${backfill.validationStatus}`);
});
check('query.productionApplyAllowed === false', () => {
  if (query.productionApplyAllowed !== false) throw new Error(`got ${query.productionApplyAllowed}`);
});
check('query.validationStatus === PASS', () => {
  if (query.validationStatus !== 'PASS') throw new Error(`got ${query.validationStatus}`);
});
check('query 8/8 scenarios pass', () => {
  if (!query.allScenariosPass) throw new Error('not all scenarios pass');
});
check('query 6/6 safety gates pass', () => {
  if (!query.allSafetyPass) throw new Error('not all safety gates pass');
});
check('preflight.preflightStatus === PASS', () => {
  if (preflight.preflightStatus !== 'PASS') throw new Error(`got ${preflight.preflightStatus}`);
});
check('preflight.readyForDryRunImplementation === true', () => {
  if (preflight.readyForDryRunImplementation !== true) throw new Error(`got ${preflight.readyForDryRunImplementation}`);
});

// ── MD files exist ──
const p16MdFiles = [
  'p16monthly_revenue_dry_run_preflight.md',
  'p16monthly_revenue_fixture_migration_dry_run.md',
  'p16monthly_revenue_backfill_dry_run.md',
  'p16monthly_revenue_query_gate_dry_run.md',
];
for (const fname of p16MdFiles) {
  check(`MD file exists: ${fname}`, () => {
    const content = fs.readFileSync(path.join(OUT, fname), 'utf8');
    if (content.trim().length < 100) throw new Error('file too short');
  });
}

// ── Frozen corpus ──
const frozenExpected = {
  'simulation_snapshot_corpus.jsonl': 60,
  'p0hardreset_historical_replay_corpus.jsonl': 4500,
  'p1baseline_historical_replay_corpus.jsonl': 9900,
  'p3active_scoring_historical_replay_corpus.jsonl': 4500,
};
for (const [fname, expectedLines] of Object.entries(frozenExpected)) {
  check(`Frozen corpus ${fname} = ${expectedLines} lines`, () => {
    const content = fs.readFileSync(path.join(OUT, fname), 'utf8');
    const lines = content.trim().split('\n').length;
    if (lines !== expectedLines) throw new Error(`got ${lines} lines, expected ${expectedLines}`);
  });
}

console.log(`\nArtifact Validation: ${passed}/${gates} PASS`);
if (passed !== gates) process.exit(1);
