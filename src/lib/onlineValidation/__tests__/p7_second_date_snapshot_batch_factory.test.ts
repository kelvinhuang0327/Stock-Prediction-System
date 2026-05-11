import {
    buildSecondDateSnapshotSeed,
    buildSecondDateSimulationSnapshots,
    buildSecondDateSimulationSnapshotBatch,
    validateSecondDateSnapshotBatch,
} from '../SecondDateSnapshotBatchFactory';

describe('SecondDateSnapshotBatchFactory', () => {
    it('uses default asOfDate=2026-05-12', () => {
        const seed = buildSecondDateSnapshotSeed();
        expect(seed.asOfDate).toBe('2026-05-12');
    });

    it('simulationRunId differs from P5', () => {
        const seed = buildSecondDateSnapshotSeed();
        expect(seed.simulationRunId).not.toBe('p5-replay-simulation-20260511-001');
    });

    it('produces at least 6 snapshots', () => {
        const seed = buildSecondDateSnapshotSeed();
        const snapshots = buildSecondDateSimulationSnapshots(seed);
        expect(snapshots.length).toBeGreaterThanOrEqual(6);
    });

    it('produces at least 3 SNAPSHOT_READY', () => {
        const seed = buildSecondDateSnapshotSeed();
        const snapshots = buildSecondDateSimulationSnapshots(seed);
        expect(snapshots.filter(snapshot => snapshot.snapshotStatus === 'SNAPSHOT_READY').length).toBeGreaterThanOrEqual(3);
    });

    it('sets originalAsOfDate to 2026-05-12 for all snapshots', () => {
        const seed = buildSecondDateSnapshotSeed();
        const snapshots = buildSecondDateSimulationSnapshots(seed);
        expect(new Set(snapshots.map(snapshot => snapshot.originalAsOfDate))).toEqual(new Set(['2026-05-12']));
    });

    it('keeps all three write locks false', () => {
        const seed = buildSecondDateSnapshotSeed();
        const snapshots = buildSecondDateSimulationSnapshots(seed);
        for (const snapshot of snapshots) {
            expect(snapshot.productionWriteAllowed).toBe(false);
            expect(snapshot.simulationWriteAllowed).toBe(false);
            expect(snapshot.optimizerWriteAllowed).toBe(false);
        }
    });

    it('contains no forbidden claims', () => {
        const seed = buildSecondDateSnapshotSeed();
        const batch = buildSecondDateSimulationSnapshotBatch(seed);
        const text = JSON.stringify(batch);
        expect(text).not.toMatch(/\bprofit\b/i);
        expect(text).not.toMatch(/\bguaranteed\b/i);
        expect(text).not.toMatch(/\bedge confirmed\b/i);
        expect(text).not.toMatch(/\bproduction approved\b/i);
        expect(text).not.toMatch(/\bauto trading\b/i);
        expect(text).not.toMatch(/\bbuy\b/i);
        expect(text).not.toMatch(/\bsell\b/i);
        expect(text).not.toMatch(/\boutperform\b/i);
        expect(text).not.toMatch(/\bexpected_return\b/i);
        expect(text).not.toMatch(/\bstrategy performance\b/i);
    });

    it('batch validation rejects dryRun=false', () => {
        const seed = buildSecondDateSnapshotSeed();
        const batch = buildSecondDateSimulationSnapshotBatch(seed);
        const result = validateSecondDateSnapshotBatch({ ...batch, dryRun: false } as typeof batch);
        expect(result.valid).toBe(false);
        expect(result.status).toBe('FAIL');
    });

    it('batch validation rejects wrong asOfDate', () => {
        const seed = buildSecondDateSnapshotSeed({ asOfDate: '2026-05-13' });
        const batch = buildSecondDateSimulationSnapshotBatch(seed);
        const result = validateSecondDateSnapshotBatch(batch);
        expect(result.valid).toBe(false);
        expect(result.status).toBe('FAIL');
    });

    it('validates the default batch as PASS', () => {
        const seed = buildSecondDateSnapshotSeed();
        const batch = buildSecondDateSimulationSnapshotBatch(seed);
        const result = validateSecondDateSnapshotBatch(batch);
        expect(result.valid).toBe(true);
        expect(result.status).toBe('PASS');
    });
});
