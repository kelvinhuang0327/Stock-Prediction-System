/**
 * Shared status / degraded-state type definitions.
 *
 * Semantic hierarchy:
 *   success     — full data, no caveats
 *   partial     — some data present but incomplete
 *   limited     — data present but quality/quantity is below ideal
 *   degraded    — running in fallback / reduced mode
 *   insufficient — data exists but below minimum threshold for meaningful output
 *   unavailable  — the resource / table / source is entirely absent
 *   skipped     — intentionally not executed (e.g. dependency missing)
 *   failed      — attempted but errored out
 */

// ── Core status: used for job/task execution results ────────────────────────
export type StatusType = 'success' | 'partial' | 'failed' | 'skipped';

// ── Data availability: used for data-quality annotations ────────────────────
export type DataAvailabilityType =
  | 'available'
  | 'limited'
  | 'degraded'
  | 'insufficient'
  | 'unavailable';

// ── Job status: extended execution lifecycle ────────────────────────────────
export type JobStatusType =
  | 'success'
  | 'partial'
  | 'failed'
  | 'skipped'
  | 'running'
  | 'pending';

// ── Comparison availability ─────────────────────────────────────────────────
export type ComparisonAvailabilityType = 'available' | 'degraded' | 'unavailable';

// ── Risk level ──────────────────────────────────────────────────────────────
export type RiskLevelType = 'low' | 'moderate' | 'elevated' | 'high' | 'unknown';

// ── Concentration level ─────────────────────────────────────────────────────
export type ConcentrationLevelType = 'low' | 'moderate' | 'high' | 'unknown';

// ── UI tone mapped from status ───────────────────────────────────────────────
export type StatusTone = 'success' | 'warning' | 'error' | 'muted';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** True when the status indicates data is entirely absent or unusable. */
export function isUnavailableLike(
  status: DataAvailabilityType | string | undefined | null,
): boolean {
  return status === 'unavailable' || status === 'insufficient';
}

/** True when the status indicates an execution failure. */
export function isFailureLike(status: StatusType | JobStatusType | string | undefined | null): boolean {
  return status === 'failed';
}

/** Map a status value to a UI colour tone. */
export function getStatusTone(
  status: StatusType | DataAvailabilityType | JobStatusType | string | undefined | null,
): StatusTone {
  if (!status) return 'muted';
  switch (status) {
    case 'success':
    case 'available':
      return 'success';
    case 'partial':
    case 'limited':
    case 'degraded':
      return 'warning';
    case 'failed':
    case 'unavailable':
    case 'insufficient':
      return 'error';
    case 'skipped':
    case 'pending':
    case 'running':
      return 'muted';
    default:
      return 'muted';
  }
}

/** Human-readable label for data availability. */
export function getAvailabilityLabel(status: DataAvailabilityType | string | undefined | null): string {
  switch (status) {
    case 'available':    return '資料正常';
    case 'limited':      return '資料有限';
    case 'degraded':     return '降級模式';
    case 'insufficient': return '資料不足';
    case 'unavailable':  return '資料不可用';
    default:             return '未知';
  }
}

/** Normalise free-form strings that appear across the codebase into a typed value. */
export function normalizeStatus(raw: string | undefined | null): StatusType {
  if (!raw) return 'failed';
  const s = raw.toLowerCase().trim();
  if (s === 'success' || s === 'ok' || s === 'done') return 'success';
  if (s === 'partial' || s === 'limited' || s === 'degraded') return 'partial';
  if (s === 'skipped' || s === 'skip') return 'skipped';
  return 'failed';
}
