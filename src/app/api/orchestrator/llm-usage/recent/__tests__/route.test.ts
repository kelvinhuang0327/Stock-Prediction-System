/** @jest-environment node */

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  readFileSync: jest.fn(),
}));

import { readFileSync } from 'node:fs';
import type { NextRequest } from 'next/server';
import { GET } from '../route';

const mockReadFile = readFileSync as jest.Mock;

function request(url = 'http://localhost/api/orchestrator/llm-usage/recent'): NextRequest {
  return { nextUrl: new URL(url, 'http://localhost') } as unknown as NextRequest;
}

describe('GET /api/orchestrator/llm-usage/recent', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns an empty list when the usage log is unavailable', async () => {
    mockReadFile.mockImplementation(() => { throw new Error('missing file'); });

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, count: 0, records: [] });
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining('runtime/agent_orchestrator/llm_usage.jsonl'),
      'utf-8',
    );
  });

  test('normalizes legacy and current fields, skips malformed lines, and returns newest records first', async () => {
    const rows = [
      { phase: 'execution', decision: 'execute', caller: 'cto_review', provider: '  openai  ', task_id: 'legacy-task', skip_reason: 'old skip', parsed: 'false' },
      { phase: 'blocked', decision: 'blocked', caller: 'manual', provider: '', at: 'time-2', taskId: 'task-2', skipReason: 'new skip', parsed: false },
      { phase: 'failed', event: 'explicit-event', decision: 'retry', caller: 'worker', provider: 'copilot', timestamp: 'time-3', model: 'm1', errorCode: 'E_RATE', errorMessage: 'limited', parsed: 'true', premiumRequests: '2', inputTokens: '10', outputTokens: '5', cachedTokens: '4', rateLimit: '10/min', durationMs: '120', desiredModel: 'm2', actualModel: 'm1', modelPropagationStatus: 'fallback', noTaskReason: 'none' },
      { phase: 'custom', decision: '', caller: null, provider: null, timestamp: null, taskId: '', task_id: 'fallback-task', skipReason: '', skip_reason: 'legacy reason', parsed: 0 },
      { phase: 'execution', event: 'custom-event', decision: 'execute', caller: 'cto_review', provider: '   ', model: '', taskId: '', task_id: '', parsed: true },
      {},
    ];
    mockReadFile.mockReturnValue([...rows.map((row) => JSON.stringify(row)), '{broken json', ''].join('\n'));

    const response = await GET(request('?limit=20'));
    const body = await response.json();

    expect(body.count).toBe(6);
    expect(body.records.map((row: { phase: string }) => row.phase)).toEqual(['preflight', 'execution', 'custom', 'failed', 'blocked', 'execution']);
    expect(body.records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'execution', event: 'provider_execution_start', caller: 'cto', provider: 'openai',
        decision: 'success', taskId: 'legacy-task', skipReason: 'old skip', parsed: false,
      }),
      expect.objectContaining({
        phase: 'blocked', event: 'provider_blocked', provider: 'unknown', decision: 'block',
        taskId: 'task-2', skipReason: 'new skip', parsed: false,
      }),
      expect.objectContaining({
        phase: 'failed', event: 'explicit-event', timestamp: 'time-3', caller: 'worker', provider: 'copilot',
        model: 'm1', decision: 'retry', parsed: true, premiumRequests: 2, inputTokens: 10,
        outputTokens: 5, cachedTokens: 4, durationMs: 120, noTaskReason: 'none',
      }),
      expect.objectContaining({
        phase: 'custom', event: 'provider_preflight', caller: 'unknown', provider: 'unknown',
        timestamp: '', taskId: 'fallback-task', skipReason: 'legacy reason', parsed: true,
      }),
      expect.objectContaining({
        phase: 'preflight', event: 'provider_preflight', caller: 'unknown', provider: 'unknown',
        decision: '', parsed: true, premiumRequests: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, durationMs: 0,
      }),
      expect.objectContaining({ event: 'custom-event', caller: 'cto', provider: 'unknown', decision: 'success', taskId: null }),
    ]));
  });

  test('uses a valid positive limit and falls back for invalid or nonpositive limits', async () => {
    mockReadFile.mockReturnValue(Array.from({ length: 4 }, (_, index) => JSON.stringify({ timestamp: String(index) })).join('\n'));

    const limited = await GET(request('?limit=2'));
    expect((await limited.json()).records.map((row: { timestamp: string }) => row.timestamp)).toEqual(['3', '2']);

    const invalid = await GET(request('?limit=not-a-number'));
    expect((await invalid.json()).count).toBe(4);

    const zero = await GET(request('?limit=0'));
    expect((await zero.json()).count).toBe(4);
  });
});
