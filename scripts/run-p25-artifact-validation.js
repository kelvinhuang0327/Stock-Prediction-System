#!/usr/bin/env node
'use strict';
/**
 * P25-HARDRESET Part I: Artifact Validation
 * Validates all P25 JSON artifacts parse cleanly and have expected top-level fields.
 * Also re-verifies frozen corpus line counts.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = 'outputs/online_validation';

const ARTIFACTS = [
  {
    file: 'p25post_migration_observability_preflight.json',
    requiredFields: ['classification', 'gateTotalCount', 'gatePassCount', 'gateFailCount'],
    expectedStatus: { field: 'classification', value: 'P25_PREFLIGHT_PASS' },
  },
  {
    file: 'p25monthly_revenue_distribution_audit.json',
    requiredFields: ['validationStatus', 'totalRows', 'rowsWithReleaseDate', 'invalidReleaseDateCount'],
    expectedStatus: { field: 'validationStatus', value: 'PASS' },
  },
  {
    file: 'p25monthly_revenue_query_gate_smoke.json',
    requiredFields: ['validationStatus', 'totalCases', 'passCount', 'failCount'],
    expectedStatus: { field: 'validationStatus', value: 'PASS' },
  },
  {
    file: 'p25active_scoring_smoke_after_migration.json',
    requiredFields: ['smokeStatus', 'totalEntries', 'passCount', 'failCount', 'partialCount'],
    expectedStatus: { field: 'smokeStatus', value: 'PASS' },
  },
  {
    file: 'p25post_migration_contract_validation.json',
    requiredFields: ['validationStatus', 'passCount', 'failCount', 'warnCount'],
    expectedStatus: { field: 'validationStatus', value: 'PASS' },
  },
];

const FROZEN_CORPORA = [
  { file: 'simulation_snapshot_corpus.jsonl', expectedLines: 60 },
  { file: 'p0hardreset_historical_replay_corpus.jsonl', expectedLines: 4500 },
  { file: 'p1baseline_historical_replay_corpus.jsonl', expectedLines: 9900 },
  { file: 'p3active_scoring_historical_replay_corpus.jsonl', expectedLines: 4500 },
  { file: 'p19active_scoring_pit_replay_corpus.jsonl', expectedLines: 4500 },
];

let pass = 0;
let fail = 0;
const results = [];

function check(id, desc, ok, detail) {
  const status = ok ? 'PASS' : 'FAIL';
  if (ok) pass++; else fail++;
  console.log(`[${status}] ${id}: ${desc} — ${detail}`);
  results.push({ id, desc, status, detail });
}

console.log('P25-HARDRESET: Part I — Artifact Validation');
console.log(`Generated: ${new Date().toISOString()}\n`);

// ── JSON Artifact Checks ──────────────────────────────────────────────────
for (const artifact of ARTIFACTS) {
  const filePath = path.join(OUT_DIR, artifact.file);
  let parsed = null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    parsed = JSON.parse(raw);
    check(`JSON-PARSE-${artifact.file}`, `${artifact.file} parses as valid JSON`, true, `size=${raw.length} bytes`);
  } catch (e) {
    check(`JSON-PARSE-${artifact.file}`, `${artifact.file} parses as valid JSON`, false, String(e));
    continue;
  }

  // Required fields present
  for (const field of artifact.requiredFields) {
    const present = Object.prototype.hasOwnProperty.call(parsed, field);
    check(
      `FIELD-${artifact.file}-${field}`,
      `${artifact.file} has field '${field}'`,
      present,
      present ? `value=${JSON.stringify(parsed[field])}` : 'MISSING'
    );
  }

  // Expected status
  const { field, value } = artifact.expectedStatus;
  const actual = parsed[field];
  check(
    `STATUS-${artifact.file}`,
    `${artifact.file} ${field} = ${value}`,
    actual === value,
    `actual=${actual}`
  );

  // Disclaimer present
  const hasDisclaimer =
    JSON.stringify(parsed).toLowerCase().includes('does not constitute investment advice') ||
    JSON.stringify(parsed).toLowerCase().includes('no roi');
  check(
    `DISCLAIMER-${artifact.file}`,
    `${artifact.file} contains disclaimer`,
    hasDisclaimer,
    hasDisclaimer ? 'found' : 'MISSING'
  );
}

// ── Frozen Corpus Line Count Checks ───────────────────────────────────────
console.log('\n── Frozen Corpus Line Counts ──');
for (const corpus of FROZEN_CORPORA) {
  const filePath = path.join(OUT_DIR, corpus.file);
  let lineCount = 0;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    lineCount = content.split('\n').filter(l => l.trim().length > 0).length;
  } catch (e) {
    check(`CORPUS-${corpus.file}`, `${corpus.file} exists and readable`, false, String(e));
    continue;
  }
  check(
    `CORPUS-${corpus.file}`,
    `${corpus.file} = ${corpus.expectedLines} lines`,
    lineCount === corpus.expectedLines,
    `actual=${lineCount}`
  );
}

console.log(`\nTotal checks: ${pass + fail} | PASS: ${pass} | FAIL: ${fail}`);
const validationStatus = fail === 0 ? 'PASS' : 'FAIL';
console.log(`validationStatus: ${validationStatus}`);

const report = {
  phase: 'P25-HARDRESET',
  part: 'I',
  description: 'Artifact Validation — JSON parse, required fields, status, disclaimer, frozen corpus counts',
  generatedAt: new Date().toISOString(),
  validationStatus,
  totalChecks: pass + fail,
  passCount: pass,
  failCount: fail,
  results,
  frozenCorpora: FROZEN_CORPORA.map(c => ({ file: c.file, expectedLines: c.expectedLines })),
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.',
};

const outJson = path.join(OUT_DIR, 'p25artifact_validation.json');
fs.writeFileSync(outJson, JSON.stringify(report, null, 2));
console.log(`Written: ${outJson}`);

process.exit(fail > 0 ? 1 : 0);
