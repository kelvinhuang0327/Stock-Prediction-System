#!/usr/bin/env node
'use strict';
/**
 * build-p23-production-execution-approval-request.js
 *
 * P23 Part D — Build P24 Execution Approval Request.
 *
 * Produces:
 *  - outputs/online_validation/p23production_execution_approval_request.json
 *  - outputs/online_validation/p23production_execution_approval_request.md
 *
 * Hard rules:
 *  - does NOT grant approval
 *  - does NOT execute any production command
 *  - approvalGranted = false always
 *  - productionMigrationApplied = false always
 *  - requestedToken is a REQUEST ONLY — not a grant
 */

const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const OUT = path.join(BASE, 'outputs', 'online_validation');
const now = new Date().toISOString();

const SUGGESTED_P24_TOKEN = 'P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY';

const request = {
  phase: 'P23',
  part: 'D',
  generatedAt: now,
  requestedToken: SUGGESTED_P24_TOKEN,
  requestType: 'P24_EXECUTION_APPROVAL_REQUEST',
  scopeOfApprovalRequested: [
    'Execute production migration of MonthlyRevenue.releaseDate schema in P24 only',
    'Added fields: releaseDate, releaseDateSource, releaseDateConfidence',
    'Backup must run before migration — checksum must be verified before proceeding',
    'Migration must be reversible — rollback plan must be active throughout window',
    'Post-migration validation checklist (MON-01 to MON-13) must pass before resuming service',
    'Rollback trigger must remain armed during and after migration window',
    'releaseDate null rate must be checked at T+0, T+24h, T+7d',
    'Query gate smoke check must pass before go-live',
  ],
  explicitNonApprovalItems: [
    'No investment recommendation is authorized by this token',
    'No scoring formula changes are authorized',
    'No corpus regeneration or alteration (P0/P1/P3/P19/simulation_snapshot frozen)',
    'No automatic deployment without explicit human go-live sign-off',
    'No bypass of backup/restore verification steps',
    'No bypass of query gate smoke check',
    'No activation of auto-rollback trigger — rollback is manual only',
    'No alphaScore / recommendationBucket logic changes',
    'No ManualReview* module changes',
  ],
  requiredHumanConfirmation: [
    'Production DB target path / connection string verified by DBA',
    'Backup storage location confirmed writable and accessible',
    'Maintenance window scheduled, communicated to all stakeholders',
    'Rollback owner identified, reachable, and briefed',
    'Validation owner identified, reachable, and briefed on checklist MON-01 to MON-13',
  ],
  productionExecutionSteps: [
    {
      stepId: 'P24-01',
      description: 'Run production backup with checksum verification',
      command: '[PLACEHOLDER — requires P24_P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY token]',
      isPlaceholder: true,
    },
    {
      stepId: 'P24-02',
      description: 'Apply production Prisma migration: npx prisma migrate deploy',
      command: '[PLACEHOLDER — requires P24_P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY token]',
      isPlaceholder: true,
    },
    {
      stepId: 'P24-03',
      description: 'Backfill MonthlyRevenue.releaseDate from existing data',
      command: '[PLACEHOLDER — requires P24_P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY token]',
      isPlaceholder: true,
    },
    {
      stepId: 'P24-04',
      description: 'Run post-migration validation checklist (MON-01 to MON-13)',
      command: '[PLACEHOLDER — requires P24_P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY token]',
      isPlaceholder: true,
    },
    {
      stepId: 'P24-05',
      description: 'Go/no-go decision: resume service or trigger rollback',
      command: '[PLACEHOLDER — requires explicit human go-live sign-off]',
      isPlaceholder: true,
    },
  ],
  approvalAutoGranted: false,
  approvalGranted: false,
  productionMigrationApplied: false,
  note:
    'P23 only REQUESTS this token. It does NOT grant it. ' +
    'CTO/CEO must provide ' + SUGGESTED_P24_TOKEN + ' explicitly to authorize P24 execution. ' +
    'No production command will be executed without that explicit token.',
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.join(OUT, 'p23production_execution_approval_request.json'),
  JSON.stringify(request, null, 2)
);

const md = [
  '# P23 Production Execution Approval Request',
  '',
  `**Generated**: ${now}`,
  `**Phase**: P23 / Part D`,
  '',
  `## Requested Token`,
  '',
  `\`\`\``,
  SUGGESTED_P24_TOKEN,
  `\`\`\``,
  '',
  '> **P23 only requests this token. It does NOT grant it.**  ',
  '> CTO/CEO must provide this token explicitly to authorize P24 execution.',
  '',
  '## Scope of Approval Requested',
  ...request.scopeOfApprovalRequested.map((s, i) => `${i + 1}. ${s}`),
  '',
  '## Explicit Non-Approval Items (NOT authorized by this token)',
  ...request.explicitNonApprovalItems.map(s => `- ❌ ${s}`),
  '',
  '## Required Human Confirmation Before P24 Execution',
  ...request.requiredHumanConfirmation.map((s, i) => `${i + 1}. ${s}`),
  '',
  '## Production Execution Steps (all PLACEHOLDER)',
  '',
  '| Step | Description | Placeholder? |',
  '|------|-------------|--------------|',
  ...request.productionExecutionSteps.map(s =>
    `| ${s.stepId} | ${s.description} | ✅ YES |`
  ),
  '',
  '## Safety Invariants',
  '- `approvalAutoGranted`: false',
  '- `approvalGranted`: false',
  '- `productionMigrationApplied`: false',
  '- All execution steps are PLACEHOLDER pending P24 explicit token',
].join('\n');

fs.writeFileSync(
  path.join(OUT, 'p23production_execution_approval_request.md'),
  md
);

console.log('\n=== P23 Part D: P24 Execution Approval Request ===');
console.log(`requestedToken: ${SUGGESTED_P24_TOKEN}`);
console.log(`approvalGranted: false`);
console.log(`productionMigrationApplied: false`);
console.log('Artifacts written.');
