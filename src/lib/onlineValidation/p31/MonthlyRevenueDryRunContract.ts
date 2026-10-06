/**
 * P31 — MonthlyRevenue Source-present Dry-run Contract
 *
 * Defines the invariants that must hold for MonthlyRevenue to participate
 * in source-present dry-run mode. Pure contract object — no side effects.
 *
 * DISCLAIMER: Structural audit contract only. Does not constitute investment advice.
 * No profit, return, or investment performance claims.
 * MonthlyRevenue entersAlphaScore = false. ALWAYS.
 * Results must not be used as buy/sell/hold signals.
 */

// ─── Version & Disclaimer ─────────────────────────────────────────────────────

export const MONTHLY_REVENUE_DRY_RUN_CONTRACT_VERSION =
  "p31-monthly-revenue-dry-run-contract-v1";

export const MONTHLY_REVENUE_DRY_RUN_CONTRACT_DISCLAIMER =
  "Structural audit contract only. Does not constitute investment advice. " +
  "No profit, return, or investment performance claims are made. " +
  "MonthlyRevenue entersAlphaScore = false. ALWAYS. " +
  "Results must not be used as buy/sell/hold signals or investment recommendations. " +
  "This contract prohibits the use of buy, sell, hold, ROI, win-rate, edge, profit, " +
  "outperform, guaranteed-return, expected-return, or investment-recommendation claims.";

// ─── Contract Interface ───────────────────────────────────────────────────────

export interface MonthlyRevenueDryRunContract {
  sourceName: "MonthlyRevenue";
  mode: "source-present-dry-run";
  paperOnly: true;
  dryRun: true;
  entersAlphaScore: false;
  notInvestmentRecommendation: true;
  requiresReleaseDate: true;
  requiresReleaseDateSource: true;
  requiresReleaseDateConfidence: true;
  requiresAsOfDateBeforeDecisionDate: true;
  rejectsRevenueMonthAsAvailabilityDate: true;
  rejectsTargetLeakageFields: true;
  rejectsFutureLookingFields: true;
  forbiddenOutputFields: string[];
  forbiddenClaims: string[];
}

// ─── Contract Instance ────────────────────────────────────────────────────────

export const MONTHLY_REVENUE_DRY_RUN_CONTRACT: MonthlyRevenueDryRunContract = {
  sourceName: "MonthlyRevenue",
  mode: "source-present-dry-run",
  paperOnly: true,
  dryRun: true,
  entersAlphaScore: false,
  notInvestmentRecommendation: true,
  requiresReleaseDate: true,
  requiresReleaseDateSource: true,
  requiresReleaseDateConfidence: true,
  requiresAsOfDateBeforeDecisionDate: true,
  rejectsRevenueMonthAsAvailabilityDate: true,
  rejectsTargetLeakageFields: true,
  rejectsFutureLookingFields: true,
  forbiddenOutputFields: [
    'prediction',
    'recommendation',
    'signal',
    'alpha',
    'score',
    'returnPct',
    'outcomePrice',
    'realizedReturn',
    'forwardReturn',
    'predictedPrice',
    'futurePrice',
    'expectedReturn',
    'profitLoss',
    'winRate',
    'edgeScore',
    'alphaScore',
  ],
  forbiddenClaims: [
    'buy',
    'sell',
    'hold',
    'ROI',
    'win-rate',
    'edge',
    'profit',
    'outperform',
    'investment-recommendation',
    'guaranteed-return',
    'expected-return',
  ],
};

// ─── Contract Validation ──────────────────────────────────────────────────────

/**
 * Validate that a contract object satisfies all required invariants.
 * Returns { valid: true, violations: [] } if all invariants hold.
 */
export function validateContract(
  c: MonthlyRevenueDryRunContract
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (c.sourceName !== "MonthlyRevenue") {
    violations.push(`sourceName must be "MonthlyRevenue", got: ${c.sourceName}`);
  }
  if (c.mode !== "source-present-dry-run") {
    violations.push(`mode must be "source-present-dry-run", got: ${c.mode}`);
  }
  if (c.paperOnly !== true) {
    violations.push(`paperOnly must be true`);
  }
  if (c.dryRun !== true) {
    violations.push(`dryRun must be true`);
  }
  if (c.entersAlphaScore !== false) {
    violations.push(`entersAlphaScore must be false — invariant violation`);
  }
  if (c.notInvestmentRecommendation !== true) {
    violations.push(`notInvestmentRecommendation must be true`);
  }
  if (c.requiresReleaseDate !== true) {
    violations.push(`requiresReleaseDate must be true`);
  }
  if (c.requiresReleaseDateSource !== true) {
    violations.push(`requiresReleaseDateSource must be true`);
  }
  if (c.requiresReleaseDateConfidence !== true) {
    violations.push(`requiresReleaseDateConfidence must be true`);
  }
  if (c.requiresAsOfDateBeforeDecisionDate !== true) {
    violations.push(`requiresAsOfDateBeforeDecisionDate must be true`);
  }
  if (c.rejectsRevenueMonthAsAvailabilityDate !== true) {
    violations.push(`rejectsRevenueMonthAsAvailabilityDate must be true`);
  }
  if (c.rejectsTargetLeakageFields !== true) {
    violations.push(`rejectsTargetLeakageFields must be true`);
  }
  if (c.rejectsFutureLookingFields !== true) {
    violations.push(`rejectsFutureLookingFields must be true`);
  }
  if (!Array.isArray(c.forbiddenOutputFields) || c.forbiddenOutputFields.length === 0) {
    violations.push(`forbiddenOutputFields must be a non-empty array`);
  }
  if (!Array.isArray(c.forbiddenClaims) || c.forbiddenClaims.length === 0) {
    violations.push(`forbiddenClaims must be a non-empty array`);
  }

  const requiredForbiddenFields = ['alphaScore', 'prediction', 'recommendation', 'signal'];
  for (const field of requiredForbiddenFields) {
    if (!c.forbiddenOutputFields.includes(field)) {
      violations.push(`forbiddenOutputFields must include "${field}"`);
    }
  }

  const requiredForbiddenClaims = ['buy', 'sell', 'hold', 'ROI', 'profit'];
  for (const claim of requiredForbiddenClaims) {
    if (!c.forbiddenClaims.includes(claim)) {
      violations.push(`forbiddenClaims must include "${claim}"`);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

// ─── Row Contract Check ───────────────────────────────────────────────────────

export interface ContractRowCheckResult {
  passes: boolean;
  violations: string[];
  entersAlphaScore: false;
}

/**
 * Check if a row satisfies the dry-run contract.
 * Checks:
 * - row has no forbiddenOutputFields
 * - entersAlphaScore is false or absent
 */
export function checkRowAgainstContract(
  row: Record<string, unknown>
): ContractRowCheckResult {
  const violations: string[] = [];

  for (const field of MONTHLY_REVENUE_DRY_RUN_CONTRACT.forbiddenOutputFields) {
    if (field in row) {
      violations.push(`Row contains forbidden output field: "${field}"`);
    }
  }

  if ('entersAlphaScore' in row && row['entersAlphaScore'] !== false) {
    violations.push(
      `Row entersAlphaScore must be false or absent, got: ${JSON.stringify(row['entersAlphaScore'])}`
    );
  }

  return {
    passes: violations.length === 0,
    violations,
    entersAlphaScore: false,
  };
}
