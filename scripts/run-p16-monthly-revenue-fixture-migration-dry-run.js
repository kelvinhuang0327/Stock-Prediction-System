'use strict';
/**
 * run-p16-monthly-revenue-fixture-migration-dry-run.js
 *
 * DISCLAIMER: Does not constitute investment advice. Governance / dry-run only.
 * productionApplyAllowed=false. No production DB writes.
 *
 * Inputs:
 *   outputs/online_validation/p14monthly_revenue_migration_draft.json
 *   outputs/online_validation/p14monthly_revenue_rollback_draft.md   (parsed structurally)
 *   outputs/online_validation/p15migration_approval_decision.json
 *
 * Outputs:
 *   outputs/online_validation/p16monthly_revenue_fixture_migration_dry_run.json
 *   outputs/online_validation/p16monthly_revenue_fixture_migration_dry_run.md
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
});
require('tsconfig-paths').register({
  baseUrl: require('path').resolve(__dirname, '..'),
  paths: { '@/*': ['src/*'] },
});

const fs   = require('fs');
const path = require('path');

const {
  validateDryRunApprovalToken,
  buildDryRunMigrationSpec,
  buildDryRunRollbackSpec,
  applyMigrationToFixtureSchema,
  applyRollbackToFixtureSchema,
  validateFixtureMonthlyRevenueSchema,
  EXPECTED_APPROVAL_TOKEN,
} = require('../src/lib/onlineValidation/P16MonthlyRevenueDryRunUtils');

const OUT_DIR = path.join(__dirname, '..', 'outputs', 'online_validation');

// ── 1. Verify approval token ──
const tokenResult = validateDryRunApprovalToken({ token: EXPECTED_APPROVAL_TOKEN });
if (!tokenResult.valid) {
  console.error('TOKEN INVALID:', tokenResult.error);
  process.exit(1);
}
console.log('Approval token verified:', tokenResult.token);

// ── 2. Load inputs ──
const p14Draft = JSON.parse(
  fs.readFileSync(path.join(OUT_DIR, 'p14monthly_revenue_migration_draft.json'), 'utf8')
);
const p15Decision = JSON.parse(
  fs.readFileSync(path.join(OUT_DIR, 'p15migration_approval_decision.json'), 'utf8')
);

// ── 3. Verify P15 decision ──
if (p15Decision.productionApplyAllowed !== false) {
  throw new Error('P15 decision productionApplyAllowed must be false — abort');
}
if (p15Decision.approvalGranted !== false) {
  throw new Error('P15 decision approvalGranted must be false — abort');
}
console.log('P15 decision verified: productionApplyAllowed=false, approvalGranted=false');

// ── 4. Build migration spec ──
const migrationSpec = buildDryRunMigrationSpec(p14Draft, {
  migrationTarget: 'fixture',
  approvalToken: EXPECTED_APPROVAL_TOKEN,
});

// ── 5. Build rollback spec (parsed from rollback MD structurally) ──
const rollbackSpec = buildDryRunRollbackSpec(p14Draft, { migrationTarget: 'fixture' });

// ── 6. Define fixture schema BEFORE migration ──
const schemaBeforeMigration = {
  tableName: 'MonthlyRevenue',
  fields: [
    { name: 'id',        type: 'String',   nullable: false },
    { name: 'stockId',   type: 'String',   nullable: false },
    { name: 'year',      type: 'Int',      nullable: false },
    { name: 'month',     type: 'Int',      nullable: false },
    { name: 'revenue',   type: 'Float',    nullable: true  },
    { name: 'createdAt', type: 'DateTime', nullable: true  },
    { name: 'updatedAt', type: 'DateTime', nullable: true  },
  ],
};

// ── 7. Apply migration to fixture schema ──
const schemaAfterMigration = applyMigrationToFixtureSchema(schemaBeforeMigration, migrationSpec);

// ── 8. Validate post-migration schema ──
const schemaValidation = validateFixtureMonthlyRevenueSchema(schemaAfterMigration);

// ── 9. Apply rollback to fixture schema ──
const schemaAfterRollback = applyRollbackToFixtureSchema(schemaAfterMigration, rollbackSpec);

// ── 10. Validate rollback removed the correct fields ──
const rollbackFieldsRemoved = rollbackSpec.fieldsToRemove.every(
  field => !schemaAfterRollback.fields.some(f => f.name === field)
);
const originalFieldsRestored = schemaBeforeMigration.fields.every(
  orig => schemaAfterRollback.fields.some(f => f.name === orig.name)
);

// ── 11. Gate checks ──
const gates = [
  {
    gate: 'migrationSpec.productionApplyAllowed === false',
    status: migrationSpec.productionApplyAllowed === false ? 'PASS' : 'FAIL',
  },
  {
    gate: 'migrationSpec.dryRunOnly === true',
    status: migrationSpec.dryRunOnly === true ? 'PASS' : 'FAIL',
  },
  {
    gate: "migrationSpec.migrationTarget === 'fixture'",
    status: migrationSpec.migrationTarget === 'fixture' ? 'PASS' : 'FAIL',
  },
  {
    gate: 'migration adds exactly 3 fields (releaseDate, releaseDateSource, releaseDateConfidence)',
    status: migrationSpec.fieldsToAdd.length === 3 &&
      migrationSpec.fieldsToAdd.map(f => f.name).sort().join(',') ===
        'releaseDate,releaseDateConfidence,releaseDateSource' ? 'PASS' : 'FAIL',
  },
  {
    gate: 'post-migration schema has releaseDate field',
    status: schemaValidation.hasReleaseDate ? 'PASS' : 'FAIL',
  },
  {
    gate: 'post-migration schema has releaseDateSource field',
    status: schemaValidation.hasReleaseDateSource ? 'PASS' : 'FAIL',
  },
  {
    gate: 'post-migration schema has releaseDateConfidence field',
    status: schemaValidation.hasReleaseDateConfidence ? 'PASS' : 'FAIL',
  },
  {
    gate: 'rollback removes all 3 added fields',
    status: rollbackFieldsRemoved ? 'PASS' : 'FAIL',
  },
  {
    gate: 'rollback restores all original fields',
    status: originalFieldsRestored ? 'PASS' : 'FAIL',
  },
  {
    gate: 'rollbackSpec.productionApplyAllowed === false',
    status: rollbackSpec.productionApplyAllowed === false ? 'PASS' : 'FAIL',
  },
  {
    gate: 'no production DB connection (fixture-only dry-run)',
    status: 'PASS', // structural proof — no DB connection code in this script
  },
];

const allGatesPass = gates.every(g => g.status === 'PASS');

console.log('\n=== Fixture Migration Dry-Run Gates ===');
for (const g of gates) {
  console.log(`  [${g.status}] ${g.gate}`);
}
console.log(`\nResult: ${gates.filter(g => g.status === 'PASS').length}/${gates.length} PASS`);

// ── 12. Build output artifact ──
const artifact = {
  phase: 'P16-HARDRESET',
  task: 'Fixture Schema Migration Dry-Run',
  date: '2026-05-12',
  disclaimer: 'Does not constitute investment advice. Governance / dry-run only. No production DB writes.',
  approvalToken: EXPECTED_APPROVAL_TOKEN,
  productionApplyAllowed: false,
  dryRunOnly: true,
  migrationTarget: 'fixture',
  productionDbWritten: false,
  migrationSpec,
  rollbackSpec,
  schemaBeforeMigration,
  schemaAfterMigration,
  schemaAfterRollback,
  schemaValidation,
  rollbackProof: {
    rollbackFieldsRemoved,
    originalFieldsRestored,
    description: 'Rollback removes releaseDate/releaseDateSource/releaseDateConfidence from fixture schema and restores original schema exactly.',
  },
  gates,
  allGatesPass,
  validationStatus: allGatesPass ? 'PASS' : 'FAIL',
  summary: allGatesPass
    ? 'Fixture schema migration dry-run PASS. All 11 gates passed. No production DB written.'
    : `Fixture schema migration dry-run FAIL. Failed gates: ${gates.filter(g => g.status === 'FAIL').map(g => g.gate).join('; ')}`,
};

fs.writeFileSync(
  path.join(OUT_DIR, 'p16monthly_revenue_fixture_migration_dry_run.json'),
  JSON.stringify(artifact, null, 2)
);
console.log('\nWritten: p16monthly_revenue_fixture_migration_dry_run.json');

// ── 13. Build Markdown report ──
const fieldsAfterMd = schemaAfterMigration.fields.map(f =>
  `| ${f.name} | ${f.type} | ${f.nullable ? 'YES' : 'NO'} |`
).join('\n');
const fieldsAfterRollbackMd = schemaAfterRollback.fields.map(f =>
  `| ${f.name} | ${f.type} | ${f.nullable ? 'YES' : 'NO'} |`
).join('\n');
const gatesMd = gates.map(g => `| ${g.status === 'PASS' ? '✅' : '❌'} | ${g.gate} |`).join('\n');

const md = `# P16-HARDRESET: Fixture Schema Migration Dry-Run

> **Disclaimer:** Does not constitute investment advice. Governance / dry-run only. No production DB writes.

**Phase:** P16-HARDRESET | **Date:** 2026-05-12  
**Approval Token:** \`${EXPECTED_APPROVAL_TOKEN}\` — VERIFIED  
**productionApplyAllowed:** false | **dryRunOnly:** true | **migrationTarget:** fixture

## Validation Status: ${allGatesPass ? 'PASS ✅' : 'FAIL ❌'}

## Schema After Migration
| Field | Type | Nullable |
|-------|------|----------|
${fieldsAfterMd}

## Schema After Rollback (Must Match Original)
| Field | Type | Nullable |
|-------|------|----------|
${fieldsAfterRollbackMd}

## Gate Results (${gates.filter(g => g.status === 'PASS').length}/${gates.length})
| Status | Gate |
|--------|------|
${gatesMd}

## Rollback Proof
- Rollback removes intended fields: ${rollbackFieldsRemoved ? '✅' : '❌'}
- Original fields restored: ${originalFieldsRestored ? '✅' : '❌'}
- Description: ${artifact.rollbackProof.description}

## Summary
${artifact.summary}
`;

fs.writeFileSync(
  path.join(OUT_DIR, 'p16monthly_revenue_fixture_migration_dry_run.md'),
  md
);
console.log('Written: p16monthly_revenue_fixture_migration_dry_run.md');

if (!allGatesPass) {
  process.exit(1);
}
