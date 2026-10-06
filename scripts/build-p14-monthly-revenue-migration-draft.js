'use strict';
/**
 * P14-HARDRESET PART C: Build MonthlyRevenue Migration Draft Artifacts
 *
 * Reads P13 artifacts and produces:
 * - p14monthly_revenue_migration_draft.json
 * - p14monthly_revenue_migration_draft.md
 * - p14monthly_revenue_rollback_draft.md
 *
 * SAFETY: productionApplyAllowed = false on all outputs.
 * Does not modify production DB, schema, or corpora.
 *
 * Disclaimer: Does not constitute investment advice. No ROI/profit/alpha claims.
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
});
require('tsconfig-paths').register({
  baseUrl: require('path').resolve(__dirname, '..'),
  paths: { '@/*': ['src/*'] },
});

const fs = require('fs');
const path = require('path');
const {
  buildMonthlyRevenueMigrationDraft,
  buildMonthlyRevenueRollbackDraft,
  validateMigrationDraftSafety,
} = require('../src/lib/onlineValidation/P14MonthlyRevenueMigrationGateUtils');

const OUTPUTS_DIR = 'outputs/online_validation';

function run() {
  console.log('\n=== P14 PART C: Build Migration Draft ===\n');

  // Read P13 inputs
  const p13Plan = JSON.parse(fs.readFileSync('outputs/online_validation/p13monthly_revenue_migration_plan.json', 'utf8'));
  const p13Audit = JSON.parse(fs.readFileSync('outputs/online_validation/p13monthly_revenue_source_audit.json', 'utf8'));
  const p12Contract = JSON.parse(fs.readFileSync('outputs/online_validation/p12pit_feature_contract_v0.json', 'utf8'));

  console.log('Loaded P13 migration plan:', p13Plan.planId);
  console.log('Loaded P13 source audit mode:', p13Audit.dataAuditMode);
  console.log('Loaded P12 contract:', p12Contract.contractId || p12Contract.id || '(present)');

  // Build migration draft
  const draft = buildMonthlyRevenueMigrationDraft(p13Plan);
  console.log('\nMigration draft id:', draft.draftId);
  console.log('productionApplyAllowed:', draft.productionApplyAllowed);
  console.log('proposedSchemaChange fields:', draft.proposedSchemaChange.fieldsToAdd.map(f => f.name).join(', '));

  // Validate safety
  const safety = validateMigrationDraftSafety(draft);
  console.log('\nDraft safety status:', safety.status);
  if (safety.errors.length) console.log('ERRORS:', safety.errors);
  if (safety.warnings.length) console.log('Warnings:', safety.warnings);

  // Build rollback draft
  const rollback = buildMonthlyRevenueRollbackDraft(p13Plan);
  console.log('\nRollback draft id:', rollback.rollbackId);
  console.log('productionApplyAllowed:', rollback.productionApplyAllowed);

  if (!safety.safe) {
    console.error('\nMIGRATION DRAFT SAFETY CHECK FAILED — aborting.');
    process.exit(1);
  }

  // Augment draft with P13 context
  const fullDraft = {
    ...draft,
    p13Context: {
      planId: p13Plan.planId,
      dataAuditMode: p13Audit.dataAuditMode,
      overallPitRisk: p13Audit.currentPitRisk && p13Audit.currentPitRisk.overallRisk,
      p12ContractPresent: true,
    },
    safetyValidation: {
      status: safety.status,
      errors: safety.errors,
      warnings: safety.warnings,
    },
  };

  // Write JSON
  const jsonPath = path.join(OUTPUTS_DIR, 'p14monthly_revenue_migration_draft.json');
  fs.writeFileSync(jsonPath, JSON.stringify(fullDraft, null, 2), 'utf8');
  console.log('\nWrote:', jsonPath);

  // Write Migration Draft MD
  const md = `# P14-HARDRESET: MonthlyRevenue releaseDate Migration Draft

> **Disclaimer:** Dry-run draft only. Does not write production DB. Does not constitute investment advice.
> **productionApplyAllowed = false**

**Draft ID:** ${draft.draftId}
**Generated:** ${draft.generatedAt}
**Approval Token Required:** \`${draft.approvalTokenRequired}\`

---

## Production Safety Warning

> ⚠️ ${draft.productionSafetyWarning}

---

## Proposed Prisma Schema Change

\`\`\`prisma
${draft.proposedSchemaChange.prismaSnippet}
\`\`\`

---

## Proposed SQL Draft

\`\`\`sql
${draft.proposedSchemaChange.sqlSnippet}
\`\`\`

---

## Backfill Rule

| Field | Value |
|-------|-------|
| Description | ${draft.backfillRule.description} |
| Formula | ${draft.backfillRule.formula} |
| December Rollover | ${draft.backfillRule.decemberRollover} |
| Source Label | ${draft.backfillRule.sourceLabel} |

**Forbidden Inputs (must not be used to compute releaseDate):**
${draft.backfillRule.forbiddenInputs.map(f => `- \`${f}\``).join('\n')}

---

## Backfill SQL Draft

\`\`\`sql
${draft.backfillSqlDraft}
\`\`\`

---

## Fixture-Only Instructions

${draft.fixtureOnlyInstructions}

---

## Validation Requirements

${draft.validationRequirements.map(r => `- ${r}`).join('\n')}

---

## Non-Goals

${draft.nonGoals.map(g => `- ${g}`).join('\n')}

---

## Safety Validation

| Status | Errors | Warnings |
|--------|--------|---------|
| ${safety.status} | ${safety.errors.length} | ${safety.warnings.length} |
`;

  const mdPath = path.join(OUTPUTS_DIR, 'p14monthly_revenue_migration_draft.md');
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log('Wrote:', mdPath);

  // Write Rollback MD
  const rollbackMd = `# P14-HARDRESET: MonthlyRevenue Rollback Draft

> **Disclaimer:** Dry-run draft only. Does not write production DB. Does not constitute investment advice.
> **productionApplyAllowed = false**

**Rollback ID:** ${rollback.rollbackId}
**Generated:** ${rollback.generatedAt}

> ⚠️ ${rollback.safetyNote}

---

## Rollback Strategy A — Null Inferred Entries

**Description:** ${rollback.rollbackStrategyA.description}

\`\`\`sql
${rollback.rollbackStrategyA.sqlSnippet}
\`\`\`

---

## Rollback Strategy B — Drop Columns (Full Rollback)

**Description:** ${rollback.rollbackStrategyB.description}

\`\`\`sql
${rollback.rollbackStrategyB.sqlSnippet}
\`\`\`

---

## Selection Criteria

| Scenario | Recommended Strategy |
|----------|---------------------|
| Partial backfill, need to retry | Strategy A (null inferred, re-run backfill) |
| Complete rollback of migration | Strategy B (drop columns) |
| Authoritative entries exist | Strategy A (preserves authoritative entries) |
`;

  const rollbackMdPath = path.join(OUTPUTS_DIR, 'p14monthly_revenue_rollback_draft.md');
  fs.writeFileSync(rollbackMdPath, rollbackMd, 'utf8');
  console.log('Wrote:', rollbackMdPath);

  console.log('\n✓ PART C complete.');
}

run();
