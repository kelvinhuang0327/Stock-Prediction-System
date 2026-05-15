/**
 * P28B Reason Template Coverage Planner
 *
 * READ-ONLY prototype for reason template coverage planning.
 * Accepts a P28A underoutput case snapshot and outputs a proposed renderer plan.
 *
 * INVARIANTS (enforced at runtime):
 *   - Does NOT compute alphaScore or bucket
 *   - Does NOT mutate the input snapshot
 *   - Does NOT write to DB or corpus
 *   - Does NOT produce investment recommendations
 *   - Output is observational / display-only
 *
 * This file is a planning prototype only. Actual renderer repairs will be
 * implemented in P28C against P26ACorpusReasonRenderer.ts and related files.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface P28BInputSnapshot {
  reasonSnapshot: string;
  factorSnapshot: string[];
  scoreSnapshot?: {
    technicalScore: number;
    chipScore: number;
    momentumScore: number;
    revenueScore: number;
  };
  usedSources?: string[];
  missingSources?: string[];
  /** READ-ONLY — must not be modified */
  alphaScore?: number;
  /** READ-ONLY — must not be modified */
  researchBucket?: string;
  asOfDate?: string;
  symbol?: string;
}

export type RendererRepairFamily =
  | "scoreSnapshot_zero_label"
  | "mixed_signals_no_template"
  | "no_triggered_factor_note"
  | "monthly_revenue_missing_note"
  | "already_covered"
  | "fallback_empty";

export interface P28BRendererPlanEntry {
  repairFamily: RendererRepairFamily;
  gapIds: string[];
  templateRuleIds: string[];
  proposedAction: string;
  requiresScoringChange: false; // always false — renderer-only
  safeToImplementNow: boolean;
  patchTargetFiles: string[];
}

export interface P28BRendererPlan {
  readonly planId: string;
  readonly generatedAt: string;
  readonly inputSymbol: string | null;
  readonly inputAlphaScore: number | null;
  readonly inputBucket: string | null;
  /** READ-ONLY — renderer does not change these */
  readonly alphaScoreUnchanged: true;
  readonly bucketUnchanged: true;
  /** Inferred from factorSnapshot */
  readonly inferredTechDirection: "偏多" | "偏空" | "中性";
  readonly hasMixedSignal: boolean;
  readonly hasMonthlyRevenueMissing: boolean;
  readonly factorSnapshotCount: number;
  readonly isGenericSingleToken: boolean;
  readonly entries: P28BRendererPlanEntry[];
  readonly disclaimer: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SINGLE_TOKEN_GENERIC_REASONS = new Set([
  "技術偏多",
  "技術偏空",
  "法人買超",
  "法人賣超",
  "動能偏多",
  "動能偏空",
  "多方訊號",
  "空方訊號",
  "中性觀望",
  "訊號不明",
  "待觀察",
]);

// ─── Pure helper functions ────────────────────────────────────────────────────

/**
 * Infer technical direction from MA trend text in factorSnapshot.
 * Used as fallback when scoreSnapshot.technicalScore === 0.
 *
 * Pure function — no side effects.
 */
export function inferDirectionFromMATrend(
  factorSnapshot: string[]
): "偏多" | "偏空" | "中性" {
  const maFactor = factorSnapshot.find((f) => f.includes("MA 趨勢"));
  if (!maFactor) return "中性";
  if (maFactor.includes("多頭排列")) return "偏多";
  if (maFactor.includes("空頭排列")) return "偏空";
  return "中性";
}

/**
 * Detect mixed-signal condition: MA bearish + MACD bullish, or vice versa.
 *
 * Pure function — no side effects.
 */
export function detectMixedSignal(factorSnapshot: string[]): boolean {
  const maFactor = factorSnapshot.find((f) => f.includes("MA 趨勢"));
  const macdFactor = factorSnapshot.find((f) => f.includes("MACD"));

  if (!maFactor || !macdFactor) return false;

  const maBearish = maFactor.includes("空頭排列");
  const macdBullish = macdFactor.includes("多方動能");
  const maBullish = maFactor.includes("多頭排列");
  const macdBearish = macdFactor.includes("空方動能") || macdFactor.includes("死叉");

  return (maBearish && macdBullish) || (maBullish && macdBearish);
}

/**
 * Check if reason snapshot is a single generic token.
 *
 * Pure function — no side effects.
 */
export function isSingleTokenGenericReason(reasonSnapshot: string): boolean {
  return SINGLE_TOKEN_GENERIC_REASONS.has(reasonSnapshot.trim());
}

// ─── Main planner function ────────────────────────────────────────────────────

/**
 * Build a renderer repair plan for a given snapshot.
 *
 * READ-ONLY: Does not mutate input, does not compute alphaScore/bucket,
 * does not write to DB or corpus.
 *
 * Returns a P28BRendererPlan describing what renderer repairs are needed.
 */
export function buildRendererRepairPlan(
  snapshot: P28BInputSnapshot,
  planId?: string
): P28BRendererPlan {
  const now = new Date().toISOString();
  const entries: P28BRendererPlanEntry[] = [];

  const factorCount = snapshot.factorSnapshot.length;
  const isGenericSingleToken = isSingleTokenGenericReason(snapshot.reasonSnapshot);
  const techDir = inferDirectionFromMATrend(snapshot.factorSnapshot);
  const hasMixed = detectMixedSignal(snapshot.factorSnapshot);
  const hasRevenueMissing =
    snapshot.missingSources?.some((s) =>
      s.toLowerCase().includes("monthlyrevenue") || s.includes("月營收")
    ) ?? false;

  const techScoreIsZero = (snapshot.scoreSnapshot?.technicalScore ?? 0) === 0;
  const hasTechScorePassthrough =
    snapshot.scoreSnapshot !== undefined && !techScoreIsZero;

  // TR-01 + TR-02: scoreSnapshot zero label fix
  if (isGenericSingleToken && factorCount > 0 && techScoreIsZero && techDir !== "中性") {
    entries.push({
      repairFamily: "scoreSnapshot_zero_label",
      gapIds: ["G6-1", "G6-2", "G3-1", "G3-2"],
      templateRuleIds: ["TR-01", "TR-02"],
      proposedAction: `Pass scoreSnapshot from corpus through WalkthroughCaseInput; add inferDirectionFromMATrend() fallback. Inferred direction: ${techDir}`,
      requiresScoringChange: false,
      safeToImplementNow: true,
      patchTargetFiles: [
        "src/lib/onlineValidation/P5WalkthroughReviewUtils.ts",
        "src/lib/onlineValidation/P26ACorpusRowAdapter.ts",
        "src/lib/onlineValidation/P26AReasonFactorEnrichmentUtils.ts",
      ],
    });
  }

  // TR-03: Mixed-signal template
  if (hasMixed) {
    entries.push({
      repairFamily: "mixed_signals_no_template",
      gapIds: ["G5-2"],
      templateRuleIds: ["TR-03"],
      proposedAction:
        "Add mixed-signal aggregation template: output neutral context with explicit signal conflict explanation. No buy/sell recommendation.",
      requiresScoringChange: false,
      safeToImplementNow: true,
      patchTargetFiles: ["src/lib/onlineValidation/P26ACorpusReasonRenderer.ts"],
    });
  }

  // TR-04: NO_TRIGGERED_FACTOR context note
  if (isGenericSingleToken && factorCount > 0) {
    entries.push({
      repairFamily: "no_triggered_factor_note",
      gapIds: ["G5-3"],
      templateRuleIds: ["TR-04"],
      proposedAction: `Append context note: '（系統偵測 ${factorCount} 項因子，但各項訊號強度均未達閾值，暫以技術面概覽呈現）'`,
      requiresScoringChange: false,
      safeToImplementNow: true,
      patchTargetFiles: ["src/lib/onlineValidation/P26ACorpusReasonRenderer.ts"],
    });
  }

  // TR-05: Monthly revenue missing note
  if (hasRevenueMissing) {
    entries.push({
      repairFamily: "monthly_revenue_missing_note",
      gapIds: [],
      templateRuleIds: ["TR-05"],
      proposedAction: `Add inline revenue missing note: '月營收資料暫缺（截至 ${snapshot.asOfDate ?? "未知"}），待資料更新後補充'`,
      requiresScoringChange: false,
      safeToImplementNow: true,
      patchTargetFiles: ["src/lib/onlineValidation/P26ACorpusReasonRenderer.ts"],
    });
  }

  // No changes needed
  if (entries.length === 0) {
    entries.push({
      repairFamily: factorCount === 0 ? "fallback_empty" : "already_covered",
      gapIds: [],
      templateRuleIds: [],
      proposedAction:
        factorCount === 0
          ? "factorSnapshot empty — renderer will produce FALLBACK_EMPTY, no repair needed"
          : "Reason appears already covered — no renderer repair needed",
      requiresScoringChange: false,
      safeToImplementNow: true,
      patchTargetFiles: [],
    });
  }

  return {
    planId: planId ?? `p28b-plan-${Date.now()}`,
    generatedAt: now,
    inputSymbol: snapshot.symbol ?? null,
    inputAlphaScore: snapshot.alphaScore ?? null,
    inputBucket: snapshot.researchBucket ?? null,
    alphaScoreUnchanged: true,
    bucketUnchanged: true,
    inferredTechDirection: techDir,
    hasMixedSignal: hasMixed,
    hasMonthlyRevenueMissing: hasRevenueMissing,
    factorSnapshotCount: factorCount,
    isGenericSingleToken,
    entries,
    disclaimer:
      "Observability only. No investment recommendations. alphaScore and bucket are not modified.",
  };
}

// ─── Batch planner ────────────────────────────────────────────────────────────

/**
 * Process a batch of snapshots and return an array of renderer plans.
 * READ-ONLY — does not mutate inputs or write to any storage.
 */
export function buildRendererRepairPlanBatch(
  snapshots: P28BInputSnapshot[]
): P28BRendererPlan[] {
  return snapshots.map((snap, idx) =>
    buildRendererRepairPlan(snap, `p28b-plan-${idx + 1}`)
  );
}
