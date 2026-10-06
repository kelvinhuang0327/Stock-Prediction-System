'use strict';
/**
 * P21-HARDRESET Part D
 * Build Production Migration Risk Register
 *
 * Outputs:
 *   outputs/online_validation/p21production_migration_risk_register.json
 *   outputs/online_validation/p21production_migration_risk_register.md
 *
 * CONSTRAINTS:
 * - Does NOT write to production DB
 * - Does NOT apply production migration
 * - No ROI / win-rate / alpha / edge / profit / outperform / buy / sell claims
 */

'use strict';
const fs = require('fs');
const path = require('path');

const OUT_DIR = 'outputs/online_validation';

const now = new Date().toISOString();

const risks = [
  {
    riskId: 'RISK-01',
    title: 'Production schema migration failure',
    severity: 'CRITICAL',
    likelihood: 'LOW',
    description: 'Prisma migration may fail on production SQLite/PostgreSQL if the DB state diverges from migration history.',
    evidence: 'P18 fixture DB migration passed (16/16). No production migration attempted yet.',
    mitigation: 'Run migration in a staging environment first. Capture full DB backup before applying. Verify schema idempotency.',
    requiredBeforeProduction: true,
    owner: 'Engineering Lead',
    nextPhaseAction: 'P22: Define staging migration runbook',
    approvalImpact: 'Must be resolved before CTO approval token is used',
  },
  {
    riskId: 'RISK-02',
    title: 'Production data backup not documented',
    severity: 'CRITICAL',
    likelihood: 'MEDIUM',
    description: 'No production DB backup procedure is documented in current artifacts. If migration causes data loss, recovery path is unclear.',
    evidence: 'P18 rollback tested on fixture DB only (27/27 PASS). Production backup not in scope for P17-P21.',
    mitigation: 'Document production backup procedure before applying migration. Verify backup is restorable.',
    requiredBeforeProduction: true,
    owner: 'DevOps / Engineering Lead',
    nextPhaseAction: 'P22: Document and test production backup/restore procedure',
    approvalImpact: 'CTO/CEO token should not be used until backup plan is documented',
  },
  {
    riskId: 'RISK-03',
    title: 'releaseDate inferred backfill accuracy',
    severity: 'HIGH',
    likelihood: 'MEDIUM',
    description: 'releaseDate values were inferred from filing metadata. Inferred dates may differ from actual announcement dates for a subset of records.',
    evidence: 'P17 schema patch adds releaseDateSource and releaseDateConfidence fields to track inference quality. P18 backfill 23/23 PASS (fixture data).',
    mitigation: 'Review releaseDateConfidence distribution in production data. Flag LOW-confidence records for manual review.',
    requiredBeforeProduction: false,
    owner: 'Data Engineering',
    nextPhaseAction: 'P22: Sample production releaseDateConfidence distribution',
    approvalImpact: 'Informational — does not block approval token if backup and staging are complete',
  },
  {
    riskId: 'RISK-04',
    title: 'Query gate regression in production',
    severity: 'HIGH',
    likelihood: 'LOW',
    description: 'Production query gate behavior may differ from fixture DB if data volumes or indexing diverge.',
    evidence: 'P17 query gate validation ALL_PASS (18/18). P18 query gate PASS (22/22). Gate logic is purely field-existence based.',
    mitigation: 'Run query gate checks against production DB shadow after migration (read-only). Gate logic does not depend on row values.',
    requiredBeforeProduction: false,
    owner: 'Engineering',
    nextPhaseAction: 'P22: Add production query gate smoke test step to runbook',
    approvalImpact: 'Low risk; gate logic validated thoroughly in prior phases',
  },
  {
    riskId: 'RISK-05',
    title: 'FundamentalResearchService behavior change',
    severity: 'HIGH',
    likelihood: 'LOW',
    description: 'FundamentalResearchService may begin including MonthlyRevenue fields post-migration, changing data returned to callers.',
    evidence: 'P20 comparison showed 0 signal changes and 0 bucket changes across 4500 rows. MonthlyRevenue gated out by PIT guard.',
    mitigation: 'PIT guard remains active post-migration. Only releaseDate < queryDate rows admitted. No behavior change expected at service boundary.',
    requiredBeforeProduction: false,
    owner: 'Backend Engineering',
    nextPhaseAction: 'P22: Add FundamentalResearchService integration test in staging',
    approvalImpact: 'PIT guard is the primary control; validated at P19',
  },
  {
    riskId: 'RISK-06',
    title: 'RuleBasedStockAnalyzer behavior change',
    severity: 'MEDIUM',
    likelihood: 'LOW',
    description: 'RuleBasedStockAnalyzer may change scoring behavior if MonthlyRevenue fields are exposed post-migration.',
    evidence: 'P20 confirmed 0 scoring changes (snapshotImpact.signalChangedCount=0, bucketImpact.bucketChangedCount=0).',
    mitigation: 'Scoring formula is not modified by migration. MonthlyRevenue remains gated until releaseDate is available.',
    requiredBeforeProduction: false,
    owner: 'Scoring Engineering',
    nextPhaseAction: 'Monitor scoring output in production after migration via canary check',
    approvalImpact: 'Low risk; scoring verified unchanged at P20',
  },
  {
    riskId: 'RISK-07',
    title: 'Active scoring replay comparability',
    severity: 'MEDIUM',
    likelihood: 'LOW',
    description: 'Post-migration replay results may drift if production data differs from the p3/p19 frozen corpora.',
    evidence: 'p3active_scoring_historical_replay_corpus.jsonl=4500 rows. p19active_scoring_pit_replay_corpus.jsonl=4500 rows. Both frozen.',
    mitigation: 'Freeze corpora before migration. Post-migration comparison uses same corpus so drift is detectable.',
    requiredBeforeProduction: false,
    owner: 'Validation Engineering',
    nextPhaseAction: 'P22: Re-run P20 comparison after production migration to verify 0 drift',
    approvalImpact: 'Baseline frozen — comparison methodology preserved',
  },
  {
    riskId: 'RISK-08',
    title: 'Rollback execution risk',
    severity: 'HIGH',
    likelihood: 'LOW',
    description: 'Production rollback may not be fully reversible if migration is partially applied before failure.',
    evidence: 'P18 rollback tested (27/27 PASS) on fixture DB. Prisma down migrations are additive-only.',
    mitigation: 'Ensure full DB backup before migration. Test rollback on staging before production. Document exact rollback steps.',
    requiredBeforeProduction: true,
    owner: 'Engineering Lead / DevOps',
    nextPhaseAction: 'P22: Rollback staging rehearsal as a prerequisite step',
    approvalImpact: 'Required: staging rollback rehearsal before production token use',
  },
  {
    riskId: 'RISK-09',
    title: 'Monitoring / observability gap post-migration',
    severity: 'MEDIUM',
    likelihood: 'MEDIUM',
    description: 'No specific monitoring for MonthlyRevenue PIT gate activation is documented for production environment.',
    evidence: 'P19 PIT guard validated on corpus. No production monitoring dashboards created in P17-P21.',
    mitigation: 'Add monitoring for: MonthlyRevenue rows admitted vs excluded, releaseDateConfidence distribution, query gate errors.',
    requiredBeforeProduction: false,
    owner: 'Platform Engineering',
    nextPhaseAction: 'P22: Define MonthlyRevenue observability checklist',
    approvalImpact: 'Recommended before Go-Live but not a hard blocker for token request',
  },
  {
    riskId: 'RISK-10',
    title: 'Deployment approval ambiguity',
    severity: 'HIGH',
    likelihood: 'MEDIUM',
    description: 'If P22 proceeds without a clear CTO/CEO approval token hand-off process, the production migration may be applied without proper authorization.',
    evidence: 'recommendedApprovalToken=P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY must be provided by CTO/CEO.',
    mitigation: 'Document token hand-off process. P22 script must validate token before proceeding. Token must not be auto-generated.',
    requiredBeforeProduction: true,
    owner: 'CTO / CEO',
    nextPhaseAction: 'CTO/CEO to provide token after reviewing this P21 report. P22 must gate on token.',
    approvalImpact: 'Hard blocker: production migration MUST NOT proceed without explicit token',
  },
];

const criticalHighRisks = risks.filter(r => r.severity === 'CRITICAL' || r.severity === 'HIGH');
const requiredBeforeProduction = risks.filter(r => r.requiredBeforeProduction);

const register = {
  phase: 'P21-HARDRESET',
  part: 'D',
  generatedAt: now,
  description: 'Production Migration Risk Register — P21',
  riskCount: risks.length,
  criticalHighRiskCount: criticalHighRisks.length,
  requiredBeforeProductionCount: requiredBeforeProduction.length,
  risks,
  summary: {
    critical: risks.filter(r => r.severity === 'CRITICAL').length,
    high: risks.filter(r => r.severity === 'HIGH').length,
    medium: risks.filter(r => r.severity === 'MEDIUM').length,
    low: risks.filter(r => r.severity === 'LOW').length,
    requiredBeforeProduction: requiredBeforeProduction.map(r => r.riskId),
  },
  approvalGranted: false,
  productionMigrationApplied: false,
};

// ── Write JSON ────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
const jsonOut = path.join(OUT_DIR, 'p21production_migration_risk_register.json');
fs.writeFileSync(jsonOut, JSON.stringify(register, null, 2));
console.log('Written:', jsonOut);

// ── Write Markdown ────────────────────────────────────────────────────────────
const severityEmoji = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' };

const md = `# P21 Production Migration Risk Register

**Phase**: P21-HARDRESET Part D  
**Generated**: ${now}  
**Total Risks**: ${risks.length}  
**Critical/High**: ${criticalHighRisks.length}  
**Required Before Production**: ${requiredBeforeProduction.length} (${requiredBeforeProduction.map(r => r.riskId).join(', ')})

---

## Risk Summary

| Severity | Count |
|----------|-------|
| CRITICAL | ${register.summary.critical} |
| HIGH | ${register.summary.high} |
| MEDIUM | ${register.summary.medium} |
| LOW | ${register.summary.low} |

---

## Risk Items

${risks.map(r => `### ${r.riskId}: ${r.title}

| Field | Value |
|-------|-------|
| Severity | ${severityEmoji[r.severity] || ''} ${r.severity} |
| Likelihood | ${r.likelihood} |
| Required Before Production | ${r.requiredBeforeProduction ? '✅ YES' : 'No'} |
| Owner | ${r.owner} |

**Description**: ${r.description}

**Evidence**: ${r.evidence}

**Mitigation**: ${r.mitigation}

**Next Phase Action**: ${r.nextPhaseAction}

**Approval Impact**: ${r.approvalImpact}
`).join('\n---\n\n')}

---

## Production Safety Statement

- approvalGranted: **false**
- productionMigrationApplied: **false**
- Production DB not written at any phase (P17-P21)
- CTO/CEO must provide token \`P21_APPROVE_PRODUCTION_MIGRATION_PLAN_ONLY\` before P22 execution
`;

const mdOut = path.join(OUT_DIR, 'p21production_migration_risk_register.md');
fs.writeFileSync(mdOut, md);
console.log('Written:', mdOut);

console.log('');
console.log('P21 Part D Complete');
console.log('Risk count:', risks.length);
console.log('Required before production:', requiredBeforeProduction.map(r => r.riskId).join(', '));
