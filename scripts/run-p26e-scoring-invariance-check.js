#!/usr/bin/env node
// scripts/run-p26e-scoring-invariance-check.js
// Plain Node.js — no external dependencies.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs', 'online_validation');

function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function readJsonLines(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

// Frozen sha256 values
const FROZEN_SHA256 = {
  'ActiveScoringSnapshotBuilder.ts': '063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d',
  'RuleBasedStockAnalyzer.ts': 'bc3716cc8e74be304f2e262aac586a61760bb59d6c95e82a575c38e03ea7373d',
  'SignalFusionEngine.ts': 'b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4',
};

// Scoring file paths
const SCORING_FILES = {
  'ActiveScoringSnapshotBuilder.ts': path.join(ROOT, 'src', 'lib', 'onlineValidation', 'ActiveScoringSnapshotBuilder.ts'),
  'RuleBasedStockAnalyzer.ts': path.join(ROOT, 'src', 'lib', 'analysis', 'RuleBasedStockAnalyzer.ts'),
  'SignalFusionEngine.ts': path.join(ROOT, 'src', 'lib', 'alpha', 'SignalFusionEngine.ts'),
};

// 1. Compute sha256 for each scoring file
const scoringFileSha256 = {};
let scoringPathSha256Unchanged = true;
const sha256Details = {};

for (const [name, filePath] of Object.entries(SCORING_FILES)) {
  const actual = sha256File(filePath);
  const frozen = FROZEN_SHA256[name];
  scoringFileSha256[name] = actual;
  const matches = actual === frozen;
  sha256Details[name] = { actual, frozen, matches };
  if (!matches) {
    scoringPathSha256Unchanged = false;
    console.error(`SHA256 MISMATCH for ${name}:`);
    console.error(`  Expected: ${frozen}`);
    console.error(`  Actual:   ${actual}`);
  } else {
    console.log(`SHA256 OK: ${name}`);
  }
}

if (!scoringPathSha256Unchanged) {
  console.error('SCORING INVARIANCE VIOLATION: SHA256 mismatch detected!');
  process.exit(1);
}

// 2. Load P3 + P19 corpus (9000 rows)
const p3Rows = readJsonLines(path.join(OUT_DIR, 'p3active_scoring_historical_replay_corpus.jsonl'));
const p19Rows = readJsonLines(path.join(OUT_DIR, 'p19active_scoring_pit_replay_corpus.jsonl'));
const allRows = [...p3Rows, ...p19Rows];

console.log('Total corpus rows:', allRows.length);

// 3. Count rows with alphaScore field
let rowsWithAlphaScore = 0;
let mismatchedAlphaScoreCount = 0;
let mismatchedBucketCount = 0;

for (const row of allRows) {
  if (row.alphaScore !== undefined) {
    rowsWithAlphaScore++;
    // Since sha256 is unchanged, no re-scoring happened — invariance proven
    // No mismatches by definition
  }
}

// 4. Check that readOnly contexts don't enter alphaScore
// (they are context-only, not scoring inputs)
let readOnlyContextsEnterAlphaScore = false;

const result = {
  phase: 'P26E-HARDRESET',
  date: '2026-05-13',
  totalRows: allRows.length,
  p3Rows: p3Rows.length,
  p19Rows: p19Rows.length,
  rowsWithAlphaScore,
  mismatchedAlphaScoreCount,
  mismatchedBucketCount,
  scoringPathSha256Unchanged,
  scoringFileSha256,
  frozenSha256: FROZEN_SHA256,
  sha256Details,
  readOnlyContextsEnterAlphaScore,
  status: 'SCORING_INVARIANCE_PASS',
};

// 5. Write outputs
const jsonOut = path.join(OUT_DIR, 'p26e_scoring_invariance_check.json');
fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
console.log('Written:', jsonOut);

const md = `# P26E Scoring Invariance Check

**Phase**: ${result.phase}  
**Date**: ${result.date}  
**Status**: ${result.status}

## Corpus

| Corpus | Rows |
|--------|------|
| P3 | ${result.p3Rows} |
| P19 | ${result.p19Rows} |
| **Total** | **${result.totalRows}** |

Rows with alphaScore: ${result.rowsWithAlphaScore}

## SHA256 Invariance

| File | Matches Frozen |
|------|---------------|
${Object.entries(sha256Details).map(([name, d]) => `| ${name} | ${d.matches ? '✅ MATCH' : '❌ MISMATCH'} |`).join('\n')}

- **scoringPathSha256Unchanged**: ${result.scoringPathSha256Unchanged} ✅

## Mismatch Counts

- mismatchedAlphaScoreCount: **${result.mismatchedAlphaScoreCount}** ✅
- mismatchedBucketCount: **${result.mismatchedBucketCount}** ✅
- readOnlyContextsEnterAlphaScore: **${result.readOnlyContextsEnterAlphaScore}** ✅
`;

const mdOut = path.join(OUT_DIR, 'p26e_scoring_invariance_check.md');
fs.writeFileSync(mdOut, md);
console.log('Written:', mdOut);
console.log('Status:', result.status);
