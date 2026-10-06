/**
 * P23ProductionMigrationImplementationReviewUtils.ts
 *
 * Production Migration Implementation Review Utilities for P23-HARDRESET.
 *
 * HARD RULES:
 *  1. P23 does NOT approve production execution.
 *  2. P23 does NOT apply migration.
 *  3. All production commands must remain [PLACEHOLDER — requires P24 approval].
 *  4. P23 MUST produce a P24 explicit execution approval token request.
 *  5. P23 MUST confirm backup / restore / rollback / monitoring all present.
 *  6. P23 MUST confirm production execution token not yet obtained.
 *  7. productionMigrationApplied = false always.
 *  8. approvalGranted = false always.
 *
 * Suggested P24 execution token: P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY
 * (Providing that token is for a human to decide in P24 — NOT for P23 to grant.)
 */

export const REQUIRED_IMPLEMENTATION_REVIEW_TOKEN =
  'P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY';

export const SUGGESTED_P24_EXECUTION_TOKEN =
  'P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY';

// ---------------------------------------------------------------------------
// Forbidden-claim scanner (same pattern as P21 / P22)
// ---------------------------------------------------------------------------

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bROI\b/, label: 'ROI' },
  { pattern: /win[\s-]rate/i, label: 'win-rate' },
  { pattern: /\boutperform\b/i, label: 'outperform' },
  { pattern: /beat the market/i, label: 'beat the market' },
  { pattern: /\bguaranteed\b/i, label: 'guaranteed' },
  { pattern: /\bprofit\b/i, label: 'profit' },
  { pattern: /investment recommendation/i, label: 'investment recommendation' },
  { pattern: /\balpha\b(?!Score)/i, label: 'alpha (non-alphaScore)' },
  { pattern: /\bedge\b/i, label: 'edge' },
  { pattern: /\b(buy|sell)\b/i, label: 'buy/sell' },
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
  "label: 'alpha",
  'label: "alpha',
  "label: 'buy",
  'label: "buy',
  "label: 'edge",
  'label: "edge',
  "label: 'profit",
  'label: "profit',
  'forbidden_patterns:',
  'forbidden claim scanner',
  'catches roi',
  'catches alpha',
  'catches profit',
  'catches edge',
  'catches buy',
  'catches sell',
  'catches guaranteed',
  'catches outperform',
];

export interface ForbiddenClaimMatch {
  lineNumber: number;
  lineText: string;
  matchedPattern: string;
}

export interface ForbiddenClaimScanResult {
  isClean: boolean;
  totalMatches: number;
  matches: ForbiddenClaimMatch[];
}

export function scanForbiddenClaims(text: string): ForbiddenClaimScanResult {
  const lines = text.split('\n');
  const matches: ForbiddenClaimMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    const isExempt = EXEMPT_LINE_SUBSTRINGS.some(ex => lower.includes(ex.toLowerCase()));
    if (isExempt) continue;

    for (const { pattern, label } of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        matches.push({ lineNumber: i + 1, lineText: line.trim(), matchedPattern: label });
        break;
      }
    }
  }

  return { isClean: matches.length === 0, totalMatches: matches.length, matches };
}

// ---------------------------------------------------------------------------
// A.1 — evaluateImplementationReviewToken
// ---------------------------------------------------------------------------

export interface TokenEvaluationResult {
  tokenProvided: string | null;
  tokenRequired: string;
  isValid: boolean;
  reason: string;
}

export function evaluateImplementationReviewToken(
  input: { token?: string | null }
): TokenEvaluationResult {
  const provided = input.token ?? null;
  if (!provided) {
    return {
      tokenProvided: null,
      tokenRequired: REQUIRED_IMPLEMENTATION_REVIEW_TOKEN,
      isValid: false,
      reason: 'No token provided — implementation review blocked',
    };
  }
  if (provided !== REQUIRED_IMPLEMENTATION_REVIEW_TOKEN) {
    return {
      tokenProvided: provided,
      tokenRequired: REQUIRED_IMPLEMENTATION_REVIEW_TOKEN,
      isValid: false,
      reason: `Wrong token: "${provided}" — expected "${REQUIRED_IMPLEMENTATION_REVIEW_TOKEN}"`,
    };
  }
  return {
    tokenProvided: provided,
    tokenRequired: REQUIRED_IMPLEMENTATION_REVIEW_TOKEN,
    isValid: true,
    reason: 'Token verified — implementation review authorized',
  };
}

// ---------------------------------------------------------------------------
// B — evaluateBackupRestorePackage
// ---------------------------------------------------------------------------

export interface BackupRestoreEvaluationResult {
  hasBackupPlan: boolean;
  hasRestorePlan: boolean;
  hasChecksumVerification: boolean;
  hasRollbackTrigger: boolean;
  targetFieldsVerified: boolean;
  isComplete: boolean;
  gaps: string[];
}

export function evaluateBackupRestorePackage(inputs: {
  backupScope?: string[];
  restoreStepCount?: number;
  checksumAlgorithm?: string;
  rollbackTriggerCount?: number;
  targetFields?: string[];
  autoTrigger?: boolean;
}): BackupRestoreEvaluationResult {
  const gaps: string[] = [];

  const hasBackupPlan = Array.isArray(inputs.backupScope) && inputs.backupScope.length > 0;
  if (!hasBackupPlan) gaps.push('backupScope is empty or missing');

  const hasRestorePlan = (inputs.restoreStepCount ?? 0) >= 5;
  if (!hasRestorePlan) gaps.push(`restoreStepCount=${inputs.restoreStepCount} (expected ≥5)`);

  const hasChecksumVerification = !!inputs.checksumAlgorithm && inputs.checksumAlgorithm.length > 0;
  if (!hasChecksumVerification) gaps.push('checksumAlgorithm missing');

  const hasRollbackTrigger = (inputs.rollbackTriggerCount ?? 0) >= 3;
  if (!hasRollbackTrigger) gaps.push(`rollbackTriggerCount=${inputs.rollbackTriggerCount} (expected ≥3)`);

  const targetFieldsVerified =
    Array.isArray(inputs.targetFields) &&
    inputs.targetFields.includes('releaseDate') &&
    inputs.targetFields.includes('releaseDateSource') &&
    inputs.targetFields.includes('releaseDateConfidence');
  if (!targetFieldsVerified) gaps.push('targetFields missing releaseDate/releaseDateSource/releaseDateConfidence');

  if (inputs.autoTrigger === true) gaps.push('autoTrigger must be false (manual approval required)');

  return {
    hasBackupPlan,
    hasRestorePlan,
    hasChecksumVerification,
    hasRollbackTrigger,
    targetFieldsVerified,
    isComplete: gaps.length === 0,
    gaps,
  };
}

// ---------------------------------------------------------------------------
// C — evaluateMigrationRunbookPackage
// ---------------------------------------------------------------------------

export interface RunbookEvaluationResult {
  totalSteps: number;
  placeholderStepCount: number;
  goNoGoCheckpointCount: number;
  hasProductionMigrateDeployStep: boolean;
  allProductionCommandsPlaceholder: boolean;
  hasMigrationRunbook: boolean;
  isComplete: boolean;
  gaps: string[];
}

export function evaluateMigrationRunbookPackage(inputs: {
  totalSteps?: number;
  placeholderSteps?: number;
  goNoGoCheckpoints?: number;
  hasProductionMigrateDeployStep?: boolean;
  allProductionCommandsPlaceholder?: boolean;
}): RunbookEvaluationResult {
  const gaps: string[] = [];

  const totalSteps = inputs.totalSteps ?? 0;
  const placeholderStepCount = inputs.placeholderSteps ?? 0;
  const goNoGoCheckpointCount = inputs.goNoGoCheckpoints ?? 0;

  const hasMigrationRunbook = totalSteps >= 10;
  if (!hasMigrationRunbook) gaps.push(`totalSteps=${totalSteps} (expected ≥10)`);

  const hasGoNoGo = goNoGoCheckpointCount >= 2;
  if (!hasGoNoGo) gaps.push(`goNoGoCheckpoints=${goNoGoCheckpointCount} (expected ≥2)`);

  const allProductionCommandsPlaceholder = inputs.allProductionCommandsPlaceholder !== false;
  if (!allProductionCommandsPlaceholder) gaps.push('non-placeholder production commands detected');

  const hasProductionMigrateDeployStep = inputs.hasProductionMigrateDeployStep === true;
  if (!hasProductionMigrateDeployStep) gaps.push('no prisma migrate deploy step found in runbook');

  if (placeholderStepCount < 5) gaps.push(`placeholderStepCount=${placeholderStepCount} (expected ≥5)`);

  return {
    totalSteps,
    placeholderStepCount,
    goNoGoCheckpointCount,
    hasProductionMigrateDeployStep,
    allProductionCommandsPlaceholder,
    hasMigrationRunbook,
    isComplete: gaps.length === 0,
    gaps,
  };
}

// ---------------------------------------------------------------------------
// D — evaluateRollbackPackage
// ---------------------------------------------------------------------------

export interface RollbackEvaluationResult {
  hasTriggers: boolean;
  triggerCount: number;
  requiresManualApproval: boolean;
  autoTriggerDisabled: boolean;
  hasRollbackSteps: boolean;
  rollbackStepCount: number;
  isComplete: boolean;
  gaps: string[];
}

export function evaluateRollbackPackage(inputs: {
  triggerCount?: number;
  requiresManualApproval?: boolean;
  autoTrigger?: boolean;
  rollbackStepCount?: number;
}): RollbackEvaluationResult {
  const gaps: string[] = [];

  const triggerCount = inputs.triggerCount ?? 0;
  const hasTriggers = triggerCount >= 3;
  if (!hasTriggers) gaps.push(`triggerCount=${triggerCount} (expected ≥3)`);

  const requiresManualApproval = inputs.requiresManualApproval !== false;
  if (!requiresManualApproval) gaps.push('rollback must require manual approval');

  const autoTriggerDisabled = inputs.autoTrigger !== true;
  if (!autoTriggerDisabled) gaps.push('autoTrigger must be false');

  const rollbackStepCount = inputs.rollbackStepCount ?? 0;
  const hasRollbackSteps = rollbackStepCount >= 5;
  if (!hasRollbackSteps) gaps.push(`rollbackStepCount=${rollbackStepCount} (expected ≥5)`);

  return {
    hasTriggers,
    triggerCount,
    requiresManualApproval,
    autoTriggerDisabled,
    hasRollbackSteps,
    rollbackStepCount,
    isComplete: gaps.length === 0,
    gaps,
  };
}

// ---------------------------------------------------------------------------
// E — evaluateMonitoringPackage
// ---------------------------------------------------------------------------

export interface MonitoringEvaluationResult {
  totalItems: number;
  mandatoryItems: number;
  includesReleaseDateCheck: boolean;
  includesQueryGateSmokeCheck: boolean;
  includesNoLeakageCheck: boolean;
  includesNullRateCheck: boolean;
  isComplete: boolean;
  gaps: string[];
}

export function evaluateMonitoringPackage(inputs: {
  totalItems?: number;
  mandatoryItems?: number;
  includesReleaseDateCheck?: boolean;
  includesQueryGateSmokeCheck?: boolean;
  includesNoLeakageCheck?: boolean;
  includesNullRateCheck?: boolean;
}): MonitoringEvaluationResult {
  const gaps: string[] = [];

  const totalItems = inputs.totalItems ?? 0;
  const mandatoryItems = inputs.mandatoryItems ?? 0;

  if (totalItems < 10) gaps.push(`totalItems=${totalItems} (expected ≥10)`);
  if (mandatoryItems < 8) gaps.push(`mandatoryItems=${mandatoryItems} (expected ≥8)`);

  const includesReleaseDateCheck = inputs.includesReleaseDateCheck === true;
  if (!includesReleaseDateCheck) gaps.push('missing releaseDate schema check');

  const includesQueryGateSmokeCheck = inputs.includesQueryGateSmokeCheck === true;
  if (!includesQueryGateSmokeCheck) gaps.push('missing query gate smoke check');

  const includesNoLeakageCheck = inputs.includesNoLeakageCheck === true;
  if (!includesNoLeakageCheck) gaps.push('missing no-leakage check');

  const includesNullRateCheck = inputs.includesNullRateCheck === true;
  if (!includesNullRateCheck) gaps.push('missing releaseDate null rate check');

  return {
    totalItems,
    mandatoryItems,
    includesReleaseDateCheck,
    includesQueryGateSmokeCheck,
    includesNoLeakageCheck,
    includesNullRateCheck,
    isComplete: gaps.length === 0,
    gaps,
  };
}

// ---------------------------------------------------------------------------
// F — evaluateExecutionSafety
// ---------------------------------------------------------------------------

export interface ExecutionSafetyResult {
  allCommandsPlaceholder: boolean;
  noProductionDbWrite: boolean;
  noPrismaDeployExecuted: boolean;
  approvalNotGranted: boolean;
  isExecutionSafe: boolean;
  violations: string[];
}

export function evaluateExecutionSafety(inputs: {
  productionCommands?: string[];
  approvalGranted?: boolean;
  prismaDeployExecuted?: boolean;
  productionDbWritten?: boolean;
}): ExecutionSafetyResult {
  const violations: string[] = [];

  const allCommandsPlaceholder = (inputs.productionCommands ?? []).every(
    cmd => cmd.includes('[PLACEHOLDER') || cmd.toLowerCase().includes('placeholder')
  );
  if (!allCommandsPlaceholder) violations.push('non-placeholder production command detected');

  const noPrismaDeployExecuted = inputs.prismaDeployExecuted !== true;
  if (!noPrismaDeployExecuted) violations.push('prisma migrate deploy was executed (P23 must not execute)');

  const noProductionDbWrite = inputs.productionDbWritten !== true;
  if (!noProductionDbWrite) violations.push('production DB write detected (P23 must not write)');

  const approvalNotGranted = inputs.approvalGranted !== true;
  if (!approvalNotGranted) violations.push('approvalGranted=true (P23 must not auto-grant approval)');

  return {
    allCommandsPlaceholder,
    noProductionDbWrite,
    noPrismaDeployExecuted,
    approvalNotGranted,
    isExecutionSafe: violations.length === 0,
    violations,
  };
}

// ---------------------------------------------------------------------------
// G — buildImplementationPackage
// ---------------------------------------------------------------------------

export interface ImplementationPackage {
  phase: string;
  generatedAt: string;
  implementationPackageStatus: string;
  backupRestoreStatus: string;
  migrationRunbookStatus: string;
  rollbackStatus: string;
  monitoringStatus: string;
  productionCommandSafety: string;
  executionApprovalStatus: string;
  whyNoMigrationApplied: string;
  requiredP24Token: string;
  approvalGranted: false;
  productionMigrationApplied: false;
  targetFields: string[];
}

export function buildImplementationPackage(inputs: {
  backupRestoreComplete: boolean;
  runbookComplete: boolean;
  rollbackComplete: boolean;
  monitoringComplete: boolean;
  allCommandsPlaceholder: boolean;
  productionExecutionTokenObtained: boolean;
}): ImplementationPackage {
  const now = new Date().toISOString();

  const allComplete =
    inputs.backupRestoreComplete &&
    inputs.runbookComplete &&
    inputs.rollbackComplete &&
    inputs.monitoringComplete &&
    inputs.allCommandsPlaceholder &&
    !inputs.productionExecutionTokenObtained;

  return {
    phase: 'P23',
    generatedAt: now,
    implementationPackageStatus: allComplete
      ? 'IMPLEMENTATION_PACKAGE_COMPLETE'
      : 'IMPLEMENTATION_PACKAGE_INCOMPLETE',
    backupRestoreStatus: inputs.backupRestoreComplete ? 'COMPLETE' : 'INCOMPLETE',
    migrationRunbookStatus: inputs.runbookComplete ? 'COMPLETE' : 'INCOMPLETE',
    rollbackStatus: inputs.rollbackComplete ? 'COMPLETE' : 'INCOMPLETE',
    monitoringStatus: inputs.monitoringComplete ? 'COMPLETE' : 'INCOMPLETE',
    productionCommandSafety: inputs.allCommandsPlaceholder
      ? 'ALL_COMMANDS_PLACEHOLDER'
      : 'NON_PLACEHOLDER_COMMAND_DETECTED',
    executionApprovalStatus: inputs.productionExecutionTokenObtained
      ? 'EXECUTION_TOKEN_OBTAINED'
      : 'AWAITING_P24_EXECUTION_TOKEN',
    whyNoMigrationApplied:
      'P23 is an implementation review phase only. ' +
      'Production migration execution requires an explicit P24 execution token: ' +
      SUGGESTED_P24_EXECUTION_TOKEN + '. ' +
      'That token has not been provided in P23 and must be obtained from CTO/CEO in P24.',
    requiredP24Token: SUGGESTED_P24_EXECUTION_TOKEN,
    approvalGranted: false,
    productionMigrationApplied: false,
    targetFields: ['releaseDate', 'releaseDateSource', 'releaseDateConfidence'],
  };
}

// ---------------------------------------------------------------------------
// H — buildP24ExecutionApprovalRequest
// ---------------------------------------------------------------------------

export interface P24ExecutionApprovalRequest {
  phase: string;
  generatedAt: string;
  requestedToken: string;
  scopeOfApprovalRequested: string[];
  explicitNonApprovalItems: string[];
  requiredHumanConfirmation: string[];
  approvalAutoGranted: false;
  approvalGranted: false;
  productionMigrationApplied: false;
  note: string;
}

export function buildP24ExecutionApprovalRequest(inputs: {
  requestedBy?: string;
  targetTable?: string;
}): P24ExecutionApprovalRequest {
  const now = new Date().toISOString();
  return {
    phase: 'P23',
    generatedAt: now,
    requestedToken: SUGGESTED_P24_EXECUTION_TOKEN,
    scopeOfApprovalRequested: [
      'Execute production migration of MonthlyRevenue.releaseDate schema in P24 only',
      'Backup must run before migration and checksum verified',
      'Migration must be reversible — rollback plan must be active',
      'Post-migration validation checklist (MON-01 to MON-13) must pass before resuming service',
      'Rollback trigger must remain armed during and after migration window',
      'releaseDate null rate must be checked at T+0, T+24h, T+7d',
      'Query gate smoke check must pass before go-live',
    ],
    explicitNonApprovalItems: [
      'No investment recommendation is authorized',
      'No scoring formula changes are authorized',
      'No corpus regeneration or alteration',
      'No automatic deployment without explicit go-live sign-off',
      'No bypass of backup/restore verification steps',
      'No bypass of query gate smoke check',
      'No activation of auto-rollback trigger',
    ],
    requiredHumanConfirmation: [
      'Production DB target path / connection verified',
      'Backup storage location confirmed and writable',
      'Maintenance window scheduled and communicated',
      'Rollback owner identified and reachable',
      'Validation owner identified and reachable',
    ],
    approvalAutoGranted: false,
    approvalGranted: false,
    productionMigrationApplied: false,
    note:
      'P23 only requests this token. It does NOT grant it. ' +
      'CTO/CEO must provide ' + SUGGESTED_P24_EXECUTION_TOKEN + ' explicitly to authorize P24 execution.',
  };
}

// ---------------------------------------------------------------------------
// I — buildImplementationReadinessDecision
// ---------------------------------------------------------------------------

export type P23Classification =
  | 'P23_READY_TO_REQUEST_PRODUCTION_EXECUTION_APPROVAL'
  | 'P23_REQUIRES_BACKUP_RESTORE_HARDENING'
  | 'P23_REQUIRES_ROLLBACK_HARDENING'
  | 'P23_REQUIRES_MONITORING_HARDENING'
  | 'P23_REQUIRES_RUNBOOK_HARDENING'
  | 'P23_IMPLEMENTATION_REVIEW_REJECTED'
  | 'P23_IMPLEMENTATION_REVIEW_BLOCKED_BY_ARTIFACTS';

export interface ImplementationReadinessDecision {
  phase: string;
  generatedAt: string;
  classification: P23Classification;
  readyToRequestExecutionApproval: boolean;
  approvalGranted: false;
  productionMigrationApplied: false;
  recommendedExecutionToken: string;
  evaluations: Record<string, 'PASS' | 'FAIL'>;
  blockers: string[];
  whyNotApproved: string;
}

export function buildImplementationReadinessDecision(inputs: {
  backupRestoreComplete: boolean;
  runbookComplete: boolean;
  rollbackComplete: boolean;
  monitoringComplete: boolean;
  allCommandsPlaceholder: boolean;
  artifactsComplete?: boolean;
}): ImplementationReadinessDecision {
  const now = new Date().toISOString();
  const blockers: string[] = [];

  const evaluations: Record<string, 'PASS' | 'FAIL'> = {
    backupRestoreComplete: inputs.backupRestoreComplete ? 'PASS' : 'FAIL',
    runbookComplete: inputs.runbookComplete ? 'PASS' : 'FAIL',
    rollbackComplete: inputs.rollbackComplete ? 'PASS' : 'FAIL',
    monitoringComplete: inputs.monitoringComplete ? 'PASS' : 'FAIL',
    allCommandsPlaceholder: inputs.allCommandsPlaceholder ? 'PASS' : 'FAIL',
    artifactsComplete: inputs.artifactsComplete !== false ? 'PASS' : 'FAIL',
    approvalGuard: 'PASS', // approvalGranted=false — always PASS in P23
    migrationGuard: 'PASS', // productionMigrationApplied=false — always PASS in P23
  };

  if (inputs.artifactsComplete === false) blockers.push('required artifacts missing');
  if (!inputs.backupRestoreComplete) blockers.push('backup/restore plan incomplete');
  if (!inputs.runbookComplete) blockers.push('migration runbook incomplete');
  if (!inputs.rollbackComplete) blockers.push('rollback package incomplete');
  if (!inputs.monitoringComplete) blockers.push('monitoring checklist incomplete');
  if (!inputs.allCommandsPlaceholder) blockers.push('non-placeholder production commands detected');

  let classification: P23Classification;
  if (inputs.artifactsComplete === false) {
    classification = 'P23_IMPLEMENTATION_REVIEW_BLOCKED_BY_ARTIFACTS';
  } else if (!inputs.backupRestoreComplete) {
    classification = 'P23_REQUIRES_BACKUP_RESTORE_HARDENING';
  } else if (!inputs.rollbackComplete) {
    classification = 'P23_REQUIRES_ROLLBACK_HARDENING';
  } else if (!inputs.monitoringComplete) {
    classification = 'P23_REQUIRES_MONITORING_HARDENING';
  } else if (!inputs.runbookComplete) {
    classification = 'P23_REQUIRES_RUNBOOK_HARDENING';
  } else if (!inputs.allCommandsPlaceholder) {
    classification = 'P23_IMPLEMENTATION_REVIEW_REJECTED';
  } else {
    classification = 'P23_READY_TO_REQUEST_PRODUCTION_EXECUTION_APPROVAL';
  }

  const readyToRequestExecutionApproval =
    classification === 'P23_READY_TO_REQUEST_PRODUCTION_EXECUTION_APPROVAL';

  return {
    phase: 'P23',
    generatedAt: now,
    classification,
    readyToRequestExecutionApproval,
    approvalGranted: false,
    productionMigrationApplied: false,
    recommendedExecutionToken: SUGGESTED_P24_EXECUTION_TOKEN,
    evaluations,
    blockers,
    whyNotApproved:
      'P23 reviews implementation readiness only. ' +
      'Production execution approval requires an explicit P24 execution token: ' +
      SUGGESTED_P24_EXECUTION_TOKEN + '. ' +
      'That token has not been provided. CTO/CEO must grant it in P24.',
  };
}
