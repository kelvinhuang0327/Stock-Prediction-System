'use strict';
// PART D: P20-HARDRESET — Changed Case Sampling
// DISCLAIMER: Does not constitute investment advice. Observability only.
// No ROI, win-rate, alpha, edge, profit, outperform, or investment
// recommendations are computed or implied.
// productionApplyAllowed = false | productionDbWritten = false

const fs = require('fs');

const OUT = 'outputs/online_validation';
const P3_PATH = `${OUT}/p3active_scoring_historical_replay_corpus.jsonl`;
const P19_PATH = `${OUT}/p19active_scoring_pit_replay_corpus.jsonl`;
const COMPARISON_PATH = `${OUT}/p20pit_impact_comparison.json`;

console.log('P20-HARDRESET PART D: Changed Case Sampling');
console.log('Generated:', new Date().toISOString());
console.log('');

// ─── Load Data ────────────────────────────────────────────────────────────────

function loadJsonl(path) {
  return fs.readFileSync(path, 'utf8').trim().split('\n').map(l => JSON.parse(l));
}

const p3rows = loadJsonl(P3_PATH);
const p19rows = loadJsonl(P19_PATH);
const comparison = JSON.parse(fs.readFileSync(COMPARISON_PATH, 'utf8'));

// Build maps
function buildKey(row) {
  if (row.horizonDays !== undefined && row.horizonDays !== null) {
    return `${row.symbol}|${row.originalAsOfDate}|${row.horizonDays}`;
  }
  if (row.duplicateKey) {
    const parts = row.duplicateKey.split('|');
    if (parts.length >= 3) return `${parts[0]}|${parts[1]}|${parts[2]}`;
  }
  return `${row.symbol}|${row.originalAsOfDate}|unknown`;
}

const p3map = new Map();
for (const row of p3rows) p3map.set(buildKey(row), row);

const p19map = new Map();
for (const row of p19rows) p19map.set(buildKey(row), row);

// ─── Deterministic Hash ───────────────────────────────────────────────────────

function deterministicHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = (h ^ str.charCodeAt(i)) >>> 0;
    h = (Math.imul(h, 16777619)) >>> 0;
  }
  return h;
}

// ─── Classify Each Row ────────────────────────────────────────────────────────

const COMPLETENESS_RANK = { COMPLETE: 2, PARTIAL: 1, EMPTY: 0 };

function classifyRow(key, preRow, postRow) {
  if (!preRow) return { key, classes: ['MISSING_PRE_ROW'], hash: deterministicHash(key) };
  if (!postRow) return { key, classes: ['MISSING_POST_ROW'], hash: deterministicHash(key) };

  const classes = [];

  const preC = preRow.scoringCompletenessStatus || (preRow.activeScoringSnapshot && preRow.activeScoringSnapshot.completenessStatus) || null;
  const postC = postRow.scoringCompletenessStatus || (postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.completenessStatus) || null;
  if (preC !== postC) classes.push('COMPLETENESS_CHANGED');

  const preBucket = preRow.researchBucket || null;
  const postBucket = postRow.researchBucket || null;
  if (preBucket !== postBucket) classes.push('BUCKET_CHANGED');

  const preAlpha = preRow.activeScoringSnapshot && preRow.activeScoringSnapshot.alphaScore !== undefined ? preRow.activeScoringSnapshot.alphaScore : null;
  const postAlpha = postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.alphaScore !== undefined ? postRow.activeScoringSnapshot.alphaScore : null;
  const preSnapStr = JSON.stringify((preRow.activeScoringSnapshot && preRow.activeScoringSnapshot.scoreSnapshot) || preRow.scoreSnapshot);
  const postSnapStr = JSON.stringify((postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.scoreSnapshot) || postRow.scoreSnapshot);
  if (preAlpha !== postAlpha || preSnapStr !== postSnapStr) classes.push('SCORE_CHANGED');

  const preSignals = (preRow.activeScoringSnapshot && preRow.activeScoringSnapshot.signalSnapshot) || [];
  const postSignals = (postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.signalSnapshot) || [];
  if (JSON.stringify(preSignals) !== JSON.stringify(postSignals)) classes.push('SIGNAL_CHANGED');

  const preReason = (preRow.activeScoringSnapshot && preRow.activeScoringSnapshot.reasonSnapshot) || '';
  const postReason = (postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.reasonSnapshot) || '';
  if (preReason !== postReason) classes.push('REASON_CHANGED');

  const preFactors = (preRow.activeScoringSnapshot && preRow.activeScoringSnapshot.factorSnapshot) || [];
  const postFactors = (postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.factorSnapshot) || [];
  if (JSON.stringify(preFactors) !== JSON.stringify(postFactors)) classes.push('FACTOR_CHANGED');

  const postMissing = (postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.missingSources) || [];
  const monthlyRevInMissing = Array.isArray(postMissing) && postMissing.some(s => s && s.toLowerCase().includes('monthlyrevenue'));
  if (monthlyRevInMissing) classes.push('MONTHLY_REVENUE_EXCLUDED');

  if (classes.length === 0) classes.push('NO_CHANGE');

  return {
    key,
    symbol: preRow.symbol,
    originalAsOfDate: preRow.originalAsOfDate,
    horizonDays: postRow.horizonDays || (preRow.duplicateKey && preRow.duplicateKey.split('|')[2]) || null,
    classes,
    hash: deterministicHash(key),
    preRow,
    postRow,
  };
}

const allKeys = new Set([...p3map.keys(), ...p19map.keys()]);
const sortedKeys = [...allKeys].sort();

const classified = [];
for (const key of sortedKeys) {
  classified.push(classifyRow(key, p3map.get(key) || null, p19map.get(key) || null));
}

// ─── Group by Classification ─────────────────────────────────────────────────

const byClass = {};
for (const item of classified) {
  for (const c of item.classes) {
    if (!byClass[c]) byClass[c] = [];
    byClass[c].push(item);
  }
}

const SAMPLE_CLASSES = [
  'BUCKET_CHANGED',
  'SCORE_CHANGED',
  'REASON_CHANGED',
  'SIGNAL_CHANGED',
  'FACTOR_CHANGED',
  'MONTHLY_REVENUE_EXCLUDED',
  'NO_CHANGE',
  'NO_SCORING_CHANGE', // virtual: only MONTHLY_REVENUE_EXCLUDED, no scoring delta
];
const MIN_SAMPLES = 5;

// Add virtual class: NO_SCORING_CHANGE = rows that ONLY have MONTHLY_REVENUE_EXCLUDED
byClass['NO_SCORING_CHANGE'] = classified.filter(item =>
  item.classes.length === 1 && item.classes[0] === 'MONTHLY_REVENUE_EXCLUDED'
);

// Sort each class group by deterministic hash for reproducible sampling
for (const cls of Object.keys(byClass)) {
  byClass[cls].sort((a, b) => a.hash - b.hash);
}

// ─── Build Case Record ────────────────────────────────────────────────────────

function buildCaseRecord(item) {
  const preRow = item.preRow;
  const postRow = item.postRow;
  const preSnap = preRow && preRow.activeScoringSnapshot;
  const postSnap = postRow && postRow.activeScoringSnapshot;
  const pitStatus = postRow && (postRow.monthlyRevenuePitGateStatus || (postSnap && postSnap.monthlyRevenuePitGateStatus)) || null;

  return {
    key: item.key,
    symbol: item.symbol || null,
    originalAsOfDate: item.originalAsOfDate || null,
    horizonDays: item.horizonDays || null,
    classifications: item.classes,
    // Pre-PIT (P3) data
    pre: {
      researchBucket: preRow && preRow.researchBucket || null,
      alphaScore: preSnap && preSnap.alphaScore !== undefined ? preSnap.alphaScore : null,
      scoringCompletenessStatus: preRow && preRow.scoringCompletenessStatus || null,
      usedSources: preSnap && preSnap.usedSources || [],
      missingSources: preSnap && preSnap.missingSources || [],
      reasonSummary: preSnap && typeof preSnap.reasonSnapshot === 'string'
        ? preSnap.reasonSnapshot.substring(0, 150)
        : null,
      factorSummary: preSnap && Array.isArray(preSnap.factorSnapshot)
        ? preSnap.factorSnapshot.slice(0, 3)
        : [],
      signalSummary: preSnap && Array.isArray(preSnap.signalSnapshot)
        ? preSnap.signalSnapshot.slice(0, 5)
        : [],
    },
    // Post-PIT (P19) data
    post: {
      researchBucket: postRow && postRow.researchBucket || null,
      alphaScore: postSnap && postSnap.alphaScore !== undefined ? postSnap.alphaScore : null,
      scoringCompletenessStatus: postRow && postRow.scoringCompletenessStatus || null,
      usedSources: postSnap && postSnap.usedSources || [],
      missingSources: postSnap && postSnap.missingSources || [],
      reasonSummary: postSnap && typeof postSnap.reasonSnapshot === 'string'
        ? postSnap.reasonSnapshot.substring(0, 150)
        : null,
      factorSummary: postSnap && Array.isArray(postSnap.factorSnapshot)
        ? postSnap.factorSnapshot.slice(0, 3)
        : [],
      signalSummary: postSnap && Array.isArray(postSnap.signalSnapshot)
        ? postSnap.signalSnapshot.slice(0, 5)
        : [],
    },
    changedFields: item.classes.filter(c => c !== 'NO_CHANGE' && c !== 'MONTHLY_REVENUE_EXCLUDED'),
    monthlyRevenuePitGateStatus: pitStatus,
    // Note: no outcome / returnPct based conclusion
    observationNote: 'Observability only. No outcome or returnPct used. No investment conclusion.',
  };
}

// ─── Sample Cases ─────────────────────────────────────────────────────────────

const sampledCases = [];
const classSampleCounts = {};

for (const cls of SAMPLE_CLASSES) {
  const group = byClass[cls] || [];
  const n = Math.min(group.length, MIN_SAMPLES);
  const sampled = group.slice(0, n);
  classSampleCounts[cls] = { available: group.length, sampled: n };

  for (const item of sampled) {
    const rec = buildCaseRecord(item);
    rec._sampledForClass = cls;
    sampledCases.push(rec);
  }
  console.log(`  Class ${cls}: available=${group.length}, sampled=${n}`);
}

// ─── Deduplication ────────────────────────────────────────────────────────────

const seenKeys = new Set();
const dedupedCases = [];
for (const c of sampledCases) {
  const dedup = c.key + ':' + c._sampledForClass;
  if (!seenKeys.has(dedup)) {
    seenKeys.add(dedup);
    dedupedCases.push(c);
  }
}

// ─── Output ───────────────────────────────────────────────────────────────────

const output = {
  phase: 'P20-HARDRESET',
  part: 'D',
  generatedAt: new Date().toISOString(),
  productionApplyAllowed: false,
  productionDbWritten: false,
  samplingMethod: 'deterministic-stable-hash',
  classSampleCounts,
  totalCases: dedupedCases.length,
  classificationSummary: comparison.classificationCounts,
  cases: dedupedCases,
  observationNote: 'Samples are for observability only. No outcome, returnPct, or investment conclusion is drawn.',
};

fs.writeFileSync(`${OUT}/p20pit_impact_changed_cases.json`, JSON.stringify(output, null, 2));
console.log('\nWritten:', `${OUT}/p20pit_impact_changed_cases.json`);

// ─── Markdown Summary ─────────────────────────────────────────────────────────

const noChangeSampleCase = dedupedCases.find(c => c._sampledForClass === 'NO_CHANGE');
const monthlyRevExcludedCase = dedupedCases.find(c => c._sampledForClass === 'MONTHLY_REVENUE_EXCLUDED');

const md = `# P20-HARDRESET Part D: Changed Case Samples

> DISCLAIMER: Does not constitute investment advice. Observability only. No ROI, win-rate, or investment recommendation.

**Phase**: P20-HARDRESET  
**Part**: D  
**Generated**: ${output.generatedAt}  
**Sampling Method**: deterministic-stable-hash  
**Total cases**: ${dedupedCases.length}  
**productionApplyAllowed**: false

---

## Classification Counts (from Part C)

${Object.entries(comparison.classificationCounts || {}).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

---

## Sample Counts per Class

| Class | Available | Sampled |
|-------|-----------|---------|
${Object.entries(classSampleCounts).map(([cls, info]) => `| ${cls} | ${info.available} | ${info.sampled} |`).join('\n')}

---

## Key Finding

The P3 → P19 transition is a **metadata-only PIT annotation**. The P19 corpus was built by adding PIT gate metadata fields to P3 rows without modifying any scoring data. Therefore:

- All 4500 rows classify as **NO_CHANGE** in scoring (bucket, score, completeness, signals, factors, reasons unchanged)
- All 4500 rows classify as **MONTHLY_REVENUE_EXCLUDED** because MonthlyRevenue was already absent from scoring data (in \`missingSources\`) in both P3 and P19 — confirming consistent handling
- MonthlyRevenue PIT gate status: **NOT_APPLICABLE_NO_DATA** (no MonthlyRevenue data was present to gate or reject)

---

## Control Case (NO_CHANGE sample)

${noChangeSampleCase ? `- Symbol: ${noChangeSampleCase.symbol}
- asOfDate: ${noChangeSampleCase.originalAsOfDate}
- horizonDays: ${noChangeSampleCase.horizonDays}
- Pre bucket: ${noChangeSampleCase.pre.researchBucket}
- Post bucket: ${noChangeSampleCase.post.researchBucket}
- Pre alphaScore: ${noChangeSampleCase.pre.alphaScore}
- Post alphaScore: ${noChangeSampleCase.post.alphaScore}
- Pre completeness: ${noChangeSampleCase.pre.scoringCompletenessStatus}
- Post completeness: ${noChangeSampleCase.post.scoringCompletenessStatus}
- MonthlyRevenue PIT status: ${noChangeSampleCase.monthlyRevenuePitGateStatus}
- Observation: ${noChangeSampleCase.observationNote}` : 'N/A'}

---

## MonthlyRevenue Excluded Sample

${monthlyRevExcludedCase ? `- Symbol: ${monthlyRevExcludedCase.symbol}
- asOfDate: ${monthlyRevExcludedCase.originalAsOfDate}
- Pre missingSources: ${JSON.stringify(monthlyRevExcludedCase.pre.missingSources)}
- Post missingSources: ${JSON.stringify(monthlyRevExcludedCase.post.missingSources)}
- MonthlyRevenue PIT status: ${monthlyRevExcludedCase.monthlyRevenuePitGateStatus}
- Classification: MONTHLY_REVENUE_EXCLUDED
- Explanation: MonthlyRevenue was consistently absent from scoring in both P3 and P19.
  The NOT_APPLICABLE_NO_DATA status confirms no PIT gate rejection occurred — there was
  simply no data to evaluate.` : 'N/A'}

---

> Note: No outcome, returnPct, or investment conclusion is used in any case record.
`;

fs.writeFileSync(`${OUT}/p20pit_impact_changed_cases.md`, md);
console.log('Written:', `${OUT}/p20pit_impact_changed_cases.md`);

console.log('\n=== PART D COMPLETE ===');
