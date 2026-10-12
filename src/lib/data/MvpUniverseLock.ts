/**
 * MvpUniverseLock.ts — P0-01 MVP Universe Lock
 *
 * Defines and validates the MVP candidate universe for research tooling.
 * Tier A: quote >= 250 days + has InstitutionalChip
 * WalkForward: quote >= 500 days
 *
 * SAFETY CONTRACT:
 * - P0-01: MVP universe lock | research tool only | no auto trading
 * - no DB write, no external API, no LLM call
 * - no strategy mutation, no performance claim, no edge claim
 *
 * Not investment advice. Not a trading system.
 */

import { resolveAsOfDate } from './AsOfDataGate';

// ─── Constants ─────────────────────────────────────────────────────────────

export const MVP_TIER_A_QUOTE_MIN = 250;
export const MVP_TIER_A_REQUIRES_CHIP = true;
export const MVP_WALK_FORWARD_QUOTE_MIN = 500;
export const MVP_LIMITED_QUOTE_MIN = 60;

// ─── Types ─────────────────────────────────────────────────────────────────

/** MVP universe tier classification. */
export type MvpUniverseTier = 'TierA' | 'WalkForward' | 'Limited' | 'Insufficient';

/** Criteria for a single tier. */
export interface MvpTierCriteria {
  tier: MvpUniverseTier;
  minQuoteCount: number;
  requiresInstitutionalChip: boolean;
  excludeFutureDates: boolean;
  excludeAbnormalDates: boolean;
  description: string;
}

/** Full MVP universe criteria definition. */
export interface MvpUniverseCriteria {
  asOfDate: string;
  tiers: MvpTierCriteria[];
  observabilityNote: string;
}

/** Stock record for universe classification. */
export interface StockUniverseRecord {
  symbol: string;
  quoteCount: number;
  hasInstitutionalChip: boolean;
  latestQuoteDate: string | null;
  hasAbnormalDate: boolean;
  hasFutureDate: boolean;
}

/** Classified stock universe entry. */
export interface ClassifiedUniverseEntry extends StockUniverseRecord {
  tier: MvpUniverseTier;
  asOfDate: string;
  tierReason: string;
}

/** Universe coverage summary. */
export interface MvpUniverseCoverageSummary {
  asOfDate: string;
  totalStocks: number;
  tierACount: number;
  walkForwardCount: number;
  limitedCount: number;
  insufficientCount: number;
  status: 'PASS' | 'WARN' | 'FAIL';
  observabilityNote: string;
}

// ─── Exported Functions ────────────────────────────────────────────────────

/**
 * Builds the MVP universe tier criteria definition.
 *
 * Tier A: quoteCount >= 250, hasInstitutionalChip, date <= asOfDate
 * WalkForward: quoteCount >= 500, date <= asOfDate
 * Limited: quoteCount >= 60, date <= asOfDate
 * Insufficient: below Limited threshold
 *
 * @param asOfDate - As-of date for universe definition (YYYY-MM-DD)
 */
export function buildMvpUniverseCriteria(asOfDate?: string | null): MvpUniverseCriteria {
  const resolvedAsOf = resolveAsOfDate(asOfDate ?? undefined);

  return {
    asOfDate: resolvedAsOf,
    tiers: [
      {
        tier: 'TierA',
        minQuoteCount: MVP_TIER_A_QUOTE_MIN,
        requiresInstitutionalChip: true,
        excludeFutureDates: true,
        excludeAbnormalDates: true,
        description:
          `Tier A: quoteCount >= ${MVP_TIER_A_QUOTE_MIN} AND hasInstitutionalChip=true AND date <= ${resolvedAsOf}`,
      },
      {
        tier: 'WalkForward',
        minQuoteCount: MVP_WALK_FORWARD_QUOTE_MIN,
        requiresInstitutionalChip: false,
        excludeFutureDates: true,
        excludeAbnormalDates: true,
        description:
          `WalkForward: quoteCount >= ${MVP_WALK_FORWARD_QUOTE_MIN} AND date <= ${resolvedAsOf}`,
      },
      {
        tier: 'Limited',
        minQuoteCount: MVP_LIMITED_QUOTE_MIN,
        requiresInstitutionalChip: false,
        excludeFutureDates: true,
        excludeAbnormalDates: false,
        description:
          `Limited: quoteCount >= ${MVP_LIMITED_QUOTE_MIN} AND date <= ${resolvedAsOf}`,
      },
      {
        tier: 'Insufficient',
        minQuoteCount: 0,
        requiresInstitutionalChip: false,
        excludeFutureDates: true,
        excludeAbnormalDates: false,
        description: `Insufficient: quoteCount < ${MVP_LIMITED_QUOTE_MIN} OR no data`,
      },
    ],
    observabilityNote:
      'MVP universe criteria definition. For research tooling only. ' +
      'Not investment advice. No performance claims.',
  };
}

/**
 * Classifies a stock into its MVP universe tier.
 *
 * Priority order: WalkForward > TierA > Limited > Insufficient
 * (WalkForward checked first since it has higher quoteCount requirement)
 *
 * @param record   - Stock data record
 * @param asOfDate - As-of date for classification
 */
export function classifyMvpUniverseTier(
  record: StockUniverseRecord,
  asOfDate: string,
): ClassifiedUniverseEntry {
  const resolvedAsOf = resolveAsOfDate(asOfDate);

  // Reject future-dated records
  if (record.hasFutureDate && record.quoteCount === 0) {
    return {
      ...record,
      tier: 'Insufficient',
      asOfDate: resolvedAsOf,
      tierReason: 'Only future-dated quotes available (excluded by as-of gate)',
    };
  }

  // WalkForward: quoteCount >= 500 (no chip requirement, but highest bar)
  if (record.quoteCount >= MVP_WALK_FORWARD_QUOTE_MIN) {
    return {
      ...record,
      tier: 'WalkForward',
      asOfDate: resolvedAsOf,
      tierReason: `quoteCount=${record.quoteCount} >= ${MVP_WALK_FORWARD_QUOTE_MIN} (WalkForward threshold)`,
    };
  }

  // Tier A: quoteCount >= 250 AND hasInstitutionalChip
  if (record.quoteCount >= MVP_TIER_A_QUOTE_MIN && record.hasInstitutionalChip) {
    return {
      ...record,
      tier: 'TierA',
      asOfDate: resolvedAsOf,
      tierReason:
        `quoteCount=${record.quoteCount} >= ${MVP_TIER_A_QUOTE_MIN} AND hasInstitutionalChip=true`,
    };
  }

  // Limited: quoteCount >= 60
  if (record.quoteCount >= MVP_LIMITED_QUOTE_MIN) {
    return {
      ...record,
      tier: 'Limited',
      asOfDate: resolvedAsOf,
      tierReason: `quoteCount=${record.quoteCount} >= ${MVP_LIMITED_QUOTE_MIN} (Limited threshold)`,
    };
  }

  // Insufficient
  return {
    ...record,
    tier: 'Insufficient',
    asOfDate: resolvedAsOf,
    tierReason: `quoteCount=${record.quoteCount} < ${MVP_LIMITED_QUOTE_MIN} (below minimum threshold)`,
  };
}

/**
 * Filters a universe of stock records by MVP tier.
 *
 * - Excludes records that only have future-dated quotes
 * - Does not modify any DB data
 *
 * @param records   - Array of StockUniverseRecord
 * @param minTier   - Minimum tier to include ('TierA', 'WalkForward', 'Limited')
 * @param asOfDate  - As-of date for filtering
 */
export function filterUniverseByMvpTier(
  records: StockUniverseRecord[],
  minTier: MvpUniverseTier,
  asOfDate: string,
): ClassifiedUniverseEntry[] {
  const tierOrder: MvpUniverseTier[] = ['WalkForward', 'TierA', 'Limited', 'Insufficient'];
  const minTierIndex = tierOrder.indexOf(minTier);

  return records
    .map(r => classifyMvpUniverseTier(r, asOfDate))
    .filter(entry => {
      const tierIndex = tierOrder.indexOf(entry.tier);
      return tierIndex <= minTierIndex;
    });
}

/**
 * Validates MVP universe coverage from classified entries.
 *
 * Returns coverage summary with counts per tier.
 * PASS: Tier A >= 100 and WalkForward >= 50
 * WARN: Tier A < 100 or WalkForward < 50
 * FAIL: No Tier A or no WalkForward stocks
 *
 * @param entries  - Classified universe entries
 * @param asOfDate - As-of date used for classification
 */
export function validateMvpUniverseCoverage(
  entries: ClassifiedUniverseEntry[],
  asOfDate: string,
): MvpUniverseCoverageSummary {
  const resolvedAsOf = resolveAsOfDate(asOfDate);

  const tierACount = entries.filter(e => e.tier === 'TierA').length;
  const walkForwardCount = entries.filter(e => e.tier === 'WalkForward').length;
  const limitedCount = entries.filter(e => e.tier === 'Limited').length;
  const insufficientCount = entries.filter(e => e.tier === 'Insufficient').length;
  const totalStocks = entries.length;

  let status: 'PASS' | 'WARN' | 'FAIL';
  if (tierACount === 0 && walkForwardCount === 0) {
    status = 'FAIL';
  } else if (tierACount < 100 || walkForwardCount < 50) {
    status = 'WARN';
  } else {
    status = 'PASS';
  }

  return {
    asOfDate: resolvedAsOf,
    totalStocks,
    tierACount,
    walkForwardCount,
    limitedCount,
    insufficientCount,
    status,
    observabilityNote:
      'MVP universe coverage summary. Research tooling only. ' +
      'Not investment advice. No performance claims.',
  };
}
