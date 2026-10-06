import fs from 'node:fs';
import { logProviderPreflight, logProviderBlocked, appendLlmUsage } from '../llmUsageLogger';

// Ensure fs is mocked before requiring llmUsageLogger so the module-local bindings are replaced
jest.mock('node:fs', () => ({
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

const mockAppendFileSync = fs.appendFileSync as jest.Mock;

describe('llmUsageLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes a preflight record without throwing', () => {
    expect(() => logProviderPreflight({ caller: 'worker', provider: 'openai', allowed: true })).not.toThrow();
    expect(mockAppendFileSync).toHaveBeenCalled();
  });

  it('writes a blocked record without throwing', () => {
    expect(() => logProviderBlocked({ caller: 'worker', provider: 'openai' })).not.toThrow();
    expect(mockAppendFileSync).toHaveBeenCalled();
  });

  it('appendLlmUsage routes to blocked when decision is blocked', () => {
    expect(() => appendLlmUsage({ phase: 'preflight', decision: 'blocked', caller: 'worker', provider: 'openai' })).not.toThrow();
    expect(mockAppendFileSync).toHaveBeenCalled();
  });
});
