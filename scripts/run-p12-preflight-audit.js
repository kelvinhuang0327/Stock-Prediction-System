'use strict';
/**
 * scripts/run-p12-preflight-audit.js
 * PART A — P12-HARDRESET Pre-flight Audit
 *
 * Verifies all prerequisite artifacts exist with correct state.
 * NO scoring changes. NO corpus modifications. NO investment claims.
 */
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true } });
require('tsconfig-paths').register({ baseUrl: __dirname + '/../', paths: { '@/*': ['src/*'] } });

const fs = require('fs');
const path = require('path');

const OUT = 'outputs/online_validation';
const NOW = '2026-05-12';

function lineCnt(p) {
  return fs.readFileSync(p, 'utf8').trim().split('\n').length;
}

function checkArtifact(p) {
  const exists = fs.existsSync(p);
  return { path: p, exists, sizeBytes: exists ? fs.statSync(p).size : 0 };
}

const requiredArtifacts = [
  `${OUT}/p6lite_bucket_contract_freeze.json`,
  `${OUT}/p6lite_bucket_contract_freeze.md`,
  `${OUT}/p8preflight_signal_reason_diagnosis.json`,
  `${OUT}/p8preflight_signal_reason_diagnosis.md`,
  `${OUT}/p5walkthrough_review.json`,
  `${OUT}/p4calibration_full_audit.json`,
  `${OUT}/p3active_scoring_historical_replay_corpus.jsonl`,
  `${OUT}/p1baseline_historical_replay_corpus.jsonl`,
  `${OUT}/simulation_snapshot_corpus.jsonl`,
];

const artifactChecks = requiredArtifacts.map(checkArtifact);
const allExist = artifactChecks.every(c => c.exists);

// Corpus counts
const corpusCounts = {
  simulation: { path: `${OUT}/simulation_snapshot_corpus.jsonl`, expected: 60 },
  p0: { path: `${OUT}/p0hardreset_historical_replay_corpus.jsonl`, expected: 4500 },
  p1: { path: `${OUT}/p1baseline_historical_replay_corpus.jsonl`, expected: 9900 },
  p3: { path: `${OUT}/p3active_scoring_historical_replay_corpus.jsonl`, expected: 4500 },
};
const corpusChecks = {};
for (const [key, spec] of Object.entries(corpusCounts)) {
  if (fs.existsSync(spec.path)) {
    const actual = lineCnt(spec.path);
    corpusChecks[key] = { path: spec.path, expected: spec.expected, actual, ok: actual === spec.expected };
  } else {
    corpusChecks[key] = { path: spec.path, expected: spec.expected, actual: 0, ok: false, missing: true };
  }
}

// P6-LITE verdict check
const p6d = JSON.parse(fs.readFileSync(`${OUT}/p6lite_bucket_schema_diagnosis.json`, 'utf8'));
const cf = JSON.parse(fs.readFileSync(`${OUT}/p6lite_bucket_contract_freeze.json`, 'utf8'));
const p8 = JSON.parse(fs.readFileSync(`${OUT}/p8preflight_signal_reason_diagnosis.json`, 'utf8'));

const p6VerdictOk = p6d.finalVerdict === 'BY_DESIGN_BOUNDARY';
const cfHasCanonical = !!cf.canonicalBucketLabels;
const cfHasNonGoals = !!cf.nonGoals;
const p8CaseCount = p8.cases ? p8.cases.length : 0;
const p8CasesOk = p8CaseCount === 24;

// P3 mock-deterministic check
const p3Rows = fs.readFileSync(`${OUT}/p3active_scoring_historical_replay_corpus.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const mockDeterministicCount = p3Rows.filter(r => r.priceSource === 'mock-deterministic').length;
const noMockDeterministic = mockDeterministicCount === 0;

// Forbidden claims scan
const FORBIDDEN_PATTERNS = [
  { pattern: /\bROI\b/i, label: 'ROI' },
  { pattern: /win[\s-]rate/i, label: 'win-rate' },
  { pattern: /\balpha\b(?!\s*Score)/i, label: 'alpha (non-alphaScore)' },
  { pattern: /\bedge\b/i, label: 'edge' },
  { pattern: /\bprofit\b/i, label: 'profit' },
  { pattern: /\boutperform\b/i, label: 'outperform' },
  { pattern: /\bbeat\b/i, label: 'beat' },
  { pattern: /\bbuy\b/i, label: 'buy' },
  { pattern: /\bsell\b/i, label: 'sell' },
  { pattern: /\bguaranteed\b/i, label: 'guaranteed' },
  { pattern: /investment\s+recommendation/i, label: 'investment recommendation' },
];
function scanForbidden(text) {
  const hits = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (/disclaimer/i.test(line)) continue;
    for (const fp of FORBIDDEN_PATTERNS) {
      if (fp.pattern.test(line)) {
        if (fp.label === 'alpha (non-alphaScore)' && /alphaScore/i.test(line)) continue;
        hits.push({ line: line.trim().slice(0, 80), matched: fp.label });
      }
    }
  }
  return hits;
}

// Overall status
const allCorpusOk = Object.values(corpusChecks).every(c => c.ok);
const preflightPassed = allExist && p6VerdictOk && cfHasCanonical && cfHasNonGoals && p8CasesOk && allCorpusOk && noMockDeterministic;

const report = {
  generatedAt: `${NOW}T00:00:00.000Z`,
  disclaimer: 'Pre-flight audit only. No investment recommendations. No scoring changes. No corpus modifications.',
  phase: 'P12-HARDRESET',
  preflightStatus: preflightPassed ? 'PASS' : 'FAIL',
  artifactChecks: artifactChecks,
  corpusChecks,
  stateChecks: {
    p6FinalVerdict: p6d.finalVerdict,
    p6VerdictOk,
    contractFreeze: { canonicalBucketLabels: cfHasCanonical, nonGoals: cfHasNonGoals },
    p8CaseCount,
    p8CasesOk,
    p3MockDeterministicCount: mockDeterministicCount,
    noMockDeterministic,
  },
  summary: preflightPassed
    ? 'All pre-flight checks passed. P12-HARDRESET may proceed.'
    : 'One or more pre-flight checks failed. Review artifactChecks and stateChecks.',
};

fs.writeFileSync(`${OUT}/p12pit_feature_contract_preflight_audit.json`, JSON.stringify(report, null, 2));

const md = `# P12-HARDRESET Pre-flight Audit

**Date:** ${NOW}  
**Status:** ${report.preflightStatus}  
**Phase:** P12-HARDRESET

> **Disclaimer:** Pre-flight audit only. No investment recommendations. No scoring changes. No corpus modifications.

## Artifact Checks

| File | Exists | Size |
|------|--------|------|
${artifactChecks.map(c => `| ${path.basename(c.path)} | ${c.exists ? '✅' : '❌'} | ${c.sizeBytes} bytes |`).join('\n')}

## Corpus Line Counts

| Corpus | Expected | Actual | Status |
|--------|----------|--------|--------|
${Object.entries(corpusChecks).map(([k, v]) => `| ${k} | ${v.expected} | ${v.actual} | ${v.ok ? '✅' : '❌'} |`).join('\n')}

## State Checks

| Check | Result | Status |
|-------|--------|--------|
| P6 finalVerdict | ${p6d.finalVerdict} | ${p6VerdictOk ? '✅' : '❌'} |
| CF canonicalBucketLabels | ${cfHasCanonical} | ${cfHasCanonical ? '✅' : '❌'} |
| CF nonGoals | ${cfHasNonGoals} | ${cfHasNonGoals ? '✅' : '❌'} |
| P8 case count | ${p8CaseCount}/24 | ${p8CasesOk ? '✅' : '❌'} |
| P3 mock-deterministic | ${mockDeterministicCount} | ${noMockDeterministic ? '✅' : '❌'} |

## Summary

${report.summary}
`;

fs.writeFileSync(`${OUT}/p12pit_feature_contract_preflight_audit.md`, md);

console.log('PREFLIGHT STATUS:', report.preflightStatus);
console.log('Output: p12pit_feature_contract_preflight_audit.json + .md');
if (!preflightPassed) process.exit(1);
