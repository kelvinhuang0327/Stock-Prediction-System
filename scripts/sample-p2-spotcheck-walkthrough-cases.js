#!/usr/bin/env node
'use strict';
/**
 * P2-HARDRESET PART D — Deterministic Walkthrough Sample Cases
 * Selects representative P0 corpus entries for human inspection.
 * Deterministic sampling only — no Math.random().
 * Observability-only. No investment recommendations.
 */

const fs = require('node:fs');
const path = require('node:path');

const OUTPUT_DIR = path.join(process.cwd(), 'outputs', 'online_validation');
const AUDIT_DATE = new Date().toISOString().slice(0, 10);

const P0_PATH = path.join(OUTPUT_DIR, 'p0hardreset_historical_replay_corpus.jsonl');

// ─── Deterministic sampling helpers ──────────────────────────────────────────

/** djb2 hash — same as NaiveBaselineShadowWriter for consistency */
function deterministicHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    const c = str.codePointAt(i);
    h = ((h << 5) + h + c) >>> 0;
  }
  return h;
}

/** Sort key for deterministic ordering: hash of duplicateKey */
function sampleSortKey(row) {
  return deterministicHash(row.duplicateKey || `${row.symbol}|${row.originalAsOfDate}`);
}

/** Classify returnPct */
function classifyReturn(returnPct) {
  if (returnPct === null || returnPct === undefined) return 'MISSING';
  if (returnPct < 0) return 'NEGATIVE';
  if (returnPct <= 1) return 'FLAT';
  return 'POSITIVE';
}

// ─── Load P0 corpus ───────────────────────────────────────────────────────────

console.log('\n=== P2-HARDRESET PART D: Deterministic Walkthrough Sample ===\n');

const p0Rows = fs.readFileSync(P0_PATH, 'utf8')
  .trim()
  .split('\n')
  .map(l => JSON.parse(l));

console.log(`P0: ${p0Rows.length} rows`);

// ─── Build enriched view ──────────────────────────────────────────────────────

const enriched = p0Rows.map(row => {
  const os = row.outcomeSnapshot || {};
  return {
    symbol: row.symbol,
    originalAsOfDate: row.originalAsOfDate,
    horizonDays: os.horizonDays,
    horizonLabel: os.horizonLabel || `${os.horizonDays}D`,
    researchBucket: row.researchBucket || 'Neutral',
    scoreSnapshotResearch: row.scoreSnapshot?.researchScore ?? 0,
    scoreSnapshotConfidence: row.scoreSnapshot?.confidenceScore ?? 0,
    scoreSnapshotTechnical: row.scoreSnapshot?.technicalScore ?? 0,
    returnPct: os.returnPct ?? null,
    returnClass: classifyReturn(os.returnPct),
    entryPrice: row.closePriceAtPrediction ?? null,
    entryPriceSource: row.entryPriceSource || 'UNKNOWN',
    outcomePrice: os.outcomeClose ?? null,
    outcomeDate: os.outcomeDate || null,
    priceSource: os.priceSource || 'MISSING',
    outcomeAvailable: os.outcomeAvailable ?? false,
    duplicateKey: row.duplicateKey,
    sortKey: sampleSortKey(row),
    limitations: [
      'researchBucket=Neutral (default, not discriminative)',
      'scoreSnapshot all-zero (default, scoring engine not run in this corpus)',
    ],
  };
});

// ─── Sampling strategy ────────────────────────────────────────────────────────
// Since bucket is always Neutral and score is always 0, we use:
// - 10 samples per horizon (5D, 20D, 60D)
// - Distribute across return classes: POSITIVE, FLAT, NEGATIVE, MISSING
// - Deterministic: sort by hash, pick every Nth

const horizons = [5, 20, 60];
const returnClassTargets = ['POSITIVE', 'FLAT', 'NEGATIVE', 'MISSING'];
const PER_HORIZON = 10;
const MIN_PER_CLASS = 2; // try to include at least 2 per return class per horizon

const selectedKeys = new Set();
const samples = [];

for (const hz of horizons) {
  const horizonRows = enriched.filter(r => r.horizonDays === hz);

  // Group by return class
  const byClass = {};
  for (const cls of returnClassTargets) {
    byClass[cls] = horizonRows.filter(r => r.returnClass === cls).sort((a, b) => a.sortKey - b.sortKey);
  }

  const picked = [];

  // First pick MIN_PER_CLASS from each class
  for (const cls of returnClassTargets) {
    const candidates = byClass[cls].filter(r => !selectedKeys.has(r.duplicateKey));
    const take = Math.min(MIN_PER_CLASS, candidates.length);
    for (let i = 0; i < take; i++) {
      picked.push(candidates[i]);
      selectedKeys.add(candidates[i].duplicateKey);
    }
  }

  // Fill remaining slots deterministically from all horizon rows
  const remaining = horizonRows
    .filter(r => !selectedKeys.has(r.duplicateKey))
    .sort((a, b) => a.sortKey - b.sortKey);

  let i = 0;
  while (picked.length < PER_HORIZON && i < remaining.length) {
    picked.push(remaining[i]);
    selectedKeys.add(remaining[i].duplicateKey);
    i += 1;
  }

  // Sort picked by originalAsOfDate then symbol for readability
  picked.sort((a, b) => {
    const d = a.originalAsOfDate.localeCompare(b.originalAsOfDate);
    return d !== 0 ? d : a.symbol.localeCompare(b.symbol);
  });

  samples.push(...picked);
  console.log(`  horizon=${hz}D: selected ${picked.length} samples`);
  const classDist = picked.reduce((acc, r) => { acc[r.returnClass] = (acc[r.returnClass] || 0) + 1; return acc; }, {});
  console.log(`    returnClass distribution:`, classDist);
}

console.log(`\nTotal samples: ${samples.length}`);

// ─── Output JSON ──────────────────────────────────────────────────────────────

const jsonOut = {
  walkthroughType: 'P2_SPOTCHECK_WALKTHROUGH_CASES',
  walkthroughDate: AUDIT_DATE,
  totalCases: samples.length,
  samplingStrategy: 'deterministic-hash-based, no Math.random()',
  note: 'researchBucket and scoreSnapshot are not discriminative in this corpus (all Neutral / all zero).',
  casesByHorizon: horizons.reduce((acc, hz) => {
    acc[`${hz}D`] = samples.filter(s => s.horizonDays === hz).length;
    return acc;
  }, {}),
  cases: samples.map(s => {
    // Remove internal sort key from output
    const { sortKey, ...rest } = s;
    return rest;
  }),
};

const jsonPath = path.join(OUTPUT_DIR, 'p2spotcheck_walkthrough_cases.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2), 'utf8');
console.log(`\nWrote: ${jsonPath}`);

// ─── Output Markdown ──────────────────────────────────────────────────────────

function fmtPrice(v) { return v === null ? '—' : String(v); }
function fmtReturn(v) { return v === null ? '—' : `${v > 0 ? '+' : ''}${v}%`; }

const caseRowsByHorizon = horizons.map(hz => {
  const hSamples = samples.filter(s => s.horizonDays === hz);
  const header = `### Horizon ${hz}D (${hSamples.length} cases)\n\n| # | Symbol | asOfDate | EntryPrice | OutcomeDate | OutcomePrice | returnPct | ReturnClass | priceSource |\n|---|--------|----------|-----------|------------|-------------|----------|-------------|-------------|\n`;
  const rows = hSamples.map((s, idx) =>
    `| ${idx + 1} | ${s.symbol} | ${s.originalAsOfDate} | ${fmtPrice(s.entryPrice)} | ${s.outcomeDate || '—'} | ${fmtPrice(s.outcomePrice)} | ${fmtReturn(s.returnPct)} | ${s.returnClass} | ${s.priceSource} |`
  ).join('\n');
  return header + rows + '\n';
}).join('\n');

const md = `# P2-HARDRESET Walkthrough Sample Cases

**Date:** ${AUDIT_DATE}
**Total cases:** ${samples.length} (${horizons.map(hz => `${hz}D: ${samples.filter(s => s.horizonDays === hz).length}`).join(', ')})
**Sampling:** Deterministic (djb2 hash sort, no Math.random())

> **Limitations:** \`researchBucket\` = always "Neutral", all \`scoreSnapshot\` = 0.
> These cases are for observational inspection only — no scoring context is available.

---

${caseRowsByHorizon}

## Field Legend

| Field | Description |
|-------|-------------|
| Symbol | TWSE stock ID |
| asOfDate | Date of prediction snapshot |
| EntryPrice | closePriceAtPrediction (stockQuote.close) |
| OutcomeDate | Resolved outcome date |
| OutcomePrice | Resolved outcome close price |
| returnPct | (outcomePrice − entryPrice) / entryPrice × 100 |
| ReturnClass | NEGATIVE (<0), FLAT (0–1), POSITIVE (>1), MISSING |
| priceSource | stockQuote.close / MISSING / PENDING |

## Limitations

- All cases have \`researchBucket = Neutral\` (scoring engine default)
- All \`scoreSnapshot\` values = 0 (scoring engine not run during corpus generation)
- This corpus cannot be used to audit bucket-level or score-level calibration until regenerated with active scoring
- Results are observability-only, not investment insights

---
*P2-HARDRESET Walkthrough — ${AUDIT_DATE}. Not investment advice.*
`;

const mdPath = path.join(OUTPUT_DIR, 'p2spotcheck_walkthrough_cases.md');
fs.writeFileSync(mdPath, md, 'utf8');
console.log(`Wrote: ${mdPath}`);
console.log('\nPART D complete.');
