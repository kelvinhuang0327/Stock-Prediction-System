/**
 * P18MonthlyRevenueFixtureDbUtils.ts
 *
 * Fixture DB dry-run utilities for MonthlyRevenue releaseDate migration/backfill/rollback/query gate.
 *
 * DISCLAIMER: Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 * Does not produce buy/sell/recommendation/outperform/guaranteed signals.
 *
 * Rules:
 * - fixtureDbPath MUST be under outputs/online_validation/fixture_db/
 * - Production DATABASE_URL is REJECTED
 * - migrationTarget MUST be FIXTURE_DB_ONLY
 * - productionApplyAllowed MUST be false
 * - dryRunOnly MUST be true
 * - Backfill does NOT use outcome / returnPct / realizedReturnClass
 * - All date inference is deterministic (Taiwan 10th-of-next-month rule)
 */

// ─── Constants ────────────────────────────────────────────────────────────────
export const FIXTURE_DB_DIR = 'outputs/online_validation/fixture_db';
export const FIXTURE_DB_FILENAME = 'p18_monthly_revenue_fixture.sqlite';
export const MIGRATION_TARGET = 'FIXTURE_DB_ONLY' as const;
export const TAIWAN_RELEASE_DAY = 10;
export const INFERRED_SOURCE = 'INFERRED_NEXT_MONTH_10TH';
export const INFERRED_CONFIDENCE = 'LOW_TO_MEDIUM';

// Forbidden outcome fields — must never be persisted to DB
export const FORBIDDEN_OUTCOME_FIELDS = [
  'outcomePrice', 'returnPct', 'realizedReturnClass', 'futurePrice',
  'horizonReturnPct', 'outcomeDate', 'horizonDays', 'baselineResult', 'outcomeClose',
] as const;

// Forbidden claim patterns in text
export const FORBIDDEN_CLAIM_PATTERNS = [
  /\bROI\b/i,
  /win[-\s]rate/i,
  /\bprofit\b/i,
  /\boutperform\b/i,
  /\bguaranteed\b/i,
  /investment recommendation/i,
  /\bbuy\b/i,
  /\bsell\b/i,
  /\bedge\b/i,
];

// Exemption patterns (not treated as forbidden claims)
const EXEMPTION_PATTERNS = [
  /disclaimer/i,
  /does not (constitute|compute|produce|use)/i,
  /no\s+(ROI|alpha|edge|win-rate|profit|outperform)/i,
  /forbid/i,
  /forbidden/i,
  /scanForbiddenClaims/i,
  /FORBIDDEN_CLAIM/i,
  /alphaScore/i,
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FixtureDbConfig {
  fixtureDbPath: string;
  migrationTarget: typeof MIGRATION_TARGET;
  productionApplyAllowed: false;
  dryRunOnly: true;
  productionDbUrl?: string; // captured only to reject it
}

export interface FixtureDb {
  exec(sql: string): void;
  query<T = Record<string, unknown>>(sql: string): T[];
  getColumns(tableName: string): string[];
}

export interface FixtureRow {
  id: string;
  stockId: string;
  year?: number | null;
  month?: number | null;
  revenue: number;
  yoyGrowth?: number | null;
  momGrowth?: number | null;
  releaseDate?: string | Date | null;
  releaseDateSource?: string | null;
  releaseDateConfidence?: string | null;
  createdAt?: string;
  // external fields that must NOT be persisted:
  outcomePrice?: unknown;
  returnPct?: unknown;
  realizedReturnClass?: unknown;
  futurePrice?: unknown;
  horizonReturnPct?: unknown;
}

export interface BackfillResult {
  rowId: string;
  stockId: string;
  year: number | null | undefined;
  month: number | null | undefined;
  action: 'INFERRED' | 'PRESERVED' | 'SKIPPED';
  skipReason?: string;
  inferredReleaseDate?: string;
  releaseDateSource?: string;
  releaseDateConfidence?: string;
  forbiddenOutcomeFieldsIgnored: string[];
}

export interface FixtureDbDryRunResult {
  phase: string;
  fixtureDbPath: string;
  migrationTarget: string;
  productionApplyAllowed: false;
  dryRunOnly: true;
  productionDbWritten: false;
  migrationApplied: boolean;
  backfillRowCount: number;
  backfillResults: BackfillResult[];
  queryGateResults: QueryGateResult[];
  rollbackApplied: boolean;
  postRollbackFieldsGone: boolean;
  validationStatus: 'PASS' | 'FAIL';
  failReasons: string[];
  disclaimer: string;
}

export interface QueryGateResult {
  label: string;
  stockId: string;
  year: number;
  month: number;
  releaseDate: string;
  asOfDate: string;
  expectedAvailable: boolean;
  actualAvailable: boolean;
  pass: boolean;
}

export interface ForbiddenClaimScanResult {
  text: string;
  matches: Array<{ pattern: string; match: string; lineNumber: number; line: string }>;
  clean: boolean;
}

// ─── buildFixtureDbConfig ─────────────────────────────────────────────────────

export function buildFixtureDbConfig(options: {
  fixtureDbPath?: string;
  productionDbUrl?: string;
}): FixtureDbConfig {
  const fixtureDbPath = options.fixtureDbPath ??
    `${FIXTURE_DB_DIR}/${FIXTURE_DB_FILENAME}`;

  return {
    fixtureDbPath,
    migrationTarget: MIGRATION_TARGET,
    productionApplyAllowed: false,
    dryRunOnly: true,
    productionDbUrl: options.productionDbUrl,
  };
}

// ─── validateFixtureDbIsolation ───────────────────────────────────────────────

export function validateFixtureDbIsolation(config: FixtureDbConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Must be under fixture_db dir
  if (!config.fixtureDbPath.includes('outputs/online_validation/fixture_db')) {
    errors.push(`fixtureDbPath must be under outputs/online_validation/fixture_db — got: ${config.fixtureDbPath}`);
  }

  // Must reject production DATABASE_URL
  if (config.productionDbUrl) {
    const url = config.productionDbUrl;
    // Reject any non-fixture URL
    if (!url.includes('fixture') && !url.includes('test') && !url.includes('p18')) {
      errors.push(`productionDbUrl appears to be a production URL — rejected: ${url}`);
    }
  }

  if (config.migrationTarget !== MIGRATION_TARGET) {
    errors.push(`migrationTarget must be FIXTURE_DB_ONLY — got: ${config.migrationTarget}`);
  }

  if (config.productionApplyAllowed !== false) {
    errors.push('productionApplyAllowed must be false');
  }

  if (config.dryRunOnly !== true) {
    errors.push('dryRunOnly must be true');
  }

  return { valid: errors.length === 0, errors };
}

// ─── createFixtureMonthlyRevenueSchema ───────────────────────────────────────

export function createFixtureMonthlyRevenueSchema(
  db: FixtureDb,
  options?: { includeReleaseDateFields?: boolean }
): void {
  const includeReleaseDate = options?.includeReleaseDateFields ?? false;

  const releaseDateColumns = includeReleaseDate ? `
  "releaseDate" DATETIME,
  "releaseDateSource" TEXT,
  "releaseDateConfidence" TEXT,` : '';

  db.exec(`
    DROP TABLE IF EXISTS "MonthlyRevenue";
    CREATE TABLE "MonthlyRevenue" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "stockId" TEXT NOT NULL,
      "year" INTEGER NOT NULL,
      "month" INTEGER NOT NULL,
      "revenue" REAL NOT NULL,
      "yoyGrowth" REAL,
      "momGrowth" REAL,${releaseDateColumns}
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MonthlyRevenue_stockId_year_month_key" UNIQUE ("stockId", "year", "month")
    );
  `);
}

// ─── applyMonthlyRevenueMigrationDraft ───────────────────────────────────────

export function applyMonthlyRevenueMigrationDraft(
  db: FixtureDb,
  migrationSql: string,
  options?: { validatePreConditions?: boolean }
): { applied: boolean; skippedFields: string[] } {
  const skippedFields: string[] = [];

  if (options?.validatePreConditions) {
    const preColumns = db.getColumns('MonthlyRevenue');
    if (preColumns.includes('releaseDate')) {
      skippedFields.push('releaseDate');
    }
    if (preColumns.includes('releaseDateSource')) {
      skippedFields.push('releaseDateSource');
    }
    if (preColumns.includes('releaseDateConfidence')) {
      skippedFields.push('releaseDateConfidence');
    }
  }

  // Extract only the ALTER TABLE statements (skip comments)
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .map(s => s + ';');

  for (const stmt of statements) {
    if (stmt.trim() === ';') continue;
    db.exec(stmt);
  }

  return { applied: true, skippedFields };
}

// ─── seedFixtureMonthlyRevenueRows ───────────────────────────────────────────

export function seedFixtureMonthlyRevenueRows(
  db: FixtureDb,
  rows: FixtureRow[],
  options?: { skipInvalidRows?: boolean }
): { seeded: number; skipped: number; skipReasons: string[] } {
  let seeded = 0;
  let skipped = 0;
  const skipReasons: string[] = [];

  for (const row of rows) {
    // Skip invalid rows
    if (options?.skipInvalidRows) {
      if (row.year == null || row.month == null) {
        skipped++;
        skipReasons.push(`Row ${row.id}: missing year or month`);
        continue;
      }
      if (row.month < 1 || row.month > 12) {
        skipped++;
        skipReasons.push(`Row ${row.id}: invalid month=${row.month}`);
        continue;
      }
    }

    // Never persist forbidden outcome fields
    const safeReleaseDate = row.releaseDate
      ? (row.releaseDate instanceof Date
          ? row.releaseDate.toISOString().slice(0, 10)
          : String(row.releaseDate))
      : null;

    db.exec(`
      INSERT OR IGNORE INTO "MonthlyRevenue"
        ("id","stockId","year","month","revenue","yoyGrowth","momGrowth","releaseDate","releaseDateSource","releaseDateConfidence","createdAt")
      VALUES
        ('${esc(row.id)}','${esc(row.stockId)}',${row.year ?? 'NULL'},${row.month ?? 'NULL'},${row.revenue},${row.yoyGrowth ?? 'NULL'},${row.momGrowth ?? 'NULL'},${safeReleaseDate ? `'${safeReleaseDate}'` : 'NULL'},${row.releaseDateSource ? `'${esc(row.releaseDateSource)}'` : 'NULL'},${row.releaseDateConfidence ? `'${esc(row.releaseDateConfidence)}'` : 'NULL'},'${row.createdAt ?? new Date().toISOString()}');
    `);
    seeded++;
  }

  return { seeded, skipped, skipReasons };
}

// ─── inferReleaseDateForRow ───────────────────────────────────────────────────

export function inferReleaseDateForRow(row: {
  year?: number | null;
  month?: number | null;
}): string | null {
  if (row.year == null || row.month == null) return null;
  if (row.month < 1 || row.month > 12) return null;

  const nextMonth = row.month === 12 ? 1 : row.month + 1;
  const nextYear = row.month === 12 ? row.year + 1 : row.year;
  const mm = String(nextMonth).padStart(2, '0');
  const dd = String(TAIWAN_RELEASE_DAY).padStart(2, '0');
  return `${nextYear}-${mm}-${dd}`;
}

// ─── runMonthlyRevenueReleaseDateBackfill ────────────────────────────────────

export function runMonthlyRevenueReleaseDateBackfill(
  db: FixtureDb,
  options?: { allowOverwrite?: boolean }
): BackfillResult[] {
  const rows = db.query<{
    id: string; stockId: string; year: number; month: number;
    releaseDate: string | null; releaseDateSource: string | null;
    releaseDateConfidence: string | null;
  }>('SELECT "id","stockId","year","month","releaseDate","releaseDateSource","releaseDateConfidence" FROM "MonthlyRevenue";');

  const results: BackfillResult[] = [];

  for (const row of rows) {
    // Already has explicit releaseDate and not overwriting
    if (row.releaseDate && row.releaseDateSource !== INFERRED_SOURCE && !options?.allowOverwrite) {
      results.push({
        rowId: row.id,
        stockId: row.stockId,
        year: row.year,
        month: row.month,
        action: 'PRESERVED',
        inferredReleaseDate: row.releaseDate,
        releaseDateSource: row.releaseDateSource ?? undefined,
        releaseDateConfidence: row.releaseDateConfidence ?? undefined,
        forbiddenOutcomeFieldsIgnored: [],
      });
      continue;
    }

    // Skip if already inferred and not overwriting
    if (row.releaseDate && row.releaseDateSource === INFERRED_SOURCE && !options?.allowOverwrite) {
      results.push({
        rowId: row.id,
        stockId: row.stockId,
        year: row.year,
        month: row.month,
        action: 'PRESERVED',
        inferredReleaseDate: row.releaseDate,
        releaseDateSource: row.releaseDateSource ?? undefined,
        releaseDateConfidence: row.releaseDateConfidence ?? undefined,
        forbiddenOutcomeFieldsIgnored: [],
      });
      continue;
    }

    // Try to infer
    const inferred = inferReleaseDateForRow({ year: row.year, month: row.month });

    if (!inferred) {
      results.push({
        rowId: row.id,
        stockId: row.stockId,
        year: row.year,
        month: row.month,
        action: 'SKIPPED',
        skipReason: `Cannot infer releaseDate for year=${row.year}, month=${row.month}`,
        forbiddenOutcomeFieldsIgnored: [],
      });
      continue;
    }

    db.exec(`
      UPDATE "MonthlyRevenue"
      SET "releaseDate"='${inferred}',
          "releaseDateSource"='${INFERRED_SOURCE}',
          "releaseDateConfidence"='${INFERRED_CONFIDENCE}'
      WHERE "id"='${esc(row.id)}';
    `);

    results.push({
      rowId: row.id,
      stockId: row.stockId,
      year: row.year,
      month: row.month,
      action: 'INFERRED',
      inferredReleaseDate: inferred,
      releaseDateSource: INFERRED_SOURCE,
      releaseDateConfidence: INFERRED_CONFIDENCE,
      forbiddenOutcomeFieldsIgnored: [],
    });
  }

  return results;
}

// ─── validateFixtureMonthlyRevenueRows ───────────────────────────────────────

export function validateFixtureMonthlyRevenueRows(
  db: FixtureDb,
  options?: { requireReleaseDate?: boolean }
): { valid: boolean; errors: string[]; rowCount: number } {
  const rows = db.query<{
    id: string; stockId: string; year: number; month: number;
    revenue: number; releaseDate: string | null;
    releaseDateSource: string | null; releaseDateConfidence: string | null;
  }>('SELECT * FROM "MonthlyRevenue";');

  const errors: string[] = [];

  for (const row of rows) {
    if (!row.id) errors.push(`Row missing id`);
    if (!row.stockId) errors.push(`Row ${row.id}: missing stockId`);
    if (row.revenue == null) errors.push(`Row ${row.id}: missing revenue`);
    if (options?.requireReleaseDate && !row.releaseDate) {
      errors.push(`Row ${row.id}: missing releaseDate (required)`);
    }
  }

  return { valid: errors.length === 0, errors, rowCount: rows.length };
}

// ─── checkReleaseDateAvailability (PIT gate) ──────────────────────────────────

export function checkReleaseDateAvailability(
  releaseDate: string | null | undefined,
  asOfDate: string
): boolean {
  if (!releaseDate) return false;
  const rel = releaseDate.slice(0, 10);
  const asOf = asOfDate.slice(0, 10);
  return rel <= asOf;
}

// ─── runMonthlyRevenueRollback ────────────────────────────────────────────────

export function runMonthlyRevenueRollback(
  db: FixtureDb,
  rollbackSql: string,
  options?: { validatePostConditions?: boolean }
): { rolledBack: boolean; postColumns: string[] } {
  // SQLite does not support DROP COLUMN natively in older versions.
  // Rollback via table recreation (standard SQLite approach):
  const rollbackStatements = rollbackSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .map(s => s + ';');

  for (const stmt of rollbackStatements) {
    if (stmt.trim() === ';') continue;
    db.exec(stmt);
  }

  const postColumns = options?.validatePostConditions
    ? db.getColumns('MonthlyRevenue')
    : [];

  return { rolledBack: true, postColumns };
}

// ─── summarizeFixtureDbDryRun ─────────────────────────────────────────────────

export function summarizeFixtureDbDryRun(result: Partial<FixtureDbDryRunResult>): FixtureDbDryRunResult {
  const failReasons = result.failReasons ?? [];

  const backfillResults = result.backfillResults ?? [];
  const queryGateResults = result.queryGateResults ?? [];

  // Validate query gate
  for (const qg of queryGateResults) {
    if (!qg.pass) {
      failReasons.push(`Query gate FAIL: ${qg.label} expected=${qg.expectedAvailable} actual=${qg.actualAvailable}`);
    }
  }

  const validationStatus: 'PASS' | 'FAIL' = failReasons.length === 0 ? 'PASS' : 'FAIL';

  return {
    phase: result.phase ?? 'P18-HARDRESET',
    fixtureDbPath: result.fixtureDbPath ?? '',
    migrationTarget: MIGRATION_TARGET,
    productionApplyAllowed: false,
    dryRunOnly: true,
    productionDbWritten: false,
    migrationApplied: result.migrationApplied ?? false,
    backfillRowCount: backfillResults.filter(r => r.action === 'INFERRED').length,
    backfillResults,
    queryGateResults,
    rollbackApplied: result.rollbackApplied ?? false,
    postRollbackFieldsGone: result.postRollbackFieldsGone ?? false,
    validationStatus,
    failReasons,
    disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.',
  };
}

// ─── scanForbiddenClaims ──────────────────────────────────────────────────────

export function scanForbiddenClaims(text: string): ForbiddenClaimScanResult {
  const lines = text.split('\n');
  const matches: ForbiddenClaimScanResult['matches'] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if any exemption pattern applies to this line
    const isExempted = EXEMPTION_PATTERNS.some(p => p.test(line));
    if (isExempted) continue;

    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      const m = line.match(pattern);
      if (m) {
        matches.push({
          pattern: pattern.toString(),
          match: m[0],
          lineNumber: i + 1,
          line: line.trim(),
        });
      }
    }
  }

  return { text, matches, clean: matches.length === 0 };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/'/g, "''");
}
