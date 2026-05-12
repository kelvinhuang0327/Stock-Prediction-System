'use strict';
/**
 * P14-HARDRESET PART A: Approval Gate + Pre-flight Script
 *
 * Checks:
 * 1. Approval token presence (P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY)
 * 2. P13 artifacts exist and are structurally valid
 * 3. Frozen corpus line counts unchanged
 *
 * Disclaimer: Does not write production DB. Does not constitute investment advice.
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
});
require('tsconfig-paths').register({
  baseUrl: require('path').resolve(__dirname, '..'),
  paths: { '@/*': ['src/*'] },
});

const fs = require('fs');
const path = require('path');
const { detectApprovalToken, validateMigrationApprovalScope } = require('../src/lib/onlineValidation/P14MonthlyRevenueMigrationGateUtils');

// ── Config ────────────────────────────────────────────────────────────────────

const PHASE = 'P14';
const PART = 'A';
const OUTPUTS_DIR = 'outputs/online_validation';

// Approval token not present in this run — P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY must appear explicitly
const APPROVAL_TOKEN_INPUT = process.env.P14_APPROVAL_TOKEN || '';

const REQUIRED_P13_ARTIFACTS = [
  'outputs/online_validation/p13monthly_revenue_final_report.md',
  'outputs/online_validation/p13monthly_revenue_source_audit.json',
  'outputs/online_validation/p13monthly_revenue_migration_plan.json',
  'outputs/online_validation/p13monthly_revenue_pit_gate_validation.json',
  'outputs/online_validation/p12pit_feature_contract_v0.json',
];

const FROZEN_CORPUS = [
  { path: 'outputs/online_validation/simulation_snapshot_corpus.jsonl', expected: 60 },
  { path: 'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl', expected: 4500 },
  { path: 'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl', expected: 9900 },
  { path: 'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl', expected: 4500 },
];

// ── Run ───────────────────────────────────────────────────────────────────────

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim().split('\n').length;
}

function checkP13Artifact(artifactPath) {
  const exists = fs.existsSync(artifactPath);
  if (!exists) return { path: artifactPath, status: 'MISSING', detail: 'File not found' };

  if (artifactPath.endsWith('.json')) {
    try {
      const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      return { path: artifactPath, status: 'OK', keys: Object.keys(parsed).length };
    } catch (e) {
      return { path: artifactPath, status: 'PARSE_ERROR', detail: String(e) };
    }
  }
  const size = fs.statSync(artifactPath).size;
  return { path: artifactPath, status: 'OK', size };
}

function validateP13Conclusions() {
  const checks = [];
  try {
    const mp = JSON.parse(fs.readFileSync('outputs/online_validation/p13monthly_revenue_migration_plan.json', 'utf8'));
    checks.push({ check: 'productionSafety.writesProductionDb', value: mp.productionSafety && mp.productionSafety.writesProductionDb, expected: false, pass: (mp.productionSafety && mp.productionSafety.writesProductionDb) === false });

    const pv = JSON.parse(fs.readFileSync('outputs/online_validation/p13monthly_revenue_pit_gate_validation.json', 'utf8'));
    checks.push({ check: 'pitGate.validationStatus', value: pv.validationStatus, expected: 'PASS', pass: pv.validationStatus === 'PASS' });
    checks.push({ check: 'pitGate.passed', value: pv.passed, expected: 35, pass: pv.passed === 35 });
    checks.push({ check: 'pitGate.failed', value: pv.failed, expected: 0, pass: pv.failed === 0 });

    const sa = JSON.parse(fs.readFileSync('outputs/online_validation/p13monthly_revenue_source_audit.json', 'utf8'));
    checks.push({ check: 'sourceAudit.dataAuditMode', value: sa.dataAuditMode, expected: 'SCHEMA_ONLY', pass: sa.dataAuditMode === 'SCHEMA_ONLY' });
    checks.push({ check: 'sourceAudit.pitRisk', value: sa.currentPitRisk && sa.currentPitRisk.overallRisk, expected: 'HIGH', pass: sa.currentPitRisk && sa.currentPitRisk.overallRisk === 'HIGH' });

    const fr = fs.readFileSync('outputs/online_validation/p13monthly_revenue_final_report.md', 'utf8');
    checks.push({ check: 'finalReport.classification', value: 'present', expected: 'P13_MONTHLY_REVENUE_REQUIRES_SCHEMA_MIGRATION_APPROVAL', pass: fr.includes('P13_MONTHLY_REVENUE_REQUIRES_SCHEMA_MIGRATION_APPROVAL') });
  } catch (e) {
    checks.push({ check: 'P13_CONCLUSION_CHECK', value: 'ERROR', pass: false, detail: String(e) });
  }
  return checks;
}

function run() {
  console.log(`\n=== P14 PART A: Approval Gate + Pre-flight ===\n`);

  // 1. Approval token check
  const tokenResult = detectApprovalToken(APPROVAL_TOKEN_INPUT);
  const scope = validateMigrationApprovalScope(tokenResult.approvalStatus);
  console.log(`Approval token present: ${tokenResult.tokenPresent}`);
  console.log(`Approval status: ${tokenResult.approvalStatus}`);
  console.log(`Note: ${tokenResult.note}`);

  // 2. P13 artifact checks
  console.log('\n--- P13 Artifact Checks ---');
  const artifactResults = REQUIRED_P13_ARTIFACTS.map(checkP13Artifact);
  const artifactMissing = artifactResults.filter(r => r.status !== 'OK');
  artifactResults.forEach(r => {
    const icon = r.status === 'OK' ? '✓' : '✗';
    console.log(`  ${icon} ${r.path} [${r.status}]`);
  });
  const allArtifactsPresent = artifactMissing.length === 0;

  // 3. P13 conclusion validation
  console.log('\n--- P13 Conclusion Validation ---');
  const conclusionChecks = validateP13Conclusions();
  conclusionChecks.forEach(c => {
    const icon = c.pass ? '✓' : '✗';
    console.log(`  ${icon} ${c.check}: ${c.value}`);
  });
  const allConclusionsPass = conclusionChecks.every(c => c.pass);

  // 4. Frozen corpus check
  console.log('\n--- Frozen Corpus Check ---');
  const corpusResults = FROZEN_CORPUS.map(({ path: p, expected }) => {
    try {
      const actual = countLines(p);
      const pass = actual === expected;
      console.log(`  ${pass ? '✓' : '✗'} ${p}: ${actual} lines (expected ${expected})`);
      return { path: p, expected, actual, pass };
    } catch (e) {
      console.log(`  ✗ ${p}: ERROR - ${e}`);
      return { path: p, expected, actual: null, pass: false };
    }
  });
  const allCorpusFrozen = corpusResults.every(r => r.pass);

  // 5. Overall status
  const allPass = allArtifactsPresent && allConclusionsPass && allCorpusFrozen;
  const preflightStatus = allPass ? 'PASS' : 'FAIL';

  let finalClassification;
  if (!allArtifactsPresent) {
    finalClassification = 'P14_MONTHLY_REVENUE_BLOCKED_BY_ARTIFACTS';
  } else {
    finalClassification = tokenResult.tokenPresent
      ? 'P14_MONTHLY_REVENUE_AWAITING_SCHEMA_MIGRATION_APPROVAL_WITH_TOKEN'
      : 'P14_MONTHLY_REVENUE_AWAITING_SCHEMA_MIGRATION_APPROVAL';
  }

  console.log(`\nPreflight status: ${preflightStatus}`);
  console.log(`Final classification (tentative): ${finalClassification}`);

  // ── Write outputs ─────────────────────────────────────────────────────────

  const jsonOutput = {
    phase: PHASE,
    part: PART,
    generatedAt: new Date().toISOString(),
    preflightStatus,
    approvalTokenPresent: tokenResult.tokenPresent,
    approvalStatus: tokenResult.approvalStatus,
    approvalNote: tokenResult.note,
    approvalScope: scope,
    artifactChecks: artifactResults,
    allArtifactsPresent,
    p13ConclusionChecks: conclusionChecks,
    allConclusionsPass,
    frozenCorpusChecks: corpusResults,
    allCorpusFrozen,
    finalClassification,
    productionDbWritten: false,
    nonGoals: [
      'Does not write production DB.',
      'Does not modify scoring formulas.',
      'Does not modify frozen corpora.',
      'Does not compute ROI, profit, alpha, or win-rate.',
      'Does not constitute investment advice.',
    ],
  };

  const jsonPath = path.join(OUTPUTS_DIR, 'p14monthly_revenue_approval_preflight.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2), 'utf8');
  console.log(`\nWrote: ${jsonPath}`);

  const md = `# P14-HARDRESET PART A: Approval Gate + Pre-flight

> **Disclaimer:** Observability only. Does not write production DB. Does not constitute investment advice.

**Generated:** ${jsonOutput.generatedAt}
**Preflight Status:** ${preflightStatus}
**Approval Token Present:** ${tokenResult.tokenPresent}
**Approval Status:** ${tokenResult.approvalStatus}

## Approval Gate

| Field | Value |
|-------|-------|
| Token Present | ${tokenResult.tokenPresent} |
| Approval Status | ${tokenResult.approvalStatus} |
| Allows Dry-Run Artifacts | ${tokenResult.allowsDryRunArtifacts} |
| Allows Production Apply | ${tokenResult.allowsProductionApply} |

${tokenResult.note}

## P13 Artifact Checks

| Artifact | Status |
|----------|--------|
${artifactResults.map(r => `| ${r.path} | ${r.status} |`).join('\n')}

All P13 artifacts present: **${allArtifactsPresent}**

## P13 Conclusion Validation

| Check | Value | Pass |
|-------|-------|------|
${conclusionChecks.map(c => `| ${c.check} | ${c.value} | ${c.pass ? '✅' : '❌'} |`).join('\n')}

All conclusions pass: **${allConclusionsPass}**

## Frozen Corpus Check

| Corpus | Expected | Actual | Pass |
|--------|---------|--------|------|
${corpusResults.map(r => `| ${r.path} | ${r.expected} | ${r.actual} | ${r.pass ? '✅' : '❌'} |`).join('\n')}

All corpora frozen: **${allCorpusFrozen}**

## Final Classification (Tentative)

\`\`\`
${finalClassification}
\`\`\`

## Non-Goals

${jsonOutput.nonGoals.map(g => `- ${g}`).join('\n')}
`;

  const mdPath = path.join(OUTPUTS_DIR, 'p14monthly_revenue_approval_preflight.md');
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log(`Wrote: ${mdPath}`);

  if (!allPass) {
    process.exit(1);
  }
}

run();
