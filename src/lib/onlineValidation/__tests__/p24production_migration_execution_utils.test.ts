/**
 * P24-HARDRESET: Production Migration Execution Utils — Unit Tests
 *
 * P24 HARD RULES (enforced by all tests):
 *  - approvalGranted = false always
 *  - productionMigrationApplied reflects actual state truthfully
 *  - No ROI / alpha / edge / win-rate / profit / outperform / buy / sell / guaranteed
 *  - No corpus modification
 *  - No scoring formula / alphaScore / recommendationBucket modification
 */

import {
  validateExecutionToken,
  validateProductionTargetConfig,
  buildBackupCommandPlan,
  validateBackupArtifact,
  buildMigrationExecutionPlan,
  validateMigrationExecutionResult,
  buildBackfillExecutionPlan,
  validateBackfillExecutionResult,
  buildRollbackReadinessCheck,
  buildPostMigrationValidationPlan,
  summarizeProductionMigrationExecution,
  scanForbiddenClaims,
  REQUIRED_EXECUTION_TOKEN,
  FORBIDDEN_PATTERNS,
  EXEMPT_LINE_SUBSTRINGS,
} from '../P24ProductionMigrationExecutionUtils';

// ---------------------------------------------------------------------------
// validateExecutionToken
// ---------------------------------------------------------------------------
describe('validateExecutionToken', () => {
  it('rejects null token', () => {
    const result = validateExecutionToken(null);
    expect(result.valid).toBe(false);
    expect(result.token).toBeNull();
    expect(result.reason).toBeTruthy();
  });

  it('rejects undefined token', () => {
    const result = validateExecutionToken(undefined);
    expect(result.valid).toBe(false);
    expect(result.token).toBeNull();
  });

  it('rejects empty string token', () => {
    const result = validateExecutionToken('');
    expect(result.valid).toBe(false);
    expect(result.token).toBeNull();
  });

  it('rejects wrong token', () => {
    const result = validateExecutionToken('WRONG_TOKEN');
    expect(result.valid).toBe(false);
    expect(result.token).toBe('WRONG_TOKEN');
  });

  it('rejects P22 token (different token)', () => {
    const result = validateExecutionToken('P22_APPROVE_PRODUCTION_MIGRATION_PLAN');
    expect(result.valid).toBe(false);
  });

  it('rejects P23 token (not the same as execution token)', () => {
    const result = validateExecutionToken('P22_APPROVE_PRODUCTION_BACKUP_RESTORE_PLAN');
    expect(result.valid).toBe(false);
  });

  it('rejects numeric input', () => {
    const result = validateExecutionToken(12345);
    expect(result.valid).toBe(false);
    expect(result.token).toBeNull();
  });

  it('accepts the correct P24 execution token', () => {
    const result = validateExecutionToken(REQUIRED_EXECUTION_TOKEN);
    expect(result.valid).toBe(true);
    expect(result.token).toBe(REQUIRED_EXECUTION_TOKEN);
    expect(result.reason).toBe('Token verified');
  });

  it('REQUIRED_EXECUTION_TOKEN is the correct string', () => {
    expect(REQUIRED_EXECUTION_TOKEN).toBe('P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY');
  });

  it('returns reason on all paths', () => {
    expect(validateExecutionToken(null).reason).toBeTruthy();
    expect(validateExecutionToken('WRONG').reason).toBeTruthy();
    expect(validateExecutionToken(REQUIRED_EXECUTION_TOKEN).reason).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// validateProductionTargetConfig
// ---------------------------------------------------------------------------
describe('validateProductionTargetConfig', () => {
  const VALID_CONFIG = {
    dbFile: 'prisma/dev.db',
    backupDir: 'prisma',
    migrationSqlPath: 'prisma/migrations/20260512000000_monthly_revenue_release_date_pit_draft/migration.sql',
    dbProvider: 'sqlite' as const,
  };

  it('accepts a valid production target config', () => {
    const result = validateProductionTargetConfig(VALID_CONFIG);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects config without dbFile', () => {
    const result = validateProductionTargetConfig({ ...VALID_CONFIG, dbFile: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('dbFile'))).toBe(true);
  });

  it('rejects config without backupDir', () => {
    const result = validateProductionTargetConfig({ ...VALID_CONFIG, backupDir: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('backupDir'))).toBe(true);
  });

  it('rejects config without migrationSqlPath', () => {
    const result = validateProductionTargetConfig({ ...VALID_CONFIG, migrationSqlPath: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects non-sqlite dbProvider', () => {
    const result = validateProductionTargetConfig({ ...VALID_CONFIG, dbProvider: 'postgresql' as any });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('sqlite'))).toBe(true);
  });

  it('rejects null config', () => {
    const result = validateProductionTargetConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects non-object config', () => {
    const result = validateProductionTargetConfig('string');
    expect(result.valid).toBe(false);
  });

  it('returns dbFile and backupDir when valid', () => {
    const result = validateProductionTargetConfig(VALID_CONFIG);
    expect(result.dbFile).toBe('prisma/dev.db');
    expect(result.backupDir).toBe('prisma');
  });
});

// ---------------------------------------------------------------------------
// buildBackupCommandPlan
// ---------------------------------------------------------------------------
describe('buildBackupCommandPlan', () => {
  const INPUTS = { dbFile: 'prisma/dev.db', backupDir: 'prisma', timestamp: '2026-05-12_1200' };

  it('returns requiredBeforeMigration = true', () => {
    const plan = buildBackupCommandPlan(INPUTS);
    expect(plan.requiredBeforeMigration).toBe(true);
  });

  it('backup path contains timestamp', () => {
    const plan = buildBackupCommandPlan(INPUTS);
    expect(plan.backupPath).toContain('2026-05-12_1200');
  });

  it('checksumCommand references sha256', () => {
    const plan = buildBackupCommandPlan(INPUTS);
    expect(plan.checksumCommand).toContain('256');
  });

  it('strategy is file-copy-with-sha256-checksum', () => {
    const plan = buildBackupCommandPlan(INPUTS);
    expect(plan.strategy).toBe('file-copy-with-sha256-checksum');
  });

  it('preBackupRowCountQuery targets MonthlyRevenue', () => {
    const plan = buildBackupCommandPlan(INPUTS);
    expect(plan.preBackupRowCountQuery).toContain('MonthlyRevenue');
  });

  it('checksumFile is adjacent to backupPath', () => {
    const plan = buildBackupCommandPlan(INPUTS);
    expect(plan.checksumFile).toContain(plan.backupPath);
  });
});

// ---------------------------------------------------------------------------
// validateBackupArtifact
// ---------------------------------------------------------------------------
describe('validateBackupArtifact', () => {
  const VALID_ARTIFACT = {
    backupPath: 'prisma/dev.p24_premigration_backup_2026-05-12.db',
    timestamp: '2026-05-12T12:00:00Z',
    checksum: 'abc123def456abc123def456abc123def456abc123def456abc123def456ab12',
    monthlyRevenueRowCountBefore: 2143,
    schemaSnapshot: '0|stockId|TEXT|0||0\n1|year|INTEGER|0||0',
    productionDbTarget: 'prisma/dev.db',
    backupStatus: 'PASS' as const,
  };

  it('accepts a valid backup artifact', () => {
    const result = validateBackupArtifact(VALID_ARTIFACT);
    expect(result.valid).toBe(true);
    expect(result.backupStatus).toBe('PASS');
  });

  it('rejects missing backupPath', () => {
    const result = validateBackupArtifact({ ...VALID_ARTIFACT, backupPath: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing checksum', () => {
    const result = validateBackupArtifact({ ...VALID_ARTIFACT, checksum: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects negative monthlyRevenueRowCountBefore', () => {
    const result = validateBackupArtifact({ ...VALID_ARTIFACT, monthlyRevenueRowCountBefore: -1 });
    expect(result.valid).toBe(false);
  });

  it('rejects backupStatus FAIL', () => {
    const result = validateBackupArtifact({ ...VALID_ARTIFACT, backupStatus: 'FAIL' as any });
    expect(result.valid).toBe(false);
    expect(result.backupStatus).toBe('FAIL');
  });

  it('rejects missing schemaSnapshot', () => {
    const result = validateBackupArtifact({ ...VALID_ARTIFACT, schemaSnapshot: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing productionDbTarget', () => {
    const result = validateBackupArtifact({ ...VALID_ARTIFACT, productionDbTarget: '' });
    expect(result.valid).toBe(false);
  });

  it('returns errors array with details on failure', () => {
    const result = validateBackupArtifact({ ...VALID_ARTIFACT, backupPath: '', checksum: '' });
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// buildMigrationExecutionPlan
// ---------------------------------------------------------------------------
describe('buildMigrationExecutionPlan', () => {
  const VALID_INPUTS = {
    dbFile: 'prisma/dev.db',
    migrationSqlPath: 'prisma/migrations/20260512000000_monthly_revenue_release_date_pit_draft/migration.sql',
    backupStatus: 'PASS',
  };

  it('migration cannot proceed without backup PASS — throws on FAIL', () => {
    expect(() =>
      buildMigrationExecutionPlan({ ...VALID_INPUTS, backupStatus: 'FAIL' })
    ).toThrow();
  });

  it('migration cannot proceed without backup PASS — throws on NOT_EXECUTED', () => {
    expect(() =>
      buildMigrationExecutionPlan({ ...VALID_INPUTS, backupStatus: 'NOT_EXECUTED' })
    ).toThrow();
  });

  it('migration cannot proceed without backup PASS — throws on empty string', () => {
    expect(() =>
      buildMigrationExecutionPlan({ ...VALID_INPUTS, backupStatus: '' })
    ).toThrow();
  });

  it('returns migration plan when backup PASS', () => {
    const plan = buildMigrationExecutionPlan(VALID_INPUTS);
    expect(plan).toBeDefined();
    expect(plan.requiresBackupPass).toBe(true);
  });

  it('plan adds releaseDate columns', () => {
    const plan = buildMigrationExecutionPlan(VALID_INPUTS);
    expect(plan.addsColumns).toContain('releaseDate');
    expect(plan.addsColumns).toContain('releaseDateSource');
    expect(plan.addsColumns).toContain('releaseDateConfidence');
  });

  it('plan does not drop columns', () => {
    const plan = buildMigrationExecutionPlan(VALID_INPUTS);
    expect(plan.dropsColumns).toHaveLength(0);
  });

  it('plan command is npx prisma migrate deploy', () => {
    const plan = buildMigrationExecutionPlan(VALID_INPUTS);
    expect(plan.command).toContain('prisma migrate deploy');
  });
});

// ---------------------------------------------------------------------------
// validateMigrationExecutionResult
// ---------------------------------------------------------------------------
describe('validateMigrationExecutionResult', () => {
  const VALID_RESULT = {
    executed: true,
    commandUsed: 'npx prisma migrate deploy',
    startedAt: '2026-05-12T12:00:00Z',
    completedAt: '2026-05-12T12:00:05Z',
    schemaAfterMigration: '0|stockId|TEXT',
    migrationStatus: 'PASS' as const,
    error: undefined,
    productionMigrationApplied: true,
  };

  it('accepts a valid migration result', () => {
    const result = validateMigrationExecutionResult(VALID_RESULT);
    expect(result.valid).toBe(true);
  });

  it('rejects missing executed field', () => {
    const result = validateMigrationExecutionResult({ ...VALID_RESULT, executed: undefined as any });
    expect(result.valid).toBe(false);
  });

  it('rejects missing commandUsed', () => {
    const result = validateMigrationExecutionResult({ ...VALID_RESULT, commandUsed: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid migrationStatus', () => {
    const result = validateMigrationExecutionResult({ ...VALID_RESULT, migrationStatus: 'UNKNOWN' as any });
    expect(result.valid).toBe(false);
  });

  it('rejects missing productionMigrationApplied', () => {
    const result = validateMigrationExecutionResult({ ...VALID_RESULT, productionMigrationApplied: undefined as any });
    expect(result.valid).toBe(false);
  });

  it('accepts migrationStatus NOT_EXECUTED as valid enum', () => {
    const result = validateMigrationExecutionResult({
      ...VALID_RESULT, migrationStatus: 'NOT_EXECUTED' as any, executed: false, productionMigrationApplied: false,
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildBackfillExecutionPlan
// ---------------------------------------------------------------------------
describe('buildBackfillExecutionPlan', () => {
  it('backfill cannot proceed without migration PASS — throws on FAIL', () => {
    expect(() =>
      buildBackfillExecutionPlan({ migrationStatus: 'FAIL' })
    ).toThrow();
  });

  it('backfill cannot proceed without migration PASS — throws on NOT_EXECUTED', () => {
    expect(() =>
      buildBackfillExecutionPlan({ migrationStatus: 'NOT_EXECUTED' })
    ).toThrow();
  });

  it('backfill cannot proceed without migration PASS — throws on empty string', () => {
    expect(() =>
      buildBackfillExecutionPlan({ migrationStatus: '' })
    ).toThrow();
  });

  it('returns backfill plan when migration PASS', () => {
    const plan = buildBackfillExecutionPlan({ migrationStatus: 'PASS' });
    expect(plan).toBeDefined();
    expect(plan.requiresMigrationPass).toBe(true);
  });

  it('plan uses INFERRED_NEXT_MONTH_10TH', () => {
    const plan = buildBackfillExecutionPlan({ migrationStatus: 'PASS' });
    expect(plan.releaseDateSource).toBe('INFERRED_NEXT_MONTH_10TH');
  });

  it('plan uses LOW_TO_MEDIUM confidence', () => {
    const plan = buildBackfillExecutionPlan({ migrationStatus: 'PASS' });
    expect(plan.releaseDateConfidence).toBe('LOW_TO_MEDIUM');
  });

  it('plan skipExplicitReleaseDates = true', () => {
    const plan = buildBackfillExecutionPlan({ migrationStatus: 'PASS' });
    expect(plan.skipExplicitReleaseDates).toBe(true);
  });

  it('plan skipInvalidYearMonth = true', () => {
    const plan = buildBackfillExecutionPlan({ migrationStatus: 'PASS' });
    expect(plan.skipInvalidYearMonth).toBe(true);
  });

  it('SQL targets MonthlyRevenue and checks releaseDate IS NULL', () => {
    const plan = buildBackfillExecutionPlan({ migrationStatus: 'PASS' });
    expect(plan.sql).toContain('MonthlyRevenue');
    expect(plan.sql).toContain('releaseDate');
    expect(plan.sql.toUpperCase()).toContain('IS NULL');
  });

  it('SQL handles December overflow (month=12 → next year January)', () => {
    const plan = buildBackfillExecutionPlan({ migrationStatus: 'PASS' });
    expect(plan.sql).toContain('month" = 12');
    expect(plan.sql).toContain("year\" + 1");
  });
});

// ---------------------------------------------------------------------------
// validateBackfillExecutionResult
// ---------------------------------------------------------------------------
describe('validateBackfillExecutionResult', () => {
  const VALID_RESULT = {
    rowsScanned: 2143,
    rowsBackfilled: 2143,
    rowsSkipped: 0,
    invalidRows: 0,
    sampleBackfilledRows: [{ stockId: 'TEST', year: 2020, month: 1, releaseDate: '2020-02-10 00:00:00.000' }],
    releaseDateSourceDistribution: { INFERRED_NEXT_MONTH_10TH: 2143 },
    backfillStatus: 'PASS' as const,
  };

  it('accepts a valid backfill result', () => {
    const result = validateBackfillExecutionResult(VALID_RESULT);
    expect(result.valid).toBe(true);
    expect(result.backfillStatus).toBe('PASS');
  });

  it('rejects missing rowsScanned', () => {
    const result = validateBackfillExecutionResult({ ...VALID_RESULT, rowsScanned: 'not-number' as any });
    expect(result.valid).toBe(false);
  });

  it('rejects missing sampleBackfilledRows', () => {
    const result = validateBackfillExecutionResult({ ...VALID_RESULT, sampleBackfilledRows: null as any });
    expect(result.valid).toBe(false);
  });

  it('rejects missing releaseDateSourceDistribution', () => {
    const result = validateBackfillExecutionResult({ ...VALID_RESULT, releaseDateSourceDistribution: null as any });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid backfillStatus', () => {
    const result = validateBackfillExecutionResult({ ...VALID_RESULT, backfillStatus: 'UNKNOWN' as any });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildRollbackReadinessCheck
// ---------------------------------------------------------------------------
describe('buildRollbackReadinessCheck', () => {
  const ALL_TRUE = {
    backupFileExists: true,
    rollbackSqlExists: true,
    triggersDocumented: true,
    procedureDocumented: true,
    migrationStatusKnown: true,
  };

  it('returns PASS when all inputs true', () => {
    const check = buildRollbackReadinessCheck(ALL_TRUE);
    expect(check.rollbackReadinessStatus).toBe('PASS');
  });

  it('returns FAIL when backupFileExists is false', () => {
    const check = buildRollbackReadinessCheck({ ...ALL_TRUE, backupFileExists: false });
    expect(check.rollbackReadinessStatus).toBe('FAIL');
  });

  it('returns FAIL when rollbackSqlExists is false', () => {
    const check = buildRollbackReadinessCheck({ ...ALL_TRUE, rollbackSqlExists: false });
    expect(check.rollbackReadinessStatus).toBe('FAIL');
  });

  it('returns FAIL when triggersDocumented is false', () => {
    const check = buildRollbackReadinessCheck({ ...ALL_TRUE, triggersDocumented: false });
    expect(check.rollbackReadinessStatus).toBe('FAIL');
  });

  it('returns FAIL when procedureDocumented is false', () => {
    const check = buildRollbackReadinessCheck({ ...ALL_TRUE, procedureDocumented: false });
    expect(check.rollbackReadinessStatus).toBe('FAIL');
  });

  it('returns FAIL when migrationStatusKnown is false', () => {
    const check = buildRollbackReadinessCheck({ ...ALL_TRUE, migrationStatusKnown: false });
    expect(check.rollbackReadinessStatus).toBe('FAIL');
  });

  it('backupFileAccessible mirrors backupFileExists', () => {
    const checkTrue = buildRollbackReadinessCheck(ALL_TRUE);
    const checkFalse = buildRollbackReadinessCheck({ ...ALL_TRUE, backupFileExists: false });
    expect(checkTrue.backupFileAccessible).toBe(true);
    expect(checkFalse.backupFileAccessible).toBe(false);
  });

  it('rollbackSqlPath references the migration file', () => {
    const check = buildRollbackReadinessCheck(ALL_TRUE);
    expect(check.rollbackSqlPath).toContain('migration.sql');
    expect(check.rollbackSqlPath).toContain('monthly_revenue_release_date');
  });
});

// ---------------------------------------------------------------------------
// buildPostMigrationValidationPlan
// ---------------------------------------------------------------------------
describe('buildPostMigrationValidationPlan', () => {
  it('post-migration validation required — throws when rollback readiness is not PASS', () => {
    expect(() =>
      buildPostMigrationValidationPlan({ rollbackReadinessStatus: 'FAIL' })
    ).toThrow();
  });

  it('post-migration validation required — throws when rollback readiness is UNKNOWN', () => {
    expect(() =>
      buildPostMigrationValidationPlan({ rollbackReadinessStatus: 'UNKNOWN' })
    ).toThrow();
  });

  it('post-migration validation required — throws on empty string', () => {
    expect(() =>
      buildPostMigrationValidationPlan({ rollbackReadinessStatus: '' })
    ).toThrow();
  });

  it('returns plan when rollback readiness is PASS', () => {
    const plan = buildPostMigrationValidationPlan({ rollbackReadinessStatus: 'PASS' });
    expect(plan).toBeDefined();
    expect(plan.requiresRollbackReadiness).toBe(true);
    expect(plan.rollbackReadinessRequired).toBe(true);
  });

  it('plan includes all 13 MON items', () => {
    const plan = buildPostMigrationValidationPlan({ rollbackReadinessStatus: 'PASS' });
    expect(plan.monitoringItemIds).toHaveLength(13);
    expect(plan.monitoringItemIds).toContain('MON-01');
    expect(plan.monitoringItemIds).toContain('MON-13');
  });

  it('plan checks contain MON-08 query gate', () => {
    const plan = buildPostMigrationValidationPlan({ rollbackReadinessStatus: 'PASS' });
    const hasQueryGate = plan.checks.some(c => c.includes('MON-08') || c.toLowerCase().includes('query gate'));
    expect(hasQueryGate).toBe(true);
  });

  it('plan checks contain MON-13 no-leakage', () => {
    const plan = buildPostMigrationValidationPlan({ rollbackReadinessStatus: 'PASS' });
    const hasLeakage = plan.checks.some(c => c.includes('MON-13') || c.toLowerCase().includes('leakage'));
    expect(hasLeakage).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// summarizeProductionMigrationExecution
// ---------------------------------------------------------------------------
describe('summarizeProductionMigrationExecution', () => {
  const FULL_PASS = {
    tokenStatus: 'VERIFIED' as const,
    backupStatus: 'PASS' as const,
    migrationStatus: 'PASS' as const,
    backfillStatus: 'PASS' as const,
    validationStatus: 'PASS' as const,
    rollbackReadinessStatus: 'PASS' as const,
    productionMigrationApplied: true,
  };

  it('returns P24_PRODUCTION_MIGRATION_EXECUTION_COMPLETE when all pass', () => {
    const summary = summarizeProductionMigrationExecution(FULL_PASS);
    expect(summary.classification).toBe('P24_PRODUCTION_MIGRATION_EXECUTION_COMPLETE');
  });

  it('returns BLOCKED_MISSING_EXECUTION_TOKEN when token not verified', () => {
    const summary = summarizeProductionMigrationExecution({ ...FULL_PASS, tokenStatus: 'MISSING' });
    expect(summary.classification).toBe('P24_PRODUCTION_MIGRATION_BLOCKED_MISSING_EXECUTION_TOKEN');
  });

  it('returns BLOCKED_BY_BACKUP_FAILURE when backup fails', () => {
    const summary = summarizeProductionMigrationExecution({ ...FULL_PASS, backupStatus: 'FAIL' });
    expect(summary.classification).toBe('P24_PRODUCTION_MIGRATION_BLOCKED_BY_BACKUP_FAILURE');
  });

  it('returns P24_PRODUCTION_MIGRATION_FAILED when migration fails', () => {
    const summary = summarizeProductionMigrationExecution({
      ...FULL_PASS, migrationStatus: 'FAIL', productionMigrationApplied: false,
    });
    expect(summary.classification).toBe('P24_PRODUCTION_MIGRATION_FAILED');
  });

  it('returns P24_PRODUCTION_BACKFILL_FAILED when backfill fails', () => {
    const summary = summarizeProductionMigrationExecution({ ...FULL_PASS, backfillStatus: 'FAIL' });
    expect(summary.classification).toBe('P24_PRODUCTION_BACKFILL_FAILED');
  });

  it('returns P24_PRODUCTION_VALIDATION_FAILED when validation fails', () => {
    const summary = summarizeProductionMigrationExecution({ ...FULL_PASS, validationStatus: 'FAIL' });
    expect(summary.classification).toBe('P24_PRODUCTION_VALIDATION_FAILED');
  });

  it('returns P24_PRODUCTION_ROLLBACK_REQUIRED when rollback readiness fails', () => {
    const summary = summarizeProductionMigrationExecution({
      ...FULL_PASS, rollbackReadinessStatus: 'FAIL',
    });
    expect(summary.classification).toBe('P24_PRODUCTION_ROLLBACK_REQUIRED');
  });

  it('phase is always P24-HARDRESET', () => {
    const summary = summarizeProductionMigrationExecution(FULL_PASS);
    expect(summary.phase).toBe('P24-HARDRESET');
  });

  it('summary includes disclaimer (investment advice disclaimer)', () => {
    const summary = summarizeProductionMigrationExecution(FULL_PASS);
    expect(summary.disclaimer).toBeTruthy();
    // Disclaimer should explicitly disclaim investment advice
    expect(summary.disclaimer.toLowerCase()).toContain('investment');
  });

  it('productionMigrationApplied is carried truthfully from input', () => {
    const trueCase = summarizeProductionMigrationExecution(FULL_PASS);
    const falseCase = summarizeProductionMigrationExecution({ ...FULL_PASS, productionMigrationApplied: false });
    expect(trueCase.productionMigrationApplied).toBe(true);
    expect(falseCase.productionMigrationApplied).toBe(false);
  });

  it('generatedAt is a valid ISO string', () => {
    const summary = summarizeProductionMigrationExecution(FULL_PASS);
    expect(new Date(summary.generatedAt).getTime()).not.toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// scanForbiddenClaims
// ---------------------------------------------------------------------------
describe('scanForbiddenClaims', () => {
  it('is clean for empty string', () => {
    const result = scanForbiddenClaims('');
    expect(result.clean).toBe(true);
    expect(result.violationCount).toBe(0);
  });

  it('catches ROI claim', () => {
    const result = scanForbiddenClaims('This strategy has an ROI of 50%');
    expect(result.clean).toBe(false);
    expect(result.violationCount).toBeGreaterThan(0);
  });

  it('catches alpha claim (not alphaScore)', () => {
    const result = scanForbiddenClaims('The alpha is positive');
    expect(result.clean).toBe(false);
  });

  it('does NOT flag alphaScore (exempt)', () => {
    const result = scanForbiddenClaims('alphaScore: 0.75');
    expect(result.clean).toBe(true);
  });

  it('catches profit claim', () => {
    const result = scanForbiddenClaims('This generates profit of 20%');
    expect(result.clean).toBe(false);
  });

  it('catches edge claim', () => {
    const result = scanForbiddenClaims('This gives you an edge over the market');
    expect(result.clean).toBe(false);
  });

  it('catches outperform claim', () => {
    const result = scanForbiddenClaims('This will outperform the benchmark');
    expect(result.clean).toBe(false);
  });

  it('catches buy claim', () => {
    const result = scanForbiddenClaims('You should buy this stock');
    expect(result.clean).toBe(false);
  });

  it('catches sell claim', () => {
    const result = scanForbiddenClaims('Signal: sell immediately');
    expect(result.clean).toBe(false);
  });

  it('catches guaranteed claim', () => {
    const result = scanForbiddenClaims('Returns are guaranteed');
    expect(result.clean).toBe(false);
  });

  it('catches win-rate claim', () => {
    const result = scanForbiddenClaims('The win-rate is 75%');
    expect(result.clean).toBe(false);
  });

  it('does NOT flag disclaimer lines', () => {
    const result = scanForbiddenClaims('DISCLAIMER: Does not compute ROI or win-rate');
    expect(result.clean).toBe(true);
  });

  it('violations include lineNumber, lineContent, and pattern', () => {
    const result = scanForbiddenClaims('ROI is high');
    expect(result.violations[0]).toHaveProperty('lineNumber');
    expect(result.violations[0]).toHaveProperty('lineContent');
    expect(result.violations[0]).toHaveProperty('pattern');
  });

  it('FORBIDDEN_PATTERNS is an array of RegExp', () => {
    expect(Array.isArray(FORBIDDEN_PATTERNS)).toBe(true);
    FORBIDDEN_PATTERNS.forEach(p => expect(p).toBeInstanceOf(RegExp));
  });

  it('EXEMPT_LINE_SUBSTRINGS is an array of strings', () => {
    expect(Array.isArray(EXEMPT_LINE_SUBSTRINGS)).toBe(true);
    EXEMPT_LINE_SUBSTRINGS.forEach(s => expect(typeof s).toBe('string'));
  });

  it('no Math.random usage — utility functions are deterministic', () => {
    // Run scanForbiddenClaims twice and expect same result
    const text = 'alpha edge profit';
    const r1 = scanForbiddenClaims(text);
    const r2 = scanForbiddenClaims(text);
    expect(r1.violationCount).toBe(r2.violationCount);
    expect(r1.clean).toBe(r2.clean);
  });
});

// ---------------------------------------------------------------------------
// Hard rules: approvalGranted = false, no corpus modification
// ---------------------------------------------------------------------------
describe('Hard rules enforcement', () => {
  it('REQUIRED_EXECUTION_TOKEN does not equal approvalGranted=true pattern', () => {
    expect(REQUIRED_EXECUTION_TOKEN).not.toContain('approved=true');
    expect(REQUIRED_EXECUTION_TOKEN).not.toContain('APPROVED_TRUE');
  });

  it('buildBackfillExecutionPlan SQL does not touch scoring formula', () => {
    const plan = buildBackfillExecutionPlan({ migrationStatus: 'PASS' });
    const sql = plan.sql.toLowerCase();
    expect(sql).not.toContain('alphascore');
    expect(sql).not.toContain('recommendationbucket');
    expect(sql).not.toContain('scoringformula');
  });

  it('buildBackfillExecutionPlan SQL only touches MonthlyRevenue releaseDate fields', () => {
    const plan = buildBackfillExecutionPlan({ migrationStatus: 'PASS' });
    const sql = plan.sql.toUpperCase();
    expect(sql).toContain('UPDATE "MONTHLYREVENUE"');
    // Ensure it's NOT touching p0/p1/p3/p19 corpus tables
    expect(sql).not.toContain('P0');
    expect(sql).not.toContain('P1BASELINE');
    expect(sql).not.toContain('P3ACTIVE');
    expect(sql).not.toContain('P19');
  });

  it('buildMigrationExecutionPlan does not set approvalGranted', () => {
    const plan = buildMigrationExecutionPlan({
      dbFile: 'prisma/dev.db',
      migrationSqlPath: 'prisma/migrations/test/migration.sql',
      backupStatus: 'PASS',
    });
    expect((plan as any).approvalGranted).toBeUndefined();
  });

  it('summarizeProductionMigrationExecution does not set approvalGranted', () => {
    const summary = summarizeProductionMigrationExecution({
      tokenStatus: 'VERIFIED',
      backupStatus: 'PASS',
      migrationStatus: 'PASS',
      backfillStatus: 'PASS',
      validationStatus: 'PASS',
      rollbackReadinessStatus: 'PASS',
      productionMigrationApplied: true,
    });
    expect((summary as any).approvalGranted).toBeUndefined();
  });

  it('utilities are pure — no I/O side effects', () => {
    // validateExecutionToken, buildMigrationExecutionPlan etc. do not read files
    // This test verifies they return without throwing when called in isolation
    expect(() => validateExecutionToken(null)).not.toThrow();
    expect(() => validateProductionTargetConfig({})).not.toThrow();
    expect(() => validateBackupArtifact({})).not.toThrow();
  });
});
