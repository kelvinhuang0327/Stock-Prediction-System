import { enforceProviderForRole } from '../providerFactory';
import { executeWorkerProviderCommand } from '../aiService';

jest.mock('../providerFactory', () => ({ enforceProviderForRole: jest.fn() }));

const mockEnforceProviderForRole = enforceProviderForRole as jest.Mock;

describe('aiService.executeWorkerProviderCommand allowlist gate', () => {
  beforeEach(() => { jest.resetAllMocks(); });

  it('returns policy-blocked output when provider not allowed', async () => {
    mockEnforceProviderForRole.mockReturnValue({ allowed: false, blockReason: 'PROVIDER_NOT_IN_ALLOWLIST' });

    const input = { workerProvider: 'openai', taskId: 't2', model: 'gpt-4' };
    const out = await executeWorkerProviderCommand({
      input: input as unknown as Parameters<typeof executeWorkerProviderCommand>[0]['input'],
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
