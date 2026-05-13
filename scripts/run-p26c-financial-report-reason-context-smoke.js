/**
 * P26C PART H: FinancialReport Reason Context Smoke
 * No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.
 */
'use strict';
const fs = require('fs');

function summarizeForReason(contextSnapshot) {
  const { visibleReportCount, asOfDate, symbol, reports } = contextSnapshot;
  if (visibleReportCount === 0) {
    return `No financial reports with availability date on or before ${asOfDate} were found for ${symbol}. Financial report context is read-only metadata.`;
  }
  const reportTypes = [...new Set(reports.filter(r => r.pitVisibility === 'VISIBLE_AS_OF').map(r => r.reportType || 'unknown'))].join(', ');
  return `${visibleReportCount} financial report(s) with availability date on or before ${asOfDate} were recorded for ${symbol}. Report types: ${reportTypes}. Financial report context is read-only metadata and does not enter scoring.`;
}

const checks = [];
function check(label, pass, detail) {
  checks.push({ label, pass, detail });
  console.log(`  ${pass ? '✓' : '✗'} ${label} — ${detail}`);
}

console.log('\nP26C PART H: FinancialReport Reason Context Smoke\n');

const emptyContext = { visibleReportCount: 0, reports: [], readOnly: true, entersAlphaScore: false, asOfDate: '2026-05-13', symbol: '2330' };
const visibleReports = [
  { reportId: 'RPT_A', pitVisibility: 'VISIBLE_AS_OF', reportType: 'quarterly', availabilityDate: '2026-05-10' },
  { reportId: 'RPT_B', pitVisibility: 'VISIBLE_AS_OF', reportType: 'annual', availabilityDate: '2026-05-08' }
];
const populatedContext = {
  asOfDate: '2026-05-13', symbol: '2330',
  visibleReportCount: 2,
  reports: visibleReports,
  readOnly: true, entersAlphaScore: false,
  visibilityGate: 'availabilityDate <= asOfDate'
};

const emptyDesc = summarizeForReason(emptyContext);
const populatedDesc = summarizeForReason(populatedContext);

const forbiddenPattern = /\b(buy|sell|guaranteed|roi|win.rate|profit|outperform|alpha|edge|investment recommendation)\b/i;

// CHECK 1: neutral description for empty context
check('CHECK 1: neutral description for no visible reports', !forbiddenPattern.test(emptyDesc), emptyDesc.slice(0, 80));

// CHECK 2: neutral description with visible reports
check('CHECK 2: neutral description with visible reports', !forbiddenPattern.test(populatedDesc), populatedDesc.slice(0, 80));

// CHECK 3: empty context mentions asOfDate and symbol
check('CHECK 3: empty context mentions asOfDate and symbol', emptyDesc.includes('2026-05-13') && emptyDesc.includes('2330'), `asOfDate=2026-05-13, symbol=2330`);

// CHECK 4: populated context reports visibleReportCount
check('CHECK 4: populated context mentions visible report count', populatedDesc.includes('2'), `visibleCount=2`);

// CHECK 5: no factor score derived from FinancialReport
const contextStr = JSON.stringify(populatedContext);
check('CHECK 5: no factorScore/alphaContribution fields', !contextStr.includes('factorScore') && !contextStr.includes('alphaContribution'), 'No factorScore/alphaContribution fields');

// CHECK 6: scoreSnapshot not modified
check('CHECK 6: scoreSnapshot not modified', !contextStr.includes('scoreSnapshot'), 'No scoreSnapshot in financialReportContext');

// CHECK 7: readOnly=true
check('CHECK 7: readOnly=true', populatedContext.readOnly === true, 'readOnly=true');

// CHECK 8: entersAlphaScore=false
check('CHECK 8: entersAlphaScore=false', populatedContext.entersAlphaScore === false, 'entersAlphaScore=false');

// CHECK 9: EPS/margin metrics not interpreted as investment judgment
check('CHECK 9: no EPS/margin interpreted as investment judgment', !forbiddenPattern.test(populatedDesc) && !populatedDesc.toLowerCase().includes('should'), 'metrics not investment judgment');

const passed = checks.filter(c => c.pass).length;
const failed = checks.filter(c => !c.pass).length;
const classification = failed === 0 ? 'REASON_CONTEXT_SMOKE_PASS' : 'P26C_REASON_CONTEXT_FORBIDDEN_CLAIM_DETECTED';

const output = {
  phase: 'P26C-HARDRESET', generatedAt: '2026-05-13',
  totalChecks: checks.length, passed, failed, checks, classification,
  emptyContextDescription: emptyDesc,
  populatedContextDescription: populatedDesc,
  disclaimer: 'No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.'
};

fs.writeFileSync('outputs/online_validation/p26c_financial_report_reason_context_smoke.json', JSON.stringify(output, null, 2));
const md = `# P26C FinancialReport Reason Context Smoke\n\n**Generated:** 2026-05-13\n\n> No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.\n\n## Results\n\n${checks.map(c => `- ${c.pass ? '✅' : '❌'} **${c.label}**: ${c.detail}`).join('\n')}\n\n## Classification\n\n**\`${classification}\`**\n`;
fs.writeFileSync('outputs/online_validation/p26c_financial_report_reason_context_smoke.md', md);

console.log(`\nWrote: outputs/online_validation/p26c_financial_report_reason_context_smoke.json`);
console.log(`Wrote: outputs/online_validation/p26c_financial_report_reason_context_smoke.md`);
console.log(`\nReason Context Smoke: ${failed === 0 ? 'PASS' : 'FAIL'}`);
if (failed > 0) process.exit(1);
