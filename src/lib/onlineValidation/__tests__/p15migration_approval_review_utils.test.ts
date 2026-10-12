/**
 * p15migration_approval_review_utils.test.ts
 *
 * Tests for P15MigrationApprovalReviewUtils
 *
 * DISCLAIMER: Does not constitute investment advice. Does not compute ROI,
 * profit, alpha, win-rate, edge, or outperformance. Test-only file.
 * No production DB writes. No Math.random. No P0/P1/P3/P4 corpus modification.
 */

import {
  evaluateMigrationDraftSafety,
  evaluateRollbackReadiness,
  evaluateQueryGateProposal,
  evaluateFixtureDryRun,
  evaluateProductionSafety,
  buildApprovalRiskRegister,
  buildApprovalDecision,
  scanForbiddenClaims,
  MigrationDraft,
  RollbackDraft,
  QueryGateProposal,
  FixtureDryRunResult,
  PreflightArtifact,
  EXPECTED_APPROVAL_TOKEN,
} from '../P15MigrationApprovalReviewUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDraft(overrides: Partial<MigrationDraft> = {}): MigrationDraft {
  return {
    draftId: 'p14-monthly-revenue-migration-draft-v0',
    productionApplyAllowed: false,
    proposedSchemaChange: {
      fieldsToAdd: [
        { name: 'releaseDate', type: 'DateTime?' },
        { name: 'releaseDateSource', type: 'String?' },
        { name: 'releaseDateConfidence', type: 'String?' },
      ],
    },
    safetyValidation: { status: 'SAFE_DRY_RUN_ONLY', safe: true, errors: [] },
    backfillRule: { source: 'INFERRED_NEXT_MONTH_10TH', forbiddenInputs: ['outcomePrice', 'returnPct'] },
    ...overrides,
  };
}

function makeRollback(overrides: Partial<RollbackDraft> = {}): RollbackDraft {
  return {
    rollbackId: 'p14-monthly-revenue-rollback-draft-v0',
    strategies: [
      { name: 'Strategy A', description: 'Set fields to NULL' },
      { name: 'Strategy B', description: 'DROP columns' },
    ],
    productionApplyAllowed: false,
    ...overrides,
  };
}

function makeProposal(overrides: Partial<QueryGateProposal> = {}): QueryGateProposal {
  return {
    contractId: 'p14-monthly-revenue-query-gate-contract-v0',
    proposals: [
      { targetFile: 'src/lib/analysis/RuleBasedStockAnalyzer.ts', risk: 'HIGH' },
      { targetFile: 'src/lib/fundamentals/FundamentalResearchService.ts', risk: 'HIGH' },
      { targetFile: 'src/lib/fundamentals/StockFundamentalSnapshot.ts', risk: 'MEDIUM' },
    ],
    queryGateRules: [{ id: 'QG-001' }, { id: 'QG-002' }, { id: 'QG-003' }, { id: 'QG-004' }, { id: 'QG-005' }, { id: 'QG-006' }, { id: 'QG-007' }],
    productionApplyAllowed: false,
    ...overrides,
  };
}

function makeDryRun(overrides: Partial<FixtureDryRunResult> = {}): FixtureDryRunResult {
  return {
    validationStatus: 'PASS',
    passed: 11,
    total: 11,
    productionDbWritten: false,
    ...overrides,
  };
}

function makePreflight(overrides: Partial<PreflightArtifact> = {}): PreflightArtifact {
  return {
    approvalStatus: 'NOT_APPROVED',
    productionDbWritten: false,
    preflightStatus: 'PASS',
    finalClassification: 'P14_MONTHLY_REVENUE_AWAITING_SCHEMA_MIGRATION_APPROVAL',
    ...overrides,
  };
}

function makeFullInputs() {
  return {
    migrationDraft: makeDraft(),
    rollbackDraft: makeRollback(),
    queryGateProposal: makeProposal(),
    fixtureDryRun: makeDryRun(),
    preflight: makePreflight(),
  };
}

// ---------------------------------------------------------------------------
// evaluateMigrationDraftSafety
// ---------------------------------------------------------------------------

describe('evaluateMigrationDraftSafety', () => {
  it('returns safe=true for a valid draft', () => {
    const result = evaluateMigrationDraftSafety(makeDraft());
    expect(result.safe).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.summary).toBe('SAFE_DRY_RUN_ONLY');
  });

  it('rejects draft with productionApplyAllowed=true', () => {
    const draft = makeDraft({ productionApplyAllowed: true });
    const result = evaluateMigrationDraftSafety(draft);
    expect(result.safe).toBe(false);
    expect(result.errors.some(e => e.includes('productionApplyAllowed'))).toBe(true);
    expect(result.summary).toBe('UNSAFE');
  });

  it('rejects draft when safetyValidation status is not SAFE_DRY_RUN_ONLY', () => {
    const draft = makeDraft({ safetyValidation: { status: 'UNKNOWN', safe: true } });
    const result = evaluateMigrationDraftSafety(draft);
    expect(result.safe).toBe(false);
    expect(result.errors.some(e => e.includes('SAFE_DRY_RUN_ONLY'))).toBe(true);
  });

  it('rejects draft when safetyValidation.safe is explicitly false', () => {
    const draft = makeDraft({ safetyValidation: { status: 'SAFE_DRY_RUN_ONLY', safe: false } });
    const result = evaluateMigrationDraftSafety(draft);
    expect(result.safe).toBe(false);
  });

  it('rejects draft with empty fieldsToAdd', () => {
    const draft = makeDraft({ proposedSchemaChange: { fieldsToAdd: [] } });
    const result = evaluateMigrationDraftSafety(draft);
    expect(result.safe).toBe(false);
    expect(result.errors.some(e => e.includes('fieldsToAdd'))).toBe(true);
  });

  it('warns if releaseDate not in fieldsToAdd', () => {
    const draft = makeDraft({ proposedSchemaChange: { fieldsToAdd: [{ name: 'otherField', type: 'String?' }] } });
    const result = evaluateMigrationDraftSafety(draft);
    expect(result.warnings.some(w => w.includes('releaseDate'))).toBe(true);
  });

  it('does not use Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    evaluateMigrationDraftSafety(makeDraft());
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// evaluateRollbackReadiness
// ---------------------------------------------------------------------------

describe('evaluateRollbackReadiness', () => {
  it('returns ready=true for valid rollback draft', () => {
    const result = evaluateRollbackReadiness(makeRollback());
    expect(result.ready).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.summary).toBe('ROLLBACK_READY');
  });

  it('returns ready=false for null rollback draft', () => {
    const result = evaluateRollbackReadiness(null);
    expect(result.ready).toBe(false);
    expect(result.errors.some(e => e.includes('missing'))).toBe(true);
    expect(result.summary).toBe('ROLLBACK_NOT_READY');
  });

  it('returns ready=false when strategies is empty', () => {
    const result = evaluateRollbackReadiness(makeRollback({ strategies: [] }));
    expect(result.ready).toBe(false);
    expect(result.errors.some(e => e.includes('strategy'))).toBe(true);
  });

  it('returns ready=false when productionApplyAllowed=true', () => {
    const result = evaluateRollbackReadiness(makeRollback({ productionApplyAllowed: true }));
    expect(result.ready).toBe(false);
    expect(result.errors.some(e => e.includes('productionApplyAllowed'))).toBe(true);
  });

  it('requires rollback content — at least one strategy', () => {
    const draft = makeRollback({ strategies: [{ name: 'A', description: 'null fields' }] });
    const result = evaluateRollbackReadiness(draft);
    expect(result.ready).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateQueryGateProposal
// ---------------------------------------------------------------------------

describe('evaluateQueryGateProposal', () => {
  it('returns covered=true for a complete proposal', () => {
    const result = evaluateQueryGateProposal(makeProposal());
    expect(result.covered).toBe(true);
    expect(result.missingPaths).toHaveLength(0);
    expect(result.summary).toBe('QUERY_GATE_COVERAGE_SUFFICIENT');
  });

  it('requires RuleBasedStockAnalyzer path', () => {
    const proposal = makeProposal({
      proposals: [{ targetFile: 'src/lib/fundamentals/FundamentalResearchService.ts', risk: 'HIGH' }],
    });
    const result = evaluateQueryGateProposal(proposal);
    expect(result.covered).toBe(false);
    expect(result.missingPaths).toContain('RuleBasedStockAnalyzer');
  });

  it('requires FundamentalResearchService path', () => {
    const proposal = makeProposal({
      proposals: [{ targetFile: 'src/lib/analysis/RuleBasedStockAnalyzer.ts', risk: 'HIGH' }],
    });
    const result = evaluateQueryGateProposal(proposal);
    expect(result.covered).toBe(false);
    expect(result.missingPaths).toContain('FundamentalResearchService');
  });

  it('returns covered=false when no proposals', () => {
    const proposal = makeProposal({ proposals: [] });
    const result = evaluateQueryGateProposal(proposal);
    expect(result.covered).toBe(false);
  });

  it('returns covered=false when no queryGateRules', () => {
    const proposal = makeProposal({ queryGateRules: [] });
    const result = evaluateQueryGateProposal(proposal);
    expect(result.covered).toBe(false);
  });

  it('flags covered paths correctly', () => {
    const result = evaluateQueryGateProposal(makeProposal());
    expect(result.coveredPaths).toContain('RuleBasedStockAnalyzer');
    expect(result.coveredPaths).toContain('FundamentalResearchService');
  });
});

// ---------------------------------------------------------------------------
// evaluateFixtureDryRun
// ---------------------------------------------------------------------------

describe('evaluateFixtureDryRun', () => {
  it('returns covered=true for a passing dry run', () => {
    const result = evaluateFixtureDryRun(makeDryRun());
    expect(result.covered).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.summary).toBe('FIXTURE_COVERAGE_SUFFICIENT');
  });

  it('requires validationStatus=PASS', () => {
    const result = evaluateFixtureDryRun(makeDryRun({ validationStatus: 'FAIL' }));
    expect(result.covered).toBe(false);
    expect(result.errors.some(e => e.includes('PASS'))).toBe(true);
    expect(result.summary).toBe('FIXTURE_COVERAGE_INSUFFICIENT');
  });

  it('requires all fixture tests to pass', () => {
    const result = evaluateFixtureDryRun(makeDryRun({ passed: 10, total: 11, validationStatus: 'FAIL' }));
    expect(result.covered).toBe(false);
  });

  it('requires productionDbWritten=false', () => {
    const result = evaluateFixtureDryRun(makeDryRun({ productionDbWritten: true }));
    expect(result.covered).toBe(false);
    expect(result.errors.some(e => e.includes('productionDbWritten'))).toBe(true);
  });

  it('returns covered=false for 0/0 test cases', () => {
    const result = evaluateFixtureDryRun(makeDryRun({ passed: 0, total: 0, validationStatus: 'PASS' }));
    expect(result.covered).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateProductionSafety
// ---------------------------------------------------------------------------

describe('evaluateProductionSafety', () => {
  it('returns safe=true for valid preflight + draft', () => {
    const result = evaluateProductionSafety(makePreflight(), makeDraft());
    expect(result.safe).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.summary).toBe('PRODUCTION_SAFE');
  });

  it('rejects when preflight productionDbWritten=true', () => {
    const result = evaluateProductionSafety(makePreflight({ productionDbWritten: true }), makeDraft());
    expect(result.safe).toBe(false);
    expect(result.errors.some(e => e.includes('productionDbWritten'))).toBe(true);
  });

  it('rejects when draft productionApplyAllowed=true', () => {
    const result = evaluateProductionSafety(makePreflight(), makeDraft({ productionApplyAllowed: true }));
    expect(result.safe).toBe(false);
    expect(result.errors.some(e => e.includes('productionApplyAllowed'))).toBe(true);
  });

  it('rejects when approvalStatus=APPROVED (automatic approval forbidden)', () => {
    const result = evaluateProductionSafety(makePreflight({ approvalStatus: 'APPROVED' }), makeDraft());
    expect(result.safe).toBe(false);
    expect(result.errors.some(e => e.includes('approval'))).toBe(true);
  });

  it('rejects when preflightStatus is not PASS', () => {
    const result = evaluateProductionSafety(makePreflight({ preflightStatus: 'FAIL' }), makeDraft());
    expect(result.safe).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildApprovalDecision
// ---------------------------------------------------------------------------

describe('buildApprovalDecision', () => {
  it('never auto-approves — approvalGranted is always false', () => {
    const decision = buildApprovalDecision(makeFullInputs());
    expect(decision.approvalGranted).toBe(false);
  });

  it('productionApplyAllowed is always false', () => {
    const decision = buildApprovalDecision(makeFullInputs());
    expect(decision.productionApplyAllowed).toBe(false);
  });

  it('returns APPROVAL_REVIEW_PASS_READY_FOR_DRY_RUN_IMPLEMENTATION when all gates pass', () => {
    const decision = buildApprovalDecision(makeFullInputs());
    expect(decision.classification).toBe('APPROVAL_REVIEW_PASS_READY_FOR_DRY_RUN_IMPLEMENTATION');
    expect(decision.readyToRequestToken).toBe(true);
  });

  it('recommends correct approval token', () => {
    const decision = buildApprovalDecision(makeFullInputs());
    expect(decision.approvalTokenRequired).toBe(EXPECTED_APPROVAL_TOKEN);
  });

  it('returns APPROVAL_REVIEW_REQUIRES_ROLLBACK_DETAIL when rollback missing', () => {
    const inputs = { ...makeFullInputs(), rollbackDraft: null };
    const decision = buildApprovalDecision(inputs);
    expect(decision.classification).toBe('APPROVAL_REVIEW_REQUIRES_ROLLBACK_DETAIL');
    expect(decision.readyToRequestToken).toBe(false);
    expect(decision.approvalGranted).toBe(false);
  });

  it('returns APPROVAL_REVIEW_REQUIRES_QUERY_GATE_DETAIL when query gate missing required path', () => {
    const inputs = {
      ...makeFullInputs(),
      queryGateProposal: makeProposal({ proposals: [] }),
    };
    const decision = buildApprovalDecision(inputs);
    expect(decision.classification).toBe('APPROVAL_REVIEW_REQUIRES_QUERY_GATE_DETAIL');
    expect(decision.readyToRequestToken).toBe(false);
  });

  it('returns APPROVAL_REVIEW_REQUIRES_FIXTURE_COVERAGE when fixture dry run fails', () => {
    const inputs = {
      ...makeFullInputs(),
      fixtureDryRun: makeDryRun({ validationStatus: 'FAIL', passed: 9, total: 11 }),
    };
    const decision = buildApprovalDecision(inputs);
    expect(decision.classification).toBe('APPROVAL_REVIEW_REQUIRES_FIXTURE_COVERAGE');
    expect(decision.readyToRequestToken).toBe(false);
  });

  it('returns APPROVAL_REVIEW_REJECTED when production safety fails', () => {
    const inputs = {
      ...makeFullInputs(),
      preflight: makePreflight({ productionDbWritten: true }),
    };
    const decision = buildApprovalDecision(inputs);
    expect(decision.classification).toBe('APPROVAL_REVIEW_REJECTED');
    expect(decision.readyToRequestToken).toBe(false);
  });

  it('does not use Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    buildApprovalDecision(makeFullInputs());
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('includes gateResults in output', () => {
    const decision = buildApprovalDecision(makeFullInputs());
    expect(Array.isArray(decision.gateResults)).toBe(true);
    expect(decision.gateResults.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// buildApprovalRiskRegister
// ---------------------------------------------------------------------------

describe('buildApprovalRiskRegister', () => {
  it('returns a deterministic risk register', () => {
    const r1 = buildApprovalRiskRegister();
    const r2 = buildApprovalRiskRegister();
    expect(r1.registerId).toBe(r2.registerId);
    expect(r1.risks.length).toBe(r2.risks.length);
    expect(r1.risks.map(r => r.riskId)).toEqual(r2.risks.map(r => r.riskId));
  });

  it('contains 8 risk items', () => {
    const register = buildApprovalRiskRegister();
    expect(register.risks).toHaveLength(8);
  });

  it('all risk items have required fields', () => {
    const register = buildApprovalRiskRegister();
    for (const risk of register.risks) {
      expect(risk.riskId).toBeTruthy();
      expect(risk.title).toBeTruthy();
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(risk.severity);
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(risk.likelihood);
      expect(risk.evidence).toBeTruthy();
      expect(risk.mitigation).toBeTruthy();
      expect(risk.owner).toBeTruthy();
      expect(risk.nextPhaseAction).toBeTruthy();
      expect(risk.approvalImpact).toBeTruthy();
    }
  });

  it('highSeverityCount matches actual HIGH severity items', () => {
    const register = buildApprovalRiskRegister();
    const actual = register.risks.filter(r => r.severity === 'HIGH').length;
    expect(register.highSeverityCount).toBe(actual);
  });

  it('does not use Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    buildApprovalRiskRegister();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('registerId is deterministic', () => {
    const r = buildApprovalRiskRegister();
    expect(r.registerId).toBe('p15-migration-risk-register-v0');
  });
});

// ---------------------------------------------------------------------------
// scanForbiddenClaims
// ---------------------------------------------------------------------------

describe('scanForbiddenClaims', () => {
  it('catches ROI claim', () => {
    const hits = scanForbiddenClaims('This strategy achieves 30% ROI annually.');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toBe('ROI');
  });

  it('catches win-rate claim', () => {
    const hits = scanForbiddenClaims('System win-rate is 70% in backtests.');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toBe('win-rate');
  });

  it('catches alpha claim (non-alphaScore)', () => {
    const hits = scanForbiddenClaims('The model generates positive alpha consistently.');
    expect(hits.some(h => h.label === 'alpha')).toBe(true);
  });

  it('does not flag alphaScore field name as alpha', () => {
    const hits = scanForbiddenClaims('const score = record.alphaScore;');
    expect(hits.filter(h => h.label === 'alpha')).toHaveLength(0);
  });

  it('catches edge claim (non-hedge context)', () => {
    const hits = scanForbiddenClaims('This gives us an edge over competitors.');
    expect(hits.some(h => h.label === 'edge')).toBe(true);
  });

  it('does not flag edge case or cutting-edge as edge', () => {
    const hits1 = scanForbiddenClaims('Handle edge case for missing date.');
    const hits2 = scanForbiddenClaims('Using cutting-edge ML techniques.');
    expect(hits1.filter(h => h.label === 'edge')).toHaveLength(0);
    expect(hits2.filter(h => h.label === 'edge')).toHaveLength(0);
  });

  it('catches profit claim', () => {
    const hits = scanForbiddenClaims('Expected profit from this trade: $500.');
    expect(hits.some(h => h.label === 'profit')).toBe(true);
  });

  it('catches outperform claim', () => {
    const hits = scanForbiddenClaims('The system will outperform the market index.');
    expect(hits.some(h => h.label === 'outperform')).toBe(true);
  });

  it('catches buy claim', () => {
    const hits = scanForbiddenClaims('Signal: buy 100 shares.');
    expect(hits.some(h => h.label === 'buy')).toBe(true);
  });

  it('catches sell claim', () => {
    const hits = scanForbiddenClaims('Recommendation: sell all positions.');
    expect(hits.some(h => h.label === 'sell')).toBe(true);
  });

  it('catches guaranteed claim', () => {
    const hits = scanForbiddenClaims('Guaranteed returns of 15% per year.');
    expect(hits.some(h => h.label === 'guaranteed')).toBe(true);
  });

  it('does not flag disclaimer lines', () => {
    const hits = scanForbiddenClaims('Disclaimer: does not constitute investment recommendation or guarantee ROI.');
    expect(hits).toHaveLength(0);
  });

  it('does not flag non-goal declarations', () => {
    const hits = scanForbiddenClaims('non-goal: do not provide buy/sell signals or claim ROI');
    expect(hits).toHaveLength(0);
  });

  it('returns empty array for clean text', () => {
    const hits = scanForbiddenClaims('This system validates MonthlyRevenue PIT gate logic using fixture-only dry-run.');
    expect(hits).toHaveLength(0);
  });
});
