describe('service exported behavior', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('runOrchestratorNow dispatches to planner only', async () => {
    jest.isolateModules(() => {
      // mock modules by resolved path to ensure correct module identity
      jest.doMock(require.resolve('../plannerTick'), () => ({ runPlannerTick: jest.fn().mockResolvedValue({ ok: true }) }));
      jest.doMock(require.resolve('../workerTick'), () => ({ runWorkerTick: jest.fn().mockResolvedValue({ ok: false }) }));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { runOrchestratorNow } = require('../service');
      return runOrchestratorNow('planner').then((res: any) => {
        expect(res.planner).toEqual({ ok: true });
        expect(res.worker).toBeNull();
      });
    });
  });

  test('updateOrchestratorScheduler enables scheduler and saves state', async () => {
    jest.isolateModules(() => {
      const mockProfile = { project_name: 'p', backlog_path: '', protected_paths: [], required_checks: [], orchestrator_root: '.', task_storage_path: '.', log_storage_path: '.', database_path: '.' };
      const mockState = { schedulerEnabled: false, scheduleMinutes: 15, providerCooldowns: {}, plannerProvider: 'codex', workerProvider: 'codex' };
      jest.doMock(require.resolve('../profile'), () => ({ loadProjectProfile: jest.fn().mockResolvedValue(mockProfile) }));
      jest.doMock(require.resolve('../storage'), () => ({ loadSchedulerState: jest.fn().mockResolvedValue({ paths: {}, state: mockState }), saveSchedulerState: jest.fn().mockResolvedValue(null) }));
      jest.doMock(require.resolve('../common'), () => ({ nowIso: () => 'now', scheduleNextRunAt: () => 'next' }));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { updateOrchestratorScheduler } = require('../service');
      return updateOrchestratorScheduler(true).then((state: any) => {
        expect(state.schedulerEnabled).toBe(true);
        expect(state.nextPlannerRunAt).toBe('next');
        expect(state.nextWorkerRunAt).toBe('next');
      });
    });
  });
});
