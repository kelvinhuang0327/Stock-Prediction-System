import { buildPolicyBlockedWorkerOutput } from '../../src/lib/agent-orchestrator/aiModulesService';

test('buildPolicyBlockedWorkerOutput includes provider and task id and marks runtimeFailed', () => {
  const input = { workerProvider: 'codex' as const, taskId: 42 };
  const out = buildPolicyBlockedWorkerOutput(input, 'SCHEDULER_DISABLED');
  expect(out).toHaveProperty('runtimeFailed', true);
  expect(out.completedMarkdown).toContain('Provider: `codex`');
  expect(out.completedMarkdown).toContain('Task ID: 42');
  expect(out.errorMarkersHit).toContain('execution_policy_block');
});
