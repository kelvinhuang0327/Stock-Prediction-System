jest.resetModules();

// Mock child_process so the test doesn't depend on runtime execution_policy.py state
jest.mock('node:child_process', () => {
  const mockStdout = JSON.stringify({
    allowed: true,
    mode: 'safe-run',
    scheduler_enabled: true,
    caller: 'ai_service',
    caller_context: 'background',
    provider: '',
    model: '',
    task_id: '',
    skip_reason: null,
    blocked_execution_count: 0,
    last_llm_call_at: null,
    state_path: '/tmp/state.json',
    event_log_path: '/tmp/events.jsonl',
    ok: true,
  });
  // Node's util.promisify checks for this custom symbol on execFile
  const customKey = Symbol.for('nodejs.util.promisify.custom');
  const mockExecFile = Object.assign(
    jest.fn((_cmd: string, _args: string[], _opts: unknown, cb?: (err: null, out: string, errOut: string) => void) => {
      if (typeof cb === 'function') cb(null, mockStdout, '');
    }),
    { [customKey]: jest.fn().mockResolvedValue({ stdout: mockStdout, stderr: '' }) },
  );
  return { execFile: mockExecFile };
});

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
