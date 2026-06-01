/**
 * Lane-B contract alignment for twQ1 financial ingest check.
 *
 * This suite verifies the currently implemented runner contract:
 * - Registry includes the twQ1 scheduler entry.
 * - No dedicated exported runner exists yet in autonomousJobRunners.
 */

import { AUTONOMOUS_JOB_REGISTRY } from '../autonomousJobRegistry';
import * as autonomousJobRunners from '../autonomousJobRunners';

const JOB_NAME = 'training:tw-q1-financial-ingest-check' as const;

describe('twQ1 financial ingest check runner expectations', () => {
  test('registry entry exists and can be scheduled', () => {
    const entry = AUTONOMOUS_JOB_REGISTRY[JOB_NAME];
    expect(entry).toBeDefined();
    expect(entry.cadence).toBe('daily');
  });

  test('no dedicated autonomousJobRunners export is currently defined', () => {
    const moduleExports = autonomousJobRunners as Record<string, unknown>;
    expect(moduleExports.runTrainingTaiwanQ1FinancialIngestCheck).toBeUndefined();
  });
});
