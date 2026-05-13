/**
 * P26F-HARDRESET: Scoring Invariance Check
 *
 * Verifies scoring files unchanged (sha256) and candidate corpus
 * does not alter alphaScore/recommendationBucket.
 * No ROI/win-rate/profit/outperform/buy/sell claims.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const OUT_DIR = 'outputs/online_validation';
const RESULT_JSON = path.join(OUT_DIR, 'p26f_scoring_invariance_check.json');
const RESULT_MD = path.join(OUT_DIR, 'p26f_scoring_invariance_check.md');

const FROZEN_SHA256 = {
  'src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts': '063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d',
  'src/lib/analysis/RuleBasedStockAnalyzer.ts': 'bc3716cc8e74be304f2e262aac586a61760bb59d6c95e82a575c38e03ea7373d',
  'src/lib/alpha/SignalFusionEngine.ts': 'b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4',
};

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJSONL(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => JSON.parse(l));
}

// Check scoring file sha256
const computedSha256 = {};
let scoringPathSha256Unchanged = true;
const sha256Mismatches = [];

for (const [file, frozen] of Object.entries(FROZEN_SHA256)) {
  const computed = sha256File(file);
  computedSha256[file] = computed;
  if (computed !== frozen) {
    scoringPathSha256Unchanged = false;
    sha256Mismatches.push({ file, frozen, computed });
  }
}

// Load original and candidate corpus
const P3_ORIGINAL = path.join(OUT_DIR, 'p3active_scoring_historical_replay_corpus.jsonl');
const P19_ORIGINAL = path.join(OUT_DIR, 'p19active_scoring_pit_replay_corpus.jsonl');
const P3_CANDIDATE = path.join(OUT_DIR, 'p26f_monthly_revenue_candidate_p3_enriched.jsonl');
const P19_CANDIDATE = path.join(OUT_DIR, 'p26f_monthly_revenue_candidate_p19_enriched.jsonl');

const p3Original = readJSONL(P3_ORIGINAL);
const p19Original = readJSONL(P19_ORIGINAL);
const p3Candidate = readJSONL(P3_CANDIDATE);
const p19Candidate = readJSONL(P19_CANDIDATE);

let mismatchedAlphaScoreCount = 0;
let mismatchedBucketCount = 0;
let allContextEntersAlphaScoreFalse = true;

// Check P3
for (let i = 0; i < p3Original.length; i++) {
  const orig = p3Original[i];
  const cand = p3Candidate[i];
  if (!cand) continue;

  if (cand.p26fMonthlyRevenueContext && cand.p26fMonthlyRevenueContext.entersAlphaScore !== false) {
    allContextEntersAlphaScoreFalse = false;
  }

  const origAlpha = orig.activeScoringSnapshot && orig.activeScoringSnapshot.alphaScore;
  const candAlpha = cand.activeScoringSnapshot && cand.activeScoringSnapshot.alphaScore;
  if (origAlpha !== candAlpha) mismatchedAlphaScoreCount++;

  const origBucket = orig.researchBucket;
  const candBucket = cand.researchBucket;
  if (origBucket !== candBucket) mismatchedBucketCount++;
}

// Check P19
for (let i = 0; i < p19Original.length; i++) {
  const orig = p19Original[i];
  const cand = p19Candidate[i];
  if (!cand) continue;

  if (cand.p26fMonthlyRevenueContext && cand.p26fMonthlyRevenueContext.entersAlphaScore !== false) {
    allContextEntersAlphaScoreFalse = false;
  }

  const origAlpha = orig.activeScoringSnapshot && orig.activeScoringSnapshot.alphaScore;
  const candAlpha = cand.activeScoringSnapshot && cand.activeScoringSnapshot.alphaScore;
  if (origAlpha !== candAlpha) mismatchedAlphaScoreCount++;

  const origBucket = orig.researchBucket;
  const candBucket = cand.researchBucket;
  if (origBucket !== candBucket) mismatchedBucketCount++;
}

const totalRows = p3Candidate.length + p19Candidate.length;
const invariancePass = mismatchedAlphaScoreCount === 0 && mismatchedBucketCount === 0 && scoringPathSha256Unchanged && allContextEntersAlphaScoreFalse;

const result = {
  phase: 'P26F-HARDRESET',
  totalRows,
  mismatchedAlphaScoreCount,
  mismatchedBucketCount,
  scoringPathSha256Unchanged,
  allContextEntersAlphaScoreFalse,
  scoringFileSha256: computedSha256,
  frozenSha256: FROZEN_SHA256,
  sha256Mismatches: sha256Mismatches.length > 0 ? sha256Mismatches : [],
  status: invariancePass ? 'SCORING_INVARIANCE_PASS' : 'SCORING_INVARIANCE_FAIL',
};

fs.writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2));

const md = `# P26F Scoring Invariance Check

**Phase:** P26F-HARDRESET  
**Status:** ${result.status}

## Results

| Metric | Value |
|---|---|
| Total rows checked | ${totalRows} |
| Mismatched alphaScore | ${mismatchedAlphaScoreCount} |
| Mismatched researchBucket | ${mismatchedBucketCount} |
| Scoring file SHA256 unchanged | ${scoringPathSha256Unchanged} |
| All context entersAlphaScore=false | ${allContextEntersAlphaScoreFalse} |

## Conclusion

${invariancePass ? 'Scoring invariance confirmed. Candidate corpus adds p26fMonthlyRevenueContext without altering scoring.' : 'INVARIANCE FAILURE detected. See mismatches above.'}

*Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.*
`;
fs.writeFileSync(RESULT_MD, md);

console.log(`[P26F] Scoring invariance check.`);
console.log(`  totalRows: ${totalRows}, alphaScore mismatches: ${mismatchedAlphaScoreCount}, bucket mismatches: ${mismatchedBucketCount}`);
console.log(`  sha256Unchanged: ${scoringPathSha256Unchanged}, allEntersAlphaFalse: ${allContextEntersAlphaScoreFalse}`);
console.log(`  Status: ${result.status}`);

if (!invariancePass) {
  console.error('[P26F] INVARIANCE FAILURE');
  process.exit(1);
}
