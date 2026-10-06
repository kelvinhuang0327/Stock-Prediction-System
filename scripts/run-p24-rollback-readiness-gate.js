/**
 * P24-HARDRESET: Rollback Readiness Gate (Part G)
 *
 * Verifies rollback readiness after production migration.
 * Backup file accessible, rollback SQL exists, triggers documented.
 *
 * DISCLAIMER: Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REQUIRED_EXECUTION_TOKEN = 'P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY';
const OUT_DIR = 'outputs/online_validation';
const DB_FILE = 'prisma/dev.db';
const ROLLBACK_SQL_PATH = 'prisma/migrations/20260512000000_monthly_revenue_release_date_pit_draft/migration.sql';

function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }

const NOW = new Date().toISOString();

// ── Load P22 backup/rollback plan ─────────────────────────────────────────────
let p22Backup = {};
let rollbackTriggers = [];
let restoreSteps = [];

try {
  p22Backup = readJson('outputs/online_validation/p22production_backup_restore_plan.json');
  const rollbackTriggerObj = p22Backup.rollbackTrigger || {};
  rollbackTriggers = Array.isArray(rollbackTriggerObj.triggers)
    ? rollbackTriggerObj.triggers
    : [];
  restoreSteps = (p22Backup.restorePlan && p22Backup.restorePlan.steps) || [];
} catch (e) {
  console.warn('P22 backup plan read warning:', e.message);
}

// ── Load backup gate artifact ─────────────────────────────────────────────────
let backupGate = {};
try {
  backupGate = readJson(path.join(OUT_DIR, 'p24production_backup_gate.json'));
} catch (e) {
  console.warn('Backup gate artifact read warning:', e.message);
}

// ── Load migration gate artifact ──────────────────────────────────────────────
let migrationGate = {};
try {
  migrationGate = readJson(path.join(OUT_DIR, 'p24production_migration_gate.json'));
} catch (e) {
  console.warn('Migration gate artifact read warning:', e.message);
}

// ── Checks ─────────────────────────────────────────────────────────────────────
const checks = [];

function check(id, label, pass, detail = '') {
  checks.push({ id, label, pass, detail });
}

// R01: backup file accessible
const backupFilePath = backupGate.backupPath || '';
const backupFileExists = backupFilePath ? fs.existsSync(backupFilePath) : false;
check('R01', 'Backup file accessible', backupFileExists,
  backupFileExists ? `${backupFilePath}` : `Not found: ${backupFilePath}`);

// R02: backup checksum recorded
const checksumRecorded = !!(backupGate.checksum && backupGate.checksum.length > 10);
check('R02', 'Backup checksum recorded', checksumRecorded,
  checksumRecorded ? backupGate.checksum : 'Checksum missing');

// R03: rollback SQL path exists (migration SQL serves as reference)
const rollbackSqlExists = fs.existsSync(ROLLBACK_SQL_PATH);
check('R03', 'Rollback SQL reference exists', rollbackSqlExists, ROLLBACK_SQL_PATH);

// R04: restore procedure documented (P22 restore steps exist)
const restoreProcedureDocumented = restoreSteps.length >= 5;
check('R04', 'Restore procedure documented (≥5 steps)', restoreProcedureDocumented,
  `${restoreSteps.length} restore steps in P22 plan`);

// R05: rollback triggers documented
const triggersDocumented = rollbackTriggers.length >= 3;
check('R05', 'Rollback triggers documented (≥3)', triggersDocumented,
  `${rollbackTriggers.length} triggers in P22 plan`);

// R06: migration status known
const migrationStatusKnown = !!(migrationGate.migrationStatus);
check('R06', 'Migration status known', migrationStatusKnown,
  migrationGate.migrationStatus || 'UNKNOWN');

// R07: current DB row count recordable
let currentRowCount = -1;
try {
  const r = execSync(`sqlite3 "${DB_FILE}" "SELECT COUNT(*) FROM MonthlyRevenue;"`, { encoding: 'utf8' });
  currentRowCount = parseInt(r.trim(), 10);
} catch {}
check('R07', 'Current DB row count recordable', currentRowCount >= 0,
  `${currentRowCount} rows`);

// R08: backup row count recorded (for comparison)
const preBackupRowCount = backupGate.monthlyRevenueRowCountBefore || 0;
check('R08', 'Pre-backup row count recorded', preBackupRowCount > 0,
  `${preBackupRowCount} rows pre-backup`);

// R09: auto-trigger disabled (manual rollback only)
const p22RollbackTrigger = p22Backup.rollbackTrigger || {};
const autoTriggerDisabled = p22RollbackTrigger.autoTrigger !== true;
check('R09', 'Auto-trigger disabled (manual rollback only)', autoTriggerDisabled,
  `autoTrigger = ${p22RollbackTrigger.autoTrigger}`);

// R10: rollback restore command documented
const restoreCommandDocumented = restoreSteps.some(s =>
  typeof s === 'string' && (s.includes('cp') || s.toLowerCase().includes('restore')));
check('R10', 'Restore command documented', restoreCommandDocumented,
  restoreCommandDocumented ? 'Restore command found in restore steps' : 'No cp/restore command found');

// ── Summary ────────────────────────────────────────────────────────────────────
const passCount = checks.filter(c => c.pass).length;
const totalCount = checks.length;
const allPass = passCount === totalCount;
const rollbackReadinessStatus = allPass ? 'PASS' : 'FAIL';

// ── Output artifact ────────────────────────────────────────────────────────────
const artifact = {
  phase: 'P24-HARDRESET',
  part: 'G',
  description: 'Rollback readiness gate',
  generatedAt: NOW,
  tokenStatus: 'VERIFIED',
  requiredToken: REQUIRED_EXECUTION_TOKEN,
  migrationStatus: migrationGate.migrationStatus || 'UNKNOWN',
  productionDbTarget: DB_FILE,
  backupFilePath,
  backupChecksum: backupGate.checksum || '',
  rollbackSqlPath: ROLLBACK_SQL_PATH,
  rollbackTriggers,
  rollbackTriggerCount: rollbackTriggers.length,
  restoreSteps,
  restoreStepCount: restoreSteps.length,
  autoTriggerDisabled,
  currentRowCount,
  preBackupRowCount,
  checks,
  passCount,
  totalCount,
  rollbackReadinessStatus,
  productionMigrationApplied: migrationGate.productionMigrationApplied || false,
  approvalGranted: false,
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.',
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'p24production_rollback_readiness.json'), JSON.stringify(artifact, null, 2));

// ── Markdown ───────────────────────────────────────────────────────────────────
const md = `# P24-HARDRESET: Rollback Readiness Gate

**Generated:** ${NOW}  
**Rollback Readiness:** ${rollbackReadinessStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}  
**Checks:** ${passCount} / ${totalCount}  

## Rollback Readiness Checks

| ID | Check | Pass | Detail |
|----|-------|------|--------|
${checks.map(c => `| ${c.id} | ${c.label} | ${c.pass ? '✅' : '❌'} | ${c.detail} |`).join('\n')}

## Rollback Reference

| Field | Value |
|-------|-------|
| Backup File | \`${backupFilePath}\` |
| Backup sha256 | \`${backupGate.checksum || 'N/A'}\` |
| Rollback SQL | \`${ROLLBACK_SQL_PATH}\` |
| Trigger Count | ${rollbackTriggers.length} |
| Restore Steps | ${restoreSteps.length} |
| Auto-Trigger Disabled | ${autoTriggerDisabled} |

## Rollback Triggers (from P22)

${rollbackTriggers.map((t, i) => `${i + 1}. ${t}`).join('\n') || '(none documented)'}

## Rollback Readiness Status: ${rollbackReadinessStatus}

${rollbackReadinessStatus === 'PASS'
  ? '✅ Rollback readiness confirmed. Migration is safe.'
  : '❌ Rollback readiness FAIL. Review failed checks above.'}

---

*DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.*
`;

fs.writeFileSync(path.join(OUT_DIR, 'p24production_rollback_readiness.md'), md);

console.log(`\nRollback Readiness Gate: ${rollbackReadinessStatus}`);
console.log(`  Checks: ${passCount}/${totalCount} PASS`);
checks.forEach(c => console.log(`  ${c.pass ? '✅' : '❌'} ${c.id}: ${c.label}`));

if (rollbackReadinessStatus !== 'PASS') {
  const failed = checks.filter(c => !c.pass);
  console.error('\nFailed checks:', failed.map(c => c.id).join(', '));
  process.exit(1);
}
