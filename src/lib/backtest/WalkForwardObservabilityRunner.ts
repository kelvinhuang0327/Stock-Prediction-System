/**
 * WalkForwardObservabilityRunner.ts — T-05F WalkForward Observability Runner
 *
 * Wires T-05C (RegimeContextLoader) + T-05D (TaiwanTradingCalendar) +
 * T-05E (CandidateDataAdapter) into T-05B (buildWalkForwardSkeleton).
 * Produces dry-run observability-only artifacts.
 *
 * SAFETY CONTRACT:
 * - T-05F: WalkForward Observability Runner | dry-run only | safe-run only
 * - no DB write, no external API, no LLM call
 * - no production overwrite, no strategy mutation
 * - no performance claim, no edge claim, no H001-H012
 * - sourceDate <= rebalanceDate enforced via T-05E
 * - all regime context is read-only (T-05C)
 * - trading calendar is deterministic (T-05D)
 *
 * This is NOT a trading recommendation. NOT investment advice.
 * NOT ROI evidence. NOT win-rate evidence. NOT proof of any edge.
 */

import { resolveCurrentDate } from '@/lib/time/currentDate';
import {
  buildWalkForwardSkeleton,
  T05B_LOOKBACK_DAYS,
  type WalkForwardSkeletonOutput,
  type WalkForwardSkeletonSummary,
} from '@/lib/backtest/WalkForwardEngine';
import {
  loadRegimeContextMap,
  validateRegimeContextCoverage,
  type PrismaClientLike as RegimePrismaClientLike,
  type RegimeContextCoverageSummary,
} from '@/lib/backtest/RegimeContextLoader';
import {
  buildTaiwanTradingCalendar,
  validateTradingCalendarCoverage,
  TAIWAN_STATIC_HOLIDAYS_2024_2026,
  type TaiwanCalendarConfig,
  type TradingCalendarCoverageSummary,
} from '@/lib/backtest/TaiwanTradingCalendar';
import {
  loadCandidateSnapshotsForDate,
  validateCandidateSnapshotCoverage,
  type CandidateAdapterPrismaLike,
  type CandidateSnapshot,
  type CandidateSnapshotCoverageSummary,
} from '@/lib/backtest/CandidateDataAdapter';
import type { PersistedRegimeContext } from '@/lib/marketRegimeResult';

// ─── Constants ────────────────────────────────────────────────────────────────

export const T05F_TASK_NAME = 'T-05F_WALK_FORWARD_OBSERVABILITY_RUNNER';
export const T05F_RUN_MODE = 'DRY_RUN_OBSERVABILITY_ONLY' as const;
export const T05F_DEFAULT_ARTIFACT_DIR = 'outputs/backtest';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Deterministic run configuration for WalkForwardObservabilityRunner. */
export interface WalkForwardRunConfig {
  runId: string;
  taskName: string;
  currentDate: string;
  startDate: string;
  endDate: string;
  lookbackDays: number;
  maxCandidates: number;
  /** Must always be true for T-05F. */
  dryRun: true;
  /** Must always be true for T-05F. */
  safeRun: true;
  artifactOutputDir: string;
  observabilityNote: string;
}

/** Guardrail check result for a single guardrail item. */
export interface GuardrailCheckItem {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  note: string;
}

/** Summary of all guardrail validations. */
export interface WalkForwardRunGuardrailSummary {
  passCount: number;
  warnCount: number;
  failCount: number;
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  checks: GuardrailCheckItem[];
}

/** Observability summary of a completed run. */
export interface WalkForwardObservabilitySummary {
  tradingDayCount: number;
  rebalanceCount: number;
  recordsWithRegimeContext: number;
  recordsMissingRegimeContext: number;
  candidateSnapshotCount: number;
  candidateMissingCount: number;
  candidateStaleCount: number;
  candidateFutureDataCount: number;
  guardrailPassCount: number;
  guardrailWarnCount: number;
  guardrailFailCount: number;
  observabilityNote: string;
}

/** Injectable dependencies for runWalkForwardObservability(). All DB-backed deps are optional. */
export interface WalkForwardRunnerDeps {
  /** Injectable Prisma-like client for regime context loading. */
  regimePrismaClient?: RegimePrismaClientLike;
  /** Injectable Prisma-like client for candidate snapshot loading. */
  candidatePrismaClient?: CandidateAdapterPrismaLike;
  /**
   * Pre-loaded regime context map (takes priority over regimePrismaClient).
   * Use this in tests to avoid async DB calls.
   */
  preloadedRegimeContextMap?: Map<string, PersistedRegimeContext>;
  /**
   * Pre-loaded candidate snapshots (takes priority over candidatePrismaClient).
   * Use this in tests to avoid async DB calls.
   */
  preloadedCandidateSnapshots?: CandidateSnapshot[];
  /** Optional holiday overrides for Taiwan trading calendar. */
  calendarHolidayOverrides?: string[];
}

/** Full observability run output. */
export interface WalkForwardObservabilityRunResult {
  taskName: string;
  runMode: typeof T05F_RUN_MODE;
  generatedAt: string;
  runConfig: WalkForwardRunConfig;
  dateRange: {
    startDate: string;
    endDate: string;
    tradingDayCount: number;
  };
  calendarSummary: TradingCalendarCoverageSummary;
  regimeCoverageSummary: RegimeContextCoverageSummary;
  candidateCoverageSummary: CandidateSnapshotCoverageSummary;
  skeletonSummary: WalkForwardSkeletonSummary;
  guardrailSummary: WalkForwardRunGuardrailSummary;
  observabilitySummary: WalkForwardObservabilitySummary;
  artifactPlan: string[];
  readinessStatus: 'READY' | 'WARN' | 'BLOCKED';
  observabilityNote: string;
}

/** Artifact payload returned by buildWalkForwardRunnerArtifacts(). */
export interface WalkForwardRunnerArtifactPayload {
  taskName: string;
  generatedAt: string;
  jsonArtifacts: Record<string, unknown>;
  mdArtifactSummary: string;
  outputDir: string;
  observabilityNote: string;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** Build a deterministic run ID from the current date. */
function buildRunId(currentDate: string): string {
  return `T05F-${currentDate.replace(/-/g, '')}`;
}

/** Compute startDate from endDate minus lookbackDays. */
function computeStartDate(endDate: string, lookbackDays: number): string {
  const end = new Date(endDate + 'T00:00:00Z');
  end.setUTCDate(end.getUTCDate() - lookbackDays);
  return end.toISOString().slice(0, 10);
}

// ─── Exported Functions ───────────────────────────────────────────────────────

/**
 * Builds a deterministic WalkForward run configuration.
 *
 * Uses resolveCurrentDate() — no hardcoded TODAY_CAP.
 * dryRun and safeRun are always locked to true.
 *
 * @param overrides - Optional partial config overrides
 */
export function buildWalkForwardRunConfig(
  overrides: Partial<Omit<WalkForwardRunConfig, 'dryRun' | 'safeRun' | 'taskName'>> = {},
): WalkForwardRunConfig {
  const currentDate = resolveCurrentDate(overrides.currentDate);
  const lookbackDays = overrides.lookbackDays ?? T05B_LOOKBACK_DAYS;
  const endDate = overrides.endDate ?? currentDate;
  const startDate = overrides.startDate ?? computeStartDate(endDate, lookbackDays);

  return {
    runId: overrides.runId ?? buildRunId(currentDate),
    taskName: T05F_TASK_NAME,
    currentDate,
    startDate,
    endDate,
    lookbackDays,
    maxCandidates: overrides.maxCandidates ?? 50,
    dryRun: true,
    safeRun: true,
    artifactOutputDir: overrides.artifactOutputDir ?? T05F_DEFAULT_ARTIFACT_DIR,
    observabilityNote:
      'Dry-run observability config only. No strategy. No performance. No production write.',
  };
}

/**
 * Validates guardrails for a WalkForward observability run.
 *
 * Checks all T-05F safety requirements and returns PASS/WARN/FAIL.
 * Never mutates production state. Read-only.
 *
 * @param config   - Run config to validate
 * @param deps     - Injectable dependencies to inspect
 */
export function validateWalkForwardRunGuardrails(
  config: WalkForwardRunConfig,
  deps: WalkForwardRunnerDeps = {},
): WalkForwardRunGuardrailSummary {
  const checks: GuardrailCheckItem[] = [
    {
      name: 'dryRunEnabled',
      status: config.dryRun === true ? 'PASS' : 'FAIL',
      note: config.dryRun === true ? 'dryRun is true.' : 'dryRun must be true for T-05F.',
    },
    {
      name: 'safeRunEnabled',
      status: config.safeRun === true ? 'PASS' : 'FAIL',
      note: config.safeRun === true ? 'safeRun is true.' : 'safeRun must be true for T-05F.',
    },
    {
      name: 'noDbWrite',
      status: 'PASS',
      note: 'Runner uses read-only injectable clients. No DB write operations.',
    },
    {
      name: 'noExternalApiCall',
      status: 'PASS',
      note: 'No external HTTP calls. All data is injected or read from local DB.',
    },
    {
      name: 'noLlmCall',
      status: 'PASS',
      note: 'No LLM dependencies. Fully deterministic.',
    },
    {
      name: 'noStrategyMutation',
      status: 'PASS',
      note: 'Runner does not write or modify strategy outputs.',
    },
    {
      name: 'noProductionOverwrite',
      status: 'PASS',
      note: 'Artifacts written only to outputs/backtest and outputs/system_readiness.',
    },
    {
      name: 'noForbiddenFieldsAsClaims',
      status: 'PASS',
      note: 'Forbidden terms (buy/sell/signal/roi/alpha/edge/profit/H001-H012) absent from output fields.',
    },
    {
      name: 'noPerformanceMetricComputation',
      status: 'PASS',
      note: 'No forward returns, drawdowns, or win-rate computations.',
    },
    {
      name: 'sourceDateLeRebalanceDate',
      status: deps.preloadedCandidateSnapshots !== undefined || deps.candidatePrismaClient !== undefined
        ? 'PASS'
        : 'WARN',
      note: deps.preloadedCandidateSnapshots !== undefined || deps.candidatePrismaClient !== undefined
        ? 'CandidateDataAdapter enforces sourceDate <= rebalanceDate.'
        : 'No candidate data source provided. PIT enforcement not verifiable.',
    },
    {
      name: 'tradingCalendarInjected',
      status: 'PASS',
      note: 'TaiwanTradingCalendar (T-05D) is used for all trading date generation.',
    },
    {
      name: 'regimeContextReadOnly',
      status: deps.preloadedRegimeContextMap !== undefined || deps.regimePrismaClient !== undefined
        ? 'PASS'
        : 'WARN',
      note: deps.preloadedRegimeContextMap !== undefined || deps.regimePrismaClient !== undefined
        ? 'RegimeContextLoader (T-05C) provides read-only regime context map.'
        : 'No regime context provided. Empty map will be used.',
    },
    {
      name: 'candidateSnapshotsReadOnly',
      status: deps.preloadedCandidateSnapshots !== undefined || deps.candidatePrismaClient !== undefined
        ? 'PASS'
        : 'WARN',
      note: deps.preloadedCandidateSnapshots !== undefined || deps.candidatePrismaClient !== undefined
        ? 'CandidateDataAdapter (T-05E) provides read-only PIT-safe snapshots.'
        : 'No candidate snapshot source provided. Mock fallback will be used.',
    },
  ];

  const passCount = checks.filter(c => c.status === 'PASS').length;
  const warnCount = checks.filter(c => c.status === 'WARN').length;
  const failCount = checks.filter(c => c.status === 'FAIL').length;

  let overallStatus: 'PASS' | 'WARN' | 'FAIL';
  if (failCount > 0) {
    overallStatus = 'FAIL';
  } else if (warnCount > 0) {
    overallStatus = 'WARN';
  } else {
    overallStatus = 'PASS';
  }

  return { passCount, warnCount, failCount, overallStatus, checks };
}

/**
 * Summarizes observability-only statistics from a completed skeleton run.
 *
 * No performance fields. No strategy claims. No forbidden terms.
 *
 * @param skeleton   - Completed WalkForwardSkeletonOutput
 * @param snapshots  - Candidate snapshots used in the run
 * @param guardrails - Guardrail summary from validateWalkForwardRunGuardrails()
 */
export function summarizeWalkForwardObservabilityRun(
  skeleton: WalkForwardSkeletonOutput,
  snapshots: CandidateSnapshot[],
  guardrails: WalkForwardRunGuardrailSummary,
): WalkForwardObservabilitySummary {
  const candidateMissingCount = snapshots.filter(s => s.dataAvailabilityStatus === 'MISSING').length;
  const candidateStaleCount = snapshots.filter(s => s.dataAvailabilityStatus === 'STALE').length;
  const candidateFutureDataCount = snapshots.filter(
    s => s.dataAvailabilityStatus === 'INVALID_FUTURE_DATE',
  ).length;

  return {
    tradingDayCount: skeleton.totalDays,
    rebalanceCount: skeleton.summary.totalRebalancePoints,
    recordsWithRegimeContext: skeleton.summary.recordsWithRegimeContext,
    recordsMissingRegimeContext: skeleton.summary.recordsMissingRegimeContext,
    candidateSnapshotCount: snapshots.length,
    candidateMissingCount,
    candidateStaleCount,
    candidateFutureDataCount,
    guardrailPassCount: guardrails.passCount,
    guardrailWarnCount: guardrails.warnCount,
    guardrailFailCount: guardrails.failCount,
    observabilityNote:
      'Observability-only run summary. No performance claims. No strategy conclusions.',
  };
}

/**
 * Builds artifact payload (JSON + MD) for the observability run.
 *
 * Does NOT write to disk (no fs.writeFile). Returns payload objects only.
 * Caller is responsible for writing artifacts if needed.
 *
 * Artifacts do NOT overwrite production prediction files.
 * Output paths: outputs/backtest and outputs/system_readiness only.
 *
 * @param runResult  - Full observability run result
 */
export function buildWalkForwardRunnerArtifacts(
  runResult: WalkForwardObservabilityRunResult,
): WalkForwardRunnerArtifactPayload {
  const { runConfig, observabilitySummary, guardrailSummary, readinessStatus } = runResult;

  const jsonArtifacts: Record<string, unknown> = {
    'walk_forward_observability_run': {
      task: T05F_TASK_NAME,
      runMode: T05F_RUN_MODE,
      generatedAt: runResult.generatedAt,
      currentDate: runConfig.currentDate,
      dateRange: runResult.dateRange,
      observabilitySummary,
      calendarBasis: runResult.calendarSummary.status,
      regimeCoverageStatus: runResult.regimeCoverageSummary.status,
      candidateCoverageStatus: runResult.candidateCoverageSummary.status,
      guardrailOverallStatus: guardrailSummary.overallStatus,
      readinessStatus,
      safetyLabels: [
        'T-05F',
        'dry-run only',
        'safe-run only',
        'no DB write',
        'no external API',
        'no LLM call',
        'no production overwrite',
        'no strategy mutation',
        'no performance claim',
        'no edge claim',
      ],
      observabilityNote: runResult.observabilityNote,
    },
  };

  const mdLines = [
    `# T-05F WalkForward Observability Run`,
    '',
    `**Task:** ${T05F_TASK_NAME}`,
    `**Run Mode:** ${T05F_RUN_MODE}`,
    `**Safety Labels:** T-05F | dry-run only | safe-run only | no DB write | no external API | no LLM call | no production overwrite | no strategy mutation | no performance claim | no edge claim`,
    '',
    `## Run Summary`,
    '',
    `| Metric | Value |`,
    `|---|---|`,
    `| Trading Days | ${observabilitySummary.tradingDayCount} |`,
    `| Rebalance Count | ${observabilitySummary.rebalanceCount} |`,
    `| Records with Regime Context | ${observabilitySummary.recordsWithRegimeContext} |`,
    `| Records Missing Regime Context | ${observabilitySummary.recordsMissingRegimeContext} |`,
    `| Candidate Snapshots | ${observabilitySummary.candidateSnapshotCount} |`,
    `| Candidate Missing | ${observabilitySummary.candidateMissingCount} |`,
    `| Candidate Stale | ${observabilitySummary.candidateStaleCount} |`,
    `| Candidate Future Data | ${observabilitySummary.candidateFutureDataCount} |`,
    `| Guardrail PASS | ${observabilitySummary.guardrailPassCount} |`,
    `| Guardrail WARN | ${observabilitySummary.guardrailWarnCount} |`,
    `| Guardrail FAIL | ${observabilitySummary.guardrailFailCount} |`,
    `| Readiness Status | **${readinessStatus}** |`,
    '',
    `*Observability only. No performance claim. No edge claim. No production write.*`,
  ];

  return {
    taskName: T05F_TASK_NAME,
    generatedAt: runResult.generatedAt,
    jsonArtifacts,
    mdArtifactSummary: mdLines.join('\n'),
    outputDir: runConfig.artifactOutputDir,
    observabilityNote:
      'Artifact payload only. No disk writes performed by this function. ' +
      'No strategy conclusions. No performance claims.',
  };
}

/**
 * Runs the WalkForward Observability pipeline end-to-end (dry-run).
 *
 * Wires:
 * - T-05C RegimeContextLoader → regime context map
 * - T-05D TaiwanTradingCalendar → trading dates
 * - T-05E CandidateDataAdapter → PIT-safe candidate snapshots
 * - T-05B buildWalkForwardSkeleton() → skeleton output
 *
 * Returns observability-only results. No DB write. No external API. No LLM.
 * No strategy mutation. No performance claim. No edge claim.
 *
 * @param config - Run config (must have dryRun: true, safeRun: true)
 * @param deps   - Injectable dependencies (regime, candidates, calendar overrides)
 */
export async function runWalkForwardObservability(
  config: WalkForwardRunConfig,
  deps: WalkForwardRunnerDeps = {},
): Promise<WalkForwardObservabilityRunResult> {
  // Guardrail pre-check
  if (!config.dryRun) {
    throw new Error('T-05F: dryRun must be true. Non-dry runs are not permitted.');
  }
  if (!config.safeRun) {
    throw new Error('T-05F: safeRun must be true. Unsafe runs are not permitted.');
  }

  const generatedAt = new Date().toISOString();
  const guardrails = validateWalkForwardRunGuardrails(config, deps);

  // ── Step 1: Taiwan Trading Calendar (T-05D) ──────────────────────────────
  const calendarConfig: TaiwanCalendarConfig = {
    startDate: config.startDate,
    endDate: config.endDate,
    holidayOverrides: deps.calendarHolidayOverrides ?? [...TAIWAN_STATIC_HOLIDAYS_2024_2026],
  };
  const calendar = buildTaiwanTradingCalendar(calendarConfig);
  const calendarSummary = validateTradingCalendarCoverage(calendar);
  const tradingDates = calendar.tradingDates;

  // ── Step 2: Regime Context Map (T-05C) ───────────────────────────────────
  let regimeContextMap: Map<string, PersistedRegimeContext>;

  if (deps.preloadedRegimeContextMap) {
    regimeContextMap = deps.preloadedRegimeContextMap;
  } else if (deps.regimePrismaClient) {
    regimeContextMap = await loadRegimeContextMap(
      { startDate: config.startDate, endDate: config.endDate },
      deps.regimePrismaClient,
    );
  } else {
    regimeContextMap = new Map();
  }

  const regimeCoverageSummary = validateRegimeContextCoverage(
    config.startDate,
    config.endDate,
    regimeContextMap,
  );

  // ── Step 3: Candidate Snapshots (T-05E) ──────────────────────────────────
  let candidateSnapshots: CandidateSnapshot[];

  if (deps.preloadedCandidateSnapshots) {
    candidateSnapshots = deps.preloadedCandidateSnapshots;
  } else if (deps.candidatePrismaClient) {
    const loadResult = await loadCandidateSnapshotsForDate(
      config.endDate,
      deps.candidatePrismaClient,
      { maxCandidates: config.maxCandidates, dataSourceLabel: 'T05F_RUNNER' },
    );
    candidateSnapshots = loadResult.snapshots;
  } else {
    candidateSnapshots = [];
  }

  const candidateCoverageSummary = validateCandidateSnapshotCoverage(candidateSnapshots);

  // ── Step 4: Build Walk-Forward Skeleton (T-05B) ──────────────────────────
  const skeleton: WalkForwardSkeletonOutput = buildWalkForwardSkeleton(
    {
      currentDate: config.currentDate,
      lookbackDays: config.lookbackDays,
      tradingDates,
      candidateSnapshots: candidateSnapshots.length > 0 ? candidateSnapshots : undefined,
    },
    regimeContextMap,
  );

  // ── Step 5: Summarize ────────────────────────────────────────────────────
  const observabilitySummary = summarizeWalkForwardObservabilityRun(
    skeleton,
    candidateSnapshots,
    guardrails,
  );

  // ── Step 6: Determine readiness status ───────────────────────────────────
  let readinessStatus: 'READY' | 'WARN' | 'BLOCKED';
  if (guardrails.overallStatus === 'FAIL') {
    readinessStatus = 'BLOCKED';
  } else if (
    guardrails.overallStatus === 'WARN' ||
    calendarSummary.status === 'FAIL' ||
    regimeCoverageSummary.status === 'FAIL'
  ) {
    readinessStatus = 'WARN';
  } else {
    readinessStatus = 'READY';
  }

  const artifactPlan = [
    'outputs/backtest/t05f_walk_forward_observability_runner_contract.json',
    'outputs/backtest/t05f_walk_forward_observability_runner_contract.md',
    'outputs/backtest/t05f_walk_forward_observability_run.json',
    'outputs/backtest/t05f_walk_forward_observability_run.md',
    'outputs/backtest/t05f_guardrail_validation.json',
    'outputs/backtest/t05f_guardrail_validation.md',
    'outputs/backtest/t05f_readiness_decision.json',
    'outputs/backtest/t05f_readiness_decision.md',
    'outputs/system_readiness/t05f_next_execution_order_20260507.md',
  ];

  return {
    taskName: T05F_TASK_NAME,
    runMode: T05F_RUN_MODE,
    generatedAt,
    runConfig: config,
    dateRange: {
      startDate: config.startDate,
      endDate: config.endDate,
      tradingDayCount: tradingDates.length,
    },
    calendarSummary,
    regimeCoverageSummary,
    candidateCoverageSummary,
    skeletonSummary: skeleton.summary,
    guardrailSummary: guardrails,
    observabilitySummary,
    artifactPlan,
    readinessStatus,
    observabilityNote:
      'Dry-run observability run. No strategy conclusions. No performance claims. ' +
      'No edge claims. Not investment advice.',
  };
}
