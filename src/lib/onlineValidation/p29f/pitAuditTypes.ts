/**
 * P29F: PIT Audit Types
 * Read-only audit infrastructure for Quote / Regime / Chip PIT validation.
 * Does NOT modify any production scoring, DB, or corpus.
 * NOT investment advice. Paper audit only.
 */

/** PIT validation classification for a given source */
export type PitAuditClassification =
  | "PIT_SAFE_VERIFIED"
  | "PIT_UNVERIFIED_NEEDS_REPAIR"
  | "PIT_VIOLATION_CONFIRMED"
  | "INSUFFICIENT_EVIDENCE";

/** Risk level for a PIT audit finding */
export type PitRiskLevel = "LOW" | "MEDIUM" | "MEDIUM_HIGH" | "HIGH" | "CRITICAL";

/** Audit target sources */
export type AuditSourceName = "Quote" | "Regime" | "Chip";

/** Evidence item for a PIT audit finding */
export interface PitAuditEvidence {
  fileRef: string;
  lineRef?: string;
  snippet: string;
  interpretation: string;
}

/** Individual PIT audit finding */
export interface PitAuditFinding {
  id: string;
  category:
    | "DATE_FORMAT_MISMATCH"
    | "FUTURE_FIELD_PRESENT"
    | "PUBLICATION_LAG"
    | "GATE_EXISTS"
    | "GATE_MISSING"
    | "GATE_INEFFECTIVE"
    | "BACKTEST_ONLY"
    | "LIVE_API_NO_ASOF"
    | "ADVISORY";
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  description: string;
  evidence: PitAuditEvidence[];
}

/** Full PIT audit result for one source */
export interface PitSourceAuditResult {
  sourceName: AuditSourceName;
  classification: PitAuditClassification;
  riskLevel: PitRiskLevel;
  findings: PitAuditFinding[];
  recommendedNextAction: string;
  mayRemainInAlphaScore: boolean;
  mustBlockBeforeSimulation: boolean;
  simulationInputTag: "VERIFIED" | "UNVERIFIED" | "BLOCKED";
  auditedAt: string;
}

/** Summary of the full P29F audit */
export interface P29FAuditSummary {
  auditId: string;
  auditedAt: string;
  sources: Record<AuditSourceName, PitSourceAuditResult>;
  trustRootBlockerRemains: boolean;
  simulationTrustRootStatus:
    | "VERIFIED_SAFE"
    | "UNVERIFIED_NEEDS_REPAIR"
    | "VIOLATION_CONFIRMED"
    | "INSUFFICIENT_EVIDENCE";
  overallClassification: string;
  nextRoundDecision: string;
}
