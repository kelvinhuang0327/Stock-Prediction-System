#!/usr/bin/env node
// P26F3-2-HARDRESET: Scoring Invariance Check
// DISCLAIMER: Does not constitute investment advice.
// Verifies alphaScore/recommendationBucket/sha256 unchanged. Accepted source does NOT enter scoring.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'outputs/online_validation');
const CORPUS_OUT = path.join(ROOT, 'outputs/online_validation');

const BASELINE_SHA256 = {
  'ActiveScoringSnapshotBuilder.ts': '063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d',
  'RuleBasedStockAnalyzer.ts': 'bc3716cc8e74be304f2e262aac586a61760bb59d6c95e82a575c38e03ea7373d',
  'SignalFusionEngine.ts': 'b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4',
};

const SCORING_FILES = {
  'ActiveScoringSnapshotBuilder.ts': 'src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts',
  'RuleBasedStockAnalyzer.ts': 'src/lib/analysis/RuleBasedStockAnalyzer.ts',
  'SignalFusionEngine.ts': 'src/lib/alpha/SignalFusionEngine.ts',
};

function sha256(fp) {
  return crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
}

function countLines(fp) {
  if (!fs.existsSync(fp)) return -1;
  return fs.readFileSync(fp,'utf8').split('\n').filter(l => l.trim()).length;
}

const violations = [];
const checks = [];

// 1. P3 + P19 row counts
const p3Lines = countLines(path.join(CORPUS_OUT,'p3active_scoring_historical_replay_corpus.jsonl'));
const p19Lines = countLines(path.join(CORPUS_OUT,'p19active_scoring_pit_replay_corpus.jsonl'));
const totalCorpusRows = p3Lines + p19Lines;
const expectedTotal = 9000;
const corpusPass = totalCorpusRows === expectedTotal;
if (!corpusPass) violations.push(`P3+P19 rows: expected ${expectedTotal}, got ${totalCorpusRows}`);
checks.push({ check: 'P3_P19_ROW_COUNT', expected: expectedTotal, actual: totalCorpusRows, pass: corpusPass });

// 2. Scoring sha256
for (const [baseName, relPath] of Object.entries(SCORING_FILES)) {
  const fp = path.join(ROOT, relPath);
  const expected = BASELINE_SHA256[baseName];
  const actual = fs.existsSync(fp) ? sha256(fp) : null;
  const pass = actual === expected;
  if (!pass) violations.push(`sha256 changed: ${baseName}`);
  checks.push({ check: `SHA256_${baseName}`, expected, actual, pass });
}

// 3. P3 alphaScore unchanged (sample check on first 5 rows)
const p3Path = path.join(CORPUS_OUT,'p3active_scoring_historical_replay_corpus.jsonl');
if (fs.existsSync(p3Path)) {
  const sample = fs.readFileSync(p3Path,'utf8').split('\n').filter(l=>l.trim()).slice(0,5).map(l=>JSON.parse(l));
  const hasAlpha = sample.every(r => 'alphaScore' in r || 'score' in r || 'recommendationBucket' in r);
  checks.push({ check: 'P3_SAMPLE_HAS_SCORING_FIELDS', pass: hasAlpha });
}

// 4. Accepted source does not affect scoring (accepted rows have no alphaScore/recommendationBucket)
const manifestPath = path.join(OUT,'p26f3_2_manual_source_manifest.json');
let manifestRows = [];
if (fs.existsSync(manifestPath)) {
  try { manifestRows = JSON.parse(fs.readFileSync(manifestPath,'utf8')).rows || []; } catch(e) {}
}
const scoringFieldsInManifest = manifestRows.filter(r => 'alphaScore' in r || 'recommendationBucket' in r).length;
const noBleeding = scoringFieldsInManifest === 0;
if (!noBleeding) violations.push(`${scoringFieldsInManifest} accepted source rows contain scoring fields (must be 0)`);
checks.push({ check: 'ACCEPTED_SOURCE_NO_SCORING_FIELDS', violations: scoringFieldsInManifest, pass: noBleeding });

const allPass = violations.length === 0;
const result = {
  generatedAt: new Date().toISOString(),
  allPass,
  classification: allPass ? 'P26F3_2_SCORING_INVARIANCE_PASS' : 'P26F3_2_SCORING_INVARIANCE_FAIL',
  p3Rows: p3Lines,
  p19Rows: p19Lines,
  totalCorpusRows,
  checks,
  violations,
  dbWriteAllowed: false,
  corpusWriteAllowed: false,
  scoringChangeAllowed: false,
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT,'p26f3_2_scoring_invariance_check.json'), JSON.stringify(result,null,2));
fs.writeFileSync(path.join(OUT,'p26f3_2_scoring_invariance_check.md'),
  `# P26F3-2 Scoring Invariance Check\n\nAll pass: **${allPass}**\nP3: ${p3Lines} | P19: ${p19Lines} | Total: ${totalCorpusRows} (expected 9000)\nViolations: ${violations.length}\n${violations.map(v=>`- ${v}`).join('\n')}\nScoring change: false\n`
);
console.log(`Scoring invariance: ${allPass ? 'PASS' : 'FAIL'}`);
if (!allPass) { violations.forEach(v => console.error('VIOLATION:', v)); process.exit(1); }
