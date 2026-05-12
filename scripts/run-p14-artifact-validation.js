'use strict';
/**
 * P14-HARDRESET PART H: Artifact Validation
 */
const fs = require('fs');
const path = require('path');

const DIR = 'outputs/online_validation';
const checks = [];

function loadJson(name) {
  const p = path.join(DIR, name);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const preflight = loadJson('p14monthly_revenue_approval_preflight.json');
const draft = loadJson('p14monthly_revenue_migration_draft.json');
const proposal = loadJson('p14monthly_revenue_query_gate_proposal.json');
const dryRun = loadJson('p14monthly_revenue_fixture_dry_run.json');

// preflight checks
checks.push({ check: 'preflight.approvalStatus present', ok: typeof preflight.approvalStatus === 'string', val: preflight.approvalStatus });
checks.push({ check: 'preflight.approvalTokenPresent === false', ok: preflight.approvalTokenPresent === false, val: preflight.approvalTokenPresent });
checks.push({ check: 'preflight.preflightStatus === PASS', ok: preflight.preflightStatus === 'PASS', val: preflight.preflightStatus });
checks.push({ check: 'preflight.productionDbWritten === false', ok: preflight.productionDbWritten === false, val: preflight.productionDbWritten });
checks.push({ check: 'preflight.finalClassification correct', ok: preflight.finalClassification === 'P14_MONTHLY_REVENUE_AWAITING_SCHEMA_MIGRATION_APPROVAL', val: preflight.finalClassification });

// draft checks
checks.push({ check: 'draft.proposedSchemaChange present', ok: !!draft.proposedSchemaChange, val: !!draft.proposedSchemaChange });
checks.push({ check: 'draft.productionApplyAllowed === false', ok: draft.productionApplyAllowed === false, val: draft.productionApplyAllowed });
checks.push({ check: 'draft.safetyValidation.status SAFE_DRY_RUN_ONLY', ok: draft.safetyValidation && draft.safetyValidation.status === 'SAFE_DRY_RUN_ONLY', val: draft.safetyValidation && draft.safetyValidation.status });
const fieldNames = (draft.proposedSchemaChange && draft.proposedSchemaChange.fieldsToAdd || []).map(function(f) { return f.name; });
checks.push({ check: 'draft schema has releaseDate field', ok: fieldNames.indexOf('releaseDate') !== -1, val: fieldNames });

// proposal checks
checks.push({ check: 'proposal.queryGateRules present', ok: Array.isArray(proposal.queryGateRules), val: proposal.queryGateRules && proposal.queryGateRules.length });
checks.push({ check: 'proposal.productionApplyAllowed === false', ok: proposal.productionApplyAllowed === false, val: proposal.productionApplyAllowed });
checks.push({ check: 'proposal.proposals array >= 2', ok: Array.isArray(proposal.proposals) && proposal.proposals.length >= 2, val: proposal.proposals && proposal.proposals.length });

// dryRun checks
checks.push({ check: 'dryRun.validationStatus present', ok: typeof dryRun.validationStatus === 'string', val: dryRun.validationStatus });
checks.push({ check: 'dryRun.validationStatus PASS', ok: dryRun.validationStatus === 'PASS', val: dryRun.validationStatus });
checks.push({ check: 'dryRun.productionDbWritten === false', ok: dryRun.productionDbWritten === false, val: dryRun.productionDbWritten });
checks.push({ check: 'dryRun.passed >= 11', ok: dryRun.passed >= 11, val: dryRun.passed });

// Frozen corpus existence check
var FROZEN = [
  'src/lib/onlineValidation/LedgerOutcomeWindowTracker.ts',
  'src/lib/onlineValidation/AppendOnlyShadowLedgerGuard.ts',
  'src/lib/onlineValidation/P4CalibrationAuditUtils.ts',
  'src/lib/onlineValidation/P12PitFeatureContractUtils.ts',
];
FROZEN.forEach(function(f) {
  var exists = fs.existsSync(f);
  var lines = exists ? fs.readFileSync(f, 'utf8').split('\n').length : 0;
  checks.push({ check: 'frozen corpus >=60 lines: ' + path.basename(f), ok: exists && lines >= 60, val: lines + ' lines' });
});

var passed = checks.filter(function(c) { return c.ok; }).length;
var failed = checks.filter(function(c) { return !c.ok; }).length;
checks.forEach(function(c) {
  console.log((c.ok ? '✓' : '✗') + ' ' + c.check + ' → ' + JSON.stringify(c.val));
});
console.log('\nResults: ' + passed + '/' + checks.length + ' PASS, ' + failed + ' FAIL');
console.log('Status: ' + (failed === 0 ? 'PASS' : 'FAIL'));
if (failed > 0) process.exit(1);
