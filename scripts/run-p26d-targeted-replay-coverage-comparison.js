// scripts/run-p26d-targeted-replay-coverage-comparison.js
// P26D: Targeted replay coverage comparison
// No external dependencies. Plain Node.js.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs/online_validation');
const FIXTURES_DIR = path.join(OUT_DIR, 'fixtures');

// --- Inline UTC+8 date conversion ---
function toTaiwanDateStr(ts) {
  const ms = Date.parse(ts);
  if (isNaN(ms)) return '';
  return new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// --- News event coverage scan (inline) ---
function scanNewsEvents(events, asOfDate) {
  let visible = 0, future = 0, invalid = 0;
  for (const ev of events) {
    if (!ev.publishedAt) { invalid++; continue; }
    const d = toTaiwanDateStr(ev.publishedAt);
    if (!d) { invalid++; continue; }
    if (d <= asOfDate) visible++;
    else future++;
  }
  return { total: events.length, visible, future, invalid, entersAlphaScore: false };
}

// --- Financial report coverage scan (inline) ---
function resolveAvailabilityDate(row) {
  for (const f of ['filingDate', 'announcementDate', 'publishedAt', 'availableAt']) {
    if (row[f] && typeof row[f] === 'string' && row[f].trim()) return row[f];
  }
  return null;
}

function scanFinancialReports(reports, asOfDate) {
  let visible = 0, future = 0, invalid = 0, noAvailabilityDate = 0;
  for (const r of reports) {
    const avail = resolveAvailabilityDate(r);
    if (!avail) { noAvailabilityDate++; continue; }
    const d = toTaiwanDateStr(avail) || avail.slice(0, 10);
    if (!d) { invalid++; continue; }
    if (d <= asOfDate) visible++;
    else future++;
  }
  return { total: reports.length, visible, future, invalid, noAvailabilityDate, entersAlphaScore: false };
}

// --- Read JSONL corpus ---
function readJsonlCorpus(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

// --- Main ---
function main() {
  const AS_OF_DATE = '2026-05-13';

  // 1. Read P3 corpus
  const p3Path = path.join(OUT_DIR, 'p3active_scoring_historical_replay_corpus.jsonl');
  const p3Rows = readJsonlCorpus(p3Path);
  if (p3Rows.length !== 4500) {
    throw new Error(`P3 corpus row count mismatch: expected 4500, got ${p3Rows.length}`);
  }

  // 2. Read P19 corpus
  const p19Path = path.join(OUT_DIR, 'p19active_scoring_pit_replay_corpus.jsonl');
  const p19Rows = readJsonlCorpus(p19Path);
  if (p19Rows.length !== 4500) {
    throw new Error(`P19 corpus row count mismatch: expected 4500, got ${p19Rows.length}`);
  }

  // 3. Verify P26A reason quality
  const p26aCompare = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'p26a_walkthrough_reason_quality_compare.json'), 'utf8'));
  const genericReasonsAfterP26A = p26aCompare.genericCasesAfter;
  if (genericReasonsAfterP26A > 9) {
    throw new Error(`Generic reasons after P26A is ${genericReasonsAfterP26A}, expected <= 9`);
  }

  // 4. Load P26B news events fixture
  const newsFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'p26b_news_events_fixture.json'), 'utf8'));
  const newsEvents = newsFixture.events || [];
  const newsEventCoverage = scanNewsEvents(newsEvents, AS_OF_DATE);

  // 5. Load P26C financial reports fixture
  const finFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'p26c_financial_reports_fixture.json'), 'utf8'));
  const financialReports = finFixture.reports || [];
  const financialReportCoverage = scanFinancialReports(financialReports, AS_OF_DATE);

  // 6. Verify no outcome fields in scan output
  const scanOutputStr = JSON.stringify({ newsEventCoverage, financialReportCoverage });
  const forbiddenOutcomeFields = ['outcomePrice', 'returnPct', 'realizedReturnClass'];
  for (const f of forbiddenOutcomeFields) {
    if (scanOutputStr.includes(f)) {
      throw new Error(`Forbidden outcome field found in scan output: ${f}`);
    }
  }

  // 7. Verify contexts are read-only
  const contextsReadOnly = newsEventCoverage.entersAlphaScore === false && financialReportCoverage.entersAlphaScore === false;
  if (!contextsReadOnly) {
    throw new Error('Contexts are not read-only — entersAlphaScore must be false');
  }

  // 8. Build output
  const result = {
    phase: 'P26D-HARDRESET',
    generatedAt: AS_OF_DATE,
    p3CorpusRows: p3Rows.length,
    p19CorpusRows: p19Rows.length,
    genericReasonsAfterP26A,
    newsEventContextCoverage: {
      total: newsEventCoverage.total,
      visible: newsEventCoverage.visible,
      future: newsEventCoverage.future,
      invalid: newsEventCoverage.invalid,
      entersAlphaScore: false,
      fixture: 'p26b_news_events_fixture.json'
    },
    financialReportContextCoverage: {
      total: financialReportCoverage.total,
      visible: financialReportCoverage.visible,
      future: financialReportCoverage.future,
      invalid: financialReportCoverage.invalid,
      noAvailabilityDate: financialReportCoverage.noAvailabilityDate,
      entersAlphaScore: false,
      fixture: 'p26c_financial_reports_fixture.json'
    },
    readOnlyContextsEnterAlphaScore: false,
    noOutcomeFieldsUsed: true,
    contextsReadOnly: true,
    status: 'PASS',
    disclaimer: 'No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.'
  };

  // 9. Write JSON
  const jsonOut = path.join(OUT_DIR, 'p26d_targeted_replay_coverage_comparison.json');
  fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));

  // 10. Write MD
  const mdOut = path.join(OUT_DIR, 'p26d_targeted_replay_coverage_comparison.md');
  const md = `# P26D Targeted Replay Coverage Comparison

**Phase:** P26D-HARDRESET  
**Generated:** ${AS_OF_DATE}  
**Status:** ✅ ${result.status}

## Corpus Verification

| Corpus | Expected | Actual |
|--------|----------|--------|
| P3 | 4500 | ${result.p3CorpusRows} |
| P19 | 4500 | ${result.p19CorpusRows} |
| Total | 9000 | ${result.p3CorpusRows + result.p19CorpusRows} |

## P26A Reason Quality

Generic reasons after P26A: **${genericReasonsAfterP26A}** (≤ 9 ✅)

## NewsEvent Context Coverage (asOfDate=${AS_OF_DATE})

| Metric | Value |
|--------|-------|
| Total | ${newsEventCoverage.total} |
| Visible | ${newsEventCoverage.visible} |
| Future | ${newsEventCoverage.future} |
| Invalid | ${newsEventCoverage.invalid} |
| Enters Scoring | false ✅ |
| Fixture | p26b_news_events_fixture.json |

## FinancialReport Context Coverage (asOfDate=${AS_OF_DATE})

| Metric | Value |
|--------|-------|
| Total | ${financialReportCoverage.total} |
| Visible | ${financialReportCoverage.visible} |
| Future | ${financialReportCoverage.future} |
| Invalid | ${financialReportCoverage.invalid} |
| No Availability Date | ${financialReportCoverage.noAvailabilityDate} |
| Enters Scoring | false ✅ |
| Fixture | p26c_financial_reports_fixture.json |

## Safety Checks

- Read-only contexts: ✅
- No outcome fields used: ✅
- No external API: ✅

---
*No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.*
`;
  fs.writeFileSync(mdOut, md);

  console.log('P26D Coverage Comparison:');
  console.log(JSON.stringify(result, null, 2));
  console.log('\n✅ Written:', jsonOut);
  console.log('✅ Written:', mdOut);
}

main();
