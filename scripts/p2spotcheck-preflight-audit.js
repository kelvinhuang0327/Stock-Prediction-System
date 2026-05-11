#!/usr/bin/env node
'use strict';
/**
 * P2-HARDRESET PART A — Pre-flight Audit
 * Verifies all required P0/P1 artifacts exist and are valid before P2 begins.
 * Observability-only. No investment recommendations.
 */

const fs = require('node:fs');
const path = require('node:path');

const OUTPUT_DIR = path.join(process.cwd(), 'outputs', 'online_validation');
const AUDIT_DATE = new Date().toISOString().slice(0, 10);

// ─── Required artifact definitions ──────────────────────────────────────────

const P0_REQUIRED = [
  'p0hardreset_historical_replay_corpus.jsonl',
  'p0hardreset_historical_replay_summary.md',
  'p0hardreset_corpus_quality_gate_rerun.json',
  'p0hardreset_final_report.md',
];

const P1_REQUIRED = [
  'p1baseline_historical_replay_corpus.jsonl',
  'p1baseline_historical_replay_summary.json',
  'p1baseline_comparison_observability.json',
  'p1baseline_final_report.md',
];

const FROZEN_FILE = path.join(OUTPUT_DIR, 'simulation_snapshot_corpus.jsonl');
const FROZEN_EXPECTED_LINES = 60;

const MANUAL_REVIEW_FILES = [
  'src/lib/onlineValidation/ManualReviewWorkflowBinding.ts',
  'src/lib/onlineValidation/ManualReviewActionSchema.ts',
  'src/lib/onlineValidation/ManualReviewOpsSurfaceAudit.ts',
  'src/lib/onlineValidation/ManualReviewSurfaceContract.ts',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countJsonlLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return 0;
  return content.split('\n').length;
}

function countMockDeterministic(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(/"mock-deterministic"/g);
  return matches ? matches.length : 0;
}

function fileExistsAndNonEmpty(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  return stat.size > 0;
}

// ─── PART A checks ───────────────────────────────────────────────────────────

const checks = [];
const warnings = [];
let allPass = true;

function check(name, condition, detail) {
  const status = condition ? 'PASS' : 'FAIL';
  if (!condition) allPass = false;
  checks.push({ name, status, detail });
  process.stdout.write(`  [${status}] ${name}: ${detail}\n`);
}

console.log('\n=== P2-HARDRESET PART A: Pre-flight Audit ===\n');

// A.1 P0 artifacts
console.log('--- P0 Artifacts ---');
for (const f of P0_REQUIRED) {
  const fp = path.join(OUTPUT_DIR, f);
  check(`P0 file exists: ${f}`, fileExistsAndNonEmpty(fp), fs.existsSync(fp) ? `${fs.statSync(fp).size} bytes` : 'MISSING');
}

// A.1 P1 artifacts
console.log('\n--- P1 Artifacts ---');
for (const f of P1_REQUIRED) {
  const fp = path.join(OUTPUT_DIR, f);
  check(`P1 file exists: ${f}`, fileExistsAndNonEmpty(fp), fs.existsSync(fp) ? `${fs.statSync(fp).size} bytes` : 'MISSING');
}

// A.2 Line counts
console.log('\n--- Corpus Line Counts ---');
const p0Path = path.join(OUTPUT_DIR, 'p0hardreset_historical_replay_corpus.jsonl');
const p1Path = path.join(OUTPUT_DIR, 'p1baseline_historical_replay_corpus.jsonl');

const p0Lines = countJsonlLines(p0Path);
const p1Lines = countJsonlLines(p1Path);
check('P0 corpus lines >= 4500', p0Lines >= 4500, `${p0Lines} lines`);
check('P1 corpus lines >= 9900', p1Lines >= 9900, `${p1Lines} lines`);

// A.2 Mock-deterministic
console.log('\n--- Mock-Deterministic Check ---');
const p0Mock = countMockDeterministic(p0Path);
const p1Mock = countMockDeterministic(p1Path);
check('P0 mock-deterministic = 0', p0Mock === 0, `found ${p0Mock}`);
check('P1 mock-deterministic = 0', p1Mock === 0, `found ${p1Mock}`);

// A.2 Frozen corpus
console.log('\n--- Frozen Corpus ---');
const frozenLines = countJsonlLines(FROZEN_FILE);
check(`simulation_snapshot_corpus.jsonl = ${FROZEN_EXPECTED_LINES} lines`, frozenLines === FROZEN_EXPECTED_LINES, `${frozenLines} lines`);

// A.2 ManualReview files unchanged
console.log('\n--- ManualReview Files ---');
for (const relPath of MANUAL_REVIEW_FILES) {
  const fp = path.join(process.cwd(), relPath);
  check(`ManualReview file exists: ${path.basename(relPath)}`, fs.existsSync(fp), fp);
}

// ─── Compute summary ─────────────────────────────────────────────────────────

const passCount = checks.filter(c => c.status === 'PASS').length;
const failCount = checks.filter(c => c.status === 'FAIL').length;

const classification = allPass
  ? 'P2_PREFLIGHT_PASS'
  : 'P2_SPOTCHECK_BLOCKED_BY_ARTIFACTS';

console.log(`\n--- Summary ---`);
console.log(`PASS: ${passCount}  FAIL: ${failCount}`);
console.log(`Classification: ${classification}`);

// ─── Outputs ─────────────────────────────────────────────────────────────────

const jsonOut = {
  auditType: 'P2_PREFLIGHT',
  auditDate: AUDIT_DATE,
  classification,
  totalChecks: checks.length,
  passCount,
  failCount,
  p0Lines,
  p1Lines,
  p0MockDeterministic: p0Mock,
  p1MockDeterministic: p1Mock,
  frozenCorpusLines: frozenLines,
  checks,
  warnings,
};

const jsonPath = path.join(OUTPUT_DIR, 'p2spotcheck_preflight_audit.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2), 'utf8');
console.log(`\nWrote: ${jsonPath}`);

// ─── Markdown ────────────────────────────────────────────────────────────────

const md = `# P2-HARDRESET Pre-flight Audit

**Date:** ${AUDIT_DATE}
**Classification:** \`${classification}\`

## Summary

| Metric | Value |
|--------|-------|
| Total checks | ${checks.length} |
| PASS | ${passCount} |
| FAIL | ${failCount} |
| P0 corpus lines | ${p0Lines} |
| P1 corpus lines | ${p1Lines} |
| P0 mock-deterministic | ${p0Mock} |
| P1 mock-deterministic | ${p1Mock} |
| Frozen corpus lines | ${frozenLines} |

## Check Results

| Check | Status | Detail |
|-------|--------|--------|
${checks.map(c => `| ${c.name} | **${c.status}** | ${c.detail} |`).join('\n')}

${failCount > 0 ? `## Escalation\n\n**P2_SPOTCHECK_BLOCKED_BY_ARTIFACTS** — ${failCount} check(s) failed. Resolve before proceeding.\n` : '## Result\n\nAll pre-flight checks passed. P2 audit may proceed.\n'}

---
*Observability-only. Not investment advice.*
`;

const mdPath = path.join(OUTPUT_DIR, 'p2spotcheck_preflight_audit.md');
fs.writeFileSync(mdPath, md, 'utf8');
console.log(`Wrote: ${mdPath}`);

if (!allPass) {
  const escalPath = path.join(OUTPUT_DIR, 'p2spotcheck_escalation_report.md');
  const esc = `# P2-HARDRESET Escalation Report\n\n**Classification:** P2_SPOTCHECK_BLOCKED_BY_ARTIFACTS\n\n## Failed Checks\n\n${checks.filter(c => c.status === 'FAIL').map(c => `- ${c.name}: ${c.detail}`).join('\n')}\n\nResolve all failures before proceeding with P2 audit.\n`;
  fs.writeFileSync(escalPath, esc, 'utf8');
  console.log(`Wrote escalation: ${escalPath}`);
  process.exit(1);
}

console.log('\nPre-flight PASS — ready for PART B.');
