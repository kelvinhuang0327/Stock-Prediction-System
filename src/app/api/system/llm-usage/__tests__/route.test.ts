jest.mock('node:fs', () => {
  const actual = jest.requireActual<typeof import('node:fs')>('node:fs');
  return { ...actual, readFileSync: jest.fn() };
});

jest.mock('@/lib/agent-orchestrator/llmUsageWarnings', () => ({
  computeWarnings: jest.fn().mockReturnValue([]),
}));

jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown) => ({ status: 200, json: async () => body }) },
}));

import { readFileSync } from 'node:fs';
import { computeWarnings } from '@/lib/agent-orchestrator/llmUsageWarnings';
import { GET } from '../route';

const readFileMock = readFileSync as unknown as jest.Mock;
const warningsMock = computeWarnings as jest.MockedFunction<typeof computeWarnings>;

describe('GET /api/system/llm-usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty read-only summary when the usage log cannot be read', async () => {
    readFileMock.mockImplementation(() => { throw new Error('file unavailable'); });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      window: 'today',
      totals: {
        preflightCount: 0,
        executionCount: 0,
        blockedCount: 0,
        failedCount: 0,
        premiumRequests: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
      },
      byRole: {},
      byProvider: {},
      recent: [],
      warnings: [],
    });
    expect(warningsMock).toHaveBeenCalledWith([]);
  });

  it('normalizes legacy records and aggregates only real executions from today', async () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const allTimeWarning = { code: 'provider_spend', message: 'review usage' };
    warningsMock.mockReturnValue([allTimeWarning] as never);
    const records = [
      {
        timestamp: today,
        phase: 'preflight',
        caller: 'cto_review',
        provider: 'codex',
        decision: 'execute',
        premiumRequests: 2,
        inputTokens: 8.9,
        outputTokens: '3',
        cachedTokens: true,
      },
      {
        timestamp: today,
        phase: 'execution',
        event: 'provider_execution_success',
        caller: 'planner',
        provider: 'openai',
        decision: 'success',
        model: 'gpt-test',
        taskId: 'task-1',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 25,
        premiumRequests: 1,
      },
      {
        timestamp: today,
        phase: 'execution',
        event: 'provider_execution_failed',
        caller: 'worker',
        provider: 'claude',
        decision: 'success',
        inputTokens: 7,
        outputTokens: 2,
        cachedTokens: 1,
        durationMs: 12.7,
      },
      { timestamp: today, phase: 'blocked', caller: 'scheduler', provider: 'github-copilot' },
      { timestamp: today, phase: 'failed', caller: 'scheduler', provider: 'github-cli' },
      {
        timestamp: today,
        phase: 'execution',
        event: 'provider_execution_success',
        caller: 'planner',
        provider: 'openai',
        decision: 'skip',
        inputTokens: 999,
      },
      {
        timestamp: today,
        phase: 'execution',
        event: 'provider_execution_success',
        caller: 'local',
        provider: 'internal-provider',
        decision: 'success',
        inputTokens: 999,
      },
      {
        at: today,
        phase: 'execution',
        caller: 'cto_review',
        provider: 'codex',
        decision: 'blocked',
        task_id: 'legacy-task',
        skip_reason: 'no work',
        parsed: 'false',
        inputTokens: -4,
        outputTokens: 'not-a-number',
        durationMs: -2,
      },
      { timestamp: yesterday, phase: 'execution', event: 'provider_execution_success', provider: 'openai', inputTokens: 500 },
    ];
    readFileMock.mockReturnValue(`${records.map((record) => JSON.stringify(record)).join('\n')}\n{bad json\n`);

    const response = await GET();
    const body = await response.json();

    expect(body.totals).toEqual({
      preflightCount: 1,
      executionCount: 2,
      blockedCount: 1,
      failedCount: 1,
      premiumRequests: 1,
      inputTokens: 107,
      outputTokens: 52,
      cachedTokens: 26,
    });
    expect(body.byRole.cto).toMatchObject({ preflightCount: 1, premiumRequests: 0 });
    expect(body.byRole.planner).toMatchObject({ executionCount: 1, inputTokens: 100 });
    expect(body.byRole.worker).toMatchObject({ executionCount: 1, inputTokens: 7 });
    expect(body.byProvider['github-copilot'].blockedCount).toBe(1);
    expect(body.byProvider['github-cli'].failedCount).toBe(1);
    expect(body.recent).toHaveLength(8);
    expect(body.recent[0].timestamp).toBe(today);
    expect(body.recent[7].timestamp).toBe(today);
    expect(body.recent[0]).toMatchObject({
      phase: 'execution',
      event: 'provider_execution_start',
      caller: 'cto',
      taskId: 'legacy-task',
      inputTokens: 0,
    });
    expect(warningsMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ caller: 'cto', decision: 'success', inputTokens: 8, outputTokens: 3, cachedTokens: 1 }),
      expect.objectContaining({ caller: 'cto', decision: 'block', taskId: 'legacy-task', skipReason: 'no work', parsed: false }),
    ]));
    expect(body.warnings).toEqual([allTimeWarning]);
  });

  it('keeps only the newest 20 records in the recent window', async () => {
    const today = new Date().toISOString();
    const records = Array.from({ length: 25 }, (_, index) => ({
      timestamp: today,
      phase: 'preflight',
      caller: `caller-${index}`,
      provider: 'codex',
    }));
    readFileMock.mockReturnValue(records.map((record) => JSON.stringify(record)).join('\n'));

    const body = await (await GET()).json();

    expect(body.totals.preflightCount).toBe(25);
    expect(body.recent).toHaveLength(20);
    expect(body.recent[0].caller).toBe('caller-24');
    expect(body.recent[19].caller).toBe('caller-5');
  });
});
