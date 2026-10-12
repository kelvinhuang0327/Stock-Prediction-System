/**
 * P22-HARDRESET Part G
 * Unit tests for P22ProductionMigrationPlanUtils
 */

import {
  evaluatePlanApprovalToken,
  buildProductionBackupPlan,
  buildProductionRestorePlan,
  buildMigrationExecutionRunbook,
  buildRollbackRunbook,
  buildPreMigrationChecklist,
  buildPostMigrationValidationChecklist,
  buildMonitoringChecklist,
  buildGoNoGoDecision,
  scanForbiddenClaims,
} from '../P22ProductionMigrationPlanUtils';

const REQUIRED_TOKEN = 'P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY';
const P23_REVIEW_TOKEN = 'P22_APPROVE_PRODUCTION_MIGRATION_IMPLEMENTATION_REVIEW_ONLY';

// ─── evaluatePlanApprovalToken ────────────────────────────────────────────────

describe('evaluatePlanApprovalToken', () => {
  test('rejects null token', () => {
    const result = evaluatePlanApprovalToken({ token: null });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no approval token/i);
  });

  test('rejects undefined token', () => {
    const result = evaluatePlanApprovalToken({ token: undefined });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no approval token/i);
  });

  test('rejects empty string token', () => {
    const result = evaluatePlanApprovalToken({ token: '' });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no approval token/i);
  });

  test('rejects wrong token', () => {
    const result = evaluatePlanApprovalToken({ token: 'WRONG_TOKEN' });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/invalid token/i);
  });

  test('rejects P23 review token (not the right phase token)', () => {
    const result = evaluatePlanApprovalToken({ token: P23_REVIEW_TOKEN });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/invalid token/i);
  });

  test('accepts the correct P21 approval token', () => {
    const result = evaluatePlanApprovalToken({ token: REQUIRED_TOKEN });
    expect(result.valid).toBe(true);
    expect(result.token).toBe(REQUIRED_TOKEN);
    expect(result.reason).toMatch(/token accepted/i);
  });
});

// ─── buildProductionBackupPlan ───────────────────────────────────────────────

describe('buildProductionBackupPlan', () => {
  test('includes MonthlyRevenue in scope tables', () => {
    const { backupPlan } = buildProductionBackupPlan({ targetTable: 'MonthlyRevenue' });
    expect(backupPlan.scope.tables).toContain('MonthlyRevenue');
  });

  test('includes _prisma_migrations in scope tables', () => {
    const { backupPlan } = buildProductionBackupPlan({ targetTable: 'MonthlyRevenue' });
    expect(backupPlan.scope.tables).toContain('_prisma_migrations');
  });

  test('includes prisma schema file in scope', () => {
    const { backupPlan } = buildProductionBackupPlan({ targetTable: 'MonthlyRevenue' });
    expect(backupPlan.scope.schemaFile).toMatch(/prisma\/schema\.prisma/);
  });

  test('marks migration command as PLACEHOLDER', () => {
    const { backupPlan } = buildProductionBackupPlan({ targetTable: 'MonthlyRevenue', dbProvider: 'sqlite' });
    expect(backupPlan.method.command).toMatch(/\[PLACEHOLDER/i);
  });

  test('requires checksum verification', () => {
    const { backupPlan } = buildProductionBackupPlan({ targetTable: 'MonthlyRevenue' });
    expect(backupPlan.method.checksumVerification).toBe(true);
    expect(backupPlan.method.fileHashAlgorithm).toBe('sha256');
  });

  test('restore method includes releaseDate verification', () => {
    const { backupPlan } = buildProductionBackupPlan({ targetTable: 'MonthlyRevenue' });
    expect(backupPlan.restoreMethod.verifyReleaseDateField).toBe(true);
    expect(backupPlan.restoreMethod.verifyRowCount).toBe(true);
    expect(backupPlan.restoreMethod.verifySchema).toBe(true);
  });

  test('restore steps include multiple placeholder steps', () => {
    const { backupPlan } = buildProductionBackupPlan({ targetTable: 'MonthlyRevenue' });
    const placeholderSteps = backupPlan.restoreMethod.steps.filter(s => s.includes('[PLACEHOLDER'));
    expect(placeholderSteps.length).toBeGreaterThanOrEqual(2);
  });

  test('rollback triggers do not allow auto-trigger', () => {
    const { backupPlan } = buildProductionBackupPlan({ targetTable: 'MonthlyRevenue' });
    expect(backupPlan.rollbackTrigger.autoTrigger).toBe(false);
    expect(backupPlan.rollbackTrigger.requiresManualApproval).toBe(true);
  });

  test('approvalGranted is always false', () => {
    const result = buildProductionBackupPlan({ targetTable: 'MonthlyRevenue' });
    expect(result.approvalGranted).toBe(false);
  });

  test('productionMigrationApplied is always false', () => {
    const result = buildProductionBackupPlan({ targetTable: 'MonthlyRevenue' });
    expect(result.productionMigrationApplied).toBe(false);
  });
});

// ─── buildProductionRestorePlan ──────────────────────────────────────────────

describe('buildProductionRestorePlan', () => {
  test('returns non-empty steps', () => {
    const { restorePlan } = buildProductionRestorePlan({});
    expect(restorePlan.steps.length).toBeGreaterThanOrEqual(5);
  });

  test('includes verification steps', () => {
    const { restorePlan } = buildProductionRestorePlan({});
    expect(restorePlan.verificationSteps.length).toBeGreaterThanOrEqual(4);
  });

  test('requires approval', () => {
    const { restorePlan } = buildProductionRestorePlan({});
    expect(restorePlan.requiresApproval).toBe(true);
  });

  test('includes releaseDate-related verification', () => {
    const { restorePlan } = buildProductionRestorePlan({});
    const releaseDateVerification = restorePlan.verificationSteps.some(s =>
      s.toLowerCase().includes('releasedate')
    );
    expect(releaseDateVerification).toBe(true);
  });

  test('approvalGranted is always false', () => {
    const result = buildProductionRestorePlan({});
    expect(result.approvalGranted).toBe(false);
  });

  test('productionMigrationApplied is always false', () => {
    const result = buildProductionRestorePlan({});
    expect(result.productionMigrationApplied).toBe(false);
  });
});

// ─── buildMigrationExecutionRunbook ──────────────────────────────────────────

describe('buildMigrationExecutionRunbook', () => {
  test('includes 12 or more runbook steps', () => {
    const runbook = buildMigrationExecutionRunbook({ targetTable: 'MonthlyRevenue' });
    expect(runbook.runbookSteps.length).toBeGreaterThanOrEqual(12);
  });

  test('prisma migrate deploy step is a placeholder', () => {
    const runbook = buildMigrationExecutionRunbook({ targetTable: 'MonthlyRevenue' });
    const migrateStep = runbook.runbookSteps.find(s =>
      s.command && s.command.includes('prisma migrate deploy')
    );
    expect(migrateStep).toBeDefined();
    expect(migrateStep!.isPlaceholder).toBe(true);
  });

  test('backfill step is a placeholder', () => {
    const runbook = buildMigrationExecutionRunbook({ targetTable: 'MonthlyRevenue' });
    const backfillStep = runbook.runbookSteps.find(s =>
      s.command && s.command.includes('backfill')
    );
    expect(backfillStep).toBeDefined();
    expect(backfillStep!.isPlaceholder).toBe(true);
  });

  test('all placeholder steps reference P23 approval token', () => {
    const runbook = buildMigrationExecutionRunbook({ targetTable: 'MonthlyRevenue' });
    const placeholderSteps = runbook.runbookSteps.filter(s => s.isPlaceholder);
    expect(placeholderSteps.length).toBeGreaterThan(0);
    placeholderSteps.forEach(step => {
      expect(step.requiresApprovalToken).toBe(P23_REVIEW_TOKEN);
    });
  });

  test('placeholder commands contain [PLACEHOLDER] text', () => {
    const runbook = buildMigrationExecutionRunbook({ targetTable: 'MonthlyRevenue' });
    const placeholderWithCommand = runbook.runbookSteps.filter(
      s => s.isPlaceholder && s.command
    );
    placeholderWithCommand.forEach(step => {
      expect(step.command).toMatch(/\[PLACEHOLDER/i);
    });
  });

  test('requiredApprovalTokenForP23 is correct', () => {
    const runbook = buildMigrationExecutionRunbook({ targetTable: 'MonthlyRevenue' });
    expect(runbook.requiredApprovalTokenForP23).toBe(P23_REVIEW_TOKEN);
  });

  test('approvalGranted is always false', () => {
    const runbook = buildMigrationExecutionRunbook({ targetTable: 'MonthlyRevenue' });
    expect(runbook.approvalGranted).toBe(false);
  });

  test('productionMigrationApplied is always false', () => {
    const runbook = buildMigrationExecutionRunbook({ targetTable: 'MonthlyRevenue' });
    expect(runbook.productionMigrationApplied).toBe(false);
  });
});

// ─── buildRollbackRunbook ─────────────────────────────────────────────────────

describe('buildRollbackRunbook', () => {
  test('includes rollback triggers', () => {
    const runbook = buildRollbackRunbook({ targetTable: 'MonthlyRevenue' });
    expect(runbook.rollbackTriggers.length).toBeGreaterThanOrEqual(5);
  });

  test('requires manual approval for rollback', () => {
    const runbook = buildRollbackRunbook({ targetTable: 'MonthlyRevenue' });
    expect(runbook.requiresManualApproval).toBe(true);
  });

  test('includes rollback steps', () => {
    const runbook = buildRollbackRunbook({ targetTable: 'MonthlyRevenue' });
    expect(runbook.rollbackSteps.length).toBeGreaterThanOrEqual(5);
  });

  test('productionMigrationApplied is always false', () => {
    const runbook = buildRollbackRunbook({ targetTable: 'MonthlyRevenue' });
    expect(runbook.productionMigrationApplied).toBe(false);
  });

  test('triggers reference realistic failure scenarios', () => {
    const runbook = buildRollbackRunbook({ targetTable: 'MonthlyRevenue' });
    const triggersText = runbook.rollbackTriggers.join(' ').toLowerCase();
    expect(triggersText).toMatch(/migration|backfill|query gate|row count|validation/);
  });
});

// ─── buildPreMigrationChecklist ───────────────────────────────────────────────

describe('buildPreMigrationChecklist', () => {
  test('returns 12 or more checklist items', () => {
    const checklist = buildPreMigrationChecklist({ targetTable: 'MonthlyRevenue' });
    expect(checklist.checklistItems.length).toBeGreaterThanOrEqual(12);
  });

  test('all mandatory items have mandatory=true', () => {
    const checklist = buildPreMigrationChecklist({ targetTable: 'MonthlyRevenue' });
    const mandatory = checklist.checklistItems.filter(i => i.mandatory);
    expect(mandatory.length).toBeGreaterThan(0);
  });

  test('includes backup-related check', () => {
    const checklist = buildPreMigrationChecklist({ targetTable: 'MonthlyRevenue' });
    const backupItem = checklist.checklistItems.find(i => i.category === 'backup');
    expect(backupItem).toBeDefined();
  });

  test('includes governance (approval token) check', () => {
    const checklist = buildPreMigrationChecklist({ targetTable: 'MonthlyRevenue' });
    const govItems = checklist.checklistItems.filter(i => i.category === 'governance');
    expect(govItems.length).toBeGreaterThan(0);
    const tokenCheck = govItems.find(i => i.label.includes('P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY'));
    expect(tokenCheck).toBeDefined();
  });

  test('approvalGranted is always false', () => {
    const checklist = buildPreMigrationChecklist({ targetTable: 'MonthlyRevenue' });
    expect(checklist.approvalGranted).toBe(false);
  });

  test('productionMigrationApplied is always false', () => {
    const checklist = buildPreMigrationChecklist({ targetTable: 'MonthlyRevenue' });
    expect(checklist.productionMigrationApplied).toBe(false);
  });

  test('result is deterministic (same output on repeated calls)', () => {
    const a = buildPreMigrationChecklist({ targetTable: 'MonthlyRevenue' });
    const b = buildPreMigrationChecklist({ targetTable: 'MonthlyRevenue' });
    expect(a.checklistItems.length).toBe(b.checklistItems.length);
    expect(a.checklistItems[0].itemId).toBe(b.checklistItems[0].itemId);
  });
});

// ─── buildPostMigrationValidationChecklist ───────────────────────────────────

describe('buildPostMigrationValidationChecklist', () => {
  test('returns 13 or more checklist items', () => {
    const checklist = buildPostMigrationValidationChecklist({ targetTable: 'MonthlyRevenue' });
    expect(checklist.checklistItems.length).toBeGreaterThanOrEqual(13);
  });

  test('includesReleaseDateCheck is true', () => {
    const checklist = buildPostMigrationValidationChecklist({ targetTable: 'MonthlyRevenue' });
    expect(checklist.includesReleaseDateCheck).toBe(true);
  });

  test('includesQueryGateCheck is true', () => {
    const checklist = buildPostMigrationValidationChecklist({ targetTable: 'MonthlyRevenue' });
    expect(checklist.includesQueryGateCheck).toBe(true);
  });

  test('includes releaseDate schema check', () => {
    const checklist = buildPostMigrationValidationChecklist({ targetTable: 'MonthlyRevenue' });
    const releaseDateItem = checklist.checklistItems.find(i =>
      i.label.toLowerCase().includes('releasedate')
    );
    expect(releaseDateItem).toBeDefined();
  });

  test('includes PIT guard (query gate) check', () => {
    const checklist = buildPostMigrationValidationChecklist({ targetTable: 'MonthlyRevenue' });
    const pitItem = checklist.checklistItems.find(i => i.category === 'pit-guard');
    expect(pitItem).toBeDefined();
  });

  test('includes smoke tests for key services', () => {
    const checklist = buildPostMigrationValidationChecklist({ targetTable: 'MonthlyRevenue' });
    const smokeItems = checklist.checklistItems.filter(i => i.category === 'smoke');
    expect(smokeItems.length).toBeGreaterThanOrEqual(3);
    const labels = smokeItems.map(i => i.label);
    expect(labels.some(l => l.includes('RuleBasedStockAnalyzer'))).toBe(true);
    expect(labels.some(l => l.includes('FundamentalResearchService'))).toBe(true);
    expect(labels.some(l => l.includes('ActiveScoringSnapshot'))).toBe(true);
  });

  test('productionMigrationApplied is always false', () => {
    const checklist = buildPostMigrationValidationChecklist({ targetTable: 'MonthlyRevenue' });
    expect(checklist.productionMigrationApplied).toBe(false);
  });
});

// ─── buildMonitoringChecklist ─────────────────────────────────────────────────

describe('buildMonitoringChecklist', () => {
  test('returns exactly 13 checklist items', () => {
    const checklist = buildMonitoringChecklist({ targetTable: 'MonthlyRevenue' });
    expect(checklist.checklistItems.length).toBe(13);
  });

  test('includesQueryGateSmokeCheck is true', () => {
    const checklist = buildMonitoringChecklist({ targetTable: 'MonthlyRevenue' });
    expect(checklist.includesQueryGateSmokeCheck).toBe(true);
  });

  test('includesReleaseDateNullRateCheck is true', () => {
    const checklist = buildMonitoringChecklist({ targetTable: 'MonthlyRevenue' });
    expect(checklist.includesReleaseDateNullRateCheck).toBe(true);
  });

  test('MON-08 is the query gate smoke check', () => {
    const checklist = buildMonitoringChecklist({ targetTable: 'MonthlyRevenue' });
    const mon08 = checklist.checklistItems.find(i => i.itemId === 'MON-08');
    expect(mon08).toBeDefined();
    expect(mon08!.category).toBe('pit-guard');
    expect(mon08!.mandatory).toBe(true);
  });

  test('MON-13 is the no-leakage check', () => {
    const checklist = buildMonitoringChecklist({ targetTable: 'MonthlyRevenue' });
    const mon13 = checklist.checklistItems.find(i => i.itemId === 'MON-13');
    expect(mon13).toBeDefined();
    expect(mon13!.category).toBe('pit-guard');
    expect(mon13!.mandatory).toBe(true);
  });

  test('includes smoke tests for all three required services', () => {
    const checklist = buildMonitoringChecklist({ targetTable: 'MonthlyRevenue' });
    const smokeItems = checklist.checklistItems.filter(i => i.category === 'smoke');
    const labels = smokeItems.map(i => i.label);
    expect(labels.some(l => l.includes('RuleBasedStockAnalyzer'))).toBe(true);
    expect(labels.some(l => l.includes('FundamentalResearchService'))).toBe(true);
    expect(labels.some(l => l.includes('ActiveScoringSnapshot'))).toBe(true);
  });

  test('all 3 releaseDate field checks are present', () => {
    const checklist = buildMonitoringChecklist({ targetTable: 'MonthlyRevenue' });
    const mon01 = checklist.checklistItems.find(i => i.itemId === 'MON-01');
    const mon02 = checklist.checklistItems.find(i => i.itemId === 'MON-02');
    const mon03 = checklist.checklistItems.find(i => i.itemId === 'MON-03');
    expect(mon01).toBeDefined();
    expect(mon02).toBeDefined();
    expect(mon03).toBeDefined();
  });

  test('productionMigrationApplied is always false', () => {
    const checklist = buildMonitoringChecklist({ targetTable: 'MonthlyRevenue' });
    expect(checklist.productionMigrationApplied).toBe(false);
  });
});

// ─── buildGoNoGoDecision ──────────────────────────────────────────────────────

describe('buildGoNoGoDecision', () => {
  const allComplete = {
    backupComplete: true,
    restoreComplete: true,
    rollbackComplete: true,
    monitoringComplete: true,
    validationComplete: true,
    safetyValid: true,
  };

  test('does not auto-approve — approvalGranted is always false', () => {
    const decision = buildGoNoGoDecision(allComplete);
    expect(decision.approvalGranted).toBe(false);
  });

  test('does not auto-apply migration — productionMigrationApplied is always false', () => {
    const decision = buildGoNoGoDecision(allComplete);
    expect(decision.productionMigrationApplied).toBe(false);
  });

  test('returns PLAN_HARDENING_COMPLETE_READY_FOR_P23_REVIEW when all complete', () => {
    const decision = buildGoNoGoDecision(allComplete);
    expect(decision.classification).toBe('PLAN_HARDENING_COMPLETE_READY_FOR_P23_REVIEW');
    expect(decision.readyForP23Review).toBe(true);
  });

  test('returns PLAN_REQUIRES_BACKUP_DETAIL when backup incomplete', () => {
    const decision = buildGoNoGoDecision({ ...allComplete, backupComplete: false });
    expect(decision.classification).toBe('PLAN_REQUIRES_BACKUP_DETAIL');
    expect(decision.readyForP23Review).toBe(false);
  });

  test('returns PLAN_REQUIRES_RESTORE_DETAIL when restore incomplete', () => {
    const decision = buildGoNoGoDecision({ ...allComplete, restoreComplete: false });
    expect(decision.classification).toBe('PLAN_REQUIRES_RESTORE_DETAIL');
    expect(decision.readyForP23Review).toBe(false);
  });

  test('returns PLAN_REQUIRES_ROLLBACK_DETAIL when rollback incomplete', () => {
    const decision = buildGoNoGoDecision({ ...allComplete, rollbackComplete: false });
    expect(decision.classification).toBe('PLAN_REQUIRES_ROLLBACK_DETAIL');
    expect(decision.readyForP23Review).toBe(false);
  });

  test('returns PLAN_REQUIRES_MONITORING_DETAIL when monitoring incomplete', () => {
    const decision = buildGoNoGoDecision({ ...allComplete, monitoringComplete: false });
    expect(decision.classification).toBe('PLAN_REQUIRES_MONITORING_DETAIL');
    expect(decision.readyForP23Review).toBe(false);
  });

  test('returns PLAN_REJECTED when safety validation fails', () => {
    const decision = buildGoNoGoDecision({ ...allComplete, safetyValid: false });
    expect(decision.classification).toBe('PLAN_REJECTED');
    expect(decision.readyForP23Review).toBe(false);
  });

  test('recommendedNextToken is the P23 review token', () => {
    const decision = buildGoNoGoDecision(allComplete);
    expect(decision.recommendedNextToken).toBe(P23_REVIEW_TOKEN);
  });

  test('always returns reasons array', () => {
    const decision = buildGoNoGoDecision(allComplete);
    expect(Array.isArray(decision.reasons)).toBe(true);
    expect(decision.reasons.length).toBeGreaterThan(0);
  });

  test('approvalGranted remains false even when all complete', () => {
    const decision = buildGoNoGoDecision(allComplete);
    // The key safety invariant: plan hardening complete ≠ production approval
    expect(decision.approvalGranted).toBe(false);
    expect(decision.productionMigrationApplied).toBe(false);
    expect(decision.readyForP23Review).toBe(true);
  });
});

// ─── scanForbiddenClaims ──────────────────────────────────────────────────────

describe('scanForbiddenClaims', () => {
  test('clean text returns clean=true', () => {
    const result = scanForbiddenClaims('This is a migration plan for MonthlyRevenue schema change.');
    expect(result.clean).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  test('detects ROI (uppercase)', () => {
    const result = scanForbiddenClaims('System achieves 25% ROI per year.');
    expect(result.clean).toBe(false);
    expect(result.findings.some(f => f.label === 'ROI')).toBe(true);
  });

  test('does NOT flag lowercase roi (case-sensitive ROI pattern)', () => {
    const result = scanForbiddenClaims('the roi was discussed');
    expect(result.clean).toBe(true);
  });

  test('detects win-rate', () => {
    const result = scanForbiddenClaims('Strategy has a 90% win-rate across backtests.');
    expect(result.clean).toBe(false);
    expect(result.findings.some(f => f.label === 'win-rate')).toBe(true);
  });

  test('detects outperform', () => {
    const result = scanForbiddenClaims('This strategy will outperform the market.');
    expect(result.clean).toBe(false);
    expect(result.findings.some(f => f.label === 'outperform')).toBe(true);
  });

  test('detects guaranteed', () => {
    const result = scanForbiddenClaims('Results are guaranteed.');
    expect(result.clean).toBe(false);
    expect(result.findings.some(f => f.label === 'guaranteed')).toBe(true);
  });

  test('detects profit', () => {
    const result = scanForbiddenClaims('Maximize your profit.');
    expect(result.clean).toBe(false);
    expect(result.findings.some(f => f.label === 'profit')).toBe(true);
  });

  test('detects investment recommendation', () => {
    const result = scanForbiddenClaims('This is an investment recommendation for the portfolio.');
    expect(result.clean).toBe(false);
    expect(result.findings.some(f => f.label === 'investment recommendation')).toBe(true);
  });

  test('exempts disclaimer lines', () => {
    const result = scanForbiddenClaims('disclaimer: this system does not guarantee ROI or win-rate');
    expect(result.clean).toBe(true);
  });

  test('exempts lines containing "does not compute roi"', () => {
    const result = scanForbiddenClaims('System does not compute ROI or derive profit signals.');
    expect(result.clean).toBe(true);
  });

  test('exempts forbidden claim scanner test definitions', () => {
    const result = scanForbiddenClaims("forbiddenPatterns: [{ pattern: /ROI/g, label: 'ROI' }]");
    expect(result.clean).toBe(true);
  });

  test('exempts alphaScore field references', () => {
    const result = scanForbiddenClaims('alphaScore: 0.72 — not an ROI or profit signal');
    expect(result.clean).toBe(true);
  });

  test('returns line numbers in findings', () => {
    const text = 'clean line\nThis strategy will outperform the index\nclean line';
    const result = scanForbiddenClaims(text);
    expect(result.clean).toBe(false);
    expect(result.findings[0].index).toBe(2);
  });

  test('handles multiline text with multiple violations', () => {
    const text = 'The ROI is 25%\nwin-rate exceeds 80%\noutperform the benchmark';
    const result = scanForbiddenClaims(text);
    expect(result.clean).toBe(false);
    expect(result.findings.length).toBeGreaterThanOrEqual(3);
  });
});
