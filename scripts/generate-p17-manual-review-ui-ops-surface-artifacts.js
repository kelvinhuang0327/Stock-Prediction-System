#!/usr/bin/env node
require('ts-node/register/transpile-only');
const fs = require('fs');
const path = require('path');

const { buildManualReviewSurfaceContract } = require('../src/lib/onlineValidation/ManualReviewSurfaceContract');
const { buildManualReviewOpsSurfaceAudit } = require('../src/lib/onlineValidation/ManualReviewOpsSurfaceAudit');

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
  throw new Error(`P17 corpus must remain 60 lines; found ${corpusLines.length}`);
}

const workflowBinding = readJson(path.resolve(outputsDir, 'p16_manual_review_workflow_binding.json'));
const actionSchema = readJson(path.resolve(outputsDir, 'p16_manual_review_action_schema.json'));
const statusCards = readJson(path.resolve(outputsDir, 'p16_manual_review_status_cards.json'));
const governanceGate = readJson(path.resolve(outputsDir, 'p15_backfill_governance_gate.json'));
const writePathContract = readJson(path.resolve(outputsDir, 'p15_backfill_write_path_contract.json'));
const manualReviewPackage = readJson(path.resolve(outputsDir, 'p15_backfill_manual_review_package.json'));

const surfaceContract = buildManualReviewSurfaceContract(
  {
    workflowBinding,
    actionSchema,
    statusCards,
  },
  {
    surfaceRunId: 'p17-manual-review-surface-20260511-001',
    generatedAt: '2026-05-11T10:20:00.000Z',
    surfaceVersion: 'manual-review-surface-contract-v0',
  },
);

const audit = buildManualReviewOpsSurfaceAudit(surfaceContract, {
  auditRunId: 'p17-manual-review-surface-audit-20260511-001',
  generatedAt: '2026-05-11T10:20:00.000Z',
});

const surfaceJson = path.resolve(outputsDir, 'p17_manual_review_surface_contract.json');
const surfaceMd = path.resolve(outputsDir, 'p17_manual_review_surface_contract.md');
const auditJson = path.resolve(outputsDir, 'p17_manual_review_ops_surface_audit.json');
const auditMd = path.resolve(outputsDir, 'p17_manual_review_ops_surface_audit.md');
const statusSectionsJson = path.resolve(outputsDir, 'p17_manual_review_surface_status_sections.json');
const actionSectionsJson = path.resolve(outputsDir, 'p17_manual_review_surface_action_sections.json');
const readinessMd = path.resolve(readinessDir, 'p17_next_execution_order_20260511.md');

writeJson(surfaceJson, surfaceContract);
writeJson(auditJson, audit);
writeJson(statusSectionsJson, surfaceContract.statusSections);
writeJson(actionSectionsJson, surfaceContract.actionSections);

writeMarkdown(surfaceMd, 'P17 Manual Review Surface Contract', [
  `surfaceRunId=${surfaceContract.surfaceRunId}`,
  `surfaceStatus=${surfaceContract.surfaceStatus}`,
  `pageTitle=${surfaceContract.pageTitle}`,
  `enabledActions=${surfaceContract.actionSections[0].items.length}`,
  `disabledActions=${surfaceContract.disabledActionSections[0].items.length}`,
  `reviewOnly=true`,
]);

writeMarkdown(auditMd, 'P17 Manual Review Ops Surface Audit', [
  `auditRunId=${audit.auditRunId}`,
  `auditStatus=${audit.auditStatus}`,
  `enabledActionCount=${audit.actionAudit.enabledActionCount}`,
  `forbiddenTokenAudit=${audit.forbiddenTokenAudit.pass}`,
  `guardrailAudit=${audit.guardrailAudit.manualReviewOnly}`,
]);

writeMarkdown(readinessMd, 'P17 Next Execution Order', [
  'P17 manual review surface contract generated',
  `surfaceStatus=${surfaceContract.surfaceStatus}`,
  `auditStatus=${audit.auditStatus}`,
  'manual review remains display-only',
  'production execution is not enabled',
]);

console.log('P17 artifacts generated');
