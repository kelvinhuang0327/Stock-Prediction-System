'use strict';
/**
 * P22-HARDRESET Part C
 * Build Production Backup / Restore Plan
 *
 * Reads: P21 risk register, P17 schema patch, P18 rollback validation, P20 impact comparison
 * Outputs: p22production_backup_restore_plan.json + .md
 *
 * INVARIANTS:
 * - No production DB write
 * - No migration apply
 * - All production commands are PLACEHOLDER
 */

const fs = require('fs');
const path = require('path');
const NOW = new Date().toISOString();
const OUT = 'outputs/online_validation';

// ─── Load inputs ──────────────────────────────────────────────────────────────
const riskRegister = JSON.parse(fs.readFileSync(path.join(OUT, 'p21production_migration_risk_register.json'), 'utf8'));
const schemaPatch = JSON.parse(fs.readFileSync(path.join(OUT, 'p17monthly_revenue_schema_patch.json'), 'utf8'));
const rollback = JSON.parse(fs.readFileSync(path.join(OUT, 'p18monthly_revenue_fixture_db_rollback.json'), 'utf8'));
const impact = JSON.parse(fs.readFileSync(path.join(OUT, 'p20pit_impact_comparison.json'), 'utf8'));

// Extract key inputs
const addedFields = (schemaPatch.addedFields || []).map(f => f.field || f);
const rollbackPassCount = rollback.passCount || 0;
const alignedRowCount = impact.alignedRowCount || impact.compareRowCount || 0;

// ─── Build backup plan ────────────────────────────────────────────────────────
const backupPlan = {
  scope: {
    tables: ['MonthlyRevenue', '_prisma_migrations'],
    schemaFile: 'prisma/schema.prisma',
    migrationHistoryTable: '_prisma_migrations',
    dbMetadata: 'prisma/dev.db — SQLite file metadata snapshot',
    addedFields,
    evidenceSources: {
      schemaPatch: 'p17monthly_revenue_schema_patch.json',
      rollbackValidation: `p18monthly_revenue_fixture_db_rollback.json (passCount=${rollbackPassCount})`,
      impactComparison: `p20pit_impact_comparison.json (alignedRowCount=${alignedRowCount})`,
    },
  },
  method: {
    strategy: 'file-copy-with-checksum',
    dbProvider: 'sqlite',
    command: '[PLACEHOLDER — requires P23 approval token: cp prisma/dev.db prisma/dev.db.p23_premigration_backup_<YYYYMMDD_HHMMSS>]',
    checksumVerification: true,
    fileHashAlgorithm: 'sha256',
    checksumCommand: '[PLACEHOLDER: shasum -a 256 prisma/dev.db > prisma/dev.db.p23_backup.sha256]',
    storageLocation: '[PLACEHOLDER — local backup path or secure offsite location per ops policy]',
  },
  restoreMethod: {
    steps: [
      '[PLACEHOLDER — requires P23 approval] Confirm rollback decision with CTO/CEO',
      '[PLACEHOLDER — requires P23 approval] Enable maintenance mode / stop application writes',
      '[PLACEHOLDER — requires P23 approval] Restore: cp prisma/dev.db.p23_premigration_backup_<timestamp> prisma/dev.db',
      'Verify backup checksum: shasum -a 256 prisma/dev.db — must match pre-migration checksum',
      'Verify table row count: SELECT COUNT(*) FROM MonthlyRevenue',
      'Verify schema state: PRAGMA table_info(MonthlyRevenue)',
      'Confirm releaseDate field state matches pre-migration baseline',
      'Run query gate sample: verify releaseDate <= asOfDate for sample rows',
      'Run RuleBasedStockAnalyzer smoke test',
      '[PLACEHOLDER — requires P23 approval] Resume production traffic',
    ],
    verifyRowCount: true,
    verifySchema: true,
    verifyReleaseDateField: true,
    verifyQueryGate: true,
    estimatedDurationMinutes: 30,
  },
};

// ─── Build restore plan ────────────────────────────────────────────────────────
const restorePlan = {
  steps: [
    '[PLACEHOLDER — requires P23 approval] Initiate maintenance window',
    '[PLACEHOLDER — requires P23 approval] Verify backup file accessibility and checksum',
    '[PLACEHOLDER — requires P23 approval] Restore DB from backup (see backupPlan.method.command)',
    '[PLACEHOLDER — requires P23 approval] Run: npx prisma db pull — introspect schema after restore',
    'Verify row count: SELECT COUNT(*) FROM MonthlyRevenue',
    'Verify schema: PRAGMA table_info(MonthlyRevenue) — confirm releaseDate, releaseDateSource, releaseDateConfidence',
    'Run query gate sample validation',
    'Run RuleBasedStockAnalyzer smoke test',
    'Confirm leakage check: SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate > asOfDate — must be 0',
    '[PLACEHOLDER — requires P23 approval] Resume production traffic',
  ],
  verificationSteps: [
    'SELECT COUNT(*) FROM MonthlyRevenue — must match pre-migration count',
    'PRAGMA table_info(MonthlyRevenue) — must include releaseDate fields',
    'SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NULL — log count',
    'Query gate sample: releaseDate <= asOfDate for 100 random rows',
    'Checksum match: sha256(restored DB) === sha256(backup file at creation time)',
  ],
  estimatedDurationMinutes: 30,
  requiresApproval: true,
};

// ─── Rollback trigger ─────────────────────────────────────────────────────────
const rollbackTrigger = {
  triggers: [
    'prisma migrate deploy failed with error',
    'Backfill script produced incorrect releaseDate values (null or future date violations)',
    'Query gate regression: releaseDate > asOfDate found in any row',
    'Post-migration row count mismatch vs pre-migration baseline',
    'Post-migration validation checklist has 1 or more FAIL items',
    'Application error rate increased > 5% within 30 minutes post-migration',
    'RuleBasedStockAnalyzer smoke test failed post-migration',
    'alphaScore or recommendationBucket changed vs P20 baseline',
  ],
  autoTrigger: false,
  requiresManualApproval: true,
  escalationContact: '[PLACEHOLDER — CTO/CEO or designated on-call]',
};

// ─── Non-goals ────────────────────────────────────────────────────────────────
const nonGoals = [
  'P22 does NOT apply production migration (plan hardening only)',
  'P22 does NOT execute prisma migrate deploy',
  'P22 does NOT write production DB',
  'P22 does NOT auto-trigger rollback',
  'P22 does NOT modify scoring formula or alphaScore computation',
  'P22 does NOT modify P0/P1/P3/P19 corpus files',
];

// ─── Output artifact ──────────────────────────────────────────────────────────
const artifact = {
  phase: 'P22',
  part: 'C',
  generatedAt: NOW,
  description: 'Production backup / restore plan for MonthlyRevenue releaseDate migration',
  targetTable: 'MonthlyRevenue',
  targetFields: addedFields,
  backupPlan,
  restorePlan,
  rollbackTrigger,
  nonGoals,
  evidenceSources: {
    riskRegisterPath: 'p21production_migration_risk_register.json',
    schemaPatchPath: 'p17monthly_revenue_schema_patch.json',
    rollbackValidationPath: `p18monthly_revenue_fixture_db_rollback.json`,
    impactComparisonPath: 'p20pit_impact_comparison.json',
  },
  approvalGranted: false,
  productionMigrationApplied: false,
};

fs.writeFileSync(path.join(OUT, 'p22production_backup_restore_plan.json'), JSON.stringify(artifact, null, 2));

// ─── Markdown report ──────────────────────────────────────────────────────────
const md = `# P22-HARDRESET Part C — Production Backup / Restore Plan

**Generated**: ${NOW}  
**Target Table**: MonthlyRevenue  
**Target Fields**: ${addedFields.join(', ')}

## Evidence Sources

| Source | Artifact | Key Result |
|--------|----------|------------|
| Schema patch | p17monthly_revenue_schema_patch.json | addedFields: ${addedFields.join(', ')} |
| Rollback validation | p18monthly_revenue_fixture_db_rollback.json | passCount=${rollbackPassCount} |
| Impact comparison | p20pit_impact_comparison.json | alignedRowCount=${alignedRowCount} |
| Risk register | p21production_migration_risk_register.json | RISK-02 (HIGH) — production DB migration irreversible without rollback plan |

## Backup Scope

| Item | Value |
|------|-------|
| Tables | MonthlyRevenue, _prisma_migrations |
| Schema file | prisma/schema.prisma |
| Migration history | _prisma_migrations |
| DB provider | SQLite |
| Strategy | file-copy-with-checksum |
| Hash algorithm | sha256 |

### Backup Command (PLACEHOLDER — requires P23 approval)
\`\`\`
[PLACEHOLDER] cp prisma/dev.db prisma/dev.db.p23_premigration_backup_<YYYYMMDD_HHMMSS>
[PLACEHOLDER] shasum -a 256 prisma/dev.db > prisma/dev.db.p23_backup.sha256
\`\`\`

## Restore Method

### Steps
${backupPlan.restoreMethod.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

### Verification Steps
${restorePlan.verificationSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

**Estimated duration**: ~30 minutes  
**Requires approval**: YES

## Rollback Triggers

${rollbackTrigger.triggers.map((t, i) => `${i + 1}. ${t}`).join('\n')}

- **Auto-trigger**: NO (manual approval required)
- **Escalation**: ${rollbackTrigger.escalationContact}

## Non-Goals (P22 Phase)

${nonGoals.map(g => `- ${g}`).join('\n')}

## Safety Invariants

| Invariant | Value |
|-----------|-------|
| \`approvalGranted\` | false |
| \`productionMigrationApplied\` | false |
| All production commands | PLACEHOLDER |
`;

fs.writeFileSync(path.join(OUT, 'p22production_backup_restore_plan.md'), md);

console.log('P22 Part C: backup/restore plan written');
console.log('  p22production_backup_restore_plan.json');
console.log('  p22production_backup_restore_plan.md');
console.log('  targetFields:', addedFields.join(', '));
console.log('  approvalGranted: false');
console.log('  productionMigrationApplied: false');
