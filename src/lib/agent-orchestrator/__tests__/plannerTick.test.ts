import { runPlannerTick } from '../plannerTick';

jest.mock('../profile', () => ({
  loadProjectProfile: jest.fn().mockResolvedValue({
    project_name: 'p',
    project_slug: 'p-slug',
    orchestrator_root: '.',
    backlog_path: 'backlog.md',
    task_storage_path: 'tasks',
    log_storage_path: 'logs',
    database_path: 'dev.db',
    default_schedule_minutes: 1,
    planner_provider: 'codex',
    worker_provider: 'codex',
    planner_rules: { must_read_previous_result: false, skip_if_latest_running: false, retry_replan_required_first: false },
    worker_rules: { single_active_task: false, finalize_on_permission_block: false, finalize_on_stale_output_minutes: 10 },
    protected_paths: ['src/'],
    required_checks: [],
    allowed_reference_paths: [],
    required_contract_fields: [],
    required_result_fields: [],
    ui: { show_contract: true, show_result: true, show_gate_verdict: true, show_last_output_time: true, show_latest_progress_summary: true },
  } as any),
}));

jest.mock('../storage', () => ({
  loadSchedulerState: jest.fn().mockResolvedValue({ paths: {}, state: { schedulerEnabled: false, scheduleMinutes: 1, plannerProvider: 'codex', workerProvider: 'codex' } }),
  loadTaskIndex: jest.fn().mockResolvedValue({ tasks: [] }),
  appendRun: jest.fn(),
  saveSchedulerState: jest.fn(),
  getLatestTask: jest.fn().mockReturnValue(null),
}));

jest.mock('../common', () => ({
  fileExists: jest.fn().mockResolvedValue(false),
  readTextFile: jest.fn().mockResolvedValue('# backlog'),
  nowIso: jest.fn().mockReturnValue('2020-01-01T00:00:00.000Z'),
  scheduleNextRunAt: jest.fn().mockReturnValue('2020-01-01T01:00:00.000Z'),
}));

describe('plannerTick', () => {
  it('skips when scheduler is disabled', async () => {
    const res = await runPlannerTick();
    expect(res.status).toBe('skipped');
    expect(res.reason).toBe('scheduler_disabled');
  });
});
