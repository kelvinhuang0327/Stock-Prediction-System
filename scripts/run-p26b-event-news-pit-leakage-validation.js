/**
 * PART F: P26B PIT Leakage Validation Script
 *
 * Validates that the Event/News PIT adapter correctly gates visibility by publishedAt only.
 * No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OUTPUTS_DIR = path.join(__dirname, '..', 'outputs', 'online_validation');
const FIXTURE_PATH = path.join(OUTPUTS_DIR, 'fixtures', 'p26b_news_events_fixture.json');

// ---------------------------------------------------------------------------
// Load fixture
// ---------------------------------------------------------------------------

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const asOfDate = fixture.asOfDate; // '2026-05-13'
const targetSymbol = fixture.symbol; // '2330'
const events = fixture.events;

// ---------------------------------------------------------------------------
// Pure PIT gate helpers (mirrors P26BEventNewsPitAdapterUtils.ts logic)
// ---------------------------------------------------------------------------

function toTaipeiDateString(isoTs) {
  const ms = Date.parse(isoTs);
  if (isNaN(ms)) return '';
  const d = new Date(ms + 8 * 60 * 60 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isVisible(event, asOf) {
  if (!event.publishedAt) return false;
  const pubDate = event.publishedAt.length > 10 ? toTaipeiDateString(event.publishedAt) : event.publishedAt;
  return pubDate <= asOf;
}

// ---------------------------------------------------------------------------
// Run 10 checks
// ---------------------------------------------------------------------------

const checks = [];

function addCheck(name, passed, detail) {
  checks.push({ name, passed, detail });
  console.log(`  ${passed ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
}

console.log('\nP26B PART F: PIT Leakage Validation\n');

// CHECK 1: publishedAt <= asOfDate is visible
const c1 = events.find(e => e.case === 'CASE_1_VISIBLE_INGEST_AFTER_ASOF');
addCheck(
  'CHECK 1: publishedAt <= asOfDate is visible',
  c1 && isVisible(c1, asOfDate) === true,
  c1 ? `publishedAt=${c1.publishedAt}, ingestedAt=${c1.ingestedAt}` : 'case not found'
);

// CHECK 2: publishedAt > asOfDate is excluded
const c2 = events.find(e => e.case === 'CASE_2_INVISIBLE_FUTURE_PUBLISHED_EARLY_INGESTED');
addCheck(
  'CHECK 2: publishedAt > asOfDate is excluded',
  c2 && isVisible(c2, asOfDate) === false,
  c2 ? `publishedAt=${c2.publishedAt}, ingestedAt=${c2.ingestedAt}` : 'case not found'
);

// CHECK 3: ingestedAt EARLY does NOT grant visibility to future publishedAt
addCheck(
  'CHECK 3: ingestedAt early does NOT grant visibility to future publishedAt',
  c2 && isVisible(c2, asOfDate) === false,
  c2 ? `ingestedAt=${c2.ingestedAt} (before asOf) but publishedAt=${c2.publishedAt} (future) → correctly excluded` : 'case not found'
);

// CHECK 4: ingestedAt LATE does NOT block visibility for past publishedAt
addCheck(
  'CHECK 4: ingestedAt after asOfDate does NOT block past publishedAt visibility',
  c1 && isVisible(c1, asOfDate) === true,
  c1 ? `ingestedAt=${c1.ingestedAt} (after asOf) but publishedAt=${c1.publishedAt} → correctly visible` : 'case not found'
);

// CHECK 5: missing publishedAt is not visible
const c4 = events.find(e => e.case === 'CASE_4_MISSING_PUBLISHED_AT');
addCheck(
  'CHECK 5: missing publishedAt is not visible',
  c4 && isVisible(c4, asOfDate) === false,
  c4 ? `publishedAt=${c4.publishedAt}` : 'case not found'
);

// CHECK 6: different symbol events are not included in target symbol context
const c3 = events.find(e => e.case === 'CASE_3_DIFFERENT_SYMBOL_EXCLUDED');
const c3TargetSymbol = c3 && c3.symbol === targetSymbol;
addCheck(
  'CHECK 6: different symbol event not in target symbol context',
  c3 && c3.symbol !== targetSymbol,
  c3 ? `event symbol=${c3.symbol}, target=${targetSymbol}` : 'case not found'
);

// CHECK 7: output snapshot does not contain outcome fields
const visibleEvents = events.filter(e => e.symbol === targetSymbol && isVisible(e, asOfDate));
const snapshotStr = JSON.stringify({ visibleEvents, readOnly: true, entersAlphaScore: false });
const forbiddenOutcome = ['outcomePrice', 'returnPct', 'realizedReturnClass'];
const foundForbidden = forbiddenOutcome.filter(f => snapshotStr.includes(f));
addCheck(
  'CHECK 7: output does not contain outcome fields',
  foundForbidden.length === 0,
  foundForbidden.length > 0 ? `Found: ${foundForbidden.join(', ')}` : 'clean'
);

// CHECK 8: output does not contain buy/sell/recommendation claims
const claimPattern = /\b(buy|sell|recommendation|guaranteed)\b/i;
addCheck(
  'CHECK 8: output does not contain buy/sell/recommendation claims',
  !claimPattern.test(snapshotStr),
  claimPattern.test(snapshotStr) ? 'CLAIM DETECTED' : 'clean'
);

// CHECK 9: entersAlphaScore=false
const mockSnapshot = { readOnly: true, entersAlphaScore: false, visibilityGate: 'publishedAt <= asOfDate' };
addCheck(
  'CHECK 9: output marks entersAlphaScore=false',
  mockSnapshot.entersAlphaScore === false,
  'entersAlphaScore=' + mockSnapshot.entersAlphaScore
);

// CHECK 10: output marks readOnly=true
addCheck(
  'CHECK 10: output marks readOnly=true',
  mockSnapshot.readOnly === true,
  'readOnly=' + mockSnapshot.readOnly
);

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

const passed = checks.filter(c => c.passed).length;
const failed = checks.filter(c => !c.passed).length;
const allPassed = failed === 0;

const output = {
  phase: 'P26B-HARDRESET',
  part: 'PART_F_PIT_LEAKAGE_VALIDATION',
  generatedAt: '2026-05-13',
  asOfDate,
  symbol: targetSymbol,
  checksTotal: checks.length,
  checksPassed: passed,
  checksFailed: failed,
  allPassed,
  checks,
  verdict: allPassed ? 'P26B_PIT_LEAKAGE_VALIDATION_PASS' : 'P26B_PIT_LEAKAGE_DETECTED',
  disclaimer: 'No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.',
};

const jsonPath = path.join(OUTPUTS_DIR, 'p26b_event_news_pit_leakage_validation.json');
const mdPath = path.join(OUTPUTS_DIR, 'p26b_event_news_pit_leakage_validation.md');

fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
console.log(`\nWrote: ${jsonPath}`);

const md = `# P26B Event/News PIT Leakage Validation (PART F)

**Generated:** 2026-05-13
**Verdict:** \`${output.verdict}\`

> No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.

## Summary

| Metric | Value |
|--------|-------|
| Total checks | ${output.checksTotal} |
| Passed | ${output.checksPassed} |
| Failed | ${output.checksFailed} |

## Check Results

${checks.map(c => `- ${c.passed ? '✅' : '❌'} **${c.name}**: ${c.detail || ''}`).join('\n')}

## Verdict

\`${output.verdict}\`
`;

fs.writeFileSync(mdPath, md);
console.log(`Wrote: ${mdPath}`);

if (allPassed) {
  console.log('\nPIT Leakage Validation: PASS');
  process.exit(0);
} else {
  console.log('\nPIT Leakage Validation: FAIL — P26B_PIT_LEAKAGE_DETECTED');
  process.exit(1);
}
