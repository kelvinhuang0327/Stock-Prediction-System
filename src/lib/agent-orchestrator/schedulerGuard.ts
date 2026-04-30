import { loadProjectProfile } from './profile';
import { loadSchedulerState } from './storage';

export const GLOBAL_SCHEDULER_DISABLED_MESSAGE = 'GLOBAL_SCHEDULER_DISABLED — skip execution';

export async function isGlobalSchedulerEnabled(): Promise<boolean> {
  const profile = await loadProjectProfile();
  const { state } = await loadSchedulerState(profile);
  return state.schedulerEnabled;
}
