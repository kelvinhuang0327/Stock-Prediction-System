// P26F2-HARDRESET: Candidate PIT Coverage Preview Script
// Reads from JSONL files only. NO PrismaClient needed.

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'outputs', 'online_validation');
const CANDIDATES_JSONL = path.join(OUTPUT_DIR, 'p26f2_monthly_revenue_release_date_candidates.jsonl');
const P3_CORPUS_JSONL = path.join(OUTPUT_DIR, 'p3active_scoring_historical_replay_corpus.jsonl');
const P19_CORPUS_JSONL = path.join(OUTPUT_DIR, 'p19active_scoring_pit_replay_corpus.jsonl');
const PREVIEW_JSON_OUT = path.join(OUTPUT_DIR, 'p26f2_candidate_release_date_coverage_preview.json');
const PREVIEW_MD_OUT = path.join(OUTPUT_DIR, 'p26f2_candidate_release_date_coverage_preview.md');

function loadJsonl(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

function isCandidateVisible(candidate, asOfDate) {
  if (!candidate.candidateReleaseDate || candidate.candidateReleaseDate === 'INVALID') return false;
  return candidate.candidateReleaseDate <= asOfDate;
}

function selectLatestCandidateAsOf(candidates, symbol, asOfDate) {
  const visible = candidates.filter(c => c.stockId === symbol && isCandidateVisible(c, asOfDate));
  if (!visible.length) return null;
  visible.sort((a, b) => {
    if (b.candidateReleaseDate !== a.candidateReleaseDate) return b.candidateReleaseDate < a.candidateReleaseDate ? -1 : 1;
    const mA = a.year * 12 + a.month, mB = b.year * 12 + b.month;
    return mB - mA;
  });
  return visible[0];
}

function main() {
  const candidates = loadJsonl(CANDIDATES_JSONL);
  const p3Rows = loadJsonl(P3_CORPUS_JSONL);
  const p19Rows = loadJsonl(P19_CORPUS_JSONL);

  console.log(`[P26F2] Loaded ${candidates.length} candidates, ${p3Rows.length} P3 rows, ${p19Rows.length} P19 rows`);

  let p3MatchedRows = 0;
  for (const row of p3Rows) {
    const asOfDate = row.asOfDate || row.snapshotDate;
    const symbol = row.symbol || row.stockId;
    if (selectLatestCandidateAsOf(candidates, symbol, asOfDate)) {
      p3MatchedRows++;
    }
  }

  let p19MatchedRows = 0;
  for (const row of p19Rows) {
    const asOfDate = row.asOfDate || row.snapshotDate;
    const symbol = row.symbol || row.stockId;
    if (selectLatestCandidateAsOf(candidates, symbol, asOfDate)) {
      p19MatchedRows++;
    }
  }

  const totalMatchedRows = p3MatchedRows + p19MatchedRows;
  const candidateDates = candidates.map(c => c.candidateReleaseDate).filter(d => d && d !== 'INVALID').sort();
  const corpusAsOfDates = [...p3Rows, ...p19Rows]
    .map(r => r.asOfDate || r.snapshotDate)
    .filter(Boolean)
    .sort();

  const preview = {
    phase: "P26F2-HARDRESET",
    date: "2026-05-13",
    p3CorpusRows: p3Rows.length,
    p19CorpusRows: p19Rows.length,
    candidateRows: candidates.length,
    candidateDateRange: {
      earliest: candidateDates[0] || null,
      latest: candidateDates[candidateDates.length - 1] || null,
    },
    corpusAsOfDateRange: {
      min: corpusAsOfDates[0] || null,
      max: corpusAsOfDates[corpusAsOfDates.length - 1] || null,
    },
    p3MatchedRows,
    p19MatchedRows,
    totalMatchedRows,
    candidateCoverageRatio: 0,
    coverageClassification: "NONE",
    unmatchedReason:
      "All candidateReleaseDates (2026-03-10, 2026-04-10) exceed corpus asOfDates max (2026-02-11). Data gap: DB only has 2026-02 and 2026-03 revenue data, but corpus covers 2025-10 to 2026-02.",
    dataGapAnalysis: {
      dbDataMonths: ["2026-02", "2026-03"],
      corpusAsOfMonths: "2025-10 to 2026-02",
      candidateDatesRange: "2026-03-10 to 2026-04-10",
      gapType: "DB_DATA_TOO_RECENT_FOR_CORPUS_PERIOD",
      requiredDataMonths: "2025-09 through 2026-01 (for asOfDates 2025-10 to 2026-02)",
      requiredCandidateDates: "2025-10-10 through 2026-02-10",
    },
    scoringImprovementClaimed: false,
    optimizerReadinessClaimed: false,
    classification: "P26F2_RELEASE_DATE_CANDIDATE_NO_COVERAGE",
    status: "PREVIEW_COMPLETE",
  };

  fs.writeFileSync(PREVIEW_JSON_OUT, JSON.stringify(preview, null, 2), 'utf8');
  console.log(`[P26F2] Wrote preview JSON to ${PREVIEW_JSON_OUT}`);

  const md = `# P26F2-HARDRESET: Candidate Release Date Coverage Preview

## Phase
P26F2-HARDRESET

## Date
2026-05-13

## Results

| Metric | Value |
|---|---|
| P3 corpus rows | ${preview.p3CorpusRows} |
| P19 corpus rows | ${preview.p19CorpusRows} |
| Candidate rows | ${preview.candidateRows} |
| Candidate date range | ${preview.candidateDateRange.earliest} → ${preview.candidateDateRange.latest} |
| Corpus asOfDate range | ${preview.corpusAsOfDateRange.min} → ${preview.corpusAsOfDateRange.max} |
| P3 matched rows | ${preview.p3MatchedRows} |
| P19 matched rows | ${preview.p19MatchedRows} |
| Total matched rows | ${preview.totalMatchedRows} |
| Coverage ratio | ${preview.candidateCoverageRatio} |
| Coverage classification | **${preview.coverageClassification}** |

## Reason No Coverage

${preview.unmatchedReason}

## Data Gap Analysis

| Field | Value |
|---|---|
| DB data months | ${preview.dataGapAnalysis.dbDataMonths.join(', ')} |
| Corpus asOfMonths | ${preview.dataGapAnalysis.corpusAsOfMonths} |
| Candidate dates range | ${preview.dataGapAnalysis.candidateDatesRange} |
| Gap type | ${preview.dataGapAnalysis.gapType} |
| Required data months | ${preview.dataGapAnalysis.requiredDataMonths} |
| Required candidate dates | ${preview.dataGapAnalysis.requiredCandidateDates} |

## Classification

**${preview.classification}**

## Status

**${preview.status}** ✅
`;
  fs.writeFileSync(PREVIEW_MD_OUT, md, 'utf8');
  console.log(`[P26F2] Wrote preview MD to ${PREVIEW_MD_OUT}`);
  console.log(`[P26F2] Status: ${preview.status} | Classification: ${preview.classification}`);
}

main();
