import { getLatestTask, findTaskById, findFirstTaskByStatus } from '../storage';

describe('storage helpers (pure)', () => {
  const baseTasks = [
    { taskId: 1, status: 'QUEUED' },
    { taskId: 2, status: 'RUNNING' },
    { taskId: 3, status: 'QUEUED' },
  ];

  test('getLatestTask returns highest taskId', () => {
    const index: any = { tasks: [...baseTasks] };
    const latest = getLatestTask(index);
    expect(latest?.taskId).toBe(3);

    const empty = getLatestTask({ tasks: [] });
    expect(empty).toBeNull();
  });

  test('findTaskById finds existing and returns null when missing', () => {
    const index: any = { tasks: [...baseTasks] };
    expect(findTaskById(index, 2)?.taskId).toBe(2);
    expect(findTaskById(index, 99)).toBeNull();
  });

  test('findFirstTaskByStatus returns a matching task (implementation-defined ordering)', () => {
    const index: any = { tasks: [...baseTasks, { taskId: 4, status: 'RUNNING' }] };
    const found = findFirstTaskByStatus(index, 'RUNNING' as any);
    expect(found?.status).toBe('RUNNING');
    // Implementation picks one matching task; ensure it's one of the RUNNING taskIds
    expect([2, 4]).toContain(found?.taskId);
  });
});
