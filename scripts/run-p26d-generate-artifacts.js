// scripts/run-p26d-generate-artifacts.js
// Generates PART C (MonthlyRevenue coverage) and PART D (Read-only context coverage) artifacts
// No external dependencies. Plain Node.js.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'outputs/online_validation');
const FIXTURES_DIR = path.join(OUT_DIR, 'fixtures');

function toTaiwanDateStr(ts) {
  const ms = Date.parse(ts);
  if (isNaN(ms)) return '';
  return new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function readJsonlCorpus(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.split('\n').filter(function(l) { return l.trim(); }).map(function(l) { return JSON.parse(l); });
}

function generateMonthlyRevenueCoverage() {
  const AS_OF_DATE = '2026-05-13';

  const p3Rows = readJsonlCorpus(path.join(OUT_DIR, 'p3active_scoring_historical_replay_corpus.jsonl'));
  const p19Rows = readJsonlCorpus(path.join(OUT_DIR, 'p19active_scoring_pit_replay_corpus.jsonl'));
  const allRows = p3Rows.concat(p19Rows);

  const rowsWithMonthlyRevenue = allRows.filter(function(r) {
    return ('monthlyRevenueContext' in r) || ('revenueContext' in r) || ('monthlyRevenue' in r);
  });

  const syntheticRows = [
    { symbol: '2330', releaseDate: '2026-05-01', reasonContext: 'Q1 revenue strong', factorEvidence: 'Revenue up 12% YoY' },
    { symbol: '2330', releaseDate: '2026-04-01', reasonContext: 'Stable monthly revenue', factorEvidence: 'Sequential growth' },
    { symbol: '2454', releaseDate: '2026-05-10', reasonContext: 'Revenue beat estimates' },
    { symbol: '2454', releaseDate: '2026-06-01' },
    { symbol: '2317' },
  ];

  function classifyRow(row) {
    if (!row.releaseDate) return 'invalid';
    const d = toTaiwanDateStr(row.releaseDate) || row.releaseDate.slice(0, 10);
    if (!d) return 'invalid';
    return d <= AS_OF_DATE ? 'available' : 'future';
  }

  let available = 0, future = 0, invalid = 0, withReason = 0, withFactor = 0;
  for (const row of syntheticRows) {
    const c = classifyRow(row);
    if (c === 'available') available++;
    else if (c === 'future') future++;
    else invalid++;
    if (row.reasonContext && row.reasonContext.trim()) withReason++;
    if (row.factorEvidence && row.factorEvidence.trim()) withFactor++;
  }

  const result = {
    phase: 'P26D-HARDRESET',
    generatedAt: AS_OF_DATE,
    asOfDate: AS_OF_DATE,
    corpusScanResult: {
      totalRows: rowsWithMonthlyRevenue.length,
      description: 'P3/P19 corpus rows with monthlyRevenueContext or revenueContext field',
      note: 'These are scoring corpus rows. MonthlyRevenue context is not present in P3/P19.'
    },
    syntheticTestData: {
      totalRows: syntheticRows.length,
      availableRows: available,
      futureRows: future,
      invalidRows: invalid,
      withReasonContext: withReason,
      withFactorEvidence: withFactor,
      coverageRatio: available / syntheticRows.length,
      description: 'Synthetic test data for coverage validation.'
    },
    coverageDimensions: {
      monthlyRevenueAvailableAsOf: { checked: true, gate: 'releaseDate <= asOfDate', readOnly: true },
      monthlyRevenueReasonContextPresent: { checked: true, presentCount: withReason, readOnly: true },
      monthlyRevenueFactorEvidencePresent: { checked: true, presentCount: withFactor, readOnly: true }
    },
    noOutcomeFieldsUsed: true,
    contextReadOnly: true,
    entersAlphaScore: false,
    disclaimer: 'No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.'
  };

  const jsonOut = path.join(OUT_DIR, 'p26d_monthly_revenue_targeted_coverage.json');
  fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));

  const md = [
    '# P26D MonthlyRevenue Targeted Coverage',
    '',
    '**Phase:** P26D-HARDRESET  ',
    '**Generated:** ' + AS_OF_DATE,
    '',
    '## Corpus Scan',
    '',
    'P3/P19 corpus rows with monthlyRevenueContext: **' + rowsWithMonthlyRevenue.length + '**',
    '',
    'These are scoring corpus rows. MonthlyRevenue context rows are a separate corpus not present in P3/P19.',
    '',
    '## Synthetic Test Data Coverage',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    '| Total Rows | ' + syntheticRows.length + ' |',
    '| Available | ' + available + ' |',
    '| Future | ' + future + ' |',
    '| Invalid | ' + invalid + ' |',
    '| With reasonContext | ' + withReason + ' |',
    '| With factorEvidence | ' + withFactor + ' |',
    '',
    '## Safety',
    '',
    '- Context read-only: yes',
    '- No outcome fields: yes',
    '- Enters alphaScore: false',
    '',
    '---',
    '*No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.*'
  ].join('\n');

  const mdOut = path.join(OUT_DIR, 'p26d_monthly_revenue_targeted_coverage.md');
  fs.writeFileSync(mdOut, md);
  console.log('Written: ' + jsonOut);
  console.log('Written: ' + mdOut);
}

function generateReadOnlyContextCoverage() {
  const AS_OF_DATE = '2026-05-13';

  function resolveAvailabilityDate(row) {
    const fields = ['filingDate', 'announcementDate', 'publishedAt', 'availableAt'];
    for (const f of fields) {
      if (row[f] && typeof row[f] === 'string' && row[f].trim()) return row[f];
    }
    return null;
  }

  const newsFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'p26b_news_events_fixture.json'), 'utf8'));
  const newsEvents = newsFixture.events || [];
  let newsVisible = 0, newsFuture = 0, newsInvalid = 0;
  for (const ev of newsEvents) {
    if (!ev.publishedAt) { newsInvalid++; continue; }
    const d = toTaiwanDateStr(ev.publishedAt);
    if (!d) { newsInvalid++; continue; }
    if (d <= AS_OF_DATE) newsVisible++;
    else newsFuture++;
  }

  const finFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'p26c_financial_reports_fixture.json'), 'utf8'));
  const finReports = finFixture.reports || [];
  let finVisible = 0, finFuture = 0, finInvalid = 0, finNoDate = 0;
  for (const r of finReports) {
    const avail = resolveAvailabilityDate(r);
    if (!avail) { finNoDate++; continue; }
    const d = toTaiwanDateStr(avail) || avail.slice(0, 10);
    if (!d) { finInvalid++; continue; }
    if (d <= AS_OF_DATE) finVisible++;
    else finFuture++;
  }

  const result = {
    phase: 'P26D-HARDRESET',
    generatedAt: AS_OF_DATE,
    asOfDate: AS_OF_DATE,
    news: {
      total: newsEvents.length,
      visible: newsVisible,
      future: newsFuture,
      invalid: newsInvalid,
      entersAlphaScore: false,
      fixture: 'p26b_news_events_fixture.json',
      gate: 'publishedAt'
    },
    financial: {
      total: finReports.length,
      visible: finVisible,
      future: finFuture,
      invalid: finInvalid,
      noAvailabilityDate: finNoDate,
      entersAlphaScore: false,
      fixture: 'p26c_financial_reports_fixture.json',
      gate: 'filingDate -> announcementDate -> publishedAt -> availableAt'
    },
    contextsReadOnly: true,
    sourceMappingRequired: true,
    noOutcomeFieldsUsed: true,
    disclaimer: 'No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.'
  };

  const jsonOut = path.join(OUT_DIR, 'p26d_read_only_context_coverage.json');
  fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));

  const md = [
    '# P26D Read-Only Context Coverage',
    '',
    '**Phase:** P26D-HARDRESET  ',
    '**Generated:** ' + AS_OF_DATE,
    '**asOfDate:** ' + AS_OF_DATE,
    '',
    '## NewsEvent Context Coverage',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    '| Total | ' + newsEvents.length + ' |',
    '| Visible | ' + newsVisible + ' |',
    '| Future | ' + newsFuture + ' |',
    '| Invalid | ' + newsInvalid + ' |',
    '| Enters alphaScore | false |',
    '',
    '## FinancialReport Context Coverage',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    '| Total | ' + finReports.length + ' |',
    '| Visible | ' + finVisible + ' |',
    '| Future | ' + finFuture + ' |',
    '| Invalid | ' + finInvalid + ' |',
    '| No Availability Date | ' + finNoDate + ' |',
    '| Enters alphaScore | false |',
    '',
    '## Safety',
    '',
    '- Contexts read-only: yes',
    '- No outcome fields: yes',
    '- Source mapping required (fixture-only): yes',
    '',
    '---',
    '*No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.*'
  ].join('\n');

  const mdOut = path.join(OUT_DIR, 'p26d_read_only_context_coverage.md');
  fs.writeFileSync(mdOut, md);
  console.log('Written: ' + jsonOut);
  console.log('Written: ' + mdOut);
}

generateMonthlyRevenueCoverage();
generateReadOnlyContextCoverage();
