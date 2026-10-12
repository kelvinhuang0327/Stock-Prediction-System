'use strict';
// P20 PART H: Artifact Validation
// Validates all JSON artifacts parse, have required structure, and corpus files are frozen.
const fs = require('fs');

const OUT = 'outputs/online_validation';

// Frozen corpus line counts
const FROZEN = {
  'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl': 4500,
  'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl': 4500,
};

const ARTIFACTS = [
  `${OUT}/p20pit_impact_preflight.json`,
  `${OUT}/p20pit_impact_comparison.json`,
  `${OUT}/p20pit_impact_changed_cases.json`,
  `${OUT}/p20production_migration_readiness_decision.json`,
];

let allPass = true;
const results = [];

function pass(name) { console.log(`  [PASS] ${name}`); results.push({ name, status: 'PASS' }); }
function fail(name, msg) { console.log(`  [FAIL] ${name}: ${msg}`); results.push({ name, status: 'FAIL', msg }); allPass = false; }

console.log('P20-HARDRESET PART H: Artifact Validation');
console.log('Generated:', new Date().toISOString());
console.log('');

// 1. JSON parse all artifacts
for (const path of ARTIFACTS) {
  if (!fs.existsSync(path)) { fail(`exists:${path}`, 'FILE NOT FOUND'); continue; }
  try {
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    pass(`json-parse:${path}`);

    // 2. Structure checks
    if (path.includes('p20pit_impact_comparison.json')) {
      if (!data.corpusShapeComparison) fail('structure:comparison.corpusShapeComparison', 'missing');
      else pass('structure:comparison.corpusShapeComparison');
      if (!data.scoringCompletenessImpact) fail('structure:comparison.scoringCompletenessImpact', 'missing');
      else pass('structure:comparison.scoringCompletenessImpact');
      if (!data.bucketImpact) fail('structure:comparison.bucketImpact', 'missing');
      else pass('structure:comparison.bucketImpact');
    }

    if (path.includes('p20pit_impact_changed_cases.json')) {
      if (!Array.isArray(data.cases)) fail('structure:cases.cases', 'not an array');
      else pass('structure:cases.cases isArray');
    }

    if (path.includes('p20production_migration_readiness_decision.json')) {
      if (!data.classification) fail('structure:decision.classification', 'missing');
      else { pass('structure:decision.classification exists'); console.log(`         classification=${data.classification}`); }
      if (data.productionApplyAllowed !== false) fail('safety:productionApplyAllowed', `expected false, got ${data.productionApplyAllowed}`);
      else pass('safety:productionApplyAllowed=false');
      if (data.productionDbWritten !== false) fail('safety:productionDbWritten', `expected false, got ${data.productionDbWritten}`);
      else pass('safety:productionDbWritten=false');
    }

    if (path.includes('p20pit_impact_preflight.json')) {
      if (typeof data.gatesPassed !== 'number') fail('structure:preflight.gatesPassed', 'missing');
      else pass(`structure:preflight.gatesPassed=${data.gatesPassed}/${data.gatesTotal}`);
    }
  } catch (e) {
    fail(`json-parse:${path}`, e.message);
  }
}

// 3. Frozen corpus line counts
console.log('\n  Frozen corpus line count checks:');
for (const [corpusPath, expectedLines] of Object.entries(FROZEN)) {
  if (!fs.existsSync(corpusPath)) { fail(`frozen:${corpusPath}`, 'FILE NOT FOUND'); continue; }
  const lineCount = fs.readFileSync(corpusPath, 'utf8').trim().split('\n').length;
  if (lineCount !== expectedLines) fail(`frozen:${corpusPath}`, `expected ${expectedLines} lines, got ${lineCount}`);
  else pass(`frozen:${corpusPath} has ${expectedLines} lines`);
}

// 4. MD files exist
console.log('\n  Markdown artifact checks:');
const MDS = [
  `${OUT}/p20pit_impact_preflight.md`,
  `${OUT}/p20pit_impact_comparison.md`,
  `${OUT}/p20pit_impact_changed_cases.md`,
  `${OUT}/p20production_migration_readiness_decision.md`,
];
for (const md of MDS) {
  if (!fs.existsSync(md)) fail(`md-exists:${md}`, 'missing');
  else pass(`md-exists:${md}`);
}

console.log('');
console.log('=== PART H', allPass ? 'COMPLETE (ALL PASS)' : 'FAILED', '===');
if (!allPass) process.exit(1);
