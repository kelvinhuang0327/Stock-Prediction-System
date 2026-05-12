#!/usr/bin/env node
'use strict';
/**
 * run-p23-production-migration-implementation-review.js
 *
 * P23 Part C — Build Implementation Package Review.
 *
 * Reads P22 artifacts and produces:
 *  - outputs/online_validation/p23production_migration_implementation_review.json
 *  - outputs/online_validation/p23production_migration_implementation_review.md
 *
 * Hard rules:
 *  - does NOT execute any production command
 *  - does NOT apply migration
 *  - approvalGranted = false always
 *  - productionMigrationApplied = false always
 */

const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const OUT = path.join(BASE, 'outputs', 'online_validation');
const now = new Date().toISOString();

// ---------------------------------------------------------------------------
// Read P22 artifacts
// ---------------------------------------------------------------------------
function readJson(rel) {
  const full = path.join(BASE, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing required artifact: ${rel}`);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

const backup = readJson('outputs/online_validation/p22production_backup_restore_plan.json');
const runbook = readJson('outputs/online_validation/p22production_migration_runbook.json');
const monitoring = readJson('outputs/online_validation/p22production_monitoring_checklist.json');
const p22Decision = readJson('outputs/online_validation/p22production_migration_plan_decision.json');
const p21Decision = readJson('outputs/online_validation/p21production_migration_approval_decision.json');

// ---------------------------------------------------------------------------
// Evaluate backup / restore
// ---------------------------------------------------------------------------
// backupPlan.scope is an object with .tables array
const backupScopeObj = (backup.backupPlan && backup.backupPlan.scope) || {};
const backupScope = Array.isArray(backupScopeObj.tables) ? backupScopeObj.tables
  : Array.isArray(backupScopeObj) ? backupScopeObj : [];
// restorePlan.steps
const restoreSteps = (backup.restorePlan && backup.restorePlan.steps) || [];
// checksumAlgorithm lives in backupPlan.method
const checksumAlgorithm = (backup.backupPlan && backup.backupPlan.method && backup.backupPlan.method.fileHashAlgorithm)
  || backup.checksumAlgorithm || backup.hashAlgorithm || '';
// rollbackTrigger.triggers
const rollbackTriggerObj = backup.rollbackTrigger || {};
const rollbackTriggers = Array.isArray(rollbackTriggerObj.triggers) ? rollbackTriggerObj.triggers : [];
const targetFields = backup.targetFields || [];
const autoTrigger = rollbackTriggerObj.autoTrigger === true;
// rollback steps — use restorePlan.steps (same plan used for rollback/restore)
const rollbackSteps = (backup.restorePlan && backup.restorePlan.steps) || [];

const backupGaps = [];
if (!Array.isArray(backupScope) || backupScope.length === 0) backupGaps.push('backupScope empty');
if (!Array.isArray(restoreSteps) || restoreSteps.length < 5) backupGaps.push(`restoreStepCount=${restoreSteps.length} (need ≥5)`);
if (!checksumAlgorithm) backupGaps.push('checksumAlgorithm missing');
if (!Array.isArray(rollbackTriggers) || rollbackTriggers.length < 3) backupGaps.push(`rollbackTriggerCount=${rollbackTriggers.length} (need ≥3)`);
if (!targetFields.includes('releaseDate')) backupGaps.push('targetField releaseDate missing');
if (!targetFields.includes('releaseDateSource')) backupGaps.push('targetField releaseDateSource missing');
if (!targetFields.includes('releaseDateConfidence')) backupGaps.push('targetField releaseDateConfidence missing');
if (autoTrigger === true) backupGaps.push('autoTrigger=true (must be false)');

const backupRestoreComplete = backupGaps.length === 0;

// ---------------------------------------------------------------------------
// Evaluate runbook
// ---------------------------------------------------------------------------
// runbook uses runbook.runbookSteps (not runbook.steps) and top-level totalSteps / placeholderSteps / goNoGoCheckpoints
const runbookSteps = runbook.runbookSteps || runbook.steps || [];
const totalSteps = runbook.totalSteps || runbookSteps.length;
// placeholder steps: isPlaceholder=true field (or top-level count)
const placeholderSteps = runbookSteps.filter(s => s.isPlaceholder === true);
// go/no-go checkpoints: goNoGoCheckpoint=true field (or top-level count)
const goNoGoSteps = runbookSteps.filter(s => s.goNoGoCheckpoint === true);
// prisma deploy step: look in label/description
const prismaDeployStep = runbookSteps.find(s => {
  const label = String(s.label || '').toLowerCase();
  const desc = String(s.description || '').toLowerCase();
  return label.includes('prisma') || desc.includes('prisma migrate deploy') || desc.includes('apply production migration');
});
// non-placeholder production commands — a step is a production cmd if label/desc contains migrate/apply/deploy
// and it is NOT a placeholder
const nonPlaceholderProductionCmds = runbookSteps.filter(s => {
  const label = String(s.label || s.description || '').toLowerCase();
  const isProductionCmd = label.includes('prisma migrate deploy') || label.includes('apply production migration') || label.includes('production apply');
  return isProductionCmd && s.isPlaceholder !== true;
});

const runbookGaps = [];
if (totalSteps < 10) runbookGaps.push(`totalSteps=${totalSteps} (need ≥10)`);
if (placeholderSteps.length < 5) runbookGaps.push(`placeholderSteps=${placeholderSteps.length} (need ≥5)`);
if (goNoGoSteps.length < 2) runbookGaps.push(`goNoGoCheckpoints=${goNoGoSteps.length} (need ≥2)`);
if (!prismaDeployStep) runbookGaps.push('no prisma migrate deploy step found');
if (nonPlaceholderProductionCmds.length > 0) runbookGaps.push(`${nonPlaceholderProductionCmds.length} non-placeholder production commands`);

const runbookComplete = runbookGaps.length === 0;

// ---------------------------------------------------------------------------
// Evaluate rollback
// ---------------------------------------------------------------------------
const rollbackTriggerCount = rollbackTriggers.length;
const rollbackRequiresManual = rollbackTriggerObj.requiresManualApproval !== false;
// rollback steps = restore steps (same plan used for rollback execution)
const rollbackStepCount = Array.isArray(rollbackSteps) ? rollbackSteps.length : 0;

const rollbackGaps = [];
if (rollbackTriggerCount < 3) rollbackGaps.push(`rollbackTriggerCount=${rollbackTriggerCount} (need ≥3)`);
if (!rollbackRequiresManual) rollbackGaps.push('rollback must require manual approval');
if (autoTrigger === true) rollbackGaps.push('autoTrigger must be false');
if (rollbackStepCount < 5) rollbackGaps.push(`rollbackStepCount=${rollbackStepCount} (need ≥5)`);

const rollbackComplete = rollbackGaps.length === 0;

// ---------------------------------------------------------------------------
// Evaluate monitoring
// ---------------------------------------------------------------------------
const monItems = monitoring.checklistItems || monitoring.items || [];
const mandatoryItemCount = monitoring.mandatoryItems || monItems.filter(i => i.mandatory !== false).length;
const hasReleaseDateCheck = monitoring.includesReleaseDateSchemaCheck === true ||
  monItems.some(i => (i.itemId || '').includes('MON-01') || (i.label || i.description || '').toLowerCase().includes('releasedate'));
const hasQueryGateSmoke = monitoring.includesQueryGateSmokeCheck === true;
const hasNoLeakage = monitoring.includesNoLeakageCheck === true;
const hasNullRateCheck = monitoring.includesReleaseDateNullRateCheck === true;

const monitoringGaps = [];
if (monItems.length < 10) monitoringGaps.push(`totalItems=${monItems.length} (need ≥10)`);
if (mandatoryItemCount < 8) monitoringGaps.push(`mandatoryItems=${mandatoryItemCount} (need ≥8)`);
if (!hasReleaseDateCheck) monitoringGaps.push('missing releaseDate check');
if (!hasQueryGateSmoke) monitoringGaps.push('missing query gate smoke check');
if (!hasNullRateCheck) monitoringGaps.push('missing null rate check');

const monitoringComplete = monitoringGaps.length === 0;

// ---------------------------------------------------------------------------
// Evaluate execution safety
// ---------------------------------------------------------------------------
const allCommandsPlaceholder = nonPlaceholderProductionCmds.length === 0;
const p22ApprovalGranted = p22Decision.approvalGranted === true;
const p22MigrationApplied = p22Decision.productionMigrationApplied === true;

const safetyViolations = [];
if (!allCommandsPlaceholder) safetyViolations.push('non-placeholder production commands in runbook');
if (p22ApprovalGranted) safetyViolations.push('P22 approvalGranted=true (must be false)');
if (p22MigrationApplied) safetyViolations.push('P22 productionMigrationApplied=true (must be false)');

const productionCommandSafety = safetyViolations.length === 0 ? 'ALL_COMMANDS_PLACEHOLDER' : 'SAFETY_VIOLATION';

// ---------------------------------------------------------------------------
// Package status
// ---------------------------------------------------------------------------
const implementationPackageComplete =
  backupRestoreComplete && runbookComplete && rollbackComplete && monitoringComplete && allCommandsPlaceholder;

const implementationPackageStatus = implementationPackageComplete
  ? 'IMPLEMENTATION_PACKAGE_COMPLETE'
  : 'IMPLEMENTATION_PACKAGE_INCOMPLETE';

// ---------------------------------------------------------------------------
// Build JSON artifact
// ---------------------------------------------------------------------------
const review = {
  phase: 'P23',
  part: 'C',
  generatedAt: now,
  implementationPackageStatus,
  backupRestoreStatus: backupRestoreComplete ? 'COMPLETE' : 'INCOMPLETE',
  backupRestoreGaps: backupGaps,
  migrationRunbookStatus: runbookComplete ? 'COMPLETE' : 'INCOMPLETE',
  migrationRunbookGaps: runbookGaps,
  migrationRunbookDetails: {
    totalSteps,
    placeholderStepCount: placeholderSteps.length,
    goNoGoCheckpointCount: goNoGoSteps.length,
    hasProductionMigrateDeployStep: !!prismaDeployStep,
  },
  rollbackStatus: rollbackComplete ? 'COMPLETE' : 'INCOMPLETE',
  rollbackGaps,
  rollbackDetails: {
    triggerCount: rollbackTriggerCount,
    requiresManualApproval: rollbackRequiresManual,
    autoTriggerDisabled: autoTrigger !== true,
    rollbackStepCount,
  },
  monitoringStatus: monitoringComplete ? 'COMPLETE' : 'INCOMPLETE',
  monitoringGaps,
  monitoringDetails: {
    totalItems: monItems.length,
    mandatoryItems: mandatoryItemCount,
    includesReleaseDateCheck: hasReleaseDateCheck,
    includesQueryGateSmokeCheck: hasQueryGateSmoke,
    includesNoLeakageCheck: hasNoLeakage,
    includesNullRateCheck: hasNullRateCheck,
  },
  productionCommandSafety,
  safetyViolations,
  executionApprovalStatus: 'AWAITING_P24_EXECUTION_TOKEN',
  whyNoMigrationApplied:
    'P23 is an implementation review phase only. ' +
    'Production migration execution requires an explicit P24 execution token: ' +
    'P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY. ' +
    'That token has not been provided in P23 and must be obtained from CTO/CEO in P24.',
  requiredP24Token: 'P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY',
  approvalGranted: false,
  productionMigrationApplied: false,
  targetFields: ['releaseDate', 'releaseDateSource', 'releaseDateConfidence'],
};

fs.writeFileSync(path.join(OUT, 'p23production_migration_implementation_review.json'), JSON.stringify(review, null, 2));

// ---------------------------------------------------------------------------
// Build MD artifact
// ---------------------------------------------------------------------------
const md = [
  '# P23 Production Migration Implementation Review',
  '',
  `**Generated**: ${now}`,
  `**Phase**: P23 / Part C`,
  `**Implementation Package Status**: \`${implementationPackageStatus}\``,
  '',
  '## Safety Invariants',
  '- `approvalGranted`: false',
  '- `productionMigrationApplied`: false',
  '- All production commands: `[PLACEHOLDER — requires P24 approval]`',
  `- Required P24 token: \`P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY\``,
  '',
  '## Backup / Restore Review',
  `- Status: **${backupRestoreComplete ? 'COMPLETE ✅' : 'INCOMPLETE ❌'}**`,
  `- Backup scope: ${(Array.isArray(backupScope) ? backupScope : []).join(', ') || '(none)'}`,
  `- Restore steps: ${restoreSteps.length}`,
  `- Checksum algorithm: ${checksumAlgorithm}`,
  `- Rollback triggers: ${rollbackTriggerCount}`,
  `- Auto-trigger: ${autoTrigger} (must be false ✅)`,
  `- Target fields: ${targetFields.join(', ')}`,
  ...(backupGaps.length > 0 ? ['', '**Gaps:**', ...backupGaps.map(g => `- ❌ ${g}`)] : []),
  '',
  '## Migration Runbook Review',
  `- Status: **${runbookComplete ? 'COMPLETE ✅' : 'INCOMPLETE ❌'}**`,
  `- Total steps: ${totalSteps}`,
  `- Placeholder steps: ${placeholderSteps.length}`,
  `- Go/no-go checkpoints: ${goNoGoSteps.length}`,
  `- Has prisma migrate deploy step (PLACEHOLDER): ${!!prismaDeployStep}`,
  `- Non-placeholder production commands: ${nonPlaceholderProductionCmds.length}`,
  ...(runbookGaps.length > 0 ? ['', '**Gaps:**', ...runbookGaps.map(g => `- ❌ ${g}`)] : []),
  '',
  '## Rollback Review',
  `- Status: **${rollbackComplete ? 'COMPLETE ✅' : 'INCOMPLETE ❌'}**`,
  `- Trigger count: ${rollbackTriggerCount}`,
  `- Requires manual approval: ${rollbackRequiresManual}`,
  `- Auto-trigger disabled: ${autoTrigger !== true}`,
  `- Rollback steps: ${rollbackStepCount}`,
  ...(rollbackGaps.length > 0 ? ['', '**Gaps:**', ...rollbackGaps.map(g => `- ❌ ${g}`)] : []),
  '',
  '## Monitoring Checklist Review',
  `- Status: **${monitoringComplete ? 'COMPLETE ✅' : 'INCOMPLETE ❌'}**`,
  `- Total items: ${monItems.length}`,
  `- Mandatory items: ${mandatoryItemCount}`,
  `- Includes releaseDate check: ${hasReleaseDateCheck}`,
  `- Includes query gate smoke: ${hasQueryGateSmoke}`,
  `- Includes no-leakage check: ${hasNoLeakage}`,
  `- Includes null rate check: ${hasNullRateCheck}`,
  ...(monitoringGaps.length > 0 ? ['', '**Gaps:**', ...monitoringGaps.map(g => `- ❌ ${g}`)] : []),
  '',
  '## Production Command Safety',
  `- **${productionCommandSafety}**`,
  ...(safetyViolations.length > 0 ? safetyViolations.map(v => `- ❌ ${v}`) : ['- ✅ All production commands are [PLACEHOLDER]']),
  '',
  '## Why Migration Was Not Applied',
  review.whyNoMigrationApplied,
].join('\n');

fs.writeFileSync(path.join(OUT, 'p23production_migration_implementation_review.md'), md);

// Summary
console.log('\n=== P23 Part C: Implementation Review ===');
console.log(`Backup/Restore: ${backupRestoreComplete ? 'COMPLETE ✅' : 'INCOMPLETE ❌'}`);
if (backupGaps.length > 0) backupGaps.forEach(g => console.log(`  gap: ${g}`));
console.log(`Runbook: ${runbookComplete ? 'COMPLETE ✅' : 'INCOMPLETE ❌'}`);
if (runbookGaps.length > 0) runbookGaps.forEach(g => console.log(`  gap: ${g}`));
console.log(`Rollback: ${rollbackComplete ? 'COMPLETE ✅' : 'INCOMPLETE ❌'}`);
if (rollbackGaps.length > 0) rollbackGaps.forEach(g => console.log(`  gap: ${g}`));
console.log(`Monitoring: ${monitoringComplete ? 'COMPLETE ✅' : 'INCOMPLETE ❌'}`);
if (monitoringGaps.length > 0) monitoringGaps.forEach(g => console.log(`  gap: ${g}`));
console.log(`Production Command Safety: ${productionCommandSafety}`);
console.log(`Implementation Package: ${implementationPackageStatus}`);
console.log('Artifacts written.');
