/**
 * p8_third_date_snapshot_batch_factory.test.ts
 * P8 — ThirdDateSnapshotBatchFactory tests
 */

import {
    buildThirdDateSnapshotSeed,
    buildThirdDateSimulationSnapshots,
    buildThirdDateSimulationSnapshotBatch,
    validateThirdDateSnapshotBatch,
    THIRD_DATE_AS_OF_DATE,
    THIRD_DATE_SIMULATION_RUN_ID,
    THIRD_DATE_REVIEW_DATE,
} from '../ThirdDateSnapshotBatchFactory';

const P5_RUN_ID = 'p5-replay-simulation-20260511-001';
const P7_RUN_ID = 'p7-second-date-simulation-20260512-001';

describe('ThirdDateSnapshotBatchFactory — P8', () => {
    describe('buildThirdDateSnapshotSeed', () => {
        it('should return default asOfDate=2026-05-13', () => {
            const seed = buildThirdDateSnapshotSeed();
            expect(seed.asOfDate).toBe(THIRD_DATE_AS_OF_DATE);
            expect(seed.asOfDate).toBe('2026-05-13');
        });

        it('should return default simulationRunId with p8-third-date prefix', () => {
            const seed = buildThirdDateSnapshotSeed();
            expect(seed.simulationRunId).toBe(THIRD_DATE_SIMULATION_RUN_ID);
            expect(seed.simulationRunId).toContain('p8-third-date');
        });

        it('should differ from P5 simulationRunId', () => {
            const seed = buildThirdDateSnapshotSeed();
            expect(seed.simulationRunId).not.toBe(P5_RUN_ID);
        });

        it('should differ from P7 simulationRunId', () => {
            const seed = buildThirdDateSnapshotSeed();
            expect(seed.simulationRunId).not.toBe(P7_RUN_ID);
        });

        it('should use DETERMINISTIC_TEST_FIXTURE source', () => {
            const seed = buildThirdDateSnapshotSeed();
            expect(seed.source).toBe('DETERMINISTIC_TEST_FIXTURE');
        });

        it('should include at least 2 symbols', () => {
            const seed = buildThirdDateSnapshotSeed();
            expect(seed.symbols.length).toBeGreaterThanOrEqual(2);
        });

        it('should include 3 horizons', () => {
            const seed = buildThirdDateSnapshotSeed();
            expect(seed.horizons).toContain('5D');
            expect(seed.horizons).toContain('20D');
            expect(seed.horizons).toContain('60D');
        });

        it('should accept custom options', () => {
            const seed = buildThirdDateSnapshotSeed({
                asOfDate: '2026-05-13',
                reviewDate: '2026-07-15',
                simulationRunId: 'custom-run-001',
            });
            expect(seed.reviewDate).toBe('2026-07-15');
            expect(seed.simulationRunId).toBe('custom-run-001');
        });
    });

    describe('buildThirdDateSimulationSnapshots', () => {
        it('should produce at least 6 snapshots', () => {
            const seed = buildThirdDateSnapshotSeed();
            const snapshots = buildThirdDateSimulationSnapshots(seed);
            expect(snapshots.length).toBeGreaterThanOrEqual(6);
        });

        it('should have at least 3 SNAPSHOT_READY', () => {
            const seed = buildThirdDateSnapshotSeed();
            const snapshots = buildThirdDateSimulationSnapshots(seed);
            const readyCount = snapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_READY').length;
            expect(readyCount).toBeGreaterThanOrEqual(3);
        });

        it('should have at least 1 SNAPSHOT_BLOCKED', () => {
            const seed = buildThirdDateSnapshotSeed();
            const snapshots = buildThirdDateSimulationSnapshots(seed);
            const blockedCount = snapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_BLOCKED').length;
            expect(blockedCount).toBeGreaterThanOrEqual(1);
        });

        it('should set originalAsOfDate=2026-05-13 on all snapshots', () => {
            const seed = buildThirdDateSnapshotSeed();
            const snapshots = buildThirdDateSimulationSnapshots(seed);
            for (const snap of snapshots) {
                expect(snap.originalAsOfDate).toBe('2026-05-13');
            }
        });

        it('should have three write locks all false', () => {
            const seed = buildThirdDateSnapshotSeed();
            const snapshots = buildThirdDateSimulationSnapshots(seed);
            for (const snap of snapshots) {
                expect(snap.productionWriteAllowed).toBe(false);
                expect(snap.simulationWriteAllowed).toBe(false);
                expect(snap.optimizerWriteAllowed).toBe(false);
            }
        });

        it('should not contain forbidden claims', () => {
            const seed = buildThirdDateSnapshotSeed();
            const snapshots = buildThirdDateSimulationSnapshots(seed);
            const text = JSON.stringify(snapshots);
            expect(text).not.toMatch(/\bprofit\b/i);
            expect(text).not.toMatch(/\bbuy\b/i);
            expect(text).not.toMatch(/\bsell\b/i);
            expect(text).not.toMatch(/\bguaranteed\b/i);
            expect(text).not.toMatch(/\boutperform\b/i);
            expect(text).not.toMatch(/\bexpected_return\b/i);
        });
    });

    describe('buildThirdDateSimulationSnapshotBatch', () => {
        it('should set dryRun=true', () => {
            const seed = buildThirdDateSnapshotSeed();
            const batch = buildThirdDateSimulationSnapshotBatch(seed);
            expect(batch.dryRun).toBe(true);
        });

        it('should set mode=SNAPSHOT_ONLY', () => {
            const seed = buildThirdDateSnapshotSeed();
            const batch = buildThirdDateSimulationSnapshotBatch(seed);
            expect(batch.mode).toBe('SNAPSHOT_ONLY');
        });

        it('should pass batch validation', () => {
            const seed = buildThirdDateSnapshotSeed();
            const batch = buildThirdDateSimulationSnapshotBatch(seed);
            const result = validateThirdDateSnapshotBatch(batch);
            expect(result.status).toBe('PASS');
        });
    });

    describe('validateThirdDateSnapshotBatch', () => {
        it('should reject dryRun=false', () => {
            const seed = buildThirdDateSnapshotSeed();
            const batch = buildThirdDateSimulationSnapshotBatch(seed);
            const mutated = { ...batch, dryRun: false };
            const result = validateThirdDateSnapshotBatch(mutated);
            expect(result.status).toBe('FAIL');
            expect(result.messages.some(m => m.includes('dryRun'))).toBe(true);
        });

        it('should reject if simulationRunId equals P5', () => {
            const seed = buildThirdDateSnapshotSeed();
            const batch = buildThirdDateSimulationSnapshotBatch(seed);
            const mutated = { ...batch, simulationRunId: P5_RUN_ID };
            const result = validateThirdDateSnapshotBatch(mutated);
            expect(result.status).toBe('FAIL');
        });

        it('should reject if simulationRunId equals P7', () => {
            const seed = buildThirdDateSnapshotSeed();
            const batch = buildThirdDateSimulationSnapshotBatch(seed);
            const mutated = { ...batch, simulationRunId: P7_RUN_ID };
            const result = validateThirdDateSnapshotBatch(mutated);
            expect(result.status).toBe('FAIL');
        });

        it('should reject if originalAsOfDate is wrong', () => {
            const seed = buildThirdDateSnapshotSeed({ asOfDate: '2026-05-14' });
            const batch = buildThirdDateSimulationSnapshotBatch(seed);
            const result = validateThirdDateSnapshotBatch(batch);
            expect(result.status).toBe('FAIL');
            expect(result.messages.some(m => m.includes('originalAsOfDate'))).toBe(true);
        });
    });
});
