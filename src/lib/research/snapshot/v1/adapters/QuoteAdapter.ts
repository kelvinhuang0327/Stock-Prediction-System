/**
 * P58 — Axis A v1 Source Adapter: QuoteAdapter
 *
 * Implements SourceAdapterContract<QuoteAdapterInput, QuoteAdapterInput>.
 *
 * PIT gate:
 *   - date must be a non-null, non-empty, non-whitespace string
 *   - if gate fails → return null (PIT_BLOCKED)
 *   - if gate passes → pitGateStatus = PIT_SAFE
 *
 * Governance:
 *   paperOnly = true | dryRunOnly = true | entersAlphaScore = false
 *   notInvestmentAdvice = true
 *
 * No DB | No Prisma | No filesystem | No network | No scoring | No recommendation
 *
 * Classification: P58_AXIS_A_V1_SOURCE_ADAPTER_IMPLEMENTATIONS
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 */

import {
  REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION,
  REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE,
  type QuoteAdapterInput,
  type SourceAdapterContract,
  type SourceInputFact,
} from "@/lib/research/snapshot/v1/RealDataSnapshotInputContract";

// ─── Governance assertion (compile-time) ─────────────────────────────────────

const _governanceCheck: typeof REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.entersAlphaScore =
  false satisfies false;
void _governanceCheck;

// ─── QuoteAdapter implementation ─────────────────────────────────────────────

export const QuoteAdapter: SourceAdapterContract<
  QuoteAdapterInput,
  QuoteAdapterInput
> = {
  sourceName: "Quote",
  version: REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION,

  adapt(
    input: QuoteAdapterInput,
    asOfDate: string,
  ): SourceInputFact<QuoteAdapterInput> | null {
    // PIT gate: date must be a non-empty, non-whitespace string
    if (
      input.date === null ||
      input.date === undefined ||
      input.date.trim() === ""
    ) {
      return null;
    }

    return {
      sourceName: "Quote",
      sourceTrace: "Quote.date",
      pitGateField: "date",
      pitGateValue: input.date,
      pitGateStatus: "PIT_SAFE",
      auditFlags: [],
      observedAt: input.date,
      asOfDate,
      data: input,
    };
  },
} as const;
