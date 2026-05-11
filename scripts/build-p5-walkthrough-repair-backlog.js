'use strict';
// P5-HARDRESET PART D — Build Prioritized Repair Backlog
// Reads p5walkthrough_review.json + p4calibration_full_audit.json + p3 field inspection.
// Produces prioritized engineering repair backlog.
// NO model changes. NO investment recommendations. NO ROI/alpha/edge claims.

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
const { scanForbiddenClaims } = require('../src/lib/onlineValidation/P5WalkthroughReviewUtils');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs', 'online_validation');

// ─── Load inputs ──────────────────────────────────────────────────────────────

const review = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'p5walkthrough_review.json'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'p4calibration_full_audit.json'), 'utf8'));
const fieldInspection = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'p3active_scoring_field_inspection.json'), 'utf8'));

const cases = review.cases || [];
const summary = review.summary || {};

// ─── Helper: group cases by followup ─────────────────────────────────────────

function casesByFollowup(category) {
  return cases.filter(c => c.followupCategory === category);
}

function caseIds(list) {
  return list.slice(0, 5).map(c => c.caseId);
}

// ─── Build backlog items ───────────────────────────────────────────────────────

const items = [];

// 1. SCORE_DISTRIBUTION_REVIEW
const scoreDistCases = casesByFollowup('SCORE_DISTRIBUTION_REVIEW');
{
  const borderlineCases = cases.filter(c => c.scoreBucketConsistency === 'BORDERLINE');
  const allEvidence = [...new Set([...scoreDistCases, ...borderlineCases])];
  if (allEvidence.length > 0) {
    items.push({
      priority: 'P1',
      category: 'SCORE_DISTRIBUTION_REVIEW',
      symptom: `${borderlineCases.length} cases have BORDERLINE score/bucket consistency — scores are near band boundaries, potentially indicating calibration drift or loose bucket thresholds.`,
      evidenceCount: allEvidence.length,
      exampleCaseIds: caseIds(allEvidence),
      recommendedNextPhase: 'P6 Score Distribution / Decile Tie Repair — review bucket band boundaries and score distribution by bucket in expanded corpus.',
      constraints: [
        'Do NOT modify scoring formula',
        'Do NOT use realized returns as calibration signal',
        'Descriptive analysis only — identify band definitions, not scoring logic'
      ],
      whyNotFixNow: 'P5 is an observability pass only. Any threshold adjustment requires a separate P6 audit with a wider corpus and explicit schema review.'
    });
  }
}

// 2. BUCKET_SCHEMA_REVIEW
const bucketCases = casesByFollowup('BUCKET_SCHEMA_REVIEW');
{
  const inconsistentCases = cases.filter(c => c.scoreBucketConsistency === 'INCONSISTENT');
  const allEvidence = [...new Set([...bucketCases, ...inconsistentCases])];
  if (allEvidence.length > 0) {
    // Characterize the inconsistency direction
    const highScoreLowBucket = allEvidence.filter(c =>
      (c.score || 0) >= 65 && (c.researchBucket === 'LowPriority' || c.researchBucket === 'Neutral'));
    const lowScoreHighBucket = allEvidence.filter(c =>
      (c.score || 0) < 40 && (c.researchBucket === 'Strong' || c.researchBucket === 'Watch'));

    items.push({
      priority: 'P0',
      category: 'BUCKET_SCHEMA_REVIEW',
      symptom: `${inconsistentCases.length} cases have INCONSISTENT score/bucket alignment. ${highScoreLowBucket.length} are high-score in low bucket, ${lowScoreHighBucket.length} are low-score in high bucket. This may indicate stale bucket assignments or score recalculation not propagating to bucket labels.`,
      evidenceCount: allEvidence.length,
      exampleCaseIds: caseIds(allEvidence),
      recommendedNextPhase: 'P6 Bucket Schema Calibration Repair — audit bucket assignment logic, verify score-to-bucket mapping table, check if bucket is assigned at scoring time vs. at a different pipeline stage.',
      constraints: [
        'Do NOT modify alphaScore or recommendationBucket calculation logic',
        'Do NOT reclassify cases based on realized returns',
        'Investigate data pipeline ordering only'
      ],
      whyNotFixNow: 'Root cause is unknown — inconsistency may be from data pipeline timing or band definition. P6 must identify root cause before any fix.'
    });
  }
}

// 3. SIGNAL_REASON_REVIEW
const signalCases = casesByFollowup('SIGNAL_REASON_REVIEW');
{
  const genericReason = cases.filter(c => c.signalReasonConsistency === 'GENERIC');
  const conflictingReason = cases.filter(c => c.signalReasonConsistency === 'CONFLICTING');
  const weakExplain = cases.filter(c => c.explainabilityCompleteness === 'WEAK');
  const allEvidence = [...new Set([...signalCases, ...genericReason, ...conflictingReason, ...weakExplain])];

  if (allEvidence.length > 0) {
    items.push({
      priority: 'P1',
      category: 'SIGNAL_REASON_REVIEW',
      symptom: `${genericReason.length} cases have GENERIC reason snapshots, ${conflictingReason.length} have CONFLICTING signal/reason patterns, ${weakExplain.length} have WEAK explainability. Generic reasons (e.g. single-token "技術偏空") do not provide enough context to verify signal consistency.`,
      evidenceCount: allEvidence.length,
      exampleCaseIds: caseIds(allEvidence),
      recommendedNextPhase: 'P6 Signal / Reason Snapshot Quality Repair — review reasonSnapshot construction in ActiveScoringSnapshotBuilder, add multi-token reason format validation, audit cases where single-token reasons appear.',
      constraints: [
        'Do NOT modify scoring logic or formula weights',
        'Do NOT modify ActiveScoringSnapshotBuilder scoring behavior',
        'Only audit reasonSnapshot construction and format, not score calculation'
      ],
      whyNotFixNow: 'P5 cannot determine if single-token reasons are correct summaries or truncated output. P6 must trace reasonSnapshot generation path.'
    });
  }
}

// 4. DATA_COVERAGE_REVIEW
const dataCovCases = casesByFollowup('DATA_COVERAGE_REVIEW');
{
  const partialCases = cases.filter(c => c.scoringCompletenessStatus === 'PARTIAL');
  const emptyCases = cases.filter(c => c.scoringCompletenessStatus === 'EMPTY');
  const missingReturn = cases.filter(c => c.returnPct === null || c.returnPct === undefined);
  const allEvidence = [...new Set([...dataCovCases, ...partialCases, ...emptyCases])];

  // Get P3 completeness distribution from field inspection
  const p3Completeness = fieldInspection.completenessDistribution || {};
  const partialCount = p3Completeness.PARTIAL || 0;
  const totalP3 = 4500;

  items.push({
    priority: 'P1',
    category: 'DATA_COVERAGE_REVIEW',
    symptom: `${partialCases.length} walkthrough cases are PARTIAL completeness (${((partialCount/totalP3)*100).toFixed(1)}% of P3 corpus = PARTIAL, all are Neutral bucket). ${missingReturn.length} cases have missing realized return. This reflects fundamental data availability constraints for the Neutral bucket tier.`,
    evidenceCount: allEvidence.length,
    exampleCaseIds: caseIds(allEvidence),
    recommendedNextPhase: 'P6 Feature Coverage Backfill — investigate why all Neutral bucket rows are PARTIAL, trace which data sources are unavailable, determine if additional data ingestion can improve completeness.',
    constraints: [
      'Do NOT modify P3 corpus',
      'Do NOT modify scoringCompletenessStatus calculation',
      'Data backfill must go through normal data pipeline — no PIT violations'
    ],
    whyNotFixNow: 'Data coverage gaps require upstream data availability work. Cannot be fixed within the validation layer alone.'
  });
}

// 5. CORPUS_EXPANSION_REVIEW
{
  const uniqueSymbols = 25;
  const horizons = [5, 20, 60];
  const missingHz60 = cases.filter(c => c.horizonDays === 60 && (c.returnPct === null || c.returnPct === undefined)).length;

  items.push({
    priority: 'P2',
    category: 'CORPUS_EXPANSION_REVIEW',
    symptom: `Current P3 corpus covers ${uniqueSymbols} symbols × ${horizons.length} horizons = 4500 rows. 60-day horizon has ${missingHz60}/${cases.filter(c=>c.horizonDays===60).length} walkthrough cases with missing returns. InsufficientData bucket is absent (all 25 symbols had data). A larger corpus would expose more edge cases and exercise the InsufficientData bucket.`,
    evidenceCount: missingHz60,
    exampleCaseIds: cases.filter(c => c.horizonDays === 60 && (c.returnPct === null || c.returnPct === undefined)).slice(0, 5).map(c => c.caseId),
    recommendedNextPhase: 'P6 or future round — expand symbol universe to ≥50 symbols, include symbols with known data gaps to exercise InsufficientData path, run on 3 non-overlapping historical windows.',
    constraints: [
      'Do NOT modify frozen P0/P1/P3 corpora',
      'New corpus must pass same PIT and completeness invariants',
      'Expansion is a separate corpus generation run'
    ],
    whyNotFixNow: 'Corpus expansion requires a separate data collection run. Not a P5 deliverable.'
  });
}

// 6. NO_IMMEDIATE_REPAIR — cases that passed all dimensions
{
  const readyCases = casesByFollowup('READY_FOR_NEXT_AUDIT');
  if (readyCases.length > 0) {
    items.push({
      priority: 'P2',
      category: 'NO_IMMEDIATE_REPAIR',
      symptom: `${readyCases.length} cases passed all review dimensions (COMPLETE explainability, CONSISTENT score/bucket, CONSISTENT signal/reason). These cases are representative of expected scoring behavior.`,
      evidenceCount: readyCases.length,
      exampleCaseIds: caseIds(readyCases),
      recommendedNextPhase: 'Continue to next scheduled audit round. No immediate action required for these cases.',
      constraints: [],
      whyNotFixNow: 'No issues detected. These cases are the calibration baseline.'
    });
  }
}

// ─── Determine primary repair focus ─────────────────────────────────────────

const priorityCounts = { P0: 0, P1: 0, P2: 0 };
items.forEach(item => { priorityCounts[item.priority] = (priorityCounts[item.priority] || 0) + 1; });

const primaryFocus = items
  .filter(i => i.priority === 'P0')
  .map(i => i.category)[0] || items.filter(i => i.priority === 'P1').map(i => i.category)[0] || 'NO_IMMEDIATE_REPAIR';

console.log(`[P5-D] ${items.length} backlog items generated`);
console.log('  priorities:', JSON.stringify(priorityCounts));
console.log('  primaryFocus:', primaryFocus);

// ─── Forbidden claims scan ─────────────────────────────────────────────────

const backlogJson = JSON.stringify({ items }, null, 2);
const hits = scanForbiddenClaims(backlogJson);
if (hits.length > 0) {
  console.error('[P5-D] FATAL: forbidden claims in backlog artifact:');
  hits.forEach(h => console.error('  ', h.pattern, ':', h.context));
  process.exit(1);
}

// ─── Write outputs ────────────────────────────────────────────────────────────

const output = {
  generatedAt: new Date().toISOString(),
  disclaimer: 'Engineering repair backlog only. No investment recommendations. No model changes. Descriptive analysis only.',
  primaryFocus,
  priorityCounts,
  totalItems: items.length,
  items,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'p5walkthrough_repair_backlog.json'), JSON.stringify(output, null, 2));

// ─── Markdown ─────────────────────────────────────────────────────────────────

const md = buildMarkdown(output);
fs.writeFileSync(path.join(OUT_DIR, 'p5walkthrough_repair_backlog.md'), md);

console.log('  → outputs/online_validation/p5walkthrough_repair_backlog.json');
console.log('  → outputs/online_validation/p5walkthrough_repair_backlog.md');

function buildMarkdown(output) {
  const lines = [];
  lines.push('# P5-HARDRESET PART D — Prioritized Repair Backlog');
  lines.push('');
  lines.push(`**Date:** ${output.generatedAt.split('T')[0]}`);
  lines.push(`**Primary Focus:** \`${output.primaryFocus}\``);
  lines.push(`**Total Items:** ${output.totalItems}`);
  lines.push('');
  lines.push('> **Disclaimer:** Engineering review directions only. Not investment advice. No model changes made.');
  lines.push('');

  lines.push('## Priority Summary');
  lines.push('');
  lines.push('| Priority | Count |');
  lines.push('|----------|-------|');
  Object.entries(output.priorityCounts).forEach(([p, n]) => {
    lines.push(`| ${p} | ${n} |`);
  });
  lines.push('');

  output.items.forEach((item, i) => {
    lines.push(`## ${i + 1}. [${item.priority}] ${item.category}`);
    lines.push('');
    lines.push(`**Priority:** ${item.priority}`);
    lines.push(`**Evidence Count:** ${item.evidenceCount}`);
    lines.push(`**Example Cases:** ${item.exampleCaseIds.join(', ')}`);
    lines.push('');
    lines.push('**Symptom:**');
    lines.push(item.symptom);
    lines.push('');
    lines.push('**Recommended Next Phase:**');
    lines.push(item.recommendedNextPhase);
    lines.push('');
    if (item.constraints.length > 0) {
      lines.push('**Constraints:**');
      item.constraints.forEach(c => lines.push(`- ${c}`));
      lines.push('');
    }
    lines.push('**Why Not Fix Now:**');
    lines.push(item.whyNotFixNow);
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}
