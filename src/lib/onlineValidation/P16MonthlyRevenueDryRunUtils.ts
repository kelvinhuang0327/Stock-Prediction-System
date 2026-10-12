/**
 * P16MonthlyRevenueDryRunUtils.ts
 *
 * DISCLAIMER: Does not constitute investment advice. Does not compute ROI,
 * profit, alpha, win-rate, edge, or outperformance. Governance / dry-run only.
 * No production DB writes. productionApplyAllowed is always false.
 *
 * Dry-run rules enforced:
 * 1. productionApplyAllowed must always be false
 * 2. dryRunOnly must be true
 * 3. migrationTarget must be fixture / temp / isolated
 * 4. No production database connections
 * 5. No writes to P0/P1/P3/P4 corpus
 * 6. rollbackSpec must be able to revert releaseDate/releaseDateSource/releaseDateConfidence
 * 7. Inferred backfill tagged: releaseDateSource=INFERRED_NEXT_MONTH_10TH, releaseDateConfidence=LOW_TO_MEDIUM
 * 8. Explicit releaseDate must not be overwritten
 * 9. Invalid period fields (missing year/month) must not be backfilled
 * 10. outcome/returnPct/realizedReturnClass must not be used to derive releaseDate
 */

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const EXPECTED_APPROVAL_TOKEN = 'P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY';
export const TAIWAN_REVENUE_RELEASE_DAY = 10;
export const INFERRED_SOURCE = 'INFERRED_NEXT_MONTH_10TH';
export const INFERRED_CONFIDENCE = 'LOW_TO_MEDIUM';

export const FORBIDDEN_OUTCOME_FIELDS = [
  'outcomePrice', 'returnPct', 'realizedReturnClass', 'futurePrice',
  'horizonReturnPct', 'outcomeDate', 'horizonDays', 'baselineResult', 'outcomeClose',
] as const;

export type ForbiddenOutcomeField = typeof FORBIDDEN_OUTCOME_FIELDS[number];

export const ALLOWED_MIGRATION_TARGETS = ['fixture', 'temp', 'isolated'] as const;
export type MigrationTarget = typeof ALLOWED_MIGRATION_TARGETS[number];

const FORBIDDEN_CLAIM_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'ROI',                    pattern: /\bROI\b/i },
  { label: 'win-rate',               pattern: /\bwin[\s-]?rate\b/i },
  { label: 'alpha',                  pattern: /\balpha\b/i },
  { label: 'edge',                   pattern: /\bedge\b/i },
  { label: 'profit',                 pattern: /\bprofit\b/i },
  { label: 'outperform',             pattern: /\boutperform\b/i },
  { label: 'beat',                   pattern: /\bbeat(s)?\s+the\b/i },
  { label: 'buy',                    pattern: /\bbuy\b/i },
  { label: 'sell',                   pattern: /\bsell\b/i },
  { label: 'guaranteed',             pattern: /\bguaranteed?\b/i },
  { label: 'investment recommendation', pattern: /investment\s+recommendation/i },
];

const DISCLAIMER_SKIP  = /disclaimer|does not constitute|non.?goal|not.compute|governance.only|no production/i;
const ALPHA_SCORE_SKIP = /alphaScore/i;
const KNOWLEDGE_HEDGE_SKIP = /knowledge|hedge|edge\s+case|leading.edge|cutting.edge/i;
const SCANNER_DEF_SKIP = /pattern:|label:|forbidden claim|scanner|test.data|FORBIDDEN_CLAIM/i;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DryRunApprovalTokenResult {
  valid: boolean;
  token: string | undefined;
  error?: string;
}

export interface FixtureField {
  name: string;
  type: string;
  nullable: boolean;
}

export interface FixtureSchema {
  tableName: string;
  fields: FixtureField[];
}

export interface DryRunMigrationSpec {
  migrationId: string;
  migrationTarget: MigrationTarget;
  productionApplyAllowed: false;
  dryRunOnly: true;
  tableName: string;
  fieldsToAdd: FixtureField[];
  fieldsToRemoveOnRollback: string[];
  approvalToken: string;
  generatedAt: string;
}

export interface DryRunRollbackSpec {
  rollbackId: string;
  migrationTarget: MigrationTarget;
  productionApplyAllowed: false;
  dryRunOnly: true;
  tableName: string;
  fieldsToRemove: string[];
  description: string;
  generatedAt: string;
}

export interface BackfillRecord {
  stockId: string;
  year?: number | null;
  month?: number | null;
  revenue?: number | null;
  releaseDate?: string | null;
  releaseDateSource?: string | null;
  releaseDateConfidence?: string | null;
  [key: string]: unknown;
}

export interface BackfillResult {
  stockId: string;
  year?: number | null;
  month?: number | null;
  action: 'INFERRED' | 'PRESERVED' | 'SKIPPED' | 'FLAGGED';
  skipReason?: string;
  releaseDate?: string | null;
  releaseDateSource?: string | null;
  releaseDateConfidence?: string | null;
  forbiddenFieldsDetected?: string[];
}

export interface BackfillValidationResult {
  validationStatus: 'PASS' | 'FAIL';
  productionDbWritten: false;
  dryRunOnly: true;
  total: number;
  inferred: number;
  preserved: number;
  skipped: number;
  flagged: number;
  results: BackfillResult[];
  errors: string[];
  warnings: string[];
  summary: string;
}

export interface QueryGateResult {
  stockId: string;
  releaseDate: string | null;
  asOfDate: string;
  available: boolean;
  reason: string;
  allowInferred: boolean;
  releaseDateSource?: string | null;
}

export interface DryRunSummary {
  phase: string;
  productionApplyAllowed: false;
  dryRunOnly: true;
  productionDbWritten: false;
  validationStatus: 'PASS' | 'FAIL';
  gateResults: Array<{ gate: string; status: 'PASS' | 'FAIL'; detail: string }>;
  summary: string;
  disclaimer: string;
}

export interface ForbiddenClaimsHit {
  line: number;
  label: string;
  text: string;
}

// ─────────────────────────────────────────────────────────────
// A.1 validateDryRunApprovalToken
// ─────────────────────────────────────────────────────────────

export function validateDryRunApprovalToken(
  input: { token?: string | null }
): DryRunApprovalTokenResult {
  const token = input?.token;
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return { valid: false, token: undefined, error: 'Approval token missing or empty. Cannot proceed with dry-run.' };
  }
  if (token.trim() !== EXPECTED_APPROVAL_TOKEN) {
    return { valid: false, token: token, error: `Invalid token. Expected: ${EXPECTED_APPROVAL_TOKEN}` };
  }
  return { valid: true, token: token };
}

// ─────────────────────────────────────────────────────────────
// B.1 buildDryRunMigrationSpec
// ─────────────────────────────────────────────────────────────

export function buildDryRunMigrationSpec(
  p14Draft: {
    tableName?: string;
    proposedSchemaChange?: { fieldsToAdd?: string[] };
  },
  options: {
    migrationTarget?: MigrationTarget;
    approvalToken: string;
  }
): DryRunMigrationSpec {
  const target: MigrationTarget = options.migrationTarget ?? 'fixture';
  if (!ALLOWED_MIGRATION_TARGETS.includes(target)) {
    throw new Error(`Invalid migrationTarget: ${target}. Must be one of: ${ALLOWED_MIGRATION_TARGETS.join(', ')}`);
  }
  const tableName = p14Draft?.tableName ?? 'MonthlyRevenue';
  const fieldsToAdd: FixtureField[] = [
    { name: 'releaseDate',           type: 'DateTime', nullable: true },
    { name: 'releaseDateSource',     type: 'String',   nullable: true },
    { name: 'releaseDateConfidence', type: 'String',   nullable: true },
  ];
  return {
    migrationId: `p16-dry-run-migration-${target}-v0`,
    migrationTarget: target,
    productionApplyAllowed: false,
    dryRunOnly: true,
    tableName,
    fieldsToAdd,
    fieldsToRemoveOnRollback: fieldsToAdd.map(f => f.name),
    approvalToken: options.approvalToken,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// B.2 buildDryRunRollbackSpec
// ─────────────────────────────────────────────────────────────

export function buildDryRunRollbackSpec(
  p14Draft: { tableName?: string },
  options: { migrationTarget?: MigrationTarget }
): DryRunRollbackSpec {
  const target: MigrationTarget = options.migrationTarget ?? 'fixture';
  const tableName = p14Draft?.tableName ?? 'MonthlyRevenue';
  const fieldsToRemove = ['releaseDate', 'releaseDateSource', 'releaseDateConfidence'];
  return {
    rollbackId: `p16-dry-run-rollback-${target}-v0`,
    migrationTarget: target,
    productionApplyAllowed: false,
    dryRunOnly: true,
    tableName,
    fieldsToRemove,
    description: `Rollback: DROP COLUMN ${fieldsToRemove.join(', ')} from ${tableName} (fixture only, dry-run proof)`,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// B.3 applyMigrationToFixtureSchema
// ─────────────────────────────────────────────────────────────

export function applyMigrationToFixtureSchema(
  schema: FixtureSchema,
  migrationSpec: DryRunMigrationSpec
): FixtureSchema {
  if (migrationSpec.productionApplyAllowed !== false) {
    throw new Error('SAFETY VIOLATION: productionApplyAllowed must be false');
  }
  if (!migrationSpec.dryRunOnly) {
    throw new Error('SAFETY VIOLATION: dryRunOnly must be true');
  }
  const existingNames = new Set(schema.fields.map(f => f.name));
  const newFields = migrationSpec.fieldsToAdd.filter(f => !existingNames.has(f.name));
  return {
    ...schema,
    fields: [...schema.fields, ...newFields],
  };
}

// ─────────────────────────────────────────────────────────────
// B.4 applyRollbackToFixtureSchema
// ─────────────────────────────────────────────────────────────

export function applyRollbackToFixtureSchema(
  schema: FixtureSchema,
  rollbackSpec: DryRunRollbackSpec
): FixtureSchema {
  if (rollbackSpec.productionApplyAllowed !== false) {
    throw new Error('SAFETY VIOLATION: productionApplyAllowed must be false');
  }
  if (!rollbackSpec.dryRunOnly) {
    throw new Error('SAFETY VIOLATION: dryRunOnly must be true');
  }
  const removeSet = new Set(rollbackSpec.fieldsToRemove);
  return {
    ...schema,
    fields: schema.fields.filter(f => !removeSet.has(f.name)),
  };
}

// ─────────────────────────────────────────────────────────────
// B.5 validateFixtureMonthlyRevenueSchema
// ─────────────────────────────────────────────────────────────

export interface SchemaValidationResult {
  valid: boolean;
  hasReleaseDate: boolean;
  hasReleaseDateSource: boolean;
  hasReleaseDateConfidence: boolean;
  errors: string[];
}

export function validateFixtureMonthlyRevenueSchema(schema: FixtureSchema): SchemaValidationResult {
  const fieldNames = new Set(schema.fields.map(f => f.name));
  const hasReleaseDate           = fieldNames.has('releaseDate');
  const hasReleaseDateSource     = fieldNames.has('releaseDateSource');
  const hasReleaseDateConfidence = fieldNames.has('releaseDateConfidence');
  const errors: string[] = [];
  if (!hasReleaseDate)           errors.push('Missing field: releaseDate');
  if (!hasReleaseDateSource)     errors.push('Missing field: releaseDateSource');
  if (!hasReleaseDateConfidence) errors.push('Missing field: releaseDateConfidence');
  return {
    valid: errors.length === 0,
    hasReleaseDate,
    hasReleaseDateSource,
    hasReleaseDateConfidence,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────
// Internal: Taiwan Revenue Release Date inference
// ─────────────────────────────────────────────────────────────

function inferReleaseDateTaiwan(year: number, month: number): string {
  // Rule: month=12 → DATE(year+1, 1, 10), else DATE(year, month+1, 10)
  const releaseYear  = month === 12 ? year + 1 : year;
  const releaseMonth = month === 12 ? 1 : month + 1;
  const mm = String(releaseMonth).padStart(2, '0');
  return `${releaseYear}-${mm}-${String(TAIWAN_REVENUE_RELEASE_DAY).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// B.6 validateDryRunBackfill
// ─────────────────────────────────────────────────────────────

export function validateDryRunBackfill(
  records: BackfillRecord[],
  options: {
    allowOverwriteExisting?: boolean;
  } = {}
): BackfillValidationResult {
  const results: BackfillResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenPeriods = new Map<string, number>();

  for (const rec of records) {
    // Detect forbidden outcome fields in record
    const forbiddenFieldsDetected = FORBIDDEN_OUTCOME_FIELDS.filter(f => f in rec && rec[f] !== undefined);
    if (forbiddenFieldsDetected.length > 0) {
      warnings.push(`Record ${rec.stockId}: forbidden outcome fields detected (not used for backfill): ${forbiddenFieldsDetected.join(', ')}`);
    }

    // Explicit releaseDate already set — preserve unless allowOverwriteExisting
    if (rec.releaseDate != null && rec.releaseDateSource !== INFERRED_SOURCE) {
      if (!options.allowOverwriteExisting) {
        results.push({
          stockId: rec.stockId,
          year: rec.year,
          month: rec.month,
          action: 'PRESERVED',
          releaseDate: rec.releaseDate,
          releaseDateSource: rec.releaseDateSource ?? 'AUTHORITATIVE',
          releaseDateConfidence: rec.releaseDateConfidence ?? 'HIGH',
          forbiddenFieldsDetected: forbiddenFieldsDetected.length > 0 ? forbiddenFieldsDetected : undefined,
        });
        continue;
      }
    }

    // Missing year → skip
    if (rec.year == null || typeof rec.year !== 'number') {
      results.push({
        stockId: rec.stockId,
        year: rec.year,
        month: rec.month,
        action: 'SKIPPED',
        skipReason: 'missing or invalid year',
        forbiddenFieldsDetected: forbiddenFieldsDetected.length > 0 ? forbiddenFieldsDetected : undefined,
      });
      continue;
    }

    // Missing month → skip
    if (rec.month == null || typeof rec.month !== 'number') {
      results.push({
        stockId: rec.stockId,
        year: rec.year,
        month: rec.month,
        action: 'SKIPPED',
        skipReason: 'missing or invalid month',
        forbiddenFieldsDetected: forbiddenFieldsDetected.length > 0 ? forbiddenFieldsDetected : undefined,
      });
      continue;
    }

    // Invalid month (not 1–12) → skip
    if (rec.month < 1 || rec.month > 12 || !Number.isInteger(rec.month)) {
      results.push({
        stockId: rec.stockId,
        year: rec.year,
        month: rec.month,
        action: 'SKIPPED',
        skipReason: `invalid month: ${rec.month}`,
        forbiddenFieldsDetected: forbiddenFieldsDetected.length > 0 ? forbiddenFieldsDetected : undefined,
      });
      continue;
    }

    // Duplicate period check
    const periodKey = `${rec.stockId}:${rec.year}:${rec.month}`;
    if (seenPeriods.has(periodKey)) {
      warnings.push(`Duplicate period for ${periodKey} — skipping duplicate`);
      results.push({
        stockId: rec.stockId,
        year: rec.year,
        month: rec.month,
        action: 'SKIPPED',
        skipReason: 'duplicate stockId+period',
        forbiddenFieldsDetected: forbiddenFieldsDetected.length > 0 ? forbiddenFieldsDetected : undefined,
      });
      continue;
    }
    seenPeriods.set(periodKey, 1);

    // Infer releaseDate using Taiwan Revenue Release Rule
    const releaseDate = inferReleaseDateTaiwan(rec.year, rec.month);
    results.push({
      stockId: rec.stockId,
      year: rec.year,
      month: rec.month,
      action: 'INFERRED',
      releaseDate,
      releaseDateSource: INFERRED_SOURCE,
      releaseDateConfidence: INFERRED_CONFIDENCE,
      forbiddenFieldsDetected: forbiddenFieldsDetected.length > 0 ? forbiddenFieldsDetected : undefined,
    });
  }

  const inferred  = results.filter(r => r.action === 'INFERRED').length;
  const preserved = results.filter(r => r.action === 'PRESERVED').length;
  const skipped   = results.filter(r => r.action === 'SKIPPED').length;
  const flagged   = results.filter(r => r.action === 'FLAGGED').length;

  return {
    validationStatus: errors.length === 0 ? 'PASS' : 'FAIL',
    productionDbWritten: false,
    dryRunOnly: true,
    total: results.length,
    inferred,
    preserved,
    skipped,
    flagged,
    results,
    errors,
    warnings,
    summary: `Backfill dry-run: ${inferred} inferred, ${preserved} preserved, ${skipped} skipped, ${flagged} flagged. No production DB written.`,
  };
}

// ─────────────────────────────────────────────────────────────
// B.7 validateDryRunQueryGate
// ─────────────────────────────────────────────────────────────

export function validateDryRunQueryGate(
  record: {
    stockId: string;
    releaseDate?: string | null;
    releaseDateSource?: string | null;
  },
  asOfDate: string,
  options: {
    allowInferred?: boolean;
  } = {}
): QueryGateResult {
  const allowInferred = options.allowInferred ?? true;
  const { releaseDate, releaseDateSource } = record;

  if (!releaseDate) {
    return {
      stockId: record.stockId,
      releaseDate: null,
      asOfDate,
      available: false,
      reason: 'no releaseDate — unavailable',
      allowInferred,
    };
  }

  const isInferred = releaseDateSource === INFERRED_SOURCE;
  if (isInferred && !allowInferred) {
    return {
      stockId: record.stockId,
      releaseDate,
      asOfDate,
      available: false,
      reason: 'inferred releaseDate but allowInferred=false — unavailable',
      allowInferred,
      releaseDateSource,
    };
  }

  // PIT gate: available only when asOfDate >= releaseDate
  const available = asOfDate >= releaseDate;
  return {
    stockId: record.stockId,
    releaseDate,
    asOfDate,
    available,
    reason: available
      ? `releaseDate (${releaseDate}) <= asOfDate (${asOfDate}) — available`
      : `releaseDate (${releaseDate}) > asOfDate (${asOfDate}) — unavailable`,
    allowInferred,
    releaseDateSource: releaseDateSource ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// B.8 summarizeDryRunResult
// ─────────────────────────────────────────────────────────────

export function summarizeDryRunResult(result: {
  migrationStatus?: 'PASS' | 'FAIL';
  rollbackStatus?: 'PASS' | 'FAIL';
  backfillStatus?: 'PASS' | 'FAIL';
  queryGateStatus?: 'PASS' | 'FAIL';
  errors?: string[];
}): DryRunSummary {
  const gates: Array<{ gate: string; status: 'PASS' | 'FAIL'; detail: string }> = [
    { gate: 'migration',  status: result.migrationStatus  ?? 'FAIL', detail: 'Fixture schema migration dry-run' },
    { gate: 'rollback',   status: result.rollbackStatus   ?? 'FAIL', detail: 'Rollback dry-run proof' },
    { gate: 'backfill',   status: result.backfillStatus   ?? 'FAIL', detail: 'Backfill dry-run' },
    { gate: 'queryGate',  status: result.queryGateStatus  ?? 'FAIL', detail: 'Query gate dry-run' },
  ];

  const allPass = gates.every(g => g.status === 'PASS') && (result.errors ?? []).length === 0;

  return {
    phase: 'P16-HARDRESET',
    productionApplyAllowed: false,
    dryRunOnly: true,
    productionDbWritten: false,
    validationStatus: allPass ? 'PASS' : 'FAIL',
    gateResults: gates,
    summary: allPass
      ? 'All dry-run gates PASS. No production DB written. Ready for P17 schema patch.'
      : `Dry-run FAIL. Failed gates: ${gates.filter(g => g.status === 'FAIL').map(g => g.gate).join(', ')}`,
    disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. Dry-run governance only.',
  };
}

// ─────────────────────────────────────────────────────────────
// B.9 scanForbiddenClaims
// ─────────────────────────────────────────────────────────────

export function scanForbiddenClaims(text: string): ForbiddenClaimsHit[] {
  const hits: ForbiddenClaimsHit[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip safe contexts
    if (DISCLAIMER_SKIP.test(line))   continue;
    if (SCANNER_DEF_SKIP.test(line))  continue;
    if (KNOWLEDGE_HEDGE_SKIP.test(line)) continue;
    for (const { label, pattern } of FORBIDDEN_CLAIM_PATTERNS) {
      if (label === 'alpha' && ALPHA_SCORE_SKIP.test(line)) continue;
      if (label === 'edge'  && KNOWLEDGE_HEDGE_SKIP.test(line)) continue;
      if (pattern.test(line)) {
        hits.push({ line: i + 1, label, text: line.trim() });
        break;
      }
    }
  }
  return hits;
}
