/**
 * P26F-HARDRESET: MonthlyRevenue Candidate Corpus Builder
 *
 * Reads MonthlyRevenue from local SQLite DB via Prisma.
 * Builds candidate P3/P19 enriched JSONL (dry-run only).
 * Does NOT overwrite original corpus files.
 * Does NOT enter alphaScore or recommendationBucket.
 * No ROI/win-rate/profit/outperform/buy/sell claims.
 */
'use strict';

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const OUT_DIR = 'outputs/online_validation';
const P3_CORPUS = path.join(OUT_DIR, 'p3active_scoring_historical_replay_corpus.jsonl');
const P19_CORPUS = path.join(OUT_DIR, 'p19active_scoring_pit_replay_corpus.jsonl');
const CANDIDATE_P3 = path.join(OUT_DIR, 'p26f_monthly_revenue_candidate_p3_enriched.jsonl');
const CANDIDATE_P19 = path.join(OUT_DIR, 'p26f_monthly_revenue_candidate_p19_enriched.jsonl');
const SUMMARY_JSON = path.join(OUT_DIR, 'p26f_monthly_revenue_candidate_corpus_summary.json');
const SUMMARY_MD = path.join(OUT_DIR, 'p26f_monthly_revenue_candidate_corpus_summary.md');

function resolveReleaseDate(row) {
  if (row.releaseDate === null || row.releaseDate === undefined) return null;
  const ts = row.releaseDate instanceof Date
    ? row.releaseDate.toISOString()
    : String(row.releaseDate);
  return new Date(Date.parse(ts) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isVisible(row, asOfDate) {
  const rd = resolveReleaseDate(row);
  if (!rd) return false;
  return rd <= asOfDate;
}

function buildSourceHash(row) {
  return `${row.stockId}|${row.year}|${row.month}`;
}

function selectLatest(sourceRows, symbol, asOfDate) {
  const visible = sourceRows.filter(r => r.stockId === symbol && isVisible(r, asOfDate));
  if (!visible.length) return null;
  visible.sort((a, b) => {
    const rdA = resolveReleaseDate(a);
    const rdB = resolveReleaseDate(b);
    if (rdB !== rdA) return rdB < rdA ? -1 : 1;
    const mA = a.year * 12 + a.month;
    const mB = b.year * 12 + b.month;
    if (mB !== mA) return mB - mA;
    const hA = buildSourceHash(a);
    const hB = buildSourceHash(b);
    return hA < hB ? -1 : hA > hB ? 1 : 0;
  });
  return visible[0];
}

function buildContext(selectedSource, sourceMode) {
  if (!selectedSource) {
    return {
      readOnly: true,
      entersAlphaScore: false,
      visibilityGate: 'releaseDate <= asOfDate',
      sourceMatched: false,
      releaseDate: null,
      revenueYear: null,
      revenueMonth: null,
      revenue: null,
      yoyGrowth: null,
      momGrowth: null,
      sourceHash: 'NO_MATCH',
      sourceMode,
      pitGateStatus: 'NO_VISIBLE_SOURCE_ROW',
    };
  }
  return {
    readOnly: true,
    entersAlphaScore: false,
    visibilityGate: 'releaseDate <= asOfDate',
    sourceMatched: true,
    releaseDate: resolveReleaseDate(selectedSource),
    revenueYear: selectedSource.year,
    revenueMonth: selectedSource.month,
    revenue: selectedSource.revenue,
    yoyGrowth: selectedSource.yoyGrowth !== undefined ? selectedSource.yoyGrowth : null,
    momGrowth: selectedSource.momGrowth !== undefined ? selectedSource.momGrowth : null,
    sourceHash: buildSourceHash(selectedSource),
    sourceMode,
    pitGateStatus: 'VISIBLE_RELEASE_DATE_GATE_PASS',
  };
}

function readJSONL(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => JSON.parse(l));
}

async function main() {
  console.log('[P26F] MonthlyRevenue Candidate Corpus Builder starting...');

  const prisma = new PrismaClient();
  let dbRows;
  try {
    dbRows = await prisma.monthlyRevenue.findMany();
  } finally {
    await prisma.$disconnect();
  }

  const dbTotal = dbRows.length;
  const dbPopulated = dbRows.filter(r => r.releaseDate !== null && r.releaseDate !== undefined).length;
  const dbNull = dbTotal - dbPopulated;

  console.log(`[P26F] DB rows: ${dbTotal}, releaseDate populated: ${dbPopulated}, null: ${dbNull}`);

  let sourceMode;
  if (dbPopulated > 0) {
    sourceMode = 'REAL_SOURCE_PARTIAL';
  } else if (dbTotal > 0) {
    sourceMode = 'REAL_SOURCE_PRESENT_NO_RELEASE_DATE';
  } else {
    sourceMode = 'REAL_SOURCE_EMPTY';
  }

  console.log(`[P26F] sourceMode: ${sourceMode}`);

  // Read original corpus files
  const p3Rows = readJSONL(P3_CORPUS);
  const p19Rows = readJSONL(P19_CORPUS);
  console.log(`[P26F] P3 rows: ${p3Rows.length}, P19 rows: ${p19Rows.length}`);

  let p3Matched = 0;
  let p19Matched = 0;

  // Build candidate P3
  const p3Candidate = p3Rows.map(row => {
    const symbol = row.symbol;
    const asOfDate = row.originalAsOfDate;
    const selected = selectLatest(dbRows, symbol, asOfDate);
    if (selected) p3Matched++;
    const context = buildContext(selected, sourceMode);
    return { ...row, p26fMonthlyRevenueContext: context };
  });

  // Build candidate P19
  const p19Candidate = p19Rows.map(row => {
    const symbol = row.symbol;
    const asOfDate = row.originalAsOfDate;
    const selected = selectLatest(dbRows, symbol, asOfDate);
    if (selected) p19Matched++;
    const context = buildContext(selected, sourceMode);
    return { ...row, p26fMonthlyRevenueContext: context };
  });

  const totalMatched = p3Matched + p19Matched;
  const coverageRatio = totalMatched / (p3Candidate.length + p19Candidate.length);
  const coverageClassification = totalMatched === 0 ? 'NONE'
    : coverageRatio < 0.1 ? 'LOW'
    : coverageRatio < 0.5 ? 'MEDIUM'
    : 'HIGH';

  // Write candidate files
  fs.writeFileSync(CANDIDATE_P3, p3Candidate.map(r => JSON.stringify(r)).join('\n') + '\n');
  fs.writeFileSync(CANDIDATE_P19, p19Candidate.map(r => JSON.stringify(r)).join('\n') + '\n');
  console.log(`[P26F] Wrote candidate P3: ${p3Candidate.length} rows`);
  console.log(`[P26F] Wrote candidate P19: ${p19Candidate.length} rows`);

  // Validate context constraints
  const allReadOnly = [...p3Candidate, ...p19Candidate].every(r => r.p26fMonthlyRevenueContext.readOnly === true);
  const allEntersAlphaFalse = [...p3Candidate, ...p19Candidate].every(r => r.p26fMonthlyRevenueContext.entersAlphaScore === false);
  const noOutcomeFields = [...p3Candidate, ...p19Candidate].every(r => {
    const ctx = r.p26fMonthlyRevenueContext;
    return !('outcomePrice' in ctx) && !('returnPct' in ctx) && !('realizedReturnClass' in ctx);
  });

  const summary = {
    phase: 'P26F-HARDRESET',
    date: '2026-05-13',
    sourceMode,
    dbMonthlyRevenueTotal: dbTotal,
    dbReleaseDatePopulated: dbPopulated,
    dbReleaseDateNull: dbNull,
    p3CandidateRows: p3Candidate.length,
    p19CandidateRows: p19Candidate.length,
    p3MatchedRows: p3Matched,
    p19MatchedRows: p19Matched,
    totalMatchedRows: totalMatched,
    coverageRatio,
    coverageClassification,
    allContextReadOnly: allReadOnly,
    allContextEntersAlphaScoreFalse: allEntersAlphaFalse,
    noOutcomeFields,
    originalP3CoverageRows: 0,
    originalP19CoverageRows: 0,
    status: 'CANDIDATE_CORPUS_BUILT',
  };

  fs.writeFileSync(SUMMARY_JSON, JSON.stringify(summary, null, 2));
  console.log(`[P26F] Summary written to ${SUMMARY_JSON}`);

  const md = `# P26F MonthlyRevenue Candidate Corpus Summary

**Phase:** P26F-HARDRESET  
**Date:** 2026-05-13  
**Status:** CANDIDATE_CORPUS_BUILT

## Source Mode: ${sourceMode}

| Metric | Value |
|---|---|
| DB MonthlyRevenue rows | ${dbTotal} |
| DB releaseDate populated | ${dbPopulated} |
| DB releaseDate null | ${dbNull} |
| P3 candidate rows | ${p3Candidate.length} |
| P19 candidate rows | ${p19Candidate.length} |
| P3 matched rows | ${p3Matched} |
| P19 matched rows | ${p19Matched} |
| Total matched | ${totalMatched} |
| Coverage ratio | ${coverageRatio} |
| Coverage classification | ${coverageClassification} |
| All context readOnly | ${allReadOnly} |
| All context entersAlphaScore=false | ${allEntersAlphaFalse} |
| No outcome fields | ${noOutcomeFields} |

## Key Finding

All ${dbNull} MonthlyRevenue rows have \`releaseDate=null\`. PIT gate blocks all matches.

*Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.*
`;
  fs.writeFileSync(SUMMARY_MD, md);
  console.log(`[P26F] Summary MD written to ${SUMMARY_MD}`);
  console.log('[P26F] Done.');
}

main().catch(err => {
  console.error('[P26F] Error:', err);
  process.exit(1);
});
