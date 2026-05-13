/**
 * GET /api/orchestrator/llm-audit/today
 *
 * Returns an aggregated summary of today's LLM audit events from llm_audit.jsonl,
 * grouped by usage_role and provider.
 *
 * READ-ONLY — never triggers or modifies state.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { NextResponse } from 'next/server';
import type { LlmAuditRecord } from '@/lib/agent-orchestrator/llmAuditGuard';

function auditLogPath(): string {
  return nodePath.join(process.cwd(), 'runtime', 'agent_orchestrator', 'llm_audit.jsonl');
}

interface AuditRoleSummary {
  attemptCount: number;
  resultSuccessCount: number;
  resultFailedCount: number;
  blockedCount: number;
  totalDurationMs: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  premiumRequests: number;
}

interface AuditTodayResponse {
  generatedAt: string;
  window: 'today';
  totals: AuditRoleSummary;
  byRole: Record<string, AuditRoleSummary>;
  byProvider: Record<string, AuditRoleSummary>;
  recentBlocked: LlmAuditRecord[];
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

function emptySummary(): AuditRoleSummary {
  return {
    attemptCount: 0,
    resultSuccessCount: 0,
    resultFailedCount: 0,
    blockedCount: 0,
    totalDurationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    totalTokens: 0,
    premiumRequests: 0,
  };
}

function accumulate(target: AuditRoleSummary, record: LlmAuditRecord): void {
  if (record.event_type === 'LLM_CALL_ATTEMPT') {
    target.attemptCount++;
  } else if (record.event_type === 'LLM_CALL_RESULT') {
    if (record.success) {
      target.resultSuccessCount++;
    } else {
      target.resultFailedCount++;
    }
    target.totalDurationMs += record.duration_ms ?? 0;
    target.inputTokens += record.input_tokens ?? 0;
    target.outputTokens += record.output_tokens ?? 0;
    target.cachedTokens += record.cached_tokens ?? 0;
    target.totalTokens += record.total_tokens ?? 0;
    target.premiumRequests += record.premium_requests ?? 0;
  } else if (record.event_type === 'LLM_CALL_BLOCKED') {
    target.blockedCount++;
  }
}

export async function GET(): Promise<NextResponse> {
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

  const todayRecords = records.filter((r) => isToday(r.timestamp));

  const totals = emptySummary();
  const byRole: Record<string, AuditRoleSummary> = {};
  const byProvider: Record<string, AuditRoleSummary> = {};

  for (const record of todayRecords) {
    byRole[record.usage_role] ??= emptySummary();
    byProvider[record.provider] ??= emptySummary();
    accumulate(totals, record);
    accumulate(byRole[record.usage_role], record);
    accumulate(byProvider[record.provider], record);
  }

  const recentBlocked = todayRecords
    .filter((r) => r.event_type === 'LLM_CALL_BLOCKED')
    .slice(-10)
    .reverse();

  const response: AuditTodayResponse = {
    generatedAt: new Date().toISOString(),
    window: 'today',
    totals,
    byRole,
    byProvider,
    recentBlocked,
  };

  return NextResponse.json({ ok: true, ...response });
}
