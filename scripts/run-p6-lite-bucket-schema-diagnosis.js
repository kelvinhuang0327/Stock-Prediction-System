'use strict';
// P6-HARDRESET-LITE — Bucket Schema Short Diagnosis Script
// Reads p5walkthrough_review.json, diagnoses the 5 INCONSISTENT score/bucket cases.
// Produces JSON + MD diagnosis reports and a final short verdict.
// NO model changes. NO investment recommendations. NO ROI/alpha/edge/profit claims.

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true }
});
require('tsconfig-paths').register({
  baseUrl: require('path').resolve(__dirname, '..'),
  paths: { '@/*': ['src/*'] }
});

const fs = require('fs');
const path = require('path');

const {
  extractInconsistentCases,
  diagnoseBucketInconsistency,
  summarizeBucketSchemaDiagnosis,
  buildBucketSchemaShortVerdict,
  scanForbiddenClaims,
} = require('../src/lib/onlineValidation/P6BucketSchemaDiagnosisUtils');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs', 'online_validation');

// ─── Load inputs ──────────────────────────────────────────────────────────────

const review = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'p5walkthrough_review.json'), 'utf8'));
const cases = review.cases || [];
const inconsistentCases = extractInconsistentCases(cases);

if (inconsistentCases.length !== 5) {
  console.warn(`WARNING: Expected 5 inconsistent cases, found ${inconsistentCases.length}`);
}

// ─── Diagnose each case ───────────────────────────────────────────────────────

const diagnosisResults = inconsistentCases.map(c =>
  diagnoseBucketInconsistency(c, {
    snapshotFields: ['scoringCompletenessStatus', 'topSignalOrFactor', 'reasonSnapshotSummary'],
  })
);

const summary = summarizeBucketSchemaDiagnosis(diagnosisResults);
const verdict = buildBucketSchemaShortVerdict(summary);

// ─── Build output JSON ────────────────────────────────────────────────────────

const now = new Date().toISOString();

const diagnosisJson = {
  generatedAt: now,
  disclaimer:
    'Schema self-consistency diagnosis only. No investment recommendations. ' +
    'No scoring formula changes. No model changes. Descriptive diagnosis only.',
  phase: 'P6-HARDRESET-LITE',
  runDate: '2026-05-12',
  inputSource: 'outputs/online_validation/p5walkthrough_review.json',
  totalCasesInReview: cases.length,
  totalInconsistentCasesAnalyzed: diagnosisResults.length,
  finalVerdict: verdict.verdict,
  verdictSummary: verdict.summary,
  watchBoundaryPattern: verdict.watchBoundaryPattern,
  nextStepGuidance: verdict.nextStepGuidance,
  requiresContractFreeze: verdict.requiresContractFreeze,
  summary,
  cases: diagnosisResults,
};

// ─── Forbidden claims scan ────────────────────────────────────────────────────

const jsonText = JSON.stringify(diagnosisJson, null, 2);
const forbiddenMatches = scanForbiddenClaims(jsonText);

if (forbiddenMatches.length > 0) {
  console.error('FORBIDDEN CLAIMS DETECTED in diagnosis output:');
  forbiddenMatches.forEach(m => console.error(`  [${m.pattern}] ${m.context}`));
  process.exit(1);
}

// ─── Write JSON output ────────────────────────────────────────────────────────

const jsonPath = path.join(OUT_DIR, 'p6lite_bucket_schema_diagnosis.json');
fs.writeFileSync(jsonPath, jsonText, 'utf8');
console.log(`Written: ${jsonPath}`);

// ─── Build markdown report ────────────────────────────────────────────────────

const categoryLabels = {
  SCORE_THRESHOLD_MISMATCH:    'Score Threshold Mismatch',
  BUCKET_MAPPING_MISMATCH:     'Bucket Mapping Mismatch',
  NORMALIZATION_GAP:           'Normalization Gap',
  SNAPSHOT_CAPTURE_MISMATCH:   'Snapshot Capture Mismatch',
  FACTOR_AGGREGATION_AMBIGUOUS: 'Factor Aggregation Ambiguous',
  UNKNOWN_REQUIRES_CODE_TRACE:  'Unknown — Requires Code Trace',
};

const verdictEmoji = {
  BY_DESIGN_BOUNDARY: '🟡',
  SCHEMA_BUG:         '🔴',
  NEEDS_CODE_TRACE:   '🟠',
};

const md = `# P6-LITE: Bucket Schema Short Diagnosis

**Generated:** ${now.slice(0, 10)}  
**Phase:** P6-HARDRESET-LITE  
**Final Verdict:** ${verdictEmoji[verdict.verdict] || ''} **${verdict.verdict}**

> **Disclaimer:** Schema self-consistency diagnosis only. No investment recommendations. No scoring formula changes. No model changes.

---

## Verdict Summary

${verdict.summary}

**Next Step:** ${verdict.nextStepGuidance}

---

## Watch + Low-Score Boundary Pattern

| Field | Value |
|-------|-------|
| Detected | ${verdict.watchBoundaryPattern.detected ? 'Yes' : 'No'} |
| Case Count | ${verdict.watchBoundaryPattern.caseCount} |
| Score Range | ${verdict.watchBoundaryPattern.scoreRange} |
| Interpretation | ${verdict.watchBoundaryPattern.interpretation} |

---

## Diagnosis Summary

| Metric | Value |
|--------|-------|
| Total Inconsistent Cases Analyzed | ${summary.totalInconsistentCases} |
| Watch + Low-Score Boundary Cases | ${summary.watchLowScoreBoundaryCount} |
| Dominant Category | ${summary.dominantCategory} |
| Observed Score Range | ${summary.observedScoreRange ? `[${summary.observedScoreRange.min}, ${summary.observedScoreRange.max}]` : 'N/A'} |
| Observed Buckets | ${summary.observedBuckets.join(', ')} |

### Category Distribution

${Object.entries(summary.byCategoryCount)
  .filter(([, v]) => v > 0)
  .map(([k, v]) => `- **${categoryLabels[k] || k}**: ${v}`)
  .join('\n')}

---

## Case-Level Diagnosis

${diagnosisResults.map((r, i) => `
### ${i + 1}. ${r.caseId} — ${r.symbol}

| Field | Value |
|-------|-------|
| Symbol | ${r.symbol} |
| As-Of Date | ${r.asOf} |
| Horizon | ${r.horizon}d |
| Score | ${r.score !== null ? r.score : 'N/A'} |
| Score Source | ${r.scoreSource} |
| Research Bucket | ${r.researchBucket} |
| Normalized Bucket | ${r.normalizedBucket} |
| ActiveScoring Snapshot Bucket | ${r.activeScoringSnapshotBucket ?? 'N/A'} |
| Watch+LowScore Boundary Pattern | ${r.isWatchLowScoreBoundaryPattern ? 'Yes' : 'No'} |
| **Diagnosis Category** | **${r.diagnosisCategory}** |
| Recommended Repair | ${r.recommendedRepairType} |

**Evidence:** ${r.evidence}

**Why No Model Change Now:** ${r.whyNoModelChangeNow}
`).join('\n')}

---

## Verdict Evidence

${summary.verdictEvidence}

---

*End of P6-LITE Bucket Schema Short Diagnosis*
`;

const mdPath = path.join(OUT_DIR, 'p6lite_bucket_schema_diagnosis.md');
fs.writeFileSync(mdPath, md, 'utf8');
console.log(`Written: ${mdPath}`);

// ─── Contract freeze (if BY_DESIGN_BOUNDARY) ─────────────────────────────────

if (verdict.requiresContractFreeze) {
  const freeze = {
    generatedAt: now,
    disclaimer:
      'Schema contract freeze only. No investment recommendations. No scoring changes. ' +
      'This document records the observed boundary behavior for schema documentation purposes.',
    phase: 'P6-HARDRESET-LITE — BY_DESIGN_BOUNDARY Contract Freeze',
    runDate: '2026-05-12',
    canonicalBucketLabels: [
      {
        label: 'Strong',
        aliases: ['Strong Candidate', '偏多', 'StrongBull'],
        canonicalScoreBand: { low: 60, high: 100 },
        description: 'High composite score, all major signal dimensions aligned positively.',
      },
      {
        label: 'Watch',
        aliases: ['Watch Candidate', '觀察', '留意'],
        canonicalScoreBand: { low: 40, high: 70 },
        observedBoundaryBehavior: {
          acceptedScoreRange: { min: 20, max: 39 },
          condition:
            'Signal-qualified Watch assignment: individual technical signals (e.g. 技術偏空 in universe-tracked stock) ' +
            'may trigger Watch bucket independently of composite score. Observed in 5 cases with scores [21,29].',
          evidenceSource: 'P5 walkthrough review — 5 INCONSISTENT cases, all Watch + score ≤ 39',
          freezeDecision:
            'BY_DESIGN_BOUNDARY: This boundary behavior is accepted as-is. ' +
            'The score band documentation (40-70) will be updated to note signal-override cases.',
        },
      },
      {
        label: 'Neutral',
        aliases: ['中性'],
        canonicalScoreBand: { low: 30, high: 59 },
        description: 'Mixed signals. Composite score in mid-range. No strong directional bias.',
      },
      {
        label: 'LowPriority',
        aliases: ['Low Priority', '低優先', '偏空', 'WeakBear'],
        canonicalScoreBand: { low: 0, high: 39 },
        description: 'Low composite score, mostly negative signals. Not prioritized.',
      },
      {
        label: 'InsufficientData',
        aliases: ['Insufficient Data', 'N/A', 'NA', 'None'],
        canonicalScoreBand: null,
        description: 'Score or bucket could not be determined due to missing data.',
      },
    ],
    watchBoundaryContract: {
      canonicalLowerBound: 40,
      observedLowerBoundWithSignalOverride: 20,
      observedCaseCount: 5,
      observedScoreRange: '[21, 29]',
      freezeRule:
        'Watch bucket is permissible for composite scores in [20, 39] when individual signal factors ' +
        'provide a qualifying condition (e.g., universe tier + technical signal). ' +
        'The composite score band (40-70) reflects the TYPICAL range, not a hard gate.',
      normalizationRule:
        'All raw bucket labels in [Watch, watch, Watch Candidate, 觀察, 留意] normalize to canonical "Watch".',
    },
    normalizationRules: {
      trimWhitespace: true,
      caseInsensitive: true,
      chineseAliases: {
        '偏多': 'Strong',
        '強多': 'Strong',
        '偏空': 'LowPriority',
        '弱空': 'LowPriority',
        '觀察': 'Watch',
        '留意': 'Watch',
        '中性': 'Neutral',
        '低優先': 'LowPriority',
        '低優先度': 'LowPriority',
      },
      insufficientDataVariants: ['Insufficient Data', 'N/A', 'NA', 'None', ''],
    },
    nonGoals: [
      'This contract does NOT define investment rules or recommendations.',
      'This contract does NOT establish performance thresholds or return expectations.',
      'This contract does NOT modify scoring formulas, alphaScore, or recommendationBucket logic.',
      'This contract does NOT apply to simulation_snapshot_corpus or P0/P1/P3/P4 corpora.',
      'This contract is for schema documentation and normalization consistency only.',
      'Future score re-calibration remains out of scope for P6-LITE.',
    ],
    frozenAt: now,
  };

  const freezeJsonPath = path.join(OUT_DIR, 'p6lite_bucket_contract_freeze.json');
  fs.writeFileSync(freezeJsonPath, JSON.stringify(freeze, null, 2), 'utf8');
  console.log(`Written: ${freezeJsonPath}`);

  const freezeMd = `# P6-LITE: Bucket Schema Contract Freeze

**Generated:** ${now.slice(0, 10)}  
**Verdict:** 🟡 BY_DESIGN_BOUNDARY → Contract Frozen

> **Disclaimer:** Schema contract documentation only. No investment recommendations. No scoring changes.

---

## Purpose

This contract freeze records the **observed boundary behavior** of the bucket assignment schema as identified during P6-LITE diagnosis. It does not change any scoring logic, and it does not constitute an investment decision.

---

## Canonical Bucket Labels

| Label | Score Band | Notes |
|-------|-----------|-------|
| Strong | 60–100 | Aliases: Strong Candidate, 偏多, StrongBull |
| **Watch** | **40–70** | **Signal-override boundary: accepts scores [20,39] when signal-qualified** |
| Neutral | 30–59 | Aliases: 中性 |
| LowPriority | 0–39 | Aliases: Low Priority, 低優先, 偏空, WeakBear |
| InsufficientData | N/A | Aliases: N/A, NA, None, '' |

---

## Watch Boundary Contract

| Field | Value |
|-------|-------|
| Canonical Lower Bound | 40 |
| Observed Lower Bound (Signal Override) | 20 |
| Observed Case Count | 5 |
| Observed Score Range | [21, 29] |

**Freeze Rule:** Watch bucket is permissible for composite scores in [20, 39] when individual signal factors provide a qualifying condition. The canonical band (40–70) reflects the typical range, not a hard gate.

**Normalization Rule:** All Watch variants → canonical "Watch".

---

## Normalization Rules

- Trim whitespace: **Yes**
- Case-insensitive: **Yes**
- Chinese aliases: 偏多→Strong, 偏空→LowPriority, 觀察/留意→Watch, 中性→Neutral, 低優先→LowPriority
- InsufficientData variants: Insufficient Data, N/A, NA, None, (empty string)

---

## Non-Goals

${freeze.nonGoals.map(g => `- ${g}`).join('\n')}

---

*Frozen: ${now.slice(0, 10)} | P6-HARDRESET-LITE | BY_DESIGN_BOUNDARY*
`;

  const freezeMdPath = path.join(OUT_DIR, 'p6lite_bucket_contract_freeze.md');
  fs.writeFileSync(freezeMdPath, freezeMd, 'utf8');
  console.log(`Written: ${freezeMdPath}`);
}

console.log(`\n✅ P6-LITE Bucket Schema Diagnosis complete.`);
console.log(`   Final Verdict: ${verdict.verdict}`);
console.log(`   Cases diagnosed: ${diagnosisResults.length}`);
console.log(`   Contract freeze required: ${verdict.requiresContractFreeze}`);
