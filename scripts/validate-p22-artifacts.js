'use strict';
/**
 * P22-HARDRESET Part I
 * Artifact validation script
 */

const fs = require('fs');
const path = require('path');
const OUT = 'outputs/online_validation';

const results = [];
let passCount = 0;
let failCount = 0;

function pass(id, msg) {
  passCount++;
  results.push({ id, status: 'PASS', msg });
  console.log(`  PASS [${id}] ${msg}`);
}

function fail(id, msg) {
  failCount++;
  results.push({ id, status: 'FAIL', msg });
  console.log(`  FAIL [${id}] ${msg}`);
}

function loadJson(file) {
  const fullPath = path.join(OUT, file);
  if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${fullPath}`);
  const raw = fs.readFileSync(fullPath, 'utf8');
  return JSON.parse(raw);
}

// ─── Load all artifacts ────────────────────────────────────────────────────────
let preflight, backup, runbook, monitor, decision;

try { preflight = loadJson('p22production_migration_plan_preflight.json'); pass('V01', 'preflight JSON parses'); }
catch(e) { fail('V01', `preflight JSON parse failed: ${e.message}`); }

try { backup = loadJson('p22production_backup_restore_plan.json'); pass('V02', 'backup/restore JSON parses'); }
catch(e) { fail('V02', `backup/restore JSON parse failed: ${e.message}`); }

try { runbook = loadJson('p22production_migration_runbook.json'); pass('V03', 'runbook JSON parses'); }
catch(e) { fail('V03', `runbook JSON parse failed: ${e.message}`); }

try { monitor = loadJson('p22production_monitoring_checklist.json'); pass('V04', 'monitoring checklist JSON parses'); }
catch(e) { fail('V04', `monitoring checklist JSON parse failed: ${e.message}`); }

try { decision = loadJson('p22production_migration_plan_decision.json'); pass('V05', 'decision JSON parses'); }
catch(e) { fail('V05', `decision JSON parse failed: ${e.message}`); }

// ─── Frozen corpus line counts ────────────────────────────────────────────────
const FROZEN_CORPUS = [
  { file: 'outputs/online_validation/simulation_snapshot_corpus.jsonl', expected: 60, id: 'V06' },
  { file: 'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl', expected: 4500, id: 'V07' },
  { file: 'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl', expected: 9900, id: 'V08' },
  { file: 'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl', expected: 4500, id: 'V09' },
  { file: 'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl', expected: 4500, id: 'V10' },
];

for (const c of FROZEN_CORPUS) {
  try {
    const content = fs.readFileSync(c.file, 'utf8');
    const lines = content.trim().split('\n').length;
    if (lines === c.expected) {
      pass(c.id, `frozen corpus ${path.basename(c.file)} = ${lines} lines (expected ${c.expected})`);
    } else {
      fail(c.id, `frozen corpus ${path.basename(c.file)} = ${lines} lines (expected ${c.expected})`);
    }
  } catch (e) {
    fail(c.id, `frozen corpus read error for ${c.file}: ${e.message}`);
  }
}

// ─── Structural checks ─────────────────────────────────────────────────────────
if (backup) {
  backup.backupPlan ? pass('V11', 'backupPlan present') : fail('V11', 'missing backupPlan');
  backup.restorePlan ? pass('V12', 'restorePlan present') : fail('V12', 'missing restorePlan');
  backup.rollbackTrigger ? pass('V13', 'rollbackTrigger present') : fail('V13', 'missing rollbackTrigger');
  backup.approvalGranted === false ? pass('V14', 'backup.approvalGranted = false') : fail('V14', `backup.approvalGranted = ${backup.approvalGranted} (expected false)`);
  backup.productionMigrationApplied === false ? pass('V15', 'backup.productionMigrationApplied = false') : fail('V15', `backup.productionMigrationApplied = ${backup.productionMigrationApplied} (expected false)`);

  if (backup.backupPlan && backup.backupPlan.scope) {
    const tables = backup.backupPlan.scope.tables || [];
    tables.includes('MonthlyRevenue') ? pass('V16', 'backup scope includes MonthlyRevenue') : fail('V16', 'backup scope missing MonthlyRevenue');
    tables.includes('_prisma_migrations') ? pass('V17', 'backup scope includes _prisma_migrations') : fail('V17', 'backup scope missing _prisma_migrations');
  } else {
    fail('V16', 'backup.backupPlan.scope missing');
    fail('V17', 'backup.backupPlan.scope missing');
  }

  if (backup.backupPlan && backup.backupPlan.restoreMethod) {
    backup.backupPlan.restoreMethod.verifyReleaseDateField === true
      ? pass('V18', 'restoreMethod.verifyReleaseDateField = true')
      : fail('V18', 'restoreMethod.verifyReleaseDateField not true');
  } else {
    fail('V18', 'missing restoreMethod');
  }
}

if (runbook) {
  (runbook.runbookSteps && Array.isArray(runbook.runbookSteps))
    ? pass('V19', `runbook has ${runbook.runbookSteps.length} steps`)
    : fail('V19', 'missing runbookSteps array');
  runbook.approvalGranted === false ? pass('V20', 'runbook.approvalGranted = false') : fail('V20', `runbook.approvalGranted = ${runbook.approvalGranted}`);
  runbook.productionMigrationApplied === false ? pass('V21', 'runbook.productionMigrationApplied = false') : fail('V21', `runbook.productionMigrationApplied = ${runbook.productionMigrationApplied}`);

  if (runbook.runbookSteps) {
    const placeholders = runbook.runbookSteps.filter(s => s.isPlaceholder);
    placeholders.length >= 5 ? pass('V22', `${placeholders.length} placeholder steps (requires P23 approval)`) : fail('V22', `only ${placeholders.length} placeholder steps (need >=5)`);
    const goNoGo = runbook.runbookSteps.filter(s => s.goNoGoCheckpoint);
    goNoGo.length >= 1 ? pass('V23', `${goNoGo.length} go/no-go checkpoints`) : fail('V23', 'no go/no-go checkpoints found');
  }

  runbook.requiredApprovalTokenForP23 === 'P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY'
    ? pass('V24', 'requiredApprovalTokenForP23 correct')
    : fail('V24', `requiredApprovalTokenForP23 = ${runbook.requiredApprovalTokenForP23}`);
}

if (monitor) {
  (monitor.checklistItems && Array.isArray(monitor.checklistItems))
    ? pass('V25', `monitoring checklist has ${monitor.checklistItems.length} items`)
    : fail('V25', 'missing checklistItems array');
  monitor.includesQueryGateSmokeCheck === true ? pass('V26', 'includesQueryGateSmokeCheck = true') : fail('V26', 'missing includesQueryGateSmokeCheck');
  monitor.includesReleaseDateNullRateCheck === true ? pass('V27', 'includesReleaseDateNullRateCheck = true') : fail('V27', 'missing includesReleaseDateNullRateCheck');
  monitor.approvalGranted === false ? pass('V28', 'monitor.approvalGranted = false') : fail('V28', `monitor.approvalGranted = ${monitor.approvalGranted}`);
  monitor.productionMigrationApplied === false ? pass('V29', 'monitor.productionMigrationApplied = false') : fail('V29', `monitor.productionMigrationApplied = ${monitor.productionMigrationApplied}`);

  if (monitor.checklistItems) {
    const mon08 = monitor.checklistItems.find(i => i.itemId === 'MON-08');
    mon08 ? pass('V30', 'MON-08 (query gate smoke) present') : fail('V30', 'MON-08 missing');
    const mon13 = monitor.checklistItems.find(i => i.itemId === 'MON-13');
    mon13 ? pass('V31', 'MON-13 (no-leakage) present') : fail('V31', 'MON-13 missing');
  }
}

if (decision) {
  decision.classification ? pass('V32', `decision.classification = ${decision.classification}`) : fail('V32', 'missing classification');
  decision.approvalGranted === true ? fail('V33', 'SAFETY VIOLATION: decision.approvalGranted = true (must be false)') : pass('V33', 'decision.approvalGranted = false');
  decision.productionMigrationApplied === true ? fail('V34', 'SAFETY VIOLATION: decision.productionMigrationApplied = true (must be false)') : pass('V34', 'decision.productionMigrationApplied = false');
  decision.readyForP23Review === true ? pass('V35', 'decision.readyForP23Review = true') : fail('V35', `decision.readyForP23Review = ${decision.readyForP23Review}`);
  decision.classification === 'P22_PLAN_HARDENING_COMPLETE_READY_FOR_P23_REVIEW'
    ? pass('V36', 'classification = P22_PLAN_HARDENING_COMPLETE_READY_FOR_P23_REVIEW')
    : fail('V36', `classification = ${decision.classification}`);
  decision.recommendedNextToken === 'P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY'
    ? pass('V37', 'recommendedNextToken correct')
    : fail('V37', `recommendedNextToken = ${decision.recommendedNextToken}`);
}

if (preflight) {
  preflight.classification === 'P22_PREFLIGHT_PASS_PLAN_HARDENING_AUTHORIZED'
    ? pass('V38', 'preflight classification correct')
    : fail('V38', `preflight classification = ${preflight.classification}`);
  const preflightPass = preflight.gatePassCount || preflight.passCount || (preflight.summary && preflight.summary.passCount);
  preflightPass === 24
    ? pass('V39', `preflight passCount = 24`)
    : fail('V39', `preflight passCount = ${preflightPass} (expected 24)`);
}

// ─── MD files present ────────────────────────────────────────────────────────
const mdFiles = [
  'p22production_backup_restore_plan.md',
  'p22production_migration_runbook.md',
  'p22production_monitoring_checklist.md',
  'p22production_migration_plan_decision.md',
  'p22production_migration_plan_preflight.md',
];
for (let i = 0; i < mdFiles.length; i++) {
  const f = mdFiles[i];
  const id = `V${40 + i}`;
  fs.existsSync(path.join(OUT, f))
    ? pass(id, `${f} present`)
    : fail(id, `${f} missing`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
const total = passCount + failCount;
console.log('');
console.log(`P22 Part I: artifact validation ${passCount}/${total} PASS`);

if (failCount > 0) {
  console.log('FAILED gates:');
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ${r.id}: ${r.msg}`));
  process.exit(1);
} else {
  console.log('All artifact validation gates PASS');
}
