/**
 * CTO Review Schema Fix — focused tests
 *
 * Verifies:
 * 1. ctoDecision field is accepted in StrategyProposal.findMany where clause
 * 2. ctoDecision + ctoDecisionReason are written back via update()
 * 3. logProviderPreflight fires before any DB operation
 * 4. No external LLM execution occurs (executionStart is never called)
 * 5. Tick returns correctly even when no proposals are pending
 */

import { appendFileSync } from 'node:fs';

jest.mock('node:fs', () => ({
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

const mockAppend = appendFileSync as jest.Mock;

// ── Prisma mock ──────────────────────────────────────────────────────────────
jest.mock('@/lib/prisma', () => ({
  prisma: {
    strategyProposal: {
      findMany: jest.fn().mockResolvedValue([]),
      update:   jest.fn().mockResolvedValue({}),
    },
    strategyLearningInsight: { findMany: jest.fn().mockResolvedValue([]) },
    simulatedTrade: { findMany: jest.fn().mockResolvedValue([]) },
    ctoReviewRun:   { create: jest.fn().mockResolvedValue({ runId: 'run-test' }) },
    ctoIntentSignal: { createMany: jest.fn().mockResolvedValue({ count: 3 }) },
  },
}));

jest.mock('../backlogService',         () => ({ batchInsertBacklogItems: jest.fn().mockResolvedValue(0) }));
jest.mock('../signalStateClassifier',  () => ({ classifySignalState:     jest.fn().mockResolvedValue({ state: 'NORMAL', confidenceLabel: 'high' }) }));

import { prisma } from '@/lib/prisma';
import { runCtoReviewTick } from '../ctoReviewTick';

const mockFindMany = prisma.strategyProposal.findMany as jest.Mock;
const mockUpdate   = prisma.strategyProposal.update   as jest.Mock;

// ── Helpers ──────────────────────────────────────────────────────────────────
function writtenRecords(): Record<string, unknown>[] {
  return mockAppend.mock.calls.map((c) => JSON.parse(c[1] as string) as Record<string, unknown>);
}

beforeEach(() => {
  mockAppend.mockClear();
  mockFindMany.mockClear();
  mockFindMany.mockResolvedValue([]);
  mockUpdate.mockClear();
  mockUpdate.mockResolvedValue({});
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. findMany is called with ctoDecision: null filter — proves schema accepted
// ─────────────────────────────────────────────────────────────────────────────
test('1. findMany uses ctoDecision:null filter — no schema mismatch', async () => {
  mockFindMany.mockResolvedValue([]);

  await runCtoReviewTick({ isManual: true });

  expect(mockFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ ctoDecision: null }),
    }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. update() writes ctoDecision + ctoDecisionReason for each candidate
// ─────────────────────────────────────────────────────────────────────────────
test('2. update writes ctoDecision and ctoDecisionReason for each proposal', async () => {
  mockFindMany.mockResolvedValue([
    { id: 10, symbol: 'TSLA', setupType: 'trend', conviction: 'high' },
    { id: 11, symbol: 'NVDA', setupType: 'rebound', conviction: 'medium' },
  ]);

  await runCtoReviewTick({ isManual: true });

  expect(mockUpdate).toHaveBeenCalledTimes(2);

  for (const call of mockUpdate.mock.calls) {
    const { data } = call[0] as { where: unknown; data: Record<string, unknown> };
    expect(data).toHaveProperty('ctoDecision');
    expect(data).toHaveProperty('ctoDecisionReason');
    expect(typeof data['ctoDecision']).toBe('string');
    expect(typeof data['ctoDecisionReason']).toBe('string');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. preflight log fires before any Prisma call
// ─────────────────────────────────────────────────────────────────────────────
test('3. preflight log is written before any DB operation', async () => {
  mockFindMany.mockResolvedValue([]);

  // Track order: log writes vs findMany call
  const eventOrder: string[] = [];

  mockAppend.mockImplementation(() => { eventOrder.push('log'); });
  mockFindMany.mockImplementation(() => { eventOrder.push('db'); return Promise.resolve([]); });

  await runCtoReviewTick({ isManual: true });

  expect(eventOrder[0]).toBe('log');
  const logIdx = eventOrder.indexOf('log');
  const dbIdx  = eventOrder.indexOf('db');
  expect(logIdx).toBeLessThan(dbIdx);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. preflight log has correct shape for CTO caller
// ─────────────────────────────────────────────────────────────────────────────
test('4. preflight log has caller=cto, phase=preflight, triggerSource=manual', async () => {
  mockFindMany.mockResolvedValue([]);

  await runCtoReviewTick({ isManual: true });

  const records = writtenRecords();
  const preflight = records.find((r) => r['event'] === 'provider_preflight');

  expect(preflight).toBeDefined();
  expect(preflight!['caller']).toBe('cto');
  expect(preflight!['phase']).toBe('preflight');
  expect(preflight!['triggerSource']).toBe('manual');
  expect(preflight!['decision']).toBe('allow');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. No execution_start event emitted (local-review never calls external LLM)
// ─────────────────────────────────────────────────────────────────────────────
test('5. No provider_execution_start is logged — CTO review uses local provider', async () => {
  mockFindMany.mockResolvedValue([
    { id: 20, symbol: 'AAPL', setupType: 'breakout', conviction: 'high' },
  ]);

  await runCtoReviewTick({ isManual: true });

  const records = writtenRecords();
  const execStart = records.find((r) => r['event'] === 'provider_execution_start');
  expect(execStart).toBeUndefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Zero pending proposals — tick returns gracefully, no update() called
// ─────────────────────────────────────────────────────────────────────────────
test('6. Zero pending proposals — tick returns with candidateCount=0, no updates', async () => {
  mockFindMany.mockResolvedValue([]);

  const result = await runCtoReviewTick({ isManual: true });

  expect(result.candidateCount).toBe(0);
  expect(result.acceptedCount).toBe(0);
  expect(mockUpdate).not.toHaveBeenCalled();
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Scheduler trigger — preflight triggerSource is 'scheduler' not 'manual'
// ─────────────────────────────────────────────────────────────────────────────
test('7. Scheduler trigger — preflight triggerSource=scheduler', async () => {
  mockFindMany.mockResolvedValue([]);

  await runCtoReviewTick({ isManual: false });

  const records = writtenRecords();
  const preflight = records.find((r) => r['event'] === 'provider_preflight');

  expect(preflight).toBeDefined();
  expect(preflight!['triggerSource']).toBe('scheduler');
});
