/**
 * TriggerScoringEngine — Soft trigger scoring replaces hard boolean gating.
 *
 * Instead of shouldTriggerProposal() returning true/false,
 * scoreTriggerReadiness() returns a 0.0–1.0 score with component breakdown.
 *
 * Tiered entry based on score:
 *   < 0.3           → approved (no action)
 *   0.3 – 0.59      → shadow  (paper trade, tighter thresholds, review at ±3%)
 *   0.6 – 0.79      → pending (half-size trade, review at ±5%)
 *   ≥ 0.8           → triggered (full trade, existing behavior)
 *
 * Bootstrap mode: when system has 0 closed trades, thresholds shift down by 0.2.
 */

import type { AutonomousResearchSnapshot, StrategyProposal } from './types';
import {
  computeTriggerScoreInsightMultiplier,
  computeTieredScoreMultiplier,
  type OptimizationInsightRecord,
} from './InsightIntegrationLayer';
import { runTieredGuardrail } from './InsightGuardrailLayer';
import { shouldProbe, PROBE_SIZING_MULTIPLIER } from './GateRecoveryEngine';

// ─── Types ───────────────────────────────────────────────────────

export interface TriggerScoreComponent {
  name: string;
  score: number;
  maxScore: number;
  met: boolean;
  detail: string;
}

export interface TriggerScore {
  /** Final score after regime multiplier, 0.0–1.0 */
  finalScore: number;
  /** Raw sum of components before regime multiplier */
  rawScore: number;
  /** Regime multiplier applied */
  regimeMultiplier: number;
  /** Individual component breakdown */
  components: TriggerScoreComponent[];
  /** Derived trade mode */
  tradeMode: 'none' | 'shadow' | 'pending' | 'full';
  /** Whether bootstrap mode lowered thresholds */
  bootstrapActive: boolean;
  /** True when a critical-tier insight hard-gated this setup. */
  gated?: boolean;
  /** Human-readable gate reason when gated = true. */
  gatingReason?: string;
  /** True when this trade bypassed a gate as a shadow probe. */
  isProbe?: boolean;
  /** Audit tag identifying this probe attempt, e.g. 'probe:trend:AAPL:2024-01-15'. */
  probeTag?: string;
  /** Position sizing multiplier from insight tier analysis (0.5 when strong insights present). */
  insightSizingMultiplier?: number;
}

export interface QuoteRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
}

// ─── Thresholds ──────────────────────────────────────────────────

const NORMAL_THRESHOLDS = { shadow: 0.3, pending: 0.6, triggered: 0.8 };
const BOOTSTRAP_THRESHOLDS = { shadow: 0.1, pending: 0.4, triggered: 0.6 };

// ─── Helpers ─────────────────────────────────────────────────────

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

function recentReturn(quotes: QuoteRow[], days: number): number {
  if (quotes.length <= days) return 0;
  const latest = quotes[quotes.length - 1].close;
  const prev = quotes[quotes.length - 1 - days].close;
  return prev === 0 ? 0 : (latest - prev) / prev;
}

function movingAverage(quotes: QuoteRow[], period: number): number | null {
  if (quotes.length < period) return null;
  return average(quotes.slice(-period).map((q) => q.close));
}

function averageVolume(quotes: QuoteRow[], period: number): number {
  if (quotes.length < period) return 0;
  return average(quotes.slice(-period).map((q) => q.volume));
}

// ─── Regime Multiplier ──────────────────────────────────────────

function regimeScoringMultiplier(marketState: AutonomousResearchSnapshot['marketState']): number {
  if (marketState === 'trending') return 1.0;
  if (marketState === 'recovery') return 0.9;
  if (marketState === '震盪') return 0.8;
  // defensive — softer than the old hard block (was 0.35 for risk; here 0.65 for trigger)
  return 0.65;
}

// ─── Setup-Specific Scoring ─────────────────────────────────────

function scoreTrend(
  quotes: QuoteRow[],
  snapshot: AutonomousResearchSnapshot,
): TriggerScoreComponent[] {
  const components: TriggerScoreComponent[] = [];
  const ma20 = movingAverage(quotes, 20);
  const latest = quotes[quotes.length - 1];
  const ret5 = recentReturn(quotes, 5);
  const ret10 = recentReturn(quotes, 10);
  const avgVol10 = averageVolume(quotes, 10);

  const aboveMa = ma20 != null && latest.close > ma20;
  components.push({
    name: 'price_above_ma20',
    score: aboveMa ? 0.3 : (ma20 != null && latest.close > ma20 * 0.97 ? 0.1 : 0),
    maxScore: 0.3,
    met: aboveMa,
    detail: `close=${latest.close.toFixed(1)} ma20=${ma20?.toFixed(1) ?? 'N/A'}`,
  });

  const ret5Positive = ret5 > 0;
  components.push({
    name: 'ret5_positive',
    score: ret5Positive ? 0.25 : (ret5 > -0.02 ? 0.08 : 0),
    maxScore: 0.25,
    met: ret5Positive,
    detail: `ret5=${(ret5 * 100).toFixed(2)}%`,
  });

  const notDefensive = snapshot.marketState !== 'defensive';
  components.push({
    name: 'market_not_defensive',
    score: notDefensive ? 0.25 : 0.05,
    maxScore: 0.25,
    met: notDefensive,
    detail: `marketState=${snapshot.marketState}`,
  });

  const volumeUp = latest.volume > avgVol10 * 1.05;
  components.push({
    name: 'volume_confirmation',
    score: volumeUp ? 0.1 : 0,
    maxScore: 0.1,
    met: volumeUp,
    detail: `vol=${latest.volume} avgVol10=${avgVol10.toFixed(0)}`,
  });

  const ret10Positive = ret10 > 0;
  components.push({
    name: 'ret10_positive',
    score: ret10Positive ? 0.1 : 0,
    maxScore: 0.1,
    met: ret10Positive,
    detail: `ret10=${(ret10 * 100).toFixed(2)}%`,
  });

  return components;
}

function scoreRebound(
  quotes: QuoteRow[],
  _snapshot: AutonomousResearchSnapshot,
): TriggerScoreComponent[] {
  const components: TriggerScoreComponent[] = [];
  const ma20 = movingAverage(quotes, 20);
  const latest = quotes[quotes.length - 1];
  const ret10 = recentReturn(quotes, 10);
  const low5 = Math.min(...quotes.slice(-5).map((q) => q.low));

  // Bounce from low — tiered scoring
  const aboveLowStrict = latest.close > low5 * 1.01;
  const aboveLowRelaxed = latest.close > low5 * 1.005;
  components.push({
    name: 'bounce_from_low',
    score: aboveLowStrict ? 0.3 : (aboveLowRelaxed ? 0.15 : 0),
    maxScore: 0.3,
    met: aboveLowStrict,
    detail: `close=${latest.close.toFixed(1)} low5=${low5.toFixed(1)} strict=${aboveLowStrict} relaxed=${aboveLowRelaxed}`,
  });

  // Not overextended above MA
  const belowMaCap = ma20 != null && latest.close < ma20 * 1.08;
  const belowMaWider = ma20 != null && latest.close < ma20 * 1.12;
  components.push({
    name: 'below_ma_cap',
    score: belowMaCap ? 0.25 : (belowMaWider ? 0.1 : 0),
    maxScore: 0.25,
    met: belowMaCap,
    detail: `close=${latest.close.toFixed(1)} ma20×1.08=${ma20 != null ? (ma20 * 1.08).toFixed(1) : 'N/A'}`,
  });

  // Recent drawdown not too deep
  const ret10Contained = ret10 < 0.05;
  const ret10Moderate = ret10 < 0.08;
  components.push({
    name: 'drawdown_contained',
    score: ret10Contained ? 0.25 : (ret10Moderate ? 0.1 : 0),
    maxScore: 0.25,
    met: ret10Contained,
    detail: `ret10=${(ret10 * 100).toFixed(2)}%`,
  });

  // Volume showing recovery interest
  const avgVol10 = averageVolume(quotes, 10);
  const volRecovery = latest.volume > avgVol10 * 0.8;
  components.push({
    name: 'volume_recovery',
    score: volRecovery ? 0.2 : 0,
    maxScore: 0.2,
    met: volRecovery,
    detail: `vol=${latest.volume} avgVol10=${avgVol10.toFixed(0)}`,
  });

  return components;
}

function scoreEvent(
  quotes: QuoteRow[],
  snapshot: AutonomousResearchSnapshot,
): TriggerScoreComponent[] {
  const components: TriggerScoreComponent[] = [];
  const ret5 = recentReturn(quotes, 5);

  const hasSignals = snapshot.riskSignals.length > 0;
  components.push({
    name: 'risk_signals_present',
    score: hasSignals ? 0.35 : 0,
    maxScore: 0.35,
    met: hasSignals,
    detail: `signalCount=${snapshot.riskSignals.length}`,
  });

  const notDefensive = snapshot.marketState !== 'defensive';
  components.push({
    name: 'market_not_defensive',
    score: notDefensive ? 0.25 : 0.05,
    maxScore: 0.25,
    met: notDefensive,
    detail: `marketState=${snapshot.marketState}`,
  });

  const notCrashing = ret5 > -0.05;
  components.push({
    name: 'not_deeply_negative',
    score: notCrashing ? 0.2 : 0,
    maxScore: 0.2,
    met: notCrashing,
    detail: `ret5=${(ret5 * 100).toFixed(2)}%`,
  });

  const goodCoverage = snapshot.dataCoverage === 'full' || snapshot.dataCoverage === 'limited';
  components.push({
    name: 'data_coverage',
    score: goodCoverage ? 0.2 : 0,
    maxScore: 0.2,
    met: goodCoverage,
    detail: `coverage=${snapshot.dataCoverage}`,
  });

  return components;
}

function scoreFundamental(
  quotes: QuoteRow[],
  snapshot: AutonomousResearchSnapshot,
  proposal: StrategyProposal,
): TriggerScoreComponent[] {
  const components: TriggerScoreComponent[] = [];
  const ma20 = movingAverage(quotes, 20);
  const latest = quotes[quotes.length - 1];
  const ret5 = recentReturn(quotes, 5);

  const ret5Positive = ret5 > 0;
  components.push({
    name: 'ret5_positive',
    score: ret5Positive ? 0.3 : (ret5 > -0.02 ? 0.1 : 0),
    maxScore: 0.3,
    met: ret5Positive,
    detail: `ret5=${(ret5 * 100).toFixed(2)}%`,
  });

  const aboveMa = ma20 != null && latest.close > ma20 * 0.95;
  components.push({
    name: 'price_near_ma20',
    score: aboveMa ? 0.3 : 0,
    maxScore: 0.3,
    met: aboveMa,
    detail: `close=${latest.close.toFixed(1)} ma20×0.95=${ma20 != null ? (ma20 * 0.95).toFixed(1) : 'N/A'}`,
  });

  const goodCoverage = snapshot.dataCoverage === 'full';
  components.push({
    name: 'data_coverage_full',
    score: goodCoverage ? 0.2 : (snapshot.dataCoverage === 'limited' ? 0.1 : 0),
    maxScore: 0.2,
    met: goodCoverage,
    detail: `coverage=${snapshot.dataCoverage}`,
  });

  const highConviction = proposal.conviction === 'high';
  components.push({
    name: 'high_conviction',
    score: highConviction ? 0.2 : (proposal.conviction === 'mid' ? 0.1 : 0),
    maxScore: 0.2,
    met: highConviction,
    detail: `conviction=${proposal.conviction}`,
  });

  return components;
}

// ─── Main Scoring Function ──────────────────────────────────────

export function scoreTriggerReadiness(
  proposal: StrategyProposal,
  quotes: QuoteRow[],
  snapshot: AutonomousResearchSnapshot,
  options?: { bootstrapMode?: boolean; insights?: OptimizationInsightRecord[] },
): TriggerScore {
  if (quotes.length < 20) {
    return {
      finalScore: 0,
      rawScore: 0,
      regimeMultiplier: 0,
      components: [],
      tradeMode: 'none',
      bootstrapActive: false,
    };
  }

  let components: TriggerScoreComponent[];
  switch (proposal.setupType) {
    case 'trend':
      components = scoreTrend(quotes, snapshot);
      break;
    case 'rebound':
      components = scoreRebound(quotes, snapshot);
      break;
    case 'event':
      components = scoreEvent(quotes, snapshot);
      break;
    case 'fundamental':
      components = scoreFundamental(quotes, snapshot, proposal);
      break;
    default:
      components = scoreFundamental(quotes, snapshot, proposal);
  }

  const rawScore = Math.min(1, components.reduce((sum, c) => sum + c.score, 0));
  const regimeMul = regimeScoringMultiplier(snapshot.marketState);
  const finalScore = Math.min(1, rawScore * regimeMul);

  const bootstrap = options?.bootstrapMode ?? false;
  const thresholds = bootstrap ? BOOTSTRAP_THRESHOLDS : NORMAL_THRESHOLDS;

  let tradeMode: TriggerScore['tradeMode'] = 'none';
  if (finalScore >= thresholds.triggered) {
    tradeMode = 'full';
  } else if (finalScore >= thresholds.pending) {
    tradeMode = 'pending';
  } else if (finalScore >= thresholds.shadow) {
    tradeMode = 'shadow';
  }

  // Run tiered guardrail: filters insights + classifies into soft/strong/critical
  const now = new Date();
  const tieredResult = runTieredGuardrail(options?.insights ?? [], {
    currentRegime: snapshot.marketState,
    symbol: proposal.symbol,
    setupType: proposal.setupType,
    callerLabel: 'TriggerScoring',
  });

  // Hard gate: critical-tier insight blocks this setup entirely
  const gate = tieredResult.gatingDecisions.find(
    (g) => g.gatedSetupType === undefined || g.gatedSetupType === proposal.setupType,
  );
  if (gate) {
    // Probe mode: deterministically allow a fraction of gated setups through as shadow probes
    const probeDecision = shouldProbe(
      gate,
      { symbol: proposal.symbol, dateStr: now.toISOString().slice(0, 10) },
      now,
    );
    if (probeDecision.allowed) {
      return {
        finalScore: Math.min(1, finalScore * PROBE_SIZING_MULTIPLIER),
        rawScore,
        regimeMultiplier: regimeMul,
        components: [
          ...components,
          {
            name: 'probe_bypass',
            score: finalScore * (PROBE_SIZING_MULTIPLIER - 1),
            maxScore: 0,
            met: true,
            detail: `[PROBE] ${probeDecision.reason} tag=${probeDecision.probeTag}`,
          },
        ],
        tradeMode: 'shadow',
        bootstrapActive: bootstrap,
        gated: false,
        isProbe: true,
        probeTag: probeDecision.probeTag,
        insightSizingMultiplier: PROBE_SIZING_MULTIPLIER,
      };
    }
    return {
      finalScore: 0,
      rawScore,
      regimeMultiplier: regimeMul,
      components: [
        ...components,
        {
          name: 'insight_gate',
          score: -finalScore,
          maxScore: 0,
          met: false,
          detail: gate.reason,
        },
      ],
      tradeMode: 'none',
      bootstrapActive: bootstrap,
      gated: true,
      gatingReason: gate.reason,
      insightSizingMultiplier: 0,
    };
  }

  const { multiplier, appliedInsights } = computeTieredScoreMultiplier(
    proposal.symbol,
    proposal.setupType,
    tieredResult.tiers,
  );

  const adjustedFinalScore = multiplier < 1.0 ? Math.min(1, finalScore * multiplier) : finalScore;
  const adjustedRawScore = multiplier < 1.0 ? Math.min(1, rawScore * multiplier) : rawScore;

  let adjustedTradeMode = tradeMode;
  if (multiplier < 1.0) {
    if (adjustedFinalScore >= thresholds.triggered) adjustedTradeMode = 'full';
    else if (adjustedFinalScore >= thresholds.pending) adjustedTradeMode = 'pending';
    else if (adjustedFinalScore >= thresholds.shadow) adjustedTradeMode = 'shadow';
    else adjustedTradeMode = 'none';
  }

  const tierSummary = [
    tieredResult.tiers.soft.length > 0 ? `soft=${tieredResult.tiers.soft.length}` : null,
    tieredResult.tiers.strong.length > 0 ? `strong=${tieredResult.tiers.strong.length}` : null,
    tieredResult.tiers.critical.length > 0 ? `critical=${tieredResult.tiers.critical.length}` : null,
  ].filter(Boolean).join(',');

  const adjustedComponents =
    multiplier < 1.0
      ? [
          ...components,
          {
            name: 'insight_adjustment',
            score: adjustedFinalScore - finalScore,
            maxScore: 0,
            met: false,
            detail:
              `Multiplier=${multiplier.toFixed(3)} ` +
              `cap=${tieredResult.strongPenaltyCap.toFixed(2)} ` +
              `guardrail(${tieredResult.log.passedCount}/${tieredResult.log.totalInsights} passed` +
              `${tierSummary ? `, tiers: ${tierSummary}` : ''}) ` +
              `[${appliedInsights.join(', ')}]`,
          },
        ]
      : components;

  return {
    finalScore: adjustedFinalScore,
    rawScore: adjustedRawScore,
    regimeMultiplier: regimeMul,
    components: adjustedComponents,
    tradeMode: adjustedTradeMode,
    bootstrapActive: bootstrap,
    gated: false,
    insightSizingMultiplier: tieredResult.positionSizingMultiplier,
  };
}

// ─── Shadow Trade Thresholds ────────────────────────────────────

export function shadowSetupThresholds(setupType: StrategyProposal['setupType']) {
  // Shadow trades: tighter thresholds for faster feedback
  if (setupType === 'trend') return { target: 0.06, stop: -0.045, maxHoldDays: 9, reviewThreshold: 3 };
  if (setupType === 'rebound') return { target: 0.045, stop: -0.038, maxHoldDays: 6, reviewThreshold: 3 };
  if (setupType === 'event') return { target: 0.075, stop: -0.053, maxHoldDays: 7, reviewThreshold: 3 };
  return { target: 0.06, stop: -0.045, maxHoldDays: 12, reviewThreshold: 3 };
}

// ─── Sizing Multiplier by Trade Mode ────────────────────────────

export function tradeModePositionMultiplier(tradeMode: TriggerScore['tradeMode']): number {
  if (tradeMode === 'full') return 1.0;
  if (tradeMode === 'pending') return 0.5;
  if (tradeMode === 'shadow') return 0.3;
  return 0;
}
