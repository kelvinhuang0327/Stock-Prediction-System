import { buildAutonomousDataSnapshot } from '../AutonomousDataLayer';

describe('AutonomousDataLayer', () => {
  it('builds a three-layer data snapshot with freshness metadata', async () => {
    const snapshot = await buildAutonomousDataSnapshot();

    expect(snapshot.generatedAt).toBeTruthy();
    expect(snapshot.statuses).toHaveLength(3);
    expect(snapshot.statuses.map((s) => s.key).sort()).toEqual(['events', 'fundamental', 'technical']);
    expect(snapshot.limitations).toBeDefined();

    const technical = snapshot.statuses.find((s) => s.key === 'technical');
    const fundamental = snapshot.statuses.find((s) => s.key === 'fundamental');
    const events = snapshot.statuses.find((s) => s.key === 'events');

    expect(technical?.latestTimestamp).toBeTruthy();
    expect(fundamental?.latestTimestamp).toBeTruthy();
    expect(events?.latestTimestamp).toBeTruthy();
    expect(['full', 'limited', 'insufficient']).toContain(snapshot.overallCoverage);
  });
});
