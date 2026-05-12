'use strict';
const fs = require('fs');
const pf = JSON.parse(fs.readFileSync('outputs/online_validation/p14monthly_revenue_approval_preflight.json','utf8'));
const draft = JSON.parse(fs.readFileSync('outputs/online_validation/p14monthly_revenue_migration_draft.json','utf8'));
const qg = JSON.parse(fs.readFileSync('outputs/online_validation/p14monthly_revenue_query_gate_proposal.json','utf8'));
const dr = JSON.parse(fs.readFileSync('outputs/online_validation/p14monthly_revenue_fixture_dry_run.json','utf8'));
const p13plan = JSON.parse(fs.readFileSync('outputs/online_validation/p13monthly_revenue_migration_plan.json','utf8'));
const p13audit = JSON.parse(fs.readFileSync('outputs/online_validation/p13monthly_revenue_source_audit.json','utf8'));
const p13pit = JSON.parse(fs.readFileSync('outputs/online_validation/p13monthly_revenue_pit_gate_validation.json','utf8'));

console.log('=== P14 Preflight ===');
console.log('approvalStatus:', pf.approvalStatus);
console.log('productionDbWritten:', pf.productionDbWritten);
console.log('preflightStatus:', pf.preflightStatus);
console.log('finalClassification:', pf.finalClassification);

console.log('\n=== Draft ===');
console.log('productionApplyAllowed:', draft.productionApplyAllowed);
console.log('safetyValidation.status:', draft.safetyValidation && draft.safetyValidation.status);
console.log('draftId:', draft.draftId);

console.log('\n=== Query Gate Proposal ===');
console.log('proposals count:', qg.proposals && qg.proposals.length);
console.log('queryGateRules count:', qg.queryGateRules && qg.queryGateRules.length);
console.log('productionApplyAllowed:', qg.productionApplyAllowed);
const proposalFiles = (qg.proposals || []).map(p => p.targetFile || p.filePath || p.file || p.component || JSON.stringify(p).substring(0,60));
console.log('proposal files:', proposalFiles);

console.log('\n=== Fixture Dry-Run ===');
console.log('validationStatus:', dr.validationStatus);
console.log('passed:', dr.passed, '/ total:', dr.total);
console.log('productionDbWritten:', dr.productionDbWritten);

console.log('\n=== P13 ===');
console.log('p13plan.planId:', p13plan.planId);
console.log('p13audit.overallRisk:', p13audit.currentPitRisk && p13audit.currentPitRisk.overallRisk);
console.log('p13pit.validationStatus:', p13pit.validationStatus);
console.log('p13pit.passed:', p13pit.passed, '/ total:', p13pit.total);

// Check rollback draft exists
const rollbackExists = fs.existsSync('outputs/online_validation/p14monthly_revenue_rollback_draft.md');
console.log('\nrollback draft exists:', rollbackExists);

// Frozen corpus check
const frozen = [
  ['outputs/online_validation/simulation_snapshot_corpus.jsonl', 60],
  ['outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl', 4500],
  ['outputs/online_validation/p1baseline_historical_replay_corpus.jsonl', 9900],
  ['outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl', 4500]
];
console.log('\n=== Frozen Corpus ===');
let allFrozen = true;
for (const [path, expected] of frozen) {
  const lines = fs.readFileSync(path,'utf8').trim().split('\n').length;
  const ok = lines === expected;
  if (!ok) allFrozen = false;
  console.log(path, lines, ok ? 'OK' : 'FAIL (expected ' + expected + ')');
}
console.log('All frozen:', allFrozen);
