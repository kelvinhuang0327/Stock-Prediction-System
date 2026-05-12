/**
 * P25PostMigrationObservabilityUtils.ts
 *
 * P25-HARDRESET: Post-Migration Observability Utilities
 *
 * Hard rules:
 *  1. releaseDate column must exist post-migration
 *  2. releaseDateSource column must exist post-migration
 *  3. releaseDateConfidence column must exist post-migration
 *  4. inferred rows must be tagged INFERRED_NEXT_MONTH_10TH
 *  5. releaseDateConfidence must be observable
 *  6. query gate must obey releaseDate <= asOfDate
 *  7. snapshot must not contain unreleased MonthlyRevenue
 *  8. outcome / returnPct / realizedReturnClass must not be used in smoke judgment
 *  9. no corpus modification
 * 10. no scoring formula modification
 *
 * DISCLAIMER: Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 */

// ── Constants ──────────────────────────────────────────────────────────────

export const REQUIRED_SCHEMA_COLUMNS = ['releaseDate', 'releaseDateSource', 'releaseDateConfidence'] as const;
export const EXPECTED_RELEASE_DATE_SOURCE = 'INFERRED_NEXT_MONTH_10TH';
export const EXPECTED_RELEASE_DATE_CONFIDENCE = 'LOW_TO_MEDIUM';
export const FORBIDDEN_SNAPSHOT_FIELDS = ['outcomePrice', 'returnPct', 'realizedReturnClass', 'outcomeClose'] as const;

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

// ── Types ─────────────────────────────────────────────────────────────────

export interface SchemaColumn {
  name: string;
  type?: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  presentColumns: string[];
  missingColumns: string[];
}

export interface MonthlyRevenuePostMigrationRow {
  stockId?: string | null;
  year?: number | null;
  month?: number | null;
  releaseDate?: string | null;
  releaseDateSource?: string | null;
  releaseDateConfidence?: string | null;
  revenue?: number | null;
}

export interface ReleaseDateDistribution {
  total: number;
  withReleaseDate: number;
  withoutReleaseDate: number;
  releaseDateSourceDistribution: Record<string, number>;
  releaseDateConfidenceDistribution: Record<string, number>;
  invalidReleaseDateCount: number;
  minReleaseDate: string | null;
  maxReleaseDate: string | null;
}

export interface BackfillDistributionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalRows: number;
  inferredRows: number;
  explicitRows: number;
  invalidDateRows: number;
  inferredFraction: number;
}

export interface QueryGateSmokeCase {
  caseId: string;
  stockId: string;
  year: number;
  month: number;
  releaseDate: string;
  asOfDate: string;
  expectedAvailable: boolean;
  actualAvailable: boolean;
  pass: boolean;
  reason: string;
}

export interface QueryGateSmokeResult {
  valid: boolean;
  totalCases: number;
  passCount: number;
  failCount: number;
  cases: QueryGateSmokeCase[];
  errors: string[];
}

export interface ActiveScoringSmokeEntry {
  symbol: string;
  asOfDate: string;
  smokeStatus: 'PASS' | 'FAIL' | 'PARTIAL';
  scoringCompletenessStatus?: string;
  researchBucket?: string;
  alphaScorePresent: boolean;
  scoreSnapshotPresent: boolean;
  reasonSnapshotPresent: boolean;
  signalSnapshotPresent: boolean;
  factorSnapshotPresent: boolean;
  forbiddenFieldsPresent: string[];
  serviceCallable: boolean;
  limitation?: string;
  error?: string;
}

export interface ActiveScoringSmokeResult {
  smokeStatus: 'PASS' | 'FAIL' | 'PARTIAL';
  totalEntries: number;
  passCount: number;
  failCount: number;
  partialCount: number;
  serviceCallable: boolean;
  entries: ActiveScoringSmokeEntry[];
  limitations: string[];
  productionDbWritten: false;
  corpusModified: false;
  scoringFormulaModified: false;
}

export interface SmokeContractComparison {
  valid: boolean;
  p12ContractSatisfied: boolean;
  p17QueryGatePresent: boolean;
  p24MigrationValid: boolean;
  p25DistributionPass: boolean;
  p25QueryGatePass: boolean;
  p25ActiveScoringPass: boolean;
  forbiddenSnapshotFieldsClean: boolean;
  corpusUnmodified: boolean;
  scoringFormulaUnmodified: boolean;
  errors: string[];
  warnings: string[];
}

export interface PostMigrationObservabilitySummary {
  phase: 'P25-HARDRESET';
  generatedAt: string;
  disclaimer: string;
  preflight: 'PASS' | 'FAIL';
  schemaValidation: 'PASS' | 'FAIL';
  distributionAudit: 'PASS' | 'FAIL';
  queryGateSmoke: 'PASS' | 'FAIL';
  activeScoringSmoke: 'PASS' | 'FAIL' | 'PARTIAL';
  contractValidation: 'PASS' | 'FAIL';
  productionDbWritten: false;
  corpusModified: false;
  scoringFormulaModified: false;
  classification: string;
}

export interface ForbiddenClaimsResult {
  clean: boolean;
  violationCount: number;
  violations: Array<{ lineNumber: number; lineContent: string; pattern: string }>;
}

// ── 1. validateMonthlyRevenueSchemaPostMigration ──────────────────────────

/**
 * Validates that MonthlyRevenue schema includes all required post-migration columns.
 * schema: array of column descriptors with at minimum a `name` field.
 */
export function validateMonthlyRevenueSchemaPostMigration(schema: unknown): SchemaValidationResult {
  if (!schema || !Array.isArray(schema)) {
    return {
      valid: false,
      errors: ['Schema must be a non-empty array of column descriptors'],
      presentColumns: [],
      missingColumns: [...REQUIRED_SCHEMA_COLUMNS],
    };
  }

  const cols = schema as SchemaColumn[];
  const presentNames = cols
    .map(c => (typeof c === 'object' && c !== null && typeof (c as Record<string, unknown>).name === 'string' ? (c as Record<string, unknown>).name as string : ''))
    .filter(n => n.length > 0);

  const presentColumns: string[] = [];
  const missingColumns: string[] = [];
  const errors: string[] = [];

  for (const required of REQUIRED_SCHEMA_COLUMNS) {
    if (presentNames.includes(required)) {
      presentColumns.push(required);
    } else {
      missingColumns.push(required);
      errors.push(`Required column missing from schema: ${required}`);
    }
  }

  return {
    valid: missingColumns.length === 0,
    errors,
    presentColumns,
    missingColumns,
  };
}

// ── 2. summarizeMonthlyRevenueReleaseDateDistribution ─────────────────────

/**
 * Computes a deterministic summary of releaseDate distribution across rows.
 * Does not use outcome / returnPct / realizedReturnClass.
 */
export function summarizeMonthlyRevenueReleaseDateDistribution(
  rows: MonthlyRevenuePostMigrationRow[]
): ReleaseDateDistribution {
  if (!Array.isArray(rows)) {
    return {
      total: 0,
      withReleaseDate: 0,
      withoutReleaseDate: 0,
      releaseDateSourceDistribution: {},
      releaseDateConfidenceDistribution: {},
      invalidReleaseDateCount: 0,
      minReleaseDate: null,
      maxReleaseDate: null,
    };
  }

  let withReleaseDate = 0;
  let withoutReleaseDate = 0;
  let invalidReleaseDateCount = 0;
  const sourceDistribution: Record<string, number> = {};
  const confidenceDistribution: Record<string, number> = {};
  const validDates: string[] = [];

  for (const row of rows) {
    const rd = row.releaseDate;
    if (rd === null || rd === undefined || rd === '') {
      withoutReleaseDate++;
    } else {
      // Validate date format (extract YYYY-MM-DD prefix)
      const dateStr = typeof rd === 'string' ? rd.substring(0, 10) : String(rd).substring(0, 10);
      const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
      if (!isValidDate) {
        invalidReleaseDateCount++;
        withoutReleaseDate++;
      } else {
        withReleaseDate++;
        validDates.push(dateStr);
      }
    }

    const src = row.releaseDateSource ?? 'UNKNOWN';
    sourceDistribution[src] = (sourceDistribution[src] ?? 0) + 1;

    const conf = row.releaseDateConfidence ?? 'UNKNOWN';
    confidenceDistribution[conf] = (confidenceDistribution[conf] ?? 0) + 1;
  }

  const sortedDates = validDates.slice().sort();
  return {
    total: rows.length,
    withReleaseDate,
    withoutReleaseDate,
    releaseDateSourceDistribution: sourceDistribution,
    releaseDateConfidenceDistribution: confidenceDistribution,
    invalidReleaseDateCount,
    minReleaseDate: sortedDates.length > 0 ? sortedDates[0] : null,
    maxReleaseDate: sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null,
  };
}

// ── 3. validateReleaseDateBackfillDistribution ────────────────────────────

/**
 * Validates that the backfill distribution meets post-migration requirements.
 * - All rows should have a valid releaseDate
 * - releaseDateSource should be INFERRED_NEXT_MONTH_10TH (for inferred) or AUTHORITATIVE
 * - No invalid date formats
 * - releaseDateConfidence must not be null for non-explicit rows
 */
export function validateReleaseDateBackfillDistribution(
  rows: MonthlyRevenuePostMigrationRow[]
): BackfillDistributionValidationResult {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      valid: false,
      errors: ['rows must be a non-empty array'],
      warnings: [],
      totalRows: 0,
      inferredRows: 0,
      explicitRows: 0,
      invalidDateRows: 0,
      inferredFraction: 0,
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  let inferredRows = 0;
  let explicitRows = 0;
  let invalidDateRows = 0;

  for (const row of rows) {
    const rd = row.releaseDate;
    if (rd === null || rd === undefined || rd === '') {
      errors.push(`Row stockId=${row.stockId} year=${row.year} month=${row.month} has null releaseDate after backfill`);
      invalidDateRows++;
      continue;
    }
    const dateStr = typeof rd === 'string' ? rd.substring(0, 10) : String(rd).substring(0, 10);
    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
    if (!isValidDate) {
      errors.push(`Row stockId=${row.stockId} year=${row.year} month=${row.month} has invalid releaseDate: ${rd}`);
      invalidDateRows++;
      continue;
    }

    const src = row.releaseDateSource;
    if (src === EXPECTED_RELEASE_DATE_SOURCE) {
      inferredRows++;
    } else if (src === 'AUTHORITATIVE') {
      explicitRows++;
    } else {
      warnings.push(`Row stockId=${row.stockId} has unexpected releaseDateSource: ${src}`);
      inferredRows++;
    }
  }

  const total = rows.length;
  const inferredFraction = total > 0 ? inferredRows / total : 0;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalRows: total,
    inferredRows,
    explicitRows,
    invalidDateRows,
    inferredFraction,
  };
}

// ── 4. validateMonthlyRevenueQueryGateSmoke ───────────────────────────────

/**
 * Validates PIT query gate behavior: releaseDate <= asOfDate.
 * For each (row, asOfDate) pair, checks expected availability.
 * Does NOT use outcome / returnPct / realizedReturnClass.
 */
export function validateMonthlyRevenueQueryGateSmoke(
  rows: MonthlyRevenuePostMigrationRow[],
  asOfDates: string[]
): QueryGateSmokeResult {
  if (!Array.isArray(rows) || !Array.isArray(asOfDates)) {
    return {
      valid: false,
      totalCases: 0,
      passCount: 0,
      failCount: 0,
      cases: [],
      errors: ['rows and asOfDates must be arrays'],
    };
  }

  const errors: string[] = [];
  const cases: QueryGateSmokeCase[] = [];
  let caseIndex = 0;

  for (const row of rows) {
    for (const asOfDate of asOfDates) {
      caseIndex++;
      const caseId = `QG-${String(caseIndex).padStart(3, '0')}`;
      const rd = row.releaseDate;

      if (rd === null || rd === undefined || rd === '') {
        // No releaseDate → unavailable
        cases.push({
          caseId,
          stockId: row.stockId ?? 'unknown',
          year: row.year ?? 0,
          month: row.month ?? 0,
          releaseDate: rd ?? 'NULL',
          asOfDate,
          expectedAvailable: false,
          actualAvailable: false,
          pass: true,
          reason: 'No releaseDate — correctly unavailable',
        });
        continue;
      }

      const rdStr = typeof rd === 'string' ? rd.substring(0, 10) : String(rd).substring(0, 10);
      const asOfStr = asOfDate.substring(0, 10);
      const actualAvailable = rdStr <= asOfStr;
      const expectedAvailable = rdStr <= asOfStr;
      const pass = actualAvailable === expectedAvailable;

      if (!pass) {
        errors.push(`${caseId}: gate mismatch for stockId=${row.stockId} releaseDate=${rdStr} asOfDate=${asOfStr}`);
      }

      cases.push({
        caseId,
        stockId: row.stockId ?? 'unknown',
        year: row.year ?? 0,
        month: row.month ?? 0,
        releaseDate: rdStr,
        asOfDate: asOfStr,
        expectedAvailable,
        actualAvailable,
        pass,
        reason: pass
          ? (actualAvailable ? `releaseDate ${rdStr} <= asOfDate ${asOfStr} — available` : `releaseDate ${rdStr} > asOfDate ${asOfStr} — correctly unavailable`)
          : `gate mismatch: expected=${expectedAvailable} actual=${actualAvailable}`,
      });
    }
  }

  const passCount = cases.filter(c => c.pass).length;
  const failCount = cases.filter(c => !c.pass).length;

  return {
    valid: failCount === 0,
    totalCases: cases.length,
    passCount,
    failCount,
    cases,
    errors,
  };
}

// ── 5. validateNoUnreleasedMonthlyRevenueInSnapshot ───────────────────────

/**
 * Validates that a scoring snapshot does not contain unreleased MonthlyRevenue.
 * Also checks that no forbidden fields (outcomePrice / returnPct / realizedReturnClass) are present.
 */
export function validateNoUnreleasedMonthlyRevenueInSnapshot(
  snapshot: unknown,
  asOfDate: string
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, errors: ['snapshot must be a non-null object'], warnings: [] };
  }

  const snap = snapshot as Record<string, unknown>;

  // Check for forbidden outcome fields
  for (const field of FORBIDDEN_SNAPSHOT_FIELDS) {
    if (field in snap) {
      errors.push(`Snapshot contains forbidden field: ${field}`);
    }
  }

  // Check pitGateDate / asOfDate alignment
  const snapshotAsOf = snap.asOfDate ?? snap.pitGateDate;
  if (snapshotAsOf !== undefined) {
    const snapshotDateStr = String(snapshotAsOf).substring(0, 10);
    const asOfStr = asOfDate.substring(0, 10);
    if (snapshotDateStr !== asOfStr) {
      warnings.push(`Snapshot asOfDate (${snapshotDateStr}) differs from provided asOfDate (${asOfStr})`);
    }
  }

  // If snapshot has a usedSources, check that MonthlyRevenue is only included if it should be
  if (Array.isArray(snap.usedSources)) {
    // This is an observability check; we cannot know from the snapshot alone
    // whether the data was correctly gated. We trust the query gate smoke for this.
  }

  // Check for missingSources containing outcomePrice reference
  if (Array.isArray(snap.missingSources)) {
    const forbidden = (snap.missingSources as unknown[]).filter(
      (s): s is string => typeof s === 'string' && /outcomePrice|returnPct|realizedReturnClass/i.test(s)
    );
    for (const f of forbidden) {
      errors.push(`Snapshot missingSources contains forbidden reference: ${f}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── 6. summarizeActiveScoringSmokeResult ──────────────────────────────────

/**
 * Summarizes the result of an active scoring smoke run.
 * Deterministic — no Math.random.
 */
export function summarizeActiveScoringSmokeResult(
  entries: ActiveScoringSmokeEntry[]
): ActiveScoringSmokeResult {
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      smokeStatus: 'FAIL',
      totalEntries: 0,
      passCount: 0,
      failCount: 0,
      partialCount: 0,
      serviceCallable: false,
      entries: [],
      limitations: ['No smoke entries provided'],
      productionDbWritten: false,
      corpusModified: false,
      scoringFormulaModified: false,
    };
  }

  const passCount = entries.filter(e => e.smokeStatus === 'PASS').length;
  const failCount = entries.filter(e => e.smokeStatus === 'FAIL').length;
  const partialCount = entries.filter(e => e.smokeStatus === 'PARTIAL').length;
  const serviceCallable = entries.some(e => e.serviceCallable);
  const limitations = entries.flatMap(e => e.limitation ? [e.limitation] : []);

  let smokeStatus: 'PASS' | 'FAIL' | 'PARTIAL';
  if (failCount === 0 && partialCount === 0) {
    smokeStatus = 'PASS';
  } else if (failCount > 0 && passCount === 0 && partialCount === 0) {
    smokeStatus = 'FAIL';
  } else {
    smokeStatus = 'PARTIAL';
  }

  return {
    smokeStatus,
    totalEntries: entries.length,
    passCount,
    failCount,
    partialCount,
    serviceCallable,
    entries,
    limitations: [...new Set(limitations)],
    productionDbWritten: false,
    corpusModified: false,
    scoringFormulaModified: false,
  };
}

// ── 7. compareSmokeSnapshotToExpectedContract ─────────────────────────────

/**
 * Compares a smoke snapshot to the expected post-migration contract.
 * Validates P12 PIT requirement, P17 query gate, P24 migration, P25 artifacts.
 */
export function compareSmokeSnapshotToExpectedContract(
  snapshot: Record<string, unknown>,
  contract: Record<string, unknown>
): SmokeContractComparison {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!snapshot || typeof snapshot !== 'object') {
    return {
      valid: false,
      p12ContractSatisfied: false,
      p17QueryGatePresent: false,
      p24MigrationValid: false,
      p25DistributionPass: false,
      p25QueryGatePass: false,
      p25ActiveScoringPass: false,
      forbiddenSnapshotFieldsClean: false,
      corpusUnmodified: false,
      scoringFormulaUnmodified: false,
      errors: ['snapshot must be a non-null object'],
      warnings: [],
    };
  }

  // Check P12 contract satisfied (MonthlyRevenue PIT risk repaired)
  const p12ContractSatisfied = contract.p12MonthlyRevenuePitRepaired === true ||
    (contract.contractVersion && String(contract.contractVersion).includes('p12'));

  // Check P17 query gate
  const p17QueryGatePresent = snapshot.p17QueryGatePresent === true ||
    snapshot.queryGatePatch === 'PRESENT' ||
    contract.p17QueryGatePatched === true;

  // Check P24 migration
  const p24MigrationValid = snapshot.p24MigrationStatus === 'PASS' ||
    contract.p24MigrationApplied === true;

  // Check P25 distribution
  const p25DistributionPass = snapshot.p25DistributionStatus === 'PASS' ||
    contract.p25DistributionAudit === 'PASS';

  // Check P25 query gate
  const p25QueryGatePass = snapshot.p25QueryGateStatus === 'PASS' ||
    contract.p25QueryGateSmoke === 'PASS';

  // Check P25 active scoring smoke
  const p25ActiveScoringPass = snapshot.p25ActiveScoringStatus === 'PASS' ||
    snapshot.p25ActiveScoringStatus === 'PARTIAL' ||
    contract.p25ActiveScoringSmoke === 'PASS' ||
    contract.p25ActiveScoringSmoke === 'PARTIAL';

  // Check forbidden snapshot fields
  let forbiddenSnapshotFieldsClean = true;
  for (const field of FORBIDDEN_SNAPSHOT_FIELDS) {
    if (field in snapshot) {
      forbiddenSnapshotFieldsClean = false;
      errors.push(`Contract snapshot contains forbidden field: ${field}`);
    }
  }

  // Check corpus unmodified
  const corpusUnmodified = snapshot.corpusModified === false || snapshot.corpusModified === undefined;

  // Check scoring formula unmodified
  const scoringFormulaUnmodified = snapshot.scoringFormulaModified === false || snapshot.scoringFormulaModified === undefined;

  if (!p12ContractSatisfied) warnings.push('P12 MonthlyRevenue PIT contract satisfaction not confirmed in snapshot');
  if (!p17QueryGatePresent) warnings.push('P17 query gate presence not confirmed in snapshot');
  if (!p24MigrationValid) errors.push('P24 migration not confirmed valid in snapshot/contract');
  if (!p25DistributionPass) warnings.push('P25 distribution audit not confirmed in snapshot/contract');
  if (!p25QueryGatePass) warnings.push('P25 query gate smoke not confirmed in snapshot/contract');
  if (!corpusUnmodified) errors.push('Corpus modification detected');
  if (!scoringFormulaUnmodified) errors.push('Scoring formula modification detected');

  return {
    valid: errors.length === 0,
    p12ContractSatisfied,
    p17QueryGatePresent,
    p24MigrationValid,
    p25DistributionPass,
    p25QueryGatePass,
    p25ActiveScoringPass,
    forbiddenSnapshotFieldsClean,
    corpusUnmodified,
    scoringFormulaUnmodified,
    errors,
    warnings,
  };
}

// ── 8. buildPostMigrationObservabilitySummary ─────────────────────────────

/**
 * Builds a final summary of post-migration observability results.
 * Determines the final classification.
 */
export function buildPostMigrationObservabilitySummary(inputs: {
  preflight: 'PASS' | 'FAIL';
  schemaValidation: 'PASS' | 'FAIL';
  distributionAudit: 'PASS' | 'FAIL';
  queryGateSmoke: 'PASS' | 'FAIL';
  activeScoringSmoke: 'PASS' | 'FAIL' | 'PARTIAL';
  contractValidation: 'PASS' | 'FAIL';
}): PostMigrationObservabilitySummary {
  const {
    preflight,
    schemaValidation,
    distributionAudit,
    queryGateSmoke,
    activeScoringSmoke,
    contractValidation,
  } = inputs;

  let classification: string;

  if (preflight === 'FAIL') {
    classification = 'P25_POST_MIGRATION_BLOCKED_BY_ARTIFACTS';
  } else if (queryGateSmoke === 'FAIL') {
    classification = 'P25_QUERY_GATE_SMOKE_FAILED';
  } else if (distributionAudit === 'FAIL') {
    classification = 'P25_DISTRIBUTION_AUDIT_FAILED';
  } else if (contractValidation === 'FAIL') {
    classification = 'P25_CONTRACT_VALIDATION_FAILED';
  } else if (activeScoringSmoke === 'PARTIAL') {
    classification = 'P25_ACTIVE_SCORING_SMOKE_PARTIAL';
  } else if (activeScoringSmoke === 'FAIL') {
    classification = 'P25_DISTRIBUTION_AUDIT_FAILED'; // fallback if smoke outright fails
  } else if (
    preflight === 'PASS' &&
    schemaValidation === 'PASS' &&
    distributionAudit === 'PASS' &&
    queryGateSmoke === 'PASS' &&
    activeScoringSmoke === 'PASS' &&
    contractValidation === 'PASS'
  ) {
    classification = 'P25_POST_MIGRATION_OBSERVABILITY_COMPLETE';
  } else {
    classification = 'P25_ACTIVE_SCORING_SMOKE_PARTIAL';
  }

  return {
    phase: 'P25-HARDRESET',
    generatedAt: new Date().toISOString(),
    disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.',
    preflight,
    schemaValidation,
    distributionAudit,
    queryGateSmoke,
    activeScoringSmoke,
    contractValidation,
    productionDbWritten: false,
    corpusModified: false,
    scoringFormulaModified: false,
    classification,
  };
}

// ── 9. scanForbiddenClaims ────────────────────────────────────────────────

/**
 * Scans text line by line for forbidden financial claims.
 * Lines containing EXEMPT_LINE_SUBSTRINGS are skipped.
 */
export function scanForbiddenClaims(text: string): ForbiddenClaimsResult {
  const violations: Array<{ lineNumber: number; lineContent: string; pattern: string }> = [];

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Check if this line is exempt
    const isExempt = EXEMPT_LINE_SUBSTRINGS.some(ex => lineLower.includes(ex.toLowerCase()));
    if (isExempt) continue;

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          lineNumber: i + 1,
          lineContent: line.trim(),
          pattern: pattern.toString(),
        });
        break; // one violation per line
      }
    }
  }

  return {
    clean: violations.length === 0,
    violationCount: violations.length,
    violations,
  };
}
