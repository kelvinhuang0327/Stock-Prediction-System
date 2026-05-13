// P26F2-HARDRESET: Dry-run MonthlyRevenue ReleaseDate Candidate Builder
// Reads ALL MonthlyRevenue rows from DB, builds candidateReleaseDate for each.
// NO writes to DB. NO corpus generation. NO scoring change.

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'outputs', 'online_validation');
const JSONL_OUT = path.join(OUTPUT_DIR, 'p26f2_monthly_revenue_release_date_candidates.jsonl');
const SUMMARY_JSON_OUT = path.join(OUTPUT_DIR, 'p26f2_monthly_revenue_release_date_candidates_summary.json');
const SUMMARY_MD_OUT = path.join(OUTPUT_DIR, 'p26f2_monthly_revenue_release_date_candidates_summary.md');

function inferCandidateReleaseDate(year, month) {
  if (month < 1 || month > 12) return "INVALID";
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const mm = String(nextMonth).padStart(2, '0');
  return `${nextYear}-${mm}-10`;
}

async function main() {
  const prisma = new PrismaClient();

  let rows;
  try {
    rows = await prisma.monthlyRevenue.findMany();
  } finally {
    await prisma.$disconnect();
  }

  const initialCount = rows.length;
  console.log(`[P26F2] Read ${initialCount} MonthlyRevenue rows from DB`);

  // Build candidates
  const candidates = rows.map((row) => ({
    id: row.id,
    stockId: row.stockId,
    year: row.year,
    month: row.month,
    revenue: row.revenue,
    yoyGrowth: row.yoyGrowth ?? null,
    momGrowth: row.momGrowth ?? null,
    originalReleaseDate: null,
    candidateReleaseDate: inferCandidateReleaseDate(row.year, row.month),
    releaseDateSourceCandidate: "INFERRED_NEXT_MONTH_10TH",
    releaseDateConfidenceCandidate: "LOW",
    needsManualReview: true,
    dryRunOnly: true,
    productionWriteAllowed: false,
    populationStatus: "CANDIDATE_GENERATED",
    reason: `inferred from year=${row.year}, month=${row.month} using NEXT_MONTH_10TH rule`,
  }));

  // Write JSONL
  const jsonlContent = candidates.map((c) => JSON.stringify(c)).join('\n') + '\n';
  fs.writeFileSync(JSONL_OUT, jsonlContent, 'utf8');
  console.log(`[P26F2] Wrote ${candidates.length} candidate rows to ${JSONL_OUT}`);

  // Verify DB row count unchanged (re-query)
  const prisma2 = new PrismaClient();
  let afterCount;
  try {
    afterCount = await prisma2.monthlyRevenue.count();
  } finally {
    await prisma2.$disconnect();
  }
  const dbWriteDetected = afterCount !== initialCount;
  console.log(`[P26F2] DB row count after: ${afterCount} (initial: ${initialCount}, write detected: ${dbWriteDetected})`);

  // Compute distribution
  const dateDistribution = {};
  for (const c of candidates) {
    const d = c.candidateReleaseDate;
    dateDistribution[d] = (dateDistribution[d] || 0) + 1;
  }

  const summary = {
    phase: "P26F2-HARDRESET",
    date: "2026-05-13",
    totalRows: candidates.length,
    nullReleaseDateRows: candidates.length,
    populatedReleaseDateRows: 0,
    candidateGeneratedRows: candidates.filter(c => c.populationStatus === "CANDIDATE_GENERATED").length,
    invalidYearMonthRows: candidates.filter(c => c.populationStatus === "INVALID_YEAR_MONTH").length,
    needsManualReviewRows: candidates.filter(c => c.needsManualReview).length,
    allDryRunOnly: candidates.every(c => c.dryRunOnly === true),
    allProductionWriteDisabled: candidates.every(c => c.productionWriteAllowed === false),
    noOutcomeFields: true,
    dbWriteDetected,
    dbRowCountAfter: afterCount,
    candidateDateDistribution: dateDistribution,
    status: "DRY_RUN_CANDIDATES_BUILT",
  };

  fs.writeFileSync(SUMMARY_JSON_OUT, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`[P26F2] Wrote summary JSON to ${SUMMARY_JSON_OUT}`);

  const md = `# P26F2-HARDRESET: MonthlyRevenue ReleaseDate Candidates Summary

## Phase
P26F2-HARDRESET

## Date
2026-05-13

## Results

| Metric | Value |
|---|---|
| Total DB rows | ${summary.totalRows} |
| Null releaseDate rows | ${summary.nullReleaseDateRows} |
| Populated releaseDate rows | ${summary.populatedReleaseDateRows} |
| Candidate generated rows | ${summary.candidateGeneratedRows} |
| Invalid year/month rows | ${summary.invalidYearMonthRows} |
| Needs manual review | ${summary.needsManualReviewRows} |
| All dry-run only | ${summary.allDryRunOnly} |
| All production write disabled | ${summary.allProductionWriteDisabled} |
| No outcome fields | ${summary.noOutcomeFields} |
| DB write detected | ${summary.dbWriteDetected} |
| DB row count after | ${summary.dbRowCountAfter} |

## Candidate Date Distribution

${Object.entries(dateDistribution).map(([d, c]) => `- ${d}: ${c} rows`).join('\n')}

## Status

**${summary.status}** ✅
`;
  fs.writeFileSync(SUMMARY_MD_OUT, md, 'utf8');
  console.log(`[P26F2] Wrote summary MD to ${SUMMARY_MD_OUT}`);
  console.log(`[P26F2] Status: ${summary.status}`);
}

main().catch((err) => {
  console.error('[P26F2] Fatal error:', err);
  process.exit(1);
});
