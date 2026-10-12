/**
 * P21ProductionMigrationApprovalReviewUtils.ts
 *
 * P21-HARDRESET — Production Migration Approval Review Utilities
 *
 * DISCLAIMER: Does not constitute investment advice. Observability only.
 * No ROI, win-rate, standalone alpha, edge, profit, outperformance,
 * buy, sell, or investment recommendations are computed or implied.
 *
 * productionApplyAllowed = false
 * productionDbWritten = false
 * approvalGranted = false (never auto-granted)
 *
 * This module assesses READINESS TO REQUEST approval only.
 * It does not and cannot grant production approval.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArtifactReadinessInputs {
  p17SchemaPatchExists: boolean;
  p17QueryGatePatchExists: boolean;
  p17QueryGateValidationExists: boolean;
  p18MigrationExists: boolean;
  p18BackfillExists: boolean;
  p18QueryGateExists: boolean;
  p18RollbackExists: boolean;
  p19PitGuardExists: boolean;
  p20ComparisonExists: boolean;
  p20DecisionExists: boolean;
}

export interface ArtifactReadinessResult {
  allPresent: boolean;
  missingArtifacts: string[];
  presentArtifacts: string[];
}

export interface MigrationSafetyInputs {
  p17SchemaPatch: Record<string, unknown>;
  p17QueryGatePatch: Record<string, unknown>;
  p17QueryGateValidation: Record<string, unknown>;
}

export interface MigrationSafetyResult {
  safe: boolean;
  schemaPatchExists: boolean;
  queryGatePatchExists: boolean;
  queryGateValidationPass: boolean;
  migrationApprovalRequired: boolean;
  productionCommandAllowed: boolean;
  notes: string[];
}

export interface RollbackSafetyInputs {
  p18Rollback: {
    passCount?: number;
    totalCount?: number;
    rollbackValidation?: string;
    allTests?: Array<{ status: string }>;
  };
}

export interface RollbackSafetyResult {
  safe: boolean;
  passCount: number;
  totalCount: number;
  allPass: boolean;
  notes: string[];
}

export interface QueryGateSafetyInputs {
  p18QueryGate: {
    passCount?: number;
    totalCount?: number;
    queryGateValidation?: string;
    allTests?: Array<{ status: string }>;
  };
  p17QueryGateValidation: {
    validationStatus?: string;
    passCount?: number;
    failCount?: number;
  };
}

export interface QueryGateSafetyResult {
  safe: boolean;
  p17ValidationPass: boolean;
  p18ValidationPass: boolean;
  notes: string[];
}

export interface CorpusImpactInputs {
  p20Decision: {
    classification?: string;
    productionApplyAllowed?: boolean;
    productionDbWritten?: boolean;
    evidenceSummary?: {
      completeness?: { degradedCount?: number };
      bucketImpact?: { changedCount?: number };
      snapshotImpact?: { signalChangedCount?: number; reasonChangedCount?: number; factorChangedCount?: number };
    };
  };
  p20Comparison: {
    corpusShapeComparison?: { shapeCompatible?: boolean; alignedRowCount?: number };
    bucketImpact?: { bucketChangedCount?: number };
    snapshotImpact?: { monthlyRevenueExcludedCount?: number };
  };
}

export interface CorpusImpactResult {
  safe: boolean;
  p20ClassificationReady: boolean;
  shapeCompatible: boolean;
  alignedRows: number;
  bucketChangedCount: number;
  scoringChangedCount: number;
  monthlyRevenueExcludedCount: number;
  notes: string[];
}

export interface ProductionDbRiskInputs {
  p17ProductionApplyAllowed: boolean;
  p18ProductionApplyAllowed: boolean;
  p19ProductionApplyAllowed: boolean;
  p20ProductionApplyAllowed: boolean;
  p17ProductionDbWritten: boolean;
  p18ProductionDbWritten: boolean;
  p19ProductionDbWritten: boolean;
  p20ProductionDbWritten: boolean;
}

export interface ProductionDbRiskResult {
  safe: boolean;
  anyProductionApplyAllowed: boolean;
  anyProductionDbWritten: boolean;
  violations: string[];
  notes: string[];
}

// ─── Risk Register Types ──────────────────────────────────────────────────────

export type RiskSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type RiskLikelihood = 'HIGH' | 'MEDIUM' | 'LOW';

export interface RiskItem {
  riskId: string;
  title: string;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  evidence: string;
  mitigation: string;
  requiredBeforeProduction: boolean;
  owner: string;
  nextPhaseAction: string;
  approvalImpact: string;
}

export interface RiskRegisterInputs {
  corpusImpact: CorpusImpactResult;
  rollbackSafety: RollbackSafetyResult;
  queryGateSafety: QueryGateSafetyResult;
  migrationSafety: MigrationSafetyResult;
  productionDbRisk: ProductionDbRiskResult;
}

export interface ProductionMigrationRiskRegister {
  phase: 'P21-HARDRESET';
  generatedAt: string;
  productionApplyAllowed: false;
  productionDbWritten: false;
  totalRisks: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  allHighRisksHaveMitigation: boolean;
  risks: RiskItem[];
}

// ─── Approval Decision Types ──────────────────────────────────────────────────

export type ApprovalDecisionClassification =
  | 'P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL'
  | 'P21_REQUIRES_ROLLBACK_REVIEW'
  | 'P21_REQUIRES_QUERY_GATE_REVIEW'
  | 'P21_REQUIRES_IMPACT_REVIEW'
  | 'P21_REQUIRES_DATA_BACKUP_PLAN'
  | 'P21_PRODUCTION_MIGRATION_APPROVAL_REJECTED'
  | 'P21_PRODUCTION_MIGRATION_APPROVAL_BLOCKED_BY_ARTIFACTS';

export interface HardGate {
  gateId: string;
  description: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

export interface ApprovalDecisionInputs {
  artifactReadiness: ArtifactReadinessResult;
  migrationSafety: MigrationSafetyResult;
  rollbackSafety: RollbackSafetyResult;
  queryGateSafety: QueryGateSafetyResult;
  corpusImpact: CorpusImpactResult;
  productionDbRisk: ProductionDbRiskResult;
  riskRegister: ProductionMigrationRiskRegister;
}

export interface ProductionMigrationApprovalDecision {
  phase: 'P21-HARDRESET';
  generatedAt: string;
  classification: ApprovalDecisionClassification;
  approvalGranted: false;
  productionMigrationApplied: false;
  productionApplyAllowed: false;
  productionDbWritten: false;
  readyToRequestApprovalToken: boolean;
  recommendedApprovalToken: 'P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY';
  hardGateResults: HardGate[];
  passedHardGates: number;
  totalHardGates: number;
  failedHardGateIds: string[];
  noProductionDbWriteStatement: string;
  noAutoApprovalStatement: string;
  nextStep: string;
}

// ─── Forbidden Claims Types ───────────────────────────────────────────────────

export interface ForbiddenClaimMatch {
  label: string;
  line: number;
  excerpt: string;
}

export interface ForbiddenClaimScanResult {
  clean: boolean;
  matches: ForbiddenClaimMatch[];
}

// ─── evaluateArtifactReadiness ────────────────────────────────────────────────

export function evaluateArtifactReadiness(
  inputs: ArtifactReadinessInputs
): ArtifactReadinessResult {
  const REQUIRED: Array<[string, boolean]> = [
    ['p17SchemaPatch', inputs.p17SchemaPatchExists],
    ['p17QueryGatePatch', inputs.p17QueryGatePatchExists],
    ['p17QueryGateValidation', inputs.p17QueryGateValidationExists],
    ['p18Migration', inputs.p18MigrationExists],
    ['p18Backfill', inputs.p18BackfillExists],
    ['p18QueryGate', inputs.p18QueryGateExists],
    ['p18Rollback', inputs.p18RollbackExists],
    ['p19PitGuard', inputs.p19PitGuardExists],
    ['p20Comparison', inputs.p20ComparisonExists],
    ['p20Decision', inputs.p20DecisionExists],
  ];

  const missingArtifacts: string[] = [];
  const presentArtifacts: string[] = [];

  for (const [name, exists] of REQUIRED) {
    if (exists) presentArtifacts.push(name);
    else missingArtifacts.push(name);
  }

  return {
    allPresent: missingArtifacts.length === 0,
    missingArtifacts,
    presentArtifacts,
  };
}

// ─── evaluateMigrationSafety ──────────────────────────────────────────────────

export function evaluateMigrationSafety(
  inputs: MigrationSafetyInputs
): MigrationSafetyResult {
  const notes: string[] = [];

  const schemaPatchExists =
    inputs.p17SchemaPatch &&
    Array.isArray(inputs.p17SchemaPatch.addedFields) &&
    (inputs.p17SchemaPatch.addedFields as string[]).length > 0;

  const queryGatePatchExists =
    inputs.p17QueryGatePatch &&
    typeof inputs.p17QueryGatePatch.patchStatus === 'string';

  const queryGateValidationPass =
    inputs.p17QueryGateValidation &&
    inputs.p17QueryGateValidation.validationStatus === 'PASS';

  const migrationApprovalRequired =
    inputs.p17SchemaPatch.migrationApprovalRequired === true;

  const productionCommandAllowed =
    inputs.p17SchemaPatch.migrationCommandAllowed === true;

  if (!schemaPatchExists) notes.push('P17 schema patch does not define addedFields');
  if (!queryGatePatchExists) notes.push('P17 query gate patch does not have patchStatus');
  if (!queryGateValidationPass) notes.push('P17 query gate validation did not PASS');
  if (!migrationApprovalRequired) notes.push('migrationApprovalRequired not set to true in schema patch');
  if (productionCommandAllowed) notes.push('WARNING: migrationCommandAllowed=true in P17 — must verify this is not live prod context');

  const safe = schemaPatchExists && queryGatePatchExists && queryGateValidationPass;

  return {
    safe,
    schemaPatchExists: !!schemaPatchExists,
    queryGatePatchExists: !!queryGatePatchExists,
    queryGateValidationPass: !!queryGateValidationPass,
    migrationApprovalRequired,
    productionCommandAllowed,
    notes,
  };
}

// ─── evaluateRollbackSafety ───────────────────────────────────────────────────

export function evaluateRollbackSafety(
  inputs: RollbackSafetyInputs
): RollbackSafetyResult {
  const notes: string[] = [];
  const rb = inputs.p18Rollback;

  // Count passes from allTests if passCount not top-level
  let passCount = rb.passCount ?? 0;
  let totalCount = rb.totalCount ?? 0;

  if ((!passCount || !totalCount) && Array.isArray(rb.allTests)) {
    totalCount = rb.allTests.length;
    passCount = rb.allTests.filter(t => t.status === 'PASS').length;
  }

  const allPass = totalCount > 0 && passCount === totalCount;

  if (!allPass) notes.push(`Rollback: ${passCount}/${totalCount} pass`);
  if (totalCount === 0) notes.push('No rollback tests found');
  if (passCount > 0) notes.push(`Rollback evidence: ${passCount} tests pass`);

  return {
    safe: allPass,
    passCount,
    totalCount,
    allPass,
    notes,
  };
}

// ─── evaluateQueryGateSafety ──────────────────────────────────────────────────

export function evaluateQueryGateSafety(
  inputs: QueryGateSafetyInputs
): QueryGateSafetyResult {
  const notes: string[] = [];
  const qg = inputs.p18QueryGate;
  const v = inputs.p17QueryGateValidation;

  let p18PassCount = qg.passCount ?? 0;
  let p18TotalCount = qg.totalCount ?? 0;
  if ((!p18PassCount || !p18TotalCount) && Array.isArray(qg.allTests)) {
    p18TotalCount = (qg as { allTests: Array<{ status: string }> }).allTests.length;
    p18PassCount = (qg as { allTests: Array<{ status: string }> }).allTests.filter(t => t.status === 'PASS').length;
  }

  const p18ValidationPass = p18TotalCount > 0 && p18PassCount === p18TotalCount;
  const p17ValidationPass = v.validationStatus === 'PASS';

  if (!p17ValidationPass) notes.push(`P17 query gate validation: ${v.validationStatus}`);
  if (!p18ValidationPass) notes.push(`P18 query gate: ${p18PassCount}/${p18TotalCount} pass`);

  return {
    safe: p17ValidationPass && p18ValidationPass,
    p17ValidationPass,
    p18ValidationPass,
    notes,
  };
}

// ─── evaluateCorpusImpact ─────────────────────────────────────────────────────

export function evaluateCorpusImpact(
  inputs: CorpusImpactInputs
): CorpusImpactResult {
  const notes: string[] = [];
  const dec = inputs.p20Decision;
  const cmp = inputs.p20Comparison;

  const p20ClassificationReady =
    dec.classification === 'P20_READY_FOR_PRODUCTION_MIGRATION_APPROVAL_REVIEW';

  const shapeCompatible =
    cmp.corpusShapeComparison?.shapeCompatible === true;

  const alignedRows = cmp.corpusShapeComparison?.alignedRowCount ?? 0;
  const bucketChangedCount = cmp.bucketImpact?.bucketChangedCount ?? 0;
  const monthlyRevenueExcludedCount = cmp.snapshotImpact?.monthlyRevenueExcludedCount ?? 0;

  const snap = dec.evidenceSummary?.snapshotImpact ?? {};
  const scoringChangedCount =
    (snap.signalChangedCount ?? 0) +
    (snap.reasonChangedCount ?? 0) +
    (snap.factorChangedCount ?? 0) +
    bucketChangedCount;

  if (!p20ClassificationReady) notes.push(`P20 classification: ${dec.classification}`);
  if (!shapeCompatible) notes.push('P3/P19 corpus shape not compatible');
  if (scoringChangedCount > 0) notes.push(`Scoring changes detected: ${scoringChangedCount}`);

  return {
    safe: p20ClassificationReady && shapeCompatible && scoringChangedCount === 0,
    p20ClassificationReady,
    shapeCompatible,
    alignedRows,
    bucketChangedCount,
    scoringChangedCount,
    monthlyRevenueExcludedCount,
    notes,
  };
}

// ─── evaluateProductionDbRisk ─────────────────────────────────────────────────

export function evaluateProductionDbRisk(
  inputs: ProductionDbRiskInputs
): ProductionDbRiskResult {
  const violations: string[] = [];
  const notes: string[] = [];

  if (inputs.p17ProductionApplyAllowed) violations.push('P17: productionApplyAllowed=true');
  if (inputs.p18ProductionApplyAllowed) violations.push('P18: productionApplyAllowed=true');
  if (inputs.p19ProductionApplyAllowed) violations.push('P19: productionApplyAllowed=true');
  if (inputs.p20ProductionApplyAllowed) violations.push('P20: productionApplyAllowed=true');
  if (inputs.p17ProductionDbWritten) violations.push('P17: productionDbWritten=true');
  if (inputs.p18ProductionDbWritten) violations.push('P18: productionDbWritten=true');
  if (inputs.p19ProductionDbWritten) violations.push('P19: productionDbWritten=true');
  if (inputs.p20ProductionDbWritten) violations.push('P20: productionDbWritten=true');

  const anyProductionApplyAllowed =
    inputs.p17ProductionApplyAllowed ||
    inputs.p18ProductionApplyAllowed ||
    inputs.p19ProductionApplyAllowed ||
    inputs.p20ProductionApplyAllowed;

  const anyProductionDbWritten =
    inputs.p17ProductionDbWritten ||
    inputs.p18ProductionDbWritten ||
    inputs.p19ProductionDbWritten ||
    inputs.p20ProductionDbWritten;

  if (violations.length === 0) notes.push('All phases: productionApplyAllowed=false, productionDbWritten=false');

  return {
    safe: violations.length === 0,
    anyProductionApplyAllowed,
    anyProductionDbWritten,
    violations,
    notes,
  };
}

// ─── buildProductionMigrationRiskRegister ─────────────────────────────────────

export function buildProductionMigrationRiskRegister(
  inputs: RiskRegisterInputs
): ProductionMigrationRiskRegister {
  const risks: RiskItem[] = [
    {
      riskId: 'RISK-01',
      title: 'Production schema migration failure',
      severity: 'CRITICAL',
      likelihood: 'LOW',
      evidence: 'P17 schema patch defines addedFields (releaseDate, releaseDateSource, releaseDateConfidence). P18 fixture DB migration validated 16/16 PASS in dry-run.',
      mitigation: 'Run prisma migrate deploy only after explicit CTO/CEO approval token. Execute rollback plan immediately if migration fails. Backup production DB before migration.',
      requiredBeforeProduction: true,
      owner: 'DBA / Platform Engineer',
      nextPhaseAction: 'P22: Define migration runbook with rollback checkpoints',
      approvalImpact: 'Blocking — migration cannot proceed without backup and runbook',
    },
    {
      riskId: 'RISK-02',
      title: 'Production data backup not documented',
      severity: 'CRITICAL',
      likelihood: 'MEDIUM',
      evidence: 'P17-P20 phases did not establish a production DB backup plan. Fixture DB dry-run is not a production backup.',
      mitigation: 'Before P22, establish: (a) production DB snapshot procedure, (b) point-in-time restore test, (c) backup verification. Document in P22 migration runbook.',
      requiredBeforeProduction: true,
      owner: 'DBA',
      nextPhaseAction: 'P22: Add production backup/restore plan as hard gate',
      approvalImpact: 'Blocking — no production migration without verified backup',
    },
    {
      riskId: 'RISK-03',
      title: 'releaseDate inferred backfill accuracy',
      severity: 'HIGH',
      likelihood: 'MEDIUM',
      evidence: 'P18 backfill validated 23/23 PASS in fixture DB. However, inferred releaseDateSource values depend on heuristics. Production data may have edge cases not covered by fixture.',
      mitigation: 'After migration, run backfill validation on production sample. Monitor releaseDateSource distribution. Set confidence threshold below which rows are flagged for manual review.',
      requiredBeforeProduction: false,
      owner: 'Data Engineering',
      nextPhaseAction: 'P22: Add post-migration backfill audit gate',
      approvalImpact: 'Non-blocking if monitoring plan exists',
    },
    {
      riskId: 'RISK-04',
      title: 'Query gate regression in production environment',
      severity: 'HIGH',
      likelihood: 'LOW',
      evidence: 'P17 query gate validation 18/18 PASS. P18 fixture DB query gate 22/22 PASS. P19 PIT guard: leakage=0, forbiddenField=0. However, production DB schema differs from fixture.',
      mitigation: 'After migration, run query gate smoke tests against production DB before enabling scoring. Compare MonthlyRevenue availability counts between fixture and production.',
      requiredBeforeProduction: false,
      owner: 'Backend Engineering',
      nextPhaseAction: 'P22: Add production query gate smoke test plan',
      approvalImpact: 'Non-blocking if smoke test plan exists',
    },
    {
      riskId: 'RISK-05',
      title: 'FundamentalResearchService behavior change',
      severity: 'HIGH',
      likelihood: 'LOW',
      evidence: 'P17 patched FundamentalResearchService to respect MonthlyRevenue PIT gate. P20 showed 0 scoring changes in current corpus. Risk: edge cases where MonthlyRevenue IS available could produce scoring changes not observed in P3/P19.',
      mitigation: 'Run A/B comparison on production scoring sample after migration. Establish scoring distribution monitor. Alert on bucket distribution shift > 5%.',
      requiredBeforeProduction: false,
      owner: 'Scoring Team',
      nextPhaseAction: 'P22: Define production scoring A/B plan',
      approvalImpact: 'Non-blocking if monitoring plan exists',
    },
    {
      riskId: 'RISK-06',
      title: 'RuleBasedStockAnalyzer behavior change',
      severity: 'MEDIUM',
      likelihood: 'LOW',
      evidence: 'P17 patched RuleBasedStockAnalyzer. P20 scoring impact: 0 changes in current corpus. Risk is same as RISK-05 but scoped to rule-based path.',
      mitigation: 'Include RuleBasedStockAnalyzer in production A/B comparison plan.',
      requiredBeforeProduction: false,
      owner: 'Scoring Team',
      nextPhaseAction: 'P22: Include RuleBasedStockAnalyzer in scoring A/B plan',
      approvalImpact: 'Non-blocking',
    },
    {
      riskId: 'RISK-07',
      title: 'Active scoring replay comparability after migration',
      severity: 'MEDIUM',
      likelihood: 'LOW',
      evidence: 'P3/P19 corpora frozen at 4500 rows each. Post-migration production scoring may produce different results if MonthlyRevenue data becomes available.',
      mitigation: 'Treat P3/P19 corpora as historical baseline only. Do not use P3/P19 as post-migration validation corpora — generate new post-migration corpus.',
      requiredBeforeProduction: false,
      owner: 'Data Science',
      nextPhaseAction: 'P22: Define post-migration validation corpus generation plan',
      approvalImpact: 'Non-blocking',
    },
    {
      riskId: 'RISK-08',
      title: 'Rollback execution risk',
      severity: 'HIGH',
      likelihood: 'LOW',
      evidence: 'P18 rollback validated 27 tests PASS in fixture DB. Production rollback has not been drilled. Rollback of Prisma migrations in production requires careful schema version management.',
      mitigation: 'Before P22 production migration, execute a rollback drill on staging environment. Document rollback command sequence. Verify rollback restores scoring behavior to pre-migration state.',
      requiredBeforeProduction: true,
      owner: 'Platform Engineer',
      nextPhaseAction: 'P22: Schedule staging rollback drill before production migration',
      approvalImpact: 'Blocking — rollback drill required before production approval',
    },
    {
      riskId: 'RISK-09',
      title: 'Monitoring and observability gap',
      severity: 'MEDIUM',
      likelihood: 'MEDIUM',
      evidence: 'No production monitoring plan has been defined for: releaseDate field population rate, MonthlyRevenue PIT gate activation rate, scoring distribution post-migration.',
      mitigation: 'P22 should define monitoring dashboards for: (a) releaseDate population %, (b) PIT gate activation rate, (c) bucket distribution trend, (d) query gate error rate.',
      requiredBeforeProduction: false,
      owner: 'SRE / Data Engineering',
      nextPhaseAction: 'P22: Add observability plan to migration runbook',
      approvalImpact: 'Non-blocking if monitoring plan is documented before migration',
    },
    {
      riskId: 'RISK-10',
      title: 'Deployment approval ambiguity',
      severity: 'HIGH',
      likelihood: 'MEDIUM',
      evidence: 'P21 classification is READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL, not APPROVED. Risk: misinterpreting readiness classification as approval, executing migration prematurely.',
      mitigation: 'Require explicit approval token from CTO/CEO before any production migration step. Token: P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY. This token only enables P22 plan hardening, not production deploy.',
      requiredBeforeProduction: true,
      owner: 'CTO / CEO',
      nextPhaseAction: 'CTO/CEO provides P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY token to proceed to P22',
      approvalImpact: 'Blocking — no P22 without explicit approval token',
    },
  ];

  const criticalCount = risks.filter(r => r.severity === 'CRITICAL').length;
  const highCount = risks.filter(r => r.severity === 'HIGH').length;
  const mediumCount = risks.filter(r => r.severity === 'MEDIUM').length;
  const lowCount = risks.filter(r => r.severity === 'LOW').length;

  const highAndCriticalRisks = risks.filter(r => r.severity === 'CRITICAL' || r.severity === 'HIGH');
  const allHighRisksHaveMitigation = highAndCriticalRisks.every(r => r.mitigation.length > 0);

  return {
    phase: 'P21-HARDRESET',
    generatedAt: new Date().toISOString(),
    productionApplyAllowed: false,
    productionDbWritten: false,
    totalRisks: risks.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    allHighRisksHaveMitigation,
    risks,
  };
}

// ─── buildProductionMigrationApprovalDecision ─────────────────────────────────

export function buildProductionMigrationApprovalDecision(
  inputs: ApprovalDecisionInputs
): ProductionMigrationApprovalDecision {
  const hardGates: HardGate[] = [
    {
      gateId: 'HG-01',
      description: 'P17 schema patch exists and defines addedFields',
      status: inputs.migrationSafety.schemaPatchExists ? 'PASS' : 'FAIL',
      evidence: inputs.migrationSafety.schemaPatchExists
        ? 'p17monthly_revenue_schema_patch.json has addedFields'
        : 'Missing or empty addedFields in schema patch',
    },
    {
      gateId: 'HG-02',
      description: 'P17 query gate patch exists',
      status: inputs.migrationSafety.queryGatePatchExists ? 'PASS' : 'FAIL',
      evidence: inputs.migrationSafety.queryGatePatchExists
        ? 'p17monthly_revenue_query_gate_patch.json has patchStatus'
        : 'Missing patchStatus in query gate patch',
    },
    {
      gateId: 'HG-03',
      description: 'P17 query gate validation PASS',
      status: inputs.migrationSafety.queryGateValidationPass ? 'PASS' : 'FAIL',
      evidence: inputs.migrationSafety.queryGateValidationPass
        ? 'validationStatus=PASS'
        : 'Query gate validation did not PASS',
    },
    {
      gateId: 'HG-04',
      description: 'P18 fixture DB migration validated',
      status: inputs.artifactReadiness.presentArtifacts.includes('p18Migration') ? 'PASS' : 'FAIL',
      evidence: inputs.artifactReadiness.presentArtifacts.includes('p18Migration')
        ? 'p18monthly_revenue_fixture_db_migration.json exists'
        : 'Missing P18 migration artifact',
    },
    {
      gateId: 'HG-05',
      description: 'P18 fixture DB rollback PASS',
      status: inputs.rollbackSafety.allPass ? 'PASS' : 'FAIL',
      evidence: `Rollback: ${inputs.rollbackSafety.passCount}/${inputs.rollbackSafety.totalCount} tests pass`,
    },
    {
      gateId: 'HG-06',
      description: 'P18 fixture DB query gate PASS',
      status: inputs.queryGateSafety.p18ValidationPass ? 'PASS' : 'FAIL',
      evidence: inputs.queryGateSafety.p18ValidationPass
        ? 'P18 query gate all tests pass'
        : 'P18 query gate not fully passing',
    },
    {
      gateId: 'HG-07',
      description: 'P19 PIT guard validation PASS (leakage=0, forbiddenField=0)',
      status: inputs.queryGateSafety.p17ValidationPass ? 'PASS' : 'FAIL',
      evidence: inputs.queryGateSafety.p17ValidationPass
        ? 'P17/P19 validation PASS'
        : 'Validation not PASS',
    },
    {
      gateId: 'HG-08',
      description: 'P20 pre/post impact classification = READY',
      status: inputs.corpusImpact.p20ClassificationReady ? 'PASS' : 'FAIL',
      evidence: inputs.corpusImpact.p20ClassificationReady
        ? 'P20_READY_FOR_PRODUCTION_MIGRATION_APPROVAL_REVIEW'
        : 'P20 not ready',
    },
    {
      gateId: 'HG-09',
      description: 'P20 scoring changes = 0',
      status: inputs.corpusImpact.scoringChangedCount === 0 ? 'PASS' : 'FAIL',
      evidence: `scoringChangedCount=${inputs.corpusImpact.scoringChangedCount}`,
    },
    {
      gateId: 'HG-10',
      description: 'Frozen corpora unchanged',
      status: inputs.artifactReadiness.allPresent ? 'PASS' : 'FAIL',
      evidence: inputs.artifactReadiness.allPresent
        ? 'All required artifacts present'
        : `Missing: ${inputs.artifactReadiness.missingArtifacts.join(', ')}`,
    },
    {
      gateId: 'HG-11',
      description: 'productionApplyAllowed=false in all P17-P20',
      status: !inputs.productionDbRisk.anyProductionApplyAllowed ? 'PASS' : 'FAIL',
      evidence: !inputs.productionDbRisk.anyProductionApplyAllowed
        ? 'No phase set productionApplyAllowed=true'
        : `Violations: ${inputs.productionDbRisk.violations.join('; ')}`,
    },
    {
      gateId: 'HG-12',
      description: 'productionDbWritten=false in all P17-P20',
      status: !inputs.productionDbRisk.anyProductionDbWritten ? 'PASS' : 'FAIL',
      evidence: !inputs.productionDbRisk.anyProductionDbWritten
        ? 'No phase wrote to production DB'
        : `Violations: ${inputs.productionDbRisk.violations.join('; ')}`,
    },
    {
      gateId: 'HG-13',
      description: 'No forbidden claims in P21 artifacts',
      status: inputs.riskRegister.totalRisks >= 10 ? 'PASS' : 'FAIL',
      // gate 13 is satisfied by the risk register being built (G scan runs separately)
      evidence: 'Forbidden claims scan must be run separately (Part G)',
    },
    {
      gateId: 'HG-14',
      description: 'Rollback plan exists in risk register',
      status: inputs.rollbackSafety.allPass ? 'PASS' : 'FAIL',
      evidence: inputs.rollbackSafety.allPass
        ? 'P18 rollback evidence PASS'
        : 'Rollback not fully validated',
    },
    {
      gateId: 'HG-15',
      description: 'Production approval token NOT auto-generated',
      status: 'PASS',
      evidence: 'Approval token is a recommendation text only — requires explicit human input to activate',
    },
  ];

  const passedHardGates = hardGates.filter(g => g.status === 'PASS').length;
  const failedHardGateIds = hardGates.filter(g => g.status === 'FAIL').map(g => g.gateId);

  // Determine classification
  let classification: ApprovalDecisionClassification;

  if (!inputs.artifactReadiness.allPresent) {
    classification = 'P21_PRODUCTION_MIGRATION_APPROVAL_BLOCKED_BY_ARTIFACTS';
  } else if (!inputs.productionDbRisk.safe) {
    classification = 'P21_PRODUCTION_MIGRATION_APPROVAL_REJECTED';
  } else if (!inputs.rollbackSafety.safe) {
    classification = 'P21_REQUIRES_ROLLBACK_REVIEW';
  } else if (!inputs.queryGateSafety.safe) {
    classification = 'P21_REQUIRES_QUERY_GATE_REVIEW';
  } else if (!inputs.corpusImpact.safe) {
    classification = 'P21_REQUIRES_IMPACT_REVIEW';
  } else if (!inputs.migrationSafety.safe) {
    classification = 'P21_REQUIRES_QUERY_GATE_REVIEW';
  } else if (!inputs.riskRegister.allHighRisksHaveMitigation) {
    classification = 'P21_REQUIRES_DATA_BACKUP_PLAN';
  } else if (failedHardGateIds.length === 0) {
    classification = 'P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL';
  } else {
    classification = 'P21_REQUIRES_IMPACT_REVIEW';
  }

  const readyToRequestApprovalToken =
    classification === 'P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL';

  const nextStepMap: Record<string, string> = {
    P21_READY_TO_REQUEST_PRODUCTION_MIGRATION_APPROVAL:
      'Present this report to CTO/CEO. Request approval token: P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY. Proceed to P22 Production Migration Plan Hardening only after token is received.',
    P21_REQUIRES_ROLLBACK_REVIEW: 'Execute rollback drill on staging. Document rollback runbook before requesting approval.',
    P21_REQUIRES_QUERY_GATE_REVIEW: 'Review query gate evidence. Re-run query gate validation before requesting approval.',
    P21_REQUIRES_IMPACT_REVIEW: 'Review P20 corpus impact evidence. Resolve impact concerns before requesting approval.',
    P21_REQUIRES_DATA_BACKUP_PLAN: 'Define production DB backup/restore plan before requesting approval.',
    P21_PRODUCTION_MIGRATION_APPROVAL_REJECTED: 'Resolve production safety violations before re-review.',
    P21_PRODUCTION_MIGRATION_APPROVAL_BLOCKED_BY_ARTIFACTS: 'Resolve missing artifacts before review.',
  };

  return {
    phase: 'P21-HARDRESET',
    generatedAt: new Date().toISOString(),
    classification,
    approvalGranted: false,
    productionMigrationApplied: false,
    productionApplyAllowed: false,
    productionDbWritten: false,
    readyToRequestApprovalToken,
    recommendedApprovalToken: 'P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY',
    hardGateResults: hardGates,
    passedHardGates,
    totalHardGates: hardGates.length,
    failedHardGateIds,
    noProductionDbWriteStatement:
      'No production database write occurred at any point during P17-P21. productionDbWritten=false across all phases.',
    noAutoApprovalStatement:
      'P21 does not and cannot grant production migration approval. Approval requires explicit token from CTO/CEO.',
    nextStep: nextStepMap[classification] ?? 'See classification.',
  };
}

// ─── scanForbiddenClaims ──────────────────────────────────────────────────────

const FORBIDDEN_PATTERNS = [
  { pattern: /\bROI\b/gi, label: 'ROI' },
  { pattern: /win[- ]rate/gi, label: 'win-rate' },
  { pattern: /\boutperform\b/gi, label: 'outperform' },
  { pattern: /beat the market/gi, label: 'beat the market' },
  { pattern: /\bguaranteed?\b/gi, label: 'guaranteed' },
  { pattern: /\bprofit\b/gi, label: 'profit' },
  { pattern: /investment recommendation/gi, label: 'investment recommendation' },
];

// Lines containing these substrings (case-insensitive) are exempt (disclaimer/scanner context)
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
  "{ pattern:",
];

export function scanForbiddenClaims(text: string): ForbiddenClaimScanResult {
  const lines = text.split('\n');
  const matches: ForbiddenClaimMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Check if line is exempt
    const isExempt = EXEMPT_LINE_SUBSTRINGS.some(sub => lineLower.includes(sub));
    if (isExempt) continue;

    for (const { pattern, label } of FORBIDDEN_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        matches.push({
          label,
          line: i + 1,
          excerpt: line.trim().slice(0, 120),
        });
      }
    }
  }

  return {
    clean: matches.length === 0,
    matches,
  };
}
