/**
 * GET /api/orchestrator/llm-audit/recent
 *
 * Returns the most recent LLM audit events from llm_audit.jsonl.
 * Supports optional query params: limit, runner, provider, blocked.
 *
 * READ-ONLY — never triggers or modifies state.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import type { LlmAuditRecord } from '@/lib/agent-orchestrator/llmAuditGuard';

function auditLogPath(): string {
  return nodePath.join(process.cwd(), 'runtime', 'agent_orchestrator', 'llm_audit.jsonl');
}

function parseNum(v: string | null, fallback: number): number {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const limit = parseNum(searchParams.get('limit'), 50);
  const filterRunner = searchParams.get('runner') ?? '';
  const filterProvider = searchParams.get('provider') ?? '';
  const filterBlocked = searchParams.get('blocked') ?? '';

  let records: LlmAuditRecord[] = [];
  try {
    const raw = readFileSync(auditLogPath(), 'utf-8');
    records = raw
      .split('\n')
      .filter(Boolean)
      .map((ln) => {
        try {
          return JSON.parse(ln) as LlmAuditRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is LlmAuditRecord => r !== null);
  } catch {
    // File absent — return empty
  }

  // Apply filters
  let filtered = records;
  if (filterRunner) {
    filtered = filtered.filter((r) => r.runner_type === filterRunner);
  }
  if (filterProvider) {
    filtered = filtered.filter((r) => r.provider === filterProvider);
  }
  if (filterBlocked === 'true') {
    filtered = filtered.filter((r) => r.blocked);
  } else if (filterBlocked === 'false') {
    filtered = filtered.filter((r) => !r.blocked);
  }

  // Most recent first, cap at limit
  const recent = filtered.slice(-limit).reverse();

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    count: recent.length,
    records: recent,
  });
}
