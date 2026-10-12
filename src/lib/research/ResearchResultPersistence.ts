/**
 * Research Result Persistence Layer — Phase H
 *
 * Persists outputs from SignalEffectivenessEngine, WalkForwardValidator,
 * and RegimeStratifiedEngine to the database with experiment_run linkage.
 *
 * Layer: Research Infrastructure (L4)
 */

import { prisma } from '@/lib/prisma';
import type { SignalEffectiveness } from '@/lib/signals/types';
import type { WalkForwardResult as WFResult } from '@/lib/signals/WalkForwardValidator';
import type { RegimeStratifiedResult as RSResult } from '@/lib/signals/RegimeStratifiedEngine';

// ─── Signal Effectiveness Persistence ────────────────────────────

export async function persistSignalEffectiveness(
  result: SignalEffectiveness,
  experimentRunId?: number,
): Promise<number> {
  const now = new Date().toISOString();

  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `INSERT INTO SignalEffectivenessResult
       (experimentRunId, signalType, window, sampleSize, hitRate, avgReturn,
        excessReturn, excessHitRate, volatility, stabilityScore, classification,
        brierLikeScore, regimeBreakdown, persistence, limitations, evaluatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    experimentRunId ?? null,
    result.signalType,
    result.window,
    result.sampleSize,
    result.hitRate,
    result.avgReturn,
    result.excessReturn,
    result.excessHitRate ?? null,
    result.volatility,
    result.stabilityScore,
    result.classification,
    result.brierLikeScore ?? null,
    JSON.stringify(result.regimeBreakdown),
    JSON.stringify(result.persistence),
    JSON.stringify(result.limitations),
    now,
  );

  return rows[0].id;
}

/**
 * Persist multiple signal effectiveness results atomically.
 */
export async function persistSignalEffectivenessBatch(
  results: SignalEffectiveness[],
  experimentRunId?: number,
): Promise<number[]> {
  const ids: number[] = [];
  for (const result of results) {
    const id = await persistSignalEffectiveness(result, experimentRunId);
    ids.push(id);
  }
  return ids;
}

// ─── Walk-Forward Result Persistence ─────────────────────────────

export async function persistWalkForwardResult(
  result: WFResult,
  experimentRunId?: number,
): Promise<number> {
  const now = new Date().toISOString();

  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `INSERT INTO WalkForwardResult
       (experimentRunId, signalType, window, hasSufficientData,
        firstHalf, secondHalf, consistencyLabel,
        hitRateDeviation, classificationMatch, excessReturnSignMatch,
        limitations, evaluatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    experimentRunId ?? null,
    result.signalType,
    result.window,
    result.hasSufficientData ? 1 : 0,
    JSON.stringify(result.firstHalf),
    JSON.stringify(result.secondHalf),
    result.consistency.overallLabel,
    result.consistency.hitRateDeviation,
    result.consistency.classificationMatch ? 1 : 0,
    result.consistency.excessReturnSignMatch ? 1 : 0,
    JSON.stringify(result.limitations),
    now,
  );

  return rows[0].id;
}

// ─── Regime Stratified Result Persistence ────────────────────────

export async function persistRegimeStratifiedResult(
  result: RSResult,
  experimentRunId?: number,
): Promise<number> {
  const now = new Date().toISOString();

  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `INSERT INTO RegimeStratifiedResult
       (experimentRunId, signalType, window, sampleSize,
        overall, regimeBreakdown, consistencyLabel,
        dominantRegime, fragileRegimes,
        unknownRegimeFraction, hasSufficientRegimeData,
        limitations, evaluatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    experimentRunId ?? null,
    result.signalType,
    result.window,
    result.sampleSize,
    JSON.stringify(result.overall),
    JSON.stringify(result.regimeBreakdown),
    result.regimeDependency.consistencyLabel,
    result.regimeDependency.dominantRegime ?? null,
    JSON.stringify(result.regimeDependency.fragileRegimes),
    result.unknownRegimeFraction,
    result.hasSufficientRegimeData ? 1 : 0,
    JSON.stringify(result.limitations),
    now,
  );

  return rows[0].id;
}

// ─── Experiment Run Persistence ──────────────────────────────────

export interface ExperimentRunRecord {
  id: number;
  experimentId: string;
  parameterSetId: number | null;
  status: string;
  previousStatus: string;
  evidenceLevel: string;
  findings: string[];
  metrics: Record<string, unknown>;
  blockers: string[];
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

export async function createExperimentRun(params: {
  experimentId: string;
  parameterSetId: number | null;
  previousStatus: string;
  coverageSnapshot?: Record<string, unknown>;
}): Promise<number> {
  const now = new Date().toISOString();

  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `INSERT INTO ExperimentRun
       (experimentId, parameterSetId, status, previousStatus, evidenceLevel,
        findings, metrics, blockers, coverageSnapshot, startedAt, createdAt)
     VALUES (?, ?, 'RUNNING', ?, 'UNVERIFIED', '[]', '{}', '[]', ?, ?, ?)
     RETURNING id`,
    params.experimentId,
    params.parameterSetId ?? null,
    params.previousStatus,
    params.coverageSnapshot ? JSON.stringify(params.coverageSnapshot) : null,
    now,
    now,
  );

  return rows[0].id;
}

export async function completeExperimentRun(params: {
  runId: number;
  status: string;
  evidenceLevel: string;
  findings: string[];
  metrics: Record<string, unknown>;
  blockers?: string[];
}): Promise<void> {
  const now = new Date().toISOString();

  // Compute duration from startedAt
  const startRows = await prisma.$queryRawUnsafe<Array<{ startedAt: string }>>(
    `SELECT startedAt FROM ExperimentRun WHERE id = ?`,
    params.runId,
  );

  let durationMs: number | null = null;
  if (startRows.length > 0) {
    const startMs = new Date(startRows[0].startedAt).getTime();
    durationMs = Date.now() - startMs;
  }

  await prisma.$executeRawUnsafe(
    `UPDATE ExperimentRun
     SET status = ?, evidenceLevel = ?, findings = ?, metrics = ?,
         blockers = ?, completedAt = ?, durationMs = ?
     WHERE id = ?`,
    params.status,
    params.evidenceLevel,
    JSON.stringify(params.findings),
    JSON.stringify(params.metrics),
    JSON.stringify(params.blockers ?? []),
    now,
    durationMs,
    params.runId,
  );
}

// ─── Query helpers ───────────────────────────────────────────────

export async function getLatestExperimentRun(
  experimentId: string,
): Promise<ExperimentRunRecord | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number;
    experimentId: string;
    parameterSetId: number | null;
    status: string;
    previousStatus: string;
    evidenceLevel: string;
    findings: string;
    metrics: string;
    blockers: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
  }>>(
    `SELECT id, experimentId, parameterSetId, status, previousStatus,
            evidenceLevel, findings, metrics, blockers,
            startedAt, completedAt, durationMs
     FROM ExperimentRun
     WHERE experimentId = ?
     ORDER BY startedAt DESC
     LIMIT 1`,
    experimentId,
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    experimentId: row.experimentId,
    parameterSetId: row.parameterSetId,
    status: row.status,
    previousStatus: row.previousStatus,
    evidenceLevel: row.evidenceLevel,
    findings: JSON.parse(row.findings || '[]'),
    metrics: JSON.parse(row.metrics || '{}'),
    blockers: JSON.parse(row.blockers || '[]'),
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    durationMs: row.durationMs,
  };
}

/**
 * Get the latest signal effectiveness result for a signal type.
 */
export async function getLatestSignalEffectivenessResult(
  signalType: string,
  window: number,
): Promise<{ classification: string; sampleSize: number; evaluatedAt: string } | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    classification: string;
    sampleSize: number;
    evaluatedAt: string;
  }>>(
    `SELECT classification, sampleSize, evaluatedAt
     FROM SignalEffectivenessResult
     WHERE signalType = ? AND window = ?
     ORDER BY evaluatedAt DESC
     LIMIT 1`,
    signalType,
    window,
  );

  return rows.length > 0 ? rows[0] : null;
}
