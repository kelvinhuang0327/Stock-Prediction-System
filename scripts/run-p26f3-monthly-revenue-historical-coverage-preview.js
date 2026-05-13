// P26F3-HARDRESET: MonthlyRevenue Historical Coverage Preview
// DISCLAIMER: Does not constitute investment advice.
// NO DB WRITE. NO CORPUS OVERWRITE. DRY-RUN ONLY.
// Uses candidateReleaseDate (INFERRED) for template-only rows.
// Template coverage is NOT real coverage.

'use strict';
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../outputs/online_validation');

function loadJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

const candidatesPath = path.join(OUT_DIR, 'p26f3_monthly_revenue_historical_source_candidates.jsonl');
const p3Path = path.join(OUT_DIR, 'p3active_scoring_historical_replay_corpus.jsonl');
const p19Path = path.join(OUT_DIR, 'p19active_scoring_pit_replay_corpus.jsonl');

const candidates = loadJsonl(candidatesPath);
const p3Rows = loadJsonl(p3Path);
const p19Rows = loadJsonl(p19Path);

console.log(`Candidates: ${candidates.length}, P3: ${p3Rows.length}, P19: ${p19Rows.length}`);

function isCandidateVisible(candidate, asOfDate) {
  if (!candidate.candidateReleaseDate || candidate.candidateReleaseDate === 'INVALID') return false;
  return candidate.candidateReleaseDate <= asOfDate;
}

function selectLatestCandidateAsOf(candidatesBySymbol, symbol, asOfDate) {
  const list = candidatesBySymbol[symbol] || [];
  const visible = list.filter(c => isCandidateVisible(c, asOfDate));
  if (!visible.length) return null;
  visible.sort((a, b) => {
    if (b.candidateReleaseDate !== a.candidateReleaseDate) {
      return b.candidateReleaseDate < a.candidateReleaseDate ? -1 : 1;
    }
    return (b.year * 12 + b.month) - (a.year * 12 + a.month);
  });
  return visible[0];
}

// Build index by stockId
const candidatesBySymbol = {};
for (const c of candidates) {
  if (!candidatesBySymbol[c.stockId]) candidatesBySymbol[c.stockId] = [];
  candidatesBySymbol[c.stockId].push(c);
}

// Real source candidates (none in P26F3)
const realSourceCandidates = candidates.filter(c => c.isRealSource);
const templateCandidates = candidates.filter(c => !c.isRealSource);

// Count matches
let realMatchedRows = 0;
let templateMatchedP3 = 0;
let templateMatchedP19 = 0;
const matchedSymbols = new Set();
const unmatchedSymbols = new Set();

for (const row of p3Rows) {
  const asOfDate = row.originalAsOfDate || row.asOfDate;
  const symbol = row.symbol;
  const match = selectLatestCandidateAsOf(candidatesBySymbol, symbol, asOfDate);
  if (match) {
    if (match.isRealSource) realMatchedRows++;
    else templateMatchedP3++;
    matchedSymbols.add(symbol);
  } else {
    unmatchedSymbols.add(symbol);
  }
}

for (const row of p19Rows) {
  const asOfDate = row.originalAsOfDate || row.asOfDate;
  const symbol = row.symbol;
  const match = selectLatestCandidateAsOf(candidatesBySymbol, symbol, asOfDate);
  if (match) {
    if (match.isRealSource) realMatchedRows++;
    else templateMatchedP19++;
    matchedSymbols.add(symbol);
  } else {
    unmatchedSymbols.add(symbol);
  }
}

const templateMatchedRows = templateMatchedP3 + templateMatchedP19;
const totalCandidateRows = candidates.length;
const realCoverageRatio = 0;
const templateCoverageNote = `${templateMatchedRows}/9000 (NOT real coverage — template only, revenue=null)`;

// Date ranges
const sortedDates = [...new Set(candidates.map(c => c.candidateReleaseDate))].sort();
const earliest = sortedDates[0] || null;
const latest = sortedDates[sortedDates.length - 1] || null;

const preview = {
  phase: "P26F3-HARDRESET",
  date: "2026-05-13",
  p3CorpusRows: p3Rows.length,
  p19CorpusRows: p19Rows.length,
  totalCandidateRows,
  realSourceRows: realSourceCandidates.length,
  templateOnlyRows: templateCandidates.length,
  realMatchedRows,
  templateMatchedRows,
  realCoverageRatio,
  templateCoverageRatio: templateCoverageNote,
  templateIsNotRealCoverage: true,
  coverageNote: "Template rows have no revenue data (revenueMissing=true). Real coverage requires actual TWSE historical data import.",
  candidateDateRange: { earliest, latest },
  targetPeriodsWithTemplates: ["2025-09","2025-10","2025-11","2025-12","2026-01"],
  missingPeriodsForRealCoverage: ["2025-09","2025-10","2025-11","2025-12","2026-01"],
  matchedSymbols: [...matchedSymbols].sort(),
  unmatchedSymbols: [...unmatchedSymbols].sort(),
  unmatchedSymbolsCount: unmatchedSymbols.size,
  dataGapAnalysis: {
    requiredDataPeriods: "2025-09 through 2026-01",
    requiredCandidateDates: "2025-10-10 through 2026-02-10",
    dbCurrentPeriods: ["2026-02","2026-03"],
    gapType: "HISTORICAL_DATA_NOT_IN_DB",
    acquisitionPath: "TWSE monthly revenue public data (manual acquisition required)",
  },
  scoringImprovementClaimed: false,
  optimizerReadinessClaimed: false,
  classification: "P26F3_SOURCE_NOT_FOUND_TEMPLATE_ONLY",
  status: "PREVIEW_COMPLETE",
};

const previewJsonPath = path.join(OUT_DIR, 'p26f3_historical_coverage_preview.json');
fs.writeFileSync(previewJsonPath, JSON.stringify(preview, null, 2), 'utf8');
console.log(`Written: ${previewJsonPath}`);

const previewMd = `# P26F3-HARDRESET — Historical Coverage Preview

**Date**: 2026-05-13  
**Classification**: P26F3_SOURCE_NOT_FOUND_TEMPLATE_ONLY

## Coverage Summary
| Metric | Value |
|---|---|
| P3 corpus rows | ${p3Rows.length} |
| P19 corpus rows | ${p19Rows.length} |
| Real source rows | 0 |
| Template-only rows | ${templateCandidates.length} |
| Real matched rows | 0 |
| Template matched rows | ${templateMatchedRows} (NOT real coverage) |
| Real coverage ratio | 0 |

## Template Matched Note
Template rows have \`revenueMissing=true\` and \`isRealSource=false\`.  
Template matches are informational only — they do NOT represent real data coverage.

For 2026-01 month, candidateReleaseDate=2026-02-10 ≤ corpus asOfDate max (2026-02-11), so template rows "match" in date terms.  
However, since revenue=null, this is NOT actionable coverage.

## Data Gap Analysis
- DB current periods: 2026-02, 2026-03 only
- Required periods: 2025-09 through 2026-01
- Required candidate dates: 2025-10-10 through 2026-02-10
- Gap type: HISTORICAL_DATA_NOT_IN_DB
- Acquisition path: TWSE monthly revenue data (manual acquisition)

## Matched Symbols (template)
${[...matchedSymbols].sort().join(', ') || 'None'}

## Unmatched Symbols
${[...unmatchedSymbols].sort().join(', ') || 'None'}

**Next step**: P26F3-2 Manual Historical Source Acquisition (TWSE monthly revenue 2025-09 to 2026-01)
`;

const previewMdPath = path.join(OUT_DIR, 'p26f3_historical_coverage_preview.md');
fs.writeFileSync(previewMdPath, previewMd, 'utf8');
console.log(`Written: ${previewMdPath}`);
console.log(`Template matched: P3=${templateMatchedP3}, P19=${templateMatchedP19}, total=${templateMatchedRows}`);
console.log('run-p26f3-monthly-revenue-historical-coverage-preview: COMPLETE');
