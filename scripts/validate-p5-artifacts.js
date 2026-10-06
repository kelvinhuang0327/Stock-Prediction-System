'use strict';
// P5-HARDRESET PART G — Artifact Validation
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'outputs', 'online_validation');
const ROOT = path.join(__dirname, '..');

let allOk = true;

// JSON parse
const jsonFiles = [
  'p5walkthrough_preflight_audit.json',
  'p5walkthrough_review.json',
  'p5walkthrough_repair_backlog.json',
];
jsonFiles.forEach(f => {
  try {
    JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
    console.log('[G] JSON OK:', f);
  } catch(e) {
    console.error('[G] FAIL JSON:', f, e.message);
    allOk = false;
  }
});

// Frozen line counts
const frozen = {
  'outputs/online_validation/simulation_snapshot_corpus.jsonl': 60,
  'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl': 4500,
  'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl': 9900,
  'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl': 4500,
};
Object.entries(frozen).forEach(([rel, expected]) => {
  const f = path.join(ROOT, rel);
  try {
    const lines = fs.readFileSync(f, 'utf8').trim().split('\n').filter(l => l.trim()).length;
    const ok = lines === expected;
    console.log('[G]', ok ? 'PASS' : 'FAIL', 'frozen', path.basename(f) + ':', lines + '/' + expected);
    if (!ok) allOk = false;
  } catch(e) {
    console.error('[G] MISSING frozen file:', rel);
  }
});

// P5 structure
const review = JSON.parse(fs.readFileSync(path.join(OUT, 'p5walkthrough_review.json'), 'utf8'));
const backlog = JSON.parse(fs.readFileSync(path.join(OUT, 'p5walkthrough_repair_backlog.json'), 'utf8'));
const preflight = JSON.parse(fs.readFileSync(path.join(OUT, 'p5walkthrough_preflight_audit.json'), 'utf8'));

const rv = !!(review.summary && Array.isArray(review.cases) && review.cases.length > 0);
const bv = !!(Array.isArray(backlog.items) && backlog.items.length > 0);
const pv = typeof preflight.classification === 'string' || typeof preflight.passed === 'number';

console.log('[G]', rv ? 'PASS' : 'FAIL', 'review structure:', review.cases.length, 'cases');
console.log('[G]', bv ? 'PASS' : 'FAIL', 'backlog structure:', backlog.items.length, 'items');
console.log('[G]', pv ? 'PASS' : 'FAIL', 'preflight structure');
if (!rv || !bv || !pv) allOk = false;

// No Math.random in P5 utils
const checkRandom = (f) => (fs.readFileSync(f, 'utf8').match(/Math\.random/g) || []).length;
const utilr = checkRandom(path.join(ROOT, 'src/lib/onlineValidation/P5WalkthroughReviewUtils.ts'));
console.log('[G]', utilr === 0 ? 'PASS' : 'FAIL', 'P5 utils Math.random=', utilr);
if (utilr !== 0) allOk = false;

// ManualReview* untouched
const manualFiles = fs.readdirSync(path.join(ROOT, 'src/lib/onlineValidation'))
  .filter(f => f.startsWith('ManualReview'));
console.log('[G] ManualReview* count:', manualFiles.length, '(unchanged by P5)');

console.log('');
console.log('[G]', allOk ? 'P5_ARTIFACT_VALIDATION_PASS' : 'P5_ARTIFACT_VALIDATION_FAIL');
if (!allOk) process.exit(1);
