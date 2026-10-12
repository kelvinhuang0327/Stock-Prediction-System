'use strict';
/**
 * P22-HARDRESET Part D
 * Build Production Migration Runbook
 *
 * Outputs: p22production_migration_runbook.json + .md
 *
 * INVARIANTS:
 * - All production commands are PLACEHOLDER requiring P23 approval
 * - productionMigrationApplied = false
 * - approvalGranted = false
 */

const fs = require('fs');
const path = require('path');
const NOW = new Date().toISOString();
const OUT = 'outputs/online_validation';

const REQUIRED_TOKEN_P23 = 'P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY';

// ─── Runbook Steps ────────────────────────────────────────────────────────────
const runbookSteps = [
  {
    stepId: 'R01',
    phase: 'pre-migration',
    label: 'Pre-migration system health check',
    description: 'Verify production system is healthy. Check DB connectivity, application health endpoints, and error rates.',
    isPlaceholder: false,
    requiresApproval: false,
    goNoGoCheckpoint: false,
  },
  {
    stepId: 'R02',
    phase: 'pre-migration',
    label: 'Create production backup',
    description: 'Execute backup per p22production_backup_restore_plan.json. SQLite: file copy with sha256 checksum.',
    isPlaceholder: true,
    requiresApproval: true,
    requiredApprovalToken: REQUIRED_TOKEN_P23,
    command: '[PLACEHOLDER — requires P23 approval: cp prisma/dev.db prisma/dev.db.p23_premigration_backup_<YYYYMMDD_HHMMSS>]',
    goNoGoCheckpoint: false,
  },
  {
    stepId: 'R03',
    phase: 'pre-migration',
    label: 'Verify backup checksum',
    description: 'Compute sha256 of backup file. Record checksum in operations log.',
    isPlaceholder: false,
    requiresApproval: false,
    command: '[PLACEHOLDER: shasum -a 256 prisma/dev.db.p23_premigration_backup_<timestamp>]',
    goNoGoCheckpoint: false,
  },
  {
    stepId: 'R04',
    phase: 'pre-migration',
    label: 'Go/No-Go checkpoint #1 — before maintenance window',
    description: 'CTO/CEO confirms: backup verified, system healthy, team ready, rollback plan accessible.',
    isPlaceholder: true,
    requiresApproval: true,
    requiredApprovalToken: REQUIRED_TOKEN_P23,
    goNoGoCheckpoint: true,
  },
  {
    stepId: 'R05',
    phase: 'pre-migration',
    label: 'Enable maintenance mode',
    description: 'Prevent writes during migration window.',
    isPlaceholder: true,
    requiresApproval: true,
    requiredApprovalToken: REQUIRED_TOKEN_P23,
    command: '[PLACEHOLDER — requires P23 approval: enable maintenance mode / health check returns 503]',
    goNoGoCheckpoint: false,
  },
  {
    stepId: 'R06',
    phase: 'migration',
    label: 'Apply production migration',
    description: 'Run prisma migrate deploy to apply releaseDate schema changes. Fixture DB dry-run completed in P18 (passCount verified).',
    isPlaceholder: true,
    requiresApproval: true,
    requiredApprovalToken: REQUIRED_TOKEN_P23,
    command: '[PLACEHOLDER — requires P23 approval: npx prisma migrate deploy]',
    goNoGoCheckpoint: false,
    onFailure: 'Immediately trigger rollback runbook (step R12)',
  },
  {
    stepId: 'R07',
    phase: 'migration',
    label: 'Backfill releaseDate values',
    description: 'Run backfill to populate releaseDate for existing MonthlyRevenue rows. Backfill logic validated in P18 fixture DB.',
    isPlaceholder: true,
    requiresApproval: true,
    requiredApprovalToken: REQUIRED_TOKEN_P23,
    command: '[PLACEHOLDER — requires P23 approval: node scripts/backfill-monthly-revenue-release-date.js]',
    goNoGoCheckpoint: false,
    onFailure: 'Immediately trigger rollback runbook (step R12)',
  },
  {
    stepId: 'R08',
    phase: 'migration',
    label: 'Go/No-Go checkpoint #2 — after migration and backfill',
    description: 'CTO/CEO confirms: migration applied without error, backfill completed, ready for validation.',
    isPlaceholder: true,
    requiresApproval: true,
    requiredApprovalToken: REQUIRED_TOKEN_P23,
    goNoGoCheckpoint: true,
  },
  {
    stepId: 'R09',
    phase: 'validation',
    label: 'Run query gate validation',
    description: 'Validate releaseDate <= asOfDate for all sampled rows. Must be 0 violations. Gate verified in P17 and P18.',
    isPlaceholder: false,
    requiresApproval: false,
    validationQuery: 'SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate > asOfDate — must be 0',
    goNoGoCheckpoint: false,
    onFailure: 'Immediately trigger rollback runbook (step R12)',
  },
  {
    stepId: 'R10',
    phase: 'validation',
    label: 'Run post-migration validation checklist',
    description: 'Execute all items in p22production_monitoring_checklist.json. All mandatory items must pass.',
    isPlaceholder: false,
    requiresApproval: false,
    goNoGoCheckpoint: false,
    onFailure: 'Trigger rollback runbook if any mandatory item fails',
  },
  {
    stepId: 'R11',
    phase: 'validation',
    label: 'Go/No-Go checkpoint #3 — before resuming production traffic',
    description: 'CTO/CEO reviews all validation results. Must confirm all mandatory items pass before traffic resumes.',
    isPlaceholder: true,
    requiresApproval: true,
    requiredApprovalToken: REQUIRED_TOKEN_P23,
    goNoGoCheckpoint: true,
  },
  {
    stepId: 'R12',
    phase: 'post-migration',
    label: 'Resume production traffic',
    description: 'Disable maintenance mode after successful validation.',
    isPlaceholder: true,
    requiresApproval: true,
    requiredApprovalToken: REQUIRED_TOKEN_P23,
    command: '[PLACEHOLDER — requires P23 approval: disable maintenance mode]',
    goNoGoCheckpoint: false,
  },
  {
    stepId: 'R13',
    phase: 'post-migration',
    label: 'Post-migration monitoring (T+0 to T+30min)',
    description: 'Monitor releaseDate null rate, query gate compliance, and application error rate for 30 minutes.',
    isPlaceholder: false,
    requiresApproval: false,
    goNoGoCheckpoint: false,
  },
  {
    stepId: 'R14',
    phase: 'rollback',
    label: 'Rollback (conditional — if any checkpoint fails)',
    description: 'Execute rollback per p22production_backup_restore_plan.json restoreMethod. Triggered only on failure.',
    isPlaceholder: true,
    requiresApproval: true,
    requiredApprovalToken: REQUIRED_TOKEN_P23,
    command: '[PLACEHOLDER — requires P23 approval: restore from backup]',
    goNoGoCheckpoint: false,
    condition: 'Only if one or more go/no-go checkpoints (R04, R08, R11) fail, or if validation (R09, R10) fail',
  },
];

const artifact = {
  phase: 'P22',
  part: 'D',
  generatedAt: NOW,
  description: 'Production migration runbook for MonthlyRevenue releaseDate schema change',
  targetTable: 'MonthlyRevenue',
  requiredApprovalTokenForP23: REQUIRED_TOKEN_P23,
  totalSteps: runbookSteps.length,
  placeholderSteps: runbookSteps.filter(s => s.isPlaceholder).length,
  goNoGoCheckpoints: runbookSteps.filter(s => s.goNoGoCheckpoint).length,
  runbookSteps,
  approvalGranted: false,
  productionMigrationApplied: false,
  nonGoals: [
    'P22 does NOT execute any runbook step in this phase',
    'All production commands are PLACEHOLDER requiring explicit P23 approval token',
    'P23 review does not auto-execute migration — requires separate execution approval',
  ],
};

fs.writeFileSync(path.join(OUT, 'p22production_migration_runbook.json'), JSON.stringify(artifact, null, 2));

// ─── Markdown ─────────────────────────────────────────────────────────────────
const phaseGroups = ['pre-migration', 'migration', 'validation', 'post-migration', 'rollback'];

const stepsByPhase = (phase) => runbookSteps.filter(s => s.phase === phase);

const md = `# P22-HARDRESET Part D — Production Migration Runbook

**Generated**: ${NOW}  
**Target Table**: MonthlyRevenue  
**Required P23 Token**: \`${REQUIRED_TOKEN_P23}\`

> ⚠️ **This runbook is a PLAN artifact only.**  
> All steps marked \`[PLACEHOLDER]\` require explicit P23 approval before execution.  
> No production commands are executed in P22.

## Summary

| | Count |
|-|-------|
| Total steps | ${runbookSteps.length} |
| Placeholder steps (requires P23 approval) | ${runbookSteps.filter(s => s.isPlaceholder).length} |
| Go/No-Go checkpoints | ${runbookSteps.filter(s => s.goNoGoCheckpoint).length} |

${phaseGroups.map(phase => {
  const steps = stepsByPhase(phase);
  if (!steps.length) return '';
  return `## Phase: ${phase.toUpperCase()}

${steps.map(s => `### ${s.stepId} — ${s.label}
- **Placeholder**: ${s.isPlaceholder ? 'YES — requires P23 approval' : 'No'}
- **Go/No-Go checkpoint**: ${s.goNoGoCheckpoint ? 'YES' : 'No'}
${s.command ? `- **Command**: \`${s.command}\`` : ''}
${s.validationQuery ? `- **Validation**: \`${s.validationQuery}\`` : ''}
${s.onFailure ? `- **On failure**: ${s.onFailure}` : ''}
${s.condition ? `- **Condition**: ${s.condition}` : ''}

${s.description}
`).join('\n')}`;
}).join('\n')}

## Safety Invariants

| Invariant | Value |
|-----------|-------|
| \`approvalGranted\` | false |
| \`productionMigrationApplied\` | false |
| All production commands | PLACEHOLDER — requires P23 approval |
`;

fs.writeFileSync(path.join(OUT, 'p22production_migration_runbook.md'), md);

console.log('P22 Part D: migration runbook written');
console.log('  p22production_migration_runbook.json');
console.log('  p22production_migration_runbook.md');
console.log('  totalSteps:', runbookSteps.length);
console.log('  placeholderSteps:', runbookSteps.filter(s => s.isPlaceholder).length);
console.log('  goNoGoCheckpoints:', runbookSteps.filter(s => s.goNoGoCheckpoint).length);
