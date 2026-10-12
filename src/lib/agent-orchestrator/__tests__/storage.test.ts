import { getLatestTask, findTaskById, findFirstTaskByStatus } from '../storage';

describe('storage helpers (pure)', () => {
  const baseTasks = [
    { taskId: 1, status: 'QUEUED' },
    { taskId: 2, status: 'RUNNING' },
    { taskId: 3, status: 'QUEUED' },
  ];

  test('getLatestTask returns highest taskId', () => {
    const index = { tasks: [...baseTasks] } as unknown as Parameters<typeof getLatestTask>[0];
    const latest = getLatestTask(index);
    expect(latest?.taskId).toBe(3);

    const empty = getLatestTask({ tasks: [] });
    expect(empty).toBeNull();
  });

  test('findTaskById finds existing and returns null when missing', () => {
    const index = { tasks: [...baseTasks] } as unknown as Parameters<typeof findTaskById>[0];
    expect(findTaskById(index, 2)?.taskId).toBe(2);
    expect(findTaskById(index, 99)).toBeNull();
  });

  test('findFirstTaskByStatus returns a matching task (implementation-defined ordering)', () => {
    const index = { tasks: [...baseTasks, { taskId: 4, status: 'RUNNING' }] } as unknown as Parameters<typeof findFirstTaskByStatus>[0];
    const found = findFirstTaskByStatus(index, 'RUNNING' as Parameters<typeof findFirstTaskByStatus>[1]);
    expect(found?.status).toBe('RUNNING');
    // Implementation picks one matching task; ensure it's one of the RUNNING taskIds
    expect([2, 4]).toContain(found?.taskId);
  });
});
