// P26F3-HARDRESET: MonthlyRevenue Historical Source Dry-run Builder
// DISCLAIMER: Does not constitute investment advice.
// NO DB WRITE. NO CORPUS OVERWRITE. DRY-RUN ONLY.
// Generates template-only rows for missing historical periods.
// No real revenue data fabricated.

'use strict';
const fs = require('fs');
const path = require('path');

const TARGET_PERIODS = [
  { year: 2025, month: 9, period: "2025-09" },
  { year: 2025, month: 10, period: "2025-10" },
  { year: 2025, month: 11, period: "2025-11" },
  { year: 2025, month: 12, period: "2025-12" },
  { year: 2026, month: 1, period: "2026-01" },
];

const TARGET_SYMBOLS = [
  "0055","00712","00738U","00830","00891","00903",
  "1210","1308","1314","1319","1326","1402","1434",
  "1513","1536","1560","1598","1605","1710","1717",
  "1802","2317","2330","2454","6415",
];

function inferNextMonthTenth(year, month) {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const mm = String(nextMonth).padStart(2, '0');
  return `${nextYear}-${mm}-10`;
}

function simpleHash(stockId, year, month) {
  const key = `${stockId}|${year}|${month}|null|null`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const OUT_DIR = path.join(__dirname, '../outputs/online_validation');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const rows = [];
for (const { year, month, period } of TARGET_PERIODS) {
  for (const stockId of TARGET_SYMBOLS) {
    rows.push({
      stockId,
      year,
      month,
      period,
      revenue: null,
      revenueMissing: true,
      releaseDate: null,
      releaseDateMissing: true,
      candidateReleaseDate: inferNextMonthTenth(year, month),
      releaseDateSourceCandidate: "INFERRED_NEXT_MONTH_10TH",
      releaseDateConfidenceCandidate: "LOW",
      needsManualReview: true,
      sourceType: "TEMPLATE_ONLY",
      isRealSource: false,
      dryRunOnly: true,
      dbWriteAllowed: false,
      corpusWriteAllowed: false,
      rowHash: simpleHash(stockId, year, month),
      reason: `No local historical source found for ${period}; template placeholder only — real revenue requires TWSE data acquisition`,
    });
  }
}

// Write JSONL
const jsonlPath = path.join(OUT_DIR, 'p26f3_monthly_revenue_historical_source_candidates.jsonl');
const jsonlContent = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
fs.writeFileSync(jsonlPath, jsonlContent, 'utf8');
console.log(`Written: ${jsonlPath} (${rows.length} rows)`);

// Candidate date distribution
const dateDist = {};
for (const r of rows) {
  dateDist[r.candidateReleaseDate] = (dateDist[r.candidateReleaseDate] || 0) + 1;
}

const summary = {
  phase: "P26F3-HARDRESET",
  date: "2026-05-13",
  localHistoricalSourceFound: false,
  realSourceRows: 0,
  templateOnlyRows: rows.length,
  totalRows: rows.length,
  targetPeriods: TARGET_PERIODS.map(p => p.period),
  targetSymbols: TARGET_SYMBOLS.length,
  periodsWithTemplates: TARGET_PERIODS.length,
  periodsWithRealData: 0,
  allDryRunOnly: true,
  allDbWriteDisabled: true,
  noRealRevenueData: true,
  templateIsNotRealCoverage: true,
  candidateDateDistribution: dateDist,
  status: "TEMPLATE_ONLY_CANDIDATES_BUILT",
};

const summaryJsonPath = path.join(OUT_DIR, 'p26f3_monthly_revenue_historical_source_summary.json');
fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2), 'utf8');
console.log(`Written: ${summaryJsonPath}`);

const summaryMd = `# P26F3-HARDRESET — Historical Source Dry-run Summary

**Date**: 2026-05-13
**Status**: TEMPLATE_ONLY_CANDIDATES_BUILT

## Result
- Local historical source found: **NO**
- Real source rows: 0
- Template-only rows: ${rows.length} (${TARGET_PERIODS.length} periods × ${TARGET_SYMBOLS.length} symbols)
- Template is NOT real coverage

## Target Periods (all missing)
${TARGET_PERIODS.map(p => `- ${p.period} → candidateReleaseDate: ${inferNextMonthTenth(p.year, p.month)}`).join('\n')}

## Candidate Date Distribution
${Object.entries(dateDist).map(([d, c]) => `- ${d}: ${c} rows`).join('\n')}

## Constraints
- dryRunOnly: true for all rows
- dbWriteAllowed: false for all rows
- No real revenue data fabricated
- Template rows require TWSE historical data acquisition for real coverage

**Next step**: P26F3-2 Manual Historical Source Acquisition (TWSE monthly revenue 2025-09 to 2026-01)
`;

const summaryMdPath = path.join(OUT_DIR, 'p26f3_monthly_revenue_historical_source_summary.md');
fs.writeFileSync(summaryMdPath, summaryMd, 'utf8');
console.log(`Written: ${summaryMdPath}`);
console.log('run-p26f3-monthly-revenue-historical-source-dry-run: COMPLETE');
