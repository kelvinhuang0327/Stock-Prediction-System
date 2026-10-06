/**
 * P26F-HARDRESET: MonthlyRevenue Coverage Delta
 *
 * Reads P26E baseline and P26F candidate summary, computes delta.
 * No ROI/win-rate/profit/outperform/buy/sell claims.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const OUT_DIR = 'outputs/online_validation';
const P26E_BASELINE = path.join(OUT_DIR, 'p26e_coverage_ratio_scan.json');
const P26F_SUMMARY = path.join(OUT_DIR, 'p26f_monthly_revenue_candidate_corpus_summary.json');
const DELTA_JSON = path.join(OUT_DIR, 'p26f_monthly_revenue_coverage_delta.json');
const DELTA_MD = path.join(OUT_DIR, 'p26f_monthly_revenue_coverage_delta.md');

const p26eBaseline = JSON.parse(fs.readFileSync(P26E_BASELINE, 'utf8'));
const p26fSummary = JSON.parse(fs.readFileSync(P26F_SUMMARY, 'utf8'));

const beforeMatchedRows = 0; // P26E baseline: MonthlyRevenue coverage = 0
const afterCandidateMatchedRows = p26fSummary.totalMatchedRows;
const deltaMatchedRows = afterCandidateMatchedRows - beforeMatchedRows;
const coverageImproved = deltaMatchedRows > 0;

const coverageRatio = p26fSummary.coverageRatio || 0;
const coverageClassification = p26fSummary.coverageClassification || 'NONE';
const sourceMode = p26fSummary.sourceMode;
const missingReleaseDateCount = p26fSummary.dbReleaseDateNull;

const delta = {
  phase: 'P26F-HARDRESET',
  baseline: 'P26E baseline (MonthlyRevenue in P3/P19 = 0)',
  beforeMatchedRows,
  afterCandidateMatchedRows,
  deltaMatchedRows,
  candidateCoverageRatio: coverageRatio,
  coverageClassification,
  coverageImproved,
  sourceMode,
  missingReleaseDateCount,
  missingReleaseDateBlocksAllMatches: missingReleaseDateCount > 0 && afterCandidateMatchedRows === 0,
  topMissingReasons: [
    `All ${missingReleaseDateCount} MonthlyRevenue rows have releaseDate=null. PIT gate requires non-null releaseDate. No matches possible until releaseDate is populated.`,
  ],
  classification: 'P26F_SOURCE_MAPPING_IMPLEMENTED_BUT_NO_REAL_COVERAGE',
  nextAction: 'P26F_2_RELEASE_DATE_POPULATION: Populate releaseDate field in MonthlyRevenue table. Infer from TWSE public release schedule (typically next month\'s 10th day) or use explicit release dates.',
  scoringImprovementClaimed: false,
  optimizerReadinessClaimed: false,
  status: 'DELTA_COMPUTED',
};

fs.writeFileSync(DELTA_JSON, JSON.stringify(delta, null, 2));

const md = `# P26F MonthlyRevenue Coverage Delta

**Phase:** P26F-HARDRESET  
**Status:** DELTA_COMPUTED  
**Classification:** P26F_SOURCE_MAPPING_IMPLEMENTED_BUT_NO_REAL_COVERAGE

## Delta Summary

| Metric | Value |
|---|---|
| Baseline (P26E) matched rows | ${beforeMatchedRows} |
| Candidate (P26F) matched rows | ${afterCandidateMatchedRows} |
| Delta | ${deltaMatchedRows} |
| Coverage ratio | ${coverageRatio} |
| Coverage classification | ${coverageClassification} |
| Coverage improved | ${coverageImproved} |
| Source mode | ${sourceMode} |
| Missing releaseDate count | ${missingReleaseDateCount} |
| Missing releaseDate blocks all matches | ${delta.missingReleaseDateBlocksAllMatches} |

## Root Cause

${delta.topMissingReasons[0]}

## Next Action

${delta.nextAction}

## Constraints

- scoringImprovementClaimed: false
- optimizerReadinessClaimed: false
- No formal corpus replacement
- No scoring formula change

*Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.*
`;
fs.writeFileSync(DELTA_MD, md);

console.log(`[P26F] Coverage delta computed.`);
console.log(`  Before: ${beforeMatchedRows}, After: ${afterCandidateMatchedRows}, Delta: ${deltaMatchedRows}`);
console.log(`  Classification: ${delta.classification}`);
console.log(`  Output: ${DELTA_JSON}`);
