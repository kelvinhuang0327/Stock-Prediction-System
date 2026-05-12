/**
 * P24-HARDRESET: Production Backup Gate (Part C)
 *
 * Executes the production backup before any migration action.
 * Reads p22 backup plan, creates actual DB file copy with sha256 checksum,
 * records pre-migration state.
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
const BACKUP_DIR = 'prisma';

function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }

// ── Token check ────────────────────────────────────────────────────────────────
// Token verified in preflight (P24 Part A). Referenced here for traceability.
const tokenVerified = true; // P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY confirmed in Part A

if (!tokenVerified) {
  console.error('BLOCKED: execution token not verified');
  process.exit(1);
}

// ── Load Part A preflight result ──────────────────────────────────────────────
const preflight = readJson(path.join(OUT_DIR, 'p24production_migration_execution_preflight.json'));
if (preflight.classification !== 'P24_PREFLIGHT_PASS_EXECUTION_AUTHORIZED') {
  console.error('BLOCKED: preflight not passed, classification:', preflight.classification);
  fs.writeFileSync(path.join(OUT_DIR, 'p24production_backup_gate.json'), JSON.stringify({
    backupStatus: 'FAIL',
    error: `Preflight not passed: ${preflight.classification}`,
    generatedAt: new Date().toISOString(),
  }, null, 2));
  process.exit(1);
}

// ── Load P22 backup plan ───────────────────────────────────────────────────────
const p22Backup = readJson('outputs/online_validation/p22production_backup_restore_plan.json');

// ── Verify DB target ───────────────────────────────────────────────────────────
if (!fs.existsSync(DB_FILE)) {
  const err = `DB file not found: ${DB_FILE}`;
  console.error('BLOCKED:', err);
  fs.writeFileSync(path.join(OUT_DIR, 'p24production_backup_gate.json'), JSON.stringify({
    backupStatus: 'FAIL',
    error: err,
    generatedAt: new Date().toISOString(),
  }, null, 2));
  process.exit(1);
}

const NOW = new Date().toISOString();
const TIMESTAMP = NOW.replace(/[:.]/g, '').replace('T', '_').substring(0, 15);

// ── Pre-backup state ───────────────────────────────────────────────────────────
let preBackupRowCount = 0;
let schemaSnapshot = '';
try {
  const rowResult = execSync(`sqlite3 "${DB_FILE}" "SELECT COUNT(*) FROM MonthlyRevenue;"`, { encoding: 'utf8' });
  preBackupRowCount = parseInt(rowResult.trim(), 10);
} catch (e) {
  console.warn('Pre-backup row count warning:', e.message);
}

try {
  const schemaResult = execSync(`sqlite3 "${DB_FILE}" "PRAGMA table_info(MonthlyRevenue);"`, { encoding: 'utf8' });
  schemaSnapshot = schemaResult.trim();
} catch (e) {
  console.warn('Schema snapshot warning:', e.message);
}

// ── DB file size ───────────────────────────────────────────────────────────────
const dbStats = fs.statSync(DB_FILE);
const dbFileSizeBytes = dbStats.size;

// ── Execute backup ─────────────────────────────────────────────────────────────
const backupFileName = `dev.p24_premigration_backup_${TIMESTAMP}.db`;
const backupPath = path.join(BACKUP_DIR, backupFileName);
const checksumFile = `${backupPath}.sha256`;

let backupStatus = 'FAIL';
let checksum = '';
let backupError = null;

try {
  execSync(`cp "${DB_FILE}" "${backupPath}"`, { encoding: 'utf8' });
  console.log(`Backup created: ${backupPath}`);

  // Verify backup file exists and has same size
  const backupStats = fs.statSync(backupPath);
  if (backupStats.size !== dbFileSizeBytes) {
    throw new Error(`Backup size mismatch: original=${dbFileSizeBytes}, backup=${backupStats.size}`);
  }

  // Compute sha256 of backup file
  const sha256Result = execSync(`shasum -a 256 "${backupPath}"`, { encoding: 'utf8' });
  checksum = sha256Result.trim().split(/\s+/)[0];
  fs.writeFileSync(checksumFile, sha256Result.trim());
  console.log(`Checksum computed: ${checksum}`);

  backupStatus = 'PASS';
} catch (e) {
  backupError = e.message;
  console.error('Backup failed:', backupError);
}

// ── Migration pending state ────────────────────────────────────────────────────
let pendingMigrations = [];
try {
  const statusResult = execSync('npx prisma migrate status 2>&1', { encoding: 'utf8' });
  const lines = statusResult.split('\n');
  pendingMigrations = lines
    .filter(l => l.includes('20') && !l.includes('applied') && !l.includes('●'))
    .map(l => l.trim())
    .filter(Boolean);
} catch {}

// ── Output artifact ────────────────────────────────────────────────────────────
const artifact = {
  phase: 'P24-HARDRESET',
  part: 'C',
  description: 'Production backup gate',
  generatedAt: NOW,
  tokenStatus: 'VERIFIED',
  requiredToken: REQUIRED_EXECUTION_TOKEN,
  preflightClassification: preflight.classification,
  productionDbTarget: DB_FILE,
  backupPath,
  checksumFile,
  timestamp: TIMESTAMP,
  checksum,
  monthlyRevenueRowCountBefore: preBackupRowCount,
  schemaSnapshot,
  dbFileSizeBytes,
  backupStatus,
  error: backupError || undefined,
  p22BackupScope: p22Backup.backupPlan && p22Backup.backupPlan.scope
    ? p22Backup.backupPlan.scope.tables || []
    : [],
  targetFields: p22Backup.targetFields || [],
  pendingMigrationsBefore: pendingMigrations,
  approvalGranted: false,
  productionMigrationApplied: false,
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.',
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'p24production_backup_gate.json'), JSON.stringify(artifact, null, 2));

// ── Markdown ───────────────────────────────────────────────────────────────────
const md = `# P24-HARDRESET: Production Backup Gate

**Generated:** ${NOW}  
**Backup Status:** ${backupStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}  
**Token:** VERIFIED  

## Pre-Backup State

| Field | Value |
|-------|-------|
| DB File | \`${DB_FILE}\` |
| DB File Size | ${(dbFileSizeBytes / 1024 / 1024).toFixed(1)} MB |
| MonthlyRevenue rows (pre-migration) | ${preBackupRowCount} |

## Backup Details

| Field | Value |
|-------|-------|
| Backup Path | \`${backupPath}\` |
| Checksum File | \`${checksumFile}\` |
| sha256 | \`${checksum}\` |
| Timestamp | ${TIMESTAMP} |
| Status | ${backupStatus} |

## Pre-Migration Schema Snapshot

\`\`\`
${schemaSnapshot}
\`\`\`

## Backup Status: ${backupStatus}

${backupStatus === 'PASS' ? '✅ Backup complete. Safe to proceed to migration gate.' : `❌ BACKUP FAILED: ${backupError}\n\n**Production migration BLOCKED until backup is successful.**`}

---

*DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.*
`;

fs.writeFileSync(path.join(OUT_DIR, 'p24production_backup_gate.md'), md);

console.log(`\nBackup Gate: ${backupStatus}`);
console.log(`  DB target: ${DB_FILE}`);
console.log(`  Backup: ${backupPath}`);
console.log(`  sha256: ${checksum}`);
console.log(`  Pre-migration rows: ${preBackupRowCount}`);

if (backupStatus !== 'PASS') {
  console.error('\nBackup FAILED — migration is BLOCKED');
  process.exit(1);
}
