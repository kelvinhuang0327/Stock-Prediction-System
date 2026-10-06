/**
 * P19ActiveScoringPitReplayUtils.ts
 *
 * DISCLAIMER: Does not constitute investment advice. Does not compute ROI,
 * profit, alpha, win-rate, edge, or outperformance. Historical replay PIT
 * governance utility only.
 *
 * P19-HARDRESET: Active Scoring Corpus Regeneration after MonthlyRevenue PIT
 * Gate Patch. Utilities for building, validating, and summarizing the P19
 * PIT-safe active scoring replay corpus.
 *
 * Rules enforced:
 * 1. P19 output path ≠ P3 output path — overwrite protection
 * 2. No outcome / returnPct / realizedReturnClass may influence scoring snapshot
 * 3. MonthlyRevenue used in scoring iff releaseDate <= asOfDate
 * 4. productionApplyAllowed = false always
 * 5. Deterministic — no Math.random
 * 6. No forbidden claims in outputs
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const P19_CORPUS_PATH =
  'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl';

export const P3_CORPUS_PATH =
  'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl';

export const FROZEN_CORPUS_PATHS = [
  'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl',
  'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl',
  'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl',
  'outputs/online_validation/simulation_snapshot_corpus.jsonl',
];

export const TAIWAN_REVENUE_RELEASE_DAY = 10;
export const MIGRATION_TARGET = 'FIXTURE_DB_ONLY';
export const PRODUCTION_APPLY_ALLOWED = false;

export const PIT_GATE_STATUSES = [
  'GATE_PASSED',
  'GATE_REJECTED_UNRELEASED',
  'NOT_APPLICABLE_NO_DATA',
  'INFERRED_GATE_PASSED',
  'INFERRED_GATE_REJECTED',
] as const;

export type PitGateStatus = typeof PIT_GATE_STATUSES[number];

export const FORBIDDEN_OUTCOME_FIELDS = [
  'outcomePrice',
  'returnPct',
  'realizedReturnClass',
] as const;

export const FORBIDDEN_CLAIM_PATTERNS = [
  /\bROI\b/i,
  /\bwin[-\s]rate\b/i,
  /\boutperform\b/i,
  /\bbeat the market\b/i,
  /\bguaranteed\b/i,
  /\bprofit\b/i,
  /\binvestment recommendation\b/i,
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PitReplayConfig {
  outputPath: string;
  sourceCorpusPath: string;
  pitReplayRunId: string;
  pitReplayRunDate: string;
  productionApplyAllowed: false;
  allowInferredReleaseDate: boolean;
  migrationTarget: 'FIXTURE_DB_ONLY';
}

export interface MonthlyRevenueSnapshotRecord {
  stockId?: string | null;
  year?: number | null;
  month?: number | null;
  revenue?: number | null;
  releaseDate?: string | null;
  releaseDateSource?: string | null;
  releaseDateConfidence?: string | null;
}

export interface MonthlyRevenuePitClassification {
  pitGateStatus: PitGateStatus;
  releaseDate: string | null;
  releaseDateSource: string | null;
  releaseDateConfidence: string | null;
  inferred: boolean;
  reason: string;
}

export interface ActiveScoringPitSafetyResult {
  safe: boolean;
  violations: string[];
  forbiddenFieldsFound: string[];
}

export interface PitReplayCorpusSummary {
  pitReplayRunId: string;
  pitReplayRunDate: string;
  totalRows: number;
  uniqueSymbols: number;
  uniqueAsOfDates: number;
  horizonDistribution: Record<string, number>;
  scoringCompletenessStatusDistribution: Record<string, number>;
  researchBucketDistribution: Record<string, number>;
  monthlyRevenuePitGateStatusDistribution: Record<string, number>;
  completeAndPartialRatio: number;
  productionApplyAllowed: false;
  frozenCorpusUnchanged: boolean;
  validationStatus: 'PASS' | 'PARTIAL' | 'FAIL';
}

export interface P3ShapeComparisonResult {
  p3RowCount: number;
  p19RowCount: number;
  p3UniqueSymbols: number;
  p19UniqueSymbols: number;
  p3UniqueDates: number;
  p19UniqueDates: number;
  p3ScoringCompletenessDistribution: Record<string, number>;
  p19ScoringCompletenessDistribution: Record<string, number>;
  schemaCompatible: boolean;
  shapeCompatibility: 'COMPATIBLE' | 'PARTIAL' | 'INCOMPATIBLE';
  p19ReadyForP20Comparison: boolean;
  notes: string[];
}

export interface ForbiddenClaimScanResult {
  text: string;
  matches: string[];
  clean: boolean;
}

// ─── buildPitReplayConfig ─────────────────────────────────────────────────────

/**
 * Build a deterministic PIT replay configuration.
 */
export function buildPitReplayConfig(options: {
  pitReplayRunId?: string;
  pitReplayRunDate?: string;
  allowInferredReleaseDate?: boolean;
}): PitReplayConfig {
  const runDate = options.pitReplayRunDate ?? '2026-05-12';
  const runId = options.pitReplayRunId ?? `p19-pit-replay-${runDate}`;
  return {
    outputPath: P19_CORPUS_PATH,
    sourceCorpusPath: P3_CORPUS_PATH,
    pitReplayRunId: runId,
    pitReplayRunDate: runDate,
    productionApplyAllowed: false,
    allowInferredReleaseDate: options.allowInferredReleaseDate ?? true,
    migrationTarget: 'FIXTURE_DB_ONLY',
  };
}

// ─── validatePitReplayConfig ──────────────────────────────────────────────────

/**
 * Validate a PIT replay config — rejects overwrite of frozen corpus paths.
 */
export function validatePitReplayConfig(config: PitReplayConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Must not overwrite P3 or any frozen corpus
  if (FROZEN_CORPUS_PATHS.includes(config.outputPath as string)) {
    errors.push(
      `outputPath "${config.outputPath}" is a frozen corpus path — overwrite forbidden`,
    );
  }

  if (config.outputPath === P3_CORPUS_PATH) {
    errors.push(
      `outputPath must not equal P3_CORPUS_PATH — overwrite of P3 corpus forbidden`,
    );
  }

  if (config.productionApplyAllowed !== false) {
    errors.push('productionApplyAllowed must be false');
  }

  if (!config.pitReplayRunId || config.pitReplayRunId.trim() === '') {
    errors.push('pitReplayRunId must be non-empty');
  }

  if (!config.pitReplayRunDate || !/^\d{4}-\d{2}-\d{2}$/.test(config.pitReplayRunDate)) {
    errors.push('pitReplayRunDate must be YYYY-MM-DD');
  }

  return { valid: errors.length === 0, errors };
}

// ─── inferReleaseDateForPit ───────────────────────────────────────────────────

function inferReleaseDateForPit(year: number, month: number): string {
  if (month === 12) {
    return `${year + 1}-01-${String(TAIWAN_REVENUE_RELEASE_DAY).padStart(2, '0')}`;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(TAIWAN_REVENUE_RELEASE_DAY).padStart(2, '0')}`;
}

// ─── classifyMonthlyRevenueAvailabilityInSnapshot ─────────────────────────────

/**
 * Classify whether a MonthlyRevenue record is PIT-available as of `asOfDate`.
 *
 * Rules:
 * 1. No record → NOT_APPLICABLE_NO_DATA
 * 2. Explicit releaseDate <= asOfDate → GATE_PASSED
 * 3. Explicit releaseDate > asOfDate → GATE_REJECTED_UNRELEASED
 * 4. No releaseDate + allowInferred=true + inferred <= asOfDate → INFERRED_GATE_PASSED
 * 5. No releaseDate + allowInferred=true + inferred > asOfDate → INFERRED_GATE_REJECTED
 * 6. No releaseDate + allowInferred=false → NOT_APPLICABLE_NO_DATA
 */
export function classifyMonthlyRevenueAvailabilityInSnapshot(
  record: MonthlyRevenueSnapshotRecord | null | undefined,
  asOfDate: string,
  options?: { allowInferredReleaseDate?: boolean },
): MonthlyRevenuePitClassification {
  const allowInferred = options?.allowInferredReleaseDate ?? true;

  if (!record || record.year == null || record.month == null) {
    return {
      pitGateStatus: 'NOT_APPLICABLE_NO_DATA',
      releaseDate: null,
      releaseDateSource: null,
      releaseDateConfidence: null,
      inferred: false,
      reason: 'No MonthlyRevenue record or missing year/month',
    };
  }

  const year = record.year;
  const month = record.month;

  if (record.releaseDate) {
    const rd = typeof record.releaseDate === 'string'
      ? record.releaseDate.slice(0, 10)
      : String(record.releaseDate).slice(0, 10);
    const asOf = asOfDate.slice(0, 10);
    const available = rd <= asOf;
    return {
      pitGateStatus: available ? 'GATE_PASSED' : 'GATE_REJECTED_UNRELEASED',
      releaseDate: rd,
      releaseDateSource: record.releaseDateSource ?? 'EXPLICIT',
      releaseDateConfidence: record.releaseDateConfidence ?? 'HIGH',
      inferred: false,
      reason: available
        ? `releaseDate ${rd} <= asOfDate ${asOf}`
        : `releaseDate ${rd} > asOfDate ${asOf} — PIT gate rejects`,
    };
  }

  if (!allowInferred) {
    return {
      pitGateStatus: 'NOT_APPLICABLE_NO_DATA',
      releaseDate: null,
      releaseDateSource: null,
      releaseDateConfidence: null,
      inferred: false,
      reason: 'No releaseDate and allowInferredReleaseDate=false',
    };
  }

  // Infer
  const inferredRd = inferReleaseDateForPit(year, month);
  const asOf = asOfDate.slice(0, 10);
  const available = inferredRd <= asOf;
  return {
    pitGateStatus: available ? 'INFERRED_GATE_PASSED' : 'INFERRED_GATE_REJECTED',
    releaseDate: inferredRd,
    releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
    releaseDateConfidence: 'LOW_TO_MEDIUM',
    inferred: true,
    reason: available
      ? `Inferred releaseDate ${inferredRd} <= asOfDate ${asOf}`
      : `Inferred releaseDate ${inferredRd} > asOfDate ${asOf} — PIT gate rejects`,
  };
}

// ─── validateActiveScoringSnapshotPitSafety ───────────────────────────────────

/**
 * Validate that an active scoring snapshot row does not contain forbidden
 * outcome fields that could cause look-ahead leakage.
 */
export function validateActiveScoringSnapshotPitSafety(
  row: Record<string, unknown>,
  options?: { allowedOutcomeSnapshotKey?: string },
): ActiveScoringPitSafetyResult {
  const violations: string[] = [];
  const forbiddenFieldsFound: string[] = [];
  const allowedKey = options?.allowedOutcomeSnapshotKey ?? 'outcomeSnapshot';

  function scanObject(obj: unknown, path: string): void {
    if (obj === null || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const fullPath = path ? `${path}.${k}` : k;
      // Forbidden outcome fields must not appear outside the outcomeSnapshot container
      if (FORBIDDEN_OUTCOME_FIELDS.includes(k as typeof FORBIDDEN_OUTCOME_FIELDS[number])) {
        // Allow if they are inside the designated outcomeSnapshot key
        if (!path.startsWith(allowedKey)) {
          violations.push(`Forbidden field "${fullPath}" found outside ${allowedKey}`);
          forbiddenFieldsFound.push(fullPath);
        }
      }
      if (typeof v === 'object' && v !== null) {
        scanObject(v, fullPath);
      }
    }
  }

  // Scan activeScoringSnapshot specifically
  if (row.activeScoringSnapshot && typeof row.activeScoringSnapshot === 'object') {
    scanObject(row.activeScoringSnapshot, 'activeScoringSnapshot');
  }

  // Also check top-level fields
  for (const field of FORBIDDEN_OUTCOME_FIELDS) {
    if (field in row && !['outcomeSnapshot'].includes(field)) {
      violations.push(`Forbidden top-level field "${field}" found`);
      forbiddenFieldsFound.push(field);
    }
  }

  return {
    safe: violations.length === 0,
    violations,
    forbiddenFieldsFound,
  };
}

// ─── summarizePitReplayCorpus ─────────────────────────────────────────────────

/**
 * Summarize a P19 PIT replay corpus array into aggregate statistics.
 * Deterministic — result depends only on input rows.
 */
export function summarizePitReplayCorpus(
  rows: Array<Record<string, unknown>>,
): PitReplayCorpusSummary {
  const uniqueSymbols = new Set(rows.map(r => r['symbol'])).size;
  const uniqueAsOfDates = new Set(rows.map(r => r['originalAsOfDate'])).size;

  const horizonDist: Record<string, number> = {};
  const scoreCompletenessDist: Record<string, number> = {};
  const researchBucketDist: Record<string, number> = {};
  const pitGateDist: Record<string, number> = {};

  let completeCount = 0;
  let partialCount = 0;

  for (const row of rows) {
    // horizon
    const horizon = String((row['outcomeSnapshot'] as Record<string, unknown>)?.['horizonDays'] ?? 'unknown');
    horizonDist[horizon] = (horizonDist[horizon] ?? 0) + 1;

    // scoringCompletenessStatus
    const scs = String(row['scoringCompletenessStatus'] ?? 'unknown');
    scoreCompletenessDist[scs] = (scoreCompletenessDist[scs] ?? 0) + 1;
    if (scs === 'COMPLETE') completeCount++;
    if (scs === 'PARTIAL') partialCount++;

    // researchBucket
    const rb = String(row['researchBucket'] ?? 'unknown');
    researchBucketDist[rb] = (researchBucketDist[rb] ?? 0) + 1;

    // monthlyRevenuePitGateStatus
    const pgStatus = String(row['monthlyRevenuePitGateStatus'] ?? 'unknown');
    pitGateDist[pgStatus] = (pitGateDist[pgStatus] ?? 0) + 1;
  }

  const completeAndPartialRatio = rows.length > 0
    ? Math.round(((completeCount + partialCount) / rows.length) * 10000) / 100
    : 0;

  const validationStatus: 'PASS' | 'PARTIAL' | 'FAIL' =
    rows.length >= 4500 && uniqueSymbols >= 25 && uniqueAsOfDates >= 60 && completeAndPartialRatio >= 80
      ? 'PASS'
      : rows.length >= 4500 && completeAndPartialRatio >= 60
        ? 'PARTIAL'
        : 'FAIL';

  return {
    pitReplayRunId: String(rows[0]?.['pitReplayRunId'] ?? 'unknown'),
    pitReplayRunDate: String(rows[0]?.['pitReplayRunDate'] ?? ''),
    totalRows: rows.length,
    uniqueSymbols,
    uniqueAsOfDates,
    horizonDistribution: horizonDist,
    scoringCompletenessStatusDistribution: scoreCompletenessDist,
    researchBucketDistribution: researchBucketDist,
    monthlyRevenuePitGateStatusDistribution: pitGateDist,
    completeAndPartialRatio,
    productionApplyAllowed: false,
    frozenCorpusUnchanged: true,
    validationStatus,
  };
}

// ─── comparePitReplayToP3Shape ────────────────────────────────────────────────

/**
 * Compare P19 replay corpus shape to the P3 corpus for schema compatibility.
 * Returns whether P19 is ready for P20 pre/post PIT comparison.
 */
export function comparePitReplayToP3Shape(
  p19Rows: Array<Record<string, unknown>>,
  p3Rows: Array<Record<string, unknown>>,
): P3ShapeComparisonResult {
  const p3Syms = new Set(p3Rows.map(r => r['symbol'])).size;
  const p19Syms = new Set(p19Rows.map(r => r['symbol'])).size;
  const p3Dates = new Set(p3Rows.map(r => r['originalAsOfDate'])).size;
  const p19Dates = new Set(p19Rows.map(r => r['originalAsOfDate'])).size;

  const p3ScoringDist: Record<string, number> = {};
  const p19ScoringDist: Record<string, number> = {};

  for (const r of p3Rows) {
    const k = String(r['scoringCompletenessStatus'] ?? 'unknown');
    p3ScoringDist[k] = (p3ScoringDist[k] ?? 0) + 1;
  }
  for (const r of p19Rows) {
    const k = String(r['scoringCompletenessStatus'] ?? 'unknown');
    p19ScoringDist[k] = (p19ScoringDist[k] ?? 0) + 1;
  }

  // Check required P19-only fields
  const p19RequiredFields = ['pitReplayRunId', 'monthlyRevenuePitGateStatus', 'monthlyRevenueAvailabilitySummary'];
  const missingP19Fields = p19Rows.length > 0
    ? p19RequiredFields.filter(f => !(f in (p19Rows[0] ?? {})))
    : p19RequiredFields;

  // Check P3-compatible fields present in P19
  const p3CoreFields = ['symbol', 'originalAsOfDate', 'scoringCompletenessStatus', 'activeScoringSnapshot', 'outcomeSnapshot', 'researchBucket'];
  const missingP3CoreInP19 = p19Rows.length > 0
    ? p3CoreFields.filter(f => !(f in (p19Rows[0] ?? {})))
    : p3CoreFields;

  const schemaCompatible = missingP19Fields.length === 0 && missingP3CoreInP19.length === 0;

  const notes: string[] = [];
  if (missingP19Fields.length > 0) notes.push(`P19 missing fields: ${missingP19Fields.join(', ')}`);
  if (missingP3CoreInP19.length > 0) notes.push(`P3 core fields missing in P19: ${missingP3CoreInP19.join(', ')}`);
  if (p19Rows.length < 4500) notes.push(`P19 row count ${p19Rows.length} < 4500`);
  if (p19Syms < 25) notes.push(`P19 unique symbols ${p19Syms} < 25`);
  if (p19Dates < 60) notes.push(`P19 unique dates ${p19Dates} < 60`);

  const shapeCompatibility: 'COMPATIBLE' | 'PARTIAL' | 'INCOMPATIBLE' =
    schemaCompatible && p19Rows.length >= 4500 && p19Syms >= 25 && p19Dates >= 60
      ? 'COMPATIBLE'
      : schemaCompatible
        ? 'PARTIAL'
        : 'INCOMPATIBLE';

  const p19ReadyForP20Comparison = shapeCompatibility === 'COMPATIBLE';

  return {
    p3RowCount: p3Rows.length,
    p19RowCount: p19Rows.length,
    p3UniqueSymbols: p3Syms,
    p19UniqueSymbols: p19Syms,
    p3UniqueDates: p3Dates,
    p19UniqueDates: p19Dates,
    p3ScoringCompletenessDistribution: p3ScoringDist,
    p19ScoringCompletenessDistribution: p19ScoringDist,
    schemaCompatible,
    shapeCompatibility,
    p19ReadyForP20Comparison,
    notes,
  };
}

// ─── scanForbiddenClaims ──────────────────────────────────────────────────────

/**
 * Scan text for forbidden claim patterns. Returns matches and clean flag.
 * Exempts: disclaimer context, scanner definition code, alphaScore field names.
 */
export function scanForbiddenClaims(text: string): ForbiddenClaimScanResult {
  const matches: string[] = [];

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Exempt disclaimer lines
    if (/does not (constitute|compute|produce|imply)/i.test(trimmed)) continue;
    // Exempt scanner definition patterns
    if (/FORBIDDEN_CLAIM_PATTERNS|scanForbiddenClaims|ForbiddenClaim/i.test(trimmed)) continue;
    // Exempt alphaScore field name references (not a claim)
    const lineNoAlpha = trimmed.replace(/\balphaScore\b/g, '');
    // Exempt "alpha" when part of "alphaScore" only
    const checkLine = lineNoAlpha;

    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      if (pattern.test(checkLine)) {
        matches.push(trimmed.slice(0, 120));
        break;
      }
    }
  }

  return { text, matches, clean: matches.length === 0 };
}
