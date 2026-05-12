#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const OUT = path.join(BASE, 'outputs', 'online_validation');

const REQUIRED_TOKEN = 'P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY';
const PROVIDED_TOKEN = 'P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY';

const results = [];
let passCount = 0;
let failCount = 0;
const now = new Date().toISOString();

function pass(id, msg) {
  results.push({ gateId: id, status: 'PASS', message: msg });
  passCount++;
}
function fail(id, msg) {
  results.push({ gateId: id, status: 'FAIL', message: msg });
  failCount++;
}
function checkFile(id, rel) {
  const full = path.join(BASE, rel);
  fs.existsSync(full) ? pass(id, `${rel} exists`) : fail(id, `${rel} missing`);
}
function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim().split('\n').length;
}

// A.1 Token check
PROVIDED_TOKEN === REQUIRED_TOKEN
  ? pass('A01', `token verified: ${REQUIRED_TOKEN}`)
  : fail('A01', `wrong token: ${PROVIDED_TOKEN}`);

// A.2 P22 artifacts
checkFile('A02', 'outputs/online_validation/p22production_migration_plan_final_report.md');
checkFile('A03', 'outputs/online_validation/p22production_migration_plan_preflight.json');
checkFile('A04', 'outputs/online_validation/p22production_backup_restore_plan.json');
checkFile('A05', 'outputs/online_validation/p22production_migration_runbook.json');
checkFile('A06', 'outputs/online_validation/p22production_monitoring_checklist.json');
checkFile('A07', 'outputs/online_validation/p22production_migration_plan_decision.json');

// A.3 P22 conclusion
try {
  const dec = JSON.parse(fs.readFileSync(path.join(OUT, 'p22production_migration_plan_decision.json'), 'utf8'));
  dec.classification === 'P22_PLAN_HARDENING_COMPLETE_READY_FOR_P23_REVIEW'
    ? pass('A08', 'P22 classification correct')
    : fail('A08', `P22 classification: ${dec.classification}`);
  dec.approvalGranted === false
    ? pass('A09', 'P22 approvalGranted=false')
    : fail('A09', `P22 approvalGranted=${dec.approvalGranted}`);
  dec.productionMigrationApplied === false
    ? pass('A10', 'P22 productionMigrationApplied=false')
    : fail('A10', `P22 productionMigrationApplied=${dec.productionMigrationApplied}`);
  dec.readyForP23Review === true
    ? pass('A11', 'P22 readyForP23Review=true')
    : fail('A11', `P22 readyForP23Review=${dec.readyForP23Review}`);
  const recToken = dec.recommendedNextToken || (dec.summary && dec.summary.recommendedNextToken);
  recToken === 'P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY'
    ? pass('A12', 'P22 recommendedNextToken correct')
    : fail('A12', `P22 recommendedNextToken: ${recToken}`);
} catch (e) { fail('A08', 'P22 decision parse error: ' + e.message); }

// A.3b Check all production commands are placeholders in runbook
try {
  const rb = JSON.parse(fs.readFileSync(path.join(OUT, 'p22production_migration_runbook.json'), 'utf8'));
  const steps = rb.steps || rb.runbookSteps || [];
  const placeholderSteps = steps.filter(s => {
    const cmd = (s.command || s.commandOrAction || '');
    return String(cmd).includes('[PLACEHOLDER') || String(cmd).toLowerCase().includes('placeholder') || s.isPlaceholder === true;
  });
  const nonPlaceholderProductionCmds = steps.filter(s => {
    const cmd = String(s.command || s.commandOrAction || '');
    return (cmd.includes('prisma migrate deploy') || cmd.includes('production apply')) &&
           !cmd.includes('[PLACEHOLDER') && !cmd.toLowerCase().includes('placeholder') && s.isPlaceholder !== true;
  });
  nonPlaceholderProductionCmds.length === 0
    ? pass('A13', 'all production commands remain placeholder in runbook')
    : fail('A13', `found ${nonPlaceholderProductionCmds.length} non-placeholder production commands`);
} catch (e) { fail('A13', 'runbook parse error: ' + e.message); }

// A.4 P17–P21 supporting artifacts
checkFile('A14', 'outputs/online_validation/p17monthly_revenue_schema_patch.json');
checkFile('A15', 'outputs/online_validation/p17monthly_revenue_query_gate_patch.json');
checkFile('A16', 'outputs/online_validation/p18monthly_revenue_fixture_db_migration.json');
checkFile('A17', 'outputs/online_validation/p18monthly_revenue_fixture_db_backfill.json');
checkFile('A18', 'outputs/online_validation/p18monthly_revenue_fixture_db_query_gate.json');
checkFile('A19', 'outputs/online_validation/p18monthly_revenue_fixture_db_rollback.json');
checkFile('A20', 'outputs/online_validation/p19monthly_revenue_pit_guard_validation.json');
checkFile('A21', 'outputs/online_validation/p20production_migration_readiness_decision.json');
checkFile('A22', 'outputs/online_validation/p21production_migration_approval_decision.json');

// A.5 Frozen corpus
const corpora = [
  ['outputs/online_validation/simulation_snapshot_corpus.jsonl', 60, 'A23'],
  ['outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl', 4500, 'A24'],
  ['outputs/online_validation/p1baseline_historical_replay_corpus.jsonl', 9900, 'A25'],
  ['outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl', 4500, 'A26'],
  ['outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl', 4500, 'A27'],
];
for (const [rel, expected, gateId] of corpora) {
  const full = path.join(BASE, rel);
  if (!fs.existsSync(full)) { fail(gateId, `${rel} missing`); continue; }
  const lines = lineCount(full);
  lines === expected
    ? pass(gateId, `${path.basename(rel)} = ${lines} lines (frozen)`)
    : fail(gateId, `${path.basename(rel)} = ${lines} lines (expected ${expected})`);
}

// Build output
const classification = failCount === 0
  ? 'P23_PREFLIGHT_PASS_IMPLEMENTATION_REVIEW_AUTHORIZED'
  : 'P23_PREFLIGHT_FAIL_IMPLEMENTATION_REVIEW_BLOCKED';

const preflight = {
  phase: 'P23',
  part: 'A',
  generatedAt: now,
  approvalToken: REQUIRED_TOKEN,
  approvalTokenVerified: results.find(r => r.gateId === 'A01')?.status === 'PASS',
  gatePassCount: passCount,
  gateFailCount: failCount,
  gateTotal: results.length,
  classification,
  gates: results,
  approvalGranted: false,
  productionMigrationApplied: false,
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'p23production_migration_implementation_preflight.json'), JSON.stringify(preflight, null, 2));

const md = [
  '# P23 Production Migration Implementation — Preflight Report',
  '',
  `**Generated**: ${now}`,
  `**Phase**: P23 / Part A`,
  `**Token**: \`${REQUIRED_TOKEN}\` — ${preflight.approvalTokenVerified ? '✅ VERIFIED' : '❌ MISSING'}`,
  `**Classification**: \`${classification}\``,
  '',
  `## Gate Results: ${passCount}/${results.length} PASS`,
  '',
  '| Gate | Status | Message |',
  '|------|--------|---------|',
  ...results.map(r => `| ${r.gateId} | ${r.status === 'PASS' ? '✅' : '❌'} | ${r.message} |`),
  '',
  '## Safety Invariants',
  '- `approvalGranted`: false',
  '- `productionMigrationApplied`: false',
  '- All production commands remain PLACEHOLDER',
].join('\n');

fs.writeFileSync(path.join(OUT, 'p23production_migration_implementation_preflight.md'), md);

console.log(`\nP23 Part A: ${passCount}/${results.length} PASS`);
results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  FAIL [${r.gateId}]: ${r.message}`));
results.filter(r => r.status === 'PASS').forEach(r => console.log(`  PASS [${r.gateId}]: ${r.message}`));
console.log(`Classification: ${classification}`);
if (failCount > 0) process.exit(1);
