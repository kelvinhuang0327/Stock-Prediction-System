#!/usr/bin/env node
require('ts-node/register/transpile-only');
const fs = require('fs');
const path = require('path');

const { buildManualReviewWorkflowBinding } = require('../src/lib/onlineValidation/ManualReviewWorkflowBinding');
const { buildManualReviewActionSchema } = require('../src/lib/onlineValidation/ManualReviewActionSchema');

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

const corpusLines = fs.readFileSync(corpusPath, 'utf8').trim().split('\n').filter(Boolean);
if (corpusLines.length !== 60) {
  throw new Error(`P16 corpus must remain 60 lines; found ${corpusLines.length}`);
}

const governanceGate = readJson(path.resolve(outputsDir, 'p15_backfill_governance_gate.json'));
const writePathContract = readJson(path.resolve(outputsDir, 'p15_backfill_write_path_contract.json'));
const manualReviewPackage = readJson(path.resolve(outputsDir, 'p15_backfill_manual_review_package.json'));
const qualityImpactPreview = readJson(path.resolve(outputsDir, 'p14_backfill_quality_impact_preview.json'));
const recoveryPlan = readJson(path.resolve(outputsDir, 'p13_coverage_recovery_plan.json'));

const workflowBinding = buildManualReviewWorkflowBinding(
  {
    governanceGate,
    writePathContract,
    manualReviewPackage,
    qualityImpactPreview,
    recoveryPlan,
  },
  {
    bindingRunId: 'p16-manual-review-workflow-binding-20260511-001',
    generatedAt: '2026-05-11T10:00:00.000Z',
    workflowVersion: 'manual-review-workflow-binding-v0',
  },
);

const actionSchema = buildManualReviewActionSchema(workflowBinding, {
  schemaRunId: 'p16-manual-review-action-schema-20260511-001',
  generatedAt: '2026-05-11T10:00:00.000Z',
});

const bindingJson = path.resolve(outputsDir, 'p16_manual_review_workflow_binding.json');
const bindingMd = path.resolve(outputsDir, 'p16_manual_review_workflow_binding.md');
const schemaJson = path.resolve(outputsDir, 'p16_manual_review_action_schema.json');
const schemaMd = path.resolve(outputsDir, 'p16_manual_review_action_schema.md');
const statusCardsJson = path.resolve(outputsDir, 'p16_manual_review_status_cards.json');
const readinessMd = path.resolve(readinessDir, 'p16_next_execution_order_20260511.md');

writeJson(bindingJson, workflowBinding);
writeJson(statusCardsJson, workflowBinding.reviewStatusCards);
writeJson(schemaJson, actionSchema);

writeMarkdown(bindingMd, 'P16 Manual Review Workflow Binding', [
  `bindingRunId=${workflowBinding.bindingRunId}`,
  `workflowStatus=${workflowBinding.workflowStatus}`,
  `allowedWorkflowActions=${workflowBinding.allowedWorkflowActions.join(', ')}`,
  `blockedWorkflowActions=${workflowBinding.blockedWorkflowActions.join(', ')}`,
  `manualReviewStatus=${workflowBinding.reviewStatusCards.manualReviewPackageStatus.value}`,
]);

writeMarkdown(schemaMd, 'P16 Manual Review Action Schema', [
  `schemaRunId=${actionSchema.schemaRunId}`,
  `actionCount=${actionSchema.actions.length}`,
  `disabledActionCount=${actionSchema.disabledActions.length}`,
  `validationStatus=${actionSchema.validationStatus}`,
]);

writeMarkdown(readinessMd, 'P16 Next Execution Order', [
  'P16 manual review workflow binding generated',
  `workflowStatus=${workflowBinding.workflowStatus}`,
  `manualReviewStatus=${workflowBinding.reviewStatusCards.manualReviewPackageStatus.value}`,
  'manual review remains review-only',
  'production execution is not enabled',
]);

console.log('P16 artifacts generated');
