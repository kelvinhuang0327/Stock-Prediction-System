import type * as SchedulerGuardType from '../../src/lib/agent-orchestrator/schedulerGuard';

jest.resetModules();

jest.mock('../../src/lib/agent-orchestrator/profile', () => ({
  loadProjectProfile: jest.fn(async () => ({ project: 'demo' })),
}));

jest.mock('../../src/lib/agent-orchestrator/storage', () => ({
  loadSchedulerState: jest.fn(async () => ({ state: { schedulerEnabled: true } })),
}));

test('isGlobalSchedulerEnabled returns true when schedulerEnabled is true', async () => {
  jest.resetModules();
  jest.mock('../../src/lib/agent-orchestrator/profile', () => ({
    loadProjectProfile: jest.fn(async () => ({ project: 'demo' })),
  }));
  jest.mock('../../src/lib/agent-orchestrator/storage', () => ({
    loadSchedulerState: jest.fn(async () => ({ state: { schedulerEnabled: true } })),
  }));

  let isGlobalSchedulerEnabled: typeof SchedulerGuardType.isGlobalSchedulerEnabled | null = null;
  jest.isolateModules(() => {
    const mod = jest.requireActual('../../src/lib/agent-orchestrator/schedulerGuard') as typeof SchedulerGuardType;
    isGlobalSchedulerEnabled = mod.isGlobalSchedulerEnabled;
  });

  if (!isGlobalSchedulerEnabled) {
    throw new Error('Module failed to load');
  }

  const res = await isGlobalSchedulerEnabled();
  expect(res).toBe(true);
});

describe('disabled scheduler scenario', () => {
  test('returns false when schedulerEnabled is false', async () => {
    jest.resetModules();
    jest.mock('../../src/lib/agent-orchestrator/profile', () => ({
      loadProjectProfile: jest.fn(async () => ({ project: 'demo' })),
    }));
    jest.mock('../../src/lib/agent-orchestrator/storage', () => ({
      loadSchedulerState: jest.fn(async () => ({ state: { schedulerEnabled: false } })),
    }));

    let isGlobalSchedulerEnabled2: typeof SchedulerGuardType.isGlobalSchedulerEnabled | null = null;
    jest.isolateModules(() => {
      const mod = jest.requireActual('../../src/lib/agent-orchestrator/schedulerGuard') as typeof SchedulerGuardType;
      isGlobalSchedulerEnabled2 = mod.isGlobalSchedulerEnabled;
    });

    if (!isGlobalSchedulerEnabled2) {
      throw new Error('Module failed to load');
    }

    const res = await isGlobalSchedulerEnabled2();
    expect(res).toBe(false);
  });
});
