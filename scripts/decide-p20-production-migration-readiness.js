'use strict';
// PART E: P20-HARDRESET — Production Migration Review Readiness Decision
// DISCLAIMER: Does not constitute investment advice. Observability only.
// This script does NOT approve production migration.
// It assesses readiness for the approval review process only.
// productionApplyAllowed = false | productionDbWritten = false

const fs = require('fs');

const OUT = 'outputs/online_validation';
const COMPARISON_PATH = `${OUT}/p20pit_impact_comparison.json`;
const CHANGED_CASES_PATH = `${OUT}/p20pit_impact_changed_cases.json`;
const PIT_GUARD_PATH = `${OUT}/p19monthly_revenue_pit_guard_validation.json`;

console.log('P20-HARDRESET PART E: Production Migration Review Readiness Decision');
console.log('Generated:', new Date().toISOString());
console.log('');

const comparison = JSON.parse(fs.readFileSync(COMPARISON_PATH, 'utf8'));
const changedCases = JSON.parse(fs.readFileSync(CHANGED_CASES_PATH, 'utf8'));
const pitGuard = JSON.parse(fs.readFileSync(PIT_GUARD_PATH, 'utf8'));

// ─── Decision Criteria ────────────────────────────────────────────────────────

const criteria = [];

function check(name, condition, failClassification) {
  const status = condition ? 'PASS' : 'FAIL';
  criteria.push({ name, status, failClassification: condition ? null : failClassification });
  console.log(`  [${status}] ${name}`);
  return condition;
}

// 1. Shape compatible
const shapeOk = check(
  'P3/P19 corpus shape compatible',
  comparison.corpusShapeComparison && comparison.corpusShapeComparison.shapeCompatible === true,
  'P20_BLOCKED'
);

// 2. PIT validation PASS
const pitOk = check(
  'P19 PIT validation PASS',
  pitGuard.validationStatus === 'PASS',
  'P20_REQUIRES_QUERY_GATE_FIX'
);

// 3. Leakage violations = 0
const noLeakage = check(
  'Leakage violations = 0',
  pitGuard.leakageViolations === 0,
  'P20_REQUIRES_QUERY_GATE_FIX'
);

// 4. Forbidden field violations = 0
const noForbiddenFields = check(
  'Forbidden field violations = 0',
  pitGuard.forbiddenFieldViolations === 0,
  'P20_REQUIRES_QUERY_GATE_FIX'
);

// 5. Scoring completeness not severely degraded
const compImpact = comparison.scoringCompletenessImpact || {};
const degradedCount = compImpact.degradedCount || 0;
const totalAligned = (comparison.corpusShapeComparison && comparison.corpusShapeComparison.alignedRowCount) || 4500;
const degradedRatio = totalAligned > 0 ? degradedCount / totalAligned : 0;
const SEVERE_DEGRADATION_THRESHOLD = 0.05; // >5% degraded = requires review
const completenessOk = check(
  `Scoring completeness degradation < ${SEVERE_DEGRADATION_THRESHOLD * 100}% (actual: ${(degradedRatio * 100).toFixed(2)}%)`,
  degradedRatio < SEVERE_DEGRADATION_THRESHOLD,
  'P20_REQUIRES_SCORING_COMPLETENESS_REVIEW'
);

// 6. Bucket impact not high
const bucketImpact = comparison.bucketImpact || {};
const bucketChangedRatio = parseFloat(bucketImpact.bucketChangedRatio || '0');
const BUCKET_IMPACT_THRESHOLD = 0.10; // >10% bucket changed = requires review
const bucketOk = check(
  `Bucket change ratio < ${BUCKET_IMPACT_THRESHOLD * 100}% (actual: ${(bucketChangedRatio * 100).toFixed(2)}%)`,
  bucketChangedRatio < BUCKET_IMPACT_THRESHOLD,
  'P20_REQUIRES_BUCKET_IMPACT_REVIEW'
);

// 7. Snapshot impact not high or unexplained
const snapImpact = comparison.snapshotImpact || {};
const signalChangedCount = snapImpact.signalChangedCount || 0;
const reasonChangedCount = snapImpact.reasonChangedCount || 0;
const factorChangedCount = snapImpact.factorChangedCount || 0;
const totalSnapshotChanged = signalChangedCount + reasonChangedCount + factorChangedCount;
const SNAPSHOT_IMPACT_THRESHOLD = 0.10;
const snapshotChangedRatio = totalAligned > 0 ? totalSnapshotChanged / (totalAligned * 3) : 0;
const snapshotOk = check(
  `Snapshot impact (signal+reason+factor) < ${SNAPSHOT_IMPACT_THRESHOLD * 100}% (actual: ${(snapshotChangedRatio * 100).toFixed(2)}%)`,
  snapshotChangedRatio < SNAPSHOT_IMPACT_THRESHOLD,
  'P20_REQUIRES_SNAPSHOT_IMPACT_REVIEW'
);

// 8. Changed cases documented
const casesDocumented = check(
  'Changed cases documented (cases >= 1)',
  Array.isArray(changedCases.cases) && changedCases.cases.length >= 1,
  'P20_BLOCKED'
);

// ─── Determine Classification ─────────────────────────────────────────────────

const failed = criteria.filter(c => c.status === 'FAIL');
const failedClassifications = failed.map(c => c.failClassification).filter(Boolean);

let classification;
if (failed.length === 0) {
  classification = 'P20_READY_FOR_PRODUCTION_MIGRATION_APPROVAL_REVIEW';
} else if (failedClassifications.includes('P20_REQUIRES_QUERY_GATE_FIX')) {
  classification = 'P20_REQUIRES_QUERY_GATE_FIX';
} else if (failedClassifications.includes('P20_BLOCKED')) {
  classification = 'P20_BLOCKED';
} else if (failedClassifications.includes('P20_REQUIRES_SCORING_COMPLETENESS_REVIEW')) {
  classification = 'P20_REQUIRES_SCORING_COMPLETENESS_REVIEW';
} else if (failedClassifications.includes('P20_REQUIRES_BUCKET_IMPACT_REVIEW')) {
  classification = 'P20_REQUIRES_BUCKET_IMPACT_REVIEW';
} else if (failedClassifications.includes('P20_REQUIRES_SNAPSHOT_IMPACT_REVIEW')) {
  classification = 'P20_REQUIRES_SNAPSHOT_IMPACT_REVIEW';
} else {
  classification = 'P20_BLOCKED';
}

console.log('\n  Classification:', classification);

// ─── Evidence Summary ─────────────────────────────────────────────────────────

const evidenceSummary = {
  p3RowCount: comparison.corpusShapeComparison && comparison.corpusShapeComparison.p3LineCount,
  p19RowCount: comparison.corpusShapeComparison && comparison.corpusShapeComparison.p19LineCount,
  alignedRows: totalAligned,
  missingPreRows: (comparison.corpusShapeComparison && comparison.corpusShapeComparison.missingPreRowCount) || 0,
  missingPostRows: (comparison.corpusShapeComparison && comparison.corpusShapeComparison.missingPostRowCount) || 0,
  completeness: {
    degradedCount,
    degradedRatio: (degradedRatio * 100).toFixed(2) + '%',
    p3Distribution: compImpact.p3Distribution,
    p19Distribution: compImpact.p19Distribution,
  },
  bucketImpact: {
    changedCount: bucketImpact.bucketChangedCount || 0,
    changedRatio: (bucketChangedRatio * 100).toFixed(2) + '%',
    distributionMatch: bucketImpact.distributionMatch,
  },
  snapshotImpact: {
    signalChangedCount,
    reasonChangedCount,
    factorChangedCount,
    monthlyRevenueExcludedCount: snapImpact.monthlyRevenueExcludedCount || 0,
  },
  pitGuardSummary: {
    validationStatus: pitGuard.validationStatus,
    leakageViolations: pitGuard.leakageViolations,
    forbiddenFieldViolations: pitGuard.forbiddenFieldViolations,
    pitGateStatusDistribution: pitGuard.pitGateStatusDistribution,
  },
  changedCasesSampled: Array.isArray(changedCases.cases) ? changedCases.cases.length : 0,
};

// ─── Output ───────────────────────────────────────────────────────────────────

const output = {
  phase: 'P20-HARDRESET',
  part: 'E',
  generatedAt: new Date().toISOString(),
  productionApplyAllowed: false,
  productionDbWritten: false,
  classification,
  passedCriteria: criteria.filter(c => c.status === 'PASS').map(c => c.name),
  failedCriteria: criteria.filter(c => c.status === 'FAIL').map(c => c.name),
  allCriteria: criteria,
  evidenceSummary,
  importantNotice: [
    'This decision assesses readiness for P21 Production Migration Approval Review only.',
    'It does NOT approve production migration.',
    'Actual production migration requires a separate P21 approval process.',
    'productionApplyAllowed remains false.',
    'No production DB writes have occurred.',
  ],
};

fs.writeFileSync(`${OUT}/p20production_migration_readiness_decision.json`, JSON.stringify(output, null, 2));
console.log('\nWritten:', `${OUT}/p20production_migration_readiness_decision.json`);

// ─── Markdown ─────────────────────────────────────────────────────────────────

const nextStepMap = {
  'P20_READY_FOR_PRODUCTION_MIGRATION_APPROVAL_REVIEW': 'Proceed to P21 Production Migration Approval Review.',
  'P20_REQUIRES_SCORING_COMPLETENESS_REVIEW': 'Review scoring completeness degradation before P21.',
  'P20_REQUIRES_BUCKET_IMPACT_REVIEW': 'Review bucket distribution changes before P21.',
  'P20_REQUIRES_SNAPSHOT_IMPACT_REVIEW': 'Review signal/reason/factor snapshot changes before P21.',
  'P20_REQUIRES_QUERY_GATE_FIX': 'Fix PIT query gate issues before any further review.',
  'P20_BLOCKED': 'Resolve blocking issues before proceeding.',
};

const md = `# P20-HARDRESET Part E: Production Migration Review Readiness Decision

> DISCLAIMER: Does not constitute investment advice. Observability only. This document does NOT approve production migration.

**Phase**: P20-HARDRESET  
**Part**: E  
**Generated**: ${output.generatedAt}  
**productionApplyAllowed**: false  
**productionDbWritten**: false

---

## Decision

**Classification**: \`${classification}\`

**Next Step**: ${nextStepMap[classification] || 'See classification.'}

---

## Criteria Results

| Criterion | Status |
|-----------|--------|
${criteria.map(c => `| ${c.name} | ${c.status} |`).join('\n')}

---

## Evidence Summary

| Metric | Value |
|--------|-------|
| P3 rows | ${evidenceSummary.p3RowCount} |
| P19 rows | ${evidenceSummary.p19RowCount} |
| Aligned rows | ${evidenceSummary.alignedRows} |
| Missing pre rows | ${evidenceSummary.missingPreRows} |
| Missing post rows | ${evidenceSummary.missingPostRows} |
| Completeness degraded | ${evidenceSummary.completeness.degradedCount} (${evidenceSummary.completeness.degradedRatio}) |
| Bucket changed | ${evidenceSummary.bucketImpact.changedCount} (${evidenceSummary.bucketImpact.changedRatio}) |
| Signal changed | ${signalChangedCount} |
| Reason changed | ${reasonChangedCount} |
| Factor changed | ${factorChangedCount} |
| PIT leakage violations | ${evidenceSummary.pitGuardSummary.leakageViolations} |
| PIT forbidden field violations | ${evidenceSummary.pitGuardSummary.forbiddenFieldViolations} |
| Changed cases sampled | ${evidenceSummary.changedCasesSampled} |

---

## Important Notice

${output.importantNotice.map(n => `- ${n}`).join('\n')}

---

## Final Classification

**${classification}**
`;

fs.writeFileSync(`${OUT}/p20production_migration_readiness_decision.md`, md);
console.log('Written:', `${OUT}/p20production_migration_readiness_decision.md`);

console.log('\n=== PART E COMPLETE ===');
console.log('Classification:', classification);
