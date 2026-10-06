/**
 * P22-HARDRESET Part B
 * Production Migration Plan Hardening Utilities
 *
 * Exports utilities for building production backup/restore plans,
 * migration execution runbooks, monitoring checklists, and go/no-go decisions.
 *
 * INVARIANTS:
 * - approvalGranted is always false
 * - productionMigrationApplied is always false
 * - All production commands are marked as placeholders requiring explicit approval
 * - P23 is the next phase for implementation review
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApprovalTokenResult {
  token: string;
  valid: boolean;
  reason: string;
}

export interface BackupScope {
  tables: string[];
  schemaFile: string;
  migrationHistoryTable: string;
  dbMetadata: string;
}

export interface BackupMethod {
  strategy: string;
  command: string; // placeholder
  checksumVerification: boolean;
  fileHashAlgorithm: string;
}

export interface RestoreMethod {
  steps: string[];
  verifyRowCount: boolean;
  verifySchema: boolean;
  verifyReleaseDateField: boolean;
}

export interface RollbackTrigger {
  triggers: string[];
  autoTrigger: boolean;
  requiresManualApproval: boolean;
}

export interface BackupPlan {
  scope: BackupScope;
  method: BackupMethod;
  restoreMethod: RestoreMethod;
  rollbackTrigger: RollbackTrigger;
  nonGoals: string[];
}

export interface RestorePlan {
  steps: string[];
  verificationSteps: string[];
  estimatedDurationMinutes: number;
  requiresApproval: boolean;
}

export interface RunbookStep {
  stepId: string;
  label: string;
  description: string;
  isPlaceholder: boolean;
  requiresApprovalToken?: string;
  command?: string;
}

export interface MigrationExecutionRunbook {
  runbookSteps: RunbookStep[];
  requiredApprovalTokenForP23: string;
  productionMigrationApplied: false;
  approvalGranted: false;
}

export interface RollbackRunbook {
  rollbackTriggers: string[];
  rollbackSteps: RunbookStep[];
  requiresManualApproval: boolean;
  productionMigrationApplied: false;
}

export interface ChecklistItem {
  itemId: string;
  label: string;
  category: string;
  mandatory: boolean;
  validationQuery?: string;
}

export interface PreMigrationChecklist {
  checklistItems: ChecklistItem[];
  productionMigrationApplied: false;
  approvalGranted: false;
}

export interface PostMigrationValidationChecklist {
  checklistItems: ChecklistItem[];
  includesReleaseDateCheck: true;
  includesQueryGateCheck: true;
  productionMigrationApplied: false;
}

export interface MonitoringChecklist {
  checklistItems: ChecklistItem[];
  includesQueryGateSmokeCheck: true;
  includesReleaseDateNullRateCheck: true;
  productionMigrationApplied: false;
}

export type PlanDecisionClassification =
  | 'PLAN_HARDENING_COMPLETE_READY_FOR_P23_REVIEW'
  | 'PLAN_REQUIRES_BACKUP_DETAIL'
  | 'PLAN_REQUIRES_RESTORE_DETAIL'
  | 'PLAN_REQUIRES_ROLLBACK_DETAIL'
  | 'PLAN_REQUIRES_MONITORING_DETAIL'
  | 'PLAN_REJECTED'
  | 'PLAN_BLOCKED';

export interface GoNoGoDecision {
  classification: PlanDecisionClassification;
  backupComplete: boolean;
  restoreComplete: boolean;
  rollbackComplete: boolean;
  monitoringComplete: boolean;
  validationComplete: boolean;
  readyForP23Review: boolean;
  approvalGranted: false;
  productionMigrationApplied: false;
  recommendedNextToken: string;
  reasons: string[];
}

export interface ForbiddenClaimScanResult {
  text: string;
  findings: Array<{ pattern: string; label: string; index: number }>;
  clean: boolean;
}

// ─── Forbidden Patterns ───────────────────────────────────────────────────────

const FORBIDDEN_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bROI\b/g, label: 'ROI' },
  { re: /win[- ]rate/gi, label: 'win-rate' },
  { re: /\boutperform\b/gi, label: 'outperform' },
  { re: /beat the market/gi, label: 'beat the market' },
  { re: /\bguaranteed?\b/gi, label: 'guaranteed' },
  { re: /\bprofit\b/gi, label: 'profit' },
  { re: /investment recommendation/gi, label: 'investment recommendation' },
];

const EXEMPT_LINE_SUBSTRINGS = [
  'disclaimer',
  'does not compute roi',
  'no roi',
  'no win-rate',
  'no outperform',
  'no guaranteed',
  'no profit',
  'roi|win-rate',
  'roi / win-rate',
  'roi, win-rate',
  'forbiddenpatterns',
  'forbidden_patterns',
  'forbidden claim',
  'alphascore',
  "label: 'roi'",
  'label: "roi"',
  '{ pattern:',
  'exempt_line_substrings',
];

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Evaluates whether the approval token for P22 plan hardening is valid.
 * The only accepted token is P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY.
 */
export function evaluatePlanApprovalToken(input: {
  token: string | null | undefined;
}): ApprovalTokenResult {
  const REQUIRED = 'P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY';
  if (!input.token) {
    return { token: '', valid: false, reason: 'No approval token provided — P22 plan hardening requires P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY from CTO/CEO' };
  }
  if (input.token !== REQUIRED) {
    return { token: input.token, valid: false, reason: `Invalid token "${input.token}" — expected ${REQUIRED}` };
  }
  return { token: input.token, valid: true, reason: 'Token accepted — P22 plan hardening authorized' };
}

/**
 * Builds the production backup plan artifact.
 * Must include MonthlyRevenue table, schema file, restore method,
 * rollback triggers, and non-goals.
 */
export function buildProductionBackupPlan(inputs: {
  targetTable?: string;
  dbProvider?: string;
}): { backupPlan: BackupPlan; approvalGranted: false; productionMigrationApplied: false } {
  const table = inputs.targetTable || 'MonthlyRevenue';
  const provider = inputs.dbProvider || 'sqlite';

  if (!table || table.trim() === '') {
    throw new Error('backupPlan requires targetTable (MonthlyRevenue)');
  }

  const backupPlan: BackupPlan = {
    scope: {
      tables: [table, '_prisma_migrations'],
      schemaFile: 'prisma/schema.prisma',
      migrationHistoryTable: '_prisma_migrations',
      dbMetadata: 'prisma/dev.db metadata snapshot',
    },
    method: {
      strategy: provider === 'sqlite' ? 'file-copy-with-checksum' : 'db-dump',
      command: provider === 'sqlite'
        ? '[PLACEHOLDER — requires P23 approval: cp prisma/dev.db prisma/dev.db.p22_backup_<timestamp>]'
        : '[PLACEHOLDER — requires P23 approval: pg_dump / mysqldump command]',
      checksumVerification: true,
      fileHashAlgorithm: 'sha256',
    },
    restoreMethod: {
      steps: [
        '[PLACEHOLDER — requires P23 approval] Stop application / put into maintenance mode',
        '[PLACEHOLDER — requires P23 approval] Restore database from backup file',
        'Verify table row count: SELECT COUNT(*) FROM MonthlyRevenue',
        'Verify MonthlyRevenue schema includes releaseDate, releaseDateSource, releaseDateConfidence',
        'Run query gate sample: SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate <= asOfDate',
        'Confirm restore checksum matches backup checksum',
        '[PLACEHOLDER — requires P23 approval] Resume application traffic',
      ],
      verifyRowCount: true,
      verifySchema: true,
      verifyReleaseDateField: true,
    },
    rollbackTrigger: {
      triggers: [
        'Migration apply step failed',
        'Backfill step produced incorrect releaseDate values',
        'Query gate regression detected (releaseDate <= asOfDate violated)',
        'Post-migration row count mismatch',
        'Post-migration validation checklist failure',
        'Monitoring alert triggered within 30 minutes of migration',
      ],
      autoTrigger: false,
      requiresManualApproval: true,
    },
    nonGoals: [
      'No production DB write in P22 (plan hardening only)',
      'No prisma migrate deploy in P22',
      'No automatic rollback trigger (manual approval required)',
      'No modification of scoring formula or alphaScore computation',
    ],
  };

  return { backupPlan, approvalGranted: false, productionMigrationApplied: false };
}

/**
 * Builds the production restore plan artifact.
 * Must include verification steps.
 */
export function buildProductionRestorePlan(inputs: {
  dbProvider?: string;
}): { restorePlan: RestorePlan; approvalGranted: false; productionMigrationApplied: false } {
  const steps = [
    '[PLACEHOLDER — requires P23 approval] Initiate maintenance window',
    '[PLACEHOLDER — requires P23 approval] Verify backup file checksum (sha256)',
    '[PLACEHOLDER — requires P23 approval] Restore DB from backup file',
    '[PLACEHOLDER — requires P23 approval] Run Prisma introspection to confirm schema state',
    'Verify MonthlyRevenue row count matches pre-migration baseline',
    'Verify releaseDate, releaseDateSource, releaseDateConfidence columns present',
    'Run query gate sample validation',
    'Run RuleBasedStockAnalyzer smoke test',
    'Confirm no leakage: releaseDate > asOfDate count = 0',
    '[PLACEHOLDER — requires P23 approval] Resume production traffic',
  ];

  const verificationSteps = [
    'SELECT COUNT(*) FROM MonthlyRevenue — must match pre-migration count',
    'PRAGMA table_info(MonthlyRevenue) — must include releaseDate fields',
    'SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NULL — acceptable threshold check',
    'Query gate: releaseDate <= asOfDate for sample rows',
  ];

  if (!steps.length || !verificationSteps.length) {
    throw new Error('restorePlan requires non-empty steps and verificationSteps');
  }

  return {
    restorePlan: {
      steps,
      verificationSteps,
      estimatedDurationMinutes: 30,
      requiresApproval: true,
    },
    approvalGranted: false,
    productionMigrationApplied: false,
  };
}

/**
 * Builds the migration execution runbook.
 * All production commands are marked as placeholders requiring explicit approval.
 */
export function buildMigrationExecutionRunbook(inputs: {
  targetTable?: string;
}): MigrationExecutionRunbook {
  const REQUIRED_TOKEN_P23 = 'P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY';

  const runbookSteps: RunbookStep[] = [
    {
      stepId: 'R01',
      label: 'Pre-migration system health check',
      description: 'Verify production system is healthy before migration begins. Check DB connectivity, application health endpoints.',
      isPlaceholder: false,
    },
    {
      stepId: 'R02',
      label: 'Create production backup',
      description: 'Execute backup plan per p22production_backup_restore_plan.json.',
      isPlaceholder: true,
      requiresApprovalToken: REQUIRED_TOKEN_P23,
      command: '[PLACEHOLDER — requires P23 approval: cp prisma/dev.db prisma/dev.db.p23_premigration_backup_<timestamp>]',
    },
    {
      stepId: 'R03',
      label: 'Verify backup checksum',
      description: 'Compute sha256 checksum of backup file and record it.',
      isPlaceholder: false,
    },
    {
      stepId: 'R04',
      label: 'Enable maintenance mode',
      description: 'Put application into maintenance mode to prevent writes during migration.',
      isPlaceholder: true,
      requiresApprovalToken: REQUIRED_TOKEN_P23,
      command: '[PLACEHOLDER — requires P23 approval: enable maintenance mode]',
    },
    {
      stepId: 'R05',
      label: 'Apply production migration',
      description: 'Run prisma migrate deploy to apply releaseDate schema changes. Fixture DB dry-run was completed in P18.',
      isPlaceholder: true,
      requiresApprovalToken: REQUIRED_TOKEN_P23,
      command: '[PLACEHOLDER — requires P23 approval: npx prisma migrate deploy]',
    },
    {
      stepId: 'R06',
      label: 'Backfill releaseDate values',
      description: 'Run backfill script to populate releaseDate for existing MonthlyRevenue rows. Logic validated in P18.',
      isPlaceholder: true,
      requiresApprovalToken: REQUIRED_TOKEN_P23,
      command: '[PLACEHOLDER — requires P23 approval: node scripts/backfill-monthly-revenue-release-date.js]',
    },
    {
      stepId: 'R07',
      label: 'Run query gate validation',
      description: 'Validate: releaseDate <= asOfDate for all sample rows. Gate verified in P17 and P18.',
      isPlaceholder: false,
    },
    {
      stepId: 'R08',
      label: 'Run post-migration validation checklist',
      description: 'Execute all items in p22production_monitoring_checklist.json.',
      isPlaceholder: false,
    },
    {
      stepId: 'R09',
      label: 'Go/no-go checkpoint',
      description: 'CTO/CEO decision gate before resuming production traffic. Must confirm all validation steps passed.',
      isPlaceholder: true,
      requiresApprovalToken: REQUIRED_TOKEN_P23,
    },
    {
      stepId: 'R10',
      label: 'Resume production traffic',
      description: 'Disable maintenance mode and restore production traffic.',
      isPlaceholder: true,
      requiresApprovalToken: REQUIRED_TOKEN_P23,
      command: '[PLACEHOLDER — requires P23 approval: disable maintenance mode]',
    },
    {
      stepId: 'R11',
      label: 'Post-migration monitoring',
      description: 'Monitor releaseDate null rate and query gate compliance for 30 minutes post-migration.',
      isPlaceholder: false,
    },
    {
      stepId: 'R12',
      label: 'Rollback (if needed)',
      description: 'If any go/no-go checkpoint fails, execute rollback plan per p22production_backup_restore_plan.json.',
      isPlaceholder: true,
      requiresApprovalToken: REQUIRED_TOKEN_P23,
      command: '[PLACEHOLDER — requires P23 approval: rollback restore procedure]',
    },
  ];

  return {
    runbookSteps,
    requiredApprovalTokenForP23: REQUIRED_TOKEN_P23,
    productionMigrationApplied: false,
    approvalGranted: false,
  };
}

/**
 * Builds the rollback runbook.
 * Must include rollback triggers.
 */
export function buildRollbackRunbook(inputs: {
  targetTable?: string;
}): RollbackRunbook {
  const rollbackTriggers = [
    'Migration apply step (R05) failed or produced errors',
    'Backfill step (R06) produced incorrect releaseDate values',
    'Query gate validation (R07) found releaseDate > asOfDate violations',
    'Post-migration validation checklist has 1 or more failures',
    'Row count mismatch after migration',
    'Application error rate increased > 5% within 30 minutes post-migration',
    'releaseDate null rate exceeds acceptable threshold',
  ];

  if (!rollbackTriggers.length) {
    throw new Error('rollbackRunbook requires at least one rollbackTrigger');
  }

  const rollbackSteps: RunbookStep[] = [
    {
      stepId: 'RB01',
      label: 'Activate rollback decision',
      description: 'CTO/CEO confirms rollback decision. Document the trigger reason.',
      isPlaceholder: true,
      requiresApprovalToken: 'P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY',
    },
    {
      stepId: 'RB02',
      label: 'Enable maintenance mode',
      description: 'Prevent writes during rollback.',
      isPlaceholder: true,
      command: '[PLACEHOLDER — requires approval: enable maintenance mode]',
    },
    {
      stepId: 'RB03',
      label: 'Restore database from backup',
      description: 'Execute restore per p22production_backup_restore_plan.json restoreMethod.',
      isPlaceholder: true,
      command: '[PLACEHOLDER — requires approval: restore from backup file]',
    },
    {
      stepId: 'RB04',
      label: 'Verify restore integrity',
      description: 'Verify row count and schema match pre-migration baseline.',
      isPlaceholder: false,
    },
    {
      stepId: 'RB05',
      label: 'Run query gate on restored state',
      description: 'Confirm releaseDate <= asOfDate for sample rows after restore.',
      isPlaceholder: false,
    },
    {
      stepId: 'RB06',
      label: 'Resume production traffic',
      description: 'Disable maintenance mode after rollback verified.',
      isPlaceholder: true,
      command: '[PLACEHOLDER — requires approval: disable maintenance mode]',
    },
    {
      stepId: 'RB07',
      label: 'Post-rollback monitoring',
      description: 'Monitor system for 30 minutes post-rollback.',
      isPlaceholder: false,
    },
    {
      stepId: 'RB08',
      label: 'Post-mortem documentation',
      description: 'Document rollback trigger, timeline, and findings for P23 replanning.',
      isPlaceholder: false,
    },
  ];

  return {
    rollbackTriggers,
    rollbackSteps,
    requiresManualApproval: true,
    productionMigrationApplied: false,
  };
}

/**
 * Builds the pre-migration checklist.
 */
export function buildPreMigrationChecklist(inputs: {
  targetTable?: string;
}): PreMigrationChecklist {
  const checklistItems: ChecklistItem[] = [
    { itemId: 'PRE-01', label: 'P22 approval token verified: P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY', category: 'governance', mandatory: true },
    { itemId: 'PRE-02', label: 'P22 plan hardening artifacts all present and validated', category: 'governance', mandatory: true },
    { itemId: 'PRE-03', label: 'Production backup created and checksum verified', category: 'backup', mandatory: true },
    { itemId: 'PRE-04', label: 'Maintenance window scheduled and confirmed with stakeholders', category: 'operations', mandatory: true },
    { itemId: 'PRE-05', label: 'Rollback plan reviewed and runbook accessible', category: 'rollback', mandatory: true },
    { itemId: 'PRE-06', label: 'P18 fixture DB migration results reviewed', category: 'evidence', mandatory: true },
    { itemId: 'PRE-07', label: 'P19 PIT guard validation results reviewed (leakageViolations=0)', category: 'evidence', mandatory: true },
    { itemId: 'PRE-08', label: 'P20 impact comparison reviewed (0 scoring changes, 0 bucket changes)', category: 'evidence', mandatory: true },
    { itemId: 'PRE-09', label: 'Monitoring checklist accessible and ready', category: 'monitoring', mandatory: true },
    { itemId: 'PRE-10', label: 'CTO/CEO present for go/no-go checkpoint', category: 'governance', mandatory: true },
    { itemId: 'PRE-11', label: 'Application health endpoints confirmed green', category: 'operations', mandatory: true },
    { itemId: 'PRE-12', label: 'Database connectivity verified', category: 'operations', mandatory: true },
  ];

  return { checklistItems, productionMigrationApplied: false, approvalGranted: false };
}

/**
 * Builds the post-migration validation checklist.
 * Must include releaseDate and query gate checks.
 */
export function buildPostMigrationValidationChecklist(inputs: {
  targetTable?: string;
}): PostMigrationValidationChecklist {
  const checklistItems: ChecklistItem[] = [
    { itemId: 'POST-01', label: 'MonthlyRevenue row count matches pre-migration baseline', category: 'data-integrity', mandatory: true, validationQuery: 'SELECT COUNT(*) FROM MonthlyRevenue' },
    { itemId: 'POST-02', label: 'releaseDate column exists in MonthlyRevenue', category: 'schema', mandatory: true, validationQuery: 'PRAGMA table_info(MonthlyRevenue)' },
    { itemId: 'POST-03', label: 'releaseDateSource column exists in MonthlyRevenue', category: 'schema', mandatory: true, validationQuery: 'PRAGMA table_info(MonthlyRevenue)' },
    { itemId: 'POST-04', label: 'releaseDateConfidence column exists in MonthlyRevenue', category: 'schema', mandatory: true, validationQuery: 'PRAGMA table_info(MonthlyRevenue)' },
    { itemId: 'POST-05', label: 'Records with missing releaseDate counted (null rate acceptable)', category: 'data-quality', mandatory: true, validationQuery: 'SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NULL' },
    { itemId: 'POST-06', label: 'INFERRED_NEXT_MONTH_10TH releaseDate rows counted', category: 'data-quality', mandatory: true, validationQuery: "SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDateSource = 'INFERRED_NEXT_MONTH_10TH'" },
    { itemId: 'POST-07', label: 'EXPLICIT releaseDate rows counted', category: 'data-quality', mandatory: false, validationQuery: "SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDateSource = 'EXPLICIT'" },
    { itemId: 'POST-08', label: 'No releaseDate > asOfDate leakage (query gate)', category: 'pit-guard', mandatory: true, validationQuery: 'SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate > asOfDate — must be 0' },
    { itemId: 'POST-09', label: 'RuleBasedStockAnalyzer smoke test passes', category: 'smoke', mandatory: true },
    { itemId: 'POST-10', label: 'FundamentalResearchService smoke test passes', category: 'smoke', mandatory: true },
    { itemId: 'POST-11', label: 'ActiveScoringSnapshot smoke test passes', category: 'smoke', mandatory: true },
    { itemId: 'POST-12', label: 'alphaScore values unchanged vs P20 comparison baseline', category: 'scoring', mandatory: true },
    { itemId: 'POST-13', label: 'recommendationBucket unchanged vs P20 comparison baseline', category: 'scoring', mandatory: true },
  ];

  return {
    checklistItems,
    includesReleaseDateCheck: true,
    includesQueryGateCheck: true,
    productionMigrationApplied: false,
  };
}

/**
 * Builds the monitoring checklist.
 * Must include query gate smoke check and releaseDate null rate check.
 */
export function buildMonitoringChecklist(inputs: {
  targetTable?: string;
}): MonitoringChecklist {
  const checklistItems: ChecklistItem[] = [
    { itemId: 'MON-01', label: 'MonthlyRevenue releaseDate field exists post-migration', category: 'schema', mandatory: true },
    { itemId: 'MON-02', label: 'releaseDateSource field exists post-migration', category: 'schema', mandatory: true },
    { itemId: 'MON-03', label: 'releaseDateConfidence field exists post-migration', category: 'schema', mandatory: true },
    { itemId: 'MON-04', label: 'Records with missing releaseDate count tracked (T+0, T+24h, T+7d)', category: 'data-quality', mandatory: true, validationQuery: 'SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NULL' },
    { itemId: 'MON-05', label: 'INFERRED_NEXT_MONTH_10TH rows count tracked', category: 'data-quality', mandatory: true },
    { itemId: 'MON-06', label: 'EXPLICIT/authoritative releaseDate rows count tracked', category: 'data-quality', mandatory: false },
    { itemId: 'MON-07', label: 'Invalid releaseDate rows (future dates, null where mandatory) tracked', category: 'data-quality', mandatory: true },
    { itemId: 'MON-08', label: 'Query gate smoke: releaseDate <= asOfDate sample validation', category: 'pit-guard', mandatory: true, validationQuery: 'Sample 100 rows: SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate <= asOfDate ORDER BY RANDOM() LIMIT 100' },
    { itemId: 'MON-09', label: 'RuleBasedStockAnalyzer smoke validation (no error)', category: 'smoke', mandatory: true },
    { itemId: 'MON-10', label: 'FundamentalResearchService smoke validation (no error)', category: 'smoke', mandatory: true },
    { itemId: 'MON-11', label: 'ActiveScoringSnapshot smoke validation (no error)', category: 'smoke', mandatory: true },
    { itemId: 'MON-12', label: 'Rollback readiness validation — backup file still accessible', category: 'rollback', mandatory: true },
    { itemId: 'MON-13', label: 'Post-migration no-leakage check — 0 rows with releaseDate > asOfDate', category: 'pit-guard', mandatory: true, validationQuery: 'SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate > asOfDate — must be 0' },
  ];

  return {
    checklistItems,
    includesQueryGateSmokeCheck: true,
    includesReleaseDateNullRateCheck: true,
    productionMigrationApplied: false,
  };
}

/**
 * Builds the go/no-go decision artifact.
 * Does not auto-approve. Does not apply production migration.
 */
export function buildGoNoGoDecision(inputs: {
  backupComplete: boolean;
  restoreComplete: boolean;
  rollbackComplete: boolean;
  monitoringComplete: boolean;
  validationComplete: boolean;
  safetyValid?: boolean;
}): GoNoGoDecision {
  const {
    backupComplete,
    restoreComplete,
    rollbackComplete,
    monitoringComplete,
    validationComplete,
    safetyValid = true,
  } = inputs;

  const reasons: string[] = [];
  let classification: PlanDecisionClassification;

  if (!safetyValid) {
    classification = 'PLAN_REJECTED';
    reasons.push('Safety validation failed — plan rejected');
  } else if (!backupComplete) {
    classification = 'PLAN_REQUIRES_BACKUP_DETAIL';
    reasons.push('Backup plan incomplete — requires additional detail before P23 review');
  } else if (!restoreComplete) {
    classification = 'PLAN_REQUIRES_RESTORE_DETAIL';
    reasons.push('Restore plan incomplete — requires verification steps before P23 review');
  } else if (!rollbackComplete) {
    classification = 'PLAN_REQUIRES_ROLLBACK_DETAIL';
    reasons.push('Rollback runbook incomplete — requires rollback triggers before P23 review');
  } else if (!monitoringComplete) {
    classification = 'PLAN_REQUIRES_MONITORING_DETAIL';
    reasons.push('Monitoring checklist incomplete — requires additional checklist items before P23 review');
  } else if (!validationComplete) {
    classification = 'PLAN_REQUIRES_MONITORING_DETAIL';
    reasons.push('Post-migration validation checklist incomplete');
  } else {
    classification = 'PLAN_HARDENING_COMPLETE_READY_FOR_P23_REVIEW';
    reasons.push('All plan components complete — ready to request P23 production migration implementation review');
    reasons.push('P23 requires explicit token: P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY');
    reasons.push('P23 does not auto-execute production migration — requires separate execution approval');
  }

  const readyForP23Review = classification === 'PLAN_HARDENING_COMPLETE_READY_FOR_P23_REVIEW';

  return {
    classification,
    backupComplete,
    restoreComplete,
    rollbackComplete,
    monitoringComplete,
    validationComplete,
    readyForP23Review,
    approvalGranted: false,
    productionMigrationApplied: false,
    recommendedNextToken: 'P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY',
    reasons,
  };
}

/**
 * Scans text for forbidden claims.
 * Exempt: lines containing disclaimer context, scanner definitions,
 * alphaScore field name references.
 */
export function scanForbiddenClaims(text: string): ForbiddenClaimScanResult {
  const lines = text.split('\n');
  const findings: Array<{ pattern: string; label: string; index: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    const isExempt = EXEMPT_LINE_SUBSTRINGS.some(sub => lineLower.includes(sub.toLowerCase()));
    if (isExempt) continue;

    for (const { re, label } of FORBIDDEN_PATTERNS) {
      re.lastIndex = 0;
      if (re.test(line)) {
        findings.push({ pattern: label, label, index: i + 1 });
      }
    }
  }

  return { text, findings, clean: findings.length === 0 };
}
