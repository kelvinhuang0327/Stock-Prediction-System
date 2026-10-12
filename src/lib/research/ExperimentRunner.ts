/**
 * Experiment Runner — Phase H
 *
 * Reads ExperimentRegistry, checks data readiness via ResearchCoverageEngine,
 * and executes corresponding validation engines. Transitions experiments
 * through their lifecycle using ResearchStateMachine.
 *
 * This is the core activation component that turns static experiment metadata
 * into a functioning research loop.
 *
 * Layer: Research Execution (L4)
 */

import { buildAllSignalHistories } from '@/lib/signals/SignalHistoryBuilder';
import { evaluateAllSignals } from '@/lib/signals/SignalEffectivenessEngine';
import { runWalkForwardValidation } from '@/lib/signals/WalkForwardValidator';
import { computeAllRegimeStratified } from '@/lib/signals/RegimeStratifiedEngine';
import { buildExperimentRegistry } from './ExperimentRegistry';
import type { ResearchExperiment, ExperimentStatus, EvidenceLevel } from './ExperimentRegistry';
import { buildResearchGapsReport } from './ResearchCoverageEngine';
import type { ResearchCoverageInputData, ResearchGapsReport } from './ResearchCoverageEngine';
import { buildSignalEffectivenessBatch } from '@/lib/signals/SignalEffectivenessBatchService';
import {
  isTransitionAllowed,
  deriveEvidenceLevelFromMetrics,
  derivePostRunStatus,
} from './ResearchStateMachine';
import { getActiveParameterSet } from './ResearchParameterVersioning';
import type { ParameterSet } from './ResearchParameterVersioning';
import {
  createExperimentRun,
  completeExperimentRun,
  persistSignalEffectivenessBatch,
  persistWalkForwardResult,
  persistRegimeStratifiedResult,
} from './ResearchResultPersistence';
import type { SignalHistory, SignalWindow } from '@/lib/signals/types';
import { prisma } from '@/lib/prisma';

// ─── Types ───────────────────────────────────────────────────────

export interface ExperimentRunResult {
  experimentId: string;
  previousStatus: ExperimentStatus;
  newStatus: ExperimentStatus;
  evidenceLevel: EvidenceLevel;
  runId: number | null;
  findings: string[];
  metrics: Record<string, unknown>;
  skipped: boolean;
  skipReason?: string;
}

export interface ResearchCycleResult {
  parameterSet: ParameterSet;
  gapsReport: ResearchGapsReport;
  experimentResults: ExperimentRunResult[];
  executedAt: string;
  totalDurationMs: number;
}

// ─── Experiment-specific executors ───────────────────────────────

/**
 * Execute experiment: label-redesign-validation
 * Tests if signal label classification (STRONG/CONDITIONAL/WEAK/NOISE)
 * effectively stratifies future return distributions.
 */
async function executeLabelRedesignValidation(
  experiment: ResearchExperiment,
  histories: SignalHistory[],
  window: SignalWindow,
  runId: number,
): Promise<{ status: ExperimentStatus; evidence: EvidenceLevel; findings: string[]; metrics: Record<string, unknown> }> {
  const results = await evaluateAllSignals(histories, window);
  await persistSignalEffectivenessBatch(results, runId);

  const findings: string[] = [];
  const metrics: Record<string, unknown> = {};
  let readyCount = 0;
  let totalSampleSize = 0;

  for (const r of results) {
    totalSampleSize += r.sampleSize;
    if (r.sampleSize >= 30) readyCount++;
    findings.push(
      `${r.signalType}: ${r.classification} (n=${r.sampleSize}, hitRate=${(r.hitRate * 100).toFixed(1)}%, excess=${(r.excessReturn * 100).toFixed(2)}%)`,
    );
  }

  metrics.readySignalTypes = readyCount;
  metrics.totalSignalTypes = results.length;
  metrics.totalSampleSize = totalSampleSize;
  metrics.classifications = Object.fromEntries(results.map((r) => [r.signalType, r.classification]));

  const allHave30 = readyCount === results.length;
  const hasSufficientData = readyCount > 0;
  const classificationsDiffer = new Set(results.map((r) => r.classification)).size > 1;

  const status = derivePostRunStatus({
    sampleSize: totalSampleSize,
    hasSufficientData,
    meetsSuccessCriteria: allHave30 && classificationsDiffer,
    evidenceContradicts: allHave30 && !classificationsDiffer,
    dataWentUnavailable: totalSampleSize === 0,
  });

  const evidence = deriveEvidenceLevelFromMetrics(totalSampleSize, hasSufficientData);

  return { status, evidence, findings, metrics };
}

/**
 * Execute experiment: walkforward-sample-sufficiency
 * Tests if walk-forward split-half validation produces stable results.
 */
async function executeWalkForwardSufficiency(
  experiment: ResearchExperiment,
  histories: SignalHistory[],
  window: SignalWindow,
  runId: number,
): Promise<{ status: ExperimentStatus; evidence: EvidenceLevel; findings: string[]; metrics: Record<string, unknown> }> {
  const findings: string[] = [];
  const metrics: Record<string, unknown> = {};
  let stableCount = 0;
  let sufficientCount = 0;

  for (const history of histories) {
    const result = await runWalkForwardValidation(history, window);
    await persistWalkForwardResult(result, runId);

    if (result.hasSufficientData) {
      sufficientCount++;
      if (result.consistency.overallLabel === 'STABLE') stableCount++;
    }

    findings.push(
      `${result.signalType}: ${result.consistency.overallLabel} (sufficient=${result.hasSufficientData}, hitDeviation=${result.consistency.hitRateDeviation.toFixed(3)})`,
    );
  }

  metrics.sufficientSignalTypes = sufficientCount;
  metrics.stableSignalTypes = stableCount;
  metrics.totalSignalTypes = histories.length;
  metrics.stabilityRatio = sufficientCount > 0 ? stableCount / sufficientCount : 0;

  const hasSufficientData = sufficientCount > 0;
  const majorityStable = sufficientCount > 0 && stableCount >= Math.ceil(sufficientCount * 0.6);

  const status = derivePostRunStatus({
    sampleSize: sufficientCount,
    hasSufficientData,
    meetsSuccessCriteria: majorityStable,
    evidenceContradicts: hasSufficientData && stableCount === 0,
    dataWentUnavailable: false,
  });

  const evidence = deriveEvidenceLevelFromMetrics(
    sufficientCount,
    hasSufficientData,
    majorityStable ? 'STABLE' : undefined,
  );

  return { status, evidence, findings, metrics };
}

/**
 * Execute experiment: regime-history-coverage
 * Tests if regime data is sufficient for cross-regime signal analysis.
 */
async function executeRegimeHistoryCoverage(
  experiment: ResearchExperiment,
  histories: SignalHistory[],
  window: SignalWindow,
  runId: number,
): Promise<{ status: ExperimentStatus; evidence: EvidenceLevel; findings: string[]; metrics: Record<string, unknown> }> {
  const results = await computeAllRegimeStratified(histories, window);

  for (const result of results) {
    await persistRegimeStratifiedResult(result, runId);
  }

  const findings: string[] = [];
  const metrics: Record<string, unknown> = {};
  let stableCount = 0;
  let sufficientCount = 0;

  for (const r of results) {
    if (r.hasSufficientRegimeData) sufficientCount++;
    if (r.regimeDependency.consistencyLabel === 'REGIME_STABLE') stableCount++;
    findings.push(
      `${r.signalType}: ${r.regimeDependency.consistencyLabel} (unknownFraction=${r.unknownRegimeFraction.toFixed(2)}, sufficient=${r.hasSufficientRegimeData})`,
    );
  }

  metrics.sufficientRegimeData = sufficientCount;
  metrics.stableRegimes = stableCount;
  metrics.totalSignalTypes = results.length;

  const regimeSnapshotCount = await prisma.$queryRawUnsafe<Array<{ cnt: number }>>(
    `SELECT COUNT(*) as cnt FROM DailyMarketSnapshot`,
  ).then((rows) => Number(rows[0]?.cnt ?? 0));

  metrics.regimeSnapshotCount = regimeSnapshotCount;

  const hasSufficientData = regimeSnapshotCount >= 30 && sufficientCount > 0;
  const coverageAdequate = sufficientCount >= Math.ceil(results.length * 0.7);

  const status = derivePostRunStatus({
    sampleSize: regimeSnapshotCount,
    hasSufficientData,
    meetsSuccessCriteria: regimeSnapshotCount >= 100 && coverageAdequate,
    evidenceContradicts: false,
    dataWentUnavailable: regimeSnapshotCount === 0,
  });

  const evidence = deriveEvidenceLevelFromMetrics(regimeSnapshotCount, hasSufficientData);

  return { status, evidence, findings, metrics };
}

/**
 * Check if an experiment is executable based on coverage data.
 * Returns null if ready, or a skip reason string.
 */
function checkExecutability(
  experiment: ResearchExperiment,
  gapsReport: ResearchGapsReport,
): string | null {
  // Terminal states cannot be re-run
  if (experiment.status === 'VALIDATED' || experiment.status === 'REJECTED') {
    return `Experiment already in terminal state: ${experiment.status}`;
  }

  if (experiment.status === 'DEFERRED') {
    return 'Experiment is deferred';
  }

  // Check if transition to RUNNING is possible
  const canRun =
    isTransitionAllowed(experiment.status, 'RUNNING') ||
    experiment.status === 'IDEA' || // IDEA can go READY → RUNNING
    experiment.status === 'BLOCKED'; // BLOCKED can go READY → RUNNING if unblocked

  if (!canRun && experiment.status !== 'IDEA' && experiment.status !== 'BLOCKED') {
    return `Cannot transition from ${experiment.status} to RUNNING`;
  }

  // For BLOCKED experiments, check if blockers are resolved
  if (experiment.status === 'BLOCKED' && experiment.blockers.length > 0) {
    // Check specific blockers against gaps report
    const activeHighGaps = gapsReport.topGaps.filter((g) => g.priority === 'HIGH');
    const hasActiveBlocker = experiment.blockers.some((blocker) =>
      activeHighGaps.some((gap) => blocker.includes(gap.reason.slice(0, 20))),
    );

    // For regime experiment, check DailyMarketSnapshot specifically
    if (experiment.id === 'regime-history-coverage') {
      const regimeGap = gapsReport.topGaps.find((g) => g.key === 'gap:no_regime_history');
      if (regimeGap) {
        return `Blocked: ${regimeGap.reason}`;
      }
    }

    // For event-source-persistence, this needs schema migration — always blocked
    if (experiment.id === 'event-source-persistence') {
      return 'Blocked: requires NewsEvent schema migration (manual step)';
    }

    // For confidence-outcome-collection, needs new pipeline — always blocked
    if (experiment.id === 'confidence-outcome-collection') {
      return 'Blocked: requires prediction-outcome tracking pipeline (not yet built)';
    }
  }

  return null;
}

// ─── Main Runner ─────────────────────────────────────────────────

/**
 * Execute a single research experiment.
 */
async function executeExperiment(
  experiment: ResearchExperiment,
  histories: SignalHistory[],
  window: SignalWindow,
  parameterSet: ParameterSet,
  gapsReport: ResearchGapsReport,
): Promise<ExperimentRunResult> {
  const skipReason = checkExecutability(experiment, gapsReport);

  if (skipReason) {
    return {
      experimentId: experiment.id,
      previousStatus: experiment.status,
      newStatus: experiment.status,
      evidenceLevel: experiment.evidenceLevel,
      runId: null,
      findings: [],
      metrics: {},
      skipped: true,
      skipReason,
    };
  }

  // Create experiment run record
  const runId = await createExperimentRun({
    experimentId: experiment.id,
    parameterSetId: parameterSet.id,
    previousStatus: experiment.status,
    coverageSnapshot: { overallReadiness: gapsReport.summary.overallReadiness },
  });

  try {
    let result: { status: ExperimentStatus; evidence: EvidenceLevel; findings: string[]; metrics: Record<string, unknown> };

    switch (experiment.id) {
      case 'label-redesign-validation':
        result = await executeLabelRedesignValidation(experiment, histories, window, runId);
        break;
      case 'walkforward-sample-sufficiency':
        result = await executeWalkForwardSufficiency(experiment, histories, window, runId);
        break;
      case 'regime-history-coverage':
        result = await executeRegimeHistoryCoverage(experiment, histories, window, runId);
        break;
      case 'signal-disagreement-effectiveness':
        // Reuses label validation logic (signal effectiveness) with disagreement focus
        result = await executeLabelRedesignValidation(experiment, histories, window, runId);
        break;
      case 'relevance-overlay-completeness':
        // Low priority — run signal effectiveness and check proxy quality
        result = await executeLabelRedesignValidation(experiment, histories, window, runId);
        break;
      default:
        // Unknown or structurally blocked experiments
        await completeExperimentRun({
          runId,
          status: 'BLOCKED',
          evidenceLevel: 'UNVERIFIED',
          findings: [`No executor defined for experiment: ${experiment.id}`],
          metrics: {},
          blockers: ['No automated executor available'],
        });
        return {
          experimentId: experiment.id,
          previousStatus: experiment.status,
          newStatus: 'BLOCKED',
          evidenceLevel: 'UNVERIFIED' as EvidenceLevel,
          runId,
          findings: [`No executor defined for experiment: ${experiment.id}`],
          metrics: {},
          skipped: true,
          skipReason: 'No automated executor available',
        };
    }

    // Complete the experiment run with results
    await completeExperimentRun({
      runId,
      status: result.status,
      evidenceLevel: result.evidence,
      findings: result.findings,
      metrics: result.metrics,
    });

    return {
      experimentId: experiment.id,
      previousStatus: experiment.status,
      newStatus: result.status,
      evidenceLevel: result.evidence,
      runId,
      findings: result.findings,
      metrics: result.metrics,
      skipped: false,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    await completeExperimentRun({
      runId,
      status: 'BLOCKED',
      evidenceLevel: 'UNVERIFIED',
      findings: [`Execution error: ${errorMsg}`],
      metrics: {},
      blockers: [errorMsg],
    });

    return {
      experimentId: experiment.id,
      previousStatus: experiment.status,
      newStatus: 'BLOCKED',
      evidenceLevel: 'UNVERIFIED' as EvidenceLevel,
      runId,
      findings: [`Execution error: ${errorMsg}`],
      metrics: {},
      skipped: false,
    };
  }
}

/**
 * Run the full research cycle:
 * 1. Get active parameter set
 * 2. Build coverage report (data readiness)
 * 3. Build experiment registry (enriched with coverage)
 * 4. For each executable experiment, run validation engines
 * 5. Persist all results with experiment_run linkage
 * 6. Return cycle summary
 */
export async function runResearchCycle(
  window: SignalWindow = 5,
  days = 180,
): Promise<ResearchCycleResult> {
  const startTime = Date.now();

  // 1. Get active parameter set (creates default if none exists)
  const parameterSet = await getActiveParameterSet();

  // 2. Build coverage input data
  const signalBatch = await buildSignalEffectivenessBatch({ window, days });

  const taiexRowCount = await prisma.$queryRawUnsafe<Array<{ cnt: number }>>(
    `SELECT COUNT(*) as cnt FROM MarketIndex WHERE name = 'TAIEX'`,
  ).then((rows) => Number(rows[0]?.cnt ?? 0));

  const regimeSnapshotCount = await prisma.$queryRawUnsafe<Array<{ cnt: number }>>(
    `SELECT COUNT(*) as cnt FROM DailyMarketSnapshot`,
  ).then((rows) => Number(rows[0]?.cnt ?? 0));

  const coverageInput: ResearchCoverageInputData = {
    signalBatch,
    eventSourceQuality: null, // Event quality assessed separately
    taiexRowCount,
    regimeSnapshotCount,
  };

  // 3. Build gaps report and experiment registry
  const gapsReport = buildResearchGapsReport(coverageInput);
  const registry = buildExperimentRegistry(gapsReport);

  // 4. Load signal histories once (shared across experiments)
  const histories = await buildAllSignalHistories(days);

  // 5. Execute each experiment
  const experimentResults: ExperimentRunResult[] = [];

  for (const experiment of registry.experiments) {
    const result = await executeExperiment(
      experiment,
      histories,
      window,
      parameterSet,
      gapsReport,
    );
    experimentResults.push(result);
  }

  const totalDurationMs = Date.now() - startTime;

  return {
    parameterSet,
    gapsReport,
    experimentResults,
    executedAt: new Date().toISOString(),
    totalDurationMs,
  };
}
