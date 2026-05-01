jest.mock('../common', () => ({
  nowIso: jest.fn(() => '2026-04-30T14:40:00.000Z'),
  readJsonFile: jest.fn(),
  scheduleNextRunAt: jest.fn(() => '2026-04-30T14:50:00.000Z'),
  writeJsonFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../gate', () => ({
  evaluateGate: jest.fn(),
}));

jest.mock('../profile', () => ({
  loadProjectProfile: jest.fn(),
}));

jest.mock('../providers', () => ({
  resolveWorkerCommand: jest.fn(),
  runWorkerProvider: jest.fn(),
}));

jest.mock('../storage', () => ({
  appendRun: jest.fn().mockResolvedValue(undefined),
  findFirstTaskByStatus: jest.fn(),
  loadSchedulerState: jest.fn(),
  loadTaskIndex: jest.fn(),
  saveSchedulerState: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../tasks', () => ({
  toFinalStatus: jest.fn(),
  updateTaskRecord: jest.fn().mockResolvedValue(undefined),
  writeTaskCompletionArtifacts: jest.fn(),
}));

jest.mock('../autoCommit', () => ({
  attemptAutoCommit: jest.fn(() => ({ committed: false, committedFiles: [], sha: null })),
}));

jest.mock('../llmExecutionPolicy', () => ({
  evaluateExecutionPolicy: jest.fn(),
  getPolicySkipMessage: jest.fn(() => 'skip'),
}));

jest.mock('../../autonomous/InsightIntegrationLayer', () => ({
  processCompletedOptimizationTaskFromFS: jest.fn().mockResolvedValue(undefined),
}));

import { runWorkerTick } from '../workerTick';
import { readJsonFile } from '../common';
import { evaluateGate } from '../gate';
import { loadProjectProfile } from '../profile';
import { resolveWorkerCommand, runWorkerProvider } from '../providers';
import {
  appendRun,
  findFirstTaskByStatus,
  loadSchedulerState,
  loadTaskIndex,
  saveSchedulerState,
} from '../storage';
import { toFinalStatus, updateTaskRecord, writeTaskCompletionArtifacts } from '../tasks';
import { evaluateExecutionPolicy } from '../llmExecutionPolicy';
import { processCompletedOptimizationTaskFromFS } from '../../autonomous/InsightIntegrationLayer';

const mockReadJsonFile = readJsonFile as jest.Mock;
const mockEvaluateGate = evaluateGate as jest.Mock;
const mockLoadProjectProfile = loadProjectProfile as jest.Mock;
const mockResolveWorkerCommand = resolveWorkerCommand as jest.Mock;
const mockRunWorkerProvider = runWorkerProvider as jest.Mock;
const mockAppendRun = appendRun as jest.Mock;
const mockFindFirstTaskByStatus = findFirstTaskByStatus as jest.Mock;
const mockLoadSchedulerState = loadSchedulerState as jest.Mock;
const mockLoadTaskIndex = loadTaskIndex as jest.Mock;
const mockSaveSchedulerState = saveSchedulerState as jest.Mock;
const mockToFinalStatus = toFinalStatus as jest.Mock;
const mockUpdateTaskRecord = updateTaskRecord as jest.Mock;
const mockWriteTaskCompletionArtifacts = writeTaskCompletionArtifacts as jest.Mock;
const mockEvaluateExecutionPolicy = evaluateExecutionPolicy as jest.Mock;
const mockProcessCompletedOptimizationTaskFromFS = processCompletedOptimizationTaskFromFS as jest.Mock;

describe('runWorkerTick insight ingest context', () => {
  const mockProfile = {
    worker_rules: {
      single_active_task: true,
      finalize_on_permission_block: true,
      finalize_on_stale_output_minutes: 15,
    },
  };

  const mockPaths = {};

  const baseTask = {
    taskId: 1,
    status: 'QUEUED',
    promptPath: '/tmp/task-prompt.md',
    contractPath: '/tmp/task-contract.json',
    plannerContext: {
      dedupeKey: 'price_analysis_quality__data_audit',
      regimeState: 'OPTIMIZATION',
      regimeTaskType: 'price_analysis_quality',
      taskType: 'optimization_price_analysis_quality',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockLoadProjectProfile.mockResolvedValue(mockProfile);
    mockLoadSchedulerState.mockResolvedValue({
      paths: mockPaths,
      state: {
        workerProvider: 'copilot-daemon',
        workerCopilotModel: null,
        providerCooldowns: {},
        scheduleMinutes: 10,
      },
    });
    mockLoadTaskIndex.mockResolvedValue({ tasks: [baseTask] });
    mockFindFirstTaskByStatus.mockImplementation((index: { tasks: Array<typeof baseTask> }, status: string) => {
      return index.tasks.find((task) => task.status === status) ?? null;
    });
    mockEvaluateExecutionPolicy.mockResolvedValue({ allowed: true, skip_reason: null });
    mockResolveWorkerCommand.mockReturnValue('configured-worker');
    mockReadJsonFile.mockResolvedValue({ objective: 'Audit price data quality' });
    mockRunWorkerProvider.mockResolvedValue({
      completedMarkdown: '# done',
      changedFiles: ['docs/reports/price_data_quality.json'],
      acceptanceResults: [{ name: 'worker completed', passed: true, evidence: 'ok' }],
      workerStdout: 'ok',
      errorMarkersHit: [],
      runtimeFailed: false,
    });
    mockWriteTaskCompletionArtifacts.mockResolvedValue({
      completedPath: '/tmp/task-completed.md',
      resultPath: '/tmp/task-result.json',
      workerLogPath: '/tmp/task-worker.log',
    });
    mockEvaluateGate.mockResolvedValue({
      gate_verdict: 'PASS',
      gate_reason: '',
      final_message: null,
      reset_hint: null,
      acceptance_results: [],
    });
    mockToFinalStatus.mockReturnValue('COMPLETED');
  });

  it('passes OPTIMIZATION regimeContext to worker-triggered insight ingestion', async () => {
    await runWorkerTick({ callerContext: 'background' });

    expect(mockProcessCompletedOptimizationTaskFromFS).toHaveBeenCalledWith(
      'price_analysis_quality__data_audit',
      { regimeContext: 'OPTIMIZATION' },
    );
    expect(mockAppendRun).toHaveBeenCalled();
    expect(mockSaveSchedulerState).toHaveBeenCalled();
  });

  it('still tags price_analysis_quality tasks as OPTIMIZATION when regimeState is missing', async () => {
    mockLoadTaskIndex.mockResolvedValue({
      tasks: [
        {
          ...baseTask,
          plannerContext: {
            dedupeKey: 'price_analysis_quality__data_audit',
            regimeState: null,
            regimeTaskType: 'price_analysis_quality',
            taskType: 'optimization_price_analysis_quality',
          },
        },
      ],
    });

    await runWorkerTick({ callerContext: 'background' });

    expect(mockProcessCompletedOptimizationTaskFromFS).toHaveBeenCalledWith(
      'price_analysis_quality__data_audit',
      { regimeContext: 'OPTIMIZATION' },
    );
  });
});