'use strict';
/**
 * P21-HARDRESET Part H
 * Artifact validation: JSON integrity, structure, frozen corpus counts,
 * and safety invariants.
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log('  PASS', name);
    passed++;
  } catch (e) {
    console.log('  FAIL', name, '—', e.message);
    failed++;
  }
}

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n').filter(l => l.trim().length > 0).length;
}

const BASE = '/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System';
const OUT = path.join(BASE, 'outputs/online_validation');
const CORPUS = path.join(BASE, 'outputs/online_validation');

// ─── JSON Integrity ───────────────────────────────────────────────────────────
console.log('\n=== 1. JSON Integrity ===');

let review, risks, decision;

check('p21production_migration_approval_review.json parses OK', () => {
  review = loadJson(path.join(OUT, 'p21production_migration_approval_review.json'));
});
check('p21production_migration_risk_register.json parses OK', () => {
  risks = loadJson(path.join(OUT, 'p21production_migration_risk_register.json'));
});
check('p21production_migration_approval_decision.json parses OK', () => {
  decision = loadJson(path.join(OUT, 'p21production_migration_approval_decision.json'));
});

// ─── Structure Checks ─────────────────────────────────────────────────────────
console.log('\n=== 2. Approval Review Structure ===');

check('review.hardGateResults exists', () => {
  if (!review || !review.hardGateResults) throw new Error('missing hardGateResults');
});
check('review has 15 hard gates', () => {
  if (!Array.isArray(review.hardGateResults) || review.hardGateResults.length !== 15)
    throw new Error(`expected 15, got ${review.hardGateResults?.length}`);
});
check('all 15 gates PASS', () => {
  const failing = review.hardGateResults.filter(g => g.passed !== true);
  if (failing.length > 0) throw new Error(`failing gates: ${failing.map(g => g.gateId).join(', ')}`);
});
check('review.hardGatePassCount=15 hardGateFailCount=0', () => {
  if (review.hardGatePassCount !== 15) throw new Error(`passCount=${review.hardGatePassCount}`);
  if (review.hardGateFailCount !== 0) throw new Error(`failCount=${review.hardGateFailCount}`);
});
check('review.approvalReadiness.classification is P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL', () => {
  const cls = review.approvalReadiness && review.approvalReadiness.classification;
  if (cls !== 'P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL')
    throw new Error(`got ${cls}`);
});
check('review.approvalGranted is false', () => {
  if (review.approvalGranted !== false) throw new Error(`approvalGranted=${review.approvalGranted}`);
});
check('review.productionMigrationApplied is false', () => {
  if (review.productionMigrationApplied !== false)
    throw new Error(`productionMigrationApplied=${review.productionMigrationApplied}`);
});

console.log('\n=== 3. Risk Register Structure ===');

check('risks.risks is an array', () => {
  if (!risks || !Array.isArray(risks.risks)) throw new Error('missing risks array');
});
check('risk register has 10 risks', () => {
  if (risks.risks.length !== 10) throw new Error(`expected 10, got ${risks.risks.length}`);
});
check('risks.approvalGranted is false', () => {
  if (risks.approvalGranted !== false) throw new Error(`approvalGranted=${risks.approvalGranted}`);
});
check('risks.productionMigrationApplied is false', () => {
  if (risks.productionMigrationApplied !== false)
    throw new Error(`productionMigrationApplied=${risks.productionMigrationApplied}`);
});
check('RISK-01 requires action before production', () => {
  const r = risks.risks.find(x => x.riskId === 'RISK-01');
  if (!r) throw new Error('RISK-01 not found');
  if (!r.requiredBeforeProduction) throw new Error('RISK-01 requiredBeforeProduction should be true');
});

console.log('\n=== 4. Decision Structure ===');

check('decision.classification is P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL', () => {
  if (decision.classification !== 'P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL')
    throw new Error(`got ${decision.classification}`);
});
check('decision.approvalGranted is false', () => {
  if (decision.approvalGranted !== false) throw new Error(`approvalGranted=${decision.approvalGranted}`);
});
check('decision.productionMigrationApplied is false', () => {
  if (decision.productionMigrationApplied !== false)
    throw new Error(`productionMigrationApplied=${decision.productionMigrationApplied}`);
});
check('decision.readyToRequestApprovalToken is true', () => {
  if (decision.readyToRequestApprovalToken !== true)
    throw new Error(`readyToRequestApprovalToken=${decision.readyToRequestApprovalToken}`);
});
check('decision.recommendedApprovalToken matches expected token', () => {
  const expected = 'P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY';
  if (decision.recommendedApprovalToken !== expected)
    throw new Error(`got ${decision.recommendedApprovalToken}`);
});

// ─── Frozen Corpus Counts ─────────────────────────────────────────────────────
console.log('\n=== 5. Frozen Corpus Counts ===');

const corpusFiles = [
  { file: 'simulation_snapshot_corpus.jsonl', expected: 60 },
  { file: 'p0hardreset_historical_replay_corpus.jsonl', expected: 4500 },
  { file: 'p1baseline_historical_replay_corpus.jsonl', expected: 9900 },
  { file: 'p3active_scoring_historical_replay_corpus.jsonl', expected: 4500 },
  { file: 'p19active_scoring_pit_replay_corpus.jsonl', expected: 4500 },
];

for (const { file, expected } of corpusFiles) {
  const fullPath = path.join(CORPUS, file);
  check(`${file} = ${expected} lines`, () => {
    if (!fs.existsSync(fullPath)) throw new Error('file not found');
    const count = countLines(fullPath);
    if (count !== expected) throw new Error(`expected ${expected}, got ${count}`);
  });
}

// ─── Safety Invariants ────────────────────────────────────────────────────────
console.log('\n=== 6. Safety Invariants ===');

check('NO automatic production approval granted', () => {
  for (const [name, obj] of [['review', review], ['risks', risks], ['decision', decision]]) {
    if (obj && obj.approvalGranted === true) throw new Error(`${name}.approvalGranted is true`);
  }
});
check('NO production migration applied', () => {
  for (const [name, obj] of [['review', review], ['risks', risks], ['decision', decision]]) {
    if (obj && obj.productionMigrationApplied === true)
      throw new Error(`${name}.productionMigrationApplied is true`);
  }
});

// ─── MD Files Exist ────────────────────────────────────────────────────────────
console.log('\n=== 7. Markdown Artifacts Exist ===');

const mdFiles = [
  'p21production_migration_approval_review.md',
  'p21production_migration_risk_register.md',
  'p21production_migration_approval_decision.md',
];
for (const f of mdFiles) {
  check(`${f} exists`, () => {
    if (!fs.existsSync(path.join(OUT, f))) throw new Error('file not found');
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n========================================');
console.log(`P21 Artifact Validation: ${passed} passed, ${failed} failed`);
console.log('========================================');

if (failed > 0) process.exit(1);
else { console.log('ALL CHECKS PASS'); process.exit(0); }
