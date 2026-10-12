/**
 * GET /api/system/llm-usage
 *
 * Parses runtime/agent_orchestrator/llm_usage.jsonl and returns an aggregated
 * observability summary grouped by role and provider.
 *
 * This route is READ-ONLY.  It never triggers providers, modifies state, or
 * changes scheduler configuration.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { NextResponse } from 'next/server';
import { computeWarnings } from '@/lib/agent-orchestrator/llmUsageWarnings';
import type { UsageWarning } from '@/lib/agent-orchestrator/llmUsageWarnings';

// ── Types ───────────────────────────────────────────────────────────────────

/** Normalised record parsed from a single llm_usage.jsonl line. */
interface UsageLine {
  timestamp: string;
  phase: string;
  event: string;
  caller: string;
  triggerSource: string;
  provider: string;
  model: string | null;
  taskId: string | null;
  jobName: string | null;
  decision: string;
  skipReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  parsed: boolean;
  premiumRequests: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  rateLimit: string | null;
  durationMs: number;
  source: string;
  desiredModel: string | null;
  actualModel: string | null;
  modelPropagationStatus: string | null;
  noTaskReason: string | null;
}

interface RoleSummary {
  preflightCount: number;
  executionCount: number;
  blockedCount: number;
  failedCount: number;
  premiumRequests: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

interface UsageSummaryResponse {
  generatedAt: string;
  window: 'today';
  totals: RoleSummary;
  byRole: Record<string, RoleSummary>;
  byProvider: Record<string, RoleSummary>;
  recent: UsageLine[];
  /** Usage Guard warnings computed from all-time records */
  warnings: UsageWarning[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const EXTERNAL_PROVIDERS = new Set([
  'codex', 'claude', 'github-copilot', 'copilot-daemon',
  'github-cli', 'openai', 'external-worker', 'worker_backfill',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return Boolean(v);
}

function normalise(raw: Record<string, unknown>): UsageLine {
  // Accept both new schema (timestamp) and legacy schema (at)
  const ts = String(raw['timestamp'] ?? raw['at'] ?? '');

  // Map legacy phase values to new schema
  const rawPhase = String(raw['phase'] ?? '');
  const phase = rawPhase || 'preflight';

  // Map legacy event — build a best-guess if absent
  let event = String(raw['event'] ?? '');
  if (!event) {
    if (phase === 'execution') event = 'provider_execution_start';
    else if (phase === 'blocked' || phase === 'failed') event = 'provider_blocked';
    else event = 'provider_preflight';
  }

  const rawDecision = String(raw['decision'] ?? '');
  let decision = rawDecision;
  // Normalise legacy 'execute' → 'success', 'blocked' → 'block'
  if (decision === 'execute') decision = 'success';
  if (decision === 'blocked') decision = 'block';

  // Normalise caller: legacy cto_review → cto
  let caller = String(raw['caller'] ?? 'unknown');
  if (caller === 'cto_review') caller = 'cto';

  return {
    timestamp: ts,
    phase,
    event,
    caller,
    triggerSource: String(raw['triggerSource'] ?? 'unknown'),
    provider: String(raw['provider'] ?? raw['provider'] ?? 'unknown'),
    model: raw['model'] ? String(raw['model']) : null,
    taskId: raw['taskId'] ? String(raw['taskId']) : (raw['task_id'] ? String(raw['task_id']) : null),
    jobName: raw['jobName'] ? String(raw['jobName']) : null,
    decision,
    skipReason: raw['skipReason'] ? String(raw['skipReason']) : (raw['skip_reason'] ? String(raw['skip_reason']) : null),
    errorCode: raw['errorCode'] ? String(raw['errorCode']) : null,
    errorMessage: raw['errorMessage'] ? String(raw['errorMessage']) : null,
    parsed: parseBool(raw['parsed'] ?? true),
    premiumRequests: parseNum(raw['premiumRequests']),
    inputTokens: parseNum(raw['inputTokens']),
    outputTokens: parseNum(raw['outputTokens']),
    cachedTokens: parseNum(raw['cachedTokens']),
    rateLimit: raw['rateLimit'] ? String(raw['rateLimit']) : null,
    durationMs: parseNum(raw['durationMs']),
    source: String(raw['source'] ?? 'unknown'),
    desiredModel: raw['desiredModel'] ? String(raw['desiredModel']) : null,
    actualModel: raw['actualModel'] ? String(raw['actualModel']) : null,
    modelPropagationStatus: raw['modelPropagationStatus'] ? String(raw['modelPropagationStatus']) : null,
    noTaskReason: raw['noTaskReason'] ? String(raw['noTaskReason']) : null,
  };
}

function isToday(isoStr: string): boolean {
  if (!isoStr) return false;
  try {
    const d = new Date(isoStr);
    const today = new Date();
    return (
      d.getUTCFullYear() === today.getUTCFullYear() &&
      d.getUTCMonth() === today.getUTCMonth() &&
      d.getUTCDate() === today.getUTCDate()
    );
  } catch {
    return false;
  }
}

function emptySummary(): RoleSummary {
  return { preflightCount: 0, executionCount: 0, blockedCount: 0, failedCount: 0, premiumRequests: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
}

function addTokens(target: RoleSummary, line: UsageLine): void {
  target.premiumRequests += line.premiumRequests;
  target.inputTokens += line.inputTokens;
  target.outputTokens += line.outputTokens;
  target.cachedTokens += line.cachedTokens;
}

/**
 * Whether a line represents real external quota consumption:
 * - phase is execution
 * - event is success or failed (i.e. provider was actually called)
 * - provider is in external set
 * - decision is NOT skip or block
 */
function isRealExecution(line: UsageLine): boolean {
  if (line.phase !== 'execution' && line.phase !== 'failed') return false;
  if (!EXTERNAL_PROVIDERS.has(line.provider)) return false;
  if (line.decision === 'skip' || line.decision === 'block') return false;
  return (
    line.event === 'provider_execution_success' ||
    line.event === 'provider_execution_failed'
  );
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const logPath = nodePath.join(process.cwd(), 'runtime', 'agent_orchestrator', 'llm_usage.jsonl');

  let lines: UsageLine[] = [];
  try {
    const raw = readFileSync(logPath, 'utf-8');
    lines = raw
      .split('\n')
      .filter(Boolean)
      .map((ln) => {
        try {
          const obj = JSON.parse(ln) as Record<string, unknown>;
          return normalise(obj);
        } catch {
          return null;
        }
      })
      .filter((l): l is UsageLine => l !== null);
  } catch {
    // File absent or unreadable — return empty summary
  }

  // Filter to today's records
  const todayLines = lines.filter((l) => isToday(l.timestamp));

  // Compute Usage Guard warnings from all records (not just today)
  const warnings = computeWarnings(lines);

  // Build aggregations
  const totals = emptySummary();
  const byRole: Record<string, RoleSummary> = {};
  const byProvider: Record<string, RoleSummary> = {};

  for (const line of todayLines) {
    byRole[line.caller] ??= emptySummary();
    byProvider[line.provider] ??= emptySummary();

    const roleBucket = byRole[line.caller];
    const provBucket = byProvider[line.provider];

    if (line.phase === 'preflight') {
      totals.preflightCount++;
      roleBucket.preflightCount++;
      provBucket.preflightCount++;
    } else if (line.phase === 'blocked') {
      totals.blockedCount++;
      roleBucket.blockedCount++;
      provBucket.blockedCount++;
    } else if (line.phase === 'failed') {
      totals.failedCount++;
      roleBucket.failedCount++;
      provBucket.failedCount++;
    } else if (line.phase === 'execution') {
      if (isRealExecution(line)) {
        totals.executionCount++;
        roleBucket.executionCount++;
        provBucket.executionCount++;
        addTokens(totals, line);
        addTokens(roleBucket, line);
        addTokens(provBucket, line);
      }
    }
  }

  // Recent 20 (newest first)
  const recent = [...todayLines].reverse().slice(0, 20);

  const response: UsageSummaryResponse = {
    generatedAt: new Date().toISOString(),
    window: 'today',
    totals,
    byRole,
    byProvider,
    recent,
    warnings,
  };

  return NextResponse.json(response);
}
