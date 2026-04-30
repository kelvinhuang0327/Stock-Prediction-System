jest.resetModules();

// Use the real execution_policy.py script for deterministic JSON output during tests


const { evaluateExecutionPolicy, getPolicySkipMessage, recordLlmExecution } = require('../../src/lib/agent-orchestrator/llmExecutionPolicy');

test('evaluateExecutionPolicy parses python JSON output', async () => {
  const res = await evaluateExecutionPolicy({ caller: 'ai_service' });
  expect(res).toHaveProperty('allowed', true);
  expect(res).toHaveProperty('mode', 'safe-run');
  expect(res).toHaveProperty('caller', 'ai_service');
});

test('getPolicySkipMessage returns expected messages', () => {
  expect(getPolicySkipMessage(null)).toBe('SCHEDULER_DISABLED — skip execution');
  expect(getPolicySkipMessage('GLOBAL_HARD_OFF')).toBe('GLOBAL_HARD_OFF — skip execution');
  expect(getPolicySkipMessage('SAFE_RUN_BLOCK')).toBe('SAFE_RUN_BLOCK — skip execution');
});

// recordLlmExecution also uses the same execFile mock; ensure it returns parsed output shape
test('recordLlmExecution returns ok field', async () => {
  const res = await recordLlmExecution({ caller: 'ai_service' });
  expect(res).toHaveProperty('ok');
});
