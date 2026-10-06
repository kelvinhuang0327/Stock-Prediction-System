/**
 * GET /api/orchestrator/llm-usage/recent?limit=20
 *
 * Returns the most recent LLM usage records from llm_usage.jsonl.
 * Supports optional query param: limit (default 20).
 *
 * READ-ONLY.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

interface UsageLine {
  timestamp: string;
  phase: string;
  event: string;
  caller: string;
  triggerSource: string;
  provider: string;
  model: string | null;
  taskId: string | null;
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
  desiredModel: string | null;
  actualModel: string | null;
  modelPropagationStatus: string | null;
  noTaskReason: string | null;
}

function parseNum(v: string | null, fallback: number): number {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return true; // default to true (parsed OK) when field is absent
}

function normalise(raw: Record<string, unknown>): UsageLine {
  const rawPhase = String(raw['phase'] ?? '');
  const phase = rawPhase || 'preflight';

  // Build best-guess event when absent (legacy records)
  let event = String(raw['event'] ?? '');
  if (!event) {
    if (phase === 'execution') event = 'provider_execution_start';
    else if (phase === 'blocked' || phase === 'failed') event = 'provider_blocked';
    else event = 'provider_preflight';
  }

  // Normalise legacy decision values
  let decision = String(raw['decision'] ?? '');
  if (decision === 'execute') decision = 'success';
  if (decision === 'blocked') decision = 'block';

  // Normalise legacy caller: cto_review → cto
  let caller = String(raw['caller'] ?? 'unknown');
  if (caller === 'cto_review') caller = 'cto';

  // Normalise provider: empty string → unknown
  const provider = String(raw['provider'] ?? '').trim() || 'unknown';

  return {
    timestamp: String(raw['timestamp'] ?? raw['at'] ?? ''),
    phase,
    event,
    caller,
    triggerSource: String(raw['triggerSource'] ?? 'unknown'),
    provider,
    model: raw['model'] ? String(raw['model']) : null,
    taskId: raw['taskId'] ? String(raw['taskId']) : (raw['task_id'] ? String(raw['task_id']) : null),
    decision,
    skipReason: raw['skipReason'] ? String(raw['skipReason']) : (raw['skip_reason'] ? String(raw['skip_reason']) : null),
    errorCode: raw['errorCode'] ? String(raw['errorCode']) : null,
    errorMessage: raw['errorMessage'] ? String(raw['errorMessage']) : null,
    parsed: parseBool(raw['parsed']),
    premiumRequests: Number(raw['premiumRequests'] ?? 0),
    inputTokens: Number(raw['inputTokens'] ?? 0),
    outputTokens: Number(raw['outputTokens'] ?? 0),
    cachedTokens: Number(raw['cachedTokens'] ?? 0),
    rateLimit: raw['rateLimit'] ? String(raw['rateLimit']) : null,
    durationMs: Number(raw['durationMs'] ?? 0),
    desiredModel: raw['desiredModel'] ? String(raw['desiredModel']) : null,
    actualModel: raw['actualModel'] ? String(raw['actualModel']) : null,
    modelPropagationStatus: raw['modelPropagationStatus'] ? String(raw['modelPropagationStatus']) : null,
    noTaskReason: raw['noTaskReason'] ? String(raw['noTaskReason']) : null,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const limit = parseNum(searchParams.get('limit'), 20);

  const logPath = nodePath.join(process.cwd(), 'runtime', 'agent_orchestrator', 'llm_usage.jsonl');
  let lines: UsageLine[] = [];
  try {
    const raw = readFileSync(logPath, 'utf-8');
    lines = raw
      .split('\n')
      .filter(Boolean)
      .map((ln) => {
        try {
          return normalise(JSON.parse(ln) as Record<string, unknown>);
        } catch {
          return null;
        }
      })
      .filter((l): l is UsageLine => l !== null);
  } catch {
    // File absent
  }

  const recent = lines.slice(-limit).reverse();
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    count: recent.length,
    records: recent,
  });
}
