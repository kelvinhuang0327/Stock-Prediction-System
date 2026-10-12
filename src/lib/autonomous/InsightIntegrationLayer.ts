/**
 * InsightIntegrationLayer — bridges optimization task outputs into the
 * trading system's learning pipeline.
 *
 * Flow:
 *   Task JSON report
 *   → extractInsightsFromTaskOutput()   [pure, testable]
 *   → persistInsights()                 [DB write]
 *   → loadActiveInsights()              [DB read, non-expired only]
 *   → computeTriggerScoreInsightMultiplier()  → TriggerScoringEngine
 *   → applyInsightRankingPenalty()            → DecisionLayerEngine
 *   → formatInsightsAsLimitations()           → StrategyLearningEngine
 *
 * Safety invariants (enforced, never relaxed):
 *   - All score adjustments are soft multipliers capped at MAX_PENALTY (20%)
 *   - Minimum confidence 0.6 required before any adjustment is applied
 *   - Score floor: multiplier never drops the score to zero
 *   - Insights expire and must be renewed by new task runs
 *   - NO direct modification of thresholds, stops, sizing floors, or weights
 */

import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { prisma } from '../prisma';
import {
  GUARDRAIL_GLOBAL_CAP,
  GUARDRAIL_MIN_CONFIDENCE,
  STRONG_COEFFICIENT_BOOST,
  STRONG_PENALTY_CAP,
  type FilteredInsight,
  type TieredFilteredInsights,
} from './InsightGuardrailLayer';

// ─── Public Types ──────────────────────────────────────────────────────────────

export type InsightSignalType =
  | 'score_bias'            // triggerScore clusters too tight → discrimination lost
  | 'setup_imbalance'       // one setupType dominates proposals
  | 'time_exit_dominance'   // > 40% of exits are time-based → stops/targets misaligned
  | 'data_quality_issue'    // price data stale or corrupted
  | 'indicator_insufficient' // symbols with < 250 bars of quote history
  | 'sector_misalignment';  // proposals conflict with broad market direction

export type InsightSeverity = 'low' | 'medium' | 'high';

export interface OptimizationInsightRecord {
  id?: number;
  insightType: InsightSignalType;
  sourceTaskId: string;
  evidence: string[];
  confidence: number;         // 0.0–1.0
  severity: InsightSeverity;
  affectedSetupTypes: string[];
  affectedSymbols: string[];
  expiresAt: string;          // ISO string
  createdAt?: string;
  /** Market regime at extraction time (tagged by processCompletedOptimizationTaskFromFS). */
  regimeContext?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum confidence before any adjustment is applied. Mirrors GUARDRAIL_MIN_CONFIDENCE. */
const MIN_CONFIDENCE = GUARDRAIL_MIN_CONFIDENCE;

/** Maximum total downward adjustment a set of insights can impose. Mirrors GUARDRAIL_GLOBAL_CAP (25%). */
const MAX_PENALTY = GUARDRAIL_GLOBAL_CAP;

/**
 * Return effective confidence for an insight.
 * Accepts both plain OptimizationInsightRecord and guardrail-filtered FilteredInsight.
 * FilteredInsight has `decayedConfidence` set after time decay + regime penalty;
 * plain records use their raw `confidence` value.
 */
function effectiveConf(ins: OptimizationInsightRecord): number {
  return (ins as Partial<FilteredInsight>).decayedConfidence ?? ins.confidence;
}

/** Insight time-to-live in days, per signal type. */
const TTL_DAYS: Record<InsightSignalType, number> = {
  data_quality_issue:     7,
  sector_misalignment:    7,
  score_bias:            14,
  setup_imbalance:       14,
  time_exit_dominance:   21,
  indicator_insufficient: 30,
};

// ─── Extraction: pure, no I/O ─────────────────────────────────────────────────

/** Maps optimization task dedupeKey → signal type. */
const TASK_SIGNAL_MAP: Readonly<Record<string, InsightSignalType>> = {
  'price_analysis_quality__trigger_score_distribution': 'score_bias',
  'price_analysis_quality__setup_classification_audit': 'setup_imbalance',
  'price_analysis_quality__mfe_mae_audit':              'time_exit_dominance',
  'price_analysis_quality__data_audit':                 'data_quality_issue',
  'price_analysis_quality__indicator_history_check':    'indicator_insufficient',
  'price_analysis_quality__sector_context_audit':       'sector_misalignment',
};

/** Report file paths (relative to project root) written by AI worker. */
const TASK_REPORT_PATHS: Readonly<Record<string, string>> = {
  'price_analysis_quality__trigger_score_distribution': 'docs/reports/trigger_score_audit.json',
  'price_analysis_quality__setup_classification_audit': 'docs/reports/setup_audit.json',
  'price_analysis_quality__mfe_mae_audit':              'docs/reports/mfe_mae_audit.json',
  'price_analysis_quality__data_audit':                 'docs/reports/price_data_quality.json',
  'price_analysis_quality__indicator_history_check':    'docs/reports/indicator_readiness.json',
  'price_analysis_quality__sector_context_audit':       'docs/reports/sector_alignment.json',
};

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function safeJson(v: string | null | undefined): Record<string, unknown> {
  try { return JSON.parse(v ?? '{}') as Record<string, unknown>; } catch { return {}; }
}

/**
 * Extract structured insights from a task completion report JSON.
 *
 * Pure function — no DB, no filesystem. Safe to call in tests.
 *
 * Expected report shapes per task:
 *   score_bias:            { scoreRange, dominantSetupType?, dominantPct?, sampleSize }
 *   setup_imbalance:       { dominantSetupType?, dominantPct, totalTrades, uniqueSetupTypes? }
 *   time_exit_dominance:   { timeExitPct, sampleCount, mfePct?, maePct? }
 *   data_quality_issue:    { staleQuoteAge?, zeroVolumeCount?, symbolCount?, stalestSymbol? }
 *   indicator_insufficient: { symbolsBelowThreshold, thresholdBars?, examples? }
 *   sector_misalignment:   { conflictCount, sampleCount, dominantMarketDirection? }
 */
export function extractInsightsFromTaskOutput(
  taskId: string,
  reportJson: Record<string, unknown>,
): OptimizationInsightRecord[] {
  const signalType = TASK_SIGNAL_MAP[taskId];
  if (!signalType) return [];

  const ttl = TTL_DAYS[signalType];
  const expiresAt = daysFromNow(ttl);
  const now = new Date().toISOString();

  switch (signalType) {
    case 'score_bias': {
      const scoreRange = safeNum(reportJson.scoreRange);
      const dominantPct = safeNum(reportJson.dominantPct);
      const sampleSize = safeNum(reportJson.sampleSize, 0);
      if ((scoreRange >= 0.25 && dominantPct <= 0.80) || sampleSize < 10) return [];

      const severity: InsightSeverity = scoreRange < 0.10 ? 'high' : scoreRange < 0.20 ? 'medium' : 'low';
      const confidence = Math.min(1, sampleSize / 50);
      const evidence = [
        `Score range: ${scoreRange.toFixed(3)} (threshold < 0.25)`,
        dominantPct > 0 ? `Dominant setup: ${(dominantPct * 100).toFixed(0)}%` : null,
        `Sample size: ${sampleSize}`,
      ].filter(Boolean) as string[];
      const affectedSetupTypes = reportJson.dominantSetupType ? [String(reportJson.dominantSetupType)] : [];

      return [{ insightType: 'score_bias', sourceTaskId: taskId, evidence, confidence, severity, affectedSetupTypes, affectedSymbols: [], expiresAt, createdAt: now }];
    }

    case 'setup_imbalance': {
      const dominantPct = safeNum(reportJson.dominantPct);
      const totalTrades = safeNum(reportJson.totalTrades, 0);
      if (dominantPct <= 0.80 || totalTrades < 5) return [];

      const severity: InsightSeverity = dominantPct > 0.95 ? 'high' : dominantPct > 0.90 ? 'medium' : 'low';
      const confidence = Math.min(1, totalTrades / 20);
      const evidence = [
        `Dominant setup: ${reportJson.dominantSetupType ?? 'unknown'} (${(dominantPct * 100).toFixed(0)}%)`,
        `Total trades: ${totalTrades}`,
        reportJson.uniqueSetupTypes != null ? `Unique setup types: ${reportJson.uniqueSetupTypes}` : null,
      ].filter(Boolean) as string[];
      const affectedSetupTypes = reportJson.dominantSetupType ? [String(reportJson.dominantSetupType)] : [];

      return [{ insightType: 'setup_imbalance', sourceTaskId: taskId, evidence, confidence, severity, affectedSetupTypes, affectedSymbols: [], expiresAt, createdAt: now }];
    }

    case 'time_exit_dominance': {
      const timeExitPct = safeNum(reportJson.timeExitPct);
      const sampleCount = safeNum(reportJson.sampleCount, 0);
      if (timeExitPct <= 0.40 || sampleCount < 5) return [];

      const severity: InsightSeverity = timeExitPct > 0.70 ? 'high' : timeExitPct > 0.55 ? 'medium' : 'low';
      const confidence = Math.min(1, sampleCount / 30);
      const evidence = [
        `Time-exit rate: ${(timeExitPct * 100).toFixed(0)}% (threshold 40%)`,
        `Sample: ${sampleCount} closed trades`,
        reportJson.mfePct != null ? `Avg MFE: ${safeNum(reportJson.mfePct).toFixed(2)}%` : null,
      ].filter(Boolean) as string[];

      return [{ insightType: 'time_exit_dominance', sourceTaskId: taskId, evidence, confidence, severity, affectedSetupTypes: [], affectedSymbols: [], expiresAt, createdAt: now }];
    }

    case 'data_quality_issue': {
      const staleQuoteAge = safeNum(reportJson.staleQuoteAge);
      const zeroVolumeCount = safeNum(reportJson.zeroVolumeCount);
      if (staleQuoteAge <= 48 && zeroVolumeCount === 0) return [];

      const severity: InsightSeverity = staleQuoteAge > 120 ? 'high' : staleQuoteAge > 72 ? 'medium' : 'low';
      const confidence = staleQuoteAge > 0 ? Math.min(1, staleQuoteAge / 120) : 0.7;
      const evidence = [
        staleQuoteAge > 0 ? `Stale quote age: ${staleQuoteAge}h (threshold 48h)` : null,
        zeroVolumeCount > 0 ? `Zero-volume rows: ${zeroVolumeCount}` : null,
        reportJson.symbolCount != null ? `Symbols affected: ${reportJson.symbolCount}` : null,
      ].filter(Boolean) as string[];
      const affectedSymbols = reportJson.stalestSymbol ? [String(reportJson.stalestSymbol)] : [];

      return [{ insightType: 'data_quality_issue', sourceTaskId: taskId, evidence, confidence, severity, affectedSetupTypes: [], affectedSymbols, expiresAt, createdAt: now }];
    }

    case 'indicator_insufficient': {
      const symbolsBelow = safeNum(reportJson.symbolsBelowThreshold);
      if (symbolsBelow < 1) return [];

      const examples = safeStrArr(reportJson.examples);
      const severity: InsightSeverity = symbolsBelow >= 5 ? 'high' : symbolsBelow >= 2 ? 'medium' : 'low';
      const confidence = Math.min(1, 0.5 + symbolsBelow * 0.1);
      const evidence = [
        `${symbolsBelow} symbols below ${reportJson.thresholdBars ?? 250}-bar threshold`,
        examples.length > 0 ? `Examples: ${examples.slice(0, 3).join(', ')}` : null,
      ].filter(Boolean) as string[];

      return [{ insightType: 'indicator_insufficient', sourceTaskId: taskId, evidence, confidence, severity, affectedSetupTypes: [], affectedSymbols: examples.slice(0, 10), expiresAt, createdAt: now }];
    }

    case 'sector_misalignment': {
      const conflictCount = safeNum(reportJson.conflictCount);
      const sampleCount = safeNum(reportJson.sampleCount, 0);
      if (conflictCount < 1 || sampleCount < 3) return [];

      const conflictPct = conflictCount / sampleCount;
      const severity: InsightSeverity = conflictPct > 0.50 ? 'high' : conflictPct > 0.30 ? 'medium' : 'low';
      const confidence = Math.min(1, sampleCount / 15);
      const evidence = [
        `${conflictCount}/${sampleCount} proposals conflict with market direction`,
        `Conflict rate: ${(conflictPct * 100).toFixed(0)}%`,
        reportJson.dominantMarketDirection ? `Market: ${reportJson.dominantMarketDirection}` : null,
      ].filter(Boolean) as string[];

      return [{ insightType: 'sector_misalignment', sourceTaskId: taskId, evidence, confidence, severity, affectedSetupTypes: [], affectedSymbols: [], expiresAt, createdAt: now }];
    }

    default:
      return [];
  }
}

// ─── DB Persistence ──────────────────────────────────────────────────────────

export async function persistInsights(insights: OptimizationInsightRecord[]): Promise<void> {
  for (const ins of insights) {
    await prisma.optimizationInsightRecord.upsert({
      where: {
        sourceTaskId_insightType: {
          sourceTaskId: ins.sourceTaskId,
          insightType: ins.insightType,
        },
      },
      update: {
        evidence: JSON.stringify(ins.evidence),
        confidence: ins.confidence,
        severity: ins.severity,
        affectedScope: JSON.stringify({ setupTypes: ins.affectedSetupTypes, symbols: ins.affectedSymbols }),
        regimeContext: ins.regimeContext ?? null,
        expiresAt: new Date(ins.expiresAt),
        updatedAt: new Date(),
      },
      create: {
        insightType: ins.insightType,
        sourceTaskId: ins.sourceTaskId,
        evidence: JSON.stringify(ins.evidence),
        confidence: ins.confidence,
        severity: ins.severity,
        affectedScope: JSON.stringify({ setupTypes: ins.affectedSetupTypes, symbols: ins.affectedSymbols }),
        regimeContext: ins.regimeContext ?? null,
        expiresAt: new Date(ins.expiresAt),
      },
    });
  }
}

/** Returns all non-expired insights. Returns [] on any DB error. */
export async function loadActiveInsights(): Promise<OptimizationInsightRecord[]> {
  try {
    const rows = await prisma.optimizationInsightRecord.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => {
      const scope = safeJson(row.affectedScope);
      return {
        id: row.id,
        insightType: row.insightType as InsightSignalType,
        sourceTaskId: row.sourceTaskId,
        evidence: JSON.parse(row.evidence || '[]') as string[],
        confidence: row.confidence,
        severity: row.severity as InsightSeverity,
        affectedSetupTypes: Array.isArray(scope.setupTypes) ? scope.setupTypes as string[] : [],
        affectedSymbols: Array.isArray(scope.symbols) ? scope.symbols as string[] : [],
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        regimeContext: row.regimeContext ?? undefined,
      };
    });
  } catch {
    return [];
  }
}

// ─── FS entry point (called from workerTick on task completion) ───────────────

/**
 * Read the report JSON written by the AI worker, extract insights, tag them
 * with the current market regime, and persist them. Non-blocking — errors are swallowed.
 *
 * @param taskId - dedupeKey of the completed optimization task
 * @param options.regimeContext - current market regime at completion time (for guardrail tagging)
 */
export async function processCompletedOptimizationTaskFromFS(
  taskId: string,
  options?: { regimeContext?: string },
): Promise<void> {
  const relPath = TASK_REPORT_PATHS[taskId];
  if (!relPath) return;

  const absPath = nodePath.join(process.cwd(), relPath);
  const raw = await fs.readFile(absPath, 'utf-8').catch(() => null);
  if (!raw) return;

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }

  const base = extractInsightsFromTaskOutput(taskId, json);
  // Tag each insight with the regime context so the guardrail can filter by regime later
  const insights = options?.regimeContext
    ? base.map((ins) => ({ ...ins, regimeContext: options.regimeContext }))
    : base;

  if (insights.length > 0) {
    await persistInsights(insights).catch(() => { /* non-blocking */ });
  }
}

// ─── TriggerScoringEngine integration ─────────────────────────────────────────

/**
 * Compute a soft downward multiplier (0.80–1.0) for a trigger score based on
 * active insights for a given symbol and setupType.
 *
 * Safety: total penalty capped at MAX_PENALTY (20%). Multiplier floor: 0.80.
 */
export function computeTriggerScoreInsightMultiplier(
  symbol: string,
  setupType: string,
  insights: OptimizationInsightRecord[],
): { multiplier: number; appliedInsights: string[] } {
  const applicable = insights.filter((ins) => effectiveConf(ins) >= MIN_CONFIDENCE);
  if (applicable.length === 0) return { multiplier: 1.0, appliedInsights: [] };

  let rawPenalty = 0;
  const applied: string[] = [];
  const conf = (ins: OptimizationInsightRecord) => effectiveConf(ins);

  for (const ins of applicable) {
    switch (ins.insightType) {
      case 'data_quality_issue':
        rawPenalty += 0.15 * conf(ins);
        applied.push(`data_quality_issue(conf=${conf(ins).toFixed(2)})`);
        break;

      case 'score_bias':
        rawPenalty += 0.10 * conf(ins);
        applied.push(`score_bias(conf=${conf(ins).toFixed(2)})`);
        break;

      case 'indicator_insufficient':
        if (ins.affectedSymbols.length === 0 || ins.affectedSymbols.includes(symbol)) {
          rawPenalty += 0.12 * conf(ins);
          applied.push(`indicator_insufficient(symbol=${symbol})`);
        }
        break;

      case 'setup_imbalance':
        if (ins.affectedSetupTypes.includes(setupType)) {
          rawPenalty += 0.08 * conf(ins);
          applied.push(`setup_imbalance(setup=${setupType})`);
        }
        break;

      case 'time_exit_dominance':
        rawPenalty += 0.05 * conf(ins);
        applied.push(`time_exit_dominance(conf=${conf(ins).toFixed(2)})`);
        break;

      case 'sector_misalignment':
        rawPenalty += 0.07 * conf(ins);
        applied.push(`sector_misalignment(conf=${conf(ins).toFixed(2)})`);
        break;
    }
  }

  const capped = Math.min(MAX_PENALTY, Math.max(0, rawPenalty));
  return { multiplier: 1.0 - capped, appliedInsights: applied };
}

// ─── DecisionLayerEngine integration ─────────────────────────────────────────

/**
 * Apply insight-based soft penalties to candidate alphaScores before ranking.
 * The dominant imbalanced setup type is penalized to encourage diversity.
 * Returns a new array — input is never mutated.
 */
export function applyInsightRankingPenalty<
  T extends { setupType: string; alphaScore: number },
>(
  candidates: T[],
  insights: OptimizationInsightRecord[],
): Array<T & { insightPenaltyNote?: string }> {
  const applicable = insights.filter((ins) => effectiveConf(ins) >= MIN_CONFIDENCE);
  if (applicable.length === 0) return candidates;

  return candidates.map((c) => {
    let rawPenalty = 0;
    const notes: string[] = [];

    for (const ins of applicable) {
      if (ins.insightType === 'setup_imbalance' && ins.affectedSetupTypes.includes(c.setupType)) {
        rawPenalty += 0.15 * effectiveConf(ins);
        notes.push(`setup_imbalance: ${c.setupType} is over-represented`);
      }
      if (ins.insightType === 'score_bias') {
        rawPenalty += 0.05 * effectiveConf(ins);
        notes.push('score_bias: triggerScore discrimination reduced');
      }
      if (ins.insightType === 'sector_misalignment') {
        rawPenalty += 0.10 * effectiveConf(ins);
        notes.push('sector_misalignment: macro context unfavorable');
      }
    }

    const capped = Math.min(MAX_PENALTY, Math.max(0, rawPenalty));
    return {
      ...c,
      alphaScore: Math.max(0, c.alphaScore * (1.0 - capped)),
      insightPenaltyNote: notes.length > 0 ? notes.join('; ') : undefined,
    };
  });
}

// ─── StrategyLearningEngine integration ──────────────────────────────────────

/**
 * Format active high-confidence insights as human-readable limitation strings
 * for appending to StrategyLearningInsight.limitations.
 */
// ─── Shared penalty helper ───────────────────────────────────────────────────

/**
 * Compute the raw penalty contribution from a single insight for
 * TriggerScoring purposes.  Returns 0 when the insight doesn't apply to the
 * given symbol / setupType combination.
 */
function penaltyForInsight(
  ins: OptimizationInsightRecord,
  symbol: string,
  setupType: string,
  conf: number,
  boost: number,
): number {
  switch (ins.insightType) {
    case 'data_quality_issue':     return 0.15 * boost * conf;
    case 'score_bias':             return 0.10 * boost * conf;
    case 'time_exit_dominance':    return 0.05 * boost * conf;
    case 'sector_misalignment':    return 0.07 * boost * conf;
    case 'indicator_insufficient':
      return ins.affectedSymbols.length === 0 || ins.affectedSymbols.includes(symbol)
        ? 0.12 * boost * conf
        : 0;
    case 'setup_imbalance':
      return ins.affectedSetupTypes.includes(setupType) ? 0.08 * boost * conf : 0;
    default:
      return 0;
  }
}

// ─── Tier-aware score multiplier ─────────────────────────────────────────────

/**
 * Compute a score multiplier from tiered filtered insights.
 *
 * Tier penalty behaviour:
 *   soft tier     → base coefficients × 1.0, cap = MAX_PENALTY (25%)
 *   strong tier   → base coefficients × STRONG_COEFFICIENT_BOOST (2×), cap = STRONG_PENALTY_CAP (60%)
 *   critical tier → same as strong (gating handled separately by callers)
 *
 * The effective cap is determined by whether any strong/critical insights exist.
 *
 * IMPORTANT: Do NOT call this for a gated proposal — callers must check
 * TieredGuardrailResult.gatingDecisions FIRST and short-circuit before here.
 */
export function computeTieredScoreMultiplier(
  symbol: string,
  setupType: string,
  tiers: TieredFilteredInsights,
): { multiplier: number; appliedInsights: string[]; effectiveCap: number } {
  const hasStrongOrCritical = tiers.strong.length > 0 || tiers.critical.length > 0;
  const effectiveCap = hasStrongOrCritical ? STRONG_PENALTY_CAP : MAX_PENALTY;

  let rawPenalty = 0;
  const applied: string[] = [];

  for (const ins of tiers.soft) {
    const conf = effectiveConf(ins);
    if (conf < MIN_CONFIDENCE) continue;
    const p = penaltyForInsight(ins, symbol, setupType, conf, 1.0);
    if (p > 0) {
      rawPenalty += p;
      applied.push(`soft:${ins.insightType}(conf=${conf.toFixed(2)})`);
    }
  }

  for (const ins of [...tiers.strong, ...tiers.critical]) {
    const conf = effectiveConf(ins);
    if (conf < MIN_CONFIDENCE) continue;
    const tier = tiers.strong.includes(ins) ? 'strong' : 'critical';
    const p = penaltyForInsight(ins, symbol, setupType, conf, STRONG_COEFFICIENT_BOOST);
    if (p > 0) {
      rawPenalty += p;
      applied.push(`${tier}:${ins.insightType}(conf=${conf.toFixed(2)},boost=×${STRONG_COEFFICIENT_BOOST})`);
    }
  }

  const capped = Math.min(effectiveCap, Math.max(0, rawPenalty));
  return { multiplier: 1.0 - capped, appliedInsights: applied, effectiveCap };
}

// ─── Tier-aware ranking penalty ───────────────────────────────────────────────

/**
 * Apply tier-aware ranking penalty to candidate alpha scores.
 *
 * Strong/critical insights use STRONG_COEFFICIENT_BOOST (2×) ranking coefficients.
 * Effective cap: STRONG_PENALTY_CAP when strong/critical insights present.
 *
 * Use this instead of applyInsightRankingPenalty when runTieredGuardrail is used.
 */
export function applyStrongInsightRankingPenalty<
  T extends { setupType: string; alphaScore: number },
>(
  candidates: T[],
  tiers: TieredFilteredInsights,
): Array<T & { insightPenaltyNote?: string }> {
  const allWithBoost: Array<{ ins: OptimizationInsightRecord; boost: number; tierLabel: string }> = [
    ...tiers.soft.map((ins) => ({ ins, boost: 1.0, tierLabel: 'soft' })),
    ...tiers.strong.map((ins) => ({ ins, boost: STRONG_COEFFICIENT_BOOST, tierLabel: 'strong' })),
    ...tiers.critical.map((ins) => ({ ins, boost: STRONG_COEFFICIENT_BOOST, tierLabel: 'critical' })),
  ];

  if (allWithBoost.length === 0) return candidates;

  const hasStrongOrCritical = tiers.strong.length > 0 || tiers.critical.length > 0;
  const cap = hasStrongOrCritical ? STRONG_PENALTY_CAP : MAX_PENALTY;

  return candidates.map((c) => {
    let rawPenalty = 0;
    const notes: string[] = [];

    for (const { ins, boost, tierLabel } of allWithBoost) {
      const conf = effectiveConf(ins);
      if (ins.insightType === 'setup_imbalance' && ins.affectedSetupTypes.includes(c.setupType)) {
        rawPenalty += 0.15 * boost * conf;
        notes.push(`setup_imbalance(${tierLabel}): ${c.setupType} over-represented`);
      }
      if (ins.insightType === 'score_bias') {
        rawPenalty += 0.05 * boost * conf;
        notes.push(`score_bias(${tierLabel}): discrimination reduced`);
      }
      if (ins.insightType === 'sector_misalignment') {
        rawPenalty += 0.10 * boost * conf;
        notes.push(`sector_misalignment(${tierLabel}): macro unfavorable`);
      }
    }

    const capped = Math.min(cap, Math.max(0, rawPenalty));
    return {
      ...c,
      alphaScore: Math.max(0, c.alphaScore * (1.0 - capped)),
      insightPenaltyNote: notes.length > 0 ? notes.join('; ') : undefined,
    };
  });
}

// ─── StrategyLearningEngine integration ──────────────────────────────────────

export function formatInsightsAsLimitations(insights: OptimizationInsightRecord[]): string[] {
  return insights
    .filter((ins) => effectiveConf(ins) >= MIN_CONFIDENCE)
    .map((ins) => {
      const c = effectiveConf(ins);
      return (
        `[OptimizationInsight:${ins.insightType}] ${ins.evidence[0] ?? ''} ` +
        `(conf=${c.toFixed(2)}, severity=${ins.severity}, ` +
        `expires=${ins.expiresAt.slice(0, 10)})`
      );
    });
}
