'use strict';
/**
 * P21-HARDRESET Part E
 * Decide Production Migration Approval
 *
 * Reads:
 *   outputs/online_validation/p21production_migration_approval_review.json
 *   outputs/online_validation/p21production_migration_risk_register.json
 *
 * Outputs:
 *   outputs/online_validation/p21production_migration_approval_decision.json
 *   outputs/online_validation/p21production_migration_approval_decision.md
 *
 * CONSTRAINTS:
 * - Does NOT write to production DB
 * - Does NOT apply production migration
 * - Does NOT auto-generate production approval
 * - approvalGranted is always false
 * - productionMigrationApplied is always false
 * - recommendedApprovalToken must be provided by CTO/CEO, not auto-generated
 */

'use strict';
const fs = require('fs');
const path = require('path');

const OUT_DIR = 'outputs/online_validation';

function loadArtifact(name) {
  const p = path.join(OUT_DIR, name + '.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const review  = loadArtifact('p21production_migration_approval_review');
const risks   = loadArtifact('p21production_migration_risk_register');

if (!review) throw new Error('Missing: p21production_migration_approval_review.json — run Part C first');
if (!risks)  throw new Error('Missing: p21production_migration_risk_register.json — run Part D first');

const now = new Date().toISOString();

// ── Derive Facts ──────────────────────────────────────────────────────────────
const reviewClassification   = review.approvalReadiness && review.approvalReadiness.classification;
const reviewAllGatesPass     = review.approvalReadiness && review.approvalReadiness.allGatesPass;
const reviewHardGatePassCount = review.approvalReadiness && review.approvalReadiness.hardGatePassCount;
const reviewHardGateFailCount = review.approvalReadiness && review.approvalReadiness.hardGateFailCount;
const productionApplyAllowed = review.productionDbSafetyReview && review.productionDbSafetyReview.productionApplyAllowed;
const productionDbWritten    = review.productionDbSafetyReview && review.productionDbSafetyReview.productionDbWritten;

const criticalRequiredCount   = risks.requiredBeforeProductionCount;
const criticalRequiredRiskIds = risks.summary && risks.summary.requiredBeforeProduction;

// ── Decision Logic ────────────────────────────────────────────────────────────
// Hard safety rejection first
let classification;
let readyToRequestApprovalToken = false;
let decisionRationale;

if (!reviewAllGatesPass) {
  if (productionApplyAllowed === true || productionDbWritten === true) {
    classification = 'P21_PRODUCTION_MIGRATION_APPROVAL_REJECTED';
    decisionRationale = 'Production DB safety violation detected. productionApplyAllowed or productionDbWritten is true.';
  } else {
    classification = 'P21_PRODUCTION_MIGRATION_APPROVAL_REQUIRES_REMEDIATION';
    decisionRationale = 'Hard gate failures: ' + reviewHardGateFailCount + '. Remediation required before approval review can proceed.';
  }
} else if (reviewClassification === 'P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL') {
  classification = 'P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL';
  readyToRequestApprovalToken = true;
  decisionRationale = 'All ' + reviewHardGatePassCount + ' hard gates PASS. Production DB safety confirmed. Risk register complete. Ready to request CTO/CEO approval token.';
} else {
  classification = reviewClassification || 'P21_PRODUCTION_MIGRATION_APPROVAL_REQUIRES_REMEDIATION';
  decisionRationale = 'Review classification: ' + reviewClassification;
}

const recommendedApprovalToken = 'P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY';

// ── Required Actions Before Token Use ────────────────────────────────────────
const requiredActionsBeforeTokenUse = [
  {
    actionId: 'ACT-01',
    description: 'Document production DB backup procedure (RISK-02)',
    owner: 'DevOps / Engineering Lead',
    blocksTokenUse: true,
  },
  {
    actionId: 'ACT-02',
    description: 'Define and test production rollback runbook on staging (RISK-08)',
    owner: 'Engineering Lead / DevOps',
    blocksTokenUse: true,
  },
  {
    actionId: 'ACT-03',
    description: 'Run migration on staging environment before production (RISK-01)',
    owner: 'Engineering Lead',
    blocksTokenUse: true,
  },
  {
    actionId: 'ACT-04',
    description: 'CTO/CEO review this P21 report and explicitly provide approval token',
    owner: 'CTO / CEO',
    blocksTokenUse: true,
  },
];

// ── Build Decision ────────────────────────────────────────────────────────────
const decision = {
  phase: 'P21-HARDRESET',
  part: 'E',
  generatedAt: now,
  description: 'Production Migration Approval Decision — P21',
  classification,
  readyToRequestApprovalToken,
  approvalGranted: false,
  productionMigrationApplied: false,
  recommendedApprovalToken,
  hardGatePassCount: reviewHardGatePassCount,
  hardGateFailCount: reviewHardGateFailCount,
  riskCount: risks.riskCount,
  criticalHighRiskCount: risks.criticalHighRiskCount,
  requiredBeforeProductionCount: criticalRequiredCount,
  requiredBeforeProductionRiskIds: criticalRequiredRiskIds,
  decisionRationale,
  requiredActionsBeforeTokenUse,
  productionSafetyStatement: [
    'Production DB has NOT been written at any phase (P17-P21)',
    'productionApplyAllowed=false confirmed in P20 decision',
    'productionMigrationApplied=false in this decision',
    'approvalGranted=false — token must come from CTO/CEO',
    'P22 is the next phase: Production Migration Plan Hardening (requires approval token)',
  ],
  noProductionWriteStatement: 'This script and all P21 artifacts do NOT write to, modify, or apply any changes to the production database. Production migration is deferred to P22 pending CTO/CEO approval token.',
  reviewArtifact: 'p21production_migration_approval_review.json',
  riskArtifact: 'p21production_migration_risk_register.json',
};

// ── Write JSON ────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
const jsonOut = path.join(OUT_DIR, 'p21production_migration_approval_decision.json');
fs.writeFileSync(jsonOut, JSON.stringify(decision, null, 2));
console.log('Written:', jsonOut);

// ── Write Markdown ────────────────────────────────────────────────────────────
const statusIcon = classification === 'P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL' ? '✅' : '⚠️';

const md = `# P21 Production Migration Approval Decision

**Phase**: P21-HARDRESET Part E  
**Generated**: ${now}

---

## Decision

${statusIcon} **Classification**: \`${classification}\`

| Field | Value |
|-------|-------|
| approvalGranted | **false** |
| productionMigrationApplied | **false** |
| readyToRequestApprovalToken | **${readyToRequestApprovalToken}** |
| Hard Gates | ${reviewHardGatePassCount}/${(reviewHardGatePassCount + reviewHardGateFailCount)} PASS |
| Risk Count | ${risks.riskCount} |
| Critical/High Risks | ${risks.criticalHighRiskCount} |
| Required Before Production | ${criticalRequiredCount} (${criticalRequiredRiskIds && criticalRequiredRiskIds.join(', ')}) |

**Rationale**: ${decisionRationale}

---

## Recommended Approval Token

\`\`\`
${recommendedApprovalToken}
\`\`\`

This token **must be provided by CTO/CEO**. It is NOT auto-generated.  
P22 (Production Migration Plan Hardening) requires this token to proceed.

---

## Required Actions Before Token Use

| Action ID | Description | Owner | Blocks Token Use |
|-----------|-------------|-------|-----------------|
${requiredActionsBeforeTokenUse.map(a => `| ${a.actionId} | ${a.description} | ${a.owner} | ${a.blocksTokenUse ? '✅ YES' : 'No'} |`).join('\n')}

---

## Production Safety Statement

${decision.productionSafetyStatement.map((s, i) => `${i + 1}. ${s}`).join('\n')}

---

## No Production Write Statement

> ${decision.noProductionWriteStatement}

---

## Input Artifacts

- Review: \`${decision.reviewArtifact}\`
- Risk Register: \`${decision.riskArtifact}\`

---

## Next Phase

**P22**: Production Migration Plan Hardening  
Requires: CTO/CEO approval token \`${recommendedApprovalToken}\`
`;

const mdOut = path.join(OUT_DIR, 'p21production_migration_approval_decision.md');
fs.writeFileSync(mdOut, md);
console.log('Written:', mdOut);

console.log('');
console.log('P21 Part E Complete');
console.log('Classification:', classification);
console.log('readyToRequestApprovalToken:', readyToRequestApprovalToken);
console.log('approvalGranted: false');
console.log('productionMigrationApplied: false');
