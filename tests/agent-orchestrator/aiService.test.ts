jest.resetModules();

jest.mock('../../src/lib/agent-orchestrator/providerFactory', () => ({
  enforceProviderForRole: jest.fn(() => ({ allowed: true, blockReason: null, resolution: {} })),
}));

jest.mock('../../src/lib/agent-orchestrator/llmExecutionPolicy', () => ({
  evaluateExecutionPolicy: jest.fn(async () => ({ allowed: false, skip_reason: 'SCHEDULER_DISABLED' })),
}));

jest.mock('../../src/lib/agent-orchestrator/aiModulesService', () => ({
  buildPolicyBlockedWorkerOutput: jest.fn((input: any, reason: any) => ({ blocked: true, reason })),
}));

const { executeWorkerProviderCommand } = require('../../src/lib/agent-orchestrator/aiService');

test('executeWorkerProviderCommand returns blocked output when policy denies', async () => {
  const input = {
    workerProvider: 'openai',
    taskId: 7,
    promptPath: '',
    contractPath: '',
    objective: '',
    profile: {},
  };
  const res = await executeWorkerProviderCommand({
    input,
    externalCommand: 'echo hi',
    interpolateCommand: () => 'echo hi',
    parseChangedFiles: () => [],
    detectProviderRateLimit: () => null,
  });
  expect(res).toHaveProperty('blocked', true);
  expect(res).toHaveProperty('reason', 'SCHEDULER_DISABLED');
});
