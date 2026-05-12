'use strict';
const fs = require('fs');

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    console.log('  PASS', label);
    passed++;
  } catch (e) {
    console.log('  FAIL', label, '—', e.message);
    failed++;
  }
}

// --- JSON parse checks ---
const p15Files = [
  'outputs/online_validation/p15migration_approval_preflight_review.json',
  'outputs/online_validation/p15migration_approval_review.json',
  'outputs/online_validation/p15migration_risk_register.json',
  'outputs/online_validation/p15migration_approval_decision.json',
];

console.log('=== JSON Parse ===');
for (const f of p15Files) {
  check(`JSON valid: ${f.split('/').pop()}`, () => {
    const content = fs.readFileSync(f, 'utf8');
    JSON.parse(content);
  });
}

// --- Frozen line count check ---
console.log('\n=== Frozen Corpus Line Counts ===');
const frozen = [
  ['outputs/online_validation/simulation_snapshot_corpus.jsonl', 60],
  ['outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl', 4500],
  ['outputs/online_validation/p1baseline_historical_replay_corpus.jsonl', 9900],
  ['outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl', 4500],
];
for (const [path, expected] of frozen) {
  check(`frozen ${path.split('/').pop()} = ${expected} lines`, () => {
    const lines = fs.readFileSync(path, 'utf8').trim().split('\n').length;
    if (lines !== expected) throw new Error(`expected ${expected} got ${lines}`);
  });
}

// --- P15 artifact structure checks ---
console.log('\n=== P15 Artifact Structure ===');

check('preflight_review.allGatesPass = true', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_preflight_review.json','utf8'));
  if (!d.allGatesPass) throw new Error('allGatesPass not true');
});

check('preflight_review.readyForApprovalReview = true', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_preflight_review.json','utf8'));
  if (!d.readyForApprovalReview) throw new Error('readyForApprovalReview not true');
});

check('approval_review.gateResults exists', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_review.json','utf8'));
  if (!Array.isArray(d.gateResults)) throw new Error('missing gateResults');
});

check('approval_review.allGatesPass = true', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_review.json','utf8'));
  if (!d.allGatesPass) throw new Error('allGatesPass not true');
});

check('approval_review.approvalGranted = false', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_review.json','utf8'));
  if (d.approvalGranted !== false) throw new Error('approvalGranted must be false');
});

check('approval_review.productionDbWritten = false', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_review.json','utf8'));
  if (d.productionDbWritten !== false) throw new Error('productionDbWritten must be false');
});

check('approval_review.whyNoMigrationApplied is array with content', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_review.json','utf8'));
  if (!Array.isArray(d.whyNoMigrationApplied) || d.whyNoMigrationApplied.length === 0) throw new Error('whyNoMigrationApplied missing');
});

check('risk_register.risks is array', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_risk_register.json','utf8'));
  if (!Array.isArray(d.risks)) throw new Error('missing risks');
  if (d.risks.length === 0) throw new Error('risks is empty');
});

check('risk_register has 8 risk items', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_risk_register.json','utf8'));
  if (d.risks.length !== 8) throw new Error(`expected 8 risks, got ${d.risks.length}`);
});

check('risk_register all risks have severity/likelihood', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_risk_register.json','utf8'));
  for (const r of d.risks) {
    if (!['LOW','MEDIUM','HIGH'].includes(r.severity)) throw new Error(`${r.riskId} bad severity`);
    if (!['LOW','MEDIUM','HIGH'].includes(r.likelihood)) throw new Error(`${r.riskId} bad likelihood`);
  }
});

check('approval_decision.classification exists', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_decision.json','utf8'));
  if (!d.classification) throw new Error('missing classification');
});

check('approval_decision.approvalGranted = false (invariant)', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_decision.json','utf8'));
  if (d.approvalGranted !== false) throw new Error('INVARIANT VIOLATION: approvalGranted must always be false');
});

check('approval_decision.productionApplyAllowed = false (invariant)', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_decision.json','utf8'));
  if (d.productionApplyAllowed !== false) throw new Error('INVARIANT VIOLATION: productionApplyAllowed must always be false');
});

check('approval_decision.productionDbWritten = false', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_decision.json','utf8'));
  if (d.productionDbWritten !== false) throw new Error('productionDbWritten must be false');
});

check('approval_decision.readyToRequestToken = true', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_decision.json','utf8'));
  if (!d.readyToRequestToken) throw new Error('readyToRequestToken should be true given all gates pass');
});

check('approval_decision.classification = APPROVAL_REVIEW_PASS_READY_FOR_DRY_RUN_IMPLEMENTATION', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_decision.json','utf8'));
  const expected = 'APPROVAL_REVIEW_PASS_READY_FOR_DRY_RUN_IMPLEMENTATION';
  if (d.classification !== expected) throw new Error(`expected ${expected}, got ${d.classification}`);
});

check('approval_decision has recommendedApprovalToken text', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p15migration_approval_decision.json','utf8'));
  if (!d.approvalTokenRequired || !d.approvalTokenRequired.includes('P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY')) {
    throw new Error('missing approvalTokenRequired');
  }
});

// Summary
console.log(`\n=== Result: ${passed}/${passed + failed} PASS ===`);
if (failed > 0) {
  process.exit(1);
}
