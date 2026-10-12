import { PROFILE_PATH, readJsonFile } from './common';
import type { PlannerProvider, ProjectProfile, WorkerProvider } from './types';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isNonEmptyString(item));
}

function isPlannerProvider(value: unknown): value is PlannerProvider {
  return value === 'codex' || value === 'claude';
}

function isWorkerProvider(value: unknown): value is WorkerProvider {
  return value === 'codex' || value === 'claude' || value === 'copilot' || value === 'copilot-daemon';
}

export function validateProjectProfileShape(value: unknown): { ok: true } | { ok: false; errors: string[] } {
  const profile = value as Partial<ProjectProfile>;
  const errors: string[] = [];

  if (!isNonEmptyString(profile.project_name)) errors.push('project_name is required');
  if (!isNonEmptyString(profile.project_slug) || !/^[a-z0-9-]{3,50}$/.test(profile.project_slug)) {
    errors.push('project_slug must match ^[a-z0-9-]{3,50}$');
  }

  for (const field of [
    'orchestrator_root',
    'backlog_path',
    'task_storage_path',
    'log_storage_path',
    'database_path',
  ] as const) {
    if (!isNonEmptyString(profile[field])) {
      errors.push(`${field} is required`);
    }
  }

  if (
    typeof profile.default_schedule_minutes !== 'number' ||
    !Number.isInteger(profile.default_schedule_minutes) ||
    profile.default_schedule_minutes < 1 ||
    profile.default_schedule_minutes > 1440
  ) {
    errors.push('default_schedule_minutes must be an integer between 1 and 1440');
  }

  if (!isPlannerProvider(profile.planner_provider)) {
    errors.push('planner_provider must be one of: codex, claude');
  }
  if (!isWorkerProvider(profile.worker_provider)) {
    errors.push('worker_provider must be one of: codex, claude, copilot, copilot-daemon');
  }

  if (!profile.planner_rules) {
    errors.push('planner_rules is required');
  } else {
    if (typeof profile.planner_rules.must_read_previous_result !== 'boolean') {
      errors.push('planner_rules.must_read_previous_result must be boolean');
    }
    if (typeof profile.planner_rules.skip_if_latest_running !== 'boolean') {
      errors.push('planner_rules.skip_if_latest_running must be boolean');
    }
    if (typeof profile.planner_rules.retry_replan_required_first !== 'boolean') {
      errors.push('planner_rules.retry_replan_required_first must be boolean');
    }
  }

  if (!profile.worker_rules) {
    errors.push('worker_rules is required');
  } else {
    if (typeof profile.worker_rules.single_active_task !== 'boolean') {
      errors.push('worker_rules.single_active_task must be boolean');
    }
    if (typeof profile.worker_rules.finalize_on_permission_block !== 'boolean') {
      errors.push('worker_rules.finalize_on_permission_block must be boolean');
    }
    if (
      typeof profile.worker_rules.finalize_on_stale_output_minutes !== 'number' ||
      !Number.isInteger(profile.worker_rules.finalize_on_stale_output_minutes) ||
      profile.worker_rules.finalize_on_stale_output_minutes < 1 ||
      profile.worker_rules.finalize_on_stale_output_minutes > 1440
    ) {
      errors.push('worker_rules.finalize_on_stale_output_minutes must be integer between 1 and 1440');
    }
  }

  if (!isStringArray(profile.protected_paths)) errors.push('protected_paths must be a non-empty string array');
  if (!isStringArray(profile.required_checks)) errors.push('required_checks must be a non-empty string array');
  if (!isStringArray(profile.allowed_reference_paths)) errors.push('allowed_reference_paths must be a non-empty string array');
  if (!isStringArray(profile.required_contract_fields)) errors.push('required_contract_fields must be a non-empty string array');
  if (!isStringArray(profile.required_result_fields)) errors.push('required_result_fields must be a non-empty string array');

  if (!profile.ui) {
    errors.push('ui is required');
  } else {
    if (typeof profile.ui.show_contract !== 'boolean') errors.push('ui.show_contract must be boolean');
    if (typeof profile.ui.show_result !== 'boolean') errors.push('ui.show_result must be boolean');
    if (typeof profile.ui.show_gate_verdict !== 'boolean') errors.push('ui.show_gate_verdict must be boolean');
    if (typeof profile.ui.show_last_output_time !== 'boolean') errors.push('ui.show_last_output_time must be boolean');
    if (typeof profile.ui.show_latest_progress_summary !== 'boolean') {
      errors.push('ui.show_latest_progress_summary must be boolean');
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

export async function loadProjectProfile(): Promise<ProjectProfile> {
  const profile = await readJsonFile<ProjectProfile>(PROFILE_PATH);
  const validation = validateProjectProfileShape(profile);
  if (validation.ok === false) {
    throw new Error(`Invalid project profile: ${validation.errors.join('; ')}`);
  }
  return profile;
}
