/**
 * Research Parameter Versioning — Phase H
 *
 * Tracks which parameter values are active for each research run.
 * Every experiment run is tagged with a parameter_set_id so results
 * can be attributed to specific configurations.
 *
 * Layer: Research Governance (L4)
 */

import { prisma } from '@/lib/prisma';

// ─── Types ───────────────────────────────────────────────────────

export interface ResearchParameters {
  /** Signal classification thresholds */
  minSampleStrong: number;
  minSampleDegraded: number;
  minRegimeSample: number;
  /** Walk-forward thresholds */
  minHalfSample: number;
  hitRateStableThreshold: number;
  hitRateUnstableThreshold: number;
  /** Regime stratification */
  unknownFragileThreshold: number;
  dominantRegimeShare: number;
  minSampleFragile: number;
  /** Decision layer */
  positionSizingHigh: number;
  positionSizingMid: number;
  positionSizingLow: number;
}

export interface ParameterSet {
  id: number;
  version: string;
  parameters: ResearchParameters;
  description: string | null;
  activatedAt: string;
  deactivatedAt: string | null;
}

// ─── Default parameters (current hardcoded values) ───────────────

export const DEFAULT_PARAMETERS: ResearchParameters = {
  minSampleStrong: 30,
  minSampleDegraded: 10,
  minRegimeSample: 5,
  minHalfSample: 8,
  hitRateStableThreshold: 0.15,
  hitRateUnstableThreshold: 0.30,
  unknownFragileThreshold: 0.5,
  dominantRegimeShare: 0.80,
  minSampleFragile: 10,
  positionSizingHigh: 0.10,
  positionSizingMid: 0.06,
  positionSizingLow: 0.03,
};

// ─── Public API ──────────────────────────────────────────────────

/**
 * Get or create the current active parameter set.
 * If no active set exists, creates one from DEFAULT_PARAMETERS.
 */
export async function getActiveParameterSet(): Promise<ParameterSet> {
  // Find the most recent set without a deactivatedAt
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number;
    version: string;
    parameters: string;
    description: string | null;
    activatedAt: string;
    deactivatedAt: string | null;
  }>>(
    `SELECT id, version, parameters, description, activatedAt, deactivatedAt
     FROM ResearchParameterSet
     WHERE deactivatedAt IS NULL
     ORDER BY activatedAt DESC
     LIMIT 1`,
  );

  if (rows.length > 0) {
    const row = rows[0];
    return {
      id: row.id,
      version: row.version,
      parameters: JSON.parse(row.parameters) as ResearchParameters,
      description: row.description,
      activatedAt: row.activatedAt,
      deactivatedAt: row.deactivatedAt,
    };
  }

  // No active set — create default
  return createParameterSet(DEFAULT_PARAMETERS, 'v1.0.0', 'Initial default parameters');
}

/**
 * Create a new parameter set version. Deactivates the previous active set.
 */
export async function createParameterSet(
  parameters: ResearchParameters,
  version: string,
  description?: string,
): Promise<ParameterSet> {
  const now = new Date().toISOString();

  // Deactivate all currently active sets
  await prisma.$executeRawUnsafe(
    `UPDATE ResearchParameterSet SET deactivatedAt = ? WHERE deactivatedAt IS NULL`,
    now,
  );

  // Insert new set
  await prisma.$executeRawUnsafe(
    `INSERT INTO ResearchParameterSet (version, parameters, description, activatedAt, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    version,
    JSON.stringify(parameters),
    description ?? null,
    now,
    now,
  );

  // Retrieve the inserted row
  const inserted = await prisma.$queryRawUnsafe<Array<{
    id: number;
    version: string;
    parameters: string;
    description: string | null;
    activatedAt: string;
    deactivatedAt: string | null;
  }>>(
    `SELECT id, version, parameters, description, activatedAt, deactivatedAt
     FROM ResearchParameterSet
     WHERE version = ?`,
    version,
  );

  const row = inserted[0];
  return {
    id: row.id,
    version: row.version,
    parameters: JSON.parse(row.parameters) as ResearchParameters,
    description: row.description,
    activatedAt: row.activatedAt,
    deactivatedAt: row.deactivatedAt,
  };
}

/**
 * Get parameter set by ID. Used for historical attribution.
 */
export async function getParameterSetById(id: number): Promise<ParameterSet | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number;
    version: string;
    parameters: string;
    description: string | null;
    activatedAt: string;
    deactivatedAt: string | null;
  }>>(
    `SELECT id, version, parameters, description, activatedAt, deactivatedAt
     FROM ResearchParameterSet WHERE id = ?`,
    id,
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    version: row.version,
    parameters: JSON.parse(row.parameters) as ResearchParameters,
    description: row.description,
    activatedAt: row.activatedAt,
    deactivatedAt: row.deactivatedAt,
  };
}
