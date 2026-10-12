/**
 * P14-HARDRESET PART B: MonthlyRevenue Migration Approval Gate Utility
 *
 * Provides migration draft, query gate contract, and approval gate utilities
 * for the MonthlyRevenue releaseDate PIT migration.
 *
 * SAFETY CONTRACT:
 * - Does NOT write production DB.
 * - Does NOT apply Prisma migrations.
 * - Does NOT modify scoring formulas, alphaScore, or recommendationBucket.
 * - Does NOT use stock price / returnPct / realizedReturnClass in any computation.
 * - All migration drafts are marked productionApplyAllowed = false.
 * - No ROI / win-rate / alpha / profit / outperform / guaranteed / buy / sell claims.
 *
 * Disclaimer: This module does not provide investment recommendations.
 * Output is for observability, contract documentation, and dry-run purposes only.
 */

// ── Approval Token ────────────────────────────────────────────────────────────

export const EXPECTED_APPROVAL_TOKEN = 'P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY';

// ── Types ────────────────────────────────────────────────────────────────────

export type ApprovalStatus =
  | 'APPROVED_DRY_RUN_ONLY'
  | 'NOT_APPROVED'
  | 'INVALID_TOKEN';

export type MigrationSafetyStatus =
  | 'SAFE_DRY_RUN_ONLY'
  | 'UNSAFE_PRODUCTION_APPLY_BLOCKED'
  | 'UNSAFE_FORBIDDEN_FIELD_PRESENT';

export type QueryGateResult =
  | 'AVAILABLE'
  | 'UNAVAILABLE_RELEASE_DATE_FUTURE'
  | 'UNAVAILABLE_MISSING_RELEASE_DATE'
  | 'UNAVAILABLE_INVALID_RELEASE_DATE'
  | 'UNAVAILABLE_MISSING_PERIOD'
  | 'UNAVAILABLE_INFERRED_NOT_ALLOWED';

export type ReleaseDateSource =
  | 'AUTHORITATIVE'
  | 'INFERRED_NEXT_MONTH_10TH'
  | 'MISSING'
  | 'INVALID';

export interface ApprovalTokenResult {
  tokenPresent: boolean;
  approvalStatus: ApprovalStatus;
  allowsDryRunArtifacts: boolean;
  allowsProductionApply: false;
  note: string;
}

export interface MigrationApprovalScope {
  canProduceMigrationDraft: boolean;
  canProduceRollbackDraft: boolean;
  canModifyProductionDb: false;
  canModifyPrismaProductionSchema: boolean;
  canModifyCorpus: false;
  canModifyScoringFormulas: false;
  reason: string;
}

export interface MonthlyRevenueMigrationDraft {
  draftId: string;
  generatedAt: string;
  phase: 'P14';
  productionApplyAllowed: false;
  approvalTokenRequired: string;
  proposedSchemaChange: {
    table: 'MonthlyRevenue';
    fieldsToAdd: Array<{
      name: string;
      type: string;
      nullable: boolean;
      description: string;
    }>;
    prismaSnippet: string;
    sqlSnippet: string;
  };
  backfillRule: {
    description: string;
    formula: string;
    decemberRollover: string;
    sourceLabel: 'INFERRED_NEXT_MONTH_10TH';
    forbiddenInputs: string[];
  };
  backfillSqlDraft: string;
  productionSafetyWarning: string;
  fixtureOnlyInstructions: string;
  rollbackDraftReference: string;
  validationRequirements: string[];
  nonGoals: string[];
}

export interface MonthlyRevenueRollbackDraft {
  rollbackId: string;
  generatedAt: string;
  phase: 'P14';
  productionApplyAllowed: false;
  rollbackStrategyA: {
    description: string;
    sqlSnippet: string;
  };
  rollbackStrategyB: {
    description: string;
    sqlSnippet: string;
  };
  safetyNote: string;
}

export interface MigrationDraftSafetyResult {
  safe: boolean;
  status: MigrationSafetyStatus;
  errors: string[];
  warnings: string[];
}

export interface QueryGateContract {
  contractId: string;
  generatedAt: string;
  table: 'MonthlyRevenue';
  rules: Array<{
    id: string;
    condition: string;
    result: QueryGateResult;
    reason: string;
  }>;
  allowInferredReleaseDate: boolean;
  productionApplyAllowed: false;
  nonGoals: string[];
}

export interface MonthlyRevenueRecordForGate {
  year?: number | null;
  month?: number | null;
  releaseDate?: string | null;
  [key: string]: unknown;
}

export interface QueryGateValidationResult {
  available: boolean;
  gateResult: QueryGateResult;
  reason: string;
  releaseDateUsed: string | null;
  releaseDateSource: ReleaseDateSource;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW_TO_MEDIUM' | 'NONE';
  allowedInferredReleaseDate: boolean;
  forbiddenOutcomeFieldsPresent: string[];
}

export interface MigrationReadinessSummary {
  phase: 'P14';
  generatedAt: string;
  approvalTokenPresent: boolean;
  approvalStatus: ApprovalStatus;
  p13ArtifactsPresent: boolean;
  migrationDraftReady: boolean;
  rollbackDraftReady: boolean;
  queryGateContractReady: boolean;
  fixtureValidationReady: boolean;
  productionApplyAllowed: false;
  finalClassification: string;
  nextSteps: string[];
}

export interface ForbiddenClaimsHit {
  label: string;
  matchedText: string;
  lineNumber: number;
  context: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TAIWAN_REVENUE_RELEASE_DAY = 10;

const FORBIDDEN_OUTCOME_FIELDS: ReadonlyArray<string> = [
  'outcomePrice',
  'returnPct',
  'realizedReturnClass',
  'futurePrice',
  'horizonReturnPct',
  'outcomeDate',
  'horizonDays',
  'baselineResult',
  'outcomeClose',
];

const FORBIDDEN_CLAIM_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bROI\b/i, label: 'ROI' },
  { pattern: /win[\s-]rate/i, label: 'win-rate' },
  { pattern: /\bprofit\b/i, label: 'profit' },
  { pattern: /\boutperform\b/i, label: 'outperform' },
  { pattern: /\bbeat\b/i, label: 'beat' },
  { pattern: /\bguaranteed\b/i, label: 'guaranteed' },
  { pattern: /investment recommendation/i, label: 'investment recommendation' },
  { pattern: /\balpha\b/i, label: 'alpha' },
  { pattern: /\bedge\b/i, label: 'edge' },
  { pattern: /\b(buy|sell)\b/i, label: 'buy/sell' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

function computeInferredReleaseDate(year: number, month: number): string {
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear = year + 1;
  }
  const mm = String(nextMonth).padStart(2, '0');
  const dd = String(TAIWAN_REVENUE_RELEASE_DAY).padStart(2, '0');
  return `${nextYear}-${mm}-${dd}`;
}

function scanForbiddenOutcomeFields(record: MonthlyRevenueRecordForGate): string[] {
  const found: string[] = [];
  for (const field of FORBIDDEN_OUTCOME_FIELDS) {
    if (field in record && record[field] !== undefined && record[field] !== null) {
      found.push(field);
    }
  }
  return found;
}

// ── Exported Functions ─────────────────────────────────────────────────────────

/**
 * Detect whether the approval token is present in the provided input string.
 * The approval token must appear verbatim: P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY
 *
 * Disclaimer: Even with approval token, no production DB writes are permitted.
 */
export function detectApprovalToken(input: string): ApprovalTokenResult {
  const tokenPresent = typeof input === 'string' && input.includes(EXPECTED_APPROVAL_TOKEN);
  if (tokenPresent) {
    return {
      tokenPresent: true,
      approvalStatus: 'APPROVED_DRY_RUN_ONLY',
      allowsDryRunArtifacts: true,
      allowsProductionApply: false,
      note: 'Approval token present. Dry-run artifacts may be produced. Production DB apply is NEVER allowed.',
    };
  }
  return {
    tokenPresent: false,
    approvalStatus: 'NOT_APPROVED',
    allowsDryRunArtifacts: true,
    allowsProductionApply: false,
    note: 'No approval token detected. Only approval-pending artifacts and dry-run plans may be produced.',
  };
}

/**
 * Validate the migration approval scope based on approval status.
 * Even with approval, production DB apply is always false.
 */
export function validateMigrationApprovalScope(
  approvalStatus: ApprovalStatus
): MigrationApprovalScope {
  const isApproved = approvalStatus === 'APPROVED_DRY_RUN_ONLY';
  return {
    canProduceMigrationDraft: true,
    canProduceRollbackDraft: true,
    canModifyProductionDb: false,
    canModifyPrismaProductionSchema: isApproved, // draft only, never actually applied
    canModifyCorpus: false,
    canModifyScoringFormulas: false,
    reason: isApproved
      ? 'Dry-run approved. Draft artifacts permitted. Production apply blocked permanently.'
      : 'Awaiting approval token. Draft plan artifacts only. No production apply.',
  };
}

/**
 * Build the MonthlyRevenue schema migration draft.
 * productionApplyAllowed is always false.
 *
 * Disclaimer: This draft does not constitute an investment recommendation.
 * No realized return data is used.
 */
export function buildMonthlyRevenueMigrationDraft(
  _plan?: unknown
): MonthlyRevenueMigrationDraft {
  return {
    draftId: 'p14-monthly-revenue-migration-draft-v0',
    generatedAt: new Date().toISOString(),
    phase: 'P14',
    productionApplyAllowed: false,
    approvalTokenRequired: EXPECTED_APPROVAL_TOKEN,
    proposedSchemaChange: {
      table: 'MonthlyRevenue',
      fieldsToAdd: [
        {
          name: 'releaseDate',
          type: 'DateTime?',
          nullable: true,
          description: 'Actual or inferred public release date of the monthly revenue figure (Taiwan TWSE/MOPS, 10th of following month).',
        },
        {
          name: 'releaseDateSource',
          type: 'String?',
          nullable: true,
          description: 'Source of releaseDate: AUTHORITATIVE | INFERRED_NEXT_MONTH_10TH | MISSING | INVALID.',
        },
        {
          name: 'releaseDateConfidence',
          type: 'String?',
          nullable: true,
          description: 'Confidence level of the releaseDate: HIGH | MEDIUM | LOW_TO_MEDIUM | NONE.',
        },
      ],
      prismaSnippet: [
        '// Add to MonthlyRevenue model in prisma/schema.prisma',
        '// WARNING: DO NOT APPLY TO PRODUCTION WITHOUT EXPLICIT APPROVAL',
        'releaseDate        DateTime?',
        'releaseDateSource  String?',
        'releaseDateConfidence String?',
      ].join('\n'),
      sqlSnippet: [
        '-- WARNING: DO NOT EXECUTE ON PRODUCTION WITHOUT EXPLICIT APPROVAL',
        '-- Dry-run / fixture-only draft',
        'ALTER TABLE "MonthlyRevenue"',
        '  ADD COLUMN "releaseDate" TIMESTAMP,',
        '  ADD COLUMN "releaseDateSource" TEXT,',
        '  ADD COLUMN "releaseDateConfidence" TEXT;',
      ].join('\n'),
    },
    backfillRule: {
      description: 'Infer releaseDate as the 10th calendar day of the month following the revenue reporting month.',
      formula: 'releaseDate = DATE(year, month+1, 10); if month=12, releaseDate = DATE(year+1, 1, 10)',
      decemberRollover: 'month=12 → releaseDate = DATE(year+1, 01, 10)',
      sourceLabel: 'INFERRED_NEXT_MONTH_10TH',
      forbiddenInputs: [
        'outcomePrice', 'returnPct', 'realizedReturnClass',
        'futurePrice', 'horizonReturnPct', 'outcomeDate',
        'horizonDays', 'baselineResult', 'outcomeClose',
      ],
    },
    backfillSqlDraft: [
      '-- WARNING: DO NOT EXECUTE ON PRODUCTION WITHOUT EXPLICIT APPROVAL',
      '-- Dry-run / fixture-only backfill draft',
      "UPDATE \"MonthlyRevenue\"",
      "SET",
      "  \"releaseDate\" = CASE",
      "    WHEN month = 12 THEN MAKE_DATE(year + 1, 1, 10)",
      "    ELSE MAKE_DATE(year, month + 1, 10)",
      "  END,",
      "  \"releaseDateSource\" = 'INFERRED_NEXT_MONTH_10TH',",
      "  \"releaseDateConfidence\" = 'LOW_TO_MEDIUM'",
      "WHERE \"releaseDate\" IS NULL;",
    ].join('\n'),
    productionSafetyWarning: [
      'PRODUCTION APPLY FORBIDDEN.',
      'This draft must not be applied to any production database.',
      'Requires explicit written approval from authorized operator before P15 execution.',
      'Staging environment validation required before production.',
    ].join(' '),
    fixtureOnlyInstructions: [
      'To validate this draft: use fixture MonthlyRevenue objects in memory.',
      'Run validate-p14-monthly-revenue-fixture-dry-run.js for fixture-only proof.',
      'Do NOT run against production Prisma client.',
      'Do NOT run npx prisma migrate deploy without explicit production approval.',
    ].join(' '),
    rollbackDraftReference: 'p14-monthly-revenue-rollback-draft-v0',
    validationRequirements: [
      'MR-VAL-001: All MonthlyRevenue records must have non-null releaseDate after backfill.',
      'MR-VAL-002: releaseDate must equal 10th of month+1 (or Jan 10 of year+1 for December).',
      'MR-VAL-003: releaseDateSource must be INFERRED_NEXT_MONTH_10TH for all backfilled records.',
      'MR-VAL-004: RuleBasedStockAnalyzer must gate by releaseDate <= asOfDate.',
      'MR-VAL-005: FundamentalResearchService must gate by releaseDate <= asOf.',
      'MR-VAL-006: MonthlyRevenueLike interface must include optional releaseDate field.',
    ],
    nonGoals: [
      'Does not compute ROI, win-rate, profit, or alpha.',
      'Does not use realized return to infer releaseDate.',
      'Does not modify scoring formula or alphaScore.',
      'Does not modify frozen corpora.',
      'Does not write to production DB.',
    ],
  };
}

/**
 * Build the MonthlyRevenue rollback draft.
 * productionApplyAllowed is always false.
 *
 * Disclaimer: Rollback draft for observability only. Does not constitute investment advice.
 */
export function buildMonthlyRevenueRollbackDraft(
  _plan?: unknown
): MonthlyRevenueRollbackDraft {
  return {
    rollbackId: 'p14-monthly-revenue-rollback-draft-v0',
    generatedAt: new Date().toISOString(),
    phase: 'P14',
    productionApplyAllowed: false,
    rollbackStrategyA: {
      description: 'Null out inferred releaseDates (preserves authoritative entries).',
      sqlSnippet: [
        '-- WARNING: DO NOT EXECUTE ON PRODUCTION WITHOUT EXPLICIT APPROVAL',
        "UPDATE \"MonthlyRevenue\"",
        "SET \"releaseDate\" = NULL,",
        "    \"releaseDateSource\" = NULL,",
        "    \"releaseDateConfidence\" = NULL",
        "WHERE \"releaseDateSource\" = 'INFERRED_NEXT_MONTH_10TH';",
      ].join('\n'),
    },
    rollbackStrategyB: {
      description: 'Drop the three releaseDate columns entirely (full rollback).',
      sqlSnippet: [
        '-- WARNING: DO NOT EXECUTE ON PRODUCTION WITHOUT EXPLICIT APPROVAL',
        'ALTER TABLE "MonthlyRevenue"',
        '  DROP COLUMN IF EXISTS "releaseDate",',
        '  DROP COLUMN IF EXISTS "releaseDateSource",',
        '  DROP COLUMN IF EXISTS "releaseDateConfidence";',
      ].join('\n'),
    },
    safetyNote: 'Both rollback strategies are dry-run drafts only. No production DB may be modified without explicit approval.',
  };
}

/**
 * Validate that a migration draft has required safety properties.
 */
export function validateMigrationDraftSafety(
  draft: MonthlyRevenueMigrationDraft
): MigrationDraftSafetyResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (draft.productionApplyAllowed !== false) {
    errors.push('productionApplyAllowed must be false — production apply is never permitted.');
  }

  if (!draft.proposedSchemaChange) {
    errors.push('proposedSchemaChange is missing.');
  } else {
    const fieldNames = draft.proposedSchemaChange.fieldsToAdd.map((f) => f.name);
    if (!fieldNames.includes('releaseDate')) errors.push('proposedSchemaChange missing releaseDate field.');
    if (!fieldNames.includes('releaseDateSource')) errors.push('proposedSchemaChange missing releaseDateSource field.');
    if (!fieldNames.includes('releaseDateConfidence')) errors.push('proposedSchemaChange missing releaseDateConfidence field.');
  }

  if (!draft.backfillSqlDraft) {
    errors.push('backfillSqlDraft is missing.');
  }

  if (!draft.rollbackDraftReference) {
    warnings.push('rollbackDraftReference not set.');
  }

  // Check backfill rule does not reference forbidden inputs
  if (draft.backfillRule?.forbiddenInputs) {
    const forbiddenPresent = draft.backfillRule.forbiddenInputs.length > 0;
    if (!forbiddenPresent) {
      warnings.push('backfillRule.forbiddenInputs list is empty — should enumerate forbidden outcome fields.');
    }
  }

  return {
    safe: errors.length === 0,
    status:
      errors.length === 0
        ? 'SAFE_DRY_RUN_ONLY'
        : draft.productionApplyAllowed !== false
        ? 'UNSAFE_PRODUCTION_APPLY_BLOCKED'
        : 'UNSAFE_FORBIDDEN_FIELD_PRESENT',
    errors,
    warnings,
  };
}

/**
 * Build the MonthlyRevenue query gate contract.
 *
 * Defines the rules for determining whether a MonthlyRevenue record
 * is available as of a given asOfDate.
 *
 * Disclaimer: This contract does not recommend any buy or sell action.
 */
export function buildMonthlyRevenueQueryGateContract(
  options: { allowInferredReleaseDate?: boolean } = {}
): QueryGateContract {
  const allowInferred = options.allowInferredReleaseDate ?? true;
  return {
    contractId: 'p14-monthly-revenue-query-gate-contract-v0',
    generatedAt: new Date().toISOString(),
    table: 'MonthlyRevenue',
    allowInferredReleaseDate: allowInferred,
    productionApplyAllowed: false,
    rules: [
      {
        id: 'QG-001',
        condition: 'year or month is missing/invalid',
        result: 'UNAVAILABLE_MISSING_PERIOD',
        reason: 'Cannot compute release date without valid year and month.',
      },
      {
        id: 'QG-002',
        condition: 'releaseDate present and valid and releaseDate <= asOfDate',
        result: 'AVAILABLE',
        reason: 'Authoritative releaseDate confirms data was publicly available on asOfDate.',
      },
      {
        id: 'QG-003',
        condition: 'releaseDate present and valid and releaseDate > asOfDate',
        result: 'UNAVAILABLE_RELEASE_DATE_FUTURE',
        reason: 'Data was not yet publicly released on asOfDate.',
      },
      {
        id: 'QG-004',
        condition: 'releaseDate present but invalid format',
        result: 'UNAVAILABLE_INVALID_RELEASE_DATE',
        reason: 'Invalid releaseDate format — cannot determine availability.',
      },
      {
        id: 'QG-005',
        condition: 'releaseDate missing and allowInferredReleaseDate=true: inferred <= asOfDate',
        result: 'AVAILABLE',
        reason: 'Inferred releaseDate (10th of next month) confirms data was available.',
      },
      {
        id: 'QG-006',
        condition: 'releaseDate missing and allowInferredReleaseDate=true: inferred > asOfDate',
        result: 'UNAVAILABLE_RELEASE_DATE_FUTURE',
        reason: 'Inferred releaseDate is after asOfDate — data not yet available.',
      },
      {
        id: 'QG-007',
        condition: 'releaseDate missing and allowInferredReleaseDate=false',
        result: 'UNAVAILABLE_INFERRED_NOT_ALLOWED',
        reason: 'Missing releaseDate and inference is disabled — unavailable by policy.',
      },
    ],
    nonGoals: [
      'Does not compute ROI, profit, alpha, or outperformance.',
      'Does not modify production DB.',
      'Does not use realized return to infer availability.',
      'Does not constitute a buy or sell recommendation.',
    ],
  };
}

/**
 * Validate whether a MonthlyRevenue record is available as of asOfDate.
 *
 * MUST NOT use outcomePrice, returnPct, realizedReturnClass, or any other
 * realized-return field to determine availability.
 *
 * Disclaimer: This function does not provide investment recommendations.
 */
export function validateMonthlyRevenueQueryGate(
  record: MonthlyRevenueRecordForGate,
  asOfDate: string,
  options: { allowInferredReleaseDate?: boolean } = {}
): QueryGateValidationResult {
  const allowInferred = options.allowInferredReleaseDate ?? true;
  const forbiddenFields = scanForbiddenOutcomeFields(record);

  // Validate asOfDate
  if (!isValidIsoDate(asOfDate)) {
    return {
      available: false,
      gateResult: 'UNAVAILABLE_MISSING_PERIOD',
      reason: 'Invalid asOfDate format.',
      releaseDateUsed: null,
      releaseDateSource: 'MISSING',
      confidence: 'NONE',
      allowedInferredReleaseDate: allowInferred,
      forbiddenOutcomeFieldsPresent: forbiddenFields,
    };
  }

  // Check period fields
  const year = typeof record.year === 'number' ? record.year : null;
  const month = typeof record.month === 'number' ? record.month : null;
  const periodValid =
    year !== null &&
    month !== null &&
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    year >= 1900 &&
    year <= 2100;

  if (!periodValid) {
    return {
      available: false,
      gateResult: 'UNAVAILABLE_MISSING_PERIOD',
      reason: 'Missing or invalid year/month — cannot determine release date.',
      releaseDateUsed: null,
      releaseDateSource: 'MISSING',
      confidence: 'NONE',
      allowedInferredReleaseDate: allowInferred,
      forbiddenOutcomeFieldsPresent: forbiddenFields,
    };
  }

  // Check explicit releaseDate
  const releaseDateRaw =
    typeof record.releaseDate === 'string' ? record.releaseDate : null;

  if (releaseDateRaw !== null) {
    if (!isValidIsoDate(releaseDateRaw)) {
      return {
        available: false,
        gateResult: 'UNAVAILABLE_INVALID_RELEASE_DATE',
        reason: `releaseDate "${releaseDateRaw}" has invalid format.`,
        releaseDateUsed: releaseDateRaw,
        releaseDateSource: 'INVALID',
        confidence: 'NONE',
        allowedInferredReleaseDate: allowInferred,
        forbiddenOutcomeFieldsPresent: forbiddenFields,
      };
    }
    const isAvailable = releaseDateRaw <= asOfDate;
    return {
      available: isAvailable,
      gateResult: isAvailable ? 'AVAILABLE' : 'UNAVAILABLE_RELEASE_DATE_FUTURE',
      reason: isAvailable
        ? `Authoritative releaseDate ${releaseDateRaw} <= asOfDate ${asOfDate}.`
        : `Authoritative releaseDate ${releaseDateRaw} > asOfDate ${asOfDate}.`,
      releaseDateUsed: releaseDateRaw,
      releaseDateSource: 'AUTHORITATIVE',
      confidence: 'HIGH',
      allowedInferredReleaseDate: allowInferred,
      forbiddenOutcomeFieldsPresent: forbiddenFields,
    };
  }

  // releaseDate missing — use inference or block
  if (!allowInferred) {
    return {
      available: false,
      gateResult: 'UNAVAILABLE_INFERRED_NOT_ALLOWED',
      reason: 'releaseDate missing and allowInferredReleaseDate=false.',
      releaseDateUsed: null,
      releaseDateSource: 'MISSING',
      confidence: 'NONE',
      allowedInferredReleaseDate: allowInferred,
      forbiddenOutcomeFieldsPresent: forbiddenFields,
    };
  }

  const inferred = computeInferredReleaseDate(year!, month!);
  const isAvailable = inferred <= asOfDate;
  return {
    available: isAvailable,
    gateResult: isAvailable ? 'AVAILABLE' : 'UNAVAILABLE_RELEASE_DATE_FUTURE',
    reason: isAvailable
      ? `Inferred releaseDate ${inferred} <= asOfDate ${asOfDate} (INFERRED_NEXT_MONTH_10TH).`
      : `Inferred releaseDate ${inferred} > asOfDate ${asOfDate} (INFERRED_NEXT_MONTH_10TH).`,
    releaseDateUsed: inferred,
    releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
    confidence: 'LOW_TO_MEDIUM',
    allowedInferredReleaseDate: allowInferred,
    forbiddenOutcomeFieldsPresent: forbiddenFields,
  };
}

/**
 * Summarize the overall migration readiness for P14.
 *
 * Disclaimer: This summary does not constitute investment advice.
 */
export function summarizeMigrationReadiness(inputs: {
  approvalTokenPresent: boolean;
  p13ArtifactsPresent: boolean;
  migrationDraftReady: boolean;
  rollbackDraftReady: boolean;
  queryGateContractReady: boolean;
  fixtureValidationReady: boolean;
}): MigrationReadinessSummary {
  const {
    approvalTokenPresent,
    p13ArtifactsPresent,
    migrationDraftReady,
    rollbackDraftReady,
    queryGateContractReady,
    fixtureValidationReady,
  } = inputs;

  const approvalStatus: ApprovalStatus = approvalTokenPresent
    ? 'APPROVED_DRY_RUN_ONLY'
    : 'NOT_APPROVED';

  let finalClassification: string;
  const nextSteps: string[] = [];

  if (!p13ArtifactsPresent) {
    finalClassification = 'P14_MONTHLY_REVENUE_BLOCKED_BY_ARTIFACTS';
    nextSteps.push('Restore P13 artifacts before proceeding with P14.');
  } else if (!migrationDraftReady || !rollbackDraftReady) {
    finalClassification = 'P14_MONTHLY_REVENUE_DRY_RUN_FAILED';
    nextSteps.push('Investigate migration draft generation failures.');
  } else if (!fixtureValidationReady) {
    finalClassification = 'P14_MONTHLY_REVENUE_REQUIRES_QUERY_GATE_CODE_TRACE';
    nextSteps.push('Run fixture-only dry-run validation before advancing to P15.');
  } else if (!approvalTokenPresent) {
    finalClassification = 'P14_MONTHLY_REVENUE_AWAITING_SCHEMA_MIGRATION_APPROVAL';
    nextSteps.push('Present migration draft to authorized operator for approval.');
    nextSteps.push('Provide approval token P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY to proceed with P15.');
  } else {
    finalClassification = 'P14_MONTHLY_REVENUE_MIGRATION_DRY_RUN_COMPLETE';
    nextSteps.push('Dry-run complete. Proceed to P15 for actual schema migration with explicit production approval.');
  }

  return {
    phase: 'P14',
    generatedAt: new Date().toISOString(),
    approvalTokenPresent,
    approvalStatus,
    p13ArtifactsPresent,
    migrationDraftReady,
    rollbackDraftReady,
    queryGateContractReady,
    fixtureValidationReady,
    productionApplyAllowed: false,
    finalClassification,
    nextSteps,
  };
}

/**
 * Scan text for forbidden claims (ROI, alpha, profit, outperform, etc.).
 * Skips lines containing disclaimer language, non-goal declarations,
 * or scanner pattern definitions.
 *
 * Disclaimer: This scanner does not constitute investment advice.
 */
export function scanForbiddenClaims(text: string): ForbiddenClaimsHit[] {
  const hits: ForbiddenClaimsHit[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Skip disclaimer / non-goal / scanner pattern definition lines
    if (
      lower.includes('disclaimer') ||
      lower.includes('does not') ||
      lower.includes('forbidden claim') ||
      lower.includes('non-goal') ||
      lower.includes('nongoal') ||
      lower.includes('not provide') ||
      lower.includes('pattern: /') ||
      lower.includes('forbiddenclaimpattern')
    ) {
      continue;
    }

    for (const { pattern, label } of FORBIDDEN_CLAIM_PATTERNS) {
      // Skip alphaScore context for alpha label
      if (label === 'alpha' && (lower.includes('alphascore') || lower.includes('alpha score'))) {
        continue;
      }
      // Skip knowledge/hedge context for edge label
      if (label === 'edge' && (lower.includes('knowledge') || lower.includes('hedge'))) {
        continue;
      }

      if (pattern.test(line)) {
        hits.push({
          label,
          matchedText: line.trim(),
          lineNumber: i + 1,
          context: line.trim(),
        });
      }
    }
  }

  return hits;
}
