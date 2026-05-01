// Ensure fs is mocked before requiring llmUsageLogger so the module-local bindings are replaced
jest.mock('node:fs', () => ({
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

const fs = require('node:fs');
const { logProviderPreflight, logProviderBlocked, appendLlmUsage } = require('../llmUsageLogger');

describe('llmUsageLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes a preflight record without throwing', () => {
    expect(() => logProviderPreflight({ caller: 'worker' as any, provider: 'openai', allowed: true })).not.toThrow();
    expect(fs.appendFileSync).toHaveBeenCalled();
  });

  it('writes a blocked record without throwing', () => {
    expect(() => logProviderBlocked({ caller: 'worker' as any, provider: 'openai' })).not.toThrow();
    expect(fs.appendFileSync).toHaveBeenCalled();
  });

  it('appendLlmUsage routes to blocked when decision is blocked', () => {
    expect(() => appendLlmUsage({ phase: 'preflight', decision: 'blocked' as any, caller: 'worker', provider: 'openai' })).not.toThrow();
    expect(fs.appendFileSync).toHaveBeenCalled();
  });
});
