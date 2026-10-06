jest.mock('../../prisma', () => ({
  prisma: {
    jobRunLog: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../autonomousJobRunners', () => ({
  runAutonomousDailyCycle: jest.fn(),
  runAutonomousMonitorCycle: jest.fn(),
  runAutonomousReviewCycle: jest.fn(),
  runAutonomousLearningCycle: jest.fn(),
  runTrainingIntradayMonitorCycle: jest.fn(),
  runTrainingDailyCycle: jest.fn(),
  runTrainingNightlyOpt: jest.fn(),
  runTrainingWeeklyDeep: jest.fn(),
  runTrainingTaiwanDataSync: jest.fn(),
  runTrainingTaiwanSnapshot: jest.fn(),
  runTrainingTaiwanScreen: jest.fn(),
  runTrainingTaiwanReport: jest.fn(),
}));

import { prisma } from '../../prisma';
import { SchedulerStateEngine } from '../SchedulerStateEngine';
import {
  runTrainingTaiwanDataSync,
  runTrainingTaiwanReport,
  runTrainingTaiwanScreen,
  runTrainingTaiwanSnapshot,
} from '../autonomousJobRunners';

type JobRunStatus = 'success' | 'failed' | 'running' | 'skipped';

const mockFindUnique = prisma.jobRunLog.findUnique as jest.Mock;
const mockFindFirst = prisma.jobRunLog.findFirst as jest.Mock;

const mockRunTrainingTaiwanDataSync = runTrainingTaiwanDataSync as jest.Mock;
const mockRunTrainingTaiwanSnapshot = runTrainingTaiwanSnapshot as jest.Mock;
const mockRunTrainingTaiwanScreen = runTrainingTaiwanScreen as jest.Mock;
const mockRunTrainingTaiwanReport = runTrainingTaiwanReport as jest.Mock;

function makeResult(jobName: string, scheduledFor: Date, status: JobRunStatus, id: number) {
  return {
    jobRun: {
      id,
      jobName,
      scheduledFor,
      startedAt: scheduledFor,
      finishedAt: scheduledFor,
      status,
      runMode: 'missed_run',
      triggerSource: 'local_scheduler',
      idempotencyKey: `${jobName}:${scheduledFor.toISOString()}`,
      summary: `${jobName}:${status}`,
      errorMessage: status === 'failed' ? `${jobName}:failed` : null,
      metadata: null,
    },
    skipped: false,
    reason: status === 'failed' ? `${jobName}:failed` : undefined,
    outcome: null,
  };
}

describe('SchedulerStateEngine Taiwan stock automation', () => {
  const engine = new SchedulerStateEngine();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue(null);

    mockRunTrainingTaiwanDataSync.mockImplementation(({ scheduledFor }: { scheduledFor: Date }) =>
      Promise.resolve(makeResult('training:tw-data-sync', scheduledFor, 'success', 101)));
    mockRunTrainingTaiwanSnapshot.mockImplementation(({ scheduledFor }: { scheduledFor: Date }) =>
      Promise.resolve(makeResult('training:tw-snapshot', scheduledFor, 'success', 102)));
    mockRunTrainingTaiwanScreen.mockImplementation(({ scheduledFor }: { scheduledFor: Date }) =>
      Promise.resolve(makeResult('training:tw-screen', scheduledFor, 'success', 103)));
    mockRunTrainingTaiwanReport.mockImplementation(({ scheduledFor }: { scheduledFor: Date }) =>
      Promise.resolve(makeResult('training:tw-report', scheduledFor, 'success', 104)));
  });

  test('runs the Taiwan stock jobs in the expected daily order without duplicate windows', async () => {
    const calls: string[] = [];

    mockRunTrainingTaiwanDataSync.mockImplementation(({ scheduledFor }: { scheduledFor: Date }) => {
      calls.push(`data-sync:${scheduledFor.toISOString()}`);
      return Promise.resolve(makeResult('training:tw-data-sync', scheduledFor, 'success', 201));
    });
    mockRunTrainingTaiwanSnapshot.mockImplementation(({ scheduledFor }: { scheduledFor: Date }) => {
      calls.push(`snapshot:${scheduledFor.toISOString()}`);
      return Promise.resolve(makeResult('training:tw-snapshot', scheduledFor, 'success', 202));
    });
    mockRunTrainingTaiwanScreen.mockImplementation(({ scheduledFor }: { scheduledFor: Date }) => {
      calls.push(`screen:${scheduledFor.toISOString()}`);
      return Promise.resolve(makeResult('training:tw-screen', scheduledFor, 'success', 203));
    });
    mockRunTrainingTaiwanReport.mockImplementation(({ scheduledFor }: { scheduledFor: Date }) => {
      calls.push(`report:${scheduledFor.toISOString()}`);
      return Promise.resolve(makeResult('training:tw-report', scheduledFor, 'success', 204));
    });

    await engine.checkAndRunIfDue('training:tw-data-sync', new Date('2026-04-30T00:30:00.000Z'));
    await engine.checkAndRunIfDue('training:tw-snapshot', new Date('2026-04-30T06:05:00.000Z'));
    await engine.checkAndRunIfDue('training:tw-screen', new Date('2026-04-30T06:10:00.000Z'));
    await engine.checkAndRunIfDue('training:tw-report', new Date('2026-04-30T13:10:00.000Z'));

    mockFindUnique.mockResolvedValueOnce({ status: 'success' });
    const duplicate = await engine.checkAndRunIfDue('training:tw-snapshot', new Date('2026-04-30T06:05:00.000Z'));

    expect(calls).toEqual([
      'data-sync:2026-04-30T00:30:00.000Z',
      'snapshot:2026-04-30T06:05:00.000Z',
      'screen:2026-04-30T06:10:00.000Z',
      'report:2026-04-30T13:10:00.000Z',
    ]);
    expect(duplicate).toEqual({ ran: false, skipped: true, reason: 'success' });
  });

  test('retries failed Taiwan stock jobs up to two additional attempts', async () => {
    mockRunTrainingTaiwanReport
      .mockImplementationOnce(({ scheduledFor }: { scheduledFor: Date }) =>
        Promise.resolve(makeResult('training:tw-report', scheduledFor, 'failed', 301)))
      .mockImplementationOnce(({ scheduledFor }: { scheduledFor: Date }) =>
        Promise.resolve(makeResult('training:tw-report', scheduledFor, 'failed', 302)))
      .mockImplementationOnce(({ scheduledFor }: { scheduledFor: Date }) =>
        Promise.resolve(makeResult('training:tw-report', scheduledFor, 'success', 303)));

    const result = await engine.checkAndRunIfDue('training:tw-report', new Date('2026-04-30T13:10:00.000Z'));

    expect(result).toEqual({ ran: true, skipped: false });
    expect(mockRunTrainingTaiwanReport).toHaveBeenCalledTimes(3);
  });

  test('treats skipped windows as already satisfied for duplicate suppression', async () => {
    mockFindUnique.mockResolvedValueOnce({ status: 'skipped' });

    const result = await engine.checkAndRunIfDue('training:tw-worker-cycle', new Date('2026-04-30T10:00:00.000Z'));

    expect(result).toEqual({ ran: false, skipped: true, reason: 'skipped' });
  });

  test('classifies skipped windows as already ran for status and reconciliation', async () => {
    mockFindUnique.mockResolvedValueOnce({ status: 'skipped' });

    const result = await engine.classifyJobWindow(
      'training:tw-worker-cycle',
      new Date('2026-04-30T10:00:00.000Z'),
      new Date('2026-04-30T10:00:00.000Z'),
    );

    expect(result).toBe('already_ran');
  });

  test('skips too-old weekly deep research windows during reconciliation', async () => {
    mockFindUnique.mockImplementation(({ where: { idempotencyKey } }: { where: { idempotencyKey: string } }) =>
      Promise.resolve(
        idempotencyKey.includes('training:tw-weekly-deep-research') ? null : { status: 'success' },
      ));

    const result = await engine.reconcile(new Date('2026-04-30T09:06:52.000Z'));

    const weeklyDeepResearch = result.find((entry) => entry.jobName === 'training:tw-weekly-deep-research');

    expect(weeklyDeepResearch).toMatchObject({
      classification: 'never_ran',
      backfillDecision: 'skip',
      backfilled: false,
    });
    expect(weeklyDeepResearch?.skipReason).toMatch(/^missed_too_old: age=\d+min > limit=2880min$/);
  });
});