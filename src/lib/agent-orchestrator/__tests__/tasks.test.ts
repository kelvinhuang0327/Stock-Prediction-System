describe('tasks exported functions', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('createQueuedTask writes artifacts and returns task', async () => {
    jest.isolateModules(() => {
      jest.doMock(require.resolve('../common'), () => ({
        ensureDir: jest.fn().mockResolvedValue(undefined),
        writeTextFile: jest.fn().mockResolvedValue(undefined),
        writeJsonFile: jest.fn().mockResolvedValue(undefined),
        safeSlug: (s: string) => s.replace(/\s+/g, '-'),
        toDayKey: () => '20260426',
        toTimestampCompact: () => 'ts',
      }));

      const { createQueuedTask } = require('../tasks');
      const profile = {};
      const paths: any = { taskRoot: '/tmp/tasks', taskIndexPath: '/tmp/index.json' };
      const index: any = { tasks: [] };
      const input = {
        objective: 'My Objective',
        promptMarkdown: 'md',
        contract: { version: '1.0', objective: 'o', scope: [], constraints: [], acceptance_tests: [], required_outputs: [], forbidden_changes: [], handoff_questions: [] },
        plannerContext: null,
        plannerProvider: 'codex',
        workerProvider: 'codex',
      };
      return createQueuedTask(profile, paths, index, input).then((task: any) => {
        expect(task.taskId).toBe(1);
        expect(index.tasks.length).toBe(1);
        expect(task.promptPath).toContain('-prompt.md');
      });
    });
  });

  test('updateTaskRecord updates and persists', async () => {
    jest.isolateModules(() => {
      jest.doMock(require.resolve('../common'), () => ({ nowIso: () => 'now', writeJsonFile: jest.fn().mockResolvedValue(undefined) }));
      const { updateTaskRecord } = require('../tasks');
      const paths: any = { taskIndexPath: '/tmp/index.json' };
      const index: any = { tasks: [{ taskId: 2, metaPath: '/tmp/2-meta.json', promptPath: '/tmp/2-prompt.md' }] };
      return updateTaskRecord(paths, index, 2, { status: 'COMPLETED' }).then((updated: any) => {
        expect(updated.status).toBe('COMPLETED');
        expect(index.tasks[0].status).toBe('COMPLETED');
      });
    });
  });

  test('writeTaskCompletionArtifacts writes files and returns paths', async () => {
    jest.isolateModules(() => {
      jest.doMock(require.resolve('../common'), () => ({ writeTextFile: jest.fn().mockResolvedValue(undefined), writeJsonFile: jest.fn().mockResolvedValue(undefined) }));
      const { writeTaskCompletionArtifacts } = require('../tasks');
      const task: any = { promptPath: '/tmp/2026-04-26-abc-prompt.md' };
      return writeTaskCompletionArtifacts(task, 'done', { version: '1.0', task_id: 1, status: 'COMPLETED', gate_verdict: 'PASS', gate_reason: '', duration_seconds: 0, changed_files: [], error_markers_hit: [], missing_required_outputs: [], forbidden_change_violations: [], acceptance_results: [], next_action: '' }, 'stdout').then((art: any) => {
        expect(art.completedPath).toContain('-completed.md');
        expect(art.resultPath).toContain('-result.json');
        expect(art.workerLogPath).toContain('-worker-stdout.log');
      });
    });
  });

  test('toFinalStatus maps verdicts', () => {
    const { toFinalStatus } = require('../tasks');
    expect(toFinalStatus('PASS')).toBe('COMPLETED');
    expect(toFinalStatus('PROVIDER_RATE_LIMITED')).toBe('FAILED_RATE_LIMIT');
    expect(toFinalStatus('INVALID_DELIVERY')).toBe('REPLAN_REQUIRED');
  });
});
