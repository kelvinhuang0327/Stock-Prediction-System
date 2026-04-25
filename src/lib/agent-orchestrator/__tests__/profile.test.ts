import { validateProjectProfileShape, loadProjectProfile } from '../profile';

jest.mock('../common', () => ({
  readJsonFile: jest.fn(),
}));

const { readJsonFile } = require('../common');

describe('profile validation', () => {
  it('rejects invalid shapes', () => {
    const res = validateProjectProfileShape({});
    expect(res.ok).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('accepts a minimal valid profile and loadProjectProfile resolves', async () => {
    const good = {
      project_name: 'p',
      project_slug: 'proj-1',
      orchestrator_root: '.',
      backlog_path: 'backlog.md',
      task_storage_path: 'tasks',
      log_storage_path: 'logs',
      database_path: 'dev.db',
      default_schedule_minutes: 10,
      planner_provider: 'codex',
      worker_provider: 'codex',
      planner_rules: { must_read_previous_result: false, skip_if_latest_running: false, retry_replan_required_first: false },
      worker_rules: { single_active_task: false, finalize_on_permission_block: false, finalize_on_stale_output_minutes: 10 },
      protected_paths: ['src/'],
      required_checks: ['x'],
      allowed_reference_paths: ['src/'],
      required_contract_fields: ['a'],
      required_result_fields: ['b'],
      ui: { show_contract: true, show_result: true, show_gate_verdict: true, show_last_output_time: true, show_latest_progress_summary: true },
    };

    readJsonFile.mockResolvedValueOnce(good);
    const loaded = await loadProjectProfile();
    expect(loaded).toHaveProperty('project_name', 'p');
  });

  it('loadProjectProfile throws on invalid profile returned by readJsonFile', async () => {
    readJsonFile.mockResolvedValueOnce({ project_name: 'x' });
    await expect(loadProjectProfile()).rejects.toThrow(/Invalid project profile/);
  });
});
