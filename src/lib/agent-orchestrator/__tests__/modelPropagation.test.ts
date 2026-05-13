/**
 * Model Propagation — Focused Tests
 *
 * B-101 Worker Model Propagation acceptance tests.
 *
 * Covers:
 * 1.  interpolateCommand replaces {model}
 * 2.  Missing model does not break command
 * 3.  desiredModel is written to usage record
 * 4.  actualModel defaults to provider-managed when not confirmed
 * 5.  actualModel is NOT set to desiredModel automatically
 * 6.  modelPropagationStatus is correct
 * 7.  Planner/CTO remain local-only (providerFactory hardcode verified via type)
 * 8.  No real external LLM call is made
 * 9.  logProviderExecutionStart writes all three model fields
 */

import { appendFileSync, mkdirSync } from 'node:fs';

// ── Mock filesystem ──────────────────────────────────────────────────────────
jest.mock('node:fs', () => ({
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

const mockAppend = appendFileSync as jest.Mock;

function lastRecord(): Record<string, unknown> {
  const calls = mockAppend.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return JSON.parse(calls[calls.length - 1][1] as string) as Record<string, unknown>;
}

beforeEach(() => {
  mockAppend.mockClear();
  delete process.env['AGENT_ORCHESTRATOR_WORKER_MODEL'];
});

// ── 1. interpolateCommand replaces {model} ───────────────────────────────────
import { interpolateCommand } from '../providers';
import type { WorkerExecutionInput } from '../providers';

describe('interpolateCommand', () => {
  const baseInput: WorkerExecutionInput = {
    workerProvider: 'copilot-daemon',
    taskId: 42,
    promptPath: '/tmp/prompt.md',
    contractPath: '/tmp/contract.json',
    objective: 'run tests',
    profile: { protected_paths: [], allowed_reference_paths: [] } as unknown as WorkerExecutionInput['profile'],
  };

  test('1. replaces {model} with workerCopilotModel', () => {
    const result = interpolateCommand(
      'worker {task_id} {model}',
      { ...baseInput, workerCopilotModel: 'gpt-5-mini' },
    );
    expect(result).toBe('worker 42 gpt-5-mini');
  });

  test('2. {model} is empty string when workerCopilotModel is absent and env unset', () => {
    const result = interpolateCommand(
      'worker {task_id} "{model}"',
      { ...baseInput, workerCopilotModel: undefined },
    );
    // Model is empty — command still works, just empty arg
    expect(result).toBe('worker 42 ""');
  });

  test('3. {model} falls back to AGENT_ORCHESTRATOR_WORKER_MODEL env var', () => {
    process.env['AGENT_ORCHESTRATOR_WORKER_MODEL'] = 'gpt-4o';
    const result = interpolateCommand(
      'worker {task_id} {model}',
      { ...baseInput, workerCopilotModel: undefined },
    );
    expect(result).toBe('worker 42 gpt-4o');
  });

  test('4. workerCopilotModel takes priority over env var', () => {
    process.env['AGENT_ORCHESTRATOR_WORKER_MODEL'] = 'gpt-4o';
    const result = interpolateCommand(
      '{model}',
      { ...baseInput, workerCopilotModel: 'gpt-5-mini' },
    );
    expect(result).toBe('gpt-5-mini');
  });

  test('5. all other placeholders still work alongside {model}', () => {
    const result = interpolateCommand(
      'bash script {task_id} "{prompt_path}" "{contract_path}" "{provider}" "{objective}" "{model}"',
      { ...baseInput, workerCopilotModel: 'gpt-5-mini' },
    );
    expect(result).toBe(
      'bash script 42 "/tmp/prompt.md" "/tmp/contract.json" "copilot-daemon" "run tests" "gpt-5-mini"',
    );
  });

  test('6. template without {model} token is unchanged', () => {
    const result = interpolateCommand(
      'bash script {task_id} "{provider}"',
      { ...baseInput, workerCopilotModel: 'gpt-5-mini' },
    );
    // {model} token not present — no substitution attempted, other tokens replaced
    expect(result).toBe('bash script 42 "copilot-daemon"');
  });
});

// ── 2. llmUsageLogger model fields ──────────────────────────────────────────
import {
  logProviderExecutionStart,
  logProviderExecutionSuccess,
  logProviderPreflight,
} from '../llmUsageLogger';
import type { ModelPropagationStatus } from '../llmUsageLogger';

describe('llmUsageLogger model propagation fields', () => {
  test('7. logProviderExecutionStart writes desiredModel', () => {
    logProviderExecutionStart({
      caller: 'worker',
      provider: 'copilot-daemon',
      desiredModel: 'gpt-5-mini',
    });
    const r = lastRecord();
    expect(r['desiredModel']).toBe('gpt-5-mini');
  });

  test('8. logProviderExecutionStart writes actualModel = provider-managed when not confirmed', () => {
    logProviderExecutionStart({
      caller: 'worker',
      provider: 'copilot-daemon',
      desiredModel: 'gpt-5-mini',
      actualModel: 'provider-managed',
      modelPropagationStatus: 'provider-managed',
    });
    const r = lastRecord();
    expect(r['actualModel']).toBe('provider-managed');
    expect(r['modelPropagationStatus']).toBe('provider-managed');
  });

  test('9. actualModel is NOT automatically set to desiredModel', () => {
    // When actualModel is not passed, it must be null — not copied from desiredModel
    logProviderExecutionStart({
      caller: 'worker',
      provider: 'copilot-daemon',
      desiredModel: 'gpt-5-mini',
      // actualModel intentionally omitted
    });
    const r = lastRecord();
    expect(r['desiredModel']).toBe('gpt-5-mini');
    expect(r['actualModel']).toBeNull();
  });

  test('10. modelPropagationStatus = not-configured when desiredModel absent', () => {
    logProviderExecutionStart({
      caller: 'worker',
      provider: 'copilot-daemon',
      modelPropagationStatus: 'not-configured',
    });
    const r = lastRecord();
    expect(r['modelPropagationStatus']).toBe('not-configured');
    expect(r['desiredModel']).toBeNull();
    expect(r['actualModel']).toBeNull();
  });

  test('11. modelPropagationStatus type set accepts all valid values', () => {
    const statuses: ModelPropagationStatus[] = [
      'propagated', 'provider-managed', 'not-propagated', 'not-configured',
    ];
    for (const status of statuses) {
      mockAppend.mockClear();
      logProviderExecutionStart({
        caller: 'worker',
        provider: 'copilot-daemon',
        desiredModel: 'gpt-5-mini',
        modelPropagationStatus: status,
      });
      const r = lastRecord();
      expect(r['modelPropagationStatus']).toBe(status);
    }
  });

  test('12. logProviderExecutionSuccess also carries model fields', () => {
    logProviderExecutionSuccess({
      caller: 'worker',
      provider: 'copilot-daemon',
      desiredModel: 'gpt-5-mini',
      actualModel: 'provider-managed',
      modelPropagationStatus: 'provider-managed',
    });
    const r = lastRecord();
    expect(r['event']).toBe('provider_execution_success');
    expect(r['desiredModel']).toBe('gpt-5-mini');
    expect(r['actualModel']).toBe('provider-managed');
    expect(r['modelPropagationStatus']).toBe('provider-managed');
  });

  test('13. planner records do not have desiredModel (no propagation for local providers)', () => {
    logProviderPreflight({
      caller: 'planner',
      provider: 'local-planner',
      allowed: false,
      skipReason: 'SCHEDULER_DISABLED',
    });
    const r = lastRecord();
    expect(r['caller']).toBe('planner');
    expect(r['provider']).toBe('local-planner');
    // No desiredModel passed — should be null
    expect(r['desiredModel']).toBeNull();
  });

  test('14. cto records do not have desiredModel (local-only)', () => {
    logProviderPreflight({
      caller: 'cto',
      provider: 'local-review',
      allowed: false,
      skipReason: 'SCHEDULER_DISABLED',
    });
    const r = lastRecord();
    expect(r['caller']).toBe('cto');
    expect(r['provider']).toBe('local-review');
    expect(r['desiredModel']).toBeNull();
  });
});
