import { promises as fs } from 'node:fs';
import path from 'node:path';

jest.mock('@/lib/prisma', () => {
  const delegate = (methods: Record<string, unknown>) => methods;
  return {
    prisma: {
      stockQuote: delegate({
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        fields: { low: 'low', high: 'high' },
      }),
      institutionalChip: delegate({ findFirst: jest.fn().mockResolvedValue(null) }),
      jobRunLog: delegate({ findMany: jest.fn().mockResolvedValue([]) }),
      simulatedTrade: delegate({
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      }),
      tradeReviewReport: delegate({ count: jest.fn().mockResolvedValue(0) }),
      strategyLearningInsight: delegate({
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      }),
      tradeJournalEntry: delegate({ count: jest.fn().mockResolvedValue(0) }),
      marketIndex: delegate({ findFirst: jest.fn().mockResolvedValue(null) }),
      strategyProposal: delegate({
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      }),
    },
  };
});

jest.mock('../common', () => ({
  MINER_STATE_PATH: '/tmp/optimization-miner-run-test/state.json',
  WORKSPACE_ROOT: '/tmp/optimization-miner-run-test/empty-workspace',
  fileExists: jest.fn().mockResolvedValue(false),
  readJsonFile: jest.fn(),
  writeJsonFile: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '@/lib/prisma';
import { fileExists, readJsonFile, writeJsonFile } from '../common';
import {
  compositeDedupeKey,
  runCompositeOptimizationMiner,
  runOptimizationMiner,
} from '../optimizationMiner';
import type { ProjectProfile, TaskRecord } from '../types';

const mockedPrisma = prisma as unknown as {
  stockQuote: { findFirst: jest.Mock; count: jest.Mock; fields: Record<string, string> };
  institutionalChip: { findFirst: jest.Mock };
  jobRunLog: { findMany: jest.Mock };
  simulatedTrade: { count: jest.Mock; findMany: jest.Mock; groupBy: jest.Mock };
  tradeReviewReport: { count: jest.Mock };
  strategyLearningInsight: { findFirst: jest.Mock; count: jest.Mock };
  tradeJournalEntry: { count: jest.Mock };
  marketIndex: { findFirst: jest.Mock };
  strategyProposal: { count: jest.Mock; findMany: jest.Mock };
};
const mockedFileExists = fileExists as jest.MockedFunction<typeof fileExists>;
const mockedReadJsonFile = readJsonFile as jest.MockedFunction<typeof readJsonFile>;
const mockedWriteJsonFile = writeJsonFile as jest.MockedFunction<typeof writeJsonFile>;
const fakeWorkspace = '/tmp/optimization-miner-run-test/empty-workspace';
const minerStatePath = '/tmp/optimization-miner-run-test/state.json';

function seedPublishedComposite(dedupeKey: string): void {
  const state = {
    version: '1.0',
    publishedDedupeKeys: { [dedupeKey]: new Date().toISOString() },
    dailyQuota: { date: new Date().toISOString().slice(0, 10), highRisk: 0, mediumRisk: 0, lowRisk: 0 },
    lastRunAt: null,
  };
  mockedFileExists.mockImplementation(async (filePath) => filePath === minerStatePath);
  mockedReadJsonFile.mockImplementation(async () => state as never);
}

function sameDayCompositeTask(
  dedupeKey: string,
  status: string,
  properties: Record<string, unknown> = {},
): TaskRecord {
  return {
    taskId: 11,
    status,
    plannerContext: { dedupeKey },
    ...properties,
  } as unknown as TaskRecord;
}

function queryMocks(): jest.Mock[] {
  return [
    mockedPrisma.stockQuote.findFirst,
    mockedPrisma.stockQuote.count,
    mockedPrisma.institutionalChip.findFirst,
    mockedPrisma.jobRunLog.findMany,
    mockedPrisma.simulatedTrade.count,
    mockedPrisma.simulatedTrade.findMany,
    mockedPrisma.simulatedTrade.groupBy,
    mockedPrisma.tradeReviewReport.count,
    mockedPrisma.strategyLearningInsight.findFirst,
    mockedPrisma.strategyLearningInsight.count,
    mockedPrisma.tradeJournalEntry.count,
    mockedPrisma.marketIndex.findFirst,
    mockedPrisma.strategyProposal.count,
    mockedPrisma.strategyProposal.findMany,
  ];
}

describe('runOptimizationMiner', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await fs.rm('/tmp/optimization-miner-run-test', { recursive: true, force: true });
    mockedPrisma.stockQuote.findFirst.mockResolvedValue(null);
    mockedPrisma.stockQuote.count.mockResolvedValue(0);
    mockedPrisma.institutionalChip.findFirst.mockResolvedValue(null);
    mockedPrisma.jobRunLog.findMany.mockResolvedValue([]);
    mockedPrisma.simulatedTrade.count.mockResolvedValue(0);
    mockedPrisma.simulatedTrade.findMany.mockResolvedValue([]);
    mockedPrisma.simulatedTrade.groupBy.mockResolvedValue([]);
    mockedPrisma.tradeReviewReport.count.mockResolvedValue(0);
    mockedPrisma.strategyLearningInsight.count.mockResolvedValue(0);
    mockedPrisma.strategyLearningInsight.findFirst.mockResolvedValue(null);
    mockedPrisma.tradeJournalEntry.count.mockResolvedValue(0);
    mockedPrisma.marketIndex.findFirst.mockResolvedValue(null);
    mockedPrisma.strategyProposal.count.mockResolvedValue(0);
    mockedPrisma.strategyProposal.findMany.mockResolvedValue([]);
    mockedFileExists.mockResolvedValue(false);
    mockedReadJsonFile.mockReset();
    mockedWriteJsonFile.mockResolvedValue(undefined);
  });

  it('selects the highest-priority actionable candidate and persists miner state', async () => {
    const result = await runOptimizationMiner([], {} as ProjectProfile);

    expect(result).not.toBeNull();
    expect(result?.candidate.taskId).toBe('system_health__stale_quotes');
    expect(result?.totalMined).toBeGreaterThan(0);
    expect(result?.sourcesActive).toContain('system_health');
    expect(result?.draft.contract.version).toBe('2.0');
    expect(writeJsonFile).toHaveBeenCalledWith(
      '/tmp/optimization-miner-run-test/state.json',
      expect.objectContaining({
        lastRunAt: expect.any(String),
        publishedDedupeKeys: expect.objectContaining({
          system_health__stale_quotes: expect.any(String),
        }),
      }),
    );
  });

  it('builds and persists a five-domain composite plan when no same-day plan exists', async () => {
    const result = await runCompositeOptimizationMiner([], {} as ProjectProfile);

    expect(result).not.toBeNull();
    expect(result?.buckets).toHaveLength(5);
    expect(result?.realBuckets).toBeGreaterThan(0);
    expect(result?.fallbackBuckets).toBeGreaterThan(0);
    expect(result?.dedupeKey).toBe(compositeDedupeKey());
    expect(result?.draft.contract.expected_duration_hours).toBe(8);
    expect(mockedWriteJsonFile).toHaveBeenCalledWith(
      '/tmp/optimization-miner-run-test/state.json',
      expect.objectContaining({
        publishedDedupeKeys: expect.objectContaining({
          [result!.dedupeKey]: expect.any(String),
        }),
      }),
    );
  });

  it('does not create a duplicate plan while a same-day composite task is queued', async () => {
    const dedupeKey = compositeDedupeKey();
    const inFlightTask = {
      taskId: 99,
      status: 'QUEUED',
      plannerContext: { dedupeKey },
    } as unknown as TaskRecord;

    await expect(runCompositeOptimizationMiner([inFlightTask], {} as ProjectProfile)).resolves.toBeNull();
    expect(mockedWriteJsonFile).not.toHaveBeenCalled();
    expect(mockedPrisma.stockQuote.findFirst).not.toHaveBeenCalled();
  });

  it('does not republish a stored composite when no same-day task can justify it', async () => {
    const dedupeKey = compositeDedupeKey();
    seedPublishedComposite(dedupeKey);

    await expect(runCompositeOptimizationMiner([], {} as ProjectProfile)).resolves.toBeNull();
    expect(mockedWriteJsonFile).not.toHaveBeenCalled();
    expect(mockedPrisma.stockQuote.findFirst).not.toHaveBeenCalled();
  });

  it.each(['FAILED', 'FAILED_RATE_LIMIT', 'REPLAN_REQUIRED', 'CANCELLED'])(
    'allows a retryable same-day task with status %s to republish its composite',
    async (status) => {
      const dedupeKey = compositeDedupeKey();
      seedPublishedComposite(dedupeKey);

      const result = await runCompositeOptimizationMiner(
        [sameDayCompositeTask(dedupeKey, status)],
        {} as ProjectProfile,
      );

      expect(result?.dedupeKey).toBe(dedupeKey);
      expect(mockedWriteJsonFile).toHaveBeenCalled();
    },
  );

  it('allows republishing after a simulated-fallback completion', async () => {
    const dedupeKey = compositeDedupeKey();
    const completedPath = '/tmp/optimization-miner-run-test/completed.md';
    await fs.mkdir(path.dirname(completedPath), { recursive: true });
    await fs.writeFile(completedPath, 'Execution mode: simulated fallback');
    seedPublishedComposite(dedupeKey);
    mockedFileExists.mockImplementation(async (filePath) =>
      filePath === minerStatePath || filePath === completedPath,
    );

    const result = await runCompositeOptimizationMiner(
      [sameDayCompositeTask(dedupeKey, 'COMPLETED', { completedPath })],
      {} as ProjectProfile,
    );

    expect(result?.dedupeKey).toBe(dedupeKey);
    expect(mockedWriteJsonFile).toHaveBeenCalled();
  });

  it('allows republishing when the completed result failed its gate', async () => {
    const dedupeKey = compositeDedupeKey();
    const resultPath = '/tmp/optimization-miner-run-test/result.json';
    seedPublishedComposite(dedupeKey);
    mockedFileExists.mockImplementation(async (filePath) =>
      filePath === minerStatePath || filePath === resultPath,
    );
    mockedReadJsonFile.mockImplementation(async (filePath) => {
      if (filePath === minerStatePath) {
        return {
          version: '1.0',
          publishedDedupeKeys: { [dedupeKey]: new Date().toISOString() },
          dailyQuota: { date: new Date().toISOString().slice(0, 10), highRisk: 0, mediumRisk: 0, lowRisk: 0 },
          lastRunAt: null,
        } as never;
      }
      return { gate_verdict: 'FAIL' } as never;
    });

    const result = await runCompositeOptimizationMiner(
      [sameDayCompositeTask(dedupeKey, 'COMPLETED', { resultPath })],
      {} as ProjectProfile,
    );

    expect(result?.dedupeKey).toBe(dedupeKey);
    expect(mockedWriteJsonFile).toHaveBeenCalled();
  });

  it('does not republish a passing result without fallback delivery', async () => {
    const dedupeKey = compositeDedupeKey();
    const resultPath = '/tmp/optimization-miner-run-test/result.json';
    seedPublishedComposite(dedupeKey);
    mockedFileExists.mockImplementation(async (filePath) =>
      filePath === minerStatePath || filePath === resultPath,
    );
    mockedReadJsonFile.mockImplementation(async (filePath) => {
      if (filePath === minerStatePath) {
        return {
          version: '1.0',
          publishedDedupeKeys: { [dedupeKey]: new Date().toISOString() },
          dailyQuota: { date: new Date().toISOString().slice(0, 10), highRisk: 0, mediumRisk: 0, lowRisk: 0 },
          lastRunAt: null,
        } as never;
      }
      return { gate_verdict: 'PASS', acceptance_results: [{ name: 'all checks' }] } as never;
    });

    await expect(runCompositeOptimizationMiner(
      [sameDayCompositeTask(dedupeKey, 'COMPLETED', { resultPath })],
      {} as ProjectProfile,
    )).resolves.toBeNull();
    expect(mockedWriteJsonFile).not.toHaveBeenCalled();
  });

  it('allows republishing when a passing result reports fallback delivery', async () => {
    const dedupeKey = compositeDedupeKey();
    const resultPath = '/tmp/optimization-miner-run-test/result.json';
    seedPublishedComposite(dedupeKey);
    mockedFileExists.mockImplementation(async (filePath) =>
      filePath === minerStatePath || filePath === resultPath,
    );
    mockedReadJsonFile.mockImplementation(async (filePath) => {
      if (filePath === minerStatePath) {
        return {
          version: '1.0',
          publishedDedupeKeys: { [dedupeKey]: new Date().toISOString() },
          dailyQuota: { date: new Date().toISOString().slice(0, 10), highRisk: 0, mediumRisk: 0, lowRisk: 0 },
          lastRunAt: null,
        } as never;
      }
      return { gate_verdict: 'PASS', acceptance_results: [{ name: 'fallback delivery used' }] } as never;
    });

    const result = await runCompositeOptimizationMiner(
      [sameDayCompositeTask(dedupeKey, 'COMPLETED', { resultPath })],
      {} as ProjectProfile,
    );

    expect(result?.dedupeKey).toBe(dedupeKey);
    expect(mockedWriteJsonFile).toHaveBeenCalled();
  });

  it('mines code, UI, documentation, and test gaps from observed workspace files', async () => {
    const putFile = async (relativePath: string, contents: string, ageDays?: number): Promise<void> => {
      const filePath = path.join(fakeWorkspace, relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, contents);
      if (ageDays !== undefined) {
        const oldTime = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
        await fs.utimes(filePath, oldTime, oldTime);
      }
    };

    const largeSource = Array.from({ length: 510 }, (_, line) => `export const item${line} = ${line};`).join('\n');
    await putFile('src/lib/largeOne.ts', largeSource);
    await putFile('src/lib/largeTwo.ts', largeSource);
    await putFile('src/lib/signalMetric.ts', 'export {};');
    await putFile('src/lib/signalMetricV2.ts', 'export {};');
    await putFile('src/lib/marketScan.ts', 'export {};');
    await putFile('src/lib/marketScanV2.ts', 'export {};');
    await putFile('src/lib/quoteSync.ts', 'export {};');
    await putFile('src/lib/quoteSyncV2.ts', 'export {};');
    for (let index = 0; index < 10; index += 1) {
      await putFile(`src/lib/todo-${index}.ts`, `// TODO: resolve task ${index}\nexport {};`);
    }
    await putFile('src/lib/agent-orchestrator/alpha.ts', 'export {};');
    await putFile('src/lib/agent-orchestrator/beta.ts', 'export {};');
    await putFile('src/lib/agent-orchestrator/gamma.ts', 'export {};');
    for (const route of ['one', 'two', 'three']) {
      await putFile(`src/app/${route}/page.tsx`, 'export default function Page() { return null; }');
    }
    await putFile('src/app/orchestrator/page.tsx', 'export default function Page() { return null; }', 20);
    for (const file of ['wiki/one.md', 'wiki/two.md', 'wiki/three.md', 'docs/four.md', 'docs/five.md']) {
      await putFile(file, '# Old operational guide', 60);
    }
    await putFile('USER_GUIDE.md', '# Operator guide', 20);

    mockedFileExists.mockImplementation(async (filePath) =>
      filePath.endsWith('/USER_GUIDE.md') || filePath.endsWith('/src/app/orchestrator/page.tsx'),
    );

    const result = await runOptimizationMiner([], {} as ProjectProfile);

    expect(result).not.toBeNull();
    expect(result?.totalMined).toBeGreaterThanOrEqual(8);
    expect(result?.sourcesActive).toEqual(expect.arrayContaining([
      'code_quality', 'ui_ux', 'wiki_docs', 'test_coverage',
    ]));
  });

  it('keeps the filesystem coverage finding when database-backed sources fail', async () => {
    for (const query of queryMocks()) query.mockRejectedValue(new Error('database unavailable'));

    const result = await runOptimizationMiner([], {} as ProjectProfile);

    expect(result?.candidate.taskId).toBe('test_coverage__missing_e2e_flows');
    expect(result?.sourcesActive).toEqual(['test_coverage']);
    expect(writeJsonFile).toHaveBeenCalled();
  });

  it('mines representative database and filesystem quality findings together', async () => {
    const recent = new Date();
    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    mockedPrisma.stockQuote.findFirst.mockImplementation(async () => ({ createdAt: recent, stockId: '2330' }) as never);
    mockedPrisma.stockQuote.count.mockImplementation(async (input: unknown) => {
      const where = (input as { where?: Record<string, unknown> }).where ?? {};
      if ('volume' in where) return 1 as never;
      if ('OR' in where) return 2 as never;
      if ('stockId' in where) return 100 as never;
      return 0 as never;
    });
    mockedPrisma.institutionalChip.findFirst.mockImplementation(async () => ({ createdAt: recent, stockId: '2330' }) as never);
    mockedPrisma.jobRunLog.findMany.mockResolvedValue([
      { jobName: 'quote-sync', errorMessage: null, scheduledFor: recent },
      { jobName: 'daily-report', errorMessage: 'timeout', scheduledFor: recent },
    ] as never);
    mockedPrisma.simulatedTrade.count.mockImplementation(async (input: unknown) => {
      const where = (input as {
        where?: {
          createdAt?: { lte?: unknown };
          status?: string | { in?: string[] };
          updatedAt?: unknown;
        };
      }).where;
      if (where?.createdAt?.lte) return 3 as never;
      if (where?.updatedAt) return 0 as never;
      if (where?.status === 'closed') return 3 as never;
      if (typeof where?.status === 'object') return 12 as never;
      return 0 as never;
    });
    mockedPrisma.simulatedTrade.findMany.mockImplementation(async (input: unknown) => {
      const query = input as { select?: Record<string, boolean>; take?: number };
      const select = query.select ?? {};
      if (select.tradeMode) return ['shadow', 'shadow', 'shadow', 'shadow', 'full'].map((tradeMode) => ({ tradeMode })) as never;
      if (select.exitReason) {
        return Array.from({ length: 5 }, (_, index) => ({
          exitReason: index < 3 ? 'time limit' : 'target',
          mfePct: index < 3 ? 4 : null,
          maePct: index < 3 ? -2 : null,
          pnlPct: 1,
          holdingDays: 8,
        })) as never;
      }
      if (select.holdingDays) {
        return [
          { id: 1, symbol: '2330', setupType: 'momentum', holdingDays: 35, entryDate: '2026-09-01' },
          { id: 2, symbol: '2317', setupType: 'rebound', holdingDays: 40, entryDate: '2026-08-20' },
        ] as never;
      }
      if (select.createdAt && select.id) {
        return [
          { id: 1, symbol: '2330', setupType: 'momentum', createdAt: recent },
          { id: 2, symbol: '2317', setupType: 'rebound', createdAt: recent },
          { id: 3, symbol: '2454', setupType: 'momentum', createdAt: recent },
        ] as never;
      }
      if (select.tradeMode) return [] as never;
      if (select.triggerScore && select.setupType && select.symbol) {
        if (query.take === 50) {
          return Array.from({ length: 8 }, (_, index) => ({ triggerScore: 0.11 + index * 0.005, symbol: `SYM${index}` })) as never;
        }
        return Array.from({ length: 10 }, (_, index) => ({
          triggerScore: 0.1 + index * 0.005,
          setupType: index < 9 ? 'momentum' : 'rebound',
          symbol: `SYM${index}`,
        })) as never;
      }
      if (select.triggerScore && select.setupType) {
        return Array.from({ length: 10 }, () => ({ setupType: 'momentum', triggerScore: 0.12 })) as never;
      }
      if (select.setupType && select.pnlPct) {
        return Array.from({ length: 10 }, () => ({ setupType: 'momentum', pnlPct: 1 })) as never;
      }
      return [] as never;
    });
    mockedPrisma.simulatedTrade.groupBy.mockImplementation(async (input: unknown) => {
      const by = (input as { by?: string[] }).by ?? [];
      if (by.includes('symbol')) return [{ symbol: '2330' }] as never;
      return [{ setupType: 'momentum', _count: { id: 8 } }] as never;
    });
    mockedPrisma.tradeReviewReport.count.mockResolvedValue(0);
    mockedPrisma.strategyLearningInsight.findFirst.mockImplementation(async () => ({ createdAt: old }) as never);
    mockedPrisma.strategyLearningInsight.count.mockResolvedValue(0);
    mockedPrisma.tradeJournalEntry.count.mockResolvedValue(0);
    mockedPrisma.marketIndex.findFirst.mockImplementation(async () => ({
      createdAt: recent,
      name: 'TAIEX',
      changePercent: 0.3,
    }) as never);
    mockedPrisma.strategyProposal.count.mockResolvedValue(5);
    mockedPrisma.strategyProposal.findMany.mockResolvedValue([
      { symbol: '2330', setupType: 'momentum' },
      { symbol: '2317', setupType: 'rebound' },
      { symbol: '2454', setupType: 'momentum' },
    ] as never);

    const putFile = async (relativePath: string, contents: string, ageDays?: number): Promise<void> => {
      const filePath = path.join(fakeWorkspace, relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, contents);
      if (ageDays !== undefined) {
        const oldTime = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
        await fs.utimes(filePath, oldTime, oldTime);
      }
    };
    const largeSource = Array.from({ length: 510 }, (_, index) => `export const item${index} = ${index};`).join('\n');
    await putFile('src/lib/largeOne.ts', largeSource);
    await putFile('src/lib/largeTwo.ts', largeSource);
    for (let index = 0; index < 10; index += 1) await putFile(`src/todo-${index}.ts`, '// TODO: triage\nexport {};');
    for (const [left, right] of [['signalScan', 'signalScanV2'], ['quoteSync', 'quoteSyncV2'], ['marketView', 'marketViewV2']]) {
      await putFile(`src/lib/${left}.ts`, 'export {};');
      await putFile(`src/lib/${right}.ts`, 'export {};');
    }
    for (const route of ['one', 'two', 'orchestrator']) {
      const contents = route === 'orchestrator'
        ? Array.from({ length: 350 }, (_, index) => `const view${index} = ${index};`).join('\n')
        : 'export default function Page() { return null; }';
      await putFile(`src/app/${route}/page.tsx`, contents, route === 'orchestrator' ? 20 : undefined);
    }
    for (const file of ['wiki/one.md', 'wiki/two.md', 'wiki/three.md', 'docs/four.md', 'docs/five.md']) {
      await putFile(file, '# Stale guide', 60);
    }
    await putFile('USER_GUIDE.md', '# Operator guide', 20);
    for (const script of ['legacy-a.py', 'legacy-b.py', 'legacy-c.py']) await putFile(script, 'print("legacy")');
    for (const moduleName of ['uncoveredA.ts', 'uncoveredB.ts', 'uncoveredC.ts']) {
      await putFile(`src/lib/agent-orchestrator/${moduleName}`, 'export {};');
    }
    mockedFileExists.mockImplementation(async (filePath) =>
      filePath.endsWith('/USER_GUIDE.md') || filePath.endsWith('/src/app/orchestrator/page.tsx'),
    );

    const result = await runOptimizationMiner([], {} as ProjectProfile);

    expect(result).not.toBeNull();
    expect(result?.totalMined).toBeGreaterThanOrEqual(20);
    expect(result?.sourcesActive).toEqual(expect.arrayContaining([
      'system_health', 'execution_layer', 'lifecycle', 'learning_layer',
      'price_analysis_quality', 'code_quality', 'ui_ux', 'wiki_docs', 'test_coverage',
    ]));
  });

  it('omits price-analysis findings when quote and trade data are healthy', async () => {
    const recent = new Date();
    mockedPrisma.stockQuote.findFirst.mockImplementation(async () => ({ createdAt: recent, stockId: '2330' }) as never);
    mockedPrisma.stockQuote.count.mockResolvedValue(0);
    mockedPrisma.institutionalChip.findFirst.mockImplementation(async () => ({ createdAt: recent, stockId: '2330' }) as never);
    mockedPrisma.jobRunLog.findMany.mockResolvedValue([]);
    mockedPrisma.simulatedTrade.count.mockImplementation(async (input: unknown) => {
      const where = (input as { where?: { status?: string; updatedAt?: unknown } }).where;
      if (where?.status === 'closed' && where.updatedAt) return 6 as never;
      if (where?.status === 'closed') return 6 as never;
      return 0 as never;
    });
    mockedPrisma.simulatedTrade.findMany.mockResolvedValue([]);
    mockedPrisma.simulatedTrade.groupBy.mockResolvedValue([]);
    mockedPrisma.tradeReviewReport.count.mockResolvedValue(1);
    mockedPrisma.strategyLearningInsight.findFirst.mockImplementation(async () => ({ createdAt: recent }) as never);
    mockedPrisma.strategyLearningInsight.count.mockResolvedValue(1);
    mockedPrisma.tradeJournalEntry.count.mockResolvedValue(1);
    mockedPrisma.marketIndex.findFirst.mockImplementation(async () => ({ createdAt: recent }) as never);
    mockedPrisma.strategyProposal.count.mockResolvedValue(0);
    mockedPrisma.strategyProposal.findMany.mockResolvedValue([]);

    const result = await runOptimizationMiner([], {} as ProjectProfile);

    expect(result).not.toBeNull();
    expect(result?.sourcesActive).not.toContain('price_analysis_quality');
    expect(result?.sourcesActive).not.toContain('system_health');
  });

  afterAll(async () => {
    await fs.rm('/tmp/optimization-miner-run-test', { recursive: true, force: true });
  });
});
