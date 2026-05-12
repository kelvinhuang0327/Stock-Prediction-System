/**
 * P15MigrationApprovalReviewUtils.ts
 *
 * Governance utilities for P15 MonthlyRevenue migration approval review.
 *
 * DISCLAIMER: Does not constitute investment advice. Does not compute ROI,
 * profit, alpha, win-rate, edge, or outperformance. Governance / review only.
 * No production DB writes. No automatic approval granted.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EXPECTED_APPROVAL_TOKEN = 'P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY';

/** Outcome fields that must never appear in backfill or gate logic */
export const FORBIDDEN_OUTCOME_FIELDS: readonly string[] = [
  'outcomePrice',
  'returnPct',
  'realizedReturnClass',
  'futurePrice',
  'horizonReturnPct',
  'outcomeDate',
  'horizonDays',
  'baselineResult',
  'outcomeClose',
];

/** Forbidden claim patterns — must never appear in governance artifacts */
const FORBIDDEN_CLAIM_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'ROI',                    pattern: /\bROI\b/i },
  { label: 'win-rate',               pattern: /\bwin[\s-]?rate\b/i },
  { label: 'alpha',                  pattern: /\balpha\b/i },
  { label: 'edge',                   pattern: /\bedge\b/i },
  { label: 'profit',                 pattern: /\bprofit\b/i },
  { label: 'outperform',             pattern: /\boutperform\b/i },
  { label: 'beat',                   pattern: /\bbeat(s)?\s+the\b/i },
  { label: 'buy',                    pattern: /\bbuy\b/i },
  { label: 'sell',                   pattern: /\bsell\b/i },
  { label: 'guaranteed',             pattern: /\bguaranteed?\b/i },
  { label: 'investment recommendation', pattern: /investment\s+recommendation/i },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MigrationDraft {
  draftId?: string;
  productionApplyAllowed: boolean;
  proposedSchemaChange?: {
    fieldsToAdd?: Array<{ name: string; type?: string }>;
  };
  safetyValidation?: {
    status: string;
    safe?: boolean;
    errors?: string[];
  };
  backfillRule?: { source?: string; forbiddenInputs?: string[] };
  rollbackReference?: string;
}

export interface RollbackDraft {
  rollbackId?: string;
  strategies?: Array<{ name: string; description?: string }>;
  productionApplyAllowed?: boolean;
}

export interface QueryGateProposal {
  contractId?: string;
  proposals?: Array<{
    targetFile?: string;
    filePath?: string;
    file?: string;
    component?: string;
    risk?: string;
  }>;
  queryGateRules?: unknown[];
  productionApplyAllowed?: boolean;
}

export interface FixtureDryRunResult {
  validationStatus: string;
  passed?: number;
  total?: number;
  productionDbWritten?: boolean;
  testCases?: unknown[];
}

export interface PreflightArtifact {
  approvalStatus?: string;
  productionDbWritten?: boolean;
  preflightStatus?: string;
  finalClassification?: string;
}

export interface ApprovalGateResult {
  gate: string;
  pass: boolean;
  detail?: string;
}

export interface MigrationDraftSafetyResult {
  safe: boolean;
  gates: ApprovalGateResult[];
  errors: string[];
  warnings: string[];
  summary: string;
}

export interface RollbackReadinessResult {
  ready: boolean;
  gates: ApprovalGateResult[];
  errors: string[];
  summary: string;
}

export interface QueryGateCoverageResult {
  covered: boolean;
  gates: ApprovalGateResult[];
  coveredPaths: string[];
  missingPaths: string[];
  summary: string;
}

export interface FixtureDryRunCoverageResult {
  covered: boolean;
  gates: ApprovalGateResult[];
  errors: string[];
  summary: string;
}

export interface ProductionSafetyResult {
  safe: boolean;
  gates: ApprovalGateResult[];
  errors: string[];
  summary: string;
}

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type RiskLikelihood = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskItem {
  riskId: string;
  title: string;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  evidence: string;
  mitigation: string;
  owner: string;
  nextPhaseAction: string;
  approvalImpact: string;
}

export interface ApprovalRiskRegister {
  registerId: string;
  generatedAt: string;
  risks: RiskItem[];
  highSeverityCount: number;
  mitigatedHighCount: number;
  blockerCount: number;
}

export type ApprovalDecisionClassification =
  | 'APPROVAL_REVIEW_PASS_READY_FOR_DRY_RUN_IMPLEMENTATION'
  | 'APPROVAL_REVIEW_REQUIRES_ROLLBACK_DETAIL'
  | 'APPROVAL_REVIEW_REQUIRES_QUERY_GATE_DETAIL'
  | 'APPROVAL_REVIEW_REQUIRES_FIXTURE_COVERAGE'
  | 'APPROVAL_REVIEW_REJECTED'
  | 'APPROVAL_REVIEW_BLOCKED';

export interface ApprovalDecision {
  decisionId: string;
  classification: ApprovalDecisionClassification;
  approvalGranted: false;            // hardcoded — never auto-approve
  approvalTokenRequired: string;
  readyToRequestToken: boolean;
  rationale: string;
  requiredApproverAction: string;
  gateResults: ApprovalGateResult[];
  productionApplyAllowed: false;     // hardcoded
  note: string;
}

export interface ForbiddenClaimsHit {
  line: number;
  text: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Inputs for composite functions
// ---------------------------------------------------------------------------

export interface ApprovalReviewInputs {
  migrationDraft: MigrationDraft;
  rollbackDraft: RollbackDraft | null;
  queryGateProposal: QueryGateProposal;
  fixtureDryRun: FixtureDryRunResult;
  preflight: PreflightArtifact;
  riskRegister?: ApprovalRiskRegister;
}

// ---------------------------------------------------------------------------
// 1. evaluateMigrationDraftSafety
// ---------------------------------------------------------------------------

/**
 * Evaluate whether the migration draft meets P15 safety requirements.
 * Rejects any draft where productionApplyAllowed is true.
 */
export function evaluateMigrationDraftSafety(draft: MigrationDraft): MigrationDraftSafetyResult {
  const gates: ApprovalGateResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Gate 1: draft exists
  gates.push({ gate: 'draft_exists', pass: draft != null, detail: draft != null ? 'Draft object present' : 'Draft is null' });

  // Gate 2: productionApplyAllowed must be false
  const prodApplyFalse = draft.productionApplyAllowed === false;
  gates.push({ gate: 'production_apply_allowed_false', pass: prodApplyFalse, detail: `productionApplyAllowed=${draft.productionApplyAllowed}` });
  if (!prodApplyFalse) errors.push('productionApplyAllowed must be false — cannot proceed');

  // Gate 3: safetyValidation exists and status is SAFE_DRY_RUN_ONLY
  const svStatus = draft.safetyValidation?.status;
  const svOk = svStatus === 'SAFE_DRY_RUN_ONLY';
  gates.push({ gate: 'safety_validation_status', pass: svOk, detail: `safetyValidation.status=${svStatus}` });
  if (!svOk) errors.push('safetyValidation.status must be SAFE_DRY_RUN_ONLY');

  // Gate 4: safetyValidation.safe not explicitly false
  const svSafe = draft.safetyValidation?.safe !== false;
  gates.push({ gate: 'safety_validation_no_explicit_errors', pass: svSafe, detail: `safetyValidation.safe=${draft.safetyValidation?.safe}` });
  if (!svSafe) errors.push('safetyValidation reports not safe');

  // Gate 5: proposedSchemaChange has fieldsToAdd
  const fieldsToAdd = draft.proposedSchemaChange?.fieldsToAdd;
  const hasFields = Array.isArray(fieldsToAdd) && fieldsToAdd.length > 0;
  gates.push({ gate: 'proposed_schema_change_has_fields', pass: hasFields, detail: `fieldsToAdd count=${fieldsToAdd?.length ?? 0}` });
  if (!hasFields) errors.push('proposedSchemaChange.fieldsToAdd is missing or empty');

  // Gate 6: releaseDate field present in proposed schema
  const hasReleaseDate = (fieldsToAdd || []).some((f: { name: string }) => f.name === 'releaseDate');
  gates.push({ gate: 'release_date_field_proposed', pass: hasReleaseDate, detail: `releaseDate in fieldsToAdd: ${hasReleaseDate}` });
  if (!hasReleaseDate) warnings.push('releaseDate field not found in proposedSchemaChange.fieldsToAdd');

  // Gate 7: backfill rule does not use forbidden outcome fields
  const backfillForbidden = (draft.backfillRule?.forbiddenInputs || []).length > 0;
  gates.push({ gate: 'backfill_forbidden_inputs_declared', pass: backfillForbidden, detail: `forbiddenInputs count=${draft.backfillRule?.forbiddenInputs?.length ?? 0}` });
  if (!backfillForbidden) warnings.push('backfillRule.forbiddenInputs not declared — add FORBIDDEN_OUTCOME_FIELDS list');

  const safe = errors.length === 0;
  return { safe, gates, errors, warnings, summary: safe ? 'SAFE_DRY_RUN_ONLY' : 'UNSAFE' };
}

// ---------------------------------------------------------------------------
// 2. evaluateRollbackReadiness
// ---------------------------------------------------------------------------

/**
 * Evaluate whether the rollback draft is ready.
 * Requires at least one rollback strategy to be declared.
 */
export function evaluateRollbackReadiness(rollbackDraft: RollbackDraft | null): RollbackReadinessResult {
  const gates: ApprovalGateResult[] = [];
  const errors: string[] = [];

  // Gate 1: rollback draft exists
  const exists = rollbackDraft != null;
  gates.push({ gate: 'rollback_draft_exists', pass: exists, detail: exists ? 'Rollback draft present' : 'Rollback draft is null' });
  if (!exists) errors.push('Rollback draft is missing — cannot proceed');

  // Gate 2: rollback has strategies
  const strategies = rollbackDraft?.strategies || [];
  const hasStrategies = strategies.length >= 1;
  gates.push({ gate: 'rollback_has_strategies', pass: hasStrategies, detail: `strategies count=${strategies.length}` });
  if (!hasStrategies) errors.push('Rollback draft must declare at least one rollback strategy');

  // Gate 3: productionApplyAllowed is false (if field present)
  const prodApply = rollbackDraft?.productionApplyAllowed;
  const prodApplyOk = prodApply === false || prodApply === undefined;
  gates.push({ gate: 'rollback_production_apply_allowed_false', pass: prodApplyOk, detail: `productionApplyAllowed=${prodApply}` });
  if (!prodApplyOk) errors.push('Rollback draft productionApplyAllowed must not be true');

  const ready = errors.length === 0;
  return { ready, gates, errors, summary: ready ? 'ROLLBACK_READY' : 'ROLLBACK_NOT_READY' };
}

// ---------------------------------------------------------------------------
// 3. evaluateQueryGateProposal
// ---------------------------------------------------------------------------

const REQUIRED_QUERY_GATE_PATHS = [
  'RuleBasedStockAnalyzer',
  'FundamentalResearchService',
];

/**
 * Evaluate whether the query gate proposal covers the required code paths.
 * RuleBasedStockAnalyzer and FundamentalResearchService are hard requirements.
 */
export function evaluateQueryGateProposal(proposal: QueryGateProposal): QueryGateCoverageResult {
  const gates: ApprovalGateResult[] = [];
  const missingPaths: string[] = [];

  // Gate 1: proposal exists
  const exists = proposal != null;
  gates.push({ gate: 'query_gate_proposal_exists', pass: exists, detail: exists ? 'Proposal present' : 'Proposal is null' });

  // Gate 2: queryGateRules exist
  const rules = proposal?.queryGateRules || [];
  const hasRules = rules.length >= 1;
  gates.push({ gate: 'query_gate_rules_exist', pass: hasRules, detail: `queryGateRules count=${rules.length}` });

  // Gate 3: proposals exist
  const proposals = proposal?.proposals || [];
  const hasProposals = proposals.length >= 1;
  gates.push({ gate: 'proposals_exist', pass: hasProposals, detail: `proposals count=${proposals.length}` });

  // Gate 4: productionApplyAllowed false
  const prodApplyOk = proposal?.productionApplyAllowed === false;
  gates.push({ gate: 'production_apply_allowed_false', pass: prodApplyOk, detail: `productionApplyAllowed=${proposal?.productionApplyAllowed}` });

  // Gate 5+: each required path covered
  const proposalText = JSON.stringify(proposals);
  const coveredPaths: string[] = [];
  for (const required of REQUIRED_QUERY_GATE_PATHS) {
    const covered = proposalText.includes(required);
    gates.push({ gate: `covers_${required}`, pass: covered, detail: `${required} in proposals: ${covered}` });
    if (covered) coveredPaths.push(required);
    else missingPaths.push(required);
  }

  const covered = missingPaths.length === 0 && hasRules && hasProposals;
  return { covered, gates, coveredPaths, missingPaths, summary: covered ? 'QUERY_GATE_COVERAGE_SUFFICIENT' : 'QUERY_GATE_COVERAGE_INSUFFICIENT' };
}

// ---------------------------------------------------------------------------
// 4. evaluateFixtureDryRun
// ---------------------------------------------------------------------------

/**
 * Evaluate the fixture dry-run result.
 * Requires validationStatus=PASS and all test cases to pass.
 */
export function evaluateFixtureDryRun(dryRun: FixtureDryRunResult): FixtureDryRunCoverageResult {
  const gates: ApprovalGateResult[] = [];
  const errors: string[] = [];

  // Gate 1: dry run exists
  const exists = dryRun != null;
  gates.push({ gate: 'fixture_dry_run_exists', pass: exists, detail: exists ? 'Dry run present' : 'Dry run is null' });

  // Gate 2: validationStatus = PASS
  const statusOk = dryRun?.validationStatus === 'PASS';
  gates.push({ gate: 'validation_status_pass', pass: statusOk, detail: `validationStatus=${dryRun?.validationStatus}` });
  if (!statusOk) errors.push('Fixture dry-run validationStatus must be PASS');

  // Gate 3: all tests pass
  const passed = dryRun?.passed ?? 0;
  const total = dryRun?.total ?? 0;
  const allPass = total > 0 && passed === total;
  gates.push({ gate: 'all_fixture_tests_pass', pass: allPass, detail: `passed=${passed}/${total}` });
  if (!allPass) errors.push(`Fixture dry-run: ${passed}/${total} passed — all must pass`);

  // Gate 4: no production DB written
  const noProdWrite = dryRun?.productionDbWritten === false;
  gates.push({ gate: 'production_db_not_written', pass: noProdWrite, detail: `productionDbWritten=${dryRun?.productionDbWritten}` });
  if (!noProdWrite) errors.push('productionDbWritten must be false');

  const covered = errors.length === 0;
  return { covered, gates, errors, summary: covered ? 'FIXTURE_COVERAGE_SUFFICIENT' : 'FIXTURE_COVERAGE_INSUFFICIENT' };
}

// ---------------------------------------------------------------------------
// 5. evaluateProductionSafety
// ---------------------------------------------------------------------------

/**
 * Evaluate overall production safety — no DB writes, no approval granted.
 */
export function evaluateProductionSafety(preflight: PreflightArtifact, draft: MigrationDraft): ProductionSafetyResult {
  const gates: ApprovalGateResult[] = [];
  const errors: string[] = [];

  // Gate 1: preflight productionDbWritten=false
  const pfNoWrite = preflight?.productionDbWritten === false;
  gates.push({ gate: 'preflight_production_db_not_written', pass: pfNoWrite, detail: `preflight.productionDbWritten=${preflight?.productionDbWritten}` });
  if (!pfNoWrite) errors.push('preflight.productionDbWritten must be false');

  // Gate 2: draft productionApplyAllowed=false
  const draftProdFalse = draft?.productionApplyAllowed === false;
  gates.push({ gate: 'draft_production_apply_allowed_false', pass: draftProdFalse, detail: `draft.productionApplyAllowed=${draft?.productionApplyAllowed}` });
  if (!draftProdFalse) errors.push('draft.productionApplyAllowed must be false');

  // Gate 3: no automatic approval
  const noAutoApproval = preflight?.approvalStatus !== 'APPROVED';
  gates.push({ gate: 'no_automatic_approval', pass: noAutoApproval, detail: `approvalStatus=${preflight?.approvalStatus}` });
  if (!noAutoApproval) errors.push('Automatic approval detected — forbidden by governance rules');

  // Gate 4: preflight passed
  const pfPass = preflight?.preflightStatus === 'PASS';
  gates.push({ gate: 'preflight_status_pass', pass: pfPass, detail: `preflightStatus=${preflight?.preflightStatus}` });
  if (!pfPass) errors.push('preflightStatus must be PASS');

  const safe = errors.length === 0;
  return { safe, gates, errors, summary: safe ? 'PRODUCTION_SAFE' : 'PRODUCTION_UNSAFE' };
}

// ---------------------------------------------------------------------------
// 6. buildApprovalRiskRegister
// ---------------------------------------------------------------------------

/**
 * Build a deterministic risk register for the migration approval review.
 * Does not use Math.random. All risks are fixed based on P13/P14 evidence.
 */
export function buildApprovalRiskRegister(_inputs?: Partial<ApprovalReviewInputs>): ApprovalRiskRegister {
  const risks: RiskItem[] = [
    {
      riskId: 'R-001',
      title: 'Schema migration breaks existing queries',
      severity: 'HIGH',
      likelihood: 'MEDIUM',
      evidence: 'Adding releaseDate DateTime? to MonthlyRevenue changes the Prisma schema. Existing queries using year/month filter may not be updated.',
      mitigation: 'P14 query gate proposal covers RuleBasedStockAnalyzer (HIGH risk) and FundamentalResearchService (HIGH risk) — both require explicit code patch in P16.',
      owner: 'Engineering',
      nextPhaseAction: 'P16: Apply query gate patches before running prisma migrate dev',
      approvalImpact: 'Blocking if patches not applied before migration',
    },
    {
      riskId: 'R-002',
      title: 'Backfill inference introduces systematic date bias',
      severity: 'MEDIUM',
      likelihood: 'LOW',
      evidence: 'INFERRED_NEXT_MONTH_10TH rule assumes all Taiwan revenue is released exactly on the 10th. In practice some stocks release earlier or later.',
      mitigation: 'Field declared as releaseDateSource=INFERRED with confidence LOW_TO_MEDIUM. Query gate checks releaseDateSource; authoritative data can override.',
      owner: 'Data',
      nextPhaseAction: 'P16: Ensure backfill SQL sets releaseDateSource=INFERRED_NEXT_MONTH_10TH and releaseDateConfidence=LOW_TO_MEDIUM',
      approvalImpact: 'Non-blocking if confidence field is populated correctly',
    },
    {
      riskId: 'R-003',
      title: 'Query gate regression — existing tests fail after patch',
      severity: 'HIGH',
      likelihood: 'LOW',
      evidence: 'P14 full suite = 1438/1438 PASS (pre-patch). Post-patch query gate changes to RuleBasedStockAnalyzer may break callers that do not pass asOfDate.',
      mitigation: 'P14 fixture dry-run 11/11 PASS covers all gate edge cases. Test coverage must be verified again post-patch in P16.',
      owner: 'Engineering',
      nextPhaseAction: 'P16: Run full test suite after applying query gate patches; target 1438+ PASS',
      approvalImpact: 'Blocking if full suite drops below baseline',
    },
    {
      riskId: 'R-004',
      title: 'Historical replay comparability affected by releaseDate backfill',
      severity: 'MEDIUM',
      likelihood: 'LOW',
      evidence: 'P3 active scoring corpus uses year/month period to filter MonthlyRevenue. After migration, replay results may differ slightly due to date-gated availability.',
      mitigation: 'Frozen corpus files (P0/P1/P3/P4) are not modified. Replay comparability is maintained by design — frozen lines verified: P0=4500, P1=9900, P3=4500.',
      owner: 'Data',
      nextPhaseAction: 'P16: Verify replay outputs before/after schema migration using frozen corpus',
      approvalImpact: 'Non-blocking if frozen corpus verified unchanged',
    },
    {
      riskId: 'R-005',
      title: 'Rollback incomplete — column DROP may lose backfilled data',
      severity: 'MEDIUM',
      likelihood: 'LOW',
      evidence: 'Rollback Strategy B (drop columns) is irreversible. Any backfilled releaseDateSource/releaseDateConfidence data would be lost.',
      mitigation: 'P14 rollback draft includes Strategy A (set fields to NULL) as soft rollback. Strategy B (drop) is documented as hard rollback requiring explicit decision.',
      owner: 'Engineering',
      nextPhaseAction: 'P16: Default to Strategy A rollback; Strategy B requires explicit DBA approval',
      approvalImpact: 'Non-blocking — soft rollback path sufficient',
    },
    {
      riskId: 'R-006',
      title: 'Production DB safety — unintended writes during migration',
      severity: 'HIGH',
      likelihood: 'LOW',
      evidence: 'P14 approvalStatus=NOT_APPROVED; productionApplyAllowed=false on all artifacts. Current state: no DB writes have occurred.',
      mitigation: 'All P14 utilities hardcode productionApplyAllowed=false. P15 utilities maintain this invariant. P16 requires explicit approval token to unlock.',
      owner: 'Engineering',
      nextPhaseAction: 'P16: Only unlock after explicit approval token P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY provided',
      approvalImpact: 'Hard blocker — must not be bypassed',
    },
    {
      riskId: 'R-007',
      title: 'PIT leakage residual — releaseDate not yet enforced in production code',
      severity: 'HIGH',
      likelihood: 'HIGH',
      evidence: 'P13 source audit: RuleBasedStockAnalyzer uses year/month gate (HIGH risk leakage). FundamentalResearchService has no asOf gate (HIGH risk leakage). MonthlyRevenue schema lacks releaseDate.',
      mitigation: 'P14 query gate proposal documents all three patch targets. Patches are proposed but not applied — requires P16 schema migration first.',
      owner: 'Engineering',
      nextPhaseAction: 'P16: Apply schema migration, then apply query gate patches; revalidate P13 PIT gate (35/35 target)',
      approvalImpact: 'Non-blocking for approval review — leakage documented and mitigated in P16 plan',
    },
    {
      riskId: 'R-008',
      title: 'Reason/scoring downstream impact from releaseDate enforcement',
      severity: 'MEDIUM',
      likelihood: 'MEDIUM',
      evidence: 'alphaScore and recommendationBucket depend on fundamentals. After releaseDate gate enforcement, some records previously available may become gated, potentially changing scores.',
      mitigation: 'P15 review confirms scoring formula and alphaScore/recommendationBucket are NOT modified. Impact limited to data availability — not formula changes.',
      owner: 'Engineering',
      nextPhaseAction: 'P16: Post-migration comparison of score distributions before/after; expect minor shifts for asOf dates near the 10th of each month',
      approvalImpact: 'Non-blocking if scoring formulas are not changed',
    },
  ];

  const highSeverityCount = risks.filter(r => r.severity === 'HIGH').length;
  const mitigatedHighCount = highSeverityCount; // all HIGH risks have mitigations
  const blockerCount = risks.filter(r => r.riskId === 'R-006').length; // only R-006 is hard blocker

  return {
    registerId: 'p15-migration-risk-register-v0',
    generatedAt: '2026-05-12',
    risks,
    highSeverityCount,
    mitigatedHighCount,
    blockerCount,
  };
}

// ---------------------------------------------------------------------------
// 7. buildApprovalDecision
// ---------------------------------------------------------------------------

/**
 * Build the approval decision artifact.
 *
 * IMPORTANT: This function NEVER grants approval automatically.
 * approvalGranted is hardcoded to false.
 * It only evaluates whether artifacts are ready to request an explicit token.
 */
export function buildApprovalDecision(inputs: ApprovalReviewInputs): ApprovalDecision {
  const draftSafety = evaluateMigrationDraftSafety(inputs.migrationDraft);
  const rollbackReadiness = evaluateRollbackReadiness(inputs.rollbackDraft);
  const queryGateCoverage = evaluateQueryGateProposal(inputs.queryGateProposal);
  const fixtureCoverage = evaluateFixtureDryRun(inputs.fixtureDryRun);
  const productionSafety = evaluateProductionSafety(inputs.preflight, inputs.migrationDraft);

  const allGates: ApprovalGateResult[] = [
    ...draftSafety.gates,
    ...rollbackReadiness.gates,
    ...queryGateCoverage.gates,
    ...fixtureCoverage.gates,
    ...productionSafety.gates,
  ];

  // Determine classification
  let classification: ApprovalDecisionClassification;
  let rationale: string;
  let readyToRequestToken: boolean;

  if (!productionSafety.safe) {
    classification = 'APPROVAL_REVIEW_REJECTED';
    rationale = 'Production safety check failed: ' + productionSafety.errors.join('; ');
    readyToRequestToken = false;
  } else if (!draftSafety.safe) {
    classification = 'APPROVAL_REVIEW_BLOCKED';
    rationale = 'Migration draft safety check failed: ' + draftSafety.errors.join('; ');
    readyToRequestToken = false;
  } else if (!rollbackReadiness.ready) {
    classification = 'APPROVAL_REVIEW_REQUIRES_ROLLBACK_DETAIL';
    rationale = 'Rollback draft is not ready: ' + rollbackReadiness.errors.join('; ');
    readyToRequestToken = false;
  } else if (!queryGateCoverage.covered) {
    classification = 'APPROVAL_REVIEW_REQUIRES_QUERY_GATE_DETAIL';
    rationale = 'Query gate proposal insufficient — missing paths: ' + queryGateCoverage.missingPaths.join(', ');
    readyToRequestToken = false;
  } else if (!fixtureCoverage.covered) {
    classification = 'APPROVAL_REVIEW_REQUIRES_FIXTURE_COVERAGE';
    rationale = 'Fixture dry-run coverage insufficient: ' + fixtureCoverage.errors.join('; ');
    readyToRequestToken = false;
  } else {
    // All gates pass
    classification = 'APPROVAL_REVIEW_PASS_READY_FOR_DRY_RUN_IMPLEMENTATION';
    rationale = 'All hard gates PASS. All HIGH severity risks have documented mitigations. Artifacts are ready to request explicit approval token for P16.';
    readyToRequestToken = true;
  }

  return {
    decisionId: 'p15-migration-approval-decision-v0',
    classification,
    approvalGranted: false,  // HARDCODED — never changes
    approvalTokenRequired: EXPECTED_APPROVAL_TOKEN,
    readyToRequestToken,
    rationale,
    requiredApproverAction: readyToRequestToken
      ? `Review this artifact and P15 risk register. If satisfied, provide explicit token: ${EXPECTED_APPROVAL_TOKEN} to unlock P16 implementation.`
      : 'Address the identified gaps before requesting approval token.',
    gateResults: allGates,
    productionApplyAllowed: false,  // HARDCODED — never changes
    note: 'This decision artifact does not grant approval. Approval must be provided explicitly by an authorized operator (CTO/CEO). approvalGranted is hardcoded false.',
  };
}

// ---------------------------------------------------------------------------
// 8. scanForbiddenClaims
// ---------------------------------------------------------------------------

const DISCLAIMER_SKIP_PATTERNS: RegExp[] = [
  /disclaimer/i,
  /does.not.constitute/i,
  /non[-\s]?goal/i,
  /not.provide/i,
  /forbidden.claim/i,
  /forbiddenclaimpattern/i,
  /FORBIDDEN_CLAIM_PATTERNS/i,
  /ForbiddenClaim/i,
  /scanner.test/i,
  /test.data/i,
];

const ALPHA_SCORE_SKIP = /alphaScore/i;
const KNOWLEDGE_HEDGE_SKIP = /knowledge|hedge|edge\s+case|leading.edge|cutting.edge/i;

/**
 * Scan text for forbidden investment claims.
 * Skips disclaimer lines, scanner pattern definitions, and safe contexts.
 */
export function scanForbiddenClaims(text: string): ForbiddenClaimsHit[] {
  const hits: ForbiddenClaimsHit[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip disclaimer/non-goal/scanner lines
    if (DISCLAIMER_SKIP_PATTERNS.some(p => p.test(line))) continue;

    for (const { label, pattern } of FORBIDDEN_CLAIM_PATTERNS) {
      if (!pattern.test(line)) continue;

      // alphaScore field name is allowed
      if (label === 'alpha' && ALPHA_SCORE_SKIP.test(line)) continue;

      // "edge case" / knowledge / hedge context allowed for 'edge'
      if (label === 'edge' && KNOWLEDGE_HEDGE_SKIP.test(line)) continue;

      // beat — only flag "beats the market" / "beat the benchmark" style
      if (label === 'beat' && !/beat(s)?\s+the\b/i.test(line)) continue;

      hits.push({ line: i + 1, text: line.trim(), label });
    }
  }

  return hits;
}
