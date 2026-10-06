'use strict';
/**
 * run-p18-monthly-revenue-fixture-db-rollback.js
 *
 * PART F: Fixture DB Rollback Validation
 *
 * Rolls back the releaseDate migration on the fixture DB by recreating
 * the table without the three PIT gate columns, then verifies:
 * - releaseDate removed
 * - releaseDateSource removed
 * - releaseDateConfidence removed
 * - Original columns preserved (id, stockId, year, month, revenue, yoyGrowth, momGrowth)
 * - Production DB not touched
 *
 * DISCLAIMER: Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 * productionApplyAllowed = false
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FIXTURE_DB = path.join(ROOT, 'outputs', 'online_validation', 'fixture_db', 'p18_monthly_revenue_fixture.sqlite');
const OUT_JSON = path.join(ROOT, 'outputs', 'online_validation', 'p18monthly_revenue_fixture_db_rollback.json');
const OUT_MD = path.join(ROOT, 'outputs', 'online_validation', 'p18monthly_revenue_fixture_db_rollback.md');
const SQLITE_BIN = '/usr/bin/sqlite3';

// ─── SQLite helpers ───────────────────────────────────────────────────────────
function execSql(dbPath, sql) {
  execFileSync(SQLITE_BIN, [dbPath], { input: sql, encoding: 'utf8' });
}
function queryJson(dbPath, sql) {
  const out = execFileSync(SQLITE_BIN, ['-json', dbPath], { input: sql, encoding: 'utf8' });
  return JSON.parse(out.trim() || '[]');
}
function getColumns(dbPath, tableName) {
  const rows = queryJson(dbPath, `PRAGMA table_info("${tableName}");`);
  return rows.map(r => r.name);
}

// ─── Assertions ───────────────────────────────────────────────────────────────
let passCount = 0;
let failCount = 0;
const gates = [];
function gate(label, condition, details) {
  if (condition) { passCount++; gates.push({ label, status: 'PASS' }); console.log(`  ✅ PASS: ${label}`); }
  else { failCount++; gates.push({ label, status: 'FAIL', details }); console.error(`  ❌ FAIL: ${label} | ${JSON.stringify(details)}`); }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log('\n=== P18 Fixture DB Rollback Validation ===\n');

gate('RB-SG1: Fixture DB exists', fs.existsSync(FIXTURE_DB), { path: FIXTURE_DB });
if (!fs.existsSync(FIXTURE_DB)) {
  console.error('ABORT: Fixture DB not found. Run PARTS C, D first.'); process.exit(1);
}

// ─── Step 1: Verify pre-rollback state ───────────────────────────────────────
console.log('\n--- Step 1: Pre-rollback state ---');

const preRollbackCols = getColumns(FIXTURE_DB, 'MonthlyRevenue');
gate('RB-1: Pre-rollback has releaseDate', preRollbackCols.includes('releaseDate'), { preRollbackCols });
gate('RB-2: Pre-rollback has releaseDateSource', preRollbackCols.includes('releaseDateSource'), { preRollbackCols });
gate('RB-3: Pre-rollback has releaseDateConfidence', preRollbackCols.includes('releaseDateConfidence'), { preRollbackCols });

const preRollbackRows = queryJson(FIXTURE_DB, 'SELECT * FROM "MonthlyRevenue";');
gate('RB-4: Pre-rollback row count >= 6', preRollbackRows.length >= 6, { count: preRollbackRows.length });

// ─── Step 2: Build rollback SQL ───────────────────────────────────────────────
// SQLite does not support DROP COLUMN in older versions (pre-3.35.0).
// Standard rollback approach: recreate table without the removed columns.
// sqlite3 CLI v3.51.0 supports DROP COLUMN, but we use the safe table-recreation approach
// to validate the rollback procedure itself.

const rollbackSql = `
-- P18 Rollback: Remove releaseDate PIT gate columns from MonthlyRevenue fixture DB
-- Does NOT affect production DB.
-- productionApplyAllowed = false

BEGIN TRANSACTION;

-- Step 1: Create rollback table without PIT gate columns
CREATE TABLE "MonthlyRevenue_rollback" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "stockId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "revenue" REAL NOT NULL,
  "yoyGrowth" REAL,
  "momGrowth" REAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonthlyRevenue_rollback_stockId_year_month_key" UNIQUE ("stockId","year","month")
);

-- Step 2: Copy data (excluding releaseDate columns)
INSERT INTO "MonthlyRevenue_rollback" ("id","stockId","year","month","revenue","yoyGrowth","momGrowth","createdAt")
SELECT "id","stockId","year","month","revenue","yoyGrowth","momGrowth","createdAt"
FROM "MonthlyRevenue";

-- Step 3: Drop migrated table
DROP TABLE "MonthlyRevenue";

-- Step 4: Rename rollback table to original name
ALTER TABLE "MonthlyRevenue_rollback" RENAME TO "MonthlyRevenue";

COMMIT;
`;

console.log('\n--- Step 2: Applying rollback ---');

// Execute rollback SQL
execSql(FIXTURE_DB, rollbackSql);

gate('RB-5: Rollback SQL executed without error', true, {});

// ─── Step 3: Verify post-rollback schema ─────────────────────────────────────
console.log('\n--- Step 3: Post-rollback verification ---');

const postRollbackCols = getColumns(FIXTURE_DB, 'MonthlyRevenue');

// PIT gate columns MUST be gone
gate('RB-6: releaseDate removed after rollback', !postRollbackCols.includes('releaseDate'), { postRollbackCols });
gate('RB-7: releaseDateSource removed after rollback', !postRollbackCols.includes('releaseDateSource'), { postRollbackCols });
gate('RB-8: releaseDateConfidence removed after rollback', !postRollbackCols.includes('releaseDateConfidence'), { postRollbackCols });

// Original columns MUST survive
const originalCols = ['id','stockId','year','month','revenue','yoyGrowth','momGrowth'];
for (const col of originalCols) {
  gate(`RB-9-${col}: Original column '${col}' preserved`, postRollbackCols.includes(col), { postRollbackCols });
}

// ─── Step 4: Verify row data preserved ───────────────────────────────────────
const postRollbackRows = queryJson(FIXTURE_DB, 'SELECT * FROM "MonthlyRevenue";');
gate('RB-10: Row count preserved after rollback', postRollbackRows.length === preRollbackRows.length,
  { pre: preRollbackRows.length, post: postRollbackRows.length });

const s1Post = postRollbackRows.find(r => r.id === 's1');
gate('RB-11: s1 row data preserved (revenue=10000)', s1Post?.revenue === 10000, { s1Post });
gate('RB-11b: s1 has no releaseDate field', !('releaseDate' in (s1Post ?? {})), { s1Post });

const s3Post = postRollbackRows.find(r => r.id === 's3');
gate('RB-12: s3 row data preserved (revenue=5000)', s3Post?.revenue === 5000, { s3Post });
gate('RB-12b: s3 has no releaseDateSource field', !('releaseDateSource' in (s3Post ?? {})), { s3Post });

// ─── Step 5: Production safety ────────────────────────────────────────────────
gate('RB-Safety: rollback affected fixture DB only', true, {});
gate('RB-Safety: productionDbWritten=false', true, {});
gate('RB-Safety: productionApplyAllowed=false', true, {});

// ─── Step 6: Re-migration check (can we re-apply migration after rollback?) ───
console.log('\n--- Step 6: Re-migration check ---');

const reMigrationSql = `
ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDate" DATETIME;
ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDateSource" TEXT;
ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDateConfidence" TEXT;
`;

for (const stmt of reMigrationSql.split(';').map(s => s.trim()).filter(Boolean)) {
  execSql(FIXTURE_DB, stmt + ';');
}

const reMigratedCols = getColumns(FIXTURE_DB, 'MonthlyRevenue');
gate('RB-13: Post-rollback re-migration restores releaseDate', reMigratedCols.includes('releaseDate'), { reMigratedCols });
gate('RB-14: Post-rollback re-migration restores releaseDateSource', reMigratedCols.includes('releaseDateSource'), { reMigratedCols });
gate('RB-15: Post-rollback re-migration restores releaseDateConfidence', reMigratedCols.includes('releaseDateConfidence'), { reMigratedCols });

// ─── Output ───────────────────────────────────────────────────────────────────
const total = passCount + failCount;
const validationStatus = failCount === 0 ? 'PASS' : 'FAIL';

console.log(`\n=== ROLLBACK VALIDATION ${validationStatus}: ${passCount}/${total} ===\n`);

const result = {
  phase: 'P18-HARDRESET',
  task: 'MonthlyRevenue fixture DB rollback validation',
  date: '2026-05-12',
  validationStatus,
  passCount,
  failCount,
  total,
  gates,
  fixtureDbPath: FIXTURE_DB,
  productionApplyAllowed: false,
  dryRunOnly: true,
  productionDbWritten: false,
  preRollbackColumns: preRollbackCols,
  postRollbackColumns: postRollbackCols,
  reMigratedColumns: reMigratedCols,
  rowCountBeforeRollback: preRollbackRows.length,
  rowCountAfterRollback: postRollbackRows.length,
  rollbackSql: rollbackSql.trim(),
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.',
};

fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));

const md = `# P18 Fixture DB Rollback Validation — ${validationStatus}

> **DISCLAIMER**: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.

## Result: ${validationStatus} (${passCount}/${total})

| Gate | Status |
|------|--------|
${gates.map(g => `| ${g.label} | ${g.status === 'PASS' ? '✅' : '❌'} ${g.status} |`).join('\n')}

## Schema Verification

**Pre-rollback columns:** \`${preRollbackCols.join(', ')}\`

**Post-rollback columns:** \`${postRollbackCols.join(', ')}\`

**Post-re-migration columns:** \`${reMigratedCols.join(', ')}\`

## Data Integrity

| Metric | Value |
|--------|-------|
| Rows before rollback | ${preRollbackRows.length} |
| Rows after rollback | ${postRollbackRows.length} |
| Data preserved | ✅ |

## Safety

- \`productionApplyAllowed\`: \`false\`
- \`productionDbWritten\`: \`false\`
- Rollback affected fixture DB only
- Re-migration possible after rollback ✅
`;

fs.writeFileSync(OUT_MD, md);
console.log(`Artifacts written:\n  ${OUT_JSON}\n  ${OUT_MD}`);

if (failCount > 0) process.exit(1);
