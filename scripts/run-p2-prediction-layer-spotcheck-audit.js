#!/usr/bin/env node
'use strict';
/**
 * P2-HARDRESET PART C — Prediction Layer Spot-check Audit
 * Produces descriptive stats for P0 corpus and observability comparison
 * against P1 baseline corpus. No investment recommendations.
 * Operates in LIMITED_NON_DISCRIMINATIVE_FIELDS mode (bucket=Neutral, score=0).
 */

const fs = require('node:fs');
const path = require('node:path');

const OUTPUT_DIR = path.join(process.cwd(), 'outputs', 'online_validation');
const AUDIT_DATE = new Date().toISOString().slice(0, 10);

const P0_PATH = path.join(OUTPUT_DIR, 'p0hardreset_historical_replay_corpus.jsonl');
const P1_PATH = path.join(OUTPUT_DIR, 'p1baseline_historical_replay_corpus.jsonl');
const FIELD_INSPECTION_PATH = path.join(OUTPUT_DIR, 'p2spotcheck_corpus_field_inspection.json');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .trim()
    .split('\n')
    .map(l => JSON.parse(l));
}

function mean(arr) {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function stddev(arr) {
  if (arr.length < 2) return null;
  const m = mean(arr);
  const variance = arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function round4(v) {
  if (v === null || v === undefined) return null;
  return Math.round(v * 10000) / 10000;
}

/** Classify returnPct into NEGATIVE / FLAT / POSITIVE */
function classifyReturn(returnPct) {
  if (returnPct === null || returnPct === undefined) return 'MISSING';
  if (returnPct < 0) return 'NEGATIVE';
  if (returnPct <= 1) return 'FLAT';
  return 'POSITIVE';
}

/** Compute descriptive stats for an array of returnPct values */
function descStats(values) {
  if (values.length === 0) return { count: 0, mean: null, median: null, min: null, max: null, stddev: null };
  return {
    count: values.length,
    mean: round4(mean(values)),
    median: round4(median(values)),
    min: round4(Math.min(...values)),
    max: round4(Math.max(...values)),
    stddev: round4(stddev(values)),
  };
}

// ─── Load data ────────────────────────────────────────────────────────────────

console.log('\n=== P2-HARDRESET PART C: Prediction Layer Spot-check Audit ===\n');

const fieldInspection = JSON.parse(fs.readFileSync(FIELD_INSPECTION_PATH, 'utf8'));
const auditMode = fieldInspection.auditMode;
console.log(`Audit mode: ${auditMode}`);
console.log(`Classification: ${fieldInspection.classification}`);

console.log('\nLoading P0 corpus...');
const p0Rows = readJsonl(P0_PATH);
console.log(`P0: ${p0Rows.length} rows`);

console.log('Loading P1 corpus...');
const p1Rows = readJsonl(P1_PATH);
console.log(`P1: ${p1Rows.length} rows`);

// ─── C.1 P0 descriptive stats by horizonDays ─────────────────────────────────

console.log('\n--- C.1 P0 Descriptive Stats by Horizon ---');

/** Group P0 rows by horizonDays (P0 has outcomeSnapshot.horizonDays) */
const p0ByHorizon = {};
let p0Missing = 0;
let p0Pending = 0;
let p0Covered = 0;

for (const row of p0Rows) {
  const os = row.outcomeSnapshot || {};
  const hz = os.horizonDays;
  const returnPct = os.returnPct;
  const priceSource = os.priceSource || 'MISSING';

  if (!hz) continue;
  if (!p0ByHorizon[hz]) p0ByHorizon[hz] = { returns: [], missing: 0, pending: 0, covered: 0, total: 0 };

  p0ByHorizon[hz].total += 1;

  if (priceSource === 'MISSING' || returnPct === undefined || returnPct === null) {
    p0ByHorizon[hz].missing += 1;
    p0Missing += 1;
  } else if (priceSource === 'PENDING') {
    p0ByHorizon[hz].pending += 1;
    p0Pending += 1;
  } else {
    p0ByHorizon[hz].returns.push(returnPct);
    p0ByHorizon[hz].covered += 1;
    p0Covered += 1;
  }
}

const p0HorizonStats = {};
for (const [hz, g] of Object.entries(p0ByHorizon).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const stats = descStats(g.returns);
  const missingRatio = round4(g.missing / g.total);
  const pendingRatio = round4(g.pending / g.total);
  const coverageRatio = round4(g.covered / g.total);

  p0HorizonStats[hz] = {
    horizonDays: Number(hz),
    totalRows: g.total,
    covered: g.covered,
    missing: g.missing,
    pending: g.pending,
    missingRatio,
    pendingRatio,
    coverageRatio,
    ...stats,
  };

  console.log(`  horizon=${hz}D: total=${g.total} covered=${g.covered} missing=${g.missing} pending=${g.pending}`);
  console.log(`    mean=${stats.mean} median=${stats.median} min=${stats.min} max=${stats.max} stddev=${stats.stddev}`);
}

// ─── C.2 (No discriminative bucket) — researchBucket distribution note ────────

const p0BucketStats = null; // all Neutral, not discriminative
const p0ScoreDeciles = null; // all zero, not discriminative

// ─── C.4 P0 vs P1 baseline comparison by horizonDays ─────────────────────────

console.log('\n--- C.4 P0 vs P1 Baseline Descriptive Comparison by Horizon ---');

/** Group P1 rows by (baselineType, horizonDays) */
const p1Groups = {};
for (const row of p1Rows) {
  const bt = row.baselineType;
  const hz = row.horizonDays;
  const returnPct = row.returnPct;
  const priceSource = row.priceSource || 'MISSING';
  const key = `${bt}|${hz}`;

  if (!p1Groups[key]) p1Groups[key] = { baselineType: bt, horizonDays: hz, returns: [], missing: 0, total: 0 };
  p1Groups[key].total += 1;
  if (priceSource === 'MISSING' || returnPct === null || returnPct === undefined) {
    p1Groups[key].missing += 1;
  } else if (priceSource !== 'PENDING') {
    p1Groups[key].returns.push(returnPct);
  }
}

const p1BaselineStats = {};
for (const [key, g] of Object.entries(p1Groups)) {
  const stats = descStats(g.returns);
  p1BaselineStats[key] = {
    baselineType: g.baselineType,
    horizonDays: g.horizonDays,
    totalRows: g.total,
    covered: g.returns.length,
    missing: g.missing,
    coverageRatio: round4(g.returns.length / g.total),
    ...stats,
  };
}

// Build comparison table per horizon
const horizons = [...new Set(p0Rows.map(r => r.outcomeSnapshot?.horizonDays).filter(Boolean))].sort((a, b) => a - b);
const baselineTypes = [...new Set(p1Rows.map(r => r.baselineType))].sort();

const comparisonByHorizon = {};
for (const hz of horizons) {
  const p0s = p0HorizonStats[hz];
  const entry = {
    horizonDays: hz,
    p0: { mean: p0s?.mean, median: p0s?.median, coverageRatio: p0s?.coverageRatio, count: p0s?.totalRows },
    baselines: {},
  };
  for (const bt of baselineTypes) {
    const key = `${bt}|${hz}`;
    const bs = p1BaselineStats[key];
    if (bs) {
      entry.baselines[bt] = { mean: bs.mean, median: bs.median, coverageRatio: bs.coverageRatio, count: bs.totalRows };
    }
  }
  comparisonByHorizon[hz] = entry;

  console.log(`  horizon=${hz}D:`);
  console.log(`    P0: mean=${p0s?.mean} median=${p0s?.median} coverage=${p0s?.coverageRatio}`);
  for (const bt of baselineTypes) {
    const key = `${bt}|${hz}`;
    const bs = p1BaselineStats[key];
    if (bs) console.log(`    ${bt}: mean=${bs.mean} median=${bs.median} coverage=${bs.coverageRatio}`);
  }
}

// ─── C.5 Confusion Matrix — horizon × realizedReturnClass ────────────────────

console.log('\n--- C.5 Horizon × Realized Return Class Matrix ---');

const returnClasses = ['NEGATIVE', 'FLAT', 'POSITIVE', 'MISSING'];
const confusionMatrix = {};

for (const hz of horizons) {
  confusionMatrix[hz] = { horizonDays: hz, NEGATIVE: 0, FLAT: 0, POSITIVE: 0, MISSING: 0, total: 0 };
}

for (const row of p0Rows) {
  const os = row.outcomeSnapshot || {};
  const hz = os.horizonDays;
  if (!hz) continue;
  const cls = classifyReturn(os.returnPct);
  confusionMatrix[hz][cls] = (confusionMatrix[hz][cls] || 0) + 1;
  confusionMatrix[hz].total += 1;
}

for (const [hz, m] of Object.entries(confusionMatrix).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const negPct = round4(m.NEGATIVE / m.total);
  const flatPct = round4(m.FLAT / m.total);
  const posPct = round4(m.POSITIVE / m.total);
  const missPct = round4(m.MISSING / m.total);
  confusionMatrix[hz].negativeRatio = negPct;
  confusionMatrix[hz].flatRatio = flatPct;
  confusionMatrix[hz].positiveRatio = posPct;
  confusionMatrix[hz].missingRatio = missPct;
  console.log(`  horizon=${hz}D: NEGATIVE=${m.NEGATIVE}(${negPct}) FLAT=${m.FLAT}(${flatPct}) POSITIVE=${m.POSITIVE}(${posPct}) MISSING=${m.MISSING}(${missPct})`);
}

// ─── Build output JSON ────────────────────────────────────────────────────────

const jsonOut = {
  auditType: 'P2_PREDICTION_LAYER_SPOTCHECK',
  auditDate: AUDIT_DATE,
  auditMode,
  classification: fieldInspection.classification,
  p0TotalRows: p0Rows.length,
  p1TotalRows: p1Rows.length,
  p0HorizonStats,
  p0BucketStats,
  p0ScoreDeciles,
  p1BaselineStats,
  comparisonByHorizon,
  confusionMatrix,
  observabilityNote: 'All results are descriptive statistics only. Not investment advice. No ROI, alpha, win-rate, or outperformance claims.',
};

const jsonPath = path.join(OUTPUT_DIR, 'p2spotcheck_prediction_layer_audit.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2), 'utf8');
console.log(`\nWrote: ${jsonPath}`);

// ─── Build Markdown ───────────────────────────────────────────────────────────

function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

function fmtN(v) {
  if (v === null || v === undefined) return '—';
  return String(v);
}

const horizonStatsRows = horizons.map(hz => {
  const s = p0HorizonStats[hz];
  if (!s) return `| ${hz}D | — | — | — | — | — | — | — | — |`;
  return `| ${hz}D | ${s.totalRows} | ${s.covered} | ${fmtPct(s.coverageRatio)} | ${fmtN(s.mean)} | ${fmtN(s.median)} | ${fmtN(s.min)} | ${fmtN(s.max)} | ${fmtN(s.stddev)} |`;
}).join('\n');

const comparisonRows = horizons.flatMap(hz => {
  const c = comparisonByHorizon[hz];
  const rows = [];
  rows.push(`| ${hz}D | P0 corpus | ${fmtN(c.p0.count)} | ${fmtN(c.p0.mean)} | ${fmtN(c.p0.median)} | ${fmtPct(c.p0.coverageRatio)} |`);
  for (const bt of baselineTypes) {
    const b = c.baselines[bt];
    if (b) rows.push(`| ${hz}D | ${bt} | ${fmtN(b.count)} | ${fmtN(b.mean)} | ${fmtN(b.median)} | ${fmtPct(b.coverageRatio)} |`);
  }
  return rows;
}).join('\n');

const confusionRows = horizons.map(hz => {
  const m = confusionMatrix[hz];
  return `| ${hz}D | ${m.NEGATIVE} (${fmtPct(m.negativeRatio)}) | ${m.FLAT} (${fmtPct(m.flatRatio)}) | ${m.POSITIVE} (${fmtPct(m.positiveRatio)}) | ${m.MISSING} (${fmtPct(m.missingRatio)}) | ${m.total} |`;
}).join('\n');

const md = `# P2-HARDRESET Prediction Layer Spot-check Audit

**Date:** ${AUDIT_DATE}
**Audit Mode:** \`${auditMode}\`
**Classification:** \`${fieldInspection.classification}\`

> **Note:** The P0 historical replay corpus was generated with the scoring engine
> in default mode — all \`researchBucket\` values are "Neutral" and all
> \`scoreSnapshot\` values are 0. Bucket and score audits are not possible.
> This audit presents return distribution and descriptive observability only.

---

## C.1 P0 Corpus — Descriptive Stats by Horizon

| Horizon | Total | Covered | Coverage | Mean returnPct | Median returnPct | Min | Max | StdDev |
|---------|-------|---------|----------|---------------|-----------------|-----|-----|--------|
${horizonStatsRows}

*returnPct values are percentages (e.g. 4.29 = +4.29%). Descriptive only.*

## C.2 Bucket Audit — NOT AVAILABLE

\`researchBucket\` field exists but has cardinality=1 (all "Neutral"). Bucket-level return distribution is not computable.

**Status:** \`P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS\`

## C.3 Score Decile Audit — NOT AVAILABLE

All \`scoreSnapshot\` fields are 0. Score decile distribution is not computable.

**Status:** \`P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS\`

## C.4 Descriptive Comparison — P0 vs P1 Baselines

*Descriptive statistics only. No outperformance, alpha, or edge claims.*

| Horizon | Corpus | N | Mean returnPct | Median returnPct | Coverage |
|---------|--------|---|---------------|-----------------|---------|
${comparisonRows}

## C.5 Horizon × Realized Return Class Distribution

*NEGATIVE: returnPct < 0, FLAT: 0 ≤ returnPct ≤ 1, POSITIVE: returnPct > 1, MISSING: no outcome data*

| Horizon | NEGATIVE | FLAT | POSITIVE | MISSING | Total |
|---------|----------|------|----------|---------|-------|
${confusionRows}

---

## Observability Statement

All results in this report are **observability-only descriptive statistics**.
- No investment recommendations are made.
- No ROI, win-rate, alpha, edge, or profit claims.
- P0 corpus reflects a historical replay with default scoring output (all Neutral / all zero).
- Bucket and score audits require a corpus regenerated with an active scoring engine.

---
*P2-HARDRESET Prediction Layer Spot-check Audit — ${AUDIT_DATE}*
`;

const mdPath = path.join(OUTPUT_DIR, 'p2spotcheck_prediction_layer_audit.md');
fs.writeFileSync(mdPath, md, 'utf8');
console.log(`Wrote: ${mdPath}`);
console.log('\nPART C complete.');
