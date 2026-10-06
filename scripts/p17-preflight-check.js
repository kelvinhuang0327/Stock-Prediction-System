'use strict';
const fs = require('fs');
const preflight = JSON.parse(fs.readFileSync('outputs/online_validation/p16monthly_revenue_dry_run_preflight.json','utf8'));
const mig  = JSON.parse(fs.readFileSync('outputs/online_validation/p16monthly_revenue_fixture_migration_dry_run.json','utf8'));
const back = JSON.parse(fs.readFileSync('outputs/online_validation/p16monthly_revenue_backfill_dry_run.json','utf8'));
const qg   = JSON.parse(fs.readFileSync('outputs/online_validation/p16monthly_revenue_query_gate_dry_run.json','utf8'));
console.log('preflight:', preflight.preflightStatus);
console.log('migration:', mig.validationStatus, 'allGatesPass:', mig.allGatesPass);
console.log('backfill:', back.validationStatus, 'productionDbWritten:', back.productionDbWritten);
console.log('queryGate:', qg.validationStatus, 'allScenariosPass:', qg.allScenariosPass);
const expected = {
  'outputs/online_validation/simulation_snapshot_corpus.jsonl': 60,
  'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl': 4500,
  'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl': 9900,
  'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl': 4500
};
for (const [p,c] of Object.entries(expected)) {
  const lines = fs.readFileSync(p,'utf8').trim().split('\n').length;
  if (lines !== c) throw new Error(p+' changed: '+lines);
  console.log('FROZEN', p.split('/').pop(), '=', lines);
}
console.log('ALL OK');
