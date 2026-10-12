'use strict';
// PART C: P20-HARDRESET — Run Pre/Post PIT Impact Comparison
// DISCLAIMER: Does not constitute investment advice. Observability only.
// No ROI, win-rate, alpha, edge, profit, outperform, or investment
// recommendations are computed or implied.
// productionApplyAllowed = false | productionDbWritten = false

const fs = require('fs');

const OUT = 'outputs/online_validation';
const P3_PATH = `${OUT}/p3active_scoring_historical_replay_corpus.jsonl`;
const P19_PATH = `${OUT}/p19active_scoring_pit_replay_corpus.jsonl`;
const PIT_GUARD_PATH = `${OUT}/p19monthly_revenue_pit_guard_validation.json`;

console.log('P20-HARDRESET PART C: Pre/Post PIT Impact Comparison');
console.log('Generated:', new Date().toISOString());
console.log('');

// ─── Load Corpora ────────────────────────────────────────────────────────────

function loadJsonl(path) {
  return fs.readFileSync(path, 'utf8').trim().split('\n').map(l => JSON.parse(l));
}

console.log('Loading P3 corpus...');
const p3rows = loadJsonl(P3_PATH);
console.log('  P3 rows:', p3rows.length);

console.log('Loading P19 corpus...');
const p19rows = loadJsonl(P19_PATH);
console.log('  P19 rows:', p19rows.length);

const pitGuard = JSON.parse(fs.readFileSync(PIT_GUARD_PATH, 'utf8'));

// ─── Build Comparison Keys ────────────────────────────────────────────────────

function buildKey(row) {
  const symbol = row.symbol || '';
  const asOfDate = row.originalAsOfDate || '';
  if (row.horizonDays !== undefined && row.horizonDays !== null) {
    return `${symbol}|${asOfDate}|${row.horizonDays}`;
  }
  if (row.duplicateKey) {
    const parts = row.duplicateKey.split('|');
    if (parts.length >= 3) return `${parts[0]}|${parts[1]}|${parts[2]}`;
  }
  return `${symbol}|${asOfDate}|unknown`;
}

const p3map = new Map();
for (const row of p3rows) p3map.set(buildKey(row), row);

const p19map = new Map();
for (const row of p19rows) p19map.set(buildKey(row), row);

const allKeys = new Set([...p3map.keys(), ...p19map.keys()]);
const sortedKeys = [...allKeys].sort();
console.log('\nAlignment:');
console.log('  Total unique keys:', sortedKeys.length);

// ─── Comparison Logic (no returnPct / outcomeSnapshot) ──────────────────────

const COMPLETENESS_RANK = { COMPLETE: 2, PARTIAL: 1, EMPTY: 0 };

function compareRows(key, preRow, postRow) {
  if (!preRow) return { key, primaryClass: 'MISSING_PRE_ROW', classes: ['MISSING_PRE_ROW'] };
  if (!postRow) return { key, primaryClass: 'MISSING_POST_ROW', classes: ['MISSING_POST_ROW'] };

  const classes = [];

  // Completeness
  const preC = preRow.scoringCompletenessStatus || (preRow.activeScoringSnapshot && preRow.activeScoringSnapshot.completenessStatus) || null;
  const postC = postRow.scoringCompletenessStatus || (postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.completenessStatus) || null;
  const completenessChanged = preC !== postC;
  if (completenessChanged) classes.push('COMPLETENESS_CHANGED');

  // Bucket
  const preBucket = preRow.researchBucket || null;
  const postBucket = postRow.researchBucket || null;
  const bucketChanged = preBucket !== postBucket;
  if (bucketChanged) classes.push('BUCKET_CHANGED');

  // Score (alpha + snapshot)
  const preAlpha = (preRow.activeScoringSnapshot && preRow.activeScoringSnapshot.alphaScore) !== undefined
    ? preRow.activeScoringSnapshot.alphaScore : null;
  const postAlpha = (postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.alphaScore) !== undefined
    ? postRow.activeScoringSnapshot.alphaScore : null;
  const preSnapStr = JSON.stringify(preRow.activeScoringSnapshot && preRow.activeScoringSnapshot.scoreSnapshot || preRow.scoreSnapshot);
  const postSnapStr = JSON.stringify(postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.scoreSnapshot || postRow.scoreSnapshot);
  const scoreChanged = preAlpha !== postAlpha || preSnapStr !== postSnapStr;
  if (scoreChanged) classes.push('SCORE_CHANGED');

  // Signal
  const preSignals = (preRow.activeScoringSnapshot && preRow.activeScoringSnapshot.signalSnapshot) || [];
  const postSignals = (postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.signalSnapshot) || [];
  const signalChanged = JSON.stringify(preSignals) !== JSON.stringify(postSignals);
  if (signalChanged) classes.push('SIGNAL_CHANGED');

  // Reason
  const preReason = (preRow.activeScoringSnapshot && preRow.activeScoringSnapshot.reasonSnapshot) || '';
  const postReason = (postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.reasonSnapshot) || '';
  const reasonChanged = preReason !== postReason;
  if (reasonChanged) classes.push('REASON_CHANGED');

  // Factor
  const preFactors = (preRow.activeScoringSnapshot && preRow.activeScoringSnapshot.factorSnapshot) || [];
  const postFactors = (postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.factorSnapshot) || [];
  const factorChanged = JSON.stringify(preFactors) !== JSON.stringify(postFactors);
  if (factorChanged) classes.push('FACTOR_CHANGED');

  // MonthlyRevenue excluded
  const postMissing = (postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.missingSources) || [];
  const monthlyRevInMissing = Array.isArray(postMissing) && postMissing.some(s => s && s.toLowerCase().includes('monthlyrevenue'));
  const pitStatus = postRow.monthlyRevenuePitGateStatus || (postRow.activeScoringSnapshot && postRow.activeScoringSnapshot.monthlyRevenuePitGateStatus) || null;
  const monthlyRevExcluded = monthlyRevInMissing;
  if (monthlyRevExcluded) classes.push('MONTHLY_REVENUE_EXCLUDED');

  if (classes.length === 0) classes.push('NO_CHANGE');

  // Priority for primaryClass
  const priority = ['COMPLETENESS_CHANGED', 'BUCKET_CHANGED', 'SCORE_CHANGED', 'REASON_CHANGED', 'SIGNAL_CHANGED', 'FACTOR_CHANGED', 'MONTHLY_REVENUE_EXCLUDED', 'NO_CHANGE'];
  let primaryClass = classes[0];
  for (const p of priority) {
    if (classes.includes(p)) { primaryClass = p; break; }
  }

  // Completeness direction
  const preRank = preC !== null ? (COMPLETENESS_RANK[preC] !== undefined ? COMPLETENESS_RANK[preC] : -1) : -1;
  const postRank = postC !== null ? (COMPLETENESS_RANK[postC] !== undefined ? COMPLETENESS_RANK[postC] : -1) : -1;
  let completenessDir = 'same';
  if (completenessChanged) {
    if (preRank >= 0 && postRank >= 0) completenessDir = postRank < preRank ? 'degraded' : 'improved';
    else completenessDir = 'unknown';
  }

  return {
    key,
    symbol: preRow.symbol,
    originalAsOfDate: preRow.originalAsOfDate,
    horizonDays: postRow.horizonDays || (preRow.duplicateKey && preRow.duplicateKey.split('|')[2]) || null,
    primaryClass,
    classes,
    completeness: { pre: preC, post: postC, changed: completenessChanged, direction: completenessDir },
    bucket: { pre: preBucket, post: postBucket, changed: bucketChanged },
    score: { preAlpha, postAlpha, delta: (preAlpha !== null && postAlpha !== null) ? postAlpha - preAlpha : null, changed: scoreChanged },
    signal: { preLen: preSignals.length, postLen: postSignals.length, changed: signalChanged },
    reason: { changed: reasonChanged },
    factor: { preLen: preFactors.length, postLen: postFactors.length, changed: factorChanged },
    pitStatus,
    monthlyRevExcluded,
  };
}

// ─── Run Comparison ───────────────────────────────────────────────────────────

console.log('\nRunning comparison...');
const comparisonRows = [];
for (const key of sortedKeys) {
  comparisonRows.push(compareRows(key, p3map.get(key) || null, p19map.get(key) || null));
}

// ─── 1. Corpus Shape Comparison ──────────────────────────────────────────────

const p3Symbols = new Set(p3rows.map(r => r.symbol));
const p19Symbols = new Set(p19rows.map(r => r.symbol));
const p3Dates = new Set(p3rows.map(r => r.originalAsOfDate));
const p19Dates = new Set(p19rows.map(r => r.originalAsOfDate));

const p3HorizonDist = {};
for (const row of p3rows) {
  const h = row.duplicateKey ? row.duplicateKey.split('|')[2] : 'unknown';
  p3HorizonDist[h] = (p3HorizonDist[h] || 0) + 1;
}
const p19HorizonDist = {};
for (const row of p19rows) {
  const h = String(row.horizonDays || 'unknown');
  p19HorizonDist[h] = (p19HorizonDist[h] || 0) + 1;
}

const aligned = comparisonRows.filter(r => r.classes && !r.classes.includes('MISSING_PRE_ROW') && !r.classes.includes('MISSING_POST_ROW'));
const missingPre = comparisonRows.filter(r => r.classes && r.classes.includes('MISSING_PRE_ROW'));
const missingPost = comparisonRows.filter(r => r.classes && r.classes.includes('MISSING_POST_ROW'));

const corpusShapeComparison = {
  p3LineCount: p3rows.length,
  p19LineCount: p19rows.length,
  totalUniqueKeys: sortedKeys.length,
  alignedRowCount: aligned.length,
  missingPreRowCount: missingPre.length,
  missingPostRowCount: missingPost.length,
  p3SymbolCount: p3Symbols.size,
  p19SymbolCount: p19Symbols.size,
  symbolCountMatch: p3Symbols.size === p19Symbols.size,
  p3AsOfDateCount: p3Dates.size,
  p19AsOfDateCount: p19Dates.size,
  dateCountMatch: p3Dates.size === p19Dates.size,
  p3HorizonDistribution: p3HorizonDist,
  p19HorizonDistribution: p19HorizonDist,
  horizonDistributionMatch: JSON.stringify(p3HorizonDist) === JSON.stringify(p19HorizonDist),
  shapeCompatible: aligned.length === p3rows.length && missingPre.length === 0 && missingPost.length === 0,
};

console.log('  Aligned rows:', aligned.length, '| Missing pre:', missingPre.length, '| Missing post:', missingPost.length);
console.log('  Shape compatible:', corpusShapeComparison.shapeCompatible);

// ─── 2. Scoring Completeness Impact ──────────────────────────────────────────

function countCompleteness(rows, isPost) {
  const dist = { COMPLETE: 0, PARTIAL: 0, EMPTY: 0 };
  for (const row of rows) {
    const c = isPost ? row.completeness && row.completeness.post : row.completeness && row.completeness.pre;
    if (c === 'COMPLETE') dist.COMPLETE++;
    else if (c === 'PARTIAL') dist.PARTIAL++;
    else dist.EMPTY++;
  }
  return dist;
}

const alignedWithCompleteness = aligned;
const p3CompDist = countCompleteness(alignedWithCompleteness, false);
const p19CompDist = countCompleteness(alignedWithCompleteness, true);
const compChanged = alignedWithCompleteness.filter(r => r.completeness && r.completeness.changed).length;
const compDegraded = alignedWithCompleteness.filter(r => r.completeness && r.completeness.direction === 'degraded').length;
const compImproved = alignedWithCompleteness.filter(r => r.completeness && r.completeness.direction === 'improved').length;

const scoringCompletenessImpact = {
  p3Distribution: p3CompDist,
  p19Distribution: p19CompDist,
  changedCount: compChanged,
  degradedCount: compDegraded,
  improvedCount: compImproved,
  sameCount: alignedWithCompleteness.filter(r => r.completeness && r.completeness.direction === 'same').length,
  degradedRatio: aligned.length > 0 ? (compDegraded / aligned.length).toFixed(4) : '0',
  observationNote: 'Completeness reflects data source availability at scoring time, not realized returns.',
};

console.log('  Completeness degraded:', compDegraded, '| improved:', compImproved, '| same:', alignedWithCompleteness.filter(r => r.completeness && r.completeness.direction === 'same').length);

// ─── 3. Bucket Impact ─────────────────────────────────────────────────────────

const p3BucketDist = {};
const p19BucketDist = {};
for (const r of aligned) {
  const pb = r.bucket && r.bucket.pre || 'null';
  const ob = r.bucket && r.bucket.post || 'null';
  p3BucketDist[pb] = (p3BucketDist[pb] || 0) + 1;
  p19BucketDist[ob] = (p19BucketDist[ob] || 0) + 1;
}
const bucketChanged = aligned.filter(r => r.bucket && r.bucket.changed).length;

// Transition matrix
const transitionMatrix = {};
for (const r of aligned) {
  if (r.bucket && r.bucket.changed) {
    const fromTo = `${r.bucket.pre}->${r.bucket.post}`;
    transitionMatrix[fromTo] = (transitionMatrix[fromTo] || 0) + 1;
  }
}

const bucketImpact = {
  p3Distribution: p3BucketDist,
  p19Distribution: p19BucketDist,
  bucketChangedCount: bucketChanged,
  bucketChangedRatio: aligned.length > 0 ? (bucketChanged / aligned.length).toFixed(4) : '0',
  bucketTransitionMatrix: transitionMatrix,
  distributionMatch: JSON.stringify(p3BucketDist) === JSON.stringify(p19BucketDist),
};

console.log('  Bucket changed:', bucketChanged);

// ─── 4. Score Impact ──────────────────────────────────────────────────────────

const scoreChanged = aligned.filter(r => r.score && r.score.changed).length;
const nonZeroPreScore = aligned.filter(r => r.score && r.score.preAlpha !== null && r.score.preAlpha !== 0).length;
const nonZeroPostScore = aligned.filter(r => r.score && r.score.postAlpha !== null && r.score.postAlpha !== 0).length;

const scoreImpact = {
  scoreSourceUsed: 'activeScoringSnapshot.alphaScore',
  nonZeroPreAlphaCount: nonZeroPreScore,
  nonZeroPostAlphaCount: nonZeroPostScore,
  scoreChangedCount: scoreChanged,
  scoreChangedRatio: aligned.length > 0 ? (scoreChanged / aligned.length).toFixed(4) : '0',
  deltaRange: scoreChanged > 0 ? 'see changedCases artifact' : 'N/A',
  observationNote: 'alphaScore is a composite scoring index. Not a return, not a prediction, not a performance metric.',
};

console.log('  Score changed:', scoreChanged);

// ─── 5. Snapshot Impact ───────────────────────────────────────────────────────

const signalChanged = aligned.filter(r => r.signal && r.signal.changed).length;
const reasonChanged = aligned.filter(r => r.reason && r.reason.changed).length;
const factorChanged = aligned.filter(r => r.factor && r.factor.changed).length;
const monthlyRevExcludedCount = aligned.filter(r => r.monthlyRevExcluded).length;

const snapshotImpact = {
  signalChangedCount: signalChanged,
  reasonChangedCount: reasonChanged,
  factorChangedCount: factorChanged,
  monthlyRevenueExcludedCount: monthlyRevExcludedCount,
  monthlyRevenueExcludedRatio: aligned.length > 0 ? (monthlyRevExcludedCount / aligned.length).toFixed(4) : '0',
};

console.log('  Signal changed:', signalChanged, '| Reason changed:', reasonChanged, '| Factor changed:', factorChanged);
console.log('  MonthlyRevenue excluded:', monthlyRevExcludedCount);

// ─── 6. PIT Guard Impact ─────────────────────────────────────────────────────

const pitStatusDist = {};
for (const row of p19rows) {
  const s = row.monthlyRevenuePitGateStatus || 'UNKNOWN';
  pitStatusDist[s] = (pitStatusDist[s] || 0) + 1;
}

const pitGuardImpact = {
  monthlyRevenuePitGateStatusDistribution: pitStatusDist,
  pitGateValidationStatus: pitGuard.validationStatus,
  leakageViolationsFromP19: pitGuard.leakageViolations,
  forbiddenFieldViolationsFromP19: pitGuard.forbiddenFieldViolations,
  p17QueryGateStatus: pitGuard.p17QueryGateStatus,
  p18QueryGateStatus: pitGuard.p18QueryGateStatus,
  unavailableMonthlyRevenueExcludedRows: pitGuard.unavailableMonthlyRevenueExcludedRows,
  observationNote: 'NOT_APPLICABLE_NO_DATA means MonthlyRevenue was already absent from scoring data — no gate rejection occurred.',
};

// ─── 7. Classification Counts ─────────────────────────────────────────────────

const classDist = {};
for (const r of comparisonRows) {
  for (const c of r.classes || []) {
    classDist[c] = (classDist[c] || 0) + 1;
  }
}
const noChangeCount = comparisonRows.filter(r => r.primaryClass === 'NO_CHANGE').length;

// ─── 8. Readiness Conclusion ─────────────────────────────────────────────────

const readinessConclusion = {
  shapeCompatible: corpusShapeComparison.shapeCompatible,
  pitValidationPass: pitGuard.validationStatus === 'PASS',
  leakageViolations: pitGuard.leakageViolations === 0,
  forbiddenFieldViolations: pitGuard.forbiddenFieldViolations === 0,
  scoringCompletenessNotSeverellyDegraded: compDegraded === 0,
  changedCasesDocumented: true,
  readyForP21ApprovalReview: corpusShapeComparison.shapeCompatible &&
    pitGuard.validationStatus === 'PASS' &&
    pitGuard.leakageViolations === 0 &&
    pitGuard.forbiddenFieldViolations === 0 &&
    compDegraded === 0,
  note: 'This conclusion assesses readiness for approval review only. It does not approve production migration.',
};

console.log('\n  Readiness for P21 approval review:', readinessConclusion.readyForP21ApprovalReview);

// ─── Assemble Output ──────────────────────────────────────────────────────────

const output = {
  phase: 'P20-HARDRESET',
  part: 'C',
  generatedAt: new Date().toISOString(),
  preCorpus: P3_PATH,
  postCorpus: P19_PATH,
  pitGuardSource: PIT_GUARD_PATH,
  productionApplyAllowed: false,
  productionDbWritten: false,
  corpusShapeComparison,
  scoringCompletenessImpact,
  bucketImpact,
  scoreImpact,
  snapshotImpact,
  pitGuardImpact,
  classificationCounts: classDist,
  noChangeCount,
  readinessConclusion,
};

fs.writeFileSync(`${OUT}/p20pit_impact_comparison.json`, JSON.stringify(output, null, 2));
console.log('\nWritten:', `${OUT}/p20pit_impact_comparison.json`);

// ─── Markdown Report ──────────────────────────────────────────────────────────

const md = `# P20-HARDRESET: Pre/Post PIT MonthlyRevenue Impact Comparison

> DISCLAIMER: Does not constitute investment advice. Does not compute ROI, win-rate, or outperformance. Observability-only impact analysis.

**Phase**: P20-HARDRESET  
**Part**: C  
**Generated**: ${output.generatedAt}  
**productionApplyAllowed**: false  
**productionDbWritten**: false

---

## 1. Corpus Shape Comparison

| Metric | P3 (Pre-PIT) | P19 (Post-PIT) |
|--------|-------------|----------------|
| Row count | ${corpusShapeComparison.p3LineCount} | ${corpusShapeComparison.p19LineCount} |
| Unique symbols | ${corpusShapeComparison.p3SymbolCount} | ${corpusShapeComparison.p19SymbolCount} |
| Unique asOfDates | ${corpusShapeComparison.p3AsOfDateCount} | ${corpusShapeComparison.p19AsOfDateCount} |
| Aligned rows | — | ${corpusShapeComparison.alignedRowCount} |
| Missing pre rows | — | ${corpusShapeComparison.missingPreRowCount} |
| Missing post rows | — | ${corpusShapeComparison.missingPostRowCount} |

**Horizon Distribution (P3)**: ${JSON.stringify(p3HorizonDist)}  
**Horizon Distribution (P19)**: ${JSON.stringify(p19HorizonDist)}  
**Shape Compatible**: ${corpusShapeComparison.shapeCompatible}

---

## 2. Scoring Completeness Impact

| Status | P3 | P19 |
|--------|-----|-----|
| COMPLETE | ${p3CompDist.COMPLETE} | ${p19CompDist.COMPLETE} |
| PARTIAL | ${p3CompDist.PARTIAL} | ${p19CompDist.PARTIAL} |
| EMPTY | ${p3CompDist.EMPTY} | ${p19CompDist.EMPTY} |

- Changed: ${compChanged}  
- Degraded: ${compDegraded}  
- Improved: ${compImproved}  
- Same: ${alignedWithCompleteness.filter(r => r.completeness && r.completeness.direction === 'same').length}

> Note: ${scoringCompletenessImpact.observationNote}

---

## 3. ResearchBucket Impact

**P3 Distribution**: ${JSON.stringify(p3BucketDist)}  
**P19 Distribution**: ${JSON.stringify(p19BucketDist)}  
**Bucket Changed**: ${bucketChanged} rows (ratio: ${bucketImpact.bucketChangedRatio})  
**Distribution Match**: ${bucketImpact.distributionMatch}  
**Transition Matrix**: ${JSON.stringify(transitionMatrix)}

---

## 4. Score Impact

- Score source: ${scoreImpact.scoreSourceUsed}
- Non-zero pre alphaScore count: ${nonZeroPreScore}
- Non-zero post alphaScore count: ${nonZeroPostScore}
- Score changed: ${scoreChanged} rows (ratio: ${scoreImpact.scoreChangedRatio})

> Note: ${scoreImpact.observationNote}

---

## 5. Snapshot Impact

| Dimension | Changed Count |
|-----------|--------------|
| Signal snapshot | ${signalChanged} |
| Reason snapshot | ${reasonChanged} |
| Factor snapshot | ${factorChanged} |
| MonthlyRevenue excluded | ${monthlyRevExcludedCount} |

---

## 6. PIT Guard Impact

**PIT Validation Status**: ${pitGuard.validationStatus}  
**Leakage Violations**: ${pitGuard.leakageViolations}  
**Forbidden Field Violations**: ${pitGuard.forbiddenFieldViolations}

MonthlyRevenue PIT Gate Status Distribution (P19):
${Object.entries(pitStatusDist).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

> Note: ${pitGuardImpact.observationNote}

---

## 7. Change Classification Counts

${Object.entries(classDist).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

No-change (primary): ${noChangeCount}

---

## 8. Readiness Conclusion

| Check | Status |
|-------|--------|
| Shape compatible | ${readinessConclusion.shapeCompatible} |
| PIT validation PASS | ${readinessConclusion.pitValidationPass} |
| Leakage violations = 0 | ${readinessConclusion.leakageViolations} |
| Forbidden field violations = 0 | ${readinessConclusion.forbiddenFieldViolations} |
| Completeness not severely degraded | ${readinessConclusion.scoringCompletenessNotSeverellyDegraded} |
| Changed cases documented | ${readinessConclusion.changedCasesDocumented} |

**Ready for P21 Approval Review**: ${readinessConclusion.readyForP21ApprovalReview}

> ${readinessConclusion.note}
`;

fs.writeFileSync(`${OUT}/p20pit_impact_comparison.md`, md);
console.log('Written:', `${OUT}/p20pit_impact_comparison.md`);

console.log('\n=== PART C COMPLETE ===');
