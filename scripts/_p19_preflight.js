#!/usr/bin/env node
'use strict';
const fs = require('fs');

// A.1 P18 artifacts
const p18Files = [
  'outputs/online_validation/p18monthly_revenue_final_report.md',
  'outputs/online_validation/p18monthly_revenue_fixture_db_migration.json',
  'outputs/online_validation/p18monthly_revenue_fixture_db_backfill.json',
  'outputs/online_validation/p18monthly_revenue_fixture_db_query_gate.json',
  'outputs/online_validation/p18monthly_revenue_fixture_db_rollback.json',
  'outputs/online_validation/fixture_db/p18_monthly_revenue_fixture.sqlite',
];
// A.2 P17 artifacts
const p17Files = [
  'outputs/online_validation/p17monthly_revenue_final_report.md',
  'outputs/online_validation/p17monthly_revenue_query_gate_validation.json',
  'src/lib/onlineValidation/MonthlyRevenueAvailability.ts',
];

const missingFiles = [];
[...p18Files, ...p17Files].forEach(f => {
  if (!fs.existsSync(f)) missingFiles.push(f);
  else console.log('OK:', f);
});

// A.2 prisma schema
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const hasReleaseDate = schema.includes('releaseDate');
const hasReleaseDateSource = schema.includes('releaseDateSource');
const hasReleaseDateConfidence = schema.includes('releaseDateConfidence');
console.log('prisma releaseDate:', hasReleaseDate);
console.log('prisma releaseDateSource:', hasReleaseDateSource);
console.log('prisma releaseDateConfidence:', hasReleaseDateConfidence);

// A.3 P18 conclusions
const m18 = JSON.parse(fs.readFileSync('outputs/online_validation/p18monthly_revenue_fixture_db_migration.json', 'utf8'));
const b18 = JSON.parse(fs.readFileSync('outputs/online_validation/p18monthly_revenue_fixture_db_backfill.json', 'utf8'));
const q18 = JSON.parse(fs.readFileSync('outputs/online_validation/p18monthly_revenue_fixture_db_query_gate.json', 'utf8'));
const r18 = JSON.parse(fs.readFileSync('outputs/online_validation/p18monthly_revenue_fixture_db_rollback.json', 'utf8'));
console.log('migration:', m18.validationStatus, 'productionApplyAllowed:', m18.productionApplyAllowed, 'productionDbWritten:', m18.productionDbWritten);
console.log('backfill:', b18.validationStatus, 'productionDbWritten:', b18.productionDbWritten);
console.log('queryGate:', q18.validationStatus, 'productionDbWritten:', q18.productionDbWritten);
console.log('rollback:', r18.validationStatus, 'productionDbWritten:', r18.productionDbWritten);

// A.4 frozen corpus line counts
const frozenExpected = {
  'outputs/online_validation/simulation_snapshot_corpus.jsonl': 60,
  'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl': 4500,
  'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl': 9900,
  'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl': 4500,
};
const frozenErrors = [];
for (const [path, expected] of Object.entries(frozenExpected)) {
  const lines = fs.readFileSync(path, 'utf8').trim().split('\n').length;
  console.log(path.split('/').pop(), lines, lines === expected ? 'OK' : `MISMATCH (expected ${expected})`);
  if (lines !== expected) frozenErrors.push(path);
}

const allPass = missingFiles.length === 0 && hasReleaseDate && hasReleaseDateSource && hasReleaseDateConfidence &&
  m18.validationStatus === 'PASS' && b18.validationStatus === 'PASS' &&
  q18.validationStatus === 'PASS' && r18.validationStatus === 'PASS' &&
  m18.productionApplyAllowed === false && m18.productionDbWritten === false &&
  b18.productionDbWritten === false && q18.productionDbWritten === false &&
  r18.productionDbWritten === false && frozenErrors.length === 0;

const result = {
  timestamp: new Date().toISOString(),
  phase: 'P19-HARDRESET',
  part: 'A',
  preflightStatus: allPass ? 'PASS' : 'FAIL',
  p18ArtifactsPresent: missingFiles.length === 0,
  missingFiles,
  prismaSchemaContainsReleaseDate: hasReleaseDate,
  prismaSchemaContainsReleaseDateSource: hasReleaseDateSource,
  prismaSchemaContainsReleaseDateConfidence: hasReleaseDateConfidence,
  p18Conclusions: {
    migrationValidationStatus: m18.validationStatus,
    backfillValidationStatus: b18.validationStatus,
    queryGateValidationStatus: q18.validationStatus,
    rollbackValidationStatus: r18.validationStatus,
    productionApplyAllowed: false,
    productionDbWritten: false,
  },
  frozenCorpusLineCounts: Object.fromEntries(
    Object.entries(frozenExpected).map(([k, v]) => {
      const lines = fs.readFileSync(k, 'utf8').trim().split('\n').length;
      return [k.split('/').pop(), { expected: v, actual: lines, ok: lines === v }];
    })
  ),
  finalClassification: allPass ? 'P19_PREFLIGHT_PASS' : 'P19_PIT_REPLAY_BLOCKED_BY_ARTIFACTS',
};

fs.mkdirSync('outputs/online_validation', { recursive: true });
fs.writeFileSync('outputs/online_validation/p19active_scoring_pit_replay_preflight.json', JSON.stringify(result, null, 2));
console.log('\nPreflight status:', result.preflightStatus);
console.log('Written: outputs/online_validation/p19active_scoring_pit_replay_preflight.json');
