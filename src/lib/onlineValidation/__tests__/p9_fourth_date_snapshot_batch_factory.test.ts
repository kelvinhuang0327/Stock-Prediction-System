/**
 * p9_fourth_date_snapshot_batch_factory.test.ts
 * P9 — FourthDateSnapshotBatchFactory tests
 */

import {
    buildFourthDateSnapshotSeed,
    buildFourthDateSimulationSnapshots,
    buildFourthDateSimulationSnapshotBatch,
    validateFourthDateSnapshotBatch,
    FOURTH_DATE_AS_OF_DATE,
    FOURTH_DATE_SIMULATION_RUN_ID,
    FOURTH_DATE_REVIEW_DATE,
} from '../FourthDateSnapshotBatchFactory';

const P5_RUN_ID = 'p5-replay-simulation-20260511-001';
const P7_RUN_ID = 'p7-second-date-simulation-20260512-001';
const P8_RUN_ID = 'p8-third-date-simulation-20260513-001';

describe('FourthDateSnapshotBatchFactory — P9', () => {
    describe('buildFourthDateSnapshotSeed', () => {
        it('should return default asOfDate=2026-05-14', () => {
            const seed = buildFourthDateSnapshotSeed();
            expect(seed.asOfDate).toBe(FOURTH_DATE_AS_OF_DATE);
            expect(seed.asOfDate).toBe('2026-05-14');
        });

        it('should return default simulationRunId with p9-fourth-date prefix', () => {
            const seed = buildFourthDateSnapshotSeed();
            expect(seed.simulationRunId).toBe(FOURTH_DATE_SIMULATION_RUN_ID);
            expect(seed.simulationRunId).toContain('p9-fourth-date');
        });

        it('should differ from P5 simulationRunId', () => {
            const seed = buildFourthDateSnapshotSeed();
            expect(seed.simulationRunId).not.toBe(P5_RUN_ID);
        });

        it('should differ from P7 simulationRunId', () => {
            const seed = buildFourthDateSnapshotSeed();
            expect(seed.simulationRunId).not.toBe(P7_RUN_ID);
        });

        it('should differ from P8 simulationRunId', () => {
            const seed = buildFourthDateSnapshotSeed();
            expect(seed.simulationRunId).not.toBe(P8_RUN_ID);
        });

        it('should use DETERMINISTIC_TEST_FIXTURE source', () => {
            const seed = buildFourthDateSnapshotSeed();
            expect(seed.source).toBe('DETERMINISTIC_TEST_FIXTURE');
        });

        it('should include at least 2 symbols', () => {
            const seed = buildFourthDateSnapshotSeed();
            expect(seed.symbols.length).toBeGreaterThanOrEqual(2);
        });

        it('should include 5D/20D/60D horizons', () => {
            const seed = buildFourthDateSnapshotSeed();
            expect(seed.horizons).toContain('5D');
            expect(seed.horizons).toContain('20D');
            expect(seed.horizons).toContain('60D');
        });

        it('should accept custom options', () => {
            const seed = buildFourthDateSnapshotSeed({
                reviewDate: '2026-07-20',
                simulationRunId: 'custom-p9-run',
            });
            expect(seed.reviewDate).toBe('2026-07-20');
            expect(seed.simulationRunId).toBe('custom-p9-run');
        });
    });

    describe('buildFourthDateSimulationSnapshots', () => {
        it('should produce at least 6 snapshots', () => {
            const seed = buildFourthDateSnapshotSeed();
            const snapshots = buildFourthDateSimulationSnapshots(seed);
            expect(snapshots.length).toBeGreaterThanOrEqual(6);
        });

        it('should have at least 3 SNAPSHOT_READY', () => {
            const seed = buildFourthDateSnapshotSeed();
            const snapshots = buildFourthDateSimulationSnapshots(seed);
            const readyCount = snapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_READY').length;
            expect(readyCount).toBeGreaterThanOrEqual(3);
        });

        it('should have at least 1 SNAPSHOT_BLOCKED', () => {
            const seed = buildFourthDateSnapshotSeed();
            const snapshots = buildFourthDateSimulationSnapshots(seed);
            const blockedCount = snapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_BLOCKED').length;
            expect(blockedCount).toBeGreaterThanOrEqual(1);
        });

        it('should set originalAsOfDate=2026-05-14 on all snapshots', () => {
            const seed = buildFourthDateSnapshotSeed();
            const snapshots = buildFourthDateSimulationSnapshots(seed);
            for (const snap of snapshots) {
                expect(snap.originalAsOfDate).toBe('2026-05-14');
            }
        });

        it('should have three write locks all false', () => {
            const seed = buildFourthDateSnapshotSeed();
            const snapshots = buildFourthDateSimulationSnapshots(seed);
            for (const snap of snapshots) {
                expect(snap.productionWriteAllowed).toBe(false);
                expect(snap.simulationWriteAllowed).toBe(false);
                expect(snap.optimizerWriteAllowed).toBe(false);
            }
        });

        it('should not contain forbidden claims', () => {
            const seed = buildFourthDateSnapshotSeed();
            const snapshots = buildFourthDateSimulationSnapshots(seed);
            const text = JSON.stringify(snapshots);
            expect(text).not.toMatch(/\bprofit\b/i);
            expect(text).not.toMatch(/\bbuy\b/i);
            expect(text).not.toMatch(/\bsell\b/i);
            expect(text).not.toMatch(/\bguaranteed\b/i);
            expect(text).not.toMatch(/\boutperform\b/i);
            expect(text).not.toMatch(/\bexpected_return\b/i);
        });
    });

    describe('buildFourthDateSimulationSnapshotBatch', () => {
        it('should set dryRun=true', () => {
            const seed = buildFourthDateSnapshotSeed();
            const batch = buildFourthDateSimulationSnapshotBatch(seed);
            expect(batch.dryRun).toBe(true);
        });

        it('should set mode=SNAPSHOT_ONLY', () => {
            const seed = buildFourthDateSnapshotSeed();
            const batch = buildFourthDateSimulationSnapshotBatch(seed);
            expect(batch.mode).toBe('SNAPSHOT_ONLY');
        });

        it('should pass batch validation', () => {
            const seed = buildFourthDateSnapshotSeed();
            const batch = buildFourthDateSimulationSnapshotBatch(seed);
            const result = validateFourthDateSnapshotBatch(batch);
            expect(result.status).toBe('PASS');
        });
    });

    describe('validateFourthDateSnapshotBatch', () => {
        it('should reject dryRun=false', () => {
            const seed = buildFourthDateSnapshotSeed();
            const batch = buildFourthDateSimulationSnapshotBatch(seed);
            const mutated = { ...batch, dryRun: false };
            const result = validateFourthDateSnapshotBatch(mutated);
            expect(result.status).toBe('FAIL');
            expect(result.messages.some(m => m.includes('dryRun'))).toBe(true);
        });

        it('should reject if simulationRunId equals P5', () => {
            const seed = buildFourthDateSnapshotSeed();
            const batch = buildFourthDateSimulationSnapshotBatch(seed);
            const result = validateFourthDateSnapshotBatch({ ...batch, simulationRunId: P5_RUN_ID });
            expect(result.status).toBe('FAIL');
        });

        it('should reject if simulationRunId equals P7', () => {
            const seed = buildFourthDateSnapshotSeed();
            const batch = buildFourthDateSimulationSnapshotBatch(seed);
            const result = validateFourthDateSnapshotBatch({ ...batch, simulationRunId: P7_RUN_ID });
            expect(result.status).toBe('FAIL');
        });

        it('should reject if simulationRunId equals P8', () => {
            const seed = buildFourthDateSnapshotSeed();
            const batch = buildFourthDateSimulationSnapshotBatch(seed);
            const result = validateFourthDateSnapshotBatch({ ...batch, simulationRunId: P8_RUN_ID });
            expect(result.status).toBe('FAIL');
        });

        it('should reject if originalAsOfDate is wrong', () => {
            const seed = buildFourthDateSnapshotSeed({ asOfDate: '2026-05-15' });
            const batch = buildFourthDateSimulationSnapshotBatch(seed);
            const result = validateFourthDateSnapshotBatch(batch);
            expect(result.status).toBe('FAIL');
            expect(result.messages.some(m => m.includes('originalAsOfDate'))).toBe(true);
        });
    });
});
