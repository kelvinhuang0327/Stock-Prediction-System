import { buildPolicyBlockedWorkerOutput } from '../aiModulesService';
import { getPolicySkipMessage } from '../llmExecutionPolicy';

describe('aiModulesService.buildPolicyBlockedWorkerOutput', () => {
  it('returns structured WorkerExecutionOutput when blocked', () => {
    const input = { workerProvider: 'openai', taskId: 't1' } as any;
    const out = buildPolicyBlockedWorkerOutput(input, 'PROVIDER_NOT_IN_ALLOWLIST' as any);

    expect(out.runtimeFailed).toBe(true);
    expect(out.runtimeErrorMessage).toBe(getPolicySkipMessage('PROVIDER_NOT_IN_ALLOWLIST' as any));
    expect(out.acceptanceResults[0].passed).toBe(false);
    expect(out.errorMarkersHit).toContain('execution_policy_block');
  });
});
