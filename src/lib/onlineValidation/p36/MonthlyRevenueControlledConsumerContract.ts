/**
 * P36 — MonthlyRevenue Controlled Feature Consumer Contract
 *
 * Defines the invariants for a "controlled feature consumer" that is permitted
 * to read MonthlyRevenue dry-run-ready data in a paper-only, non-scoring context.
 *
 * This contract is layered ON TOP of the P31 source-present dry-run contract.
 * It defines what a downstream consumer may read (inputs) and what it must NEVER
 * produce (outputs). It enforces the boundary between dry-run readiness and any
 * scoring, recommendation, or investment-decision system.
 *
 * DISCLAIMER: Structural audit contract only. Does not constitute investment advice.
 * No profit, return, win-rate, or investment performance claims are made.
 * MonthlyRevenue entersAlphaScore = false. ALWAYS.
 * Results must not be used as buy/sell/hold signals or investment recommendations.
 */

// ─── Version & Disclaimer ────────────────────────────────────────────────────

export const CONTROLLED_CONSUMER_CONTRACT_VERSION =
  "p36-monthly-revenue-controlled-consumer-contract-v1";

export const CONTROLLED_CONSUMER_CONTRACT_DISCLAIMER =
  "Controlled feature consumer contract only. Does not constitute investment advice. " +
  "No profit, return, win-rate, edge, or investment performance claims are made. " +
  "MonthlyRevenue entersAlphaScore = false. ALWAYS. " +
  "Results must not be used as buy/sell/hold signals or investment recommendations. " +
  "This contract prohibits: buy, sell, hold, ROI, win-rate, edge, profit, outperform, " +
  "guaranteed-return, expected-return, investment-recommendation, targetPrice, outcomePrice.";

// ─── Confidence Tier Behavior ────────────────────────────────────────────────

export type ConfidenceTier = "HIGH" | "MEDIUM" | "LOW";

export interface ConfidenceTierBehavior {
  tier: ConfidenceTier;
  consumerAccessMode: "consumer-readable" | "consumer-readable-with-warning" | "audit-only";
  description: string;
}

export const CONFIDENCE_TIER_BEHAVIORS: Record<ConfidenceTier, ConfidenceTierBehavior> = {
  HIGH: {
    tier: "HIGH",
    consumerAccessMode: "consumer-readable",
    description: "RECORDED_FROM_SOURCE: consumer can read without warning",
  },
  MEDIUM: {
    tier: "MEDIUM",
    consumerAccessMode: "consumer-readable-with-warning",
    description: "INFERRED_FROM_POLICY: consumer-readable with confidence warning attached",
  },
  LOW: {
    tier: "LOW",
    consumerAccessMode: "audit-only",
    description:
      "INFERRED_NEXT_MONTH_10TH: audit-only by default; consumer-readable only if config " +
      "explicitly sets allowLowConfidenceConsumerAccess=true",
  },
};

// ─── Allowed Input Fields ────────────────────────────────────────────────────

export const ALLOWED_CONSUMER_INPUT_FIELDS: readonly string[] = [
  "symbol",
  "revenueMonth",
  "revenue",
  "releaseDate",
  "releaseDateSource",
  "releaseDateConfidence",
  "asOfDate",
  "sourceTrace",
] as const;

// ─── Forbidden Output Fields ─────────────────────────────────────────────────

export const FORBIDDEN_CONSUMER_OUTPUT_FIELDS: readonly string[] = [
  "alphaScore",
  "prediction",
  "recommendation",
  "signal",
  "buy",
  "sell",
  "hold",
  "targetPrice",
  "outcomePrice",
  "returnPct",
  "winRate",
  "profit",
  "profitLoss",
  "edgeScore",
  "realizedReturn",
  "forwardReturn",
  "predictedPrice",
  "futurePrice",
  "expectedReturn",
  "alpha",
  "score",
] as const;

// ─── Contract Interface ──────────────────────────────────────────────────────

export interface MonthlyRevenueControlledConsumerContract {
  sourceName: "MonthlyRevenue";
  consumerMode: "controlled-feature-consumer-readiness";
  dryRunOnly: true;
  paperOnly: true;
  entersAlphaScore: false;
  notInvestmentRecommendation: true;
  noBuySellActionSemantics: true;
  allowedInputFields: readonly string[];
  forbiddenOutputFields: readonly string[];
  confidenceTierBehaviors: Record<ConfidenceTier, ConfidenceTierBehavior>;
  allowLowConfidenceConsumerAccess: boolean;
  version: string;
  disclaimer: string;
}

// ─── Contract Instance ───────────────────────────────────────────────────────

export const MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT: MonthlyRevenueControlledConsumerContract =
  {
    sourceName: "MonthlyRevenue",
    consumerMode: "controlled-feature-consumer-readiness",
    dryRunOnly: true,
    paperOnly: true,
    entersAlphaScore: false,
    notInvestmentRecommendation: true,
    noBuySellActionSemantics: true,
    allowedInputFields: ALLOWED_CONSUMER_INPUT_FIELDS,
    forbiddenOutputFields: FORBIDDEN_CONSUMER_OUTPUT_FIELDS,
    confidenceTierBehaviors: CONFIDENCE_TIER_BEHAVIORS,
    allowLowConfidenceConsumerAccess: false,
    version: CONTROLLED_CONSUMER_CONTRACT_VERSION,
    disclaimer: CONTROLLED_CONSUMER_CONTRACT_DISCLAIMER,
  };

// ─── Contract Validation ─────────────────────────────────────────────────────

/**
 * Validate that a contract object satisfies all required invariants.
 */
export function validateControlledConsumerContract(
  c: MonthlyRevenueControlledConsumerContract
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (c.sourceName !== "MonthlyRevenue") {
    violations.push(`sourceName must be "MonthlyRevenue", got: ${c.sourceName}`);
  }
  if (c.consumerMode !== "controlled-feature-consumer-readiness") {
    violations.push(
      `consumerMode must be "controlled-feature-consumer-readiness", got: ${c.consumerMode}`
    );
  }
  if (c.dryRunOnly !== true) {
    violations.push(`dryRunOnly must be true`);
  }
  if (c.paperOnly !== true) {
    violations.push(`paperOnly must be true`);
  }
  if (c.entersAlphaScore !== false) {
    violations.push(`entersAlphaScore must be false — invariant violation`);
  }
  if (c.notInvestmentRecommendation !== true) {
    violations.push(`notInvestmentRecommendation must be true`);
  }
  if (c.noBuySellActionSemantics !== true) {
    violations.push(`noBuySellActionSemantics must be true`);
  }
  if (!Array.isArray(c.allowedInputFields) || c.allowedInputFields.length === 0) {
    violations.push(`allowedInputFields must be a non-empty array`);
  }
  if (!Array.isArray(c.forbiddenOutputFields) || c.forbiddenOutputFields.length === 0) {
    violations.push(`forbiddenOutputFields must be a non-empty array`);
  }

  // Required allowed fields
  const requiredInputFields = ["symbol", "revenueMonth", "revenue", "releaseDate", "asOfDate"];
  for (const field of requiredInputFields) {
    if (!c.allowedInputFields.includes(field)) {
      violations.push(`allowedInputFields must include "${field}"`);
    }
  }

  // Required forbidden output fields
  const requiredForbiddenFields = [
    "alphaScore",
    "prediction",
    "recommendation",
    "signal",
    "buy",
    "sell",
    "hold",
    "targetPrice",
    "outcomePrice",
    "returnPct",
    "winRate",
    "profit",
  ];
  for (const field of requiredForbiddenFields) {
    if (!c.forbiddenOutputFields.includes(field)) {
      violations.push(`forbiddenOutputFields must include "${field}"`);
    }
  }

  // Required confidence tiers
  for (const tier of ["HIGH", "MEDIUM", "LOW"] as ConfidenceTier[]) {
    if (!c.confidenceTierBehaviors[tier]) {
      violations.push(`confidenceTierBehaviors must include tier "${tier}"`);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

// ─── Row Field Check ─────────────────────────────────────────────────────────

export interface ConsumerFieldCheckResult {
  passes: boolean;
  violations: string[];
  entersAlphaScore: false;
}

/**
 * Check that a consumer output row does not contain any forbidden fields.
 */
export function checkConsumerOutputRow(
  row: Record<string, unknown>
): ConsumerFieldCheckResult {
  const violations: string[] = [];

  for (const field of MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT.forbiddenOutputFields) {
    if (field in row) {
      violations.push(`Consumer output contains forbidden field: "${field}"`);
    }
  }

  if ("entersAlphaScore" in row && row["entersAlphaScore"] !== false) {
    violations.push(
      `entersAlphaScore must be false or absent, got: ${JSON.stringify(row["entersAlphaScore"])}`
    );
  }

  return {
    passes: violations.length === 0,
    violations,
    entersAlphaScore: false,
  };
}

/**
 * Map a releaseDateConfidence string to the confidence tier enum.
 */
export function mapConfidenceTier(releaseDateConfidence: string | null): ConfidenceTier {
  if (!releaseDateConfidence) return "LOW";
  const upper = releaseDateConfidence.toUpperCase();
  if (upper === "HIGH" || upper === "RECORDED" || upper === "RECORDED_FROM_SOURCE") return "HIGH";
  if (upper === "MEDIUM" || upper === "INFERRED_FROM_POLICY") return "MEDIUM";
  return "LOW";
}
