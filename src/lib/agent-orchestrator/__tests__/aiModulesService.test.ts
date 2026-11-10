import { buildPolicyBlockedWorkerOutput } from '../aiModulesService';
import { getPolicySkipMessage } from '../llmExecutionPolicy';
import type { WorkerExecutionInput } from '../providers';

describe('aiModulesService.buildPolicyBlockedWorkerOutput', () => {
  it('returns structured WorkerExecutionOutput when blocked', () => {
    const input: WorkerExecutionInput = {
      workerProvider: 'copilot',
      taskId: 1,
      promptPath: '/tmp/p.md',
      contractPath: '/tmp/contract.json',
      objective: 'test',
      profile: {} as WorkerExecutionInput['profile'],
    };
    const out = buildPolicyBlockedWorkerOutput(input, 'PROVIDER_NOT_IN_ALLOWLIST');

    expect(out.runtimeFailed).toBe(true);
    expect(out.runtimeErrorMessage).toBe(getPolicySkipMessage('PROVIDER_NOT_IN_ALLOWLIST'));
    expect(out.acceptanceResults[0].passed).toBe(false);
    expect(out.errorMarkersHit).toContain('execution_policy_block');
  });

  it('keeps the Codex worker disabled reason distinct', () => {
    expect(getPolicySkipMessage('CODEX_WORKER_NOT_ENABLED')).toBe(
      'CODEX_WORKER_NOT_ENABLED — skip execution',
    );
  });
});
