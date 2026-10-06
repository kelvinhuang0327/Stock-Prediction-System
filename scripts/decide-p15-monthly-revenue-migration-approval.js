'use strict';
/**
 * decide-p15-monthly-revenue-migration-approval.js
 *
 * PART E — P15 Approval Decision Artifact
 *
 * DISCLAIMER: Does not constitute investment advice. Governance / review only.
 * No production DB writes. No automatic approval granted. approvalGranted is
 * hardcoded false — cannot be overridden by any input.
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
});
require('tsconfig-paths').register({
  baseUrl: require('path').resolve(__dirname, '..'),
  paths: { '@/*': ['src/*'] },
});

const fs = require('fs');
const path = require('path');
const {
  buildApprovalDecision,
} = require('../src/lib/onlineValidation/P15MigrationApprovalReviewUtils');

const OUT = 'outputs/online_validation';

// ---------------------------------------------------------------------------
// Load inputs
// ---------------------------------------------------------------------------

const review = JSON.parse(fs.readFileSync(path.join(OUT, 'p15migration_approval_review.json'), 'utf8'));
const riskRegister = JSON.parse(fs.readFileSync(path.join(OUT, 'p15migration_risk_register.json'), 'utf8'));
const migrationDraft = JSON.parse(fs.readFileSync(path.join(OUT, 'p14monthly_revenue_migration_draft.json'), 'utf8'));
const queryGateProposal = JSON.parse(fs.readFileSync(path.join(OUT, 'p14monthly_revenue_query_gate_proposal.json'), 'utf8'));
const fixtureDryRun = JSON.parse(fs.readFileSync(path.join(OUT, 'p14monthly_revenue_fixture_dry_run.json'), 'utf8'));
const preflight = JSON.parse(fs.readFileSync(path.join(OUT, 'p14monthly_revenue_approval_preflight.json'), 'utf8'));

const rollbackDraft = {
  rollbackId: 'p14-monthly-revenue-rollback-draft-v0',
  strategies: [
    { name: 'Strategy A', description: 'Set releaseDate fields to NULL (soft rollback)' },
    { name: 'Strategy B', description: 'DROP releaseDate columns (hard rollback, irreversible)' },
  ],
  productionApplyAllowed: false,
};

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

const inputs = { migrationDraft, rollbackDraft, queryGateProposal, fixtureDryRun, preflight, riskRegister };
const decision = buildApprovalDecision(inputs);

// Verify approvalGranted is never true (invariant check)
if (decision.approvalGranted !== false) {
  throw new Error('INVARIANT VIOLATION: approvalGranted must always be false');
}
if (decision.productionApplyAllowed !== false) {
  throw new Error('INVARIANT VIOLATION: productionApplyAllowed must always be false');
}

const output = {
  ...decision,
  phase: 'P15',
  reviewDate: '2026-05-12',
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. Governance / review only. No production DB writes. No automatic approval granted.',
  riskRegisterRef: riskRegister.registerId,
  highSeverityRisks: riskRegister.highSeverityCount,
  mitigatedHighRisks: riskRegister.mitigatedHighCount,
  blockerCount: riskRegister.blockerCount,
  productionDbWritten: false,
};

fs.writeFileSync(path.join(OUT, 'p15migration_approval_decision.json'), JSON.stringify(output, null, 2), 'utf8');
console.log('Written: p15migration_approval_decision.json');

// Markdown
const md = `# P15 Migration Approval Decision

> **Disclaimer:** Does not constitute investment advice. Governance / review only. No production DB writes. No automatic approval granted.

**Phase:** P15  
**Decision ID:** ${decision.decisionId}  
**Review Date:** 2026-05-12

---

## Decision

| Field | Value |
|-------|-------|
| **Classification** | \`${decision.classification}\` |
| **approvalGranted** | ❌ \`false\` (hardcoded — cannot be overridden) |
| **productionApplyAllowed** | ❌ \`false\` (hardcoded) |
| **readyToRequestToken** | ${decision.readyToRequestToken ? '✅ YES' : '❌ NO'} |
| **productionDbWritten** | ❌ false |

---

## Rationale

${decision.rationale}

---

## Required Approver Action

${decision.requiredApproverAction}

---

## Approval Token (Text Reference Only)

\`\`\`
${decision.approvalTokenRequired}
\`\`\`

> **Important:** This artifact does NOT grant approval. The token above is a text reference for the human operator (CTO/CEO) to review and optionally provide in P16.

---

## Risk Register Summary

**HIGH severity risks:** ${riskRegister.highSeverityCount}  
**Mitigated HIGH risks:** ${riskRegister.mitigatedHighCount}  
**Hard blockers:** ${riskRegister.blockerCount}

---

## Gate Results (Summary)

| Gate | Pass | Detail |
|------|------|--------|
${(review.gateResults || []).map((g) => `| ${g.gate} | ${g.pass ? '✅' : '❌'} | ${g.detail} |`).join('\n')}

---

**approvalGranted:** false (hardcoded)  
**productionDbWritten:** false  
**Final Classification:** \`${decision.classification}\`

> This decision was computed deterministically. It does not auto-approve migration.
> CTO/CEO must provide explicit token to proceed to P16.
`;

fs.writeFileSync(path.join(OUT, 'p15migration_approval_decision.md'), md, 'utf8');
console.log('Written: p15migration_approval_decision.md');

console.log('\n=== P15 Approval Decision ===');
console.log('Classification:', decision.classification);
console.log('approvalGranted:', decision.approvalGranted);
console.log('readyToRequestToken:', decision.readyToRequestToken);
console.log('productionApplyAllowed:', decision.productionApplyAllowed);
console.log('productionDbWritten:', output.productionDbWritten);
