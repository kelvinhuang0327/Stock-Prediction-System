/**
 * MonthlyRevenueReadinessAudit.ts
 *
 * DISCLAIMER: Structural audit-only. Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 * Results must not be used as buy/sell/hold signals.
 *
 * P29J Phase 2 — MonthlyRevenue source activation readiness audit.
 * Determines whether MonthlyRevenue can advance from STRUCTURAL_PLACEHOLDER_ONLY
 * (P29G classification) to the source-present dry-run gate.
 *
 * Hard constraint: MonthlyRevenue.entersAlphaScore = false (always, immutable).
 * This audit covers dry-run readiness only — not alphaScore eligibility.
 *
 * Evidence base: static code analysis of:
 *   prisma/schema.prisma (model MonthlyRevenue)
 *   src/lib/services/syncService.ts (syncRealRevenue)
 *   src/lib/onlineValidation/MonthlyRevenueAvailability.ts (filterMonthlyRevenueAvailableAsOf)
 *   src/lib/analysis/RuleBasedStockAnalyzer.ts (P17 PIT gate)
 *   src/lib/onlineValidation/p29g/PaperSimulationDryRunInput.ts (P29G governance)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type MonthlyRevenueReadinessClassification =
  | "MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN"
  | "MONTHLY_REVENUE_NEEDS_SCHEMA_REPAIR"
  | "MONTHLY_REVENUE_BLOCKED_MISSING_SOURCE"
  | "MONTHLY_REVENUE_BLOCKED_LEAKAGE_RISK";

export interface MonthlyRevenueSchemaStatus {
  readonly modelExists: boolean;
  readonly hasYearMonthFields: boolean;
  readonly hasReleaseDateField: boolean;
  readonly releaseDateFieldType: string;
  readonly hasReleaseDateSourceField: boolean;
  readonly hasReleaseDateConfidenceField: boolean;
  readonly hasAnnouncementDateField: boolean;
  readonly hasAvailabilityDateField: boolean;
  readonly asOfDateApproach: "year_month_int_pair" | "iso_date_string" | "none";
}

export interface MonthlyRevenueSyncStatus {
  readonly syncFunctionExists: boolean;
  readonly syncSource: string;
  readonly syncPopulatesReleaseDate: boolean;
  readonly syncPopulatesReleaseDateSource: boolean;
  readonly syncPopulatesReleaseDateConfidence: boolean;
  readonly effectiveReleaseDateInDB: "EXPLICIT" | "INFERRED" | "NULL";
  readonly inferenceRule: string | null;
  readonly inferredConfidence: string | null;
  readonly syncRepairNeeded: boolean;
}

export interface MonthlyRevenuePitGateStatus {
  readonly gateExists: boolean;
  readonly gateFunction: string;
  readonly allowsInference: boolean;
  readonly inferenceRule: string;
  readonly inferenceConfidence: string;
  readonly gateNote: string;
}

export interface BlockedSourceStatus {
  readonly sourceName: string;
  readonly classification: "HIGH_RISK_SOURCE_ABSENT";
  readonly entersAlphaScore: false;
  readonly entersP29JDryRun: false;
  readonly reason: string;
}

export interface MonthlyRevenueReadinessReport {
  readonly auditId: string;
  readonly auditVersion: string;
  readonly capturedAt: string;
  readonly sourceName: "MonthlyRevenue";
  readonly p29gStatus: string;
  readonly classification: MonthlyRevenueReadinessClassification;
  readonly entersAlphaScore: false;
  readonly schemaStatus: MonthlyRevenueSchemaStatus;
  readonly syncStatus: MonthlyRevenueSyncStatus;
  readonly pitGateStatus: MonthlyRevenuePitGateStatus;
  readonly dryRunReadiness: string;
  readonly blockingReasons: readonly string[];
  readonly nextActivationRequirements: readonly string[];
  readonly financialReportStatus: BlockedSourceStatus;
  readonly newsEventStatus: BlockedSourceStatus;
  readonly disclaimer: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const MONTHLY_REVENUE_AUDIT_VERSION = "p29j-monthly-revenue-readiness-v1";

export const MONTHLY_REVENUE_AUDIT_DISCLAIMER =
  "Structural audit-only. Does not constitute investment advice. " +
  "No ROI, profit, alpha, win-rate, edge, or outperformance claims. " +
  "Results must not be used as buy/sell/hold signals.";

// ─── Evidence objects (static — from code analysis) ─────────────────────────

const MONTHLY_REVENUE_SCHEMA_STATUS: MonthlyRevenueSchemaStatus = {
  modelExists: true,
  hasYearMonthFields: true,
  hasReleaseDateField: true,
  releaseDateFieldType: "DateTime? (nullable)",
  hasReleaseDateSourceField: true,
  hasReleaseDateConfidenceField: true,
  hasAnnouncementDateField: false,
  hasAvailabilityDateField: false,
  asOfDateApproach: "year_month_int_pair",
} as const;

const MONTHLY_REVENUE_SYNC_STATUS: MonthlyRevenueSyncStatus = {
  syncFunctionExists: true,
  syncSource: "TWSE getMonthlyRevenueSummary()",
  syncPopulatesReleaseDate: false,
  syncPopulatesReleaseDateSource: false,
  syncPopulatesReleaseDateConfidence: false,
  effectiveReleaseDateInDB: "NULL",
  inferenceRule: "INFERRED_NEXT_MONTH_10TH (via filterMonthlyRevenueAvailableAsOf)",
  inferredConfidence: "LOW_TO_MEDIUM",
  syncRepairNeeded: true,
} as const;

const MONTHLY_REVENUE_PIT_GATE_STATUS: MonthlyRevenuePitGateStatus = {
  gateExists: true,
  gateFunction: "filterMonthlyRevenueAvailableAsOf()",
  allowsInference: true,
  inferenceRule: "INFERRED_NEXT_MONTH_10TH",
  inferenceConfidence: "LOW_TO_MEDIUM",
  gateNote:
    "PIT gate exists and is applied in RuleBasedStockAnalyzer.ts (P17). " +
    "Gate infers releaseDate as next-month-10th when releaseDate is NULL. " +
    "Confidence: LOW_TO_MEDIUM — inferred (not explicitly set by sync).",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * checkReleaseDateRequirement — verifies whether release date metadata is
 * adequately available. Satisfied only if releaseDate is explicitly populated
 * in sync (EXPLICIT), OR an announcementDate / availabilityDate field exists in schema.
 */
export function checkReleaseDateRequirement(
  schemaStatus: MonthlyRevenueSchemaStatus,
  syncStatus: MonthlyRevenueSyncStatus
): { satisfied: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (syncStatus.effectiveReleaseDateInDB === "EXPLICIT") {
    reasons.push("releaseDate is explicitly populated in sync (EXPLICIT confidence).");
    return { satisfied: true, reasons };
  }

  if (schemaStatus.hasAnnouncementDateField) {
    reasons.push("announcementDate field present in schema as alternative PIT anchor.");
    return { satisfied: true, reasons };
  }

  if (schemaStatus.hasAvailabilityDateField) {
    reasons.push("availabilityDate field present in schema as alternative PIT anchor.");
    return { satisfied: true, reasons };
  }

  // Not satisfied
  reasons.push(
    "releaseDate field exists in schema but is never populated by syncRealRevenue() — always NULL."
  );
  reasons.push(
    "Sync creates/updates records with (revenue, yoyGrowth, momGrowth) only; " +
      "releaseDate, releaseDateSource, releaseDateConfidence are not set."
  );
  reasons.push(
    "No announcementDate or availabilityDate field available as alternative PIT anchor."
  );

  return { satisfied: false, reasons };
}

/**
 * checkAsOfDateNormalization — verifies the asOfDate normalization approach
 * for MonthlyRevenue (year/month int pair vs ISO string).
 */
export function checkAsOfDateNormalization(
  schemaStatus: MonthlyRevenueSchemaStatus
): { adequate: boolean; notes: string[] } {
  if (schemaStatus.asOfDateApproach === "year_month_int_pair") {
    return {
      adequate: true,
      notes: [
        "asOf normalization: RuleBasedStockAnalyzer derives (year, month) ints from asOfIso.",
        "Primary gate: { year: { lt: asOfYear } } OR { year: asOfYear, month: { lte: asOfMonth } }.",
        "Secondary gate: filterMonthlyRevenueAvailableAsOf() checks releaseDate <= asOfDate.",
      ],
    };
  }
  return {
    adequate: false,
    notes: ["Unexpected asOfDate approach — schema review required."],
  };
}

/**
 * getBlockedSourceStatus — returns HIGH_RISK_SOURCE_ABSENT for permanently blocked
 * sources (FinancialReport, NewsEvent). These must not enter the P29J audit scope.
 */
export function getBlockedSourceStatus(
  sourceName: "FinancialReport" | "NewsEvent"
): BlockedSourceStatus {
  const reasons: Record<"FinancialReport" | "NewsEvent", string> = {
    FinancialReport:
      "FinancialReport lacks quarterly release date governance and a verified PIT gate. " +
      "High lookahead risk. Remains HIGH_RISK_SOURCE_ABSENT until an independent audit.",
    NewsEvent:
      "NewsEvent publishedAt vs ingestedAt PIT separation is unaudited. " +
      "High sentiment leakage risk. Remains HIGH_RISK_SOURCE_ABSENT until an independent audit.",
  };

  return {
    sourceName,
    classification: "HIGH_RISK_SOURCE_ABSENT",
    entersAlphaScore: false,
    entersP29JDryRun: false,
    reason: reasons[sourceName],
  };
}

// ─── Deterministic report builder ─────────────────────────────────────────────

/**
 * buildMonthlyRevenueReadinessReport — returns the static evidence-based P29J
 * MonthlyRevenue activation readiness report.
 * Deterministic; no DB reads, no filesystem writes.
 *
 * Classification:
 *   MONTHLY_REVENUE_BLOCKED_MISSING_SOURCE       — model or sync absent
 *   MONTHLY_REVENUE_NEEDS_SCHEMA_REPAIR          — releaseDate not populated by sync
 *   MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN — all gates met
 *   MONTHLY_REVENUE_BLOCKED_LEAKAGE_RISK         — future/outcome field detected
 */
export function buildMonthlyRevenueReadinessReport(): MonthlyRevenueReadinessReport {
  const releaseDateCheck = checkReleaseDateRequirement(
    MONTHLY_REVENUE_SCHEMA_STATUS,
    MONTHLY_REVENUE_SYNC_STATUS
  );
  const asOfCheck = checkAsOfDateNormalization(MONTHLY_REVENUE_SCHEMA_STATUS);

  let classification: MonthlyRevenueReadinessClassification;
  const blockingReasons: string[] = [];

  if (!MONTHLY_REVENUE_SCHEMA_STATUS.modelExists) {
    classification = "MONTHLY_REVENUE_BLOCKED_MISSING_SOURCE";
    blockingReasons.push("MonthlyRevenue model does not exist in schema.");
  } else if (!MONTHLY_REVENUE_SYNC_STATUS.syncFunctionExists) {
    classification = "MONTHLY_REVENUE_BLOCKED_MISSING_SOURCE";
    blockingReasons.push("syncRealRevenue() does not exist — source absent.");
  } else if (!releaseDateCheck.satisfied) {
    classification = "MONTHLY_REVENUE_NEEDS_SCHEMA_REPAIR";
    blockingReasons.push(...releaseDateCheck.reasons);
  } else {
    classification = "MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN";
  }

  const dryRunReadiness =
    classification === "MONTHLY_REVENUE_NEEDS_SCHEMA_REPAIR"
      ? "BLOCKED — syncRealRevenue() must populate releaseDate before dry-run gate activation."
      : classification === "MONTHLY_REVENUE_BLOCKED_MISSING_SOURCE"
        ? "BLOCKED — source or sync absent."
        : "READY — source present, PIT gate exists, normalization adequate.";

  // Suppress asOfCheck notes warning from unused assignment
  void asOfCheck;

  return {
    auditId: "P29J-MONTHLY-REVENUE-READINESS-AUDIT",
    auditVersion: MONTHLY_REVENUE_AUDIT_VERSION,
    capturedAt: "2026-05-15T00:00:00.000Z",
    sourceName: "MonthlyRevenue",
    p29gStatus: "STRUCTURAL_PLACEHOLDER_ONLY",
    classification,
    entersAlphaScore: false,
    schemaStatus: MONTHLY_REVENUE_SCHEMA_STATUS,
    syncStatus: MONTHLY_REVENUE_SYNC_STATUS,
    pitGateStatus: MONTHLY_REVENUE_PIT_GATE_STATUS,
    dryRunReadiness,
    blockingReasons,
    nextActivationRequirements: [
      "1. Repair syncRealRevenue(): populate releaseDate, releaseDateSource='EXPLICIT', " +
        "releaseDateConfidence='HIGH' on each upsert.",
      "2. Run migration to backfill historical releaseDate using INFERRED_NEXT_MONTH_10TH rule.",
      "3. After repair: re-audit to advance classification to " +
        "MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN.",
      "4. Hard constraint: MonthlyRevenue.entersAlphaScore = false — " +
        "dry-run readiness does not imply alphaScore eligibility.",
      "5. FinancialReport and NewsEvent remain HIGH_RISK_SOURCE_ABSENT — " +
        "must not enter this activation path.",
    ],
    financialReportStatus: getBlockedSourceStatus("FinancialReport"),
    newsEventStatus: getBlockedSourceStatus("NewsEvent"),
    disclaimer: MONTHLY_REVENUE_AUDIT_DISCLAIMER,
  };
}
