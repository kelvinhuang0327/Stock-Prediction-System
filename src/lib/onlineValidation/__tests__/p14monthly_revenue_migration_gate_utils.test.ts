/**
 * P14-HARDRESET PART F: Tests for P14MonthlyRevenueMigrationGateUtils
 *
 * Covers:
 * - detectApprovalToken
 * - validateMigrationApprovalScope
 * - buildMonthlyRevenueMigrationDraft (releaseDate / source / confidence fields, productionApplyAllowed=false)
 * - buildMonthlyRevenueRollbackDraft (exists, productionApplyAllowed=false)
 * - validateMigrationDraftSafety (catches production apply attempt)
 * - buildMonthlyRevenueQueryGateContract
 * - validateMonthlyRevenueQueryGate (explicit before/equal/after, inferred allowed/disallowed, invalid, forbidden fields)
 * - scanForbiddenClaims (ROI / alpha / edge / profit / outperform / buy / sell / guaranteed)
 * - summarizeMigrationReadiness
 *
 * Does NOT use Math.random.
 * Does NOT modify P0/P1/P3/P4 corpus.
 *
 * Disclaimer: Tests do not constitute investment advice.
 */

import {
  detectApprovalToken,
  validateMigrationApprovalScope,
  buildMonthlyRevenueMigrationDraft,
  buildMonthlyRevenueRollbackDraft,
  validateMigrationDraftSafety,
  buildMonthlyRevenueQueryGateContract,
  validateMonthlyRevenueQueryGate,
  summarizeMigrationReadiness,
  scanForbiddenClaims,
  EXPECTED_APPROVAL_TOKEN,
  type ApprovalStatus,
} from '../P14MonthlyRevenueMigrationGateUtils';

// ── detectApprovalToken ───────────────────────────────────────────────────────

describe('detectApprovalToken', () => {
  it('returns NOT_APPROVED when input is empty string', () => {
    const r = detectApprovalToken('');
    expect(r.tokenPresent).toBe(false);
    expect(r.approvalStatus).toBe('NOT_APPROVED');
    expect(r.allowsDryRunArtifacts).toBe(true);
    expect(r.allowsProductionApply).toBe(false);
  });

  it('returns NOT_APPROVED when input has no token', () => {
    const r = detectApprovalToken('some random text without the magic word');
    expect(r.tokenPresent).toBe(false);
    expect(r.approvalStatus).toBe('NOT_APPROVED');
  });

  it('returns APPROVED_DRY_RUN_ONLY when exact token is present', () => {
    const r = detectApprovalToken(`prefix ${EXPECTED_APPROVAL_TOKEN} suffix`);
    expect(r.tokenPresent).toBe(true);
    expect(r.approvalStatus).toBe('APPROVED_DRY_RUN_ONLY');
    expect(r.allowsDryRunArtifacts).toBe(true);
    expect(r.allowsProductionApply).toBe(false);
  });

  it('still disallows production apply even with approval token', () => {
    const r = detectApprovalToken(EXPECTED_APPROVAL_TOKEN);
    expect(r.allowsProductionApply).toBe(false);
  });

  it('returns NOT_APPROVED for partial token match', () => {
    const r = detectApprovalToken('P14_APPROVE_SCHEMA_MIGRATION'); // truncated
    expect(r.tokenPresent).toBe(false);
    expect(r.approvalStatus).toBe('NOT_APPROVED');
  });
});

// ── validateMigrationApprovalScope ──────────────────────────────────────────

describe('validateMigrationApprovalScope', () => {
  it('NOT_APPROVED scope blocks productionDb and corpus, allows draft', () => {
    const scope = validateMigrationApprovalScope('NOT_APPROVED');
    expect(scope.canModifyProductionDb).toBe(false);
    expect(scope.canModifyCorpus).toBe(false);
    expect(scope.canModifyScoringFormulas).toBe(false);
    expect(scope.canProduceMigrationDraft).toBe(true);
    expect(scope.canProduceRollbackDraft).toBe(true);
  });

  it('APPROVED_DRY_RUN_ONLY scope still blocks productionDb and corpus', () => {
    const scope = validateMigrationApprovalScope('APPROVED_DRY_RUN_ONLY');
    expect(scope.canModifyProductionDb).toBe(false);
    expect(scope.canModifyCorpus).toBe(false);
    expect(scope.canModifyScoringFormulas).toBe(false);
  });

  it('APPROVED_DRY_RUN_ONLY scope allows Prisma draft (non-production)', () => {
    const scope = validateMigrationApprovalScope('APPROVED_DRY_RUN_ONLY');
    expect(scope.canModifyPrismaProductionSchema).toBe(true);
  });

  it('NOT_APPROVED scope does not allow Prisma schema edit', () => {
    const scope = validateMigrationApprovalScope('NOT_APPROVED');
    expect(scope.canModifyPrismaProductionSchema).toBe(false);
  });
});

// ── buildMonthlyRevenueMigrationDraft ─────────────────────────────────────────

describe('buildMonthlyRevenueMigrationDraft', () => {
  const draft = buildMonthlyRevenueMigrationDraft();

  it('has draftId starting with p14', () => {
    expect(draft.draftId).toMatch(/^p14/);
  });

  it('productionApplyAllowed is false', () => {
    expect(draft.productionApplyAllowed).toBe(false);
  });

  it('proposedSchemaChange includes releaseDate field', () => {
    const fieldNames = draft.proposedSchemaChange.fieldsToAdd.map((f) => f.name);
    expect(fieldNames).toContain('releaseDate');
  });

  it('proposedSchemaChange includes releaseDateSource field', () => {
    const fieldNames = draft.proposedSchemaChange.fieldsToAdd.map((f) => f.name);
    expect(fieldNames).toContain('releaseDateSource');
  });

  it('proposedSchemaChange includes releaseDateConfidence field', () => {
    const fieldNames = draft.proposedSchemaChange.fieldsToAdd.map((f) => f.name);
    expect(fieldNames).toContain('releaseDateConfidence');
  });

  it('backfill rule uses INFERRED_NEXT_MONTH_10TH label', () => {
    expect(draft.backfillRule.sourceLabel).toBe('INFERRED_NEXT_MONTH_10TH');
  });

  it('backfill rule forbiddenInputs includes outcome fields', () => {
    expect(draft.backfillRule.forbiddenInputs).toContain('returnPct');
    expect(draft.backfillRule.forbiddenInputs).toContain('realizedReturnClass');
    expect(draft.backfillRule.forbiddenInputs).toContain('outcomePrice');
  });

  it('backfillSqlDraft exists and is non-empty', () => {
    expect(typeof draft.backfillSqlDraft).toBe('string');
    expect(draft.backfillSqlDraft.length).toBeGreaterThan(10);
  });

  it('rollbackDraftReference is set', () => {
    expect(draft.rollbackDraftReference).toBeTruthy();
  });

  it('validationRequirements is non-empty array', () => {
    expect(Array.isArray(draft.validationRequirements)).toBe(true);
    expect(draft.validationRequirements.length).toBeGreaterThan(0);
  });

  it('productionApplyAllowed cannot be overridden to true at type level', () => {
    // TypeScript enforces this; here we just confirm runtime value
    const val: false = draft.productionApplyAllowed;
    expect(val).toBe(false);
  });
});

// ── buildMonthlyRevenueRollbackDraft ─────────────────────────────────────────

describe('buildMonthlyRevenueRollbackDraft', () => {
  const rollback = buildMonthlyRevenueRollbackDraft();

  it('exists and has rollbackId', () => {
    expect(rollback.rollbackId).toBeTruthy();
  });

  it('productionApplyAllowed is false', () => {
    expect(rollback.productionApplyAllowed).toBe(false);
  });

  it('has rollbackStrategyA', () => {
    expect(rollback.rollbackStrategyA).toBeDefined();
    expect(rollback.rollbackStrategyA.description).toBeTruthy();
    expect(rollback.rollbackStrategyA.sqlSnippet).toBeTruthy();
  });

  it('has rollbackStrategyB', () => {
    expect(rollback.rollbackStrategyB).toBeDefined();
    expect(rollback.rollbackStrategyB.description).toBeTruthy();
    expect(rollback.rollbackStrategyB.sqlSnippet).toBeTruthy();
  });

  it('safetyNote is present', () => {
    expect(rollback.safetyNote).toBeTruthy();
  });
});

// ── validateMigrationDraftSafety ─────────────────────────────────────────────

describe('validateMigrationDraftSafety', () => {
  it('valid draft passes safety check', () => {
    const draft = buildMonthlyRevenueMigrationDraft();
    const result = validateMigrationDraftSafety(draft);
    expect(result.safe).toBe(true);
    expect(result.status).toBe('SAFE_DRY_RUN_ONLY');
    expect(result.errors).toHaveLength(0);
  });

  it('draft with productionApplyAllowed=true fails safety check', () => {
    const draft = buildMonthlyRevenueMigrationDraft();
    // Force unsafe override (TypeScript won't allow this normally, but we simulate)
    const unsafe = { ...draft, productionApplyAllowed: true as unknown as false };
    const result = validateMigrationDraftSafety(unsafe);
    expect(result.safe).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('draft missing proposedSchemaChange fails safety check', () => {
    const draft = buildMonthlyRevenueMigrationDraft();
    const incomplete = { ...draft, proposedSchemaChange: undefined as unknown as typeof draft.proposedSchemaChange };
    const result = validateMigrationDraftSafety(incomplete);
    expect(result.safe).toBe(false);
    expect(result.errors.some(e => e.includes('proposedSchemaChange'))).toBe(true);
  });

  it('draft missing releaseDate field in schema fails safety check', () => {
    const draft = buildMonthlyRevenueMigrationDraft();
    const modified = {
      ...draft,
      proposedSchemaChange: {
        ...draft.proposedSchemaChange,
        fieldsToAdd: draft.proposedSchemaChange.fieldsToAdd.filter(f => f.name !== 'releaseDate'),
      },
    };
    const result = validateMigrationDraftSafety(modified);
    expect(result.safe).toBe(false);
    expect(result.errors.some(e => e.includes('releaseDate'))).toBe(true);
  });
});

// ── buildMonthlyRevenueQueryGateContract ─────────────────────────────────────

describe('buildMonthlyRevenueQueryGateContract', () => {
  it('returns contract with rules array', () => {
    const contract = buildMonthlyRevenueQueryGateContract();
    expect(contract.rules).toBeDefined();
    expect(contract.rules.length).toBeGreaterThan(0);
  });

  it('productionApplyAllowed is false', () => {
    const contract = buildMonthlyRevenueQueryGateContract();
    expect(contract.productionApplyAllowed).toBe(false);
  });

  it('default allowInferredReleaseDate is true', () => {
    const contract = buildMonthlyRevenueQueryGateContract();
    expect(contract.allowInferredReleaseDate).toBe(true);
  });

  it('allowInferredReleaseDate=false respected', () => {
    const contract = buildMonthlyRevenueQueryGateContract({ allowInferredReleaseDate: false });
    expect(contract.allowInferredReleaseDate).toBe(false);
  });

  it('contract has contractId', () => {
    const contract = buildMonthlyRevenueQueryGateContract();
    expect(contract.contractId).toMatch(/^p14/);
  });
});

// ── validateMonthlyRevenueQueryGate ──────────────────────────────────────────

describe('validateMonthlyRevenueQueryGate — explicit releaseDate', () => {
  it('explicit releaseDate before asOfDate → unavailable', () => {
    const r = validateMonthlyRevenueQueryGate(
      { year: 2024, month: 1, releaseDate: '2024-02-10' },
      '2024-02-09'
    );
    expect(r.available).toBe(false);
    expect(r.releaseDateSource).toBe('AUTHORITATIVE');
    expect(r.gateResult).toBe('UNAVAILABLE_RELEASE_DATE_FUTURE');
  });

  it('explicit releaseDate equal to asOfDate → available', () => {
    const r = validateMonthlyRevenueQueryGate(
      { year: 2024, month: 1, releaseDate: '2024-02-10' },
      '2024-02-10'
    );
    expect(r.available).toBe(true);
    expect(r.releaseDateSource).toBe('AUTHORITATIVE');
    expect(r.gateResult).toBe('AVAILABLE');
  });

  it('explicit releaseDate after asOfDate → available', () => {
    const r = validateMonthlyRevenueQueryGate(
      { year: 2024, month: 1, releaseDate: '2024-02-05' },
      '2024-02-10'
    );
    expect(r.available).toBe(true);
    expect(r.releaseDateSource).toBe('AUTHORITATIVE');
    expect(r.confidence).toBe('HIGH');
  });
});

describe('validateMonthlyRevenueQueryGate — inferred releaseDate', () => {
  it('inferred releaseDate allowed, inferred <= asOfDate → available', () => {
    const r = validateMonthlyRevenueQueryGate(
      { year: 2024, month: 1 },
      '2024-02-10',
      { allowInferredReleaseDate: true }
    );
    expect(r.available).toBe(true);
    expect(r.releaseDateSource).toBe('INFERRED_NEXT_MONTH_10TH');
    expect(r.confidence).toBe('LOW_TO_MEDIUM');
    expect(r.releaseDateUsed).toBe('2024-02-10');
  });

  it('inferred releaseDate allowed, inferred > asOfDate → unavailable', () => {
    const r = validateMonthlyRevenueQueryGate(
      { year: 2024, month: 1 },
      '2024-02-09',
      { allowInferredReleaseDate: true }
    );
    expect(r.available).toBe(false);
    expect(r.releaseDateSource).toBe('INFERRED_NEXT_MONTH_10TH');
    expect(r.releaseDateUsed).toBe('2024-02-10');
  });

  it('inferred releaseDate disallowed → unavailable (UNAVAILABLE_INFERRED_NOT_ALLOWED)', () => {
    const r = validateMonthlyRevenueQueryGate(
      { year: 2024, month: 1 },
      '2024-02-15',
      { allowInferredReleaseDate: false }
    );
    expect(r.available).toBe(false);
    expect(r.gateResult).toBe('UNAVAILABLE_INFERRED_NOT_ALLOWED');
    expect(r.releaseDateSource).toBe('MISSING');
  });

  it('December inferred → January of next year, day 10', () => {
    const r = validateMonthlyRevenueQueryGate(
      { year: 2024, month: 12 },
      '2025-01-10',
      { allowInferredReleaseDate: true }
    );
    expect(r.available).toBe(true);
    expect(r.releaseDateUsed).toBe('2025-01-10');
    expect(r.releaseDateSource).toBe('INFERRED_NEXT_MONTH_10TH');
  });

  it('December, asOf before Jan 10 → unavailable', () => {
    const r = validateMonthlyRevenueQueryGate(
      { year: 2024, month: 12 },
      '2025-01-09',
      { allowInferredReleaseDate: true }
    );
    expect(r.available).toBe(false);
    expect(r.releaseDateUsed).toBe('2025-01-10');
  });
});

describe('validateMonthlyRevenueQueryGate — invalid / missing', () => {
  it('invalid releaseDate format → unavailable', () => {
    const r = validateMonthlyRevenueQueryGate(
      { year: 2024, month: 1, releaseDate: 'not-a-date' },
      '2024-02-10'
    );
    expect(r.available).toBe(false);
    expect(r.releaseDateSource).toBe('INVALID');
    expect(r.gateResult).toBe('UNAVAILABLE_INVALID_RELEASE_DATE');
  });

  it('missing year → unavailable (UNAVAILABLE_MISSING_PERIOD)', () => {
    const r = validateMonthlyRevenueQueryGate({ month: 1 }, '2024-02-10');
    expect(r.available).toBe(false);
    expect(r.gateResult).toBe('UNAVAILABLE_MISSING_PERIOD');
  });

  it('missing month → unavailable (UNAVAILABLE_MISSING_PERIOD)', () => {
    const r = validateMonthlyRevenueQueryGate({ year: 2024 }, '2024-02-10');
    expect(r.available).toBe(false);
    expect(r.gateResult).toBe('UNAVAILABLE_MISSING_PERIOD');
  });

  it('invalid asOfDate → unavailable', () => {
    const r = validateMonthlyRevenueQueryGate(
      { year: 2024, month: 1 },
      'bad-date'
    );
    expect(r.available).toBe(false);
  });

  it('forbidden outcome fields are flagged but do not block availability check', () => {
    const r = validateMonthlyRevenueQueryGate(
      { year: 2024, month: 1, releaseDate: '2024-02-10', outcomePrice: 150, returnPct: 0.05, realizedReturnClass: 'GAIN' },
      '2024-02-10'
    );
    expect(r.available).toBe(true); // gate still works
    expect(r.forbiddenOutcomeFieldsPresent).toContain('outcomePrice');
    expect(r.forbiddenOutcomeFieldsPresent).toContain('returnPct');
    expect(r.forbiddenOutcomeFieldsPresent).toContain('realizedReturnClass');
  });
});

// ── scanForbiddenClaims ───────────────────────────────────────────────────────

describe('scanForbiddenClaims', () => {
  it('catches ROI claim', () => {
    const hits = scanForbiddenClaims('Expected ROI is 25% per year.');
    expect(hits.some(h => h.label === 'ROI')).toBe(true);
  });

  it('catches win-rate claim', () => {
    const hits = scanForbiddenClaims('The win-rate is 70%.');
    expect(hits.some(h => h.label === 'win-rate')).toBe(true);
  });

  it('catches profit claim', () => {
    const hits = scanForbiddenClaims('Generates significant profit from momentum.');
    expect(hits.some(h => h.label === 'profit')).toBe(true);
  });

  it('catches outperform claim', () => {
    const hits = scanForbiddenClaims('This will outperform the market.');
    expect(hits.some(h => h.label === 'outperform')).toBe(true);
  });

  it('catches guaranteed claim', () => {
    const hits = scanForbiddenClaims('Guaranteed returns of 15%.');
    expect(hits.some(h => h.label === 'guaranteed')).toBe(true);
  });

  it('catches buy/sell claim', () => {
    const hits = scanForbiddenClaims('System will tell you when to buy or sell.');
    expect(hits.some(h => h.label === 'buy/sell')).toBe(true);
  });

  it('catches alpha claim', () => {
    const hits = scanForbiddenClaims('Provides significant alpha generation.');
    expect(hits.some(h => h.label === 'alpha')).toBe(true);
  });

  it('catches edge claim', () => {
    const hits = scanForbiddenClaims('Gives you a trading edge over others.');
    expect(hits.some(h => h.label === 'edge')).toBe(true);
  });

  it('skips disclaimer lines', () => {
    const hits = scanForbiddenClaims('disclaimer: this does not guarantee ROI or profit.');
    expect(hits).toHaveLength(0);
  });

  it('skips does-not lines', () => {
    const hits = scanForbiddenClaims('does not compute ROI or provide win-rate guarantees.');
    expect(hits).toHaveLength(0);
  });

  it('skips alphaScore context for alpha label', () => {
    const hits = scanForbiddenClaims('alphaScore is computed from technical factors.');
    const alphaHits = hits.filter(h => h.label === 'alpha');
    expect(alphaHits).toHaveLength(0);
  });

  it('skips knowledge/hedge context for edge label', () => {
    const hits = scanForbiddenClaims('knowledge edge in the dataset is documented.');
    const edgeHits = hits.filter(h => h.label === 'edge');
    expect(edgeHits).toHaveLength(0);
  });

  it('returns empty array for clean text', () => {
    const hits = scanForbiddenClaims('This module computes release date from year and month only.');
    expect(hits).toHaveLength(0);
  });

  it('returns multiple hits for text with multiple violations', () => {
    const hits = scanForbiddenClaims('ROI is 20% and win-rate is 80% — buy now!');
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
});

// ── summarizeMigrationReadiness ───────────────────────────────────────────────

describe('summarizeMigrationReadiness', () => {
  it('all ready with no approval → AWAITING_SCHEMA_MIGRATION_APPROVAL', () => {
    const summary = summarizeMigrationReadiness({
      approvalTokenPresent: false,
      p13ArtifactsPresent: true,
      migrationDraftReady: true,
      rollbackDraftReady: true,
      queryGateContractReady: true,
      fixtureValidationReady: true,
    });
    expect(summary.finalClassification).toBe('P14_MONTHLY_REVENUE_AWAITING_SCHEMA_MIGRATION_APPROVAL');
    expect(summary.productionApplyAllowed).toBe(false);
  });

  it('all ready with approval token → MIGRATION_DRY_RUN_COMPLETE', () => {
    const summary = summarizeMigrationReadiness({
      approvalTokenPresent: true,
      p13ArtifactsPresent: true,
      migrationDraftReady: true,
      rollbackDraftReady: true,
      queryGateContractReady: true,
      fixtureValidationReady: true,
    });
    expect(summary.finalClassification).toBe('P14_MONTHLY_REVENUE_MIGRATION_DRY_RUN_COMPLETE');
    expect(summary.productionApplyAllowed).toBe(false);
  });

  it('missing P13 artifacts → BLOCKED_BY_ARTIFACTS', () => {
    const summary = summarizeMigrationReadiness({
      approvalTokenPresent: false,
      p13ArtifactsPresent: false,
      migrationDraftReady: true,
      rollbackDraftReady: true,
      queryGateContractReady: true,
      fixtureValidationReady: true,
    });
    expect(summary.finalClassification).toBe('P14_MONTHLY_REVENUE_BLOCKED_BY_ARTIFACTS');
  });

  it('fixture validation not ready → REQUIRES_QUERY_GATE_CODE_TRACE', () => {
    const summary = summarizeMigrationReadiness({
      approvalTokenPresent: false,
      p13ArtifactsPresent: true,
      migrationDraftReady: true,
      rollbackDraftReady: true,
      queryGateContractReady: true,
      fixtureValidationReady: false,
    });
    expect(summary.finalClassification).toBe('P14_MONTHLY_REVENUE_REQUIRES_QUERY_GATE_CODE_TRACE');
  });

  it('productionApplyAllowed is always false regardless of inputs', () => {
    const summary = summarizeMigrationReadiness({
      approvalTokenPresent: true,
      p13ArtifactsPresent: true,
      migrationDraftReady: true,
      rollbackDraftReady: true,
      queryGateContractReady: true,
      fixtureValidationReady: true,
    });
    expect(summary.productionApplyAllowed).toBe(false);
  });

  it('nextSteps is non-empty array', () => {
    const summary = summarizeMigrationReadiness({
      approvalTokenPresent: false,
      p13ArtifactsPresent: true,
      migrationDraftReady: true,
      rollbackDraftReady: true,
      queryGateContractReady: true,
      fixtureValidationReady: true,
    });
    expect(Array.isArray(summary.nextSteps)).toBe(true);
    expect(summary.nextSteps.length).toBeGreaterThan(0);
  });
});
