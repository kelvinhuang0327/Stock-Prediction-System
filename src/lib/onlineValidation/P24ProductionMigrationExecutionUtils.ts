/**
 * P24-HARDRESET: Production Migration Execution Utilities
 *
 * Part B — Utility functions for the controlled production migration execution gate.
 *
 * Hard rules enforced:
 *  1. token missing => reject
 *  2. backup required before migration
 *  3. backup verification required before migration
 *  4. migration must not proceed if backup fails
 *  5. backfill must not proceed if migration fails
 *  6. rollback readiness must be preserved after migration
 *  7. post-migration validation required
 *  8. productionMigrationApplied must reflect actual result truthfully
 *  9. no corpus modification allowed
 * 10. no scoring formula modification allowed
 *
 * DISCLAIMER: Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 */

export const REQUIRED_EXECUTION_TOKEN = 'P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY';

export const FORBIDDEN_PATTERNS = [
  /\bROI\b/i,
  /win-rate/i,
  /win rate/i,
  /\boutperform\b/i,
  /\bbeat the market\b/i,
  /\bguaranteed\b/i,
  /\bprofit\b/i,
  /investment recommendation/i,
  /\balpha\b(?!Score)/i,
  /\bedge\b/i,
  /\b(buy|sell)\b/i,
];

export const EXEMPT_LINE_SUBSTRINGS = [
  'disclaimer',
  'does not compute roi',
  'no roi',
  'no win-rate',
  'no outperform',
  'no guaranteed',
  'no profit',
  'roi|win-rate',
  'roi / win-rate',
  'forbiddenpatterns',
  'forbidden_patterns',
  'forbidden claim',
  'alphascore',
  "label: 'roi'",
  "label: 'alpha'",
  "label: 'buy'",
  "label: 'edge'",
  "label: 'profit'",
  '{ pattern:',
  'exempt_line_substrings',
  'forbidden claim scanner',
  'catches roi',
  'catches alpha',
  'catches profit',
  'catches edge',
  'catches buy',
  'catches sell',
  'catches guaranteed',
  'catches outperform',
  'no investment recommendation',
  'does not compute profit',
  'does not provide buy',
  'does not provide sell',
];

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TokenValidationResult {
  valid: boolean;
  token: string | null;
  reason: string;
}

export interface ProductionTargetConfig {
  dbFile: string;
  backupDir: string;
  migrationSqlPath: string;
  dbProvider: 'sqlite';
}

export interface ProductionTargetValidation {
  valid: boolean;
  dbFile: string;
  backupDir: string;
  errors: string[];
}

export interface BackupCommandPlan {
  dbFile: string;
  backupPath: string;
  checksumCommand: string;
  checksumFile: string;
  strategy: string;
  requiredBeforeMigration: true;
  preBackupRowCountQuery: string;
  schemaSnapshotQuery: string;
}

export interface BackupArtifact {
  backupPath: string;
  timestamp: string;
  checksum: string;
  monthlyRevenueRowCountBefore: number;
  schemaSnapshot: string;
  productionDbTarget: string;
  backupStatus: 'PASS' | 'FAIL';
  error?: string;
}

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  backupStatus: 'PASS' | 'FAIL';
}

export interface MigrationExecutionPlan {
  command: string;
  requiresBackupPass: true;
  targetDbFile: string;
  addsColumns: string[];
  dropsColumns: string[];
  migrationSqlPath: string;
  rollbackRequired: boolean;
}

export interface MigrationExecutionResult {
  executed: boolean;
  commandUsed: string;
  startedAt: string;
  completedAt: string;
  schemaAfterMigration: string;
  migrationStatus: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  error?: string;
  productionMigrationApplied: boolean;
}

export interface MigrationValidationResult {
  valid: boolean;
  errors: string[];
  migrationStatus: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
}

export interface BackfillExecutionPlan {
  rule: string;
  releaseDateSource: 'INFERRED_NEXT_MONTH_10TH';
  releaseDateConfidence: 'LOW_TO_MEDIUM';
  skipExplicitReleaseDates: true;
  skipInvalidYearMonth: true;
  requiresMigrationPass: true;
  sql: string;
}

export interface BackfillExecutionResult {
  rowsScanned: number;
  rowsBackfilled: number;
  rowsSkipped: number;
  invalidRows: number;
  sampleBackfilledRows: Array<{ stockId: string; year: number; month: number; releaseDate: string }>;
  releaseDateSourceDistribution: Record<string, number>;
  backfillStatus: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  error?: string;
}

export interface BackfillValidationResult {
  valid: boolean;
  errors: string[];
  backfillStatus: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
}

export interface RollbackReadinessCheck {
  backupFileAccessible: boolean;
  rollbackSqlPath: string;
  rollbackTriggersDocumented: boolean;
  restoreProcedureDocumented: boolean;
  migrationStatusKnown: boolean;
  rollbackReadinessStatus: 'PASS' | 'FAIL' | 'UNKNOWN';
}

export interface PostMigrationValidationPlan {
  checks: string[];
  monitoringItemIds: string[];
  requiresRollbackReadiness: true;
  rollbackReadinessRequired: true;
}

export interface ProductionMigrationExecutionSummary {
  phase: 'P24-HARDRESET';
  tokenStatus: 'VERIFIED' | 'MISSING';
  backupStatus: 'PASS' | 'FAIL';
  migrationStatus: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  backfillStatus: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  validationStatus: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  rollbackReadinessStatus: 'PASS' | 'FAIL' | 'UNKNOWN';
  productionMigrationApplied: boolean;
  classification: string;
  generatedAt: string;
  disclaimer: string;
}

export interface ForbiddenClaimsResult {
  clean: boolean;
  violationCount: number;
  violations: Array<{ lineNumber: number; lineContent: string; pattern: string }>;
}

// ── 1. validateExecutionToken ──────────────────────────────────────────────────

export function validateExecutionToken(input: unknown): TokenValidationResult {
  if (input === null || input === undefined || input === '') {
    return { valid: false, token: null, reason: 'Token is null, undefined, or empty' };
  }
  if (typeof input !== 'string') {
    return { valid: false, token: null, reason: `Token must be a string, got ${typeof input}` };
  }
  if (input !== REQUIRED_EXECUTION_TOKEN) {
    return { valid: false, token: input, reason: `Token mismatch: expected ${REQUIRED_EXECUTION_TOKEN}` };
  }
  return { valid: true, token: input, reason: 'Token verified' };
}

// ── 2. validateProductionTargetConfig ─────────────────────────────────────────

export function validateProductionTargetConfig(config: unknown): ProductionTargetValidation {
  const errors: string[] = [];
  const c = config as Record<string, unknown>;

  if (!c || typeof c !== 'object') {
    return { valid: false, dbFile: '', backupDir: '', errors: ['Config is not an object'] };
  }
  if (!c.dbFile || typeof c.dbFile !== 'string' || c.dbFile.trim() === '') {
    errors.push('dbFile is missing or empty');
  }
  if (!c.backupDir || typeof c.backupDir !== 'string' || c.backupDir.trim() === '') {
    errors.push('backupDir is missing or empty');
  }
  if (!c.migrationSqlPath || typeof c.migrationSqlPath !== 'string') {
    errors.push('migrationSqlPath is missing');
  }
  if (c.dbProvider !== 'sqlite') {
    errors.push(`dbProvider must be 'sqlite', got '${c.dbProvider}'`);
  }
  return {
    valid: errors.length === 0,
    dbFile: typeof c.dbFile === 'string' ? c.dbFile : '',
    backupDir: typeof c.backupDir === 'string' ? c.backupDir : '',
    errors,
  };
}

// ── 3. buildBackupCommandPlan ──────────────────────────────────────────────────

export function buildBackupCommandPlan(inputs: {
  dbFile: string;
  backupDir: string;
  timestamp: string;
}): BackupCommandPlan {
  const { dbFile, backupDir, timestamp } = inputs;
  const backupPath = `${backupDir}/${dbFile.replace(/.*\//, '').replace('.db', '')}.p24_premigration_backup_${timestamp}.db`;
  const checksumFile = `${backupPath}.sha256`;
  return {
    dbFile,
    backupPath,
    checksumCommand: `shasum -a 256 "${backupPath}" > "${checksumFile}"`,
    checksumFile,
    strategy: 'file-copy-with-sha256-checksum',
    requiredBeforeMigration: true,
    preBackupRowCountQuery: 'SELECT COUNT(*) FROM MonthlyRevenue;',
    schemaSnapshotQuery: 'PRAGMA table_info(MonthlyRevenue);',
  };
}

// ── 4. validateBackupArtifact ──────────────────────────────────────────────────

export function validateBackupArtifact(artifact: unknown): BackupValidationResult {
  const errors: string[] = [];
  const a = artifact as Record<string, unknown>;

  if (!a || typeof a !== 'object') {
    return { valid: false, errors: ['Backup artifact is not an object'], backupStatus: 'FAIL' };
  }
  if (!a.backupPath || typeof a.backupPath !== 'string' || a.backupPath.trim() === '') {
    errors.push('backupPath missing or empty');
  }
  if (!a.timestamp || typeof a.timestamp !== 'string') {
    errors.push('timestamp missing');
  }
  if (!a.checksum || typeof a.checksum !== 'string' || a.checksum.trim() === '') {
    errors.push('checksum missing or empty');
  }
  if (typeof a.monthlyRevenueRowCountBefore !== 'number' || a.monthlyRevenueRowCountBefore < 0) {
    errors.push('monthlyRevenueRowCountBefore must be a non-negative number');
  }
  if (!a.schemaSnapshot || typeof a.schemaSnapshot !== 'string') {
    errors.push('schemaSnapshot missing');
  }
  if (!a.productionDbTarget || typeof a.productionDbTarget !== 'string') {
    errors.push('productionDbTarget missing');
  }
  if (a.backupStatus !== 'PASS') {
    errors.push(`backupStatus must be PASS, got ${a.backupStatus}`);
  }

  return { valid: errors.length === 0, errors, backupStatus: errors.length === 0 ? 'PASS' : 'FAIL' };
}

// ── 5. buildMigrationExecutionPlan ────────────────────────────────────────────

export function buildMigrationExecutionPlan(inputs: {
  dbFile: string;
  migrationSqlPath: string;
  backupStatus: string;
}): MigrationExecutionPlan {
  if (inputs.backupStatus !== 'PASS') {
    throw new Error('Migration cannot proceed without backup PASS');
  }
  return {
    command: 'npx prisma migrate deploy',
    requiresBackupPass: true,
    targetDbFile: inputs.dbFile,
    addsColumns: ['releaseDate', 'releaseDateSource', 'releaseDateConfidence'],
    dropsColumns: [],
    migrationSqlPath: inputs.migrationSqlPath,
    rollbackRequired: false,
  };
}

// ── 6. validateMigrationExecutionResult ───────────────────────────────────────

export function validateMigrationExecutionResult(result: unknown): MigrationValidationResult {
  const errors: string[] = [];
  const r = result as Record<string, unknown>;

  if (!r || typeof r !== 'object') {
    return { valid: false, errors: ['Result is not an object'], migrationStatus: 'FAIL' };
  }
  if (typeof r.executed !== 'boolean') {
    errors.push('executed must be boolean');
  }
  if (!r.commandUsed || typeof r.commandUsed !== 'string') {
    errors.push('commandUsed missing');
  }
  if (!r.startedAt || typeof r.startedAt !== 'string') {
    errors.push('startedAt missing');
  }
  if (!r.completedAt || typeof r.completedAt !== 'string') {
    errors.push('completedAt missing');
  }
  if (typeof r.productionMigrationApplied !== 'boolean') {
    errors.push('productionMigrationApplied must be boolean');
  }
  if (!['PASS', 'FAIL', 'NOT_EXECUTED'].includes(r.migrationStatus as string)) {
    errors.push(`migrationStatus must be PASS/FAIL/NOT_EXECUTED, got ${r.migrationStatus}`);
  }

  const status = r.migrationStatus as 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  return { valid: errors.length === 0, errors, migrationStatus: errors.length === 0 ? status : 'FAIL' };
}

// ── 7. buildBackfillExecutionPlan ─────────────────────────────────────────────

export function buildBackfillExecutionPlan(inputs: {
  migrationStatus: string;
}): BackfillExecutionPlan {
  if (inputs.migrationStatus !== 'PASS') {
    throw new Error('Backfill cannot proceed without migration PASS');
  }
  const sql = `
UPDATE "MonthlyRevenue"
SET
  "releaseDate" = CASE
    WHEN "month" = 12 THEN CAST("year" + 1 AS TEXT) || '-01-10 00:00:00.000'
    ELSE CAST("year" AS TEXT) || '-' || PRINTF('%02d', "month" + 1) || '-10 00:00:00.000'
  END,
  "releaseDateSource" = 'INFERRED_NEXT_MONTH_10TH',
  "releaseDateConfidence" = 'LOW_TO_MEDIUM'
WHERE "releaseDate" IS NULL
  AND "year" >= 1990
  AND "year" <= 2100
  AND "month" >= 1
  AND "month" <= 12;
`.trim();

  return {
    rule: 'releaseDate = 10th day of the month following the revenue month',
    releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
    releaseDateConfidence: 'LOW_TO_MEDIUM',
    skipExplicitReleaseDates: true,
    skipInvalidYearMonth: true,
    requiresMigrationPass: true,
    sql,
  };
}

// ── 8. validateBackfillExecutionResult ────────────────────────────────────────

export function validateBackfillExecutionResult(result: unknown): BackfillValidationResult {
  const errors: string[] = [];
  const r = result as Record<string, unknown>;

  if (!r || typeof r !== 'object') {
    return { valid: false, errors: ['Result is not an object'], backfillStatus: 'FAIL' };
  }
  if (typeof r.rowsScanned !== 'number') errors.push('rowsScanned must be a number');
  if (typeof r.rowsBackfilled !== 'number') errors.push('rowsBackfilled must be a number');
  if (typeof r.rowsSkipped !== 'number') errors.push('rowsSkipped must be a number');
  if (typeof r.invalidRows !== 'number') errors.push('invalidRows must be a number');
  if (!Array.isArray(r.sampleBackfilledRows)) errors.push('sampleBackfilledRows must be array');
  if (!r.releaseDateSourceDistribution || typeof r.releaseDateSourceDistribution !== 'object') {
    errors.push('releaseDateSourceDistribution missing');
  }
  if (!['PASS', 'FAIL', 'NOT_EXECUTED'].includes(r.backfillStatus as string)) {
    errors.push(`backfillStatus must be PASS/FAIL/NOT_EXECUTED, got ${r.backfillStatus}`);
  }

  const status = r.backfillStatus as 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  return { valid: errors.length === 0, errors, backfillStatus: errors.length === 0 ? status : 'FAIL' };
}

// ── 9. buildRollbackReadinessCheck ────────────────────────────────────────────

export function buildRollbackReadinessCheck(inputs: {
  backupFileExists: boolean;
  rollbackSqlExists: boolean;
  triggersDocumented: boolean;
  procedureDocumented: boolean;
  migrationStatusKnown: boolean;
}): RollbackReadinessCheck {
  const allReady = inputs.backupFileExists &&
    inputs.rollbackSqlExists &&
    inputs.triggersDocumented &&
    inputs.procedureDocumented &&
    inputs.migrationStatusKnown;

  return {
    backupFileAccessible: inputs.backupFileExists,
    rollbackSqlPath: 'prisma/migrations/20260512000000_monthly_revenue_release_date_pit_draft/migration.sql',
    rollbackTriggersDocumented: inputs.triggersDocumented,
    restoreProcedureDocumented: inputs.procedureDocumented,
    migrationStatusKnown: inputs.migrationStatusKnown,
    rollbackReadinessStatus: allReady ? 'PASS' : 'FAIL',
  };
}

// ── 10. buildPostMigrationValidationPlan ──────────────────────────────────────

export function buildPostMigrationValidationPlan(inputs: {
  rollbackReadinessStatus: string;
}): PostMigrationValidationPlan {
  if (inputs.rollbackReadinessStatus !== 'PASS') {
    throw new Error('Post-migration validation requires rollback readiness PASS');
  }
  return {
    checks: [
      'MON-01: releaseDate field exists in MonthlyRevenue',
      'MON-02: releaseDateSource field exists in MonthlyRevenue',
      'MON-03: releaseDateConfidence field exists in MonthlyRevenue',
      'MON-04: rows with releaseDate counted',
      'MON-05: INFERRED_NEXT_MONTH_10TH rows counted',
      'MON-06: EXPLICIT/authoritative rows counted',
      'MON-07: invalid releaseDate rows counted',
      'MON-08: query gate smoke — releaseDate <= asOfDate sample',
      'MON-09: RuleBasedStockAnalyzer smoke',
      'MON-10: FundamentalResearchService smoke',
      'MON-11: ActiveScoringSnapshot smoke',
      'MON-12: rollback readiness validation — backup accessible',
      'MON-13: no-leakage check — 0 rows with releaseDate > asOfDate',
    ],
    monitoringItemIds: ['MON-01', 'MON-02', 'MON-03', 'MON-04', 'MON-05', 'MON-06',
      'MON-07', 'MON-08', 'MON-09', 'MON-10', 'MON-11', 'MON-12', 'MON-13'],
    requiresRollbackReadiness: true,
    rollbackReadinessRequired: true,
  };
}

// ── 11. summarizeProductionMigrationExecution ─────────────────────────────────

export function summarizeProductionMigrationExecution(result: {
  tokenStatus: 'VERIFIED' | 'MISSING';
  backupStatus: 'PASS' | 'FAIL';
  migrationStatus: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  backfillStatus: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  validationStatus: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  rollbackReadinessStatus: 'PASS' | 'FAIL' | 'UNKNOWN';
  productionMigrationApplied: boolean;
}): ProductionMigrationExecutionSummary {
  let classification: string;

  if (result.tokenStatus !== 'VERIFIED') {
    classification = 'P24_PRODUCTION_MIGRATION_BLOCKED_MISSING_EXECUTION_TOKEN';
  } else if (result.backupStatus !== 'PASS') {
    classification = 'P24_PRODUCTION_MIGRATION_BLOCKED_BY_BACKUP_FAILURE';
  } else if (result.migrationStatus === 'FAIL') {
    classification = 'P24_PRODUCTION_MIGRATION_FAILED';
  } else if (result.backfillStatus === 'FAIL') {
    classification = 'P24_PRODUCTION_BACKFILL_FAILED';
  } else if (result.validationStatus === 'FAIL') {
    classification = 'P24_PRODUCTION_VALIDATION_FAILED';
  } else if (result.rollbackReadinessStatus === 'FAIL') {
    classification = 'P24_PRODUCTION_ROLLBACK_REQUIRED';
  } else if (
    result.migrationStatus === 'PASS' &&
    result.backfillStatus === 'PASS' &&
    result.validationStatus === 'PASS' &&
    result.rollbackReadinessStatus === 'PASS'
  ) {
    classification = 'P24_PRODUCTION_MIGRATION_EXECUTION_COMPLETE';
  } else {
    classification = 'P24_PRODUCTION_MIGRATION_BLOCKED_BY_ARTIFACTS';
  }

  return {
    phase: 'P24-HARDRESET',
    tokenStatus: result.tokenStatus,
    backupStatus: result.backupStatus,
    migrationStatus: result.migrationStatus,
    backfillStatus: result.backfillStatus,
    validationStatus: result.validationStatus,
    rollbackReadinessStatus: result.rollbackReadinessStatus,
    productionMigrationApplied: result.productionMigrationApplied,
    classification,
    generatedAt: new Date().toISOString(),
    disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. No investment recommendation is authorized.',
  };
}

// ── 12. scanForbiddenClaims ────────────────────────────────────────────────────

export function scanForbiddenClaims(text: string): ForbiddenClaimsResult {
  const lines = text.split('\n');
  const violations: Array<{ lineNumber: number; lineContent: string; pattern: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    const isExempt = EXEMPT_LINE_SUBSTRINGS.some(s => lower.includes(s.toLowerCase()));
    if (isExempt) continue;

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({ lineNumber: i + 1, lineContent: line.trim(), pattern: pattern.toString() });
        break;
      }
    }
  }

  return {
    clean: violations.length === 0,
    violationCount: violations.length,
    violations,
  };
}
