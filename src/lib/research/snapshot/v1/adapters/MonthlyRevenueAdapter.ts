/**
 * P58 — Axis A v1 Source Adapter: MonthlyRevenueAdapter
 *
 * Implements SourceAdapterContract<MonthlyRevenueAdapterInput, MonthlyRevenueAdapterInput>.
 *
 * PIT gate:
 *   - year and month must be finite numbers (else return null)
 *   - releaseDate present and non-empty → pitGateStatus = PIT_SAFE
 *   - releaseDate null / empty         → pitGateStatus = LOW_CONFIDENCE_PIT_INFERRED
 *                                        auditFlags includes LOW_CONFIDENCE_PIT_INFERRED
 *                                        and RELEASE_DATE_NULL_FALLBACK_USED
 *   - MonthlyRevenueAdapter never returns null when year+month are valid
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
  type MonthlyRevenueAdapterInput,
  type PitGateStatus,
  type SourceAdapterContract,
  type SourceInputFact,
  type SourceInputFactAuditFlag,
} from "@/lib/research/snapshot/v1/RealDataSnapshotInputContract";

// ─── Governance assertion (compile-time) ─────────────────────────────────────

const _governanceCheck: typeof REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.entersAlphaScore =
  false satisfies false;
void _governanceCheck;

// ─── MonthlyRevenueAdapter implementation ────────────────────────────────────

export const MonthlyRevenueAdapter: SourceAdapterContract<
  MonthlyRevenueAdapterInput,
  MonthlyRevenueAdapterInput
> = {
  sourceName: "MonthlyRevenue",
  version: REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION,

  adapt(
    input: MonthlyRevenueAdapterInput,
    asOfDate: string,
  ): SourceInputFact<MonthlyRevenueAdapterInput> | null {
    // PIT gate 0: year and month must be finite numbers
    if (
      !Number.isFinite(input.year) ||
      !Number.isFinite(input.month)
    ) {
      return null;
    }

    // Determine PIT gate status from releaseDate
    const releaseDatePresent =
      input.releaseDate !== null &&
      input.releaseDate !== undefined &&
      input.releaseDate.trim() !== "";

    let pitGateStatus: PitGateStatus;
    let pitGateValue: string | null;
    let observedAt: string | null;
    let auditFlags: ReadonlyArray<SourceInputFactAuditFlag>;

    if (releaseDatePresent) {
      pitGateStatus = "PIT_SAFE";
      pitGateValue = input.releaseDate as string;
      observedAt = input.releaseDate as string;
      auditFlags = [];
    } else {
      pitGateStatus = "LOW_CONFIDENCE_PIT_INFERRED";
      pitGateValue = null;
      observedAt = null;
      auditFlags = [
        "LOW_CONFIDENCE_PIT_INFERRED",
        "RELEASE_DATE_NULL_FALLBACK_USED",
      ] as const;
    }

    return {
      sourceName: "MonthlyRevenue",
      sourceTrace: "MonthlyRevenue.releaseDate",
      pitGateField: "releaseDate",
      pitGateValue,
      pitGateStatus,
      auditFlags,
      observedAt,
      asOfDate,
      data: input,
    };
  },
} as const;
