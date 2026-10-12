'use strict';
/**
 * P22-HARDRESET Part F
 * Go / No-Go Decision Artifact
 *
 * Inputs:
 *   - p22production_backup_restore_plan.json
 *   - p22production_migration_runbook.json
 *   - p22production_monitoring_checklist.json
 *   - p21production_migration_approval_decision.json
 *
 * Outputs:
 *   - p22production_migration_plan_decision.json
 *   - p22production_migration_plan_decision.md
 *
 * INVARIANTS:
 * - approvalGranted = false
 * - productionMigrationApplied = false
 * - Does not auto-execute migration
 */

const fs = require('fs');
const path = require('path');
const NOW = new Date().toISOString();
const OUT = 'outputs/online_validation';
const RECOMMENDED_NEXT_TOKEN = 'P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY';

// ─── Load inputs ──────────────────────────────────────────────────────────────
const backup = JSON.parse(fs.readFileSync(path.join(OUT, 'p22production_backup_restore_plan.json'), 'utf8'));
const runbook = JSON.parse(fs.readFileSync(path.join(OUT, 'p22production_migration_runbook.json'), 'utf8'));
const monitor = JSON.parse(fs.readFileSync(path.join(OUT, 'p22production_monitoring_checklist.json'), 'utf8'));
const p21Decision = JSON.parse(fs.readFileSync(path.join(OUT, 'p21production_migration_approval_decision.json'), 'utf8'));

// ─── Evaluate completeness ─────────────────────────────────────────────────────
const evaluations = [];

// Backup completeness
const backupComplete = !!(
  backup.backupPlan &&
  backup.backupPlan.scope &&
  Array.isArray(backup.backupPlan.scope.tables) &&
  backup.backupPlan.scope.tables.includes('MonthlyRevenue') &&
  backup.backupPlan.method &&
  backup.backupPlan.restoreMethod &&
  Array.isArray(backup.backupPlan.restoreMethod.steps) &&
  backup.backupPlan.restoreMethod.steps.length >= 5 &&
  backup.backupPlan.restoreMethod.verifyReleaseDateField === true
);
evaluations.push({ check: 'backupComplete', result: backupComplete, reason: backupComplete ? 'backup plan complete with MonthlyRevenue scope and restore steps' : 'backup plan incomplete' });

// Restore completeness
const restoreComplete = !!(
  backup.restorePlan &&
  Array.isArray(backup.restorePlan.steps) &&
  backup.restorePlan.steps.length >= 5 &&
  Array.isArray(backup.restorePlan.verificationSteps) &&
  backup.restorePlan.verificationSteps.length >= 4 &&
  backup.restorePlan.requiresApproval === true
);
evaluations.push({ check: 'restoreComplete', result: restoreComplete, reason: restoreComplete ? 'restore plan complete with verification steps' : 'restore plan missing verification steps' });

// Rollback completeness
const rollbackComplete = !!(
  backup.rollbackTrigger &&
  Array.isArray(backup.rollbackTrigger.triggers) &&
  backup.rollbackTrigger.triggers.length >= 5 &&
  backup.rollbackTrigger.requiresManualApproval === true
);
evaluations.push({ check: 'rollbackComplete', result: rollbackComplete, reason: rollbackComplete ? 'rollback triggers defined with manual approval requirement' : 'rollback triggers missing or auto-trigger not disabled' });

// Runbook completeness
const runbookComplete = !!(
  runbook.runbookSteps &&
  Array.isArray(runbook.runbookSteps) &&
  runbook.runbookSteps.length >= 10 &&
  runbook.runbookSteps.some(s => s.goNoGoCheckpoint) &&
  runbook.runbookSteps.some(s => s.isPlaceholder && s.stepId === 'R06') && // migration apply is placeholder
  runbook.requiredApprovalTokenForP23 === RECOMMENDED_NEXT_TOKEN
);
evaluations.push({ check: 'runbookComplete', result: runbookComplete, reason: runbookComplete ? 'runbook complete with go/no-go checkpoints and placeholder production commands' : 'runbook incomplete' });

// Monitoring completeness
const monitoringComplete = !!(
  monitor.checklistItems &&
  Array.isArray(monitor.checklistItems) &&
  monitor.checklistItems.length >= 13 &&
  monitor.includesQueryGateSmokeCheck === true &&
  monitor.includesReleaseDateNullRateCheck === true &&
  monitor.includesNoLeakageCheck === true &&
  monitor.includesRollbackReadinessCheck === true
);
evaluations.push({ check: 'monitoringComplete', result: monitoringComplete, reason: monitoringComplete ? 'monitoring checklist complete with all required checks' : 'monitoring checklist incomplete' });

// Validation checklist completeness
const validationComplete = !!(
  monitor.checklistItems &&
  monitor.checklistItems.some(i => i.itemId === 'MON-08') && // query gate smoke
  monitor.checklistItems.some(i => i.itemId === 'MON-13') && // no-leakage
  monitor.checklistItems.some(i => i.itemId === 'MON-09') && // RuleBasedStockAnalyzer
  monitor.checklistItems.some(i => i.itemId === 'MON-10') && // FundamentalResearchService
  monitor.checklistItems.some(i => i.itemId === 'MON-11')    // ActiveScoringSnapshot
);
evaluations.push({ check: 'validationComplete', result: validationComplete, reason: validationComplete ? 'validation checklist complete with smoke tests and PIT checks' : 'validation checklist missing required items' });

// Safety check
const safetyValid = !!(
  backup.approvalGranted === false &&
  backup.productionMigrationApplied === false &&
  runbook.approvalGranted === false &&
  runbook.productionMigrationApplied === false &&
  p21Decision.classification === 'P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL' &&
  p21Decision.approvalGranted === false
);
evaluations.push({ check: 'safetyValid', result: safetyValid, reason: safetyValid ? 'all safety invariants confirmed' : 'safety invariant violated — plan rejected' });

// ─── Classification ───────────────────────────────────────────────────────────
let classification;
const reasons = [];

if (!safetyValid) {
  classification = 'P22_PLAN_REJECTED';
  reasons.push('Safety validation failed — plan rejected');
} else if (!backupComplete) {
  classification = 'P22_PLAN_REQUIRES_BACKUP_DETAIL';
  reasons.push('Backup plan incomplete — requires additional detail before P23 review');
} else if (!restoreComplete) {
  classification = 'P22_PLAN_REQUIRES_RESTORE_DETAIL';
  reasons.push('Restore plan incomplete — requires verification steps before P23 review');
} else if (!rollbackComplete) {
  classification = 'P22_PLAN_REQUIRES_ROLLBACK_DETAIL';
  reasons.push('Rollback runbook incomplete — requires rollback triggers before P23 review');
} else if (!monitoringComplete || !validationComplete) {
  classification = 'P22_PLAN_REQUIRES_MONITORING_DETAIL';
  reasons.push('Monitoring checklist incomplete — requires additional items before P23 review');
} else {
  classification = 'P22_PLAN_HARDENING_COMPLETE_READY_FOR_P23_REVIEW';
  reasons.push('All plan components complete — ready to request P23 production migration implementation review');
  reasons.push(`Next phase requires explicit token: ${RECOMMENDED_NEXT_TOKEN}`);
  reasons.push('P23 reviews implementation plan — does not auto-execute production migration');
  reasons.push('Production migration execution requires a separate deployment approval beyond P23');
}

const readyForP23Review = classification === 'P22_PLAN_HARDENING_COMPLETE_READY_FOR_P23_REVIEW';

const artifact = {
  phase: 'P22',
  part: 'F',
  generatedAt: NOW,
  description: 'Go/No-Go decision for P22 production migration plan hardening',
  classification,
  backupComplete,
  restoreComplete,
  rollbackComplete,
  runbookComplete,
  monitoringComplete,
  validationComplete,
  safetyValid,
  readyForP23Review,
  approvalGranted: false,
  productionMigrationApplied: false,
  recommendedNextToken: RECOMMENDED_NEXT_TOKEN,
  reasons,
  evaluations,
  p21ClassificationVerified: p21Decision.classification,
  inputArtifacts: [
    'p22production_backup_restore_plan.json',
    'p22production_migration_runbook.json',
    'p22production_monitoring_checklist.json',
    'p21production_migration_approval_decision.json',
  ],
};

fs.writeFileSync(path.join(OUT, 'p22production_migration_plan_decision.json'), JSON.stringify(artifact, null, 2));

// ─── Markdown ─────────────────────────────────────────────────────────────────
const statusMark = (v) => v ? 'PASS' : 'FAIL';

const md = `# P22-HARDRESET Part F — Go/No-Go Decision

**Generated**: ${NOW}  
**Classification**: \`${classification}\`

## Decision Summary

| Check | Status | Reason |
|-------|--------|--------|
${evaluations.map(e => `| ${e.check} | ${statusMark(e.result)} | ${e.reason} |`).join('\n')}

## Classification

\`\`\`
${classification}
\`\`\`

## Key Fields

| Field | Value |
|-------|-------|
| \`readyForP23Review\` | ${readyForP23Review} |
| \`approvalGranted\` | false |
| \`productionMigrationApplied\` | false |
| \`recommendedNextToken\` | \`${RECOMMENDED_NEXT_TOKEN}\` |

## Reasons

${reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## Required Approver Action

To proceed to P23 Production Migration Implementation Review, CTO/CEO must provide:

\`\`\`
${RECOMMENDED_NEXT_TOKEN}
\`\`\`

> **Note**: This token authorizes the P23 implementation review only.  
> It does NOT authorize production migration execution.  
> Production migration execution requires a separate deployment approval.

## Input Artifacts

${artifact.inputArtifacts.map(f => `- \`${f}\``).join('\n')}

## Safety Invariants

| Invariant | Value |
|-----------|-------|
| \`approvalGranted\` | false |
| \`productionMigrationApplied\` | false |
| P21 classification verified | \`${p21Decision.classification}\` |
`;

fs.writeFileSync(path.join(OUT, 'p22production_migration_plan_decision.md'), md);

console.log('P22 Part F: go/no-go decision written');
console.log('  p22production_migration_plan_decision.json');
console.log('  p22production_migration_plan_decision.md');
console.log('  classification:', classification);
console.log('  readyForP23Review:', readyForP23Review);
console.log('  approvalGranted: false');
console.log('  productionMigrationApplied: false');
console.log('');
if (!readyForP23Review) {
  console.log('INCOMPLETE — missing plan components:');
  evaluations.filter(e => !e.result).forEach(e => console.log(' ', e.check, ':', e.reason));
  process.exit(1);
}
