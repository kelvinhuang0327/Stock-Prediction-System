import { buildPolicyBlockedWorkerOutput } from '../aiModulesService';
import { getPolicySkipMessage } from '../llmExecutionPolicy';
import type { WorkerExecutionInput } from '../providers';

describe('aiModulesService.buildPolicyBlockedWorkerOutput', () => {
  it('returns structured WorkerExecutionOutput when blocked', () => {
    const input: WorkerExecutionInput = {
      workerProvider: 'copilot',
      taskId: 1,
      completedPath: '/tmp/c.md',
      resultPath: '/tmp/r.json',
      contract: {
        version: '1.0',
        objective: 'test',
        scope: [],
        constraints: [],
        acceptance_tests: [],
        required_outputs: [],
        forbidden_changes: [],
        handoff_questions: [],
      },
    };
    const out = buildPolicyBlockedWorkerOutput(input, 'PROVIDER_NOT_IN_ALLOWLIST');

    expect(out.runtimeFailed).toBe(true);
    expect(out.runtimeErrorMessage).toBe(getPolicySkipMessage('PROVIDER_NOT_IN_ALLOWLIST'));
    expect(out.acceptanceResults[0].passed).toBe(false);
    expect(out.errorMarkersHit).toContain('execution_policy_block');
  });
});
