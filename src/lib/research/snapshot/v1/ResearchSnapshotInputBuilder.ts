/**
 * P59 — Axis A v1 Research Snapshot Input Builder
 *
 * Assembles a typed ResearchSnapshotInput from pre-fetched adapter inputs.
 * Calls the P58 adapters (Quote, Regime, MonthlyRevenue) and collects their
 * PIT-validated SourceInputFact outputs into a single immutable snapshot bundle.
 *
 * Null-handling:
 *   - null param    → field is null (adapter is not called)
 *   - adapter null  → field is null (PIT gate failed inside adapter)
 *
 * Governance:
 *   paperOnly = true | dryRunOnly = true | entersAlphaScore = false
 *   notInvestmentAdvice = true
 *
 * No DB | No Prisma | No filesystem | No network | No child_process
 * No scoring | No optimizer | No backtest | No recommendation
 * No FinancialReport | No InstitutionalChip | No NewsEvent adapter
 *
 * This is the final Axis A step in the P56→P57→P58→P59 atomic unit.
 * P60-GATE is mandatory before any further Axis A implementation.
 *
 * Classification: P59_AXIS_A_V1_RESEARCH_SNAPSHOT_INPUT_BUILDER
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRunOnly = true.
 */

import {
  REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION,
  REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE,
  type MonthlyRevenueAdapterInput,
  type QuoteAdapterInput,
  type RegimeAdapterInput,
  type SourceInputFact,
} from "@/lib/research/snapshot/v1/RealDataSnapshotInputContract";

import { MonthlyRevenueAdapter } from "@/lib/research/snapshot/v1/adapters/MonthlyRevenueAdapter";
import { QuoteAdapter } from "@/lib/research/snapshot/v1/adapters/QuoteAdapter";
import { RegimeAdapter } from "@/lib/research/snapshot/v1/adapters/RegimeAdapter";

// ─── Governance assertion (compile-time) ─────────────────────────────────────

const _governanceCheck: typeof REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.entersAlphaScore =
  false satisfies false;
void _governanceCheck;

// ─── Builder version ─────────────────────────────────────────────────────────

export const RESEARCH_SNAPSHOT_INPUT_BUILDER_VERSION =
  "p59-axis-a-v1-research-snapshot-input-builder-v0" as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResearchSnapshotInputBuilderParams = {
  readonly quoteInput: QuoteAdapterInput | null;
  readonly regimeInput: RegimeAdapterInput | null;
  readonly monthlyRevenueInput: MonthlyRevenueAdapterInput | null;
  readonly asOfDate: string;
};

export type ResearchSnapshotInput = {
  readonly version: typeof REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION;
  readonly builderVersion: typeof RESEARCH_SNAPSHOT_INPUT_BUILDER_VERSION;
  readonly asOfDate: string;
  readonly governance: typeof REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE;
  readonly quote: SourceInputFact<QuoteAdapterInput> | null;
  readonly regime: SourceInputFact<RegimeAdapterInput> | null;
  readonly monthlyRevenue: SourceInputFact<MonthlyRevenueAdapterInput> | null;
};

// ─── Builder function ─────────────────────────────────────────────────────────

/**
 * Build a ResearchSnapshotInput from pre-fetched source adapter inputs.
 *
 * Does not query DB, read files, call network, or execute any side-effectful
 * operation. Calls P58 adapters synchronously on the provided inputs.
 *
 * @param params - pre-fetched inputs for each source (null if source unavailable)
 * @returns a fully typed, JSON-safe ResearchSnapshotInput
 */
export function buildResearchSnapshotInput(
  params: ResearchSnapshotInputBuilderParams,
): ResearchSnapshotInput {
  const { quoteInput, regimeInput, monthlyRevenueInput, asOfDate } = params;

  const quote: SourceInputFact<QuoteAdapterInput> | null =
    quoteInput !== null && quoteInput !== undefined
      ? QuoteAdapter.adapt(quoteInput, asOfDate)
      : null;

  const regime: SourceInputFact<RegimeAdapterInput> | null =
    regimeInput !== null && regimeInput !== undefined
      ? RegimeAdapter.adapt(regimeInput, asOfDate)
      : null;

  const monthlyRevenue: SourceInputFact<MonthlyRevenueAdapterInput> | null =
    monthlyRevenueInput !== null && monthlyRevenueInput !== undefined
      ? MonthlyRevenueAdapter.adapt(monthlyRevenueInput, asOfDate)
      : null;

  return {
    version: REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION,
    builderVersion: RESEARCH_SNAPSHOT_INPUT_BUILDER_VERSION,
    asOfDate,
    governance: REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE,
    quote,
    regime,
    monthlyRevenue,
  };
}
