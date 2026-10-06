/**
 * TrainingMiner.ts
 *
 * Mines training tasks from all configured sources across the 4 scheduling layers.
 *
 * Safety invariants (NEVER relaxed):
 *   - Tasks MUST NOT auto-change trading thresholds
 *   - Tasks MUST NOT bypass risk engine rejection floor
 *   - Tasks MUST NOT allow 0-strategy trading state
 *   - Tasks MUST NOT create unlimited insight stacking
 *   - Tasks MUST NOT exceed global influence cap (25% base)
 *   - Daily quota enforced: HIGH ≤ 1/day, MEDIUM ≤ 3/day, LOW ≤ 5/day
 *   - dedupeKey TTL = 14 days (no duplicate tasks)
 *   - estimatedDurationHours must be 4–8
 *   - acceptanceCriteria must be non-empty
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  TrainingInsightCandidate,
  TrainingMinerQuota,
  TrainingMinerState,
  TrainingRiskLevel,
  TrainingSourceType,
  TrainingTask,
} from './TrainingSchedulerTypes';
import { TRAINING_QUOTA_MAX } from './TrainingSchedulerTypes';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEDUPE_TTL_DAYS = 14;
const MIN_DURATION_H = 4;
const MAX_DURATION_H = 8;
const MINER_STATE_PATH = path.join(process.cwd(), 'runtime', 'training_miner_state.json');

// SAFETY: these strings are forbidden from every task's acceptanceCriteria and objective
const FORBIDDEN_CHANGE_BASELINE: readonly string[] = [
  'stop-loss thresholds',
  'profit-target thresholds',
  'minimum position sizing',
  'risk engine rejection floor',
  'guardrail confidence floor (0.6)',
  'global influence cap (25%)',
  'strategy selection logic',
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

async function fileExists(p: string): Promise<boolean> {
  return fs.access(p).then(() => true).catch(() => false);
}

async function readJson<T>(p: string): Promise<T> {
  const raw = await fs.readFile(p, 'utf-8');
  return JSON.parse(raw) as T;
}

async function writeJson(p: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Miner State ──────────────────────────────────────────────────────────────

async function loadMinerState(): Promise<TrainingMinerState> {
  if (await fileExists(MINER_STATE_PATH)) {
    return readJson<TrainingMinerState>(MINER_STATE_PATH).catch(() => freshMinerState());
  }
  return freshMinerState();
}

async function saveMinerState(state: TrainingMinerState): Promise<void> {
  await writeJson(MINER_STATE_PATH, state);
}

function freshMinerState(): TrainingMinerState {
  return {
    version: '1.0',
    publishedDedupeKeys: {},
    dailyQuota: { date: todayIso(), low: 0, medium: 0, high: 0 },
    lastRunAt: null,
    probeActivity: {
      totalProbeAttempts: 0,
      allowedProbes: 0,
      deniedProbes: 0,
      lastProbeAt: null,
    },
    recoveryEvents: {
      totalExpiredGates: 0,
      totalDowngrades: 0,
      totalDiversityRescues: 0,
      lastRecoveryAt: null,
    },
  };
}

function resetQuotaIfStale(state: TrainingMinerState): TrainingMinerState {
  if (state.dailyQuota.date !== todayIso()) {
    return {
      ...state,
      dailyQuota: { date: todayIso(), low: 0, medium: 0, high: 0 },
    };
  }
  return state;
}

function isDedupeExpired(publishedAt: string): boolean {
  const published = Date.parse(publishedAt);
  if (!Number.isFinite(published)) return true;
  const ageMs = Date.now() - published;
  return ageMs > DEDUPE_TTL_DAYS * 24 * 60 * 60 * 1000;
}

function pruneExpiredDedupeKeys(state: TrainingMinerState): TrainingMinerState {
  const pruned: Record<string, string> = {};
  for (const [key, val] of Object.entries(state.publishedDedupeKeys)) {
    if (!isDedupeExpired(val)) pruned[key] = val;
  }
  return { ...state, publishedDedupeKeys: pruned };
}

function quotaRemaining(quota: TrainingMinerQuota): Record<TrainingRiskLevel, number> {
  return {
    low: Math.max(0, TRAINING_QUOTA_MAX.low - quota.low),
    medium: Math.max(0, TRAINING_QUOTA_MAX.medium - quota.medium),
    high: Math.max(0, TRAINING_QUOTA_MAX.high - quota.high),
  };
}

function canPublish(risk: TrainingRiskLevel, quota: TrainingMinerQuota): boolean {
  return quotaRemaining(quota)[risk] > 0;
}

function consumeQuota(state: TrainingMinerState, risk: TrainingRiskLevel): TrainingMinerState {
  return {
    ...state,
    dailyQuota: {
      ...state.dailyQuota,
      [risk]: state.dailyQuota[risk] + 1,
    },
  };
}

// ─── Task builder helpers ─────────────────────────────────────────────────────

function buildTask(
  source: TrainingSourceType,
  dedupeKey: string,
  title: string,
  risk: TrainingRiskLevel,
  estimatedDurationHours: number,
  acceptanceCriteria: string[],
  outputPaths: string[],
  extraForbidden: string[] = [],
): TrainingTask {
  return {
    dedupeKey,
    title,
    axis: source.startsWith('trigger_score') || source.startsWith('mfe_mae') || source.startsWith('setup_performance') || source === 'time_exit_dominance' || source === 'sector_alignment' || source === 'volatility_stop_validation'
      ? 'strategy'
      : source.startsWith('data') || source === 'indicator_coverage_check' || source === 'data_freshness_audit' || source === 'price_analysis_quality'
        ? 'data'
        : 'system',
    source,
    layer: source === 'lifecycle_stuck_detection' || source === 'data_freshness_audit'
      ? 'intraday_monitor'
      : source === 'time_exit_dominance'
        ? 'daily_cycle'
        : source === 'trigger_score_vs_return' || source === 'mfe_mae_distribution' || source === 'setup_performance_breakdown' || source === 'sector_alignment' || source === 'volatility_stop_validation'
          ? 'weekly_deep'
          : 'nightly_opt',
    estimatedDurationHours: Math.min(MAX_DURATION_H, Math.max(MIN_DURATION_H, estimatedDurationHours)),
    risk,
    acceptanceCriteria,
    outputPaths,
    forbiddenChanges: [...FORBIDDEN_CHANGE_BASELINE, ...extraForbidden],
    createdAt: nowIso(),
    quotaDate: todayIso(),
  };
}

// ─── Source candidates ────────────────────────────────────────────────────────
// Each source returns 0 or 1 candidate task.  Pure, stateless — no I/O.

function mineTriggerScoreVsReturn(): TrainingTask {
  return buildTask(
    'trigger_score_vs_return',
    'weekly_deep__trigger_score_vs_return',
    'Taiwan Stock TriggerScore vs Forward-Return Correlation Analysis',
    'medium',
    6,
    [
      'Compute Spearman correlation between triggerScore and 5-day forward return for all closed SimulatedTrades (min 50)',
      'Produce p-value < 0.05 or declare "insufficient predictiveness" — no threshold change',
      'Segment by setupType (trend / rebound) and market regime',
      'Output JSON report: correlation, p-value, sample size, regime breakdown',
    ],
    ['runtime/training_reports/trigger_score_vs_return.json'],
    ['triggerScore weights', 'score calibration formula'],
  );
}

function mineMfeMaeDistribution(): TrainingTask {
  return buildTask(
    'mfe_mae_distribution',
    'weekly_deep__mfe_mae_distribution',
    'MFE/MAE Distribution Analysis by SetupType',
    'medium',
    5,
    [
      'Compute MFE/MAE percentile distribution (P10, P25, P50, P75, P90) per setupType',
      'Flag if MFE/MAE ratio < 1.5 in any setupType (insight candidate)',
      'Compute correlation between MAE and stop-loss hit rate',
      'Output JSON report with percentile tables and flag reasons',
    ],
    ['runtime/training_reports/mfe_mae_distribution.json'],
    ['stop-loss levels', 'take-profit targets'],
  );
}

function mineSetupPerformanceBreakdown(): TrainingTask {
  return buildTask(
    'setup_performance_breakdown',
    'weekly_deep__setup_performance_breakdown',
    'SetupType P&L Performance Deep-Dive (TW Stocks)',
    'low',
    4,
    [
      'Compute win rate, avg PnL%, Sharpe-proxy for each setupType',
      'Compare performance across market regimes (trending / recovery / 震盪 / defensive)',
      'Flag setups with win rate < 40% over last 30 trades (insight candidate: setup_imbalance)',
      'Output JSON report with per-setup metrics and regime cross-tabs',
    ],
    ['runtime/training_reports/setup_performance_breakdown.json'],
  );
}

function mineTimeExitDominance(): TrainingTask {
  return buildTask(
    'time_exit_dominance',
    'daily_cycle__time_exit_dominance',
    'Time-Exit Dominance Analysis — Daily Pulse',
    'low',
    4,
    [
      'Count time-exit rate over last 20 TradeReviewReport rows',
      'Flag if rate > 40% as insight candidate (time_exit_dominance)',
      'Break down by setupType and holdingDays bucket',
      'Output JSON report: time-exit rate, by-setup breakdown, flag status',
    ],
    ['runtime/training_reports/time_exit_dominance.json'],
  );
}

function mineSectorAlignment(): TrainingTask {
  return buildTask(
    'sector_alignment',
    'weekly_deep__sector_alignment',
    'TWSE Sector Alignment vs Strategy Proposals',
    'low',
    4,
    [
      'Cross-reference sectorStrength from AutonomousResearchSnapshot with open/proposed trades',
      'Flag proposals in sectors classified as "weak" by sector scanner (insight candidate: sector_misalignment)',
      'Compute alignment rate (%proposals in strong sectors) per market regime',
      'Output JSON report: alignment rates, flagged proposals, sector-regime breakdown',
    ],
    ['runtime/training_reports/sector_alignment.json'],
  );
}

function mineVolatilityStopValidation(): TrainingTask {
  return buildTask(
    'volatility_stop_validation',
    'weekly_deep__volatility_stop_validation',
    'Volatility-Adjusted Stop/Target Calibration Audit',
    'medium',
    6,
    [
      'Compute 20-day ATR for all TWSE stocks in SimulatedTrade history',
      'Compare stop-loss pct to 1× ATR — flag setups where stop < 0.8 ATR (too tight) or > 2.5 ATR (too wide)',
      'Compute expected slippage model accuracy vs actual fill prices',
      'Output JSON report: per-symbol ATR vs stop ratios, flag list, slippage errors',
    ],
    ['runtime/training_reports/volatility_stop_validation.json'],
    ['ATR multiplier constants', 'slippage model parameters'],
  );
}

function mineDataFreshnessAudit(): TrainingTask {
  return buildTask(
    'data_freshness_audit',
    'intraday__data_freshness_audit',
    'Quote Freshness Audit — Intraday',
    'low',
    4,
    [
      'Check all Stock rows for latestDate lag > 2 trading days (insight candidate: data_quality_issue)',
      'Count symbols with < 250 bars of quote history (insight candidate: indicator_insufficient)',
      'Output JSON report: stale count, insufficient count, symbol lists',
    ],
    ['runtime/training_reports/data_freshness_audit.json'],
  );
}

function mineIndicatorCoverageCheck(): TrainingTask {
  return buildTask(
    'indicator_coverage_check',
    'nightly_opt__indicator_coverage_check',
    'Indicator History Depth Check — Nightly',
    'low',
    4,
    [
      'Query StockQuote row counts per symbol',
      'Flag symbols with < 250 rows (insight: indicator_insufficient)',
      'Flag symbols with data gaps > 5 trading days',
      'Output JSON report: coverage map, gap list, flag count',
    ],
    ['runtime/training_reports/indicator_coverage_check.json'],
  );
}

function mineLifecycleStuckDetection(): TrainingTask {
  return buildTask(
    'lifecycle_stuck_detection',
    'intraday__lifecycle_stuck_detection',
    'Open-Trade Lifecycle Stuck Detection',
    'low',
    4,
    [
      'Identify open/shadow-open SimulatedTrade rows where holdingDays > defined max for their setupType',
      'Identify trades with status mismatch (open but missing in AutonomousResearchSnapshot)',
      'Output JSON: stuck trade ids, reason, recommended action (review only — no auto-close)',
    ],
    ['runtime/training_reports/lifecycle_stuck_detection.json'],
    ['auto-close trades without review'],
  );
}

function mineExecutionLayerAudit(): TrainingTask {
  return buildTask(
    'execution_layer_audit',
    'nightly_opt__execution_layer_audit',
    'Execution Layer Code Quality Audit',
    'low',
    5,
    [
      'Review TriggerScoringEngine, DecisionLayerEngine, StrategyLearningEngine for stale constants',
      'Verify probe logic paths and gate-recovery paths are reachable',
      'Flag any dead code paths or unreachable branches',
      'Output markdown report with findings and recommendations (no code changes)',
    ],
    ['runtime/training_reports/execution_layer_audit.md'],
    ['engine source code', 'guardrail constants'],
  );
}

function mineLearningLayerAudit(): TrainingTask {
  return buildTask(
    'learning_layer_audit',
    'nightly_opt__learning_layer_audit',
    'Learning Layer Signal Quality Audit',
    'low',
    4,
    [
      'Verify StrategyLearningInsight signal distribution (no single signal > 80% of recent insights)',
      'Check insight persistence rate (insights used before expiry)',
      'Flag if probe signal rate < 10% of total recovery events',
      'Output JSON report: signal distribution, persistence rate, flags',
    ],
    ['runtime/training_reports/learning_layer_audit.json'],
  );
}

function minePriceAnalysisQuality(): TrainingTask {
  return buildTask(
    'price_analysis_quality',
    'nightly_opt__price_analysis_quality',
    'Price Analysis & Research Snapshot Quality Review',
    'low',
    4,
    [
      'Review last 7 AutonomousResearchSnapshot rows for data coverage flags',
      'Count snapshots with overallCoverage = "insufficient" (flag if > 30%)',
      'Verify sectorStrength populated in all snapshots',
      'Output JSON report: coverage histogram, flag rate, empty-sector count',
    ],
    ['runtime/training_reports/price_analysis_quality.json'],
  );
}

function mineSystemHealth(): TrainingTask {
  return buildTask(
    'system_health',
    'nightly_opt__system_health',
    'System Health & Job Runner Audit',
    'low',
    4,
    [
      'Query JobRunLog for failed/skipped runs in last 48 hours',
      'Compute success rate per job name',
      'Flag any job with > 2 consecutive failures',
      'Output JSON report: success rates, failure streaks, alert list',
    ],
    ['runtime/training_reports/system_health.json'],
  );
}

function mineCodeQuality(): TrainingTask {
  return buildTask(
    'code_quality',
    'nightly_opt__code_quality',
    'TypeScript Code Quality & Coverage Audit',
    'low',
    4,
    [
      'Run TypeScript type-check on src/lib/autonomous/** and report errors',
      'Review test coverage for GateRecoveryEngine, TriggerScoringEngine, DecisionLayerEngine, StrategyLearningEngine',
      'Flag any untested exported functions',
      'Output JSON report: type errors, coverage gaps, untested exports',
    ],
    ['runtime/training_reports/code_quality.json'],
    ['auto-apply code changes', 'modify test files'],
  );
}

function mineUiUx(): TrainingTask {
  return buildTask(
    'ui_ux',
    'nightly_opt__ui_ux',
    'Autonomous Dashboard UI/UX Review',
    'low',
    4,
    [
      'Identify any scheduler-status data visible in dashboard that is stale or missing',
      'Check gate/probe/recovery status display accuracy',
      'Flag missing metrics in dashboard (compare to TrainingSchedulerStatus fields)',
      'Output markdown report: gaps, recommended additions (no UI code changes)',
    ],
    ['runtime/training_reports/ui_ux.md'],
  );
}

function mineWikiDocs(): TrainingTask {
  return buildTask(
    'wiki_docs',
    'nightly_opt__wiki_docs',
    'Wiki & Documentation Coverage Audit',
    'low',
    4,
    [
      'Check docs/ and wiki/ for coverage of: GateRecoveryEngine, TrainingScheduler, InsightIntegrationLayer',
      'Flag any exported function with no corresponding documentation',
      'Output JSON report: coverage map, gap list',
    ],
    ['runtime/training_reports/wiki_docs.json'],
    ['auto-update wiki files'],
  );
}

// ─── All source miners (indexed) ─────────────────────────────────────────────

const ALL_SOURCE_MINERS: Array<() => TrainingTask> = [
  mineTriggerScoreVsReturn,
  mineMfeMaeDistribution,
  mineSetupPerformanceBreakdown,
  mineTimeExitDominance,
  mineSectorAlignment,
  mineVolatilityStopValidation,
  mineDataFreshnessAudit,
  mineIndicatorCoverageCheck,
  mineLifecycleStuckDetection,
  mineExecutionLayerAudit,
  mineLearningLayerAudit,
  minePriceAnalysisQuality,
  mineSystemHealth,
  mineCodeQuality,
  mineUiUx,
  mineWikiDocs,
];

// ─── Public API ───────────────────────────────────────────────────────────────

export interface MinerOptions {
  /** Filter to only tasks for a specific layer. */
  layers?: TrainingTask['layer'][];
  /** Dry-run: return candidates without persisting state. */
  dryRun?: boolean;
}

export interface MinerResult {
  tasks: TrainingTask[];
  skipped: Array<{ dedupeKey: string; reason: 'already_published' | 'quota_exceeded' | 'not_in_layer' }>;
  quotaRemaining: Record<TrainingRiskLevel, number>;
}

/**
 * Run the training miner: generate all eligible tasks respecting deduplication,
 * quota limits, and layer filters.
 *
 * Does NOT execute tasks — returns candidates for the scheduler layers to dispatch.
 */
export async function runTrainingMiner(opts: MinerOptions = {}): Promise<MinerResult> {
  let state = await loadMinerState();
  state = resetQuotaIfStale(state);
  state = pruneExpiredDedupeKeys(state);

  const { layers, dryRun = false } = opts;
  const accepted: TrainingTask[] = [];
  const skipped: MinerResult['skipped'] = [];

  for (const miner of ALL_SOURCE_MINERS) {
    const candidate = miner();

    // Layer filter
    if (layers && !layers.includes(candidate.layer)) {
      skipped.push({ dedupeKey: candidate.dedupeKey, reason: 'not_in_layer' });
      continue;
    }

    // Dedupe check
    const prev = state.publishedDedupeKeys[candidate.dedupeKey];
    if (prev && !isDedupeExpired(prev)) {
      skipped.push({ dedupeKey: candidate.dedupeKey, reason: 'already_published' });
      continue;
    }

    // Quota check
    if (!canPublish(candidate.risk, state.dailyQuota)) {
      skipped.push({ dedupeKey: candidate.dedupeKey, reason: 'quota_exceeded' });
      continue;
    }

    // SAFETY: validate no forbidden content in acceptance criteria
    assertNoForbiddenContent(candidate);

    accepted.push(candidate);

    if (!dryRun) {
      state = consumeQuota(state, candidate.risk);
      state = {
        ...state,
        publishedDedupeKeys: {
          ...state.publishedDedupeKeys,
          [candidate.dedupeKey]: nowIso(),
        },
      };
    }
  }

  if (!dryRun) {
    state = { ...state, lastRunAt: nowIso() };
    await saveMinerState(state);
  }

  return {
    tasks: accepted,
    skipped,
    quotaRemaining: quotaRemaining(state.dailyQuota),
  };
}

/**
 * Read current quota remaining without mutating state.
 */
export async function getQuotaRemaining(): Promise<Record<TrainingRiskLevel, number>> {
  const state = resetQuotaIfStale(await loadMinerState());
  return quotaRemaining(state.dailyQuota);
}

/**
 * Read probe/recovery summaries from persisted miner state.
 */
export async function getMinerActivitySummaries(): Promise<
  Pick<TrainingMinerState, 'probeActivity' | 'recoveryEvents'>
> {
  const state = await loadMinerState();
  return {
    probeActivity: state.probeActivity,
    recoveryEvents: state.recoveryEvents,
  };
}

/**
 * Record a probe attempt outcome (called by scheduler layer runners).
 */
export async function recordProbeAttempt(allowed: boolean): Promise<void> {
  let state = await loadMinerState();
  state = {
    ...state,
    probeActivity: {
      ...state.probeActivity,
      totalProbeAttempts: state.probeActivity.totalProbeAttempts + 1,
      allowedProbes: state.probeActivity.allowedProbes + (allowed ? 1 : 0),
      deniedProbes: state.probeActivity.deniedProbes + (allowed ? 0 : 1),
      lastProbeAt: nowIso(),
    },
  };
  await saveMinerState(state);
}

/**
 * Record a recovery event (called by scheduler layer runners).
 */
export async function recordRecoveryEvent(
  type: 'expired_gate' | 'downgrade' | 'diversity_rescue',
): Promise<void> {
  let state = await loadMinerState();
  state = {
    ...state,
    recoveryEvents: {
      ...state.recoveryEvents,
      totalExpiredGates: state.recoveryEvents.totalExpiredGates + (type === 'expired_gate' ? 1 : 0),
      totalDowngrades: state.recoveryEvents.totalDowngrades + (type === 'downgrade' ? 1 : 0),
      totalDiversityRescues: state.recoveryEvents.totalDiversityRescues + (type === 'diversity_rescue' ? 1 : 0),
      lastRecoveryAt: nowIso(),
    },
  };
  await saveMinerState(state);
}

// ─── Safety assertion ─────────────────────────────────────────────────────────

function assertNoForbiddenContent(task: TrainingTask): void {
  const forbidden = [
    'auto-change',
    'auto_change',
    'bypass risk',
    'bypass_risk',
    'disable guardrail',
    'remove gate',
    'unlimited insight',
    'override floor',
    'force trade',
  ];
  const allText = [
    task.title,
    ...task.acceptanceCriteria,
  ].join(' ').toLowerCase();

  for (const word of forbidden) {
    if (allText.includes(word)) {
      throw new Error(
        `SAFETY: task "${task.dedupeKey}" contains forbidden content: "${word}"`,
      );
    }
  }

  if (task.estimatedDurationHours < MIN_DURATION_H || task.estimatedDurationHours > MAX_DURATION_H) {
    throw new Error(
      `SAFETY: task "${task.dedupeKey}" estimatedDurationHours (${task.estimatedDurationHours}) must be ${MIN_DURATION_H}–${MAX_DURATION_H}`,
    );
  }

  if (task.acceptanceCriteria.length === 0) {
    throw new Error(`SAFETY: task "${task.dedupeKey}" has no acceptanceCriteria`);
  }
}
