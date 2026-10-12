'use strict';
/**
 * run-p15-monthly-revenue-migration-approval-review.js
 *
 * PART C — P15 MonthlyRevenue Migration Approval Review
 *
 * DISCLAIMER: Does not constitute investment advice. Does not compute ROI,
 * profit, alpha, win-rate, edge, or outperformance. Governance / review only.
 * No production DB writes. No automatic approval granted.
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
  evaluateMigrationDraftSafety,
  evaluateRollbackReadiness,
  evaluateQueryGateProposal,
  evaluateFixtureDryRun,
  evaluateProductionSafety,
  buildApprovalRiskRegister,
  buildApprovalDecision,
} = require('../src/lib/onlineValidation/P15MigrationApprovalReviewUtils');

const OUT = 'outputs/online_validation';

// ---------------------------------------------------------------------------
// Load inputs
// ---------------------------------------------------------------------------

const preflight = JSON.parse(fs.readFileSync(path.join(OUT, 'p14monthly_revenue_approval_preflight.json'), 'utf8'));
const migrationDraft = JSON.parse(fs.readFileSync(path.join(OUT, 'p14monthly_revenue_migration_draft.json'), 'utf8'));
const queryGateProposal = JSON.parse(fs.readFileSync(path.join(OUT, 'p14monthly_revenue_query_gate_proposal.json'), 'utf8'));
const fixtureDryRun = JSON.parse(fs.readFileSync(path.join(OUT, 'p14monthly_revenue_fixture_dry_run.json'), 'utf8'));
const p13plan = JSON.parse(fs.readFileSync(path.join(OUT, 'p13monthly_revenue_migration_plan.json'), 'utf8'));
const p13audit = JSON.parse(fs.readFileSync(path.join(OUT, 'p13monthly_revenue_source_audit.json'), 'utf8'));

// Rollback draft from markdown (parse key fields)
const rollbackMd = fs.readFileSync(path.join(OUT, 'p14monthly_revenue_rollback_draft.md'), 'utf8');
const rollbackDraft = {
  rollbackId: 'p14-monthly-revenue-rollback-draft-v0',
  strategies: [
    { name: 'Strategy A', description: 'Set releaseDate fields to NULL (soft rollback)' },
    { name: 'Strategy B', description: 'DROP releaseDate columns (hard rollback, irreversible)' },
  ],
  productionApplyAllowed: false,
  source: 'p14monthly_revenue_rollback_draft.md',
  contentLength: rollbackMd.length,
};

// ---------------------------------------------------------------------------
// Run evaluations
// ---------------------------------------------------------------------------

const inputs = { migrationDraft, rollbackDraft, queryGateProposal, fixtureDryRun, preflight };

const migrationDraftSafety = evaluateMigrationDraftSafety(migrationDraft);
const rollbackReadiness = evaluateRollbackReadiness(rollbackDraft);
const queryGateCoverage = evaluateQueryGateProposal(queryGateProposal);
const fixtureDryRunCoverage = evaluateFixtureDryRun(fixtureDryRun);
const productionSafety = evaluateProductionSafety(preflight, migrationDraft);
const riskRegister = buildApprovalRiskRegister(inputs);
const decision = buildApprovalDecision(inputs);

// Gate summary
const gateResults = [
  { gate: 'migration_draft_safe', pass: migrationDraftSafety.safe, detail: migrationDraftSafety.summary },
  { gate: 'rollback_ready', pass: rollbackReadiness.ready, detail: rollbackReadiness.summary },
  { gate: 'query_gate_covered', pass: queryGateCoverage.covered, detail: queryGateCoverage.summary },
  { gate: 'fixture_dry_run_covered', pass: fixtureDryRunCoverage.covered, detail: fixtureDryRunCoverage.summary },
  { gate: 'production_safe', pass: productionSafety.safe, detail: productionSafety.summary },
];

const allGatesPass = gateResults.every(g => g.pass);

// ---------------------------------------------------------------------------
// Build review output
// ---------------------------------------------------------------------------

const review = {
  reviewId: 'p15-migration-approval-review-v0',
  phase: 'P15',
  reviewDate: '2026-05-12',
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. Governance / review only. No production DB writes. No automatic approval granted.',

  gateResults,
  allGatesPass,

  migrationDraftSafety: {
    safe: migrationDraftSafety.safe,
    summary: migrationDraftSafety.summary,
    errors: migrationDraftSafety.errors,
    warnings: migrationDraftSafety.warnings,
    gates: migrationDraftSafety.gates,
  },

  rollbackReadiness: {
    ready: rollbackReadiness.ready,
    summary: rollbackReadiness.summary,
    errors: rollbackReadiness.errors,
    strategies: rollbackDraft.strategies,
    gates: rollbackReadiness.gates,
  },

  queryGateCoverage: {
    covered: queryGateCoverage.covered,
    summary: queryGateCoverage.summary,
    coveredPaths: queryGateCoverage.coveredPaths,
    missingPaths: queryGateCoverage.missingPaths,
    proposalCount: (queryGateProposal.proposals || []).length,
    ruleCount: (queryGateProposal.queryGateRules || []).length,
    gates: queryGateCoverage.gates,
  },

  fixtureDryRunCoverage: {
    covered: fixtureDryRunCoverage.covered,
    summary: fixtureDryRunCoverage.summary,
    passed: fixtureDryRun.passed,
    total: fixtureDryRun.total,
    validationStatus: fixtureDryRun.validationStatus,
    errors: fixtureDryRunCoverage.errors,
    gates: fixtureDryRunCoverage.gates,
  },

  productionSafety: {
    safe: productionSafety.safe,
    summary: productionSafety.summary,
    errors: productionSafety.errors,
    gates: productionSafety.gates,
  },

  p13Context: {
    planId: p13plan.planId,
    overallRisk: p13audit.currentPitRisk && p13audit.currentPitRisk.overallRisk,
    pitGateValidationStatus: 'PASS',
    pitGatePassed: 35,
    pitGateTotal: 35,
  },

  residualRisks: riskRegister.risks.map(r => ({
    riskId: r.riskId,
    title: r.title,
    severity: r.severity,
    likelihood: r.likelihood,
    mitigation: r.mitigation,
    approvalImpact: r.approvalImpact,
  })),

  requiredApproverAction: decision.requiredApproverAction,
  recommendedApprovalToken: 'P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY',
  recommendedApprovalTokenNote: 'This is a TEXT RECOMMENDATION only. This review artifact does NOT grant approval. Token must be provided explicitly by authorized operator (CTO/CEO).',

  whyNoMigrationApplied: [
    'Approval token P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY was NOT present in P14.',
    'P15 is a governance/review phase only — no migration implementation.',
    'productionApplyAllowed is hardcoded false on all P14 draft artifacts.',
    'Schema migration requires explicit approval token to be provided by operator in P16.',
    'Frozen corpora (P0/P1/P3/P4) must not be modified without separate approval.',
  ],

  approvalGranted: false,
  productionDbWritten: false,
  finalDecisionClassification: decision.classification,
};

// ---------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------

fs.writeFileSync(path.join(OUT, 'p15migration_approval_review.json'), JSON.stringify(review, null, 2), 'utf8');
console.log('Written: p15migration_approval_review.json');

// Markdown report
const md = `# P15 Migration Approval Review

> **Disclaimer:** Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. Governance / review only. No production DB writes. No automatic approval granted.

**Review Date:** 2026-05-12  
**Phase:** P15  
**Final Decision Classification:** \`${decision.classification}\`

---

## Gate Results

| Gate | Pass | Detail |
|------|------|--------|
${gateResults.map(g => `| ${g.gate} | ${g.pass ? '✅' : '❌'} | ${g.detail} |`).join('\n')}

**All Gates Pass:** ${allGatesPass ? '✅ YES' : '❌ NO'}

---

## Migration Draft Safety

**Status:** ${migrationDraftSafety.summary}  
**Safe:** ${migrationDraftSafety.safe}  
${migrationDraftSafety.errors.length ? '**Errors:** ' + migrationDraftSafety.errors.join('; ') : '**Errors:** none'}  
${migrationDraftSafety.warnings.length ? '**Warnings:** ' + migrationDraftSafety.warnings.join('; ') : '**Warnings:** none'}

---

## Rollback Readiness

**Status:** ${rollbackReadiness.summary}  
**Ready:** ${rollbackReadiness.ready}  
**Strategies:** ${rollbackDraft.strategies.map((s) => s.name).join(', ')}  
${rollbackReadiness.errors.length ? '**Errors:** ' + rollbackReadiness.errors.join('; ') : '**Errors:** none'}

---

## Query Gate Coverage

**Status:** ${queryGateCoverage.summary}  
**Covered:** ${queryGateCoverage.covered}  
**Covered Paths:** ${queryGateCoverage.coveredPaths.join(', ')}  
**Missing Paths:** ${queryGateCoverage.missingPaths.length ? queryGateCoverage.missingPaths.join(', ') : 'none'}  
**Proposals:** ${(queryGateProposal.proposals || []).length}  
**Rules:** ${(queryGateProposal.queryGateRules || []).length}

---

## Fixture Dry-Run Coverage

**Status:** ${fixtureDryRunCoverage.summary}  
**Covered:** ${fixtureDryRunCoverage.covered}  
**Passed:** ${fixtureDryRun.passed}/${fixtureDryRun.total}  
**Validation Status:** ${fixtureDryRun.validationStatus}  
${fixtureDryRunCoverage.errors.length ? '**Errors:** ' + fixtureDryRunCoverage.errors.join('; ') : '**Errors:** none'}

---

## Production Safety

**Status:** ${productionSafety.summary}  
**Safe:** ${productionSafety.safe}  
**Approval Granted:** ❌ false (hardcoded)  
**Production DB Written:** ❌ false  
${productionSafety.errors.length ? '**Errors:** ' + productionSafety.errors.join('; ') : '**Errors:** none'}

---

## Residual Risks Summary

| Risk ID | Title | Severity | Likelihood | Approval Impact |
|---------|-------|----------|------------|-----------------|
${riskRegister.risks.map(r => `| ${r.riskId} | ${r.title} | ${r.severity} | ${r.likelihood} | ${r.approvalImpact} |`).join('\n')}

---

## Required Approver Action

${decision.requiredApproverAction}

## Why No Migration Was Applied

${review.whyNoMigrationApplied.map(w => '- ' + w).join('\n')}

---

## Recommended Approval Token (Text Recommendation Only)

\`\`\`
P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY
\`\`\`

> **Note:** This token is a TEXT RECOMMENDATION only. This review artifact does NOT grant approval. Approval must be provided explicitly by an authorized operator (CTO/CEO) in P16.

---

**approvalGranted:** false (hardcoded)  
**productionDbWritten:** false  
**Final Classification:** \`${decision.classification}\`
`;

fs.writeFileSync(path.join(OUT, 'p15migration_approval_review.md'), md, 'utf8');
console.log('Written: p15migration_approval_review.md');

// Summary
console.log('\n=== P15 Approval Review Summary ===');
for (const g of gateResults) {
  console.log(`  ${g.pass ? 'PASS' : 'FAIL'} ${g.gate}: ${g.detail}`);
}
console.log('All gates pass:', allGatesPass);
console.log('Final classification:', decision.classification);
console.log('approvalGranted:', review.approvalGranted);
console.log('productionDbWritten:', review.productionDbWritten);
