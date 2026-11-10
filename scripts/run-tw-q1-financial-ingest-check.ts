/**
 * CLI smoke-test runner for training:tw-q1-financial-ingest-check
 *
 * Usage:
 *   npx tsx scripts/run-tw-q1-financial-ingest-check.ts
 *   npx tsx scripts/run-tw-q1-financial-ingest-check.ts --scheduled-for=2026-05-20T01:00:00Z
 *   npx tsx scripts/run-tw-q1-financial-ingest-check.ts --force
 */
console.error(
  'The Q1 financial ingest job is registered for scheduling, but its runner has not been implemented yet.',
);
process.exitCode = 1;
