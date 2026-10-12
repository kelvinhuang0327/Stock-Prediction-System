jest.mock('../../agent-orchestrator/profile', () => ({
  loadProjectProfile: jest.fn(),
}));

jest.mock('../../agent-orchestrator/storage', () => ({
  loadSchedulerState: jest.fn(),
  loadTaskIndex: jest.fn(),
}));

jest.mock('../../agent-orchestrator/tasks', () => ({
  createQueuedTask: jest.fn(),
}));

jest.mock('../../agent-orchestrator/optimizationMiner', () => ({
  runCompositeOptimizationMiner: jest.fn(),
  runOptimizationMiner: jest.fn(),
}));

jest.mock('../../agent-orchestrator/workerTick', () => ({
  runWorkerTick: jest.fn(),
}));

jest.mock('../../autonomous/InsightIntegrationLayer', () => ({
  processCompletedOptimizationTaskFromFS: jest.fn(),
}));

jest.mock('../../training/TrainingScheduler', () => ({
  runIntradayMonitorLayer: jest.fn(),
  runDailyCycleLayer: jest.fn(),
  runNightlyOptLayer: jest.fn(),
  runWeeklyDeepLayer: jest.fn(),
}));

jest.mock('../TaiwanSelfOptimizationAudit', () => ({
  generateTaiwanSelfAuditReport: jest.fn(),
}));

jest.mock('../../prisma', () => ({
  prisma: {
    jobRunLog: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    optimizationInsightRecord: {
      count: jest.fn(),
    },
  },
}));

import { loadProjectProfile } from '../../agent-orchestrator/profile';
import { loadSchedulerState, loadTaskIndex } from '../../agent-orchestrator/storage';
import { createQueuedTask } from '../../agent-orchestrator/tasks';
import { runCompositeOptimizationMiner, runOptimizationMiner } from '../../agent-orchestrator/optimizationMiner';
import { runWorkerTick } from '../../agent-orchestrator/workerTick';
import { processCompletedOptimizationTaskFromFS } from '../../autonomous/InsightIntegrationLayer';
import { runWeeklyDeepLayer } from '../../training/TrainingScheduler';
import { generateTaiwanSelfAuditReport } from '../TaiwanSelfOptimizationAudit';
import { prisma } from '../../prisma';
import {
  runTrainingTaiwanInsightIngest,
  runTrainingTaiwanOptimizationMiner,
  runTrainingTaiwanWeeklyDeepResearch,
  runTrainingTaiwanWorkerCycle,
} from '../autonomousJobRunners';

const mockLoadProjectProfile = loadProjectProfile as jest.Mock;
const mockLoadSchedulerState = loadSchedulerState as jest.Mock;
const mockLoadTaskIndex = loadTaskIndex as jest.Mock;
const mockCreateQueuedTask = createQueuedTask as jest.Mock;
const mockRunCompositeOptimizationMiner = runCompositeOptimizationMiner as jest.Mock;
const mockRunOptimizationMiner = runOptimizationMiner as jest.Mock;
const mockRunWorkerTick = runWorkerTick as jest.Mock;
const mockProcessCompletedOptimizationTaskFromFS = processCompletedOptimizationTaskFromFS as jest.Mock;
const mockRunWeeklyDeepLayer = runWeeklyDeepLayer as jest.Mock;
const mockGenerateTaiwanSelfAuditReport = generateTaiwanSelfAuditReport as jest.Mock;
const mockInsightCount = prisma.optimizationInsightRecord.count as jest.Mock;
const mockJobRunLogFindUnique = prisma.jobRunLog.findUnique as jest.Mock;
const mockJobRunLogCreate = prisma.jobRunLog.create as jest.Mock;
const mockJobRunLogUpdate = prisma.jobRunLog.update as jest.Mock;

describe('Taiwan self-optimization runner wrappers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJobRunLogFindUnique.mockResolvedValue(null);
    mockJobRunLogCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({
      id: 900,
      jobName: data.jobName,
      scheduledFor: data.scheduledFor,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt,
      status: data.status,
      runMode: data.runMode,
      triggerSource: data.triggerSource,
      idempotencyKey: data.idempotencyKey,
      summary: data.summary ?? null,
      errorMessage: data.errorMessage ?? null,
      metadata: data.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    mockJobRunLogUpdate.mockImplementation(({ where, data }: { where: { id?: number }; data: Record<string, unknown> }) => Promise.resolve({
      id: where.id ?? 900,
      jobName: 'training:test',
      scheduledFor: new Date('2026-05-03T00:00:00.000Z'),
      startedAt: new Date('2026-05-03T00:00:00.000Z'),
      finishedAt: new Date('2026-05-03T00:01:00.000Z'),
      status: data.status ?? 'success',
      runMode: 'live_run',
      triggerSource: 'local_scheduler',
      idempotencyKey: 'training:test:2026-05-03T00:00:00.000Z',
      summary: data.summary ?? null,
      errorMessage: data.errorMessage ?? null,
      metadata: data.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    mockLoadProjectProfile.mockResolvedValue({});
    mockLoadSchedulerState.mockResolvedValue({
      paths: { taskRoot: '/tmp/tasks' },
      state: {
        schedulerEnabled: true,
        plannerProvider: 'codex',
        workerProvider: 'copilot-daemon',
      },
    });
    mockLoadTaskIndex.mockResolvedValue({ tasks: [] });
    mockCreateQueuedTask.mockResolvedValue({ taskId: 42 });
    mockRunCompositeOptimizationMiner.mockResolvedValue(null);
    mockRunOptimizationMiner.mockResolvedValue(null);
    mockInsightCount.mockResolvedValueOnce(2).mockResolvedValueOnce(4);
    mockRunWeeklyDeepLayer.mockResolvedValue({
      summary: 'weekly deep ok',
      tasksCreated: 3,
      metadata: { recoveryEvents: 1 },
    });
    mockGenerateTaiwanSelfAuditReport.mockResolvedValue({
      reportPath: 'runtime/training_reports/tw_self_audit.json',
      recommendations: [{ severity: 'P2', title: 'ok', detail: 'ok' }],
    });
  });

  test('optimization miner skips when orchestrator scheduler hard-off is active', async () => {
    mockLoadSchedulerState.mockResolvedValue({
      paths: { taskRoot: '/tmp/tasks' },
      state: {
        schedulerEnabled: false,
        plannerProvider: 'codex',
        workerProvider: 'copilot-daemon',
      },
    });

    const result = await runTrainingTaiwanOptimizationMiner({ triggerSource: 'local_scheduler' });

    expect(result.jobRun.status).toBe('skipped');
    expect(result.reason).toBe('scheduler_disabled');
    expect(mockCreateQueuedTask).not.toHaveBeenCalled();
  });

  test('worker cycle preserves hard-off/provider skips as skipped runs', async () => {
    mockRunWorkerTick.mockResolvedValue({
      status: 'skipped',
      reason: 'scheduler_disabled',
      taskId: null,
    });

    const result = await runTrainingTaiwanWorkerCycle({ triggerSource: 'local_scheduler' });

    expect(result.jobRun.status).toBe('skipped');
    expect(result.reason).toBe('scheduler_disabled');
  });

  test('insight ingest dedupes completed optimisation dedupe keys before processing', async () => {
    mockLoadTaskIndex.mockResolvedValue({
      tasks: [
        { status: 'COMPLETED', plannerContext: { regimeState: 'OPTIMIZATION', dedupeKey: 'dup-1' } },
        { status: 'COMPLETED', plannerContext: { regimeState: 'OPTIMIZATION', dedupeKey: 'dup-1' } },
        { status: 'COMPLETED', plannerContext: { regimeState: 'OPTIMIZATION', dedupeKey: 'dup-2' } },
      ],
    });

    const result = await runTrainingTaiwanInsightIngest({ triggerSource: 'local_scheduler' });

    expect(result.jobRun.status).toBe('success');
    expect(mockProcessCompletedOptimizationTaskFromFS).toHaveBeenCalledTimes(2);
    expect(mockProcessCompletedOptimizationTaskFromFS).toHaveBeenCalledWith('dup-1');
    expect(mockProcessCompletedOptimizationTaskFromFS).toHaveBeenCalledWith('dup-2');
  });

  test('weekly deep research remains diagnostic and does not mutate thresholds directly', async () => {
    const result = await runTrainingTaiwanWeeklyDeepResearch({ triggerSource: 'local_scheduler' });

    expect(result.jobRun.status).toBe('success');
    expect(result.outcome?.thresholdsChanged).toBe(false);
  });
});