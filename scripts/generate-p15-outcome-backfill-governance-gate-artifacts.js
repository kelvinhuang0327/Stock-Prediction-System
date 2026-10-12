#!/usr/bin/env node
require('ts-node/register/transpile-only');
const fs = require('fs');
const path = require('path');

const {
  buildOutcomeBackfillGovernanceGate,
} = require('../src/lib/onlineValidation/OutcomeBackfillGovernanceGate');
const {
  buildBackfillWritePathContract,
} = require('../src/lib/onlineValidation/BackfillWritePathContract');
const {
  buildBackfillManualReviewPackage,
} = require('../src/lib/onlineValidation/BackfillManualReviewPackage');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function writeMarkdown(filePath, title, lines) {
  fs.writeFileSync(filePath, `# ${title}\n\n${lines.map(line => `- ${line}`).join('\n')}\n`);
}

const repoRoot = process.cwd();
const outputsDir = path.resolve(repoRoot, 'outputs/online_validation');
const readinessDir = path.resolve(repoRoot, 'outputs/system_readiness');
const corpusPath = path.resolve(outputsDir, 'simulation_snapshot_corpus.jsonl');

const corpusText = fs.readFileSync(corpusPath, 'utf8');
const corpusLines = corpusText.trim() ? corpusText.trim().split('\n') : [];
if (corpusLines.length !== 60) {
  throw new Error(`P15 corpus must remain 60 lines; found ${corpusLines.length}`);
}

const candidateSelection = readJson(path.resolve(outputsDir, 'p14_backfill_candidate_selection.json'));
const rehearsal = readJson(path.resolve(outputsDir, 'p14_outcome_backfill_rehearsal.json'));
const qualityImpactPreview = readJson(path.resolve(outputsDir, 'p14_backfill_quality_impact_preview.json'));
const coverageRecoveryPlan = readJson(path.resolve(outputsDir, 'p13_coverage_recovery_plan.json'));
const currentQualityGate = readJson(path.resolve(outputsDir, 'p12_corpus_quality_gate.json'));

const governanceGate = buildOutcomeBackfillGovernanceGate(
  {
    candidateSelection,
    rehearsal,
    qualityImpactPreview,
    currentCorpusLineCount: corpusLines.length,
    currentQualityGate,
    recoveryPlan: coverageRecoveryPlan,
  },
  {
    governanceRunId: 'p15-backfill-governance-20260511-001',
    generatedAt: '2026-05-11T09:15:00.000Z',
    requireManualApproval: true,
    minRehearsedCount: 1,
    minBlockedToReadyCount: 1,
    maxAllowedCorpusWritePermission: false,
  },
);

const writePathContract = buildBackfillWritePathContract(
  {
    governanceGate,
    rehearsal,
    qualityImpactPreview,
  },
  {
    contractRunId: 'p15-backfill-write-path-contract-20260511-001',
    generatedAt: '2026-05-11T09:15:00.000Z',
  },
);

const manualReviewPackage = buildBackfillManualReviewPackage(
  {
    governanceGate,
    writePathContract,
    candidateSelection,
    rehearsal,
    qualityImpactPreview,
  },
  {
    packageRunId: 'p15-backfill-manual-review-20260511-001',
    generatedAt: '2026-05-11T09:15:00.000Z',
  },
);

const governanceJson = path.resolve(outputsDir, 'p15_backfill_governance_gate.json');
const governanceMd = path.resolve(outputsDir, 'p15_backfill_governance_gate.md');
const contractJson = path.resolve(outputsDir, 'p15_backfill_write_path_contract.json');
const contractMd = path.resolve(outputsDir, 'p15_backfill_write_path_contract.md');
const packageJson = path.resolve(outputsDir, 'p15_backfill_manual_review_package.json');
const packageMd = path.resolve(outputsDir, 'p15_backfill_manual_review_package.md');
const readinessMd = path.resolve(readinessDir, 'p15_next_execution_order_20260511.md');

writeJson(governanceJson, governanceGate);
writeMarkdown(governanceMd, 'P15 Backfill Governance Gate', [
  `governanceRunId=${governanceGate.governanceRunId}`,
  `gateStatus=${governanceGate.gateStatus}`,
  `decision=${governanceGate.decision}`,
  `blockedToReadyCount=${governanceGate.inputSummary.blockedToReadyCount}`,
  `currentCorpusLineCount=${governanceGate.inputSummary.currentCorpusLineCount}`,
  `previewOnly=${governanceGate.inputSummary.previewOnly}`,
]);

writeJson(contractJson, writePathContract);
writeMarkdown(contractMd, 'P15 Backfill Write Path Contract', [
  `contractRunId=${writePathContract.contractRunId}`,
  `mode=${writePathContract.mode}`,
  `allowedOperations=${writePathContract.allowedOperations.length}`,
  `forbiddenOperations=${writePathContract.forbiddenOperations.length}`,
  `artifactOnly=${writePathContract.escalationPolicy.artifactOnly}`,
]);

writeJson(packageJson, manualReviewPackage);
writeMarkdown(packageMd, 'P15 Backfill Manual Review Package', [
  `packageRunId=${manualReviewPackage.packageRunId}`,
  `reviewStatus=${manualReviewPackage.reviewStatus}`,
  `selectedCount=${manualReviewPackage.candidateSummary.selectedCount}`,
  `blockedToReadyCount=${manualReviewPackage.reviewSummary.blockedToReadyCount}`,
  `projectedCoverageRatio=${manualReviewPackage.reviewSummary.projectedCoverageRatio}`,
  `previewOnly=${manualReviewPackage.reviewSummary.previewOnly}`,
]);

writeMarkdown(readinessMd, 'P15 Next Execution Order', [
  'P15 governance gate and manual review package generated',
  `governanceStatus=${governanceGate.gateStatus}`,
  `reviewStatus=${manualReviewPackage.reviewStatus}`,
  'artifact-only rehearsal remains in place',
  'production backfill is not enabled in this phase',
]);

console.log('P15 artifacts generated');
