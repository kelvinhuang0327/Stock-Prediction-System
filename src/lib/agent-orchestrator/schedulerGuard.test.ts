import { isGlobalSchedulerEnabled, GLOBAL_SCHEDULER_DISABLED_MESSAGE } from './schedulerGuard';
import * as profile from './profile';
import * as storage from './storage';

jest.mock('./profile');
jest.mock('./storage');

describe('schedulerGuard', () => {
  beforeEach(() => {
    (profile.loadProjectProfile as unknown as jest.Mock).mockResolvedValue({ project_slug: 'test' });
  });

  test('returns true when schedulerEnabled is true (happy path)', async () => {
    (storage.loadSchedulerState as unknown as jest.Mock).mockResolvedValue({ state: { schedulerEnabled: true } });
    const res = await isGlobalSchedulerEnabled();
    expect(res).toBe(true);
  });

  test('returns false when schedulerEnabled is false (error path)', async () => {
    (storage.loadSchedulerState as unknown as jest.Mock).mockResolvedValue({ state: { schedulerEnabled: false } });
    const res = await isGlobalSchedulerEnabled();
    expect(res).toBe(false);
  });

  test('exports a helpful constant (edge case)', () => {
    expect(GLOBAL_SCHEDULER_DISABLED_MESSAGE).toMatch(/GLOBAL_SCHEDULER_DISABLED/);
  });
});
