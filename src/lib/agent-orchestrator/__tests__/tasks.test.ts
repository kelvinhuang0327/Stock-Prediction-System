import type { ProjectProfile, TaskStoreIndex, TaskRecord } from '../types';
import type { RuntimePaths } from '../storage';
import type * as TasksType from '../tasks';

describe('tasks exported functions', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('createQueuedTask writes artifacts and returns task', async () => {
    let promise: Promise<void> | null = null;
    jest.isolateModules(() => {
      jest.doMock(require.resolve('../common'), () => ({
        ensureDir: jest.fn().mockResolvedValue(undefined),
        writeTextFile: jest.fn().mockResolvedValue(undefined),
        writeJsonFile: jest.fn().mockResolvedValue(undefined),
        safeSlug: (s: string) => s.replace(/\s+/g, '-'),
        toDayKey: () => '20260426',
        toTimestampCompact: () => 'ts',
      }));

      const { createQueuedTask } = jest.requireActual('../tasks') as typeof TasksType;
      const profile = {} as unknown as ProjectProfile;
      const paths = { taskRoot: '/tmp/tasks', taskIndexPath: '/tmp/index.json' } as unknown as RuntimePaths;
      const index = { tasks: [] } as unknown as TaskStoreIndex;
      const input = {
        objective: 'My Objective',
        promptMarkdown: 'md',
        contract: { version: '1.0', objective: 'o', scope: [], constraints: [], acceptance_tests: [], required_outputs: [], forbidden_changes: [], handoff_questions: [] },
        plannerContext: null,
        plannerProvider: 'codex' as const,
        workerProvider: 'codex' as const,
      };
      promise = createQueuedTask(profile, paths, index, input).then((task: TaskRecord) => {
        expect(task.taskId).toBe(1);
        expect(index.tasks.length).toBe(1);
        expect(task.promptPath).toContain('-prompt.md');
      });
    });
    return promise;
  });

  test('updateTaskRecord updates and persists', async () => {
    let promise: Promise<void> | null = null;
    jest.isolateModules(() => {
      jest.doMock(require.resolve('../common'), () => ({ nowIso: () => 'now', writeJsonFile: jest.fn().mockResolvedValue(undefined) }));
      const { updateTaskRecord } = jest.requireActual('../tasks') as typeof TasksType;
      const paths = { taskIndexPath: '/tmp/index.json' } as unknown as RuntimePaths;
      const index = { tasks: [{ taskId: 2, metaPath: '/tmp/2-meta.json', promptPath: '/tmp/2-prompt.md' }] } as unknown as TaskStoreIndex;
      promise = updateTaskRecord(paths, index, 2, { status: 'COMPLETED' }).then((updated: TaskRecord) => {
        expect(updated.status).toBe('COMPLETED');
        expect(index.tasks[0].status).toBe('COMPLETED');
      });
    });
    return promise;
  });

  test('writeTaskCompletionArtifacts writes files and returns paths', async () => {
    let promise: Promise<void> | null = null;
    jest.isolateModules(() => {
      jest.doMock(require.resolve('../common'), () => ({ writeTextFile: jest.fn().mockResolvedValue(undefined), writeJsonFile: jest.fn().mockResolvedValue(undefined) }));
      const { writeTaskCompletionArtifacts } = jest.requireActual('../tasks') as typeof TasksType;
      const task = { promptPath: '/tmp/2026-04-26-abc-prompt.md' } as unknown as TaskRecord;
      promise = writeTaskCompletionArtifacts(task, 'done', { version: '1.0', task_id: 1, status: 'COMPLETED', gate_verdict: 'PASS', gate_reason: '', duration_seconds: 0, changed_files: [], error_markers_hit: [], missing_required_outputs: [], forbidden_change_violations: [], acceptance_results: [], next_action: '' }, 'stdout').then((art) => {
        expect(art.completedPath).toContain('-completed.md');
        expect(art.resultPath).toContain('-result.json');
        expect(art.workerLogPath).toContain('-worker-stdout.log');
      });
    });
    return promise;
  });

  test('toFinalStatus maps verdicts', () => {
    const { toFinalStatus } = jest.requireActual('../tasks') as typeof TasksType;
    expect(toFinalStatus('PASS')).toBe('COMPLETED');
    expect(toFinalStatus('PROVIDER_RATE_LIMITED')).toBe('FAILED_RATE_LIMIT');
    expect(toFinalStatus('INVALID_DELIVERY')).toBe('REPLAN_REQUIRED');
  });
});
