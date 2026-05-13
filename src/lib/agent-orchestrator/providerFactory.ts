import type { LlmSkipReason } from './llmExecutionPolicy';
import type { PlannerProvider, WorkerProvider } from './types';

export type ProviderRole = 'planner' | 'worker' | 'cto_review' | 'ai_service';

// ── Allowlist constants ─────────────────────────────────────────────────────

/** Worker providers allowed for scheduled execution by default (no extra env required). */
export const WORKER_PROVIDER_ALLOWLIST: ReadonlyArray<string> = [
  'copilot-daemon',
  'external-worker',
] as const;

/**
 * Worker providers that require an explicit opt-in env var
 * AGENT_ORCHESTRATOR_ALLOW_CODEX_WORKER=1 before they are permitted.
 */
export const WORKER_PROVIDER_CODEX_GATE: ReadonlyArray<string> = ['codex'] as const;

/** Providers that are always local-only and never consume external quota. */
export const LOCAL_PROVIDERS: ReadonlyArray<string> = ['local-planner', 'local-review'] as const;

// ── Types ───────────────────────────────────────────────────────────────────

export interface ProviderResolution {
  role: ProviderRole;
  requestedProvider: string;
  effectiveProvider: string;
  external: boolean;
}

export interface ProviderEnforcement {
  resolution: ProviderResolution;
  allowed: boolean;
  /** Populated only when allowed=false; maps directly to LlmSkipReason. */
  blockReason: Extract<LlmSkipReason, 'PROVIDER_NOT_IN_ALLOWLIST' | 'CODEX_WORKER_NOT_ENABLED'> | null;
}

// ── Internal helpers ────────────────────────────────────────────────────────

function isCodexWorkerEnabled(): boolean {
  const val = process.env.AGENT_ORCHESTRATOR_ALLOW_CODEX_WORKER ?? '';
  return ['1', 'true', 'yes', 'on'].includes(val.toLowerCase());
}

/** Returns the effective worker allowlist, expanding to include codex when explicitly enabled. */
export function getEffectiveWorkerAllowlist(): ReadonlyArray<string> {
  if (isCodexWorkerEnabled()) {
    return [...WORKER_PROVIDER_ALLOWLIST, ...WORKER_PROVIDER_CODEX_GATE];
  }
  return WORKER_PROVIDER_ALLOWLIST;
}

// ── Resolution ──────────────────────────────────────────────────────────────

export function resolveProviderForRole(role: 'planner', requestedProvider: PlannerProvider): ProviderResolution;
export function resolveProviderForRole(role: 'worker' | 'ai_service', requestedProvider: WorkerProvider): ProviderResolution;
export function resolveProviderForRole(role: 'cto_review', requestedProvider?: string | null): ProviderResolution;
export function resolveProviderForRole(role: ProviderRole, requestedProvider: string | null = null): ProviderResolution {
  const normalized = requestedProvider ?? '';

  if (role === 'planner') {
    return {
      role,
      requestedProvider: normalized,
      effectiveProvider: 'local-planner',
      external: false,
    };
  }

  if (role === 'cto_review') {
    return {
      role,
      requestedProvider: normalized,
      effectiveProvider: 'local-review',
      external: false,
    };
  }

  return {
    role,
    requestedProvider: normalized,
    effectiveProvider: normalized,
    external: normalized.length > 0,
  };
}

// ── Enforcement ─────────────────────────────────────────────────────────────

export function enforceProviderForRole(role: 'planner', requestedProvider: PlannerProvider): ProviderEnforcement;
export function enforceProviderForRole(role: 'worker' | 'ai_service', requestedProvider: WorkerProvider): ProviderEnforcement;
export function enforceProviderForRole(role: 'cto_review', requestedProvider?: string | null): ProviderEnforcement;
export function enforceProviderForRole(role: ProviderRole, requestedProvider?: string | null): ProviderEnforcement {
  const resolution = resolveProviderForRole(role, requestedProvider as WorkerProvider);

  // Planner and CTO always resolve to local; no external quota risk.
  if (role === 'planner' || role === 'cto_review') {
    return { resolution, allowed: true, blockReason: null };
  }

  const requested = resolution.requestedProvider;

  // Empty provider string — let downstream policy handle it.
  if (!requested) {
    return { resolution, allowed: true, blockReason: null };
  }

  // Codex requires explicit opt-in; block it before checking the general allowlist.
  if (WORKER_PROVIDER_CODEX_GATE.includes(requested) && !isCodexWorkerEnabled()) {
    return { resolution, allowed: false, blockReason: 'CODEX_WORKER_NOT_ENABLED' };
  }

  // General allowlist check.
  if (!getEffectiveWorkerAllowlist().includes(requested)) {
    return { resolution, allowed: false, blockReason: 'PROVIDER_NOT_IN_ALLOWLIST' };
  }

  return { resolution, allowed: true, blockReason: null };
}