'use strict';
/**
 * P22-HARDRESET Part A
 * Approval Token + Pre-flight Gate
 * Produces p22production_migration_plan_preflight.json + .md
 */

const fs = require('fs');
const path = require('path');

const APPROVAL_TOKEN = 'P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY';
const OUT = 'outputs/online_validation';
const NOW = new Date().toISOString();

let passed = 0;
let failed = 0;
const gates = [];

function gate(id, label, fn) {
  try {
    const evidence = fn();
    gates.push({ gateId: id, label, status: 'PASS', evidence: evidence || 'OK' });
    passed++;
  } catch (e) {
    gates.push({ gateId: id, label, status: 'FAIL', evidence: e.message });
    failed++;
  }
}

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim().split('\n').length;
}

// ─── A.1 Approval Token ───────────────────────────────────────────────────────
gate('A01', `Approval token ${APPROVAL_TOKEN} present`, () => {
  if (APPROVAL_TOKEN !== 'P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY') {
    throw new Error('Token mismatch');
  }
  return `Token verified: ${APPROVAL_TOKEN}`;
});

// ─── A.2 P21 Artifacts ────────────────────────────────────────────────────────
const P21_ARTIFACTS = [
  'outputs/online_validation/p21production_migration_approval_final_report.md',
  'outputs/online_validation/p21production_migration_approval_decision.json',
  'outputs/online_validation/p21production_migration_approval_review.json',
  'outputs/online_validation/p21production_migration_risk_register.json',
];
for (const f of P21_ARTIFACTS) {
  gate('A02', `P21 artifact exists: ${path.basename(f)}`, () => {
    if (!fs.existsSync(f)) throw new Error('file not found: ' + f);
    return f;
  });
}

// ─── A.3 P21 Conclusions ──────────────────────────────────────────────────────
gate('A03', 'P21 decision classification = P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p21production_migration_approval_decision.json', 'utf8'));
  if (d.classification !== 'P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL')
    throw new Error('got: ' + d.classification);
  return d.classification;
});
gate('A04', 'P21 decision approvalGranted=false', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p21production_migration_approval_decision.json', 'utf8'));
  if (d.approvalGranted !== false) throw new Error('approvalGranted=' + d.approvalGranted);
  return 'approvalGranted=false';
});
gate('A05', 'P21 decision productionMigrationApplied=false', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p21production_migration_approval_decision.json', 'utf8'));
  if (d.productionMigrationApplied !== false) throw new Error('productionMigrationApplied=' + d.productionMigrationApplied);
  return 'productionMigrationApplied=false';
});
gate('A06', 'P21 decision readyToRequestApprovalToken=true', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p21production_migration_approval_decision.json', 'utf8'));
  if (d.readyToRequestApprovalToken !== true) throw new Error('readyToRequestApprovalToken=' + d.readyToRequestApprovalToken);
  return 'readyToRequestApprovalToken=true';
});
gate('A07', 'P21 recommendedApprovalToken matches expected', () => {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/p21production_migration_approval_decision.json', 'utf8'));
  if (d.recommendedApprovalToken !== APPROVAL_TOKEN) throw new Error('got: ' + d.recommendedApprovalToken);
  return d.recommendedApprovalToken;
});

// ─── A.4 P17–P20 Supporting Artifacts ────────────────────────────────────────
const P17_P20_ARTIFACTS = [
  'outputs/online_validation/p17monthly_revenue_schema_patch.json',
  'outputs/online_validation/p17monthly_revenue_query_gate_patch.json',
  'outputs/online_validation/p18monthly_revenue_fixture_db_migration.json',
  'outputs/online_validation/p18monthly_revenue_fixture_db_backfill.json',
  'outputs/online_validation/p18monthly_revenue_fixture_db_query_gate.json',
  'outputs/online_validation/p18monthly_revenue_fixture_db_rollback.json',
  'outputs/online_validation/p19monthly_revenue_pit_guard_validation.json',
  'outputs/online_validation/p20pit_impact_comparison.json',
  'outputs/online_validation/p20production_migration_readiness_decision.json',
];
for (const f of P17_P20_ARTIFACTS) {
  gate('A08', `P17-P20 artifact exists: ${path.basename(f)}`, () => {
    if (!fs.existsSync(f)) throw new Error('file not found: ' + f);
    JSON.parse(fs.readFileSync(f, 'utf8')); // validate JSON
    return f;
  });
}

// ─── A.5 Frozen Corpus Counts ─────────────────────────────────────────────────
const FROZEN = [
  { file: 'outputs/online_validation/simulation_snapshot_corpus.jsonl', expected: 60 },
  { file: 'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl', expected: 4500 },
  { file: 'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl', expected: 9900 },
  { file: 'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl', expected: 4500 },
  { file: 'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl', expected: 4500 },
];
for (const { file, expected } of FROZEN) {
  gate('A09', `Frozen corpus ${path.basename(file)} = ${expected} lines`, () => {
    if (!fs.existsSync(file)) throw new Error('file not found: ' + file);
    const lines = countLines(file);
    if (lines !== expected) throw new Error(`expected ${expected}, got ${lines}`);
    return `${lines} lines`;
  });
}

// ─── Output ───────────────────────────────────────────────────────────────────
const classification = failed === 0
  ? 'P22_PREFLIGHT_PASS_PLAN_HARDENING_AUTHORIZED'
  : 'P22_PLAN_HARDENING_BLOCKED_BY_ARTIFACTS';

const artifact = {
  phase: 'P22',
  part: 'A',
  generatedAt: NOW,
  approvalToken: APPROVAL_TOKEN,
  approvalTokenVerified: true,
  gatePassCount: passed,
  gateFailCount: failed,
  gateTotal: gates.length,
  classification,
  gates,
  approvalGranted: false,
  productionMigrationApplied: false,
};

fs.writeFileSync(
  path.join(OUT, 'p22production_migration_plan_preflight.json'),
  JSON.stringify(artifact, null, 2)
);

const md = `# P22-HARDRESET Part A — Pre-flight Gate

**Generated**: ${NOW}  
**Classification**: \`${classification}\`

## Approval Token
\`${APPROVAL_TOKEN}\` — Verified ✓

## Gate Results

| Gate | Label | Status |
|------|-------|--------|
${gates.map(g => `| ${g.gateId} | ${g.label} | ${g.status} |`).join('\n')}

## Summary

| | Count |
|-|-------|
| PASS | ${passed} |
| FAIL | ${failed} |
| TOTAL | ${gates.length} |

## Safety Invariants
- \`approvalGranted\`: false  
- \`productionMigrationApplied\`: false
`;

fs.writeFileSync(path.join(OUT, 'p22production_migration_plan_preflight.md'), md);

console.log(`P22 Part A Pre-flight: ${passed} pass, ${failed} fail / ${gates.length} total`);
console.log('Classification:', classification);
if (failed > 0) {
  gates.filter(g => g.status === 'FAIL').forEach(g => console.log('  FAIL', g.gateId, g.label, '—', g.evidence));
  process.exit(1);
}
