import type {
  StrategyLabOpenPrediction,
  StrategyLabResolvedPrediction,
  StrategyLabSnapshot,
} from "@/lib/research/strategyLabArtifacts";

export const STRATEGY_LAB_RESULT_NOT_AVAILABLE = "NOT_AVAILABLE";

const RESULT_SNAPSHOT_CAVEATS = [
  "artifact-backed research-only snapshot",
  "diagnostic-only",
  "no investment advice",
  "no trading signal",
  "not performance",
] as const;

type Availability = "available" | "not_available";

export interface StrategyLabResultSnapshotMetric {
  label: string;
  value: string | number;
  note?: string;
}

export interface StrategyLabResultSnapshotProvenance {
  source: string;
  stamp: string;
  runId: string;
  status: Availability;
}

export interface StrategyLabResultSnapshotBlock {
  title: string;
  status: Availability;
  provenance: StrategyLabResultSnapshotProvenance;
  metrics: StrategyLabResultSnapshotMetric[];
}

export interface StrategyLabResultSnapshot {
  title: "Prediction & Retraining Snapshot";
  generatedAt: string;
  prediction: StrategyLabResultSnapshotBlock;
  retraining: StrategyLabResultSnapshotBlock;
  resolvedValidation: StrategyLabResultSnapshotBlock;
  researchReplay: StrategyLabResultSnapshotBlock;
  provenanceAndCaveats: StrategyLabResultSnapshotBlock & {
    mixedRun: boolean;
    caveats: string[];
  };
}

interface DirectionCounts {
  up: number;
  down: number;
  notAvailable: number;
}

interface ConfusionCounts {
  trueUp: number;
  trueDown: number;
  predictedUpActualDown: number;
  predictedDownActualUp: number;
  notAvailable: number;
}

function unavailable(): string {
  return STRATEGY_LAB_RESULT_NOT_AVAILABLE;
}

function valueOrUnavailable(value: string | number | null | undefined): string | number {
  if (value === null || value === undefined || value === "") return unavailable();
  return value;
}

function numericRatio(numerator: number | null, denominator: number | null): string {
  if (numerator === null || denominator === null || denominator === 0) return unavailable();
  return `${numerator}/${denominator} (${((numerator / denominator) * 100).toFixed(2)}%)`;
}

function percent(value: number | null): string {
  return value === null ? unavailable() : `${(value * 100).toFixed(2)}%`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueCount(values: string[]): number {
  return new Set(values.filter(Boolean)).size;
}

function countDirections(
  rows: Array<Pick<StrategyLabOpenPrediction | StrategyLabResolvedPrediction, "predictedDirection">>,
): DirectionCounts {
  return rows.reduce<DirectionCounts>(
    (counts, row) => {
      if (row.predictedDirection === "up") counts.up += 1;
      else if (row.predictedDirection === "down") counts.down += 1;
      else counts.notAvailable += 1;
      return counts;
    },
    { up: 0, down: 0, notAvailable: 0 },
  );
}

function confusionCounts(rows: StrategyLabResolvedPrediction[]): ConfusionCounts {
  return rows.reduce<ConfusionCounts>(
    (counts, row) => {
      if (!row.predictedDirection || !row.actualDirection) {
        counts.notAvailable += 1;
      } else if (row.predictedDirection === "up" && row.actualDirection === "up") {
        counts.trueUp += 1;
      } else if (row.predictedDirection === "down" && row.actualDirection === "down") {
        counts.trueDown += 1;
      } else if (row.predictedDirection === "up" && row.actualDirection === "down") {
        counts.predictedUpActualDown += 1;
      } else {
        counts.predictedDownActualUp += 1;
      }
      return counts;
    },
    {
      trueUp: 0,
      trueDown: 0,
      predictedUpActualDown: 0,
      predictedDownActualUp: 0,
      notAvailable: 0,
    },
  );
}

function directionalHitRate(rows: StrategyLabResolvedPrediction[]): string {
  const comparableRows = rows.filter((row) => row.predictedDirection && row.actualDirection);
  if (comparableRows.length === 0) return unavailable();
  const hits = comparableRows.filter((row) => row.predictedDirection === row.actualDirection).length;
  return `${hits}/${comparableRows.length} (${((hits / comparableRows.length) * 100).toFixed(2)}%)`;
}

function byHorizonSummary(
  rows: StrategyLabResolvedPrediction[],
  horizonTradingDays: number | null,
): string {
  if (rows.length === 0) return unavailable();
  const label = horizonTradingDays === null ? "horizon unknown" : `${horizonTradingDays} trading days`;
  return `${label}: ${directionalHitRate(rows)}`;
}

function runIdSet(...runIds: Array<string | null | undefined>): Set<string> {
  return new Set(runIds.filter((runId): runId is string => typeof runId === "string" && runId.length > 0));
}

function blockProvenance(source: string, stamp: string | null, runId: string | null, status: Availability) {
  return {
    source: source || unavailable(),
    stamp: valueOrUnavailable(stamp) as string,
    runId: valueOrUnavailable(runId) as string,
    status,
  };
}

function latestRunHistoryStamp(snapshot: StrategyLabSnapshot): string | null {
  return snapshot.runHistory.entries.find((entry) => entry.executedAt)?.executedAt
    ?? snapshot.refit.mtime;
}

function rangeFromUnknown(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return unavailable();
  const start = "start" in value && typeof value.start === "string" ? value.start : null;
  const end = "end" in value && typeof value.end === "string" ? value.end : null;
  if (!start || !end) return unavailable();
  return `${start} to ${end}`;
}

export function buildStrategyLabResultSnapshot(snapshot: StrategyLabSnapshot): StrategyLabResultSnapshot {
  const predictionStatus: Availability = snapshot.predictions.status === "present" ? "available" : "not_available";
  const retrainingStatus: Availability = snapshot.refit.status === "present" ? "available" : "not_available";
  const resolvedRows = snapshot.predictions.recentResolved;
  const resolvedStatus: Availability = resolvedRows.length > 0 ? "available" : "not_available";
  const replayStatus: Availability = resolvedRows.some((row) => typeof row.forwardReturn === "number")
    ? "available"
    : "not_available";

  const latestDirectionCounts = countDirections(snapshot.predictions.latestBySymbol);
  const openDirectionCounts = countDirections(snapshot.predictions.openPredictions);
  const resolvedDirectionCounts = countDirections(resolvedRows);
  const confusion = confusionCounts(resolvedRows);
  const totalTrackedPredictionCount = resolvedRows.length + snapshot.predictions.openPredictions.length;
  const validForwardReturns = resolvedRows
    .map((row) => row.forwardReturn)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const followModelRows = resolvedRows.filter((row) =>
    row.predictedDirection === "up" && typeof row.forwardReturn === "number" && Number.isFinite(row.forwardReturn),
  );
  const predictionRunId = snapshot.predictions.runId;
  const retrainingRunId = snapshot.refit.runId;
  const validationRunId = snapshot.predictions.runId;
  const replayRunId = snapshot.predictions.runId;
  const mixedRun = runIdSet(predictionRunId, retrainingRunId, validationRunId, replayRunId).size > 1;

  return {
    title: "Prediction & Retraining Snapshot",
    generatedAt: snapshot.generatedAt,
    prediction: {
      title: "Prediction",
      status: predictionStatus,
      provenance: blockProvenance(
        snapshot.predictions.path,
        snapshot.predictions.mtime ?? snapshot.predictions.dataEndDate,
        predictionRunId,
        predictionStatus,
      ),
      metrics: [
        { label: "generatedAt / data end", value: valueOrUnavailable(snapshot.predictions.dataEndDate) },
        { label: "latest symbol count", value: predictionStatus === "available" ? uniqueCount(snapshot.predictions.latestBySymbol.map((row) => row.symbol)) : unavailable() },
        { label: "latest model-direction counts", value: `up ${latestDirectionCounts.up} / down ${latestDirectionCounts.down} / NA ${latestDirectionCounts.notAvailable}` },
        { label: "open prediction rows", value: predictionStatus === "available" ? snapshot.predictions.openPredictions.length : unavailable() },
        { label: "all open direction counts", value: `up ${openDirectionCounts.up} / down ${openDirectionCounts.down} / NA ${openDirectionCounts.notAvailable}` },
        { label: "model / version / run id", value: valueOrUnavailable(predictionRunId) },
      ],
    },
    retraining: {
      title: "Retraining",
      status: retrainingStatus,
      provenance: blockProvenance(
        snapshot.refit.path,
        latestRunHistoryStamp(snapshot),
        retrainingRunId,
        retrainingStatus,
      ),
      metrics: [
        { label: "run id", value: valueOrUnavailable(retrainingRunId) },
        { label: "training window", value: rangeFromUnknown(snapshot.refit.validationBoundary?.trainFeaturePeriod) },
        { label: "symbols", value: snapshot.dataExport.symbols.length > 0 ? snapshot.dataExport.symbols.join(", ") : unavailable() },
        { label: "train / holdout samples", value: `${valueOrUnavailable(snapshot.refit.trainSampleCount)} / ${valueOrUnavailable(snapshot.refit.holdoutSampleCount)}` },
        { label: "accuracy / baseline", value: `${percent(snapshot.refit.metrics.accuracy)} / ${percent(snapshot.refit.metrics.majorityBaselineAccuracy)}` },
        { label: "classification", value: valueOrUnavailable(snapshot.refit.finalClassification) },
      ],
    },
    resolvedValidation: {
      title: "Resolved Validation",
      status: resolvedStatus,
      provenance: blockProvenance(
        snapshot.predictions.resolvedSampleProvenance.source || snapshot.predictions.path,
        snapshot.predictions.mtime,
        validationRunId,
        resolvedStatus,
      ),
      metrics: [
        { label: "resolved sample size", value: resolvedRows.length > 0 ? resolvedRows.length : unavailable() },
        { label: "total tracked prediction rows", value: totalTrackedPredictionCount > 0 ? totalTrackedPredictionCount : unavailable() },
        { label: "resolved coverage", value: numericRatio(resolvedRows.length || null, totalTrackedPredictionCount || null), note: "resolved / tracked rows currently available in the artifact-backed payload" },
        { label: "directional hit rate", value: directionalHitRate(resolvedRows) },
        { label: "confusion counts", value: `trueUp ${confusion.trueUp} / trueDown ${confusion.trueDown} / predictedUpActualDown ${confusion.predictedUpActualDown} / predictedDownActualUp ${confusion.predictedDownActualUp} / NA ${confusion.notAvailable}` },
        { label: "average forward return", value: percent(average(validForwardReturns)), note: "resolved-sample descriptive data only; not performance" },
      ],
    },
    researchReplay: {
      title: "Research Replay",
      status: replayStatus,
      provenance: blockProvenance(
        snapshot.predictions.resolvedSampleProvenance.source || snapshot.predictions.path,
        snapshot.predictions.mtime,
        replayRunId,
        replayStatus,
      ),
      metrics: [
        { label: "diagnostic sample count", value: validForwardReturns.length > 0 ? validForwardReturns.length : unavailable() },
        { label: "overall directional hit rate", value: directionalHitRate(resolvedRows) },
        { label: "by horizon", value: byHorizonSummary(resolvedRows, snapshot.predictions.horizonTradingDays) },
        { label: "coverage", value: numericRatio(resolvedRows.length || null, totalTrackedPredictionCount || null) },
        {
          label: "hypothetical frictionless research replay - not performance",
          value: percent(average(followModelRows.map((row) => row.forwardReturn as number))),
          note: "mean forward return of resolved rows where the model direction was up; resolved-row diagnostic only",
        },
        { label: "resolved direction counts", value: `up ${resolvedDirectionCounts.up} / down ${resolvedDirectionCounts.down} / NA ${resolvedDirectionCounts.notAvailable}` },
      ],
    },
    provenanceAndCaveats: {
      title: "Provenance + Caveats",
      status: snapshot.artifactSetStatus === "complete" ? "available" : "not_available",
      provenance: blockProvenance("existing /api/research/strategy-lab payload", snapshot.generatedAt, null, "available"),
      mixedRun,
      caveats: [...RESULT_SNAPSHOT_CAVEATS],
      metrics: [
        { label: "prediction source", value: snapshot.predictions.path || unavailable(), note: valueOrUnavailable(predictionRunId) as string },
        { label: "retraining source", value: snapshot.refit.path || unavailable(), note: valueOrUnavailable(retrainingRunId) as string },
        { label: "resolved validation source", value: snapshot.predictions.resolvedSampleProvenance.source || unavailable(), note: snapshot.predictions.resolvedSampleProvenance.validationStatus },
        { label: "research replay source", value: snapshot.predictions.resolvedSampleProvenance.source || unavailable(), note: "derived from resolved rows only" },
        { label: "mixed-run indicator", value: mixedRun ? "MIXED_RUN" : "same run id where available" },
        { label: "safety flags", value: `DB read ${snapshot.safety.canonicalDbRead} / DB write ${snapshot.safety.canonicalDbWrite} / external network ${snapshot.safety.externalNetworkUsedForRead}` },
      ],
    },
  };
}
