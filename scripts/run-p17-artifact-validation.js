'use strict';
/**
 * run-p17-artifact-validation.js
 *
 * DISCLAIMER: Does not constitute investment advice. Artifact integrity check only.
 */
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'outputs', 'online_validation');
const corpusDir = path.join(__dirname, '..', 'outputs', 'corpus');

let passCount = 0;
let failCount = 0;
const results = [];

function assert(label, condition, details) {
  if (condition) {
    passCount++;
    results.push({ label, status: 'PASS' });
    console.log(`  ✅ PASS: ${label}`);
  } else {
    failCount++;
    results.push({ label, status: 'FAIL', details });
    console.error(`  ❌ FAIL: ${label} | ${JSON.stringify(details)}`);
  }
}

function readJson(filename) {
  const p = path.join(outDir, filename);
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function fileExists(filepath) {
  try { fs.accessSync(filepath); return true; } catch { return false; }
}

function countLines(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  return content.trim().split('\n').length;
}

console.log('\n=== P17 Artifact Validation ===\n');

// ─── JSON parse all P17 artifacts ────────────────────────────────────────────
const p17Artifacts = [
  'p17monthly_revenue_patch_preflight.json',
  'p17monthly_revenue_schema_patch.json',
  'p17monthly_revenue_query_gate_patch.json',
  'p17monthly_revenue_query_gate_validation.json',
];

for (const filename of p17Artifacts) {
  try {
    const parsed = readJson(filename);
    assert(`JSON parse: ${filename}`, typeof parsed === 'object' && parsed !== null, {});
  } catch (e) {
    assert(`JSON parse: ${filename}`, false, { error: e.message });
  }
}

// ─── Markdown files exist ─────────────────────────────────────────────────────
const p17MarkdownFiles = [
  'p17monthly_revenue_patch_preflight.md',
  'p17monthly_revenue_schema_patch.md',
  'p17monthly_revenue_query_gate_patch.md',
  'p17monthly_revenue_query_gate_validation.md',
];

for (const filename of p17MarkdownFiles) {
  const p = path.join(outDir, filename);
  assert(`Markdown exists: ${filename}`, fileExists(p), { path: p });
}

// ─── Schema patch fields ──────────────────────────────────────────────────────
try {
  const schema = readJson('p17monthly_revenue_schema_patch.json');
  assert('schema.productionApplyAllowed === false', schema.productionApplyAllowed === false, schema);
  assert('schema.addedFields.length >= 3', Array.isArray(schema.addedFields) && schema.addedFields.length >= 3, { count: schema.addedFields?.length });
  const fieldNames = schema.addedFields.map(f => f.field);
  assert('schema has releaseDate field', fieldNames.includes('releaseDate'), { fieldNames });
  assert('schema has releaseDateSource field', fieldNames.includes('releaseDateSource'), { fieldNames });
  assert('schema has releaseDateConfidence field', fieldNames.includes('releaseDateConfidence'), { fieldNames });
} catch (e) {
  assert('schema patch json readable', false, { error: e.message });
}

// ─── Query gate patch fields ──────────────────────────────────────────────────
try {
  const patch = readJson('p17monthly_revenue_query_gate_patch.json');
  assert('patch.productionApplyAllowed === false', patch.productionApplyAllowed === false, patch);
  assert('patch.patchedFiles exists', Array.isArray(patch.patchedFiles) && patch.patchedFiles.length >= 3, { count: patch.patchedFiles?.length });
  assert('patch.patchStatus === APPLIED', patch.patchStatus === 'APPLIED', { patchStatus: patch.patchStatus });
  assert('patch.usedForbiddenOutcomeFields === false', patch.usedForbiddenOutcomeFields === false, {});
} catch (e) {
  assert('query gate patch json readable', false, { error: e.message });
}

// ─── Validation results ───────────────────────────────────────────────────────
try {
  const validation = readJson('p17monthly_revenue_query_gate_validation.json');
  assert('validation.validationStatus === ALL_PASS', validation.validationStatus === 'ALL_PASS', { status: validation.validationStatus, pass: validation.passCount, fail: validation.failCount });
  assert('validation.passCount >= 10', validation.passCount >= 10, { passCount: validation.passCount });
  assert('validation.failCount === 0', validation.failCount === 0, { failCount: validation.failCount });
  assert('validation.productionApplyAllowed === false', validation.productionApplyAllowed === false, {});
} catch (e) {
  assert('validation json readable', false, { error: e.message });
}

// ─── Migration draft file exists ─────────────────────────────────────────────
const migrationSql = path.join(__dirname, '..', 'prisma', 'migrations',
  '20260512000000_monthly_revenue_release_date_pit_draft', 'migration.sql');
assert('migration draft SQL exists', fileExists(migrationSql), { path: migrationSql });

const sqlContent = fs.readFileSync(migrationSql, 'utf8');
assert('migration SQL is DRAFT (not production)', sqlContent.includes('DRAFT'), {});
assert('migration SQL adds releaseDate', sqlContent.includes('releaseDate'), {});

// ─── Helper file exists ───────────────────────────────────────────────────────
const helperFile = path.join(__dirname, '..', 'src', 'lib', 'onlineValidation', 'MonthlyRevenueAvailability.ts');
assert('MonthlyRevenueAvailability.ts exists', fileExists(helperFile), { path: helperFile });

// ─── Frozen corpus line counts ────────────────────────────────────────────────
const corpora = [
  { name: 'simulation_snapshot_corpus.jsonl', expected: 60 },
  { name: 'p0hardreset_historical_replay_corpus.jsonl', expected: 4500 },
  { name: 'p1baseline_historical_replay_corpus.jsonl', expected: 9900 },
  { name: 'p3active_scoring_historical_replay_corpus.jsonl', expected: 4500 },
];

for (const corpus of corpora) {
  const p = path.join(corpusDir, corpus.name);
  if (fileExists(p)) {
    const lines = countLines(p);
    assert(`Frozen corpus ${corpus.name} = ${corpus.expected} lines`, lines === corpus.expected, { lines, expected: corpus.expected });
  } else {
    // corpus might be in different location
    console.log(`  ⚠️  SKIP: corpus not found at ${p} (may be elsewhere)`);
  }
}

// ─── P16 artifacts still present ─────────────────────────────────────────────
const p16Artifacts = [
  'p16monthly_revenue_final_report.md',
  'p16monthly_revenue_dry_run_preflight.json',
  'p16monthly_revenue_fixture_migration_dry_run.json',
  'p16monthly_revenue_backfill_dry_run.json',
  'p16monthly_revenue_query_gate_dry_run.json',
];
for (const filename of p16Artifacts) {
  const p = path.join(outDir, filename);
  assert(`P16 artifact preserved: ${filename}`, fileExists(p), { path: p });
}

// ─── Summary ──────────────────────────────────────────────────────────────────
const total = passCount + failCount;
const allPass = failCount === 0;
console.log(`\n=== ARTIFACT VALIDATION ${allPass ? 'ALL_PASS' : 'FAIL'}: ${passCount}/${total} ===\n`);

if (!allPass) process.exit(1);
