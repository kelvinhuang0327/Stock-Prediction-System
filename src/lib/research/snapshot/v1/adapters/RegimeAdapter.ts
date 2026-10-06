/**
 * P58 — Axis A v1 Source Adapter: RegimeAdapter
 *
 * Implements SourceAdapterContract<RegimeAdapterInput, RegimeAdapterInput>.
 *
 * PIT gate (dual condition):
 *   - date must be a non-null, non-empty, non-whitespace string
 *   - pitSafetyJson must be non-null / non-undefined
 *   - if either gate fails → return null
 *   - if both pass → pitGateStatus = PIT_SAFE
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
  type RegimeAdapterInput,
  type SourceAdapterContract,
  type SourceInputFact,
} from "@/lib/research/snapshot/v1/RealDataSnapshotInputContract";

// ─── Governance assertion (compile-time) ─────────────────────────────────────

const _governanceCheck: typeof REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.entersAlphaScore =
  false satisfies false;
void _governanceCheck;

// ─── RegimeAdapter implementation ────────────────────────────────────────────

export const RegimeAdapter: SourceAdapterContract<
  RegimeAdapterInput,
  RegimeAdapterInput
> = {
  sourceName: "Regime",
  version: REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION,

  adapt(
    input: RegimeAdapterInput,
    asOfDate: string,
  ): SourceInputFact<RegimeAdapterInput> | null {
    // PIT gate 1: date must be a non-empty, non-whitespace string
    if (
      input.date === null ||
      input.date === undefined ||
      input.date.trim() === ""
    ) {
      return null;
    }

    // PIT gate 2: pitSafetyJson must be non-null/undefined
    if (input.pitSafetyJson === null || input.pitSafetyJson === undefined) {
      return null;
    }

    return {
      sourceName: "Regime",
      sourceTrace: "Regime.date+pitSafetyJson",
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
