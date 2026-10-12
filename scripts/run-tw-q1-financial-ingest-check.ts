/**
 * CLI smoke-test runner for training:tw-q1-financial-ingest-check
 *
 * Usage:
 *   npx tsx scripts/run-tw-q1-financial-ingest-check.ts
 *   npx tsx scripts/run-tw-q1-financial-ingest-check.ts --scheduled-for=2026-05-20T01:00:00Z
 *   npx tsx scripts/run-tw-q1-financial-ingest-check.ts --force
 */
import { runTrainingTaiwanQ1FinancialIngestCheck } from '../src/lib/jobs/autonomousJobRunners';
import { parseAutonomousCliOptions, printJsonResult } from './autonomous-cli-common';

async function main() {
  const options = parseAutonomousCliOptions();
  const result = await runTrainingTaiwanQ1FinancialIngestCheck({
    triggerSource: 'cli',
    force: options.force,
    scheduledFor: options.scheduledFor,
  });
  printJsonResult('training:tw-q1-financial-ingest-check', result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
