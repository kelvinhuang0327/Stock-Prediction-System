/**
 * ChipLagEvidenceAudit.ts
 *
 * DISCLAIMER: Structural audit-only. Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 * Results must not be interpreted as buy/sell/hold signals.
 *
 * P29J Phase 1 — Chip C-F05 lag evidence audit.
 * Audits the InstitutionalChip source for T+0 / T+1 publication lag assumptions.
 * Verifies same-day chip scoring trust basis.
 *
 * Evidence base: static code analysis of:
 *   prisma/schema.prisma (model InstitutionalChip)
 *   src/lib/services/syncService.ts (syncInstitutionalChip)
 *   src/lib/analysis/RuleBasedStockAnalyzer.ts (asOfIso gate)
 *   vercel.json (cron schedule)
 *   src/lib/onlineValidation/p29i/QuoteRegimeChipPitAuditScanner.ts (C-F05 assumption)
 */

import { isForbiddenField } from "../p29i/PitSafetyRules";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChipLagClassification =
  | "CHIP_LAG_CONFIRMED"
  | "CHIP_LAG_WARN_ASSUMPTION_REQUIRED"
  | "CHIP_LAG_BLOCKED_MISSING_EVIDENCE"
  | "CHIP_LAG_FAIL_LEAKAGE_RISK";

export interface ChipSchemaEvidence {
  readonly hasDateField: boolean;
  readonly dateFieldName: string;
  readonly dateFieldType: string;
  readonly hasAvailabilityTimestamp: boolean;
  readonly availabilityTimestampField: string | null;
  readonly hasReleaseDateField: boolean;
  readonly hasGeneratedAtField: boolean;
  readonly schemaNote: string;
}

export interface ChipCronEvidence {
  readonly cronSchedule: string;
  readonly cronUtcTime: string;
  readonly cronTaiwanTime: string;
  readonly dataSourceApi: string;
  readonly t86TypicalAvailabilityTaiwanTime: string;
  readonly marketCloseTime: string;
  readonly cronFiresBeforeT86: boolean;
  readonly sameDayT0ViaCronPossible: boolean;
  readonly effectiveLagAssessment: string;
  readonly evidenceLevel: string;
}

export interface ChipGateEvidence {
  readonly gateExists: boolean;
  readonly gateField: string;
  readonly gateOperator: string;
  readonly normalizationApplied: boolean;
  readonly normalizationFunction: string;
  readonly asOfPropagated: boolean;
  readonly asOfSource: string;
}

export interface ChipLagAuditReport {
  readonly auditId: string;
  readonly auditVersion: string;
  readonly capturedAt: string;
  readonly sourceName: "Chip";
  readonly p29iStatus: string;
  readonly classification: ChipLagClassification;
  readonly schemaEvidence: ChipSchemaEvidence;
  readonly cronEvidence: ChipCronEvidence;
  readonly gateEvidence: ChipGateEvidence;
  readonly knownSchemaFields: readonly string[];
  readonly forbiddenFieldsFound: readonly string[];
  readonly assumptionNotes: readonly string[];
  readonly upgradePath: readonly string[];
  readonly disclaimer: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * All fields in prisma.InstitutionalChip as of audit date.
 * Source: prisma/schema.prisma — model InstitutionalChip
 */
export const CHIP_KNOWN_SCHEMA_FIELDS = [
  "id",
  "stockId",
  "date",
  "foreignBuy",
  "trustBuy",
  "dealerBuy",
  "totalBuy",
  "holders400",
  "holders1000",
  "createdAt",
] as const;

export const CHIP_AUDIT_VERSION = "p29j-chip-lag-audit-v1";

export const CHIP_AUDIT_DISCLAIMER =
  "Structural audit-only. Does not constitute investment advice. " +
  "No ROI, profit, alpha, win-rate, edge, or outperformance claims. " +
  "Results must not be used as buy/sell/hold signals.";

// ─── Evidence objects (static — from code analysis) ─────────────────────────

const CHIP_SCHEMA_EVIDENCE: ChipSchemaEvidence = {
  hasDateField: true,
  dateFieldName: "date",
  dateFieldType: "String (ISO YYYY-MM-DD)",
  hasAvailabilityTimestamp: false,
  availabilityTimestampField: null,
  hasReleaseDateField: false,
  hasGeneratedAtField: false,
  schemaNote:
    "InstitutionalChip.date stores the trade date as ISO string. " +
    "No availableAt, releaseDate, or generatedAt availability timestamp exists. " +
    "Cannot distinguish T vs T-1 chip data by schema field alone.",
} as const;

const CHIP_CRON_EVIDENCE: ChipCronEvidence = {
  cronSchedule: "0 7 * * 1-5",
  cronUtcTime: "07:00 UTC",
  cronTaiwanTime: "15:00 TWN (UTC+8)",
  dataSourceApi: "https://www.twse.com.tw/rwd/zh/fund/T86",
  t86TypicalAvailabilityTaiwanTime: "~17:30 TWN",
  marketCloseTime: "13:30 TWN",
  cronFiresBeforeT86: true,
  sameDayT0ViaCronPossible: false,
  effectiveLagAssessment:
    "Cron fires at 15:00 TWN. TWSE T86 institutional chip data is typically published " +
    "~17:30 TWN. Cron fires ~2.5 hours BEFORE T86 data is available. " +
    "Effective chip data at scheduled cron time = T-1 (prior trading day). " +
    "C-F05 assumption correctly documents 'scoring runs after 6pm (T) or uses prior day data' — " +
    "the 'prior day data' branch is the actual production path via the scheduled cron.",
  evidenceLevel:
    "ASSUMPTION — no production availability log confirming T+0 chip data at cron time. " +
    "Upgrade path: add availableAt timestamp to schema + verify in production logs.",
} as const;

const CHIP_GATE_EVIDENCE: ChipGateEvidence = {
  gateExists: true,
  gateField: "date",
  gateOperator: "lte (<=)",
  normalizationApplied: true,
  normalizationFunction: "normalizePitDateToIso()",
  asOfPropagated: true,
  asOfSource: "SignalFusionEngine.ts → analyzeStock(symbol, asOf) → asOfIso gate",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * detectForbiddenChipFields — scan chip field names for PIT violations.
 * Uses P29I forbidden field patterns (future price, volume, regime, label
 * contamination, realized return). Returns names of any forbidden fields found.
 */
export function detectForbiddenChipFields(
  fieldNames: readonly string[]
): string[] {
  return fieldNames.filter((name) => isForbiddenField(name));
}

// ─── Deterministic report builder ─────────────────────────────────────────────

/**
 * buildChipLagReport — returns the static evidence-based P29J chip lag audit report.
 * Deterministic; no DB reads, no filesystem writes.
 * Classification:
 *   CHIP_LAG_FAIL_LEAKAGE_RISK        — forbidden future/outcome field found in schema
 *   CHIP_LAG_WARN_ASSUMPTION_REQUIRED — gate present but no availability timestamp
 *   CHIP_LAG_BLOCKED_MISSING_EVIDENCE — would require availability timestamp + prod logs
 *   CHIP_LAG_CONFIRMED                — (not achievable with current schema evidence)
 */
export function buildChipLagReport(): ChipLagAuditReport {
  const forbiddenFieldsFound = detectForbiddenChipFields(CHIP_KNOWN_SCHEMA_FIELDS);

  let classification: ChipLagClassification;

  if (forbiddenFieldsFound.length > 0) {
    classification = "CHIP_LAG_FAIL_LEAKAGE_RISK";
  } else if (!CHIP_SCHEMA_EVIDENCE.hasAvailabilityTimestamp) {
    // Gate exists and no forbidden fields, but no availability timestamp —
    // cannot confirm T+0. C-F05 assumption is documented but not verified.
    classification = "CHIP_LAG_WARN_ASSUMPTION_REQUIRED";
  } else {
    // Schema has availability timestamp but no production log evidence yet
    classification = "CHIP_LAG_BLOCKED_MISSING_EVIDENCE";
  }

  return {
    auditId: "P29J-CHIP-LAG-AUDIT",
    auditVersion: CHIP_AUDIT_VERSION,
    capturedAt: "2026-05-15T00:00:00.000Z",
    sourceName: "Chip",
    p29iStatus: "P29I_SCANNER_CHIP_PIT_SAFE_CONFIRMED",
    classification,
    schemaEvidence: CHIP_SCHEMA_EVIDENCE,
    cronEvidence: CHIP_CRON_EVIDENCE,
    gateEvidence: CHIP_GATE_EVIDENCE,
    knownSchemaFields: CHIP_KNOWN_SCHEMA_FIELDS,
    forbiddenFieldsFound,
    assumptionNotes: [
      "C-F05 assumption: T+0 chip data published ~6pm on T. Post-close scoring assumes " +
        "scoring runs after 6pm (T) or uses prior day data.",
      "Production cron fires at 07:00 UTC (15:00 TWN) — BEFORE T86 availability (~17:30 TWN).",
      "Effective chip data at scheduled cron time = T-1 (prior trading day).",
      "No availableAt timestamp in schema to distinguish T vs T-1 chip records.",
      "Same-day T+0 chip scoring is NOT possible via the scheduled cron path.",
      "Manual retrigger after 17:30 TWN could enable T+0 chip data, but is not the default path.",
    ],
    upgradePath: [
      "1. Add availableAt DateTime field to prisma.InstitutionalChip schema.",
      "2. Set availableAt on upsert in syncInstitutionalChip() to record fetch time.",
      "3. Adjust cron to fire AFTER T86 availability (~18:00 TWN = 10:00 UTC).",
      "4. Verify T+0 data availability via production sync logs.",
      "5. After steps 1-4, re-audit to advance classification to CHIP_LAG_CONFIRMED.",
    ],
    disclaimer: CHIP_AUDIT_DISCLAIMER,
  };
}
