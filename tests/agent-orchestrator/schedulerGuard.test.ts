jest.resetModules();

jest.mock('../../src/lib/agent-orchestrator/profile', () => ({
  loadProjectProfile: jest.fn(async () => ({ project: 'demo' })),
}));

jest.mock('../../src/lib/agent-orchestrator/storage', () => ({
  loadSchedulerState: jest.fn(async (profile: any) => ({ state: { schedulerEnabled: true } })),
}));

test('isGlobalSchedulerEnabled returns true when schedulerEnabled is true', async () => {
  jest.resetModules();
  jest.mock('../../src/lib/agent-orchestrator/profile', () => ({
    loadProjectProfile: jest.fn(async () => ({ project: 'demo' })),
  }));
  jest.mock('../../src/lib/agent-orchestrator/storage', () => ({
    loadSchedulerState: jest.fn(async (profile: any) => ({ state: { schedulerEnabled: true } })),
  }));

  let isGlobalSchedulerEnabled: any;
  jest.isolateModules(() => {
    isGlobalSchedulerEnabled = require('../../src/lib/agent-orchestrator/schedulerGuard').isGlobalSchedulerEnabled;
  });

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
      loadSchedulerState: jest.fn(async (profile: any) => ({ state: { schedulerEnabled: false } })),
    }));

    let isGlobalSchedulerEnabled2: any;
    jest.isolateModules(() => {
      isGlobalSchedulerEnabled2 = require('../../src/lib/agent-orchestrator/schedulerGuard').isGlobalSchedulerEnabled;
    });

    const res = await isGlobalSchedulerEnabled2();
    expect(res).toBe(false);
  });
});
