'use strict';
// P8-PREFLIGHT — Signal / Reason Generic Diagnosis Script
// Reads p5walkthrough_review.json, classifies the 24 GENERIC signal/reason cases.
// Produces JSON + MD preflight diagnosis reports.
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
  classifyGenericReasonDiagnosis,
  summarizeSignalReasonDiagnosis,
  scanForbiddenClaims,
} = require('../src/lib/onlineValidation/P8SignalReasonDiagnosisUtils');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs', 'online_validation');

// ─── Load inputs ──────────────────────────────────────────────────────────────

const review = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'p5walkthrough_review.json'), 'utf8'));
const cases = review.cases || [];
const genericCases = cases.filter(c => c.signalReasonConsistency === 'GENERIC');

if (genericCases.length !== 24) {
  console.warn(`WARNING: Expected 24 generic reason cases, found ${genericCases.length}`);
}

// ─── Classify each case ───────────────────────────────────────────────────────

const diagnosisResults = genericCases.map(c => classifyGenericReasonDiagnosis(c));
const summary = summarizeSignalReasonDiagnosis(diagnosisResults, genericCases);

// ─── Build output JSON ────────────────────────────────────────────────────────

const now = new Date().toISOString();

const diagnosisJson = {
  generatedAt: now,
  disclaimer:
    'Root-cause pre-classification only. No investment recommendations. ' +
    'No reason or signal logic changes. No model changes. Descriptive diagnosis only.',
  phase: 'P8-PREFLIGHT',
  runDate: '2026-05-12',
  inputSource: 'outputs/online_validation/p5walkthrough_review.json',
  totalCasesInReview: cases.length,
  totalGenericCasesAnalyzed: diagnosisResults.length,
  summary,
  cases: diagnosisResults,
};

// ─── Forbidden claims scan ────────────────────────────────────────────────────

const jsonText = JSON.stringify(diagnosisJson, null, 2);
const forbiddenMatches = scanForbiddenClaims(jsonText);

if (forbiddenMatches.length > 0) {
  console.error('FORBIDDEN CLAIMS DETECTED in P8 diagnosis output:');
  forbiddenMatches.forEach(m => console.error(`  [${m.pattern}] ${m.context}`));
  process.exit(1);
}

// ─── Write JSON output ────────────────────────────────────────────────────────

const jsonPath = path.join(OUT_DIR, 'p8preflight_signal_reason_diagnosis.json');
fs.writeFileSync(jsonPath, jsonText, 'utf8');
console.log(`Written: ${jsonPath}`);

// ─── Build markdown report ────────────────────────────────────────────────────

const categoryLabels = {
  TEMPLATE_TOO_GENERIC:         'Template Too Generic',
  SNAPSHOT_CAPTURE_MISSING:     'Snapshot Capture Missing',
  FACTOR_EXPLANATION_MISSING:   'Factor Explanation Missing',
  SCORING_ENGINE_UNDEROUTPUT:   'Scoring Engine Underoutput',
  UNKNOWN_REQUIRES_CODE_TRACE:  'Unknown — Requires Code Trace',
};

const repairLabels = {
  ENRICH_REASON_TEMPLATE:                   'Enrich Reason Template',
  FIX_SNAPSHOT_FACTOR_CAPTURE:              'Fix Snapshot Factor Capture',
  ADD_FACTOR_EXPLANATION_LAYER:             'Add Factor Explanation Layer',
  FIX_SCORING_ENGINE_OUTPUT_COMPLETENESS:   'Fix Scoring Engine Output Completeness',
  MANUAL_REVIEW_REQUIRED:                   'Manual Review Required',
};

const md = `# P8-PREFLIGHT: Signal / Reason Generic Diagnosis

**Generated:** ${now.slice(0, 10)}  
**Phase:** P8-PREFLIGHT  
**Cases Analyzed:** ${diagnosisResults.length}

> **Disclaimer:** Root-cause pre-classification only. No investment recommendations. No reason or signal logic changes. No model changes.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Generic Cases | ${summary.totalGenericCases} |
| Single-Token Reason Count | ${summary.singleTokenReasonCount} |
| Partial Scoring Count | ${summary.partialScoringCount} |
| Dominant Category | **${summary.dominantCategory}** |

### Category Distribution

| Category | Count | % |
|----------|-------|---|
${Object.entries(summary.byCategoryCount)
  .map(([k, v]) => `| ${categoryLabels[k] || k} | ${v} | ${Math.round((v / summary.totalGenericCases) * 100)}% |`)
  .join('\n')}

### Factor Type Distribution

| Factor Token | Count |
|-------------|-------|
${Object.entries(summary.factorTypeSummary)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `| \`${k}\` | ${v} |`)
  .join('\n')}

---

## Key Insights

${summary.keyInsights.map((ins, i) => `${i + 1}. ${ins}`).join('\n')}

---

## Case-Level Diagnosis

${diagnosisResults.map((r, i) => `
### ${i + 1}. ${r.caseId} — ${r.symbol}

| Field | Value |
|-------|-------|
| Symbol | ${r.symbol} |
| As-Of Date | ${r.asOf} |
| Horizon | ${r.horizon}d |
| Reason (Raw) | \`${r.reasonRaw}\` |
| Reason (Normalized) | \`${r.reasonNormalized}\` |
| Factor Count | ${r.factorCount} |
| **Diagnosis Category** | **${r.diagnosisCategory}** |
| Recommended Repair | ${repairLabels[r.recommendedRepairType] || r.recommendedRepairType} |

**Factor Summary:** ${r.factorSummary}

**Evidence:** ${r.evidence}
`).join('\n')}

---

## What Is Not Changed

- No reason / signal generation logic modified
- No scoring engine changes
- No snapshot capture logic changes
- No corpus modifications
- All repair actions deferred to P8 execution phase (future sprint)

---

*End of P8-PREFLIGHT Signal / Reason Generic Diagnosis*
`;

const mdPath = path.join(OUT_DIR, 'p8preflight_signal_reason_diagnosis.md');
fs.writeFileSync(mdPath, md, 'utf8');
console.log(`Written: ${mdPath}`);

console.log(`\n✅ P8-PREFLIGHT Signal/Reason Diagnosis complete.`);
console.log(`   Cases diagnosed: ${diagnosisResults.length}`);
console.log(`   Dominant category: ${summary.dominantCategory}`);
Object.entries(summary.byCategoryCount).forEach(([k, v]) => {
  if (v > 0) console.log(`   ${k}: ${v}`);
});
