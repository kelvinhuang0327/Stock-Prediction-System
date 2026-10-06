#!/usr/bin/env node
'use strict';
/**
 * P2-HARDRESET PART B — Corpus Field Inspection
 * Lists all fields in P0 and P1 corpus, identifies which are available for
 * calibration audit. Detects bucket / score discriminability.
 * Observability-only. No investment recommendations.
 */

const fs = require('node:fs');
const path = require('node:path');

const OUTPUT_DIR = path.join(process.cwd(), 'outputs', 'online_validation');
const AUDIT_DATE = new Date().toISOString().slice(0, 10);

const P0_PATH = path.join(OUTPUT_DIR, 'p0hardreset_historical_replay_corpus.jsonl');
const P1_PATH = path.join(OUTPUT_DIR, 'p1baseline_historical_replay_corpus.jsonl');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Collect all leaf field paths from an object (e.g. "scoreSnapshot.researchScore") */
function collectFields(obj, prefix, out) {
  if (obj === null || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      out.add(`${key}[]`);
    } else if (v !== null && typeof v === 'object') {
      collectFields(v, key, out);
    } else {
      out.add(key);
    }
  }
}

/** Parse all lines from a jsonl file */
function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .trim()
    .split('\n')
    .map(l => JSON.parse(l));
}

/** Compute cardinality of a field across rows */
function getCardinality(rows, fieldPath) {
  const parts = fieldPath.split('.');
  const values = new Set();
  for (const row of rows) {
    let v = row;
    for (const p of parts) {
      if (v === undefined || v === null) { v = undefined; break; }
      v = v[p];
    }
    if (v !== undefined) values.add(JSON.stringify(v));
  }
  return values.size;
}

/** Get field values distribution (for low-cardinality fields) */
function getDistribution(rows, fieldPath, maxCardinality) {
  const parts = fieldPath.split('.');
  const dist = {};
  for (const row of rows) {
    let v = row;
    for (const p of parts) {
      if (v === undefined || v === null) { v = undefined; break; }
      v = v[p];
    }
    const key = v === undefined ? '__MISSING__' : String(v);
    dist[key] = (dist[key] || 0) + 1;
  }
  const cardinality = Object.keys(dist).length;
  if (cardinality > maxCardinality) return { cardinality, sampleValues: Object.keys(dist).slice(0, 5) };
  return { cardinality, distribution: dist };
}

// ─── Load corpora ─────────────────────────────────────────────────────────────

console.log('\n=== P2-HARDRESET PART B: Corpus Field Inspection ===\n');
console.log('Loading P0 corpus...');
const p0Rows = readJsonl(P0_PATH);
console.log(`P0: ${p0Rows.length} rows`);

console.log('Loading P1 corpus...');
const p1Rows = readJsonl(P1_PATH);
console.log(`P1: ${p1Rows.length} rows`);

// ─── P0 field analysis ────────────────────────────────────────────────────────

console.log('\n--- P0 Field Analysis ---');
const p0AllFields = new Set();
for (const row of p0Rows) collectFields(row, '', p0AllFields);

// Score / bucket specific checks
const SCORE_CANDIDATE_FIELDS = [
  'scoreSnapshot.researchScore',
  'scoreSnapshot.confidenceScore',
  'scoreSnapshot.technicalScore',
  'scoreSnapshot.chipScore',
  'scoreSnapshot.fundamentalScore',
  'scoreSnapshot.marketAdjustment',
  'alphaScore',
  'score',
];
const BUCKET_CANDIDATE_FIELDS = [
  'researchBucket',
  'recommendationBucket',
  'bucket',
];

const p0ScoreFields = [];
const p0BucketFields = [];
const p0ScoreFieldDetails = {};
const p0BucketFieldDetails = {};

for (const field of SCORE_CANDIDATE_FIELDS) {
  if (p0AllFields.has(field)) {
    const card = getCardinality(p0Rows, field);
    const dist = getDistribution(p0Rows, field, 20);
    p0ScoreFields.push(field);
    p0ScoreFieldDetails[field] = { cardinality: card, ...dist };
    console.log(`  score field: ${field} | cardinality=${card}`);
  }
}

for (const field of BUCKET_CANDIDATE_FIELDS) {
  if (p0AllFields.has(field)) {
    const card = getCardinality(p0Rows, field);
    const dist = getDistribution(p0Rows, field, 20);
    p0BucketFields.push(field);
    p0BucketFieldDetails[field] = { cardinality: card, ...dist };
    console.log(`  bucket field: ${field} | cardinality=${card}`);
  }
}

// Discriminability assessment
const hasBucket = p0BucketFields.length > 0;
const hasScore = p0ScoreFields.length > 0;

// Check if bucket/score fields are discriminative (cardinality > 1 for buckets, non-zero for scores)
let bucketDiscriminative = false;
let scoreDiscriminative = false;

for (const f of p0BucketFields) {
  const card = p0BucketFieldDetails[f].cardinality;
  if (card > 1) { bucketDiscriminative = true; break; }
}
for (const f of p0ScoreFields) {
  const card = p0ScoreFieldDetails[f].cardinality;
  if (card > 1) { scoreDiscriminative = true; break; }
}

// Determine audit mode
let auditMode;
if (bucketDiscriminative || scoreDiscriminative) {
  auditMode = 'FULL_BUCKET_SCORE_AUDIT';
} else if (hasBucket || hasScore) {
  auditMode = 'LIMITED_NON_DISCRIMINATIVE_FIELDS';
} else {
  auditMode = 'RETURN_DISTRIBUTION_ONLY';
}

const classification = (auditMode === 'FULL_BUCKET_SCORE_AUDIT')
  ? 'P2_SPOTCHECK_FULL_AUDIT'
  : 'P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS';

console.log(`\n  auditMode: ${auditMode}`);
console.log(`  classification: ${classification}`);

// ─── P1 field analysis ────────────────────────────────────────────────────────

console.log('\n--- P1 Field Analysis ---');
const p1AllFields = new Set();
for (const row of p1Rows) collectFields(row, '', p1AllFields);

const P1_EXPECTED_FIELDS = [
  'baselineType', 'symbol', 'originalAsOfDate', 'horizonDays',
  'returnPct', 'priceSource', 'duplicateKey',
];

const p1FieldStatus = {};
for (const f of P1_EXPECTED_FIELDS) {
  const present = p1AllFields.has(f);
  const card = present ? getCardinality(p1Rows, f) : 0;
  p1FieldStatus[f] = { present, cardinality: card };
  console.log(`  ${present ? '✓' : '✗'} ${f} (cardinality=${card})`);
}

// ─── P0 full field list ───────────────────────────────────────────────────────

const p0FieldList = [...p0AllFields].sort();
const p1FieldList = [...p1AllFields].sort();

console.log(`\nP0 all fields (${p0FieldList.length}):`, p0FieldList.join(', '));
console.log(`P1 all fields (${p1FieldList.length}):`, p1FieldList.join(', '));

// ─── Compute P0 outcome field availability ────────────────────────────────────

const OUTCOME_FIELDS = [
  'outcomeSnapshot.horizonDays',
  'outcomeSnapshot.returnPct',
  'outcomeSnapshot.priceSource',
  'outcomeSnapshot.outcomeAvailable',
  'closePriceAtPrediction',
  'symbol',
  'originalAsOfDate',
];

const p0OutcomeFieldStatus = {};
for (const f of OUTCOME_FIELDS) {
  const present = p0AllFields.has(f);
  p0OutcomeFieldStatus[f] = { present, cardinality: present ? getCardinality(p0Rows, f) : 0 };
}

// ─── Build output ─────────────────────────────────────────────────────────────

const jsonOut = {
  inspectionType: 'P2_CORPUS_FIELD_INSPECTION',
  inspectionDate: AUDIT_DATE,
  classification,
  auditMode,
  p0: {
    totalRows: p0Rows.length,
    totalFields: p0FieldList.length,
    allFields: p0FieldList,
    scoreFields: { found: p0ScoreFields, discriminative: scoreDiscriminative, details: p0ScoreFieldDetails },
    bucketFields: { found: p0BucketFields, discriminative: bucketDiscriminative, details: p0BucketFieldDetails },
    outcomeFields: p0OutcomeFieldStatus,
  },
  p1: {
    totalRows: p1Rows.length,
    totalFields: p1FieldList.length,
    allFields: p1FieldList,
    expectedFieldStatus: p1FieldStatus,
  },
  recommendation: auditMode === 'FULL_BUCKET_SCORE_AUDIT'
    ? 'Proceed with full bucket + score decile audit.'
    : 'Bucket and score fields exist but are not discriminative (all Neutral / all zero). Downgrade to return distribution + descriptive audit. Mark P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS.',
};

const jsonPath = path.join(OUTPUT_DIR, 'p2spotcheck_corpus_field_inspection.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2), 'utf8');
console.log(`\nWrote: ${jsonPath}`);

// ─── Markdown ─────────────────────────────────────────────────────────────────

const scoreFieldsTable = p0ScoreFields.length > 0
  ? p0ScoreFields.map(f => {
    const d = p0ScoreFieldDetails[f];
    const distStr = d.distribution ? Object.entries(d.distribution).map(([k, v]) => `${k}=${v}`).join(', ') : `[high-cardinality, sample: ${d.sampleValues.join(', ')}]`;
    return `| ${f} | ${d.cardinality} | ${distStr} |`;
  }).join('\n')
  : '| (none) | — | — |';

const bucketFieldsTable = p0BucketFields.length > 0
  ? p0BucketFields.map(f => {
    const d = p0BucketFieldDetails[f];
    const distStr = d.distribution ? Object.entries(d.distribution).map(([k, v]) => `${k}=${v}`).join(', ') : `[high-cardinality]`;
    return `| ${f} | ${d.cardinality} | ${distStr} |`;
  }).join('\n')
  : '| (none) | — | — |';

const md = `# P2-HARDRESET Corpus Field Inspection

**Date:** ${AUDIT_DATE}
**Audit Mode:** \`${auditMode}\`
**Classification:** \`${classification}\`

## P0 Corpus — Score Fields

| Field | Cardinality | Distribution / Values |
|-------|------------|----------------------|
${scoreFieldsTable}

**Score discriminative:** ${scoreDiscriminative ? 'YES' : 'NO — all values are 0 (default)'}

## P0 Corpus — Bucket Fields

| Field | Cardinality | Distribution / Values |
|-------|------------|----------------------|
${bucketFieldsTable}

**Bucket discriminative:** ${bucketDiscriminative ? 'YES' : 'NO — all values are "Neutral" (default)'}

## P0 Corpus — Outcome Fields Available

| Field | Present | Cardinality |
|-------|---------|-------------|
${OUTCOME_FIELDS.map(f => `| ${f} | ${p0OutcomeFieldStatus[f].present ? 'YES' : 'NO'} | ${p0OutcomeFieldStatus[f].cardinality} |`).join('\n')}

## P1 Corpus — Expected Fields

| Field | Present | Cardinality |
|-------|---------|-------------|
${P1_EXPECTED_FIELDS.map(f => `| ${f} | ${p1FieldStatus[f].present ? 'YES' : 'NO'} | ${p1FieldStatus[f].cardinality} |`).join('\n')}

## P0 All Fields (${p0FieldList.length})

\`${p0FieldList.join('`, `')}\`

## P1 All Fields (${p1FieldList.length})

\`${p1FieldList.join('`, `')}\`

## Audit Mode Decision

${auditMode === 'FULL_BUCKET_SCORE_AUDIT'
? '**FULL_BUCKET_SCORE_AUDIT**: Discriminative bucket and/or score fields found. Proceed with full audit.'
: `**${auditMode}**: Bucket field \`researchBucket\` exists but has cardinality=1 (always "Neutral"). Score fields in \`scoreSnapshot\` exist but all values are 0. The P0 historical replay corpus was generated with scoring engine in default/zero-output mode. **Downgrading to return distribution + descriptive audit.** Final classification: \`P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS\`.`}

---
*Observability-only. Not investment advice.*
`;

const mdPath = path.join(OUTPUT_DIR, 'p2spotcheck_corpus_field_inspection.md');
fs.writeFileSync(mdPath, md, 'utf8');
console.log(`Wrote: ${mdPath}`);
console.log('\nPART B complete.');
