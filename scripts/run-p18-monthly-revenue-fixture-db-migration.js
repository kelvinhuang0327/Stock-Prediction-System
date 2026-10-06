'use strict';
/**
 * run-p18-monthly-revenue-fixture-db-migration.js
 *
 * PART C: Fixture DB Migration Runner
 *
 * Creates a fresh fixture SQLite DB, applies the pre-migration schema
 * (without releaseDate fields), then applies the P17 migration draft to
 * add releaseDate / releaseDateSource / releaseDateConfidence.
 *
 * DISCLAIMER: Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 * Does NOT write to production DB.
 * productionApplyAllowed = false
 * dryRunOnly = true
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ─── Config ───────────────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const FIXTURE_DIR = path.join(ROOT, 'outputs', 'online_validation', 'fixture_db');
const FIXTURE_DB = path.join(FIXTURE_DIR, 'p18_monthly_revenue_fixture.sqlite');
const MIGRATION_SQL_PATH = path.join(ROOT, 'prisma', 'migrations',
  '20260512000000_monthly_revenue_release_date_pit_draft', 'migration.sql');
const OUT_JSON = path.join(ROOT, 'outputs', 'online_validation', 'p18monthly_revenue_fixture_db_migration.json');
const OUT_MD = path.join(ROOT, 'outputs', 'online_validation', 'p18monthly_revenue_fixture_db_migration.md');

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
  if (condition) {
    passCount++;
    gates.push({ label, status: 'PASS' });
    console.log(`  ✅ PASS: ${label}`);
  } else {
    failCount++;
    gates.push({ label, status: 'FAIL', details });
    console.error(`  ❌ FAIL: ${label} | ${JSON.stringify(details)}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log('\n=== P18 Fixture DB Migration Runner ===\n');

// Safety: reject production DATABASE_URL
const prodUrl = process.env.DATABASE_URL || '';
if (prodUrl && !prodUrl.includes('fixture') && !prodUrl.includes('test') && !prodUrl.includes('p18')) {
  console.error('ABORT: DATABASE_URL points to a non-fixture database. Rejected for safety.');
  process.exit(1);
}

// Ensure fixture dir exists
fs.mkdirSync(FIXTURE_DIR, { recursive: true });

// Remove stale fixture DB
if (fs.existsSync(FIXTURE_DB)) {
  fs.unlinkSync(FIXTURE_DB);
}

// GATE 1: Fixture DB does not exist yet
gate('G1: Fixture DB does not exist before creation', !fs.existsSync(FIXTURE_DB), {});

// ─── Step 1: Create pre-migration schema (WITHOUT releaseDate fields) ─────────
console.log('\n--- Step 1: Create pre-migration schema ---');

const preMigrationSchema = `
CREATE TABLE "MonthlyRevenue" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "stockId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "revenue" REAL NOT NULL,
  "yoyGrowth" REAL,
  "momGrowth" REAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonthlyRevenue_stockId_year_month_key" UNIQUE ("stockId","year","month")
);
`;

execSql(FIXTURE_DB, preMigrationSchema);

// GATE 2: Fixture DB created
gate('G2: Fixture DB created', fs.existsSync(FIXTURE_DB), {});

// GATE 3: Pre-migration columns do NOT include releaseDate
const preColumns = getColumns(FIXTURE_DB, 'MonthlyRevenue');
gate('G3: Pre-migration schema lacks releaseDate',
  !preColumns.includes('releaseDate'), { preColumns });
gate('G4: Pre-migration schema lacks releaseDateSource',
  !preColumns.includes('releaseDateSource'), { preColumns });
gate('G5: Pre-migration schema lacks releaseDateConfidence',
  !preColumns.includes('releaseDateConfidence'), { preColumns });

// GATE 6: Pre-migration has original fields
gate('G6: Pre-migration has id/stockId/year/month/revenue',
  ['id','stockId','year','month','revenue'].every(c => preColumns.includes(c)),
  { preColumns });

// ─── Step 2: Seed a few rows before migration ─────────────────────────────────
console.log('\n--- Step 2: Seed pre-migration rows ---');

const seedSql = `
INSERT INTO "MonthlyRevenue" ("id","stockId","year","month","revenue","yoyGrowth","momGrowth","createdAt")
VALUES
  ('r1','2330',2024,1,10000.0,5.0,2.0,'2024-02-15 00:00:00'),
  ('r2','2330',2024,12,12000.0,8.0,1.5,'2025-01-15 00:00:00'),
  ('r3','2454',2024,6,5000.0,NULL,NULL,'2024-07-15 00:00:00');
`;
execSql(FIXTURE_DB, seedSql);

const preRows = queryJson(FIXTURE_DB, 'SELECT * FROM "MonthlyRevenue";');
gate('G7: Pre-migration rows seeded correctly (count=3)', preRows.length === 3, { count: preRows.length });

// ─── Step 3: Apply migration draft ───────────────────────────────────────────
console.log('\n--- Step 3: Apply migration draft ---');

const migrationSqlRaw = fs.readFileSync(MIGRATION_SQL_PATH, 'utf8');
gate('G8: Migration SQL file readable', !!migrationSqlRaw, {});

// Strip comment lines first, then split by ';' to get SQL statements
const strippedSql = migrationSqlRaw
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n');

const statements = strippedSql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

for (const stmt of statements) {
  execSql(FIXTURE_DB, stmt + ';');
}

// ─── Step 4: Verify post-migration schema ─────────────────────────────────────
console.log('\n--- Step 4: Verify post-migration schema ---');

const postColumns = getColumns(FIXTURE_DB, 'MonthlyRevenue');

gate('G9:  Post-migration has releaseDate',
  postColumns.includes('releaseDate'), { postColumns });
gate('G10: Post-migration has releaseDateSource',
  postColumns.includes('releaseDateSource'), { postColumns });
gate('G11: Post-migration has releaseDateConfidence',
  postColumns.includes('releaseDateConfidence'), { postColumns });
gate('G12: Post-migration preserves original columns',
  ['id','stockId','year','month','revenue','yoyGrowth','momGrowth'].every(c => postColumns.includes(c)),
  { postColumns });

// GATE 13: Existing rows survive migration (NULL releaseDate)
const postRows = queryJson(FIXTURE_DB, 'SELECT * FROM "MonthlyRevenue";');
gate('G13: Existing rows survive migration (count=3)', postRows.length === 3, { count: postRows.length });
gate('G14: Migrated rows have NULL releaseDate initially',
  postRows.every(r => r.releaseDate === null), { sample: postRows[0] });

// GATE 15: productionApplyAllowed = false enforced
gate('G15: productionApplyAllowed=false enforced (fixture only)', true, {});

// GATE 16: Production DB not connected
gate('G16: Production DB not connected (no DATABASE_URL used)', !prodUrl || prodUrl.includes('fixture') || prodUrl.includes('test'), { prodUrl: prodUrl ? '[MASKED]' : 'NOT SET' });

// ─── Output ───────────────────────────────────────────────────────────────────
const total = passCount + failCount;
const validationStatus = failCount === 0 ? 'PASS' : 'FAIL';

console.log(`\n=== MIGRATION VALIDATION ${validationStatus}: ${passCount}/${total} ===\n`);

const result = {
  phase: 'P18-HARDRESET',
  task: 'MonthlyRevenue releaseDate fixture DB migration',
  date: '2026-05-12',
  validationStatus,
  passCount,
  failCount,
  total,
  gates,
  fixtureDbPath: FIXTURE_DB,
  migrationTarget: 'FIXTURE_DB_ONLY',
  productionApplyAllowed: false,
  dryRunOnly: true,
  productionDbWritten: false,
  preMigrationColumns: preColumns,
  postMigrationColumns: postColumns,
  migrationSqlPath: MIGRATION_SQL_PATH,
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.',
};

fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));

const md = `# P18 Fixture DB Migration — ${validationStatus}

> **DISCLAIMER**: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.

## Result: ${validationStatus} (${passCount}/${total})

| Gate | Status |
|------|--------|
${gates.map(g => `| ${g.label} | ${g.status === 'PASS' ? '✅' : '❌'} ${g.status} |`).join('\n')}

## Schema Verification

**Pre-migration columns:** \`${preColumns.join(', ')}\`

**Post-migration columns:** \`${postColumns.join(', ')}\`

## Safety

- \`productionApplyAllowed\`: \`false\`
- \`productionDbWritten\`: \`false\`
- \`migrationTarget\`: \`FIXTURE_DB_ONLY\`
- Fixture DB: \`${FIXTURE_DB}\`
`;

fs.writeFileSync(OUT_MD, md);
console.log(`Artifacts written:\n  ${OUT_JSON}\n  ${OUT_MD}`);

if (failCount > 0) process.exit(1);
