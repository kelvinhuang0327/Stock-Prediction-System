/**
 * P57 — Axis A v1 Source Adapter Contract Stub
 *
 * Pure TypeScript type definitions for the Axis A v1 real-data source adapter layer.
 * This file contains NO implementation logic, NO DB access, NO Prisma imports,
 * NO adapter implementations, NO ResearchSnapshotInputBuilder.
 *
 * Governance:
 *   paperOnly = true
 *   dryRunOnly = true
 *   entersAlphaScore = false
 *   notInvestmentAdvice = true
 *
 * Sources eligible for v1 adapters:
 *   Quote          → PIT gate: date (non-null string)
 *   Regime         → PIT gate: date + pitSafetyJson
 *   MonthlyRevenue → PIT gate: releaseDate (nullable — LOW_CONFIDENCE_PIT_INFERRED)
 *
 * Sources deferred (not part of P57 scope):
 *   FinancialReport → BLOCKED_PENDING_PIT_METADATA (no releaseDate column)
 *   InstitutionalChip → BLOCKED_PENDING_AVAILABLE_AT_AND_PROD_LOGS
 *   NewsEvent → AUDIT_ONLY (quality policy pending CEO P7)
 *
 * Classification: P57_AXIS_A_V1_SOURCE_ADAPTER_CONTRACT_STUB
 * Next phase: P58 — adapter implementations (QuoteAdapter, RegimeAdapter, MonthlyRevenueAdapter)
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 */

// ─── Contract version ─────────────────────────────────────────────────────────

export const REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION =
  "p57-axis-a-v1-real-data-snapshot-input-contract-v0" as const;

// ─── Governance constants ─────────────────────────────────────────────────────

export const REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE = {
  paperOnly: true,
  dryRunOnly: true,
  entersAlphaScore: false,
  notInvestmentAdvice: true,
  noRecommendation: true,
  noScoring: true,
  noBacktest: true,
  noOptimizer: true,
} as const;

// ─── Forbidden fields ─────────────────────────────────────────────────────────
// These field names must never appear as property keys in any exported type.

export const REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS = [
  "recommendation",
  "action",
  "buy",
  "sell",
  "hold",
  "targetPrice",
  "ROI",
  "PnL",
  "winRate",
  "edge",
  "alphaScore",
  "score",
  "forecast",
  "expectedReturn",
  "benchmark",
  "optimizer",
  "backtest",
  "returnPct",
  "profit",
  "position",
] as const;

export type ForbiddenField =
  (typeof REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS)[number];

// ─── PIT gate status ──────────────────────────────────────────────────────────

/**
 * Status of the point-in-time (PIT) gate check for a source record.
 *
 * PIT_SAFE                    — PIT field is non-null and verified as available
 *                               before or on the asOfDate.
 * LOW_CONFIDENCE_PIT_INFERRED — PIT field is nullable; date is inferred
 *                               (e.g., MonthlyRevenue with no releaseDate).
 *                               Usable in paper-mode snapshots with audit flag.
 * PIT_BLOCKED                 — PIT gate field is missing or record is not
 *                               eligible; adapter must return null.
 */
export type PitGateStatus =
  | "PIT_SAFE"
  | "LOW_CONFIDENCE_PIT_INFERRED"
  | "PIT_BLOCKED";

// ─── Source audit flags ───────────────────────────────────────────────────────

/**
 * Audit flags attached to a SourceInputFact.
 * Can be combined via array — empty array means no flags.
 */
export type SourceInputFactAuditFlag =
  | "LOW_CONFIDENCE_PIT_INFERRED"
  | "RELEASE_DATE_INFERRED_FROM_MONTH_END"
  | "RELEASE_DATE_NULL_FALLBACK_USED"
  | "PIT_SAFETY_JSON_ABSENT";

// ─── Eligible real-data source names ─────────────────────────────────────────

/**
 * The three source names authorized for v1 adapter implementation in P57–P59.
 * Blocked and audit-only sources (FinancialReport, InstitutionalChip, NewsEvent)
 * are excluded from this union until their respective authorization gates pass.
 */
export type RealDataSourceName =
  | "Quote"
  | "Regime"
  | "MonthlyRevenue";

// ─── SourceInputFact<TData> ───────────────────────────────────────────────────

/**
 * A point-in-time-validated fact produced by a source adapter.
 *
 * Generic over TData — the typed source input struct (e.g., QuoteAdapterInput).
 * The data field must never contain forbidden fields.
 *
 * Governance: entersAlphaScore = false. Not investment advice.
 */
export type SourceInputFact<TData> = {
  /** The source that produced this fact. */
  readonly sourceName: RealDataSourceName;
  /** Human-readable trace string, e.g. "TSE:2330@2024-01-15". */
  readonly sourceTrace: string;
  /** DB field used as the PIT gate, e.g. "date" or "releaseDate". */
  readonly pitGateField: string;
  /** Actual value of the PIT gate field from the DB record. */
  readonly pitGateValue: string | null;
  /** Result of the PIT gate evaluation. */
  readonly pitGateStatus: PitGateStatus;
  /** Audit flags attached to this fact (empty array if none). */
  readonly auditFlags: ReadonlyArray<SourceInputFactAuditFlag>;
  /** ISO-8601 timestamp at which the source record was observed / queried. */
  readonly observedAt: string | null;
  /** The snapshot asOfDate this fact was produced for (YYYY-MM-DD). */
  readonly asOfDate: string;
  /** Typed source data. Must not contain forbidden fields. */
  readonly data: TData;
};

// ─── SourceAdapterContract<TInput, TFactData> ────────────────────────────────

/**
 * Interface that every v1 source adapter must satisfy.
 *
 * - TInput   : typed DB input (e.g. QuoteAdapterInput)
 * - TFactData: typed fact data payload (typically same as TInput for v1 stubs)
 *
 * adapt() returns:
 *   SourceInputFact<TFactData>  when a PIT-valid record is found
 *   null                        when no PIT-valid record exists for asOfDate
 *                               (caller assigns BLOCKED to the snapshot slot)
 *
 * Governance: No implementation logic in this contract file.
 * Adapter implementations are deferred to P58+.
 */
export type SourceAdapterContract<TInput, TFactData> = {
  /** Identifies the source this adapter handles. */
  readonly sourceName: RealDataSourceName;
  /** Contract version — must match REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION. */
  readonly version: typeof REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION;
  /**
   * Transform a DB input record into a PIT-validated SourceInputFact.
   * Returns null if the record fails the PIT gate.
   */
  readonly adapt: (
    input: TInput,
    asOfDate: string,
  ) => SourceInputFact<TFactData> | null;
};

// ─── QuoteAdapterInput ────────────────────────────────────────────────────────

/**
 * Subset of the StockQuote Prisma model fields permitted for v1 adapter input.
 * PIT gate field: date (non-null → PIT_SAFE).
 *
 * Forbidden fields excluded: none of the 20 forbidden fields appear here.
 */
export type QuoteAdapterInput = {
  readonly stockId: string;
  readonly date: string;
  readonly close: number | null;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly volume: number | null;
  readonly change: number | null;
  readonly transactions: number | null;
  readonly tradeValue: number | null;
};

// ─── RegimeAdapterInput ───────────────────────────────────────────────────────

/**
 * Subset of the MarketRegimeResult Prisma model fields permitted for v1 adapter input.
 * PIT gate fields: date (non-null) + pitSafetyJson (non-null → PIT_SAFE).
 *
 * Forbidden fields excluded: forecast, prediction, recommendation, signal absent.
 */
export type RegimeAdapterInput = {
  readonly date: string;
  readonly regimeLabel: string;
  readonly confidence: number | null;
  /** Raw pitSafetyJson from the DB — opaque blob; adapter validates internally. */
  readonly pitSafetyJson: unknown;
  readonly source: string;
  readonly version: string;
};

// ─── MonthlyRevenueAdapterInput ───────────────────────────────────────────────

/**
 * Subset of the MonthlyRevenue Prisma model fields permitted for v1 adapter input.
 * PIT gate field: releaseDate (nullable → LOW_CONFIDENCE_PIT_INFERRED when null).
 *
 * releaseDateConfidence: "HIGH" | "MEDIUM" | "LOW" | null
 *   HIGH   → direct DB record with confirmed releaseDate
 *   MEDIUM → inferred from historical disclosure patterns
 *   LOW    → fallback inference only
 *   null   → not assessed
 *
 * Forbidden fields excluded: yoyGrowth / momGrowth are raw DB fields (not
 * forecast, ROI, returnPct, or expectedReturn derivatives).
 */
export type MonthlyRevenueAdapterInput = {
  readonly year: number;
  readonly month: number;
  readonly revenue: number | null;
  readonly yoyGrowth: number | null;
  readonly momGrowth: number | null;
  readonly releaseDate: string | null;
  readonly releaseDateSource: string | null;
  readonly releaseDateConfidence: "HIGH" | "MEDIUM" | "LOW" | null;
};
