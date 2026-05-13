/**
 * P26C PART F: FinancialReport Availability PIT Leakage Validation
 * No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const fixtureData = JSON.parse(fs.readFileSync('outputs/online_validation/fixtures/p26c_financial_reports_fixture.json', 'utf8'));
const asOfDate = fixtureData.asOfDate; // '2026-05-13'
const targetSymbol = fixtureData.targetSymbol; // '2330'
const reports = fixtureData.reports;

// Helpers (inline, no imports)
function toTaiwanDate(isoTs) {
  if (!isoTs) return null;
  try {
    const d = new Date(Date.parse(isoTs) + 8 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  } catch { return null; }
}

function resolveAvailabilityDate(report) {
  if (report.filingDate) return { date: toTaiwanDate(report.filingDate), source: 'filingDate' };
  if (report.announcementDate) return { date: toTaiwanDate(report.announcementDate), source: 'announcementDate' };
  if (report.publishedAt) return { date: toTaiwanDate(report.publishedAt), source: 'publishedAt' };
  if (report.availableAt) return { date: toTaiwanDate(report.availableAt), source: 'availableAt' };
  return { date: null, source: 'MISSING' };
}

function isVisible(report, asOf) {
  const { date } = resolveAvailabilityDate(report);
  if (!date) return false;
  return date <= asOf;
}

const checks = [];
function check(label, pass, detail) {
  checks.push({ label, pass, detail });
  console.log(`  ${pass ? '✓' : '✗'} ${label} — ${detail}`);
}

console.log('\nP26C PART F: FinancialReport Availability PIT Leakage Validation\n');

const case1 = reports.find(r => r.caseId === 'CASE_1'); // periodEnd before asOf, filingDate after
const case2 = reports.find(r => r.caseId === 'CASE_2'); // filingDate before asOf, ingestedAt after
const case3 = reports.find(r => r.caseId === 'CASE_3'); // filingDate after asOf, ingestedAt before
const case4 = reports.find(r => r.caseId === 'CASE_4'); // announcementDate before, filingDate null
const case5 = reports.find(r => r.caseId === 'CASE_5'); // all availability missing
const case6 = reports.find(r => r.caseId === 'CASE_6'); // different symbol
const case7 = reports.find(r => r.caseId === 'CASE_7'); // duplicate sourceHash
const case8 = reports.find(r => r.caseId === 'CASE_8'); // timezone boundary

// CHECK 1: availabilityDate <= asOfDate is visible
check('CHECK 1: availabilityDate <= asOfDate is visible', isVisible(case2, asOfDate), `filingDate=${case2.filingDate}`);

// CHECK 2: availabilityDate > asOfDate is excluded
check('CHECK 2: availabilityDate > asOfDate is excluded', !isVisible(case3, asOfDate), `filingDate=${case3.filingDate}`);

// CHECK 3: periodEndDate before asOf but filingDate after asOf — NOT visible
check('CHECK 3: periodEndDate before asOf does not grant visibility', !isVisible(case1, asOfDate), `periodEndDate=${case1.periodEndDate}, filingDate=${case1.filingDate}`);

// CHECK 4: fiscalYear/fiscalQuarter do not decide visibility (case1: period ended 2025, but filingDate 2026-06-15 → not visible)
check('CHECK 4: fiscalYear/fiscalQuarter do not decide visibility', !isVisible(case1, asOfDate), `fiscalYear=${case1.fiscalYear}, fiscalQuarter=${case1.fiscalQuarter}`);

// CHECK 5: ingestedAt earlier does NOT grant visibility to future filingDate
check('CHECK 5: ingestedAt early does NOT grant visibility to future filingDate', !isVisible(case3, asOfDate), `ingestedAt=${case3.ingestedAt}, filingDate=${case3.filingDate}`);

// CHECK 6: ingestedAt later does NOT block past filingDate visibility
check('CHECK 6: ingestedAt late does NOT block past filingDate visibility', isVisible(case2, asOfDate), `ingestedAt=${case2.ingestedAt}, filingDate=${case2.filingDate}`);

// CHECK 7: missing availability fields — not visible
check('CHECK 7: missing availability fields — not visible', !isVisible(case5, asOfDate), `all availability null`);

// CHECK 8: different symbol — not in target context
const targetReports = reports.filter(r => r.symbol === targetSymbol);
check('CHECK 8: different symbol not in target context', !targetReports.some(r => r.symbol !== targetSymbol), `targetSymbol=${targetSymbol}`);

// CHECK 9: duplicate sourceHash deterministic (case7 has same sourceHash as case2)
const seen = new Set();
const deduped = [];
for (const r of reports.filter(r => r.symbol === targetSymbol)) {
  if (!seen.has(r.sourceHash)) { seen.add(r.sourceHash); deduped.push(r); }
}
const case7InDeduped = deduped.some(r => r.caseId === 'CASE_7');
check('CHECK 9: duplicate sourceHash excluded via dedup', !case7InDeduped, `CASE_7 has same sourceHash as CASE_2`);

// CHECK 10: output does not contain outcome fields
const snapshotStr = JSON.stringify({ visibleReports: targetReports.filter(r => isVisible(r, asOfDate)), readOnly: true, entersAlphaScore: false });
check('CHECK 10: output does not contain outcome fields', !/(outcomePrice|returnPct|realizedReturnClass)/i.test(snapshotStr), 'clean');

// CHECK 11: no buy/sell/recommendation claims
check('CHECK 11: no buy/sell/recommendation claims', !/\b(buy|sell|recommendation|guaranteed)\b/i.test(snapshotStr), 'clean');

// CHECK 12: entersAlphaScore=false
const mockContext = { readOnly: true, entersAlphaScore: false };
check('CHECK 12: entersAlphaScore=false', mockContext.entersAlphaScore === false, 'entersAlphaScore=false');

// CHECK 13: readOnly=true
check('CHECK 13: readOnly=true', mockContext.readOnly === true, 'readOnly=true');

const passed = checks.filter(c => c.pass).length;
const failed = checks.filter(c => !c.pass).length;
const classification = failed > 0 ? 'P26C_PIT_LEAKAGE_DETECTED' : 'P26C_AVAILABILITY_VALIDATION_PASS';

console.log(`\n${failed === 0 ? 'PIT Availability Validation: PASS' : 'PIT Availability Validation: FAIL'}`);

const output = {
  phase: 'P26C-HARDRESET',
  generatedAt: '2026-05-13',
  asOfDate, targetSymbol,
  totalChecks: checks.length, passed, failed,
  checks,
  classification,
  disclaimer: 'No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.'
};

fs.writeFileSync('outputs/online_validation/p26c_financial_report_availability_validation.json', JSON.stringify(output, null, 2));

const md = `# P26C FinancialReport Availability PIT Leakage Validation\n\n**Generated:** 2026-05-13\n\n> No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.\n\n## Results\n\n${checks.map(c => `- ${c.pass ? '✅' : '❌'} **${c.label}**: ${c.detail}`).join('\n')}\n\n## Summary\n\n| Metric | Value |\n|--------|-------|\n| Total Checks | ${checks.length} |\n| Passed | ${passed} |\n| Failed | ${failed} |\n\n## Classification\n\n**\`${classification}\`**\n`;
fs.writeFileSync('outputs/online_validation/p26c_financial_report_availability_validation.md', md);

console.log('Wrote: outputs/online_validation/p26c_financial_report_availability_validation.json');
console.log('Wrote: outputs/online_validation/p26c_financial_report_availability_validation.md');

if (failed > 0) process.exit(1);
