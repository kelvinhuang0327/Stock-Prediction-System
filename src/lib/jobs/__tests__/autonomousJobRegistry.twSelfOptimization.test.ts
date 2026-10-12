import { AUTONOMOUS_JOB_REGISTRY, getAutonomousJobNextDueAt } from '../autonomousJobRegistry';

describe('Taiwan self-optimization scheduler registry', () => {
  test('registers all requested self-optimization jobs', () => {
    expect(AUTONOMOUS_JOB_REGISTRY['training:tw-optimization-miner']).toBeDefined();
    expect(AUTONOMOUS_JOB_REGISTRY['training:tw-worker-cycle']).toBeDefined();
    expect(AUTONOMOUS_JOB_REGISTRY['training:tw-insight-ingest']).toBeDefined();
    expect(AUTONOMOUS_JOB_REGISTRY['training:tw-weekly-deep-research']).toBeDefined();
    expect(AUTONOMOUS_JOB_REGISTRY['training:tw-self-audit']).toBeDefined();
  });

  test('schedules optimization miner after the daily Taiwan report', () => {
    const now = new Date('2026-05-03T12:00:00.000Z');
    const reportNext = getAutonomousJobNextDueAt('training:tw-report', now);
    const minerNext = getAutonomousJobNextDueAt('training:tw-optimization-miner', now);

    expect(minerNext.getTime()).toBeGreaterThan(reportNext.getTime());
  });
});