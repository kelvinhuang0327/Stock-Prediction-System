jest.mock('../providerFactory', () => ({ enforceProviderForRole: jest.fn() }));

const { enforceProviderForRole } = require('../providerFactory');
import { executeWorkerProviderCommand } from '../aiService';

describe('aiService.executeWorkerProviderCommand allowlist gate', () => {
  beforeEach(() => { jest.resetAllMocks(); });

  it('returns policy-blocked output when provider not allowed', async () => {
    enforceProviderForRole.mockReturnValue({ allowed: false, blockReason: 'PROVIDER_NOT_IN_ALLOWLIST' });

    const input = { workerProvider: 'openai', taskId: 't2' } as any;
    const out = await executeWorkerProviderCommand({
      input,
      externalCommand: 'echo hi',
      interpolateCommand: (t: string) => t,
      parseChangedFiles: () => [],
      detectProviderRateLimit: () => null,
    });

    expect(out.runtimeFailed).toBe(true);
    expect(out.runtimeErrorMessage).toContain('PROVIDER_NOT_IN_ALLOWLIST');
    expect(out.failureProvider).toBe(input.workerProvider);
  });
});
