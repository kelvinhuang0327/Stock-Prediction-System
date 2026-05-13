'use strict';
const fs = require('fs');

// Check P21 decision
const d = JSON.parse(fs.readFileSync('outputs/online_validation/p21production_migration_approval_decision.json','utf8'));
console.log('classification:', d.classification);
console.log('approvalGranted:', d.approvalGranted);
console.log('productionMigrationApplied:', d.productionMigrationApplied);
console.log('readyToRequestApprovalToken:', d.readyToRequestApprovalToken);
console.log('recommendedApprovalToken:', d.recommendedApprovalToken);

// Frozen corpus
const expected = {
  'outputs/online_validation/simulation_snapshot_corpus.jsonl': 60,
  'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl': 4500,
  'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl': 9900,
  'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl': 4500,
  'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl': 4500,
};
for (const [p, cnt] of Object.entries(expected)) {
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n').length;
  console.log(p.split('/').pop(), lines === cnt ? 'OK' : 'CHANGED: got ' + lines);
}
