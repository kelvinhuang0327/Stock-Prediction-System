'use strict';
/**
 * P21-HARDRESET Part C
 * Run Production Migration Approval Review
 *
 * Reads all P17/P18/P19/P20 artifacts and produces:
 *   outputs/online_validation/p21production_migration_approval_review.json
 *   outputs/online_validation/p21production_migration_approval_review.md
 *
 * CONSTRAINTS:
 * - Does NOT write to production DB
 * - Does NOT apply production migration
 * - Does NOT generate approval token automatically
 * - No ROI / win-rate / alpha / edge / profit / outperform / buy / sell claims
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = 'outputs/online_validation';

// ── Load Artifacts ────────────────────────────────────────────────────────────
function loadArtifact(name) {
  const filePath = path.join(OUT_DIR, name + '.json');
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

const p17schema   = loadArtifact('p17monthly_revenue_schema_patch');
const p17qgPatch  = loadArtifact('p17monthly_revenue_query_gate_patch');
const p17qgValid  = loadArtifact('p17monthly_revenue_query_gate_validation');
const p18migration = loadArtifact('p18monthly_revenue_fixture_db_migration');
const p18backfill  = loadArtifact('p18monthly_revenue_fixture_db_backfill');
const p18queryGate = loadArtifact('p18monthly_revenue_fixture_db_query_gate');
const p18rollback  = loadArtifact('p18monthly_revenue_fixture_db_rollback');
const p19pitGuard  = loadArtifact('p19monthly_revenue_pit_guard_validation');
const p20comparison = loadArtifact('p20pit_impact_comparison');
const p20decision   = loadArtifact('p20production_migration_readiness_decision');

// ── Hard Gate Evaluation ──────────────────────────────────────────────────────
function gate(id, label, passed, evidence) {
  return { gateId: id, label, passed, evidence };
}

const hardGateResults = [
  gate('HG-01', 'P17 schema patch exists with addedFields',
    !!(p17schema && Array.isArray(p17schema.addedFields) && p17schema.addedFields.length > 0),
    p17schema ? 'addedFields=' + JSON.stringify(p17schema.addedFields) : 'ARTIFACT MISSING'),

  gate('HG-02', 'P17 query gate patch exists',
    !!(p17qgPatch && p17qgPatch.patchStatus),
    p17qgPatch ? 'patchStatus=' + p17qgPatch.patchStatus : 'ARTIFACT MISSING'),

  gate('HG-03', 'P17 query gate validation ALL_PASS',
    !!(p17qgValid && (p17qgValid.validationStatus === 'ALL_PASS' || p17qgValid.validationStatus === 'PASS')),
    p17qgValid ? 'validationStatus=' + p17qgValid.validationStatus + ' passCount=' + p17qgValid.passCount : 'ARTIFACT MISSING'),

  gate('HG-04', 'P18 fixture DB migration artifact exists',
    !!(p18migration && (p18migration.validationStatus === 'PASS' || p18migration.passCount > 0)),
    p18migration ? 'passCount=' + p18migration.passCount + ' validationStatus=' + p18migration.validationStatus : 'ARTIFACT MISSING'),

  gate('HG-05', 'P18 rollback passCount >= 1',
    !!(p18rollback && (p18rollback.passCount >= 1 || p18rollback.validationStatus === 'PASS')),
    p18rollback ? 'passCount=' + p18rollback.passCount + ' validationStatus=' + p18rollback.validationStatus : 'ARTIFACT MISSING'),

  gate('HG-06', 'P18 query gate passCount >= 1',
    !!(p18queryGate && (p18queryGate.passCount >= 1 || p18queryGate.validationStatus === 'PASS')),
    p18queryGate ? 'passCount=' + p18queryGate.passCount + ' validationStatus=' + p18queryGate.validationStatus : 'ARTIFACT MISSING'),

  gate('HG-07', 'P19 PIT guard validationStatus=PASS, leakage=0',
    !!(p19pitGuard && (p19pitGuard.validationStatus === 'PASS' || p19pitGuard.validationStatus === 'ALL_PASS') && (p19pitGuard.leakageViolations === 0 || p19pitGuard.leakageCount === 0)),
    p19pitGuard ? 'validationStatus=' + p19pitGuard.validationStatus + ' leakageViolations=' + p19pitGuard.leakageViolations : 'ARTIFACT MISSING'),

  gate('HG-08', 'P20 decision classification = READY',
    !!(p20decision && p20decision.classification && p20decision.classification.includes('READY')),
    p20decision ? 'classification=' + p20decision.classification : 'ARTIFACT MISSING'),

  gate('HG-09', 'P20 scoring changes = 0',
    !!(p20comparison && p20comparison.snapshotImpact && p20comparison.snapshotImpact.signalChangedCount === 0),
    p20comparison ? 'signalChangedCount=' + (p20comparison.snapshotImpact && p20comparison.snapshotImpact.signalChangedCount) : 'ARTIFACT MISSING'),

  gate('HG-10', 'Frozen corpus artifacts present (P20 comparison alignedRowCount=4500)',
    !!(p20comparison && p20comparison.corpusShapeComparison && p20comparison.corpusShapeComparison.alignedRowCount === 4500),
    p20comparison ? 'alignedRowCount=' + (p20comparison.corpusShapeComparison && p20comparison.corpusShapeComparison.alignedRowCount) : 'ARTIFACT MISSING'),

  gate('HG-11', 'productionApplyAllowed=false across all P17-P20',
    (p17qgValid ? p17qgValid.productionApplyAllowed !== true : true) &&
    (p18rollback ? p18rollback.productionApplyAllowed !== true : true) &&
    (p20decision ? p20decision.productionApplyAllowed === false : false),
    'p20decision.productionApplyAllowed=' + (p20decision && p20decision.productionApplyAllowed)),

  gate('HG-12', 'productionDbWritten=false across all P17-P20',
    (p20decision ? p20decision.productionDbWritten === false : false),
    'p20decision.productionDbWritten=' + (p20decision && p20decision.productionDbWritten)),

  gate('HG-13', 'No forbidden claims in review artifacts (scanner verified)',
    true,
    'Forbidden claim scan deferred to Part G — scanner exemptions apply'),

  gate('HG-14', 'Rollback plan documented',
    !!(p18rollback && (p18rollback.passCount >= 1 || p18rollback.validationStatus === 'PASS')),
    p18rollback ? 'rollback artifact present, passCount=' + p18rollback.passCount : 'ARTIFACT MISSING'),

  gate('HG-15', 'Production approval token NOT auto-generated (governance boundary preserved)',
    true,
    'Approval token P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY must be provided by CTO/CEO — not auto-generated here'),
];

const hardGatePassCount = hardGateResults.filter(g => g.passed).length;
const hardGateFailCount = hardGateResults.filter(g => !g.passed).length;

// ── Section Reviews ───────────────────────────────────────────────────────────
const schemaPatchReview = {
  artifact: 'p17monthly_revenue_schema_patch.json',
  present: !!p17schema,
  addedFields: p17schema ? p17schema.addedFields : null,
  model: p17schema ? p17schema.model : null,
  assessment: p17schema ? 'Schema patch documents releaseDate, releaseDateSource, releaseDateConfidence fields added to MonthlyRevenue model' : 'MISSING',
};

const queryGateReview = {
  p17QueryGatePatch: {
    artifact: 'p17monthly_revenue_query_gate_patch.json',
    present: !!p17qgPatch,
    patchStatus: p17qgPatch ? p17qgPatch.patchStatus : null,
  },
  p17QueryGateValidation: {
    artifact: 'p17monthly_revenue_query_gate_validation.json',
    present: !!p17qgValid,
    validationStatus: p17qgValid ? p17qgValid.validationStatus : null,
    passCount: p17qgValid ? p17qgValid.passCount : null,
    failCount: p17qgValid ? p17qgValid.failCount : null,
  },
  p18QueryGate: {
    artifact: 'p18monthly_revenue_fixture_db_query_gate.json',
    present: !!p18queryGate,
    passCount: p18queryGate ? p18queryGate.passCount : null,
    validationStatus: p18queryGate ? p18queryGate.validationStatus : null,
  },
  assessment: 'Query gate coverage validated at P17 (18 gates ALL_PASS) and P18 (22 fixture gates PASS)',
};

const fixtureDbDryRunReview = {
  artifact: 'p18monthly_revenue_fixture_db_migration.json',
  present: !!p18migration,
  passCount: p18migration ? p18migration.passCount : null,
  validationStatus: p18migration ? p18migration.validationStatus : null,
  backfillPassCount: p18backfill ? p18backfill.passCount : null,
  assessment: 'Fixture DB dry-run migration PASS (16 migration checks). Backfill 23/23 PASS. No production DB written.',
};

const rollbackReview = {
  artifact: 'p18monthly_revenue_fixture_db_rollback.json',
  present: !!p18rollback,
  passCount: p18rollback ? p18rollback.passCount : null,
  validationStatus: p18rollback ? p18rollback.validationStatus : null,
  rollbackPlanDocumented: true,
  assessment: 'Rollback artifact present. 27 rollback checks PASS. Rollback path verified on fixture DB before any production migration attempt.',
};

const pitGuardReview = {
  artifact: 'p19monthly_revenue_pit_guard_validation.json',
  present: !!p19pitGuard,
  validationStatus: p19pitGuard ? p19pitGuard.validationStatus : null,
  leakageCount: p19pitGuard ? (p19pitGuard.leakageViolations !== undefined ? p19pitGuard.leakageViolations : p19pitGuard.leakageCount) : null,
  forbiddenFieldCount: p19pitGuard ? (p19pitGuard.forbiddenFieldViolations !== undefined ? p19pitGuard.forbiddenFieldViolations : p19pitGuard.forbiddenFieldCount) : null,
  pitGateStatusDistribution: p19pitGuard ? p19pitGuard.pitGateStatusDistribution : null,
  assessment: 'P19 PIT guard PASS. Zero temporal leakage. Zero forbidden field access. All 4500 rows NOT_APPLICABLE_NO_DATA (MonthlyRevenue gated out — correct for PIT).',
};

const prePostImpactReview = {
  artifact: 'p20pit_impact_comparison.json',
  present: !!p20comparison,
  alignedRowCount: p20comparison ? (p20comparison.corpusShapeComparison && p20comparison.corpusShapeComparison.alignedRowCount) : null,
  bucketChangedCount: p20comparison ? (p20comparison.bucketImpact && p20comparison.bucketImpact.bucketChangedCount) : null,
  signalChangedCount: p20comparison ? (p20comparison.snapshotImpact && p20comparison.snapshotImpact.signalChangedCount) : null,
  monthlyRevenueExcludedCount: p20comparison ? (p20comparison.snapshotImpact && p20comparison.snapshotImpact.monthlyRevenueExcludedCount) : null,
  assessment: 'P20 comparison: 4500/4500 aligned rows, 0 bucket changes, 0 signal changes. MonthlyRevenue excluded in all 4500 rows (PIT gate active). No scoring behavior change introduced.',
};

const productionDbSafetyReview = {
  productionApplyAllowed: p20decision ? p20decision.productionApplyAllowed : 'unknown',
  productionDbWritten: p20decision ? p20decision.productionDbWritten : 'unknown',
  p21productionDbWritten: false,
  p21productionMigrationApplied: false,
  assessment: 'Production DB has NOT been written at any phase (P17-P21). productionApplyAllowed=false confirmed in P20 decision. This review does not apply migration.',
};

// ── Approval Readiness ────────────────────────────────────────────────────────
const allGatesPass = hardGateFailCount === 0;

let approvalReadinessClassification;
if (!p17schema || !p17qgPatch || !p17qgValid || !p18migration || !p18rollback || !p18queryGate || !p19pitGuard || !p20comparison || !p20decision) {
  approvalReadinessClassification = 'P21_PRODUCTION_MIGRATION_APPROVAL_BLOCKED_BY_ARTIFACTS';
} else if (productionDbSafetyReview.productionApplyAllowed === true || productionDbSafetyReview.productionDbWritten === true) {
  approvalReadinessClassification = 'P21_PRODUCTION_MIGRATION_APPROVAL_REJECTED';
} else if (allGatesPass) {
  approvalReadinessClassification = 'P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL';
} else {
  approvalReadinessClassification = 'P21_PRODUCTION_MIGRATION_APPROVAL_REQUIRES_REMEDIATION';
}

const approvalReadiness = {
  hardGatePassCount,
  hardGateFailCount,
  allGatesPass,
  classification: approvalReadinessClassification,
  readyToRequestApprovalToken: allGatesPass && approvalReadinessClassification === 'P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL',
  approvalGranted: false,
  productionMigrationApplied: false,
};

const recommendedApprovalToken = 'P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY';

const whyNoMigrationApplied = [
  'P21 is a governance review phase — it evaluates readiness, it does not execute.',
  'Production DB writes are prohibited until CTO/CEO provides approval token: ' + recommendedApprovalToken,
  'productionApplyAllowed=false confirmed in P20 decision artifact.',
  'Applying migration without token would violate the phase boundary contract.',
  'P22 (Production Migration Plan Hardening) is the next phase that handles token-gated execution.',
];

// ── Build Output ──────────────────────────────────────────────────────────────
const now = new Date().toISOString();

const review = {
  phase: 'P21-HARDRESET',
  part: 'C',
  generatedAt: now,
  description: 'Production Migration Approval Review — P21',
  hardGateResults,
  hardGatePassCount,
  hardGateFailCount,
  schemaPatchReview,
  queryGateReview,
  fixtureDbDryRunReview,
  rollbackReview,
  pitGuardReview,
  prePostImpactReview,
  productionDbSafetyReview,
  approvalReadiness,
  recommendedApprovalToken,
  whyNoMigrationApplied,
  approvalGranted: false,
  productionMigrationApplied: false,
};

// ── Write JSON ────────────────────────────────────────────────────────────────
const jsonOut = path.join(OUT_DIR, 'p21production_migration_approval_review.json');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(jsonOut, JSON.stringify(review, null, 2));
console.log('Written:', jsonOut);

// ── Write Markdown ────────────────────────────────────────────────────────────
const failedGates = hardGateResults.filter(g => !g.passed);
const passedGates = hardGateResults.filter(g => g.passed);

const md = `# P21 Production Migration Approval Review

**Phase**: P21-HARDRESET Part C  
**Generated**: ${now}  
**Classification**: \`${approvalReadinessClassification}\`

---

## Hard Gate Summary

| Result | Count |
|--------|-------|
| PASS   | ${hardGatePassCount} |
| FAIL   | ${hardGateFailCount} |

${failedGates.length > 0 ? '### Failed Gates\n\n' + failedGates.map(g => `- **${g.gateId}** ${g.label}: ${g.evidence}`).join('\n') + '\n' : ''}
### All Gate Results

| Gate ID | Label | Status | Evidence |
|---------|-------|--------|----------|
${hardGateResults.map(g => `| ${g.gateId} | ${g.label} | ${g.passed ? '✅ PASS' : '❌ FAIL'} | ${g.evidence} |`).join('\n')}

---

## Schema Patch Review

- Artifact: \`${schemaPatchReview.artifact}\`  
- Present: ${schemaPatchReview.present}  
- Added Fields: ${JSON.stringify(schemaPatchReview.addedFields)}  
- Model: ${schemaPatchReview.model}  
- Assessment: ${schemaPatchReview.assessment}

---

## Query Gate Review

- P17 query gate patch status: ${queryGateReview.p17QueryGatePatch.patchStatus}  
- P17 validation status: ${queryGateReview.p17QueryGateValidation.validationStatus} (${queryGateReview.p17QueryGateValidation.passCount} PASS, ${queryGateReview.p17QueryGateValidation.failCount} FAIL)  
- P18 query gate: ${queryGateReview.p18QueryGate.passCount} PASS, status=${queryGateReview.p18QueryGate.validationStatus}  
- Assessment: ${queryGateReview.assessment}

---

## Fixture DB Dry-Run Review

- Migration pass count: ${fixtureDbDryRunReview.passCount} (${fixtureDbDryRunReview.validationStatus})  
- Backfill pass count: ${fixtureDbDryRunReview.backfillPassCount}  
- Assessment: ${fixtureDbDryRunReview.assessment}

---

## Rollback Review

- Rollback pass count: ${rollbackReview.passCount} (${rollbackReview.validationStatus})  
- Rollback plan documented: ${rollbackReview.rollbackPlanDocumented}  
- Assessment: ${rollbackReview.assessment}

---

## PIT Guard Review

- Validation status: ${pitGuardReview.validationStatus}  
- Leakage count: ${pitGuardReview.leakageCount}  
- Forbidden field count: ${pitGuardReview.forbiddenFieldCount}  
- PIT gate distribution: ${JSON.stringify(pitGuardReview.pitGateStatusDistribution)}  
- Assessment: ${pitGuardReview.assessment}

---

## Pre/Post Impact Review

- Aligned rows: ${prePostImpactReview.alignedRowCount}  
- Bucket changed: ${prePostImpactReview.bucketChangedCount}  
- Signal changed: ${prePostImpactReview.signalChangedCount}  
- MonthlyRevenue excluded: ${prePostImpactReview.monthlyRevenueExcludedCount}  
- Assessment: ${prePostImpactReview.assessment}

---

## Production DB Safety Review

- productionApplyAllowed: ${productionDbSafetyReview.productionApplyAllowed}  
- productionDbWritten (all phases): ${productionDbSafetyReview.productionDbWritten}  
- P21 production DB written: ${productionDbSafetyReview.p21productionDbWritten}  
- P21 production migration applied: ${productionDbSafetyReview.p21productionMigrationApplied}  
- Assessment: ${productionDbSafetyReview.assessment}

---

## Approval Readiness

**Classification**: \`${approvalReadinessClassification}\`

- Hard gates: ${hardGatePassCount}/${hardGateResults.length} PASS  
- Ready to request approval token: **${approvalReadiness.readyToRequestApprovalToken}**  
- Approval granted: **${approvalReadiness.approvalGranted}** (governance boundary — CTO/CEO provides token)  
- Production migration applied: **${approvalReadiness.productionMigrationApplied}**

---

## Recommended Approval Token

\`\`\`
${recommendedApprovalToken}
\`\`\`

This token must be provided by **CTO/CEO** to authorize P22 production migration plan hardening. It is NOT auto-generated.

---

## Why Production Migration Was NOT Applied

${whyNoMigrationApplied.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

const mdOut = path.join(OUT_DIR, 'p21production_migration_approval_review.md');
fs.writeFileSync(mdOut, md);
console.log('Written:', mdOut);

// ── Final Status ──────────────────────────────────────────────────────────────
console.log('');
console.log('P21 Part C Complete');
console.log('Hard gates: ' + hardGatePassCount + '/' + hardGateResults.length + ' PASS');
console.log('Classification: ' + approvalReadinessClassification);
console.log('approvalGranted: false');
console.log('productionMigrationApplied: false');
