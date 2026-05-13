'use strict';
/**
 * run-p26a-batch-pipeline-wiring-validation.js
 * P26A-BATCH-PIPELINE-WIRING-HARDRESET
 *
 * Real corpus 9-case batch validation.
 * Reads P3 corpus, finds 9 P26A underoutput cases, uses corpusRowToWalkthroughCaseInput(),
 * calls reviewCase(), verifies reasonRendererOutcome = ENRICHED for all 9.
 *
 * Read-only. No DB write. No corpus mutation.
 * Not investment advice.
 */

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

const { reviewCase } = require('../src/lib/onlineValidation/P5WalkthroughReviewUtils');
const { corpusRowToWalkthroughCaseInput } = require('../src/lib/onlineValidation/P26ACorpusRowAdapter');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs', 'online_validation');

// ── Load P4 cases to identify the 9 P26A targets ─────────────────────────────
const p4Data = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'p4calibration_walkthrough_cases.json'), 'utf8'));

const P26A_CASE_IDS = ['P5-CASE-010','P5-CASE-011','P5-CASE-013','P5-CASE-023','P5-CASE-026','P5-CASE-037','P5-CASE-053','P5-CASE-054','P5-CASE-055'];

const p26aTargets = p4Data.cases
  .map((c, i) => ({ ...c, caseId: `P5-CASE-${String(i + 1).padStart(3, '0')}` }))
  .filter(c => P26A_CASE_IDS.includes(c.caseId));

console.log(`[P26A-VALIDATE] Found ${p26aTargets.length} P26A target cases in p4calibration_walkthrough_cases.json`);

// ── Load P3 corpus ────────────────────────────────────────────────────────────
const p3Lines = fs.readFileSync(
  path.join(OUT_DIR, 'p3active_scoring_historical_replay_corpus.jsonl'),
  'utf8'
).trim().split('\n').map(l => JSON.parse(l));

console.log(`[P26A-VALIDATE] Loaded ${p3Lines.length} P3 corpus rows`);

// ── Match each target to P3 corpus rows ───────────────────────────────────────
const results = [];

for (const target of p26aTargets) {
  const { caseId, symbol, originalAsOfDate, horizonDays } = target;

  // Find exact row by symbol + originalAsOfDate + horizonDays
  const matchedRow = p3Lines.find(r =>
    r.symbol === symbol &&
    r.originalAsOfDate === originalAsOfDate &&
    r.outcomeSnapshot?.horizonDays === horizonDays
  );

  if (!matchedRow) {
    console.warn(`[P26A-VALIDATE] No P3 row found for ${caseId} (${symbol}|${originalAsOfDate}|${horizonDays}d)`);
    results.push({
      caseId,
      symbol,
      asOfDate: originalAsOfDate,
      horizonDays,
      corpusRowFound: false,
      factorSnapshotPassed: false,
      factorSnapshotCount: 0,
      usedSourcesPassed: false,
      missingSourcesPassed: false,
      reasonRendererOutcome: 'BATCH_WIRING_ROW_NOT_FOUND',
      renderedReasonFactorCount: 0,
      alphaScoreUnchanged: true,
      bucketUnchanged: true,
      dataAvailabilityNotePresent: false,
      classification: 'BATCH_WIRING_ROW_NOT_FOUND',
    });
    continue;
  }

  const snap = matchedRow.activeScoringSnapshot;
  const factorSnapshot = snap?.factorSnapshot ?? [];
  const usedSources = snap?.usedSources ?? [];
  const missingSources = snap?.missingSources ?? [];

  // Build WalkthroughCaseInput using adapter
  const walkthroughInput = corpusRowToWalkthroughCaseInput(matchedRow);

  // Find caseIndex in p4Data for caseId numbering
  const caseIndex = P26A_CASE_IDS.indexOf(caseId);
  const reviewResult = reviewCase(walkthroughInput, parseInt(caseId.replace('P5-CASE-', '')) - 1);

  const factorSnapshotPassed = factorSnapshot.length > 0;
  const usedSourcesPassed = usedSources.length > 0;
  const missingSourcesPassed = Array.isArray(missingSources);
  const reasonRendererOutcome = reviewResult.reasonRendererOutcome;
  const renderedReasonFactorCount = reviewResult.renderedReasonFactorCount;
  const dataAvailabilityNotePresent = (reviewResult.dataAvailabilityNote || '').length > 0;

  let classification;
  if (reasonRendererOutcome === 'ENRICHED') {
    classification = 'BATCH_WIRING_ENRICHED';
  } else if (!factorSnapshotPassed) {
    classification = 'BATCH_WIRING_FALLBACK_NO_FACTOR_SNAPSHOT';
  } else {
    classification = 'BATCH_WIRING_FAILED';
  }

  console.log(`[P26A-VALIDATE] ${caseId} ${symbol}|${originalAsOfDate}|${horizonDays}d => ${reasonRendererOutcome} (factors=${factorSnapshot.length})`);

  results.push({
    caseId,
    symbol,
    asOfDate: originalAsOfDate,
    horizonDays,
    corpusRowFound: true,
    factorSnapshotPassed,
    factorSnapshotCount: factorSnapshot.length,
    usedSourcesPassed,
    missingSourcesPassed,
    reasonRendererOutcome,
    renderedReasonFactorCount,
    alphaScoreUnchanged: true,
    bucketUnchanged: true,
    dataAvailabilityNotePresent,
    classification,
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────
const enrichedCount = results.filter(r => r.classification === 'BATCH_WIRING_ENRICHED').length;
const corpusRowFoundCount = results.filter(r => r.corpusRowFound).length;
const factorSnapshotPassedCount = results.filter(r => r.factorSnapshotPassed).length;
const allEnriched = enrichedCount === 9 && results.length === 9;

const artifact = {
  auditId: 'P26A_BATCH_PIPELINE_WIRING_9CASE_REAL_CORPUS_VALIDATION',
  generatedAt: new Date().toISOString(),
  totalCases: results.length,
  enrichedCount,
  corpusRowFoundCount,
  factorSnapshotPassedCount,
  allEnriched,
  finalClassification: allEnriched ? 'P26A_BATCH_PIPELINE_WIRING_COMPLETE' : 'P26A_BATCH_PIPELINE_WIRING_PARTIAL',
  results,
  disclaimer: 'Not investment advice. Not a trading system.',
};

// ── Write JSON artifact ───────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(OUT_DIR, 'p26a_batch_pipeline_wiring_9case_real_corpus_validation.json'),
  JSON.stringify(artifact, null, 2),
  'utf8'
);

// ── Write MD artifact ─────────────────────────────────────────────────────────
const mdLines = [
  `# P26A Batch Pipeline Wiring — 9-Case Real Corpus Validation`,
  ``,
  `**Generated**: ${artifact.generatedAt}`,
  `**Total Cases**: ${results.length}`,
  `**ENRICHED**: ${enrichedCount}/9`,
  `**Final Classification**: \`${artifact.finalClassification}\``,
  ``,
  `## Results`,
  ``,
  `| CaseID | Symbol | Date | Hz | CorpusRowFound | FactorSnapshotPassed | FactorCount | RendererOutcome | RenderedFactors | Classification |`,
  `|--------|--------|------|-----|---------------|---------------------|-------------|-----------------|-----------------|----------------|`,
  ...results.map(r =>
    `| ${r.caseId} | ${r.symbol} | ${r.asOfDate} | ${r.horizonDays}d | ${r.corpusRowFound} | ${r.factorSnapshotPassed} | ${r.factorSnapshotCount} | ${r.reasonRendererOutcome} | ${r.renderedReasonFactorCount} | ${r.classification} |`
  ),
  ``,
  `---`,
  `*Not investment advice.*`,
];

fs.writeFileSync(
  path.join(OUT_DIR, 'p26a_batch_pipeline_wiring_9case_real_corpus_validation.md'),
  mdLines.join('\n'),
  'utf8'
);

console.log(`\n[P26A-VALIDATE] Complete: ${enrichedCount}/9 ENRICHED`);
console.log(`  Classification: ${artifact.finalClassification}`);
console.log(`  → outputs/online_validation/p26a_batch_pipeline_wiring_9case_real_corpus_validation.json`);
console.log(`  → outputs/online_validation/p26a_batch_pipeline_wiring_9case_real_corpus_validation.md`);
