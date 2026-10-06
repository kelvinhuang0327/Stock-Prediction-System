'use strict';
// P5-HARDRESET PART C — Run Walkthrough Review
// Reads P4 walkthrough cases, applies P5 review rubric, produces review artifact.

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true }
});
require('tsconfig-paths').register({
  baseUrl: require('path').resolve(__dirname, '..'),
  paths: { '@/*': ['src/*'] }
});

const fs = require('fs');
const path = require('path');

const {
  reviewCase,
  summarizeWalkthroughFindings,
  scanForbiddenClaims,
} = require('../src/lib/onlineValidation/P5WalkthroughReviewUtils');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs', 'online_validation');

// ─── Load inputs ──────────────────────────────────────────────────────────────

const wtData = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'p4calibration_walkthrough_cases.json'), 'utf8'));
const auditData = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'p4calibration_full_audit.json'), 'utf8'));

const cases = wtData.cases || [];
console.log(`[P5-C] Loaded ${cases.length} walkthrough cases`);

// ─── Run review rubric on each case ──────────────────────────────────────────

const reviewResults = cases.map((c, i) => reviewCase(c, i));

// ─── Summarize ────────────────────────────────────────────────────────────────

const summary = summarizeWalkthroughFindings(reviewResults);

console.log(`[P5-C] Review complete: ${summary.totalCases} cases`);
console.log('  byExplainability:', JSON.stringify(summary.byExplainabilityCompleteness));
console.log('  byScoreBucket:', JSON.stringify(summary.byScoreBucketConsistency));
console.log('  bySignalReason:', JSON.stringify(summary.bySignalReasonConsistency));
console.log('  byFollowup:', JSON.stringify(summary.byFollowupCategory));

// ─── Forbidden claims scan ────────────────────────────────────────────────────

const reviewJson = JSON.stringify({ summary, cases: reviewResults }, null, 2);
const forbiddenHits = scanForbiddenClaims(reviewJson);
if (forbiddenHits.length > 0) {
  console.error('[P5-C] FATAL: forbidden claims found in review artifact:');
  forbiddenHits.forEach(h => console.error('  ', h.pattern, ':', h.context));
  process.exit(1);
}

// ─── Write outputs ────────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });

const output = {
  generatedAt: new Date().toISOString(),
  classification: 'P5_WALKTHROUGH_REVIEW_COMPLETE',
  disclaimer: 'Descriptive observability review only. No investment recommendations. No ROI / alpha / edge claims.',
  summary,
  cases: reviewResults,
};

fs.writeFileSync(path.join(OUT_DIR, 'p5walkthrough_review.json'), JSON.stringify(output, null, 2));

// ─── Markdown report ─────────────────────────────────────────────────────────

const md = buildMarkdown(output, reviewResults, summary);
fs.writeFileSync(path.join(OUT_DIR, 'p5walkthrough_review.md'), md);

console.log('  → outputs/online_validation/p5walkthrough_review.json');
console.log('  → outputs/online_validation/p5walkthrough_review.md');

function buildMarkdown(output, cases, summary) {
  const lines = [];
  lines.push('# P5-HARDRESET PART C — Walkthrough Review Report');
  lines.push('');
  lines.push(`**Classification:** \`${output.classification}\``);
  lines.push(`**Date:** ${output.generatedAt.split('T')[0]}`);
  lines.push(`**Total Cases:** ${summary.totalCases}`);
  lines.push('');
  lines.push('> **Disclaimer:** Descriptive observability review only. No investment recommendations. Not financial advice.');
  lines.push('');

  lines.push('## Summary');
  lines.push('');

  lines.push('### By Horizon');
  lines.push('| Horizon | Cases |');
  lines.push('|---------|-------|');
  Object.entries(summary.byHorizon).sort(([a],[b]) => Number(a)-Number(b)).forEach(([hz, n]) => {
    lines.push(`| ${hz}d | ${n} |`);
  });
  lines.push('');

  lines.push('### By Research Bucket');
  lines.push('| Bucket | Cases |');
  lines.push('|--------|-------|');
  Object.entries(summary.byBucket).sort(([a],[b]) => a.localeCompare(b)).forEach(([b, n]) => {
    lines.push(`| ${b} | ${n} |`);
  });
  lines.push('');

  lines.push('### Explainability Completeness');
  lines.push('| Level | Count |');
  lines.push('|-------|-------|');
  Object.entries(summary.byExplainabilityCompleteness).forEach(([k, n]) => {
    lines.push(`| ${k} | ${n} |`);
  });
  lines.push('');

  lines.push('### Score ↔ Bucket Consistency');
  lines.push('| Status | Count |');
  lines.push('|--------|-------|');
  Object.entries(summary.byScoreBucketConsistency).forEach(([k, n]) => {
    lines.push(`| ${k} | ${n} |`);
  });
  lines.push('');

  lines.push('### Signal / Reason Consistency');
  lines.push('| Status | Count |');
  lines.push('|--------|-------|');
  Object.entries(summary.bySignalReasonConsistency).forEach(([k, n]) => {
    lines.push(`| ${k} | ${n} |`);
  });
  lines.push('');

  lines.push('### Outcome Mismatch Pattern');
  lines.push('| Pattern | Count |');
  lines.push('|---------|-------|');
  Object.entries(summary.byOutcomeMismatchPattern).sort(([,a],[,b]) => b-a).forEach(([k, n]) => {
    lines.push(`| ${k} | ${n} |`);
  });
  lines.push('');

  lines.push('### Followup Category');
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  Object.entries(summary.byFollowupCategory).sort(([,a],[,b]) => b-a).forEach(([k, n]) => {
    lines.push(`| ${k} | ${n} |`);
  });
  lines.push('');

  lines.push('### Top Limitation Notes');
  lines.push('| Note | Count |');
  lines.push('|------|-------|');
  summary.topLimitationNotes.forEach(({ note, count }) => {
    lines.push(`| ${note} | ${count} |`);
  });
  lines.push('');

  lines.push('## Case Details');
  lines.push('');
  lines.push('| # | Symbol | Date | Hz | Bucket | Score | Decile | Return% | ReturnClass | Explainability | ScoreBucket | SignalReason | Outcome | Followup |');
  lines.push('|---|--------|------|----|--------|-------|--------|---------|-------------|----------------|-------------|--------------|---------|----------|');

  cases.forEach(c => {
    const ret = c.returnPct !== null ? c.returnPct.toFixed(2) + '%' : 'N/A';
    lines.push(`| ${c.caseId} | ${c.symbol} | ${c.originalAsOfDate} | ${c.horizonDays}d | ${c.researchBucket} | ${c.score ?? 'N/A'} | ${c.scoreDecile ?? 'N/A'} | ${ret} | ${c.realizedReturnClass} | ${c.explainabilityCompleteness} | ${c.scoreBucketConsistency} | ${c.signalReasonConsistency} | ${c.outcomeMismatchPattern} | ${c.followupCategory} |`);
  });

  lines.push('');
  lines.push('## Limitation Notes (Per Case)');
  lines.push('');

  cases.filter(c => c.limitationNotes.length > 0).forEach(c => {
    lines.push(`**${c.caseId}** (${c.symbol} ${c.originalAsOfDate} hz=${c.horizonDays}d):`);
    c.limitationNotes.forEach(n => lines.push(`- ${n}`));
    lines.push('');
  });

  return lines.join('\n');
}
