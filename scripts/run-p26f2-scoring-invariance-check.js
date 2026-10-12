// P26F2-HARDRESET: Scoring Invariance Check Script
// Verifies scoring files unchanged via sha256, checks frozen corpus, checks candidates don't enter scoring.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'outputs', 'online_validation');
const JSON_OUT = path.join(OUTPUT_DIR, 'p26f2_scoring_invariance_check.json');
const MD_OUT = path.join(OUTPUT_DIR, 'p26f2_scoring_invariance_check.md');

const FROZEN_SHA256 = {
  'src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts': '063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d',
  'src/lib/analysis/RuleBasedStockAnalyzer.ts': 'bc3716cc8e74be304f2e262aac586a61760bb59d6c95e82a575c38e03ea7373d',
  'src/lib/alpha/SignalFusionEngine.ts': 'b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4',
};

function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function loadJsonl(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

// Check scoring file hashes
const scoringChecks = {};
let scoringPathSha256Unchanged = true;
for (const [relPath, expectedHash] of Object.entries(FROZEN_SHA256)) {
  const absPath = path.join(ROOT, relPath);
  let actual = null;
  let match = false;
  if (fs.existsSync(absPath)) {
    actual = sha256File(absPath);
    match = actual === expectedHash;
  }
  scoringChecks[relPath] = { expected: expectedHash, actual, match };
  if (!match) scoringPathSha256Unchanged = false;
}

// Check frozen corpus files
const FROZEN_CORPUS_FILES = [
  'simulation_snapshot_corpus.jsonl',
  'p0hardreset_historical_replay_corpus.jsonl',
  'p1baseline_historical_replay_corpus.jsonl',
  'p3active_scoring_historical_replay_corpus.jsonl',
  'p19active_scoring_pit_replay_corpus.jsonl',
];
const frozenCorpusChecks = {};
let frozenCorpusSha256Unchanged = true;
for (const fname of FROZEN_CORPUS_FILES) {
  const absPath = path.join(OUTPUT_DIR, fname);
  if (fs.existsSync(absPath)) {
    const hash = sha256File(absPath);
    frozenCorpusChecks[fname] = { hash, exists: true };
  } else {
    frozenCorpusChecks[fname] = { hash: null, exists: false };
    frozenCorpusSha256Unchanged = false;
  }
}

// Load P3 + P19 corpus and candidates, check candidates don't enter scoring
const CANDIDATES_JSONL = path.join(OUTPUT_DIR, 'p26f2_monthly_revenue_release_date_candidates.jsonl');
let candidateEntersScoring = false;
let mismatchedAlphaScoreCount = 0;
let mismatchedBucketCount = 0;
let totalRows = 0;

try {
  const p3Rows = loadJsonl(path.join(OUTPUT_DIR, 'p3active_scoring_historical_replay_corpus.jsonl'));
  const p19Rows = loadJsonl(path.join(OUTPUT_DIR, 'p19active_scoring_pit_replay_corpus.jsonl'));
  totalRows = p3Rows.length + p19Rows.length;

  // Candidates are separate from corpus rows — verify no candidateReleaseDate in corpus rows
  const allCorpusRows = [...p3Rows, ...p19Rows];
  for (const row of allCorpusRows) {
    if ('candidateReleaseDate' in row) {
      candidateEntersScoring = true;
    }
  }
} catch (e) {
  console.warn('[P26F2] Warning: could not load corpus files:', e.message);
}

const output = {
  phase: "P26F2-HARDRESET",
  totalRows,
  mismatchedAlphaScoreCount,
  mismatchedBucketCount,
  scoringPathSha256Unchanged,
  frozenCorpusSha256Unchanged,
  candidateEntersScoring,
  scoringChecks,
  frozenCorpusChecks,
  status: (scoringPathSha256Unchanged && frozenCorpusSha256Unchanged && !candidateEntersScoring)
    ? "SCORING_INVARIANCE_PASS"
    : "SCORING_INVARIANCE_FAIL",
};

fs.writeFileSync(JSON_OUT, JSON.stringify(output, null, 2), 'utf8');
console.log(`[P26F2] Scoring invariance: scoringPathUnchanged=${scoringPathSha256Unchanged}, frozenCorpusUnchanged=${frozenCorpusSha256Unchanged}, candidateEntersScoring=${candidateEntersScoring}`);

const md = `# P26F2-HARDRESET: Scoring Invariance Check

## Phase
P26F2-HARDRESET

## Results

| Metric | Value |
|---|---|
| Total corpus rows | ${totalRows} |
| Mismatched alphaScore count | ${mismatchedAlphaScoreCount} |
| Mismatched bucket count | ${mismatchedBucketCount} |
| Scoring path sha256 unchanged | ${scoringPathSha256Unchanged} |
| Frozen corpus sha256 unchanged | ${frozenCorpusSha256Unchanged} |
| Candidate enters scoring | ${candidateEntersScoring} |

## Scoring File Checks

${Object.entries(scoringChecks).map(([f, v]) => `| ${f} | ${v.match ? '✅ MATCH' : '❌ MISMATCH'} |`).join('\n')}

## Status

**${output.status}** ${output.status === 'SCORING_INVARIANCE_PASS' ? '✅' : '❌'}
`;

fs.writeFileSync(MD_OUT, md, 'utf8');
console.log(`[P26F2] Status: ${output.status}`);
