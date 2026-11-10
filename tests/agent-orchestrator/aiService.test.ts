jest.resetModules();

jest.mock('../../src/lib/agent-orchestrator/providerFactory', () => ({
  enforceProviderForRole: jest.fn(() => ({ allowed: true, blockReason: null, resolution: {} })),
}));

jest.mock('../../src/lib/agent-orchestrator/llmExecutionPolicy', () => ({
  evaluateExecutionPolicy: jest.fn(async () => ({ allowed: false, skip_reason: 'SCHEDULER_DISABLED' })),
}));

jest.mock('../../src/lib/agent-orchestrator/aiModulesService', () => ({
  buildPolicyBlockedWorkerOutput: jest.fn((input: unknown, reason: unknown) => ({ blocked: true, reason })),
}));

import { executeWorkerProviderCommand } from '../../src/lib/agent-orchestrator/aiService';
import type { WorkerExecutionInput } from '../../src/lib/agent-orchestrator/providers';

test('executeWorkerProviderCommand returns blocked output when policy denies', async () => {
  const input = {
    workerProvider: 'codex',
    taskId: 7,
    promptPath: '',
    contractPath: '',
    objective: '',
    profile: {
      project_name: 'Test',
      project_slug: 'test',
      orchestrator_root: '/tmp',
      backlog_path: '/tmp/backlog.md',
      task_storage_path: '/tmp/tasks',
      log_storage_path: '/tmp/logs',
      database_path: '/tmp/db',
      default_schedule_minutes: 30,
      planner_provider: 'codex',
      worker_provider: 'codex',
      planner_rules: {
        must_read_previous_result: false,
        skip_if_latest_running: true,
        retry_replan_required_first: false,
      },
      worker_rules: {
        single_active_task: true,
        finalize_on_permission_block: true,
        finalize_on_stale_output_minutes: 120,
      },
      protected_paths: [],
      required_checks: [],
      allowed_reference_paths: [],
      required_contract_fields: [],
      required_result_fields: [],
      ui: {
        show_contract: true,
        show_result: true,
        show_gate_verdict: true,
        show_last_output_time: true,
        show_latest_progress_summary: true,
      },
    },
  } satisfies WorkerExecutionInput;
  const res = await executeWorkerProviderCommand({
    input,
    externalCommand: 'echo hi',
    interpolateCommand: () => 'echo hi',
    parseChangedFiles: () => [],
    detectProviderRateLimit: () => null,
  });
  expect(res).toHaveProperty('blocked', true);
  expect(res).toHaveProperty('reason', 'SCHEDULER_DISABLED');
});
