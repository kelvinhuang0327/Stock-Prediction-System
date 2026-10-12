/**
 * P12PitFeatureContractUtils.ts
 * P12-HARDRESET — PIT Feature Contract utilities
 *
 * Provides pure functions for:
 *  - Feature source name normalization
 *  - PIT risk classification
 *  - asOf rule validation
 *  - Feature contract entry validation
 *  - Snapshot field leakage detection
 *  - Contract summary generation
 *  - Forbidden claims scanning
 *
 * NO scoring changes. NO corpus modifications. NO investment claims.
 * Observability and contract scaffolding only.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type PitRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type FeatureSourceName =
  | 'StockQuote'
  | 'InstitutionalChip'
  | 'MonthlyRevenue'
  | 'FinancialReport'
  | 'NewsEvent'
  | 'TechnicalIndicators'
  | 'MarketRegime'
  | 'ActiveScoringSnapshot'
  | 'ReasonSignalFactorSnapshot'
  | 'BucketContract'
  | 'TwseTradingCalendar'
  | string;

export interface FeatureContractEntry {
  sourceName: FeatureSourceName;
  dateField: string | null;          // null = no time dimension (static artifacts)
  asOfRule: string;                  // human-readable rule
  pitRiskLevel: PitRiskLevel;
  repairNeeded: boolean;
  repairDescription?: string;
  forbiddenSnapshotFields?: string[];
}

export interface PitFeatureContract {
  contractVersion: string;
  generatedAt: string;
  disclaimer: string;
  featureSourceContracts: FeatureContractEntry[];
  pitSafetyRequirements: PitSafetyRequirement[];
  snapshotCaptureRequirements: SnapshotCaptureRequirement[];
  repairPriorities: RepairPriority[];
  nonGoals: string[];
}

export interface PitSafetyRequirement {
  requirementId: string;
  description: string;
  scope: FeatureSourceName[];
  enforcement: 'HARD' | 'SOFT';
}

export interface SnapshotCaptureRequirement {
  fieldName: string;
  required: boolean;
  forbiddenValues?: string[];
  description: string;
}

export interface RepairPriority {
  priority: 'P0' | 'P1' | 'P2';
  sourceName: FeatureSourceName;
  repairAction: string;
  rationale: string;
}

export interface ContractValidationError {
  field: string;
  message: string;
}

export interface SnapshotValidationResult {
  valid: boolean;
  errors: ContractValidationError[];
  warnings: string[];
}

export interface ContractSummary {
  totalSources: number;
  byRiskLevel: Record<PitRiskLevel, number>;
  highRiskSources: FeatureSourceName[];
  repairNeededSources: FeatureSourceName[];
  repairPriorityP0: number;
  repairPriorityP1: number;
  requirementCount: number;
  snapshotCaptureRuleCount: number;
  verdict: 'CONTRACT_COMPLETE' | 'CONTRACT_PARTIAL' | 'CONTRACT_BLOCKED';
}

// ─── Known source registry ────────────────────────────────────────────────

const KNOWN_SOURCES = new Set<FeatureSourceName>([
  'StockQuote',
  'InstitutionalChip',
  'MonthlyRevenue',
  'FinancialReport',
  'NewsEvent',
  'TechnicalIndicators',
  'MarketRegime',
  'ActiveScoringSnapshot',
  'ReasonSignalFactorSnapshot',
  'BucketContract',
  'TwseTradingCalendar',
]);

// ─── Forbidden snapshot fields ────────────────────────────────────────────

export const FORBIDDEN_SNAPSHOT_FIELDS: ReadonlyArray<string> = [
  'outcomePrice',
  'returnPct',
  'realizedReturnClass',
  'futurePrice',
  'baselineResult',
  'outcomeClose',
  'horizonReturnPct',
];

// ─── Forbidden claim patterns (same as P6/P8) ────────────────────────────

const FORBIDDEN_CLAIM_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\bROI\b/i, label: 'ROI' },
  { pattern: /win[\s-]rate/i, label: 'win-rate' },
  { pattern: /\balpha\b/i, label: 'alpha' },
  { pattern: /\bedge\b/i, label: 'edge' },
  { pattern: /\bprofit\b/i, label: 'profit' },
  { pattern: /\boutperform\b/i, label: 'outperform' },
  { pattern: /\bbeat\b/i, label: 'beat' },
  { pattern: /\bbuy\b/i, label: 'buy' },
  { pattern: /\bsell\b/i, label: 'sell' },
  { pattern: /\bguaranteed\b/i, label: 'guaranteed' },
  { pattern: /investment\s+recommendation/i, label: 'investment recommendation' },
];

export interface ForbiddenClaimsHit {
  lineIndex: number;
  lineSnippet: string;
  matchedLabel: string;
}

// ─── normalizeFeatureSourceName ───────────────────────────────────────────

/**
 * Normalizes a feature source name to a canonical form.
 * Handles case variations and common aliases.
 */
export function normalizeFeatureSourceName(raw: string): FeatureSourceName {
  if (!raw || typeof raw !== 'string') return 'UnknownSource';
  const trimmed = raw.trim();

  // Direct match (already canonical)
  if (KNOWN_SOURCES.has(trimmed as FeatureSourceName)) return trimmed as FeatureSourceName;

  // Alias mapping — case-insensitive
  const lower = trimmed.toLowerCase();
  if (lower === 'stockquote' || lower === 'stock_quote' || lower === 'stock-quote') return 'StockQuote';
  if (lower === 'institutionalchip' || lower === 'institutional_chip' || lower === 'chip') return 'InstitutionalChip';
  if (lower === 'monthlyrevenue' || lower === 'monthly_revenue' || lower === 'revenue') return 'MonthlyRevenue';
  if (lower === 'financialreport' || lower === 'financial_report' || lower === 'eps') return 'FinancialReport';
  if (lower === 'newsevent' || lower === 'news_event' || lower === 'news') return 'NewsEvent';
  if (lower === 'technicalindicators' || lower === 'technical_indicators' || lower === 'technical') return 'TechnicalIndicators';
  if (lower === 'marketregime' || lower === 'market_regime' || lower === 'regime') return 'MarketRegime';
  if (lower === 'activescoringsnapshotbuilder' || lower === 'activescoringsnapsot') return 'ActiveScoringSnapshot';
  if (lower === 'reasonsignalfactorsnapshot' || lower === 'reason_signal_factor') return 'ReasonSignalFactorSnapshot';
  if (lower === 'bucketcontract' || lower === 'bucket_contract') return 'BucketContract';
  if (lower === 'twsetradingcalendar' || lower === 'twse_trading_calendar' || lower === 'calendar') return 'TwseTradingCalendar';

  // Unknown — return as-is
  return trimmed;
}

// ─── classifyPitRisk ──────────────────────────────────────────────────────

/**
 * Returns the known PIT risk level for a given feature source name.
 * Source must already be normalized via normalizeFeatureSourceName().
 */
export function classifyPitRisk(sourceName: FeatureSourceName): PitRiskLevel {
  switch (sourceName) {
    case 'StockQuote':
    case 'InstitutionalChip':
    case 'TechnicalIndicators':
    case 'BucketContract':
    case 'TwseTradingCalendar':
    case 'ActiveScoringSnapshot':
    case 'ReasonSignalFactorSnapshot':
      return 'LOW';

    case 'MarketRegime':
    case 'FinancialReport':
      return 'MEDIUM';

    case 'MonthlyRevenue':
    case 'NewsEvent':
      return 'HIGH';

    default:
      // Unknown source — treat as HIGH until classified
      return 'HIGH';
  }
}

// ─── validateAsOfRule ─────────────────────────────────────────────────────

/**
 * Validates that a FeatureContractEntry has an adequate asOf rule for its PIT risk level.
 *
 * HIGH risk sources must explicitly document their repair need if no releaseDate/availabilityDate
 * field exists.
 */
export function validateAsOfRule(entry: FeatureContractEntry): ContractValidationError[] {
  const errors: ContractValidationError[] = [];

  if (!entry.asOfRule || entry.asOfRule.trim().length === 0) {
    errors.push({ field: 'asOfRule', message: `asOfRule is required for source: ${entry.sourceName}` });
    return errors;
  }

  if (entry.pitRiskLevel === 'HIGH') {
    // HIGH risk sources that use time-series data must document repair need
    if (entry.sourceName === 'MonthlyRevenue') {
      if (!entry.repairNeeded) {
        errors.push({
          field: 'repairNeeded',
          message: 'MonthlyRevenue is HIGH risk (no releaseDate field). repairNeeded must be true until releaseDate is added to schema.',
        });
      }
      if (!entry.asOfRule.toLowerCase().includes('releasedate') &&
          !entry.asOfRule.toLowerCase().includes('release') &&
          !entry.asOfRule.toLowerCase().includes('no releasedate') &&
          !entry.asOfRule.toLowerCase().includes('year') &&
          !entry.asOfRule.toLowerCase().includes('month')) {
        errors.push({
          field: 'asOfRule',
          message: 'MonthlyRevenue asOfRule must document year+month composite gate or absence of releaseDate.',
        });
      }
    }

    if (entry.sourceName === 'FinancialReport') {
      if (!entry.repairNeeded && entry.dateField !== null) {
        // If it becomes active (has a dateField), it must require availabilityDate
        const hasAvailabilityMention = entry.asOfRule.toLowerCase().includes('availabilitydate') ||
          entry.asOfRule.toLowerCase().includes('availability');
        if (!hasAvailabilityMention) {
          errors.push({
            field: 'asOfRule',
            message: 'FinancialReport asOfRule must mention availabilityDate requirement when active.',
          });
        }
      }
    }
  }

  return errors;
}

// ─── validateFeatureContractEntry ─────────────────────────────────────────

/**
 * Validates a single FeatureContractEntry for structural correctness.
 */
export function validateFeatureContractEntry(entry: FeatureContractEntry): ContractValidationError[] {
  const errors: ContractValidationError[] = [];

  if (!entry.sourceName || entry.sourceName.trim().length === 0) {
    errors.push({ field: 'sourceName', message: 'sourceName is required' });
  }

  const validRiskLevels: PitRiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
  if (!validRiskLevels.includes(entry.pitRiskLevel)) {
    errors.push({ field: 'pitRiskLevel', message: `Invalid pitRiskLevel: ${entry.pitRiskLevel}. Must be LOW, MEDIUM, or HIGH.` });
  }

  // dateField must be present for time-series sources
  const staticSources: FeatureSourceName[] = ['BucketContract'];
  const isStatic = staticSources.includes(entry.sourceName as FeatureSourceName);
  if (!isStatic && entry.dateField === null) {
    // Not an error by itself but HIGH risk if no date field and used in scoring
    // Just a warning — encoded below
  }

  // Validate asOfRule
  const asOfErrors = validateAsOfRule(entry);
  errors.push(...asOfErrors);

  // repairNeeded consistency
  if (entry.repairNeeded && (!entry.repairDescription || entry.repairDescription.trim().length === 0)) {
    errors.push({
      field: 'repairDescription',
      message: `repairDescription required when repairNeeded=true for source: ${entry.sourceName}`,
    });
  }

  return errors;
}

// ─── validatePitFeatureSnapshot ───────────────────────────────────────────

/**
 * Validates an activeScoringSnapshot object for forbidden data leakage fields.
 *
 * Checks that no PIT-leaking fields (outcomePrice, returnPct, realizedReturnClass, etc.)
 * appear inside the activeScoringSnapshot. These fields belong only to the outcomeSnapshot
 * write-back — never inside the scoring snapshot itself.
 */
export function validatePitFeatureSnapshot(snapshot: Record<string, unknown>): SnapshotValidationResult {
  const errors: ContractValidationError[] = [];
  const warnings: string[] = [];

  if (!snapshot || typeof snapshot !== 'object') {
    errors.push({ field: 'snapshot', message: 'snapshot must be a non-null object' });
    return { valid: false, errors, warnings };
  }

  // Check forbidden fields at top level
  for (const forbidden of FORBIDDEN_SNAPSHOT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(snapshot, forbidden)) {
      errors.push({
        field: forbidden,
        message: `Forbidden PIT-leaking field found in activeScoringSnapshot: "${forbidden}". This field must only appear in outcomeSnapshot, never in activeScoringSnapshot.`,
      });
    }
  }

  // Check pitGateDate == asOfDate
  if (snapshot.pitGateDate !== undefined && snapshot.asOfDate !== undefined) {
    if (snapshot.pitGateDate !== snapshot.asOfDate) {
      errors.push({
        field: 'pitGateDate',
        message: `pitGateDate (${snapshot.pitGateDate}) must equal asOfDate (${snapshot.asOfDate})`,
      });
    }
  }

  // Warn on missing required fields
  const requiredFields = ['asOfDate', 'pitGateDate', 'scoringMode', 'scoringEngineSource', 'researchBucket'];
  for (const req of requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, req)) {
      warnings.push(`Missing recommended field in activeScoringSnapshot: "${req}"`);
    }
  }

  // asOfDate format check
  if (typeof snapshot.asOfDate === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.asOfDate)) {
    errors.push({ field: 'asOfDate', message: `asOfDate must be YYYY-MM-DD, got: "${snapshot.asOfDate}"` });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── buildPitFeatureContract ──────────────────────────────────────────────

/**
 * Builds a complete PitFeatureContract from discovered feature sources.
 * Does not perform any DB queries or scoring changes — purely declarative.
 */
export function buildPitFeatureContract(
  featureSourceEntries: FeatureContractEntry[],
  generatedAt: string,
): PitFeatureContract {
  const pitSafetyRequirements: PitSafetyRequirement[] = [
    {
      requirementId: 'PIT-001',
      description: 'All time-series feature sources must gate queries to date <= asOfDate. No future data may influence scoring features.',
      scope: ['StockQuote', 'InstitutionalChip', 'MonthlyRevenue', 'FinancialReport', 'NewsEvent'],
      enforcement: 'HARD',
    },
    {
      requirementId: 'PIT-002',
      description: 'pitGateDate must equal asOfDate in every activeScoringSnapshot. Divergence is a PIT violation.',
      scope: ['ActiveScoringSnapshot'],
      enforcement: 'HARD',
    },
    {
      requirementId: 'PIT-003',
      description: 'MonthlyRevenue: Uses year+month composite gate (no releaseDate). Approved as interim until releaseDate field is added to schema. Recognized HIGH risk.',
      scope: ['MonthlyRevenue'],
      enforcement: 'SOFT',
    },
    {
      requirementId: 'PIT-004',
      description: 'Forbidden snapshot fields must never appear inside activeScoringSnapshot: outcomePrice, returnPct, realizedReturnClass, futurePrice, baselineResult, outcomeClose.',
      scope: ['ActiveScoringSnapshot', 'ReasonSignalFactorSnapshot'],
      enforcement: 'HARD',
    },
    {
      requirementId: 'PIT-005',
      description: 'NewsEvent: If added to scoring, must gate by publishedAt <= asOfDate. Must NOT use ingestedAt (DB write time) as PIT gate.',
      scope: ['NewsEvent'],
      enforcement: 'SOFT',
    },
    {
      requirementId: 'PIT-006',
      description: 'FinancialReport: Not currently active. If activated, must add availabilityDate field (released 45-60 days after quarter end in Taiwan) before use.',
      scope: ['FinancialReport'],
      enforcement: 'SOFT',
    },
    {
      requirementId: 'PIT-007',
      description: 'priceSource must never be mock-deterministic in any active scoring corpus row. The priceSource=mock-deterministic flag signals that the price used is artificial and not historically real.',
      scope: ['StockQuote'],
      enforcement: 'HARD',
    },
  ];

  const snapshotCaptureRequirements: SnapshotCaptureRequirement[] = [
    { fieldName: 'asOfDate', required: true, description: 'YYYY-MM-DD date for which scoring was performed. PIT gate anchor.' },
    { fieldName: 'pitGateDate', required: true, description: 'Must equal asOfDate. Explicit PIT gate confirmation.' },
    { fieldName: 'scoringMode', required: true, description: 'Scoring engine mode (e.g., RULE_BASED_ANALYZER).' },
    { fieldName: 'scoringEngineSource', required: true, description: 'Name of scoring engine class (e.g., RuleBasedStockAnalyzer).' },
    { fieldName: 'researchBucket', required: true, description: 'Canonical bucket label (Strong/Watch/Neutral/LowPriority/InsufficientData).' },
    { fieldName: 'alphaScore', required: true, description: 'Composite score 0–100.' },
    { fieldName: 'scoreSnapshot', required: true, description: 'Breakdown scores: researchScore, technicalScore, chipScore, fundamentalScore, marketAdjustment.' },
    { fieldName: 'signalSnapshot', required: true, description: 'Array of factor names contributing to the score.' },
    { fieldName: 'factorSnapshot', required: true, description: 'Array of factor descriptions (name: value (note)).' },
    { fieldName: 'reasonSnapshot', required: true, description: 'Single reason text from scoring engine (e.g., 技術偏多). Must not contain forbidden claims.' },
    { fieldName: 'scoringCompletenessStatus', required: true, description: 'COMPLETE, PARTIAL, or EMPTY.' },
    { fieldName: 'outcomePrice', required: false, forbiddenValues: ['*'], description: 'FORBIDDEN in activeScoringSnapshot. Belongs only in outcomeSnapshot.' },
    { fieldName: 'returnPct', required: false, forbiddenValues: ['*'], description: 'FORBIDDEN in activeScoringSnapshot. Belongs only in outcomeSnapshot.' },
    { fieldName: 'realizedReturnClass', required: false, forbiddenValues: ['*'], description: 'FORBIDDEN in activeScoringSnapshot. Belongs only in outcomeSnapshot.' },
  ];

  const repairPriorities: RepairPriority[] = [
    {
      priority: 'P0',
      sourceName: 'MonthlyRevenue',
      repairAction: 'Add releaseDate (DateTime) field to MonthlyRevenue schema. Gate queries to releaseDate <= asOfDate instead of month <= asOfMonth.',
      rationale: 'Currently gated by reporting period not announcement date. Taiwan monthly revenue released on 10th of following month — gap causes PIT leakage risk.',
    },
    {
      priority: 'P1',
      sourceName: 'ReasonSignalFactorSnapshot',
      repairAction: 'P8-PREFLIGHT found 24 generic reason cases. Fix RuleBasedStockAnalyzer.buildReason() to produce richer tokens and factor explanations. Repair tracked in P8-PREFLIGHT output.',
      rationale: '24 cases classified as TEMPLATE_TOO_GENERIC or SCORING_ENGINE_UNDEROUTPUT. Root cause: buildReason() produces single tokens only.',
    },
    {
      priority: 'P2',
      sourceName: 'FinancialReport',
      repairAction: 'Add availabilityDate (DateTime) field to FinancialReport schema before activating in scoring pipeline.',
      rationale: 'Not currently used but lacks PIT gate field. If added without availabilityDate, will introduce HIGH risk leakage (quarterly reports released 45–60 days after period end).',
    },
  ];

  const nonGoals: string[] = [
    'This contract does NOT modify scoring formulas, scoring weights, or bucket thresholds.',
    'This contract does NOT modify any corpus files (simulation, p0, p1, p3).',
    'This contract does NOT add new investment claims, performance predictions, or strategy recommendations.',
    'This contract does NOT modify ManualReview modules.',
    'This contract does NOT change production database schema — schema repairs are flagged as future work (P0/P1 priority).',
    'This contract does NOT produce ROI figures, win rates, alpha calculations, profit estimates, or performance guarantees.',
  ];

  return {
    contractVersion: 'p12-pit-feature-contract-v0',
    generatedAt,
    disclaimer: 'PIT feature contract v0. No investment recommendations. No scoring changes. Observability and guardrail scaffolding only.',
    featureSourceContracts: featureSourceEntries,
    pitSafetyRequirements,
    snapshotCaptureRequirements,
    repairPriorities,
    nonGoals,
  };
}

// ─── summarizePitFeatureContract ──────────────────────────────────────────

/**
 * Generates a deterministic summary of the PIT feature contract.
 */
export function summarizePitFeatureContract(contract: PitFeatureContract): ContractSummary {
  const byRiskLevel: Record<PitRiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  const highRiskSources: FeatureSourceName[] = [];
  const repairNeededSources: FeatureSourceName[] = [];

  for (const entry of contract.featureSourceContracts) {
    byRiskLevel[entry.pitRiskLevel] = (byRiskLevel[entry.pitRiskLevel] || 0) + 1;
    if (entry.pitRiskLevel === 'HIGH') highRiskSources.push(entry.sourceName);
    if (entry.repairNeeded) repairNeededSources.push(entry.sourceName);
  }

  const repairPriorityP0 = contract.repairPriorities.filter(r => r.priority === 'P0').length;
  const repairPriorityP1 = contract.repairPriorities.filter(r => r.priority === 'P1').length;

  // Verdict logic
  let verdict: ContractSummary['verdict'];
  const hardViolations = contract.featureSourceContracts.filter(e => e.pitRiskLevel === 'HIGH' && e.repairNeeded && !e.repairDescription);
  if (hardViolations.length > 0) {
    verdict = 'CONTRACT_BLOCKED';
  } else if (repairNeededSources.length > 0) {
    verdict = 'CONTRACT_PARTIAL';
  } else {
    verdict = 'CONTRACT_COMPLETE';
  }

  return {
    totalSources: contract.featureSourceContracts.length,
    byRiskLevel,
    highRiskSources,
    repairNeededSources,
    repairPriorityP0,
    repairPriorityP1,
    requirementCount: contract.pitSafetyRequirements.length,
    snapshotCaptureRuleCount: contract.snapshotCaptureRequirements.length,
    verdict,
  };
}

// ─── scanForbiddenClaims ──────────────────────────────────────────────────

/**
 * Scans text for forbidden investment/performance claims.
 * Skips lines containing "disclaimer".
 * "alphaScore" context is excluded from the alpha check.
 */
export function scanForbiddenClaims(text: string): ForbiddenClaimsHit[] {
  const hits: ForbiddenClaimsHit[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/disclaimer/i.test(line)) continue;

    for (const fp of FORBIDDEN_CLAIM_PATTERNS) {
      if (!fp.pattern.test(line)) continue;
      // Alpha exclusion: skip if the match is "alphaScore" context
      if (fp.label === 'alpha' && /alphaScore/i.test(line) && !/\balpha\b(?!Score)/i.test(line)) continue;
      hits.push({
        lineIndex: i + 1,
        lineSnippet: line.trim().slice(0, 100),
        matchedLabel: fp.label,
      });
    }
  }

  return hits;
}
