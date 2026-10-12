/**
 * P23 Production Migration Implementation Review Utils — Unit Tests
 *
 * P23 HARD RULES (enforced by all tests):
 *  - approvalGranted = false always
 *  - productionMigrationApplied = false always
 *  - No ROI / alpha / edge / win-rate / profit / outperform / buy / sell / guaranteed
 */

import {
  evaluateImplementationReviewToken,
  evaluateBackupRestorePackage,
  evaluateMigrationRunbookPackage,
  evaluateRollbackPackage,
  evaluateMonitoringPackage,
  evaluateExecutionSafety,
  buildImplementationPackage,
  buildP24ExecutionApprovalRequest,
  buildImplementationReadinessDecision,
  scanForbiddenClaims,
  REQUIRED_IMPLEMENTATION_REVIEW_TOKEN,
  SUGGESTED_P24_EXECUTION_TOKEN,
} from '../P23ProductionMigrationImplementationReviewUtils';

// ---------------------------------------------------------------------------
// evaluateImplementationReviewToken
// ---------------------------------------------------------------------------
describe('evaluateImplementationReviewToken', () => {
  it('rejects null token', () => {
    const result = evaluateImplementationReviewToken({ token: null });
    expect(result.isValid).toBe(false);
    expect(result.tokenProvided).toBeNull();
  });

  it('rejects undefined token', () => {
    const result = evaluateImplementationReviewToken({});
    expect(result.isValid).toBe(false);
  });

  it('rejects empty string token', () => {
    const result = evaluateImplementationReviewToken({ token: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects wrong token', () => {
    const result = evaluateImplementationReviewToken({ token: 'WRONG_TOKEN' });
    expect(result.isValid).toBe(false);
    expect(result.tokenProvided).toBe('WRONG_TOKEN');
  });

  it('accepts the correct P22 implementation review token', () => {
    const result = evaluateImplementationReviewToken({
      token: REQUIRED_IMPLEMENTATION_REVIEW_TOKEN,
    });
    expect(result.isValid).toBe(true);
    expect(result.tokenProvided).toBe(REQUIRED_IMPLEMENTATION_REVIEW_TOKEN);
    expect(result.tokenRequired).toBe(REQUIRED_IMPLEMENTATION_REVIEW_TOKEN);
  });

  it('tokenRequired is always REQUIRED_IMPLEMENTATION_REVIEW_TOKEN', () => {
    const r1 = evaluateImplementationReviewToken({ token: null });
    const r2 = evaluateImplementationReviewToken({ token: 'WRONG' });
    const r3 = evaluateImplementationReviewToken({ token: REQUIRED_IMPLEMENTATION_REVIEW_TOKEN });
    expect(r1.tokenRequired).toBe(REQUIRED_IMPLEMENTATION_REVIEW_TOKEN);
    expect(r2.tokenRequired).toBe(REQUIRED_IMPLEMENTATION_REVIEW_TOKEN);
    expect(r3.tokenRequired).toBe(REQUIRED_IMPLEMENTATION_REVIEW_TOKEN);
  });
});

// ---------------------------------------------------------------------------
// evaluateBackupRestorePackage
// ---------------------------------------------------------------------------
describe('evaluateBackupRestorePackage', () => {
  const VALID_INPUTS = {
    backupScope: ['MonthlyRevenue', '_prisma_migrations'],
    restoreStepCount: 10,
    checksumAlgorithm: 'sha256',
    rollbackTriggerCount: 8,
    targetFields: ['releaseDate', 'releaseDateSource', 'releaseDateConfidence'],
    autoTrigger: false,
  };

  it('returns complete when all fields provided correctly', () => {
    const result = evaluateBackupRestorePackage(VALID_INPUTS);
    expect(result.isComplete).toBe(true);
    expect(result.gaps).toHaveLength(0);
  });

  it('fails when backupScope is empty', () => {
    const result = evaluateBackupRestorePackage({ ...VALID_INPUTS, backupScope: [] });
    expect(result.isComplete).toBe(false);
    expect(result.hasBackupPlan).toBe(false);
  });

  it('fails when restoreStepCount < 5', () => {
    const result = evaluateBackupRestorePackage({ ...VALID_INPUTS, restoreStepCount: 3 });
    expect(result.isComplete).toBe(false);
    expect(result.hasRestorePlan).toBe(false);
  });

  it('fails when checksumAlgorithm missing', () => {
    const result = evaluateBackupRestorePackage({ ...VALID_INPUTS, checksumAlgorithm: '' });
    expect(result.isComplete).toBe(false);
    expect(result.hasChecksumVerification).toBe(false);
  });

  it('fails when rollbackTriggerCount < 3', () => {
    const result = evaluateBackupRestorePackage({ ...VALID_INPUTS, rollbackTriggerCount: 2 });
    expect(result.isComplete).toBe(false);
    expect(result.hasRollbackTrigger).toBe(false);
  });

  it('fails when targetFields missing releaseDate', () => {
    const result = evaluateBackupRestorePackage({
      ...VALID_INPUTS,
      targetFields: ['releaseDateSource', 'releaseDateConfidence'],
    });
    expect(result.isComplete).toBe(false);
    expect(result.targetFieldsVerified).toBe(false);
  });

  it('fails when autoTrigger is true', () => {
    const result = evaluateBackupRestorePackage({ ...VALID_INPUTS, autoTrigger: true });
    expect(result.isComplete).toBe(false);
    expect(result.gaps.some((g) => g.includes('autoTrigger'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateMigrationRunbookPackage
// ---------------------------------------------------------------------------
describe('evaluateMigrationRunbookPackage', () => {
  const VALID_INPUTS = {
    totalSteps: 14,
    placeholderSteps: 9,
    goNoGoCheckpoints: 3,
    hasProductionMigrateDeployStep: true,
    allProductionCommandsPlaceholder: true,
  };

  it('returns complete when all fields provided correctly', () => {
    const result = evaluateMigrationRunbookPackage(VALID_INPUTS);
    expect(result.isComplete).toBe(true);
    expect(result.gaps).toHaveLength(0);
  });

  it('fails when totalSteps < 10', () => {
    const result = evaluateMigrationRunbookPackage({ ...VALID_INPUTS, totalSteps: 5 });
    expect(result.isComplete).toBe(false);
    expect(result.hasMigrationRunbook).toBe(false);
  });

  it('fails when goNoGoCheckpoints < 2', () => {
    const result = evaluateMigrationRunbookPackage({ ...VALID_INPUTS, goNoGoCheckpoints: 1 });
    expect(result.isComplete).toBe(false);
  });

  it('fails when placeholderStepCount < 5', () => {
    const result = evaluateMigrationRunbookPackage({ ...VALID_INPUTS, placeholderSteps: 3 });
    expect(result.isComplete).toBe(false);
  });

  it('fails when no prisma migrate deploy step', () => {
    const result = evaluateMigrationRunbookPackage({
      ...VALID_INPUTS,
      hasProductionMigrateDeployStep: false,
    });
    expect(result.isComplete).toBe(false);
    expect(result.hasProductionMigrateDeployStep).toBe(false);
  });

  it('fails when non-placeholder production command detected', () => {
    const result = evaluateMigrationRunbookPackage({
      ...VALID_INPUTS,
      allProductionCommandsPlaceholder: false,
    });
    expect(result.isComplete).toBe(false);
    expect(result.allProductionCommandsPlaceholder).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateRollbackPackage
// ---------------------------------------------------------------------------
describe('evaluateRollbackPackage', () => {
  const VALID_INPUTS = {
    triggerCount: 8,
    requiresManualApproval: true,
    autoTrigger: false,
    rollbackStepCount: 10,
  };

  it('returns complete when all fields provided correctly', () => {
    const result = evaluateRollbackPackage(VALID_INPUTS);
    expect(result.isComplete).toBe(true);
    expect(result.gaps).toHaveLength(0);
  });

  it('fails when triggerCount < 3', () => {
    const result = evaluateRollbackPackage({ ...VALID_INPUTS, triggerCount: 2 });
    expect(result.isComplete).toBe(false);
    expect(result.hasTriggers).toBe(false);
  });

  it('fails when requiresManualApproval is false', () => {
    const result = evaluateRollbackPackage({ ...VALID_INPUTS, requiresManualApproval: false });
    expect(result.isComplete).toBe(false);
    expect(result.requiresManualApproval).toBe(false);
  });

  it('fails when autoTrigger is true', () => {
    const result = evaluateRollbackPackage({ ...VALID_INPUTS, autoTrigger: true });
    expect(result.isComplete).toBe(false);
    expect(result.autoTriggerDisabled).toBe(false);
  });

  it('fails when rollbackStepCount < 5', () => {
    const result = evaluateRollbackPackage({ ...VALID_INPUTS, rollbackStepCount: 3 });
    expect(result.isComplete).toBe(false);
    expect(result.hasRollbackSteps).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateMonitoringPackage
// ---------------------------------------------------------------------------
describe('evaluateMonitoringPackage', () => {
  const VALID_INPUTS = {
    totalItems: 13,
    mandatoryItems: 12,
    includesReleaseDateCheck: true,
    includesQueryGateSmokeCheck: true,
    includesNoLeakageCheck: true,
    includesNullRateCheck: true,
  };

  it('returns complete when all fields provided correctly', () => {
    const result = evaluateMonitoringPackage(VALID_INPUTS);
    expect(result.isComplete).toBe(true);
    expect(result.gaps).toHaveLength(0);
  });

  it('fails when totalItems < 10', () => {
    const result = evaluateMonitoringPackage({ ...VALID_INPUTS, totalItems: 5 });
    expect(result.isComplete).toBe(false);
  });

  it('fails when mandatoryItems < 8', () => {
    const result = evaluateMonitoringPackage({ ...VALID_INPUTS, mandatoryItems: 4 });
    expect(result.isComplete).toBe(false);
  });

  it('fails when includesReleaseDateCheck is false', () => {
    const result = evaluateMonitoringPackage({ ...VALID_INPUTS, includesReleaseDateCheck: false });
    expect(result.isComplete).toBe(false);
    expect(result.includesReleaseDateCheck).toBe(false);
  });

  it('fails when includesQueryGateSmokeCheck is false', () => {
    const result = evaluateMonitoringPackage({
      ...VALID_INPUTS,
      includesQueryGateSmokeCheck: false,
    });
    expect(result.isComplete).toBe(false);
  });

  it('fails when includesNullRateCheck is false', () => {
    const result = evaluateMonitoringPackage({ ...VALID_INPUTS, includesNullRateCheck: false });
    expect(result.isComplete).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateExecutionSafety
// ---------------------------------------------------------------------------
describe('evaluateExecutionSafety', () => {
  it('returns safe when all placeholder commands and no approvals', () => {
    const result = evaluateExecutionSafety({
      productionCommands: ['[PLACEHOLDER — requires P24 approval] npx prisma migrate deploy'],
      approvalGranted: false,
      prismaDeployExecuted: false,
      productionDbWritten: false,
    });
    expect(result.isExecutionSafe).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.allCommandsPlaceholder).toBe(true);
    expect(result.approvalNotGranted).toBe(true);
  });

  it('fails when non-placeholder production command detected', () => {
    const result = evaluateExecutionSafety({
      productionCommands: ['npx prisma migrate deploy'],
    });
    expect(result.isExecutionSafe).toBe(false);
    expect(result.allCommandsPlaceholder).toBe(false);
  });

  it('fails when prismaDeployExecuted is true', () => {
    const result = evaluateExecutionSafety({
      productionCommands: [],
      prismaDeployExecuted: true,
    });
    expect(result.isExecutionSafe).toBe(false);
    expect(result.noPrismaDeployExecuted).toBe(false);
  });

  it('fails when productionDbWritten is true', () => {
    const result = evaluateExecutionSafety({ productionDbWritten: true });
    expect(result.isExecutionSafe).toBe(false);
    expect(result.noProductionDbWrite).toBe(false);
  });

  it('fails when approvalGranted is true', () => {
    const result = evaluateExecutionSafety({ approvalGranted: true });
    expect(result.isExecutionSafe).toBe(false);
    expect(result.approvalNotGranted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildImplementationPackage
// ---------------------------------------------------------------------------
describe('buildImplementationPackage', () => {
  const COMPLETE_INPUTS = {
    backupRestoreComplete: true,
    runbookComplete: true,
    rollbackComplete: true,
    monitoringComplete: true,
    allCommandsPlaceholder: true,
    productionExecutionTokenObtained: false,
  };

  it('returns IMPLEMENTATION_PACKAGE_COMPLETE when all complete', () => {
    const pkg = buildImplementationPackage(COMPLETE_INPUTS);
    expect(pkg.implementationPackageStatus).toBe('IMPLEMENTATION_PACKAGE_COMPLETE');
    expect(pkg.approvalGranted).toBe(false);
    expect(pkg.productionMigrationApplied).toBe(false);
    expect(pkg.requiredP24Token).toBe(SUGGESTED_P24_EXECUTION_TOKEN);
  });

  it('approvalGranted is always false', () => {
    const pkg = buildImplementationPackage(COMPLETE_INPUTS);
    expect(pkg.approvalGranted).toBe(false);
  });

  it('productionMigrationApplied is always false', () => {
    const pkg = buildImplementationPackage(COMPLETE_INPUTS);
    expect(pkg.productionMigrationApplied).toBe(false);
  });

  it('returns IMPLEMENTATION_PACKAGE_INCOMPLETE when backup incomplete', () => {
    const pkg = buildImplementationPackage({ ...COMPLETE_INPUTS, backupRestoreComplete: false });
    expect(pkg.implementationPackageStatus).toBe('IMPLEMENTATION_PACKAGE_INCOMPLETE');
    expect(pkg.backupRestoreStatus).toBe('INCOMPLETE');
  });

  it('targetFields includes releaseDate/releaseDateSource/releaseDateConfidence', () => {
    const pkg = buildImplementationPackage(COMPLETE_INPUTS);
    expect(pkg.targetFields).toContain('releaseDate');
    expect(pkg.targetFields).toContain('releaseDateSource');
    expect(pkg.targetFields).toContain('releaseDateConfidence');
  });

  it('is deterministic across multiple calls (except generatedAt)', () => {
    const pkg1 = buildImplementationPackage(COMPLETE_INPUTS);
    const pkg2 = buildImplementationPackage(COMPLETE_INPUTS);
    expect(pkg1.implementationPackageStatus).toBe(pkg2.implementationPackageStatus);
    expect(pkg1.approvalGranted).toBe(pkg2.approvalGranted);
    expect(pkg1.productionMigrationApplied).toBe(pkg2.productionMigrationApplied);
    expect(pkg1.requiredP24Token).toBe(pkg2.requiredP24Token);
  });
});

// ---------------------------------------------------------------------------
// buildP24ExecutionApprovalRequest
// ---------------------------------------------------------------------------
describe('buildP24ExecutionApprovalRequest', () => {
  it('returns requestedToken = SUGGESTED_P24_EXECUTION_TOKEN', () => {
    const req = buildP24ExecutionApprovalRequest({});
    expect(req.requestedToken).toBe(SUGGESTED_P24_EXECUTION_TOKEN);
  });

  it('does NOT auto-grant approval', () => {
    const req = buildP24ExecutionApprovalRequest({});
    expect(req.approvalAutoGranted).toBe(false);
    expect(req.approvalGranted).toBe(false);
  });

  it('productionMigrationApplied is always false', () => {
    const req = buildP24ExecutionApprovalRequest({});
    expect(req.productionMigrationApplied).toBe(false);
  });

  it('scope contains MonthlyRevenue releaseDate migration', () => {
    const req = buildP24ExecutionApprovalRequest({});
    const scopeJoined = req.scopeOfApprovalRequested.join(' ').toLowerCase();
    expect(scopeJoined).toContain('monthlyrevenue');
    expect(scopeJoined).toContain('releasedate');
  });

  it('explicitNonApprovalItems includes no investment recommendation', () => {
    const req = buildP24ExecutionApprovalRequest({});
    const joined = req.explicitNonApprovalItems.join(' ').toLowerCase();
    expect(joined).toContain('investment recommendation');
  });

  it('requiredHumanConfirmation has at least 3 items', () => {
    const req = buildP24ExecutionApprovalRequest({});
    expect(req.requiredHumanConfirmation.length).toBeGreaterThanOrEqual(3);
  });

  it('note explains P23 does not grant token', () => {
    const req = buildP24ExecutionApprovalRequest({});
    expect(req.note.toLowerCase()).toContain('does not grant');
  });
});

// ---------------------------------------------------------------------------
// buildImplementationReadinessDecision
// ---------------------------------------------------------------------------
describe('buildImplementationReadinessDecision', () => {
  const ALL_COMPLETE = {
    backupRestoreComplete: true,
    runbookComplete: true,
    rollbackComplete: true,
    monitoringComplete: true,
    allCommandsPlaceholder: true,
    artifactsComplete: true,
  };

  it('returns P23_READY_TO_REQUEST_PRODUCTION_EXECUTION_APPROVAL when all complete', () => {
    const decision = buildImplementationReadinessDecision(ALL_COMPLETE);
    expect(decision.classification).toBe('P23_READY_TO_REQUEST_PRODUCTION_EXECUTION_APPROVAL');
    expect(decision.readyToRequestExecutionApproval).toBe(true);
  });

  it('approvalGranted is always false', () => {
    const decision = buildImplementationReadinessDecision(ALL_COMPLETE);
    expect(decision.approvalGranted).toBe(false);
  });

  it('productionMigrationApplied is always false', () => {
    const decision = buildImplementationReadinessDecision(ALL_COMPLETE);
    expect(decision.productionMigrationApplied).toBe(false);
  });

  it('returns P23_REQUIRES_BACKUP_RESTORE_HARDENING when backup incomplete', () => {
    const decision = buildImplementationReadinessDecision({
      ...ALL_COMPLETE,
      backupRestoreComplete: false,
    });
    expect(decision.classification).toBe('P23_REQUIRES_BACKUP_RESTORE_HARDENING');
    expect(decision.readyToRequestExecutionApproval).toBe(false);
  });

  it('returns P23_REQUIRES_ROLLBACK_HARDENING when rollback incomplete', () => {
    const decision = buildImplementationReadinessDecision({
      ...ALL_COMPLETE,
      rollbackComplete: false,
    });
    expect(decision.classification).toBe('P23_REQUIRES_ROLLBACK_HARDENING');
  });

  it('returns P23_REQUIRES_MONITORING_HARDENING when monitoring incomplete', () => {
    const decision = buildImplementationReadinessDecision({
      ...ALL_COMPLETE,
      monitoringComplete: false,
    });
    expect(decision.classification).toBe('P23_REQUIRES_MONITORING_HARDENING');
  });

  it('returns P23_REQUIRES_RUNBOOK_HARDENING when runbook incomplete', () => {
    const decision = buildImplementationReadinessDecision({
      ...ALL_COMPLETE,
      runbookComplete: false,
    });
    expect(decision.classification).toBe('P23_REQUIRES_RUNBOOK_HARDENING');
  });

  it('returns P23_IMPLEMENTATION_REVIEW_REJECTED when non-placeholder command detected', () => {
    const decision = buildImplementationReadinessDecision({
      ...ALL_COMPLETE,
      allCommandsPlaceholder: false,
    });
    expect(decision.classification).toBe('P23_IMPLEMENTATION_REVIEW_REJECTED');
  });

  it('returns P23_IMPLEMENTATION_REVIEW_BLOCKED_BY_ARTIFACTS when artifacts missing', () => {
    const decision = buildImplementationReadinessDecision({
      ...ALL_COMPLETE,
      artifactsComplete: false,
    });
    expect(decision.classification).toBe('P23_IMPLEMENTATION_REVIEW_BLOCKED_BY_ARTIFACTS');
  });

  it('recommendedExecutionToken is SUGGESTED_P24_EXECUTION_TOKEN', () => {
    const decision = buildImplementationReadinessDecision(ALL_COMPLETE);
    expect(decision.recommendedExecutionToken).toBe(SUGGESTED_P24_EXECUTION_TOKEN);
  });

  it('evaluations.approvalGuard is always PASS', () => {
    const decision = buildImplementationReadinessDecision(ALL_COMPLETE);
    expect(decision.evaluations.approvalGuard).toBe('PASS');
  });

  it('evaluations.migrationGuard is always PASS', () => {
    const decision = buildImplementationReadinessDecision(ALL_COMPLETE);
    expect(decision.evaluations.migrationGuard).toBe('PASS');
  });
});

// ---------------------------------------------------------------------------
// scanForbiddenClaims
// ---------------------------------------------------------------------------
describe('scanForbiddenClaims', () => {
  it('returns isClean=true for empty string', () => {
    const result = scanForbiddenClaims('');
    expect(result.isClean).toBe(true);
    expect(result.totalMatches).toBe(0);
  });

  it('returns isClean=true for clean text', () => {
    const result = scanForbiddenClaims(
      'This system reviews implementation readiness for production migration.'
    );
    expect(result.isClean).toBe(true);
  });

  it('catches ROI', () => {
    const result = scanForbiddenClaims('The system calculates ROI for each trade.');
    expect(result.isClean).toBe(false);
    expect(result.matches.some((m) => m.matchedPattern === 'ROI')).toBe(true);
  });

  it('catches win-rate', () => {
    const result = scanForbiddenClaims('The strategy has a 70% win-rate historically.');
    expect(result.isClean).toBe(false);
    expect(result.matches.some((m) => m.matchedPattern === 'win-rate')).toBe(true);
  });

  it('catches alpha (non-alphaScore)', () => {
    const result = scanForbiddenClaims('This strategy has a strong alpha signal.');
    expect(result.isClean).toBe(false);
    expect(result.matches.some((m) => m.matchedPattern === 'alpha (non-alphaScore)')).toBe(true);
  });

  it('does NOT catch alphaScore (exempt field name)', () => {
    const result = scanForbiddenClaims('alphaScore: 0.85 indicates model confidence.');
    expect(result.isClean).toBe(true);
  });

  it('catches profit', () => {
    const result = scanForbiddenClaims('Expected profit from this strategy is high.');
    expect(result.isClean).toBe(false);
    expect(result.matches.some((m) => m.matchedPattern === 'profit')).toBe(true);
  });

  it('catches edge', () => {
    const result = scanForbiddenClaims('This model has a significant edge over the market.');
    expect(result.isClean).toBe(false);
    expect(result.matches.some((m) => m.matchedPattern === 'edge')).toBe(true);
  });

  it('catches outperform', () => {
    const result = scanForbiddenClaims('The model is expected to outperform benchmarks.');
    expect(result.isClean).toBe(false);
    expect(result.matches.some((m) => m.matchedPattern === 'outperform')).toBe(true);
  });

  it('catches buy', () => {
    const result = scanForbiddenClaims('The signal suggests: buy this stock now.');
    expect(result.isClean).toBe(false);
    expect(result.matches.some((m) => m.matchedPattern === 'buy/sell')).toBe(true);
  });

  it('catches sell', () => {
    const result = scanForbiddenClaims('The signal suggests: sell immediately.');
    expect(result.isClean).toBe(false);
    expect(result.matches.some((m) => m.matchedPattern === 'buy/sell')).toBe(true);
  });

  it('catches guaranteed', () => {
    const result = scanForbiddenClaims('Returns are guaranteed by the model.');
    expect(result.isClean).toBe(false);
    expect(result.matches.some((m) => m.matchedPattern === 'guaranteed')).toBe(true);
  });

  it('exempt lines containing "forbidden claim" are ignored', () => {
    const result = scanForbiddenClaims(
      '// forbidden claim scanner — catches ROI / alpha / edge / profit'
    );
    expect(result.isClean).toBe(true);
  });

  it('exempt lines containing "disclaimer" are ignored', () => {
    const result = scanForbiddenClaims(
      'Disclaimer: this system does not compute ROI or provide buy/sell signals.'
    );
    expect(result.isClean).toBe(true);
  });

  it('returns correct lineNumber for match', () => {
    const text = 'line one\nThis has ROI in it\nline three';
    const result = scanForbiddenClaims(text);
    expect(result.isClean).toBe(false);
    expect(result.matches[0].lineNumber).toBe(2);
  });

  it('totalMatches reflects correct count', () => {
    const text = 'Calculates ROI daily.\nGenerates profit signals.\nEdge is positive.';
    const result = scanForbiddenClaims(text);
    expect(result.totalMatches).toBe(result.matches.length);
    expect(result.totalMatches).toBeGreaterThan(0);
  });
});
