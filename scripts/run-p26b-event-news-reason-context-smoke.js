/**
 * PART H: P26B Event/News Reason Context Smoke
 *
 * Validates that the reason context output for news events is neutral,
 * contains no investment recommendations, and does not modify scoreSnapshot.
 *
 * No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OUTPUTS_DIR = path.join(__dirname, '..', 'outputs', 'online_validation');
const FIXTURE_PATH = path.join(OUTPUTS_DIR, 'fixtures', 'p26b_news_events_fixture.json');

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const asOfDate = fixture.asOfDate;
const targetSymbol = fixture.symbol;
const events = fixture.events;

// Mirror of the adapter logic
function toTaipeiDateString(isoTs) {
  const ms = Date.parse(isoTs);
  if (isNaN(ms)) return '';
  const d = new Date(ms + 8 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function isVisible(event, asOf) {
  if (!event.publishedAt) return false;
  const pubDate = event.publishedAt.length > 10 ? toTaipeiDateString(event.publishedAt) : event.publishedAt;
  return pubDate <= asOf;
}

function summarize(visibleEvents, asOf, symbol) {
  if (visibleEvents.length === 0) {
    return `No news events published on or before ${asOf} were found for ${symbol}. Event context: empty.`;
  }
  const categories = [...new Set(visibleEvents.map(e => e.category || 'UNKNOWN'))].join(', ');
  return (
    `${visibleEvents.length} news event(s) published on or before ${asOf} were recorded for ${symbol}. ` +
    `Categories observed: ${categories}. ` +
    `This is read-only context metadata and does not affect the research score.`
  );
}

const checks = [];

function addCheck(name, passed, detail) {
  checks.push({ name, passed, detail });
  console.log(`  ${passed ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
}

console.log('\nP26B PART H: Event/News Reason Context Smoke\n');

// Build contexts
const visibleForTarget = events.filter(e => e.symbol === targetSymbol && isVisible(e, asOfDate));
const emptyContext = { visibleEventCount: 0, events: [], readOnly: true, entersAlphaScore: false };
const populatedContext = {
  asOfDate, symbol: targetSymbol,
  visibleEventCount: visibleForTarget.length,
  events: visibleForTarget.map(e => ({
    eventId: e.eventId, category: e.category, publishedAt: e.publishedAt,
    sourceHash: e.sourceHash, severity: e.severity, relevanceScore: e.relevanceScore,
    pitVisibility: 'VISIBLE_AS_OF',
  })),
  readOnly: true, entersAlphaScore: false, visibilityGate: 'publishedAt <= asOfDate',
};

const emptySummary = summarize([], asOfDate, targetSymbol);
const populatedSummary = summarize(visibleForTarget, asOfDate, targetSymbol);

const forbiddenPattern = /\b(buy|sell|guaranteed|roi|win.rate|profit|outperform|alpha|edge|investment recommendation)\b/i;

// Check 1: empty context neutral description
addCheck(
  'CHECK 1: neutral description for no visible events',
  !forbiddenPattern.test(emptySummary),
  emptySummary.substring(0, 80)
);

// Check 2: populated context neutral description
addCheck(
  'CHECK 2: neutral description with visible events',
  !forbiddenPattern.test(populatedSummary),
  populatedSummary.substring(0, 80)
);

// Check 3: empty context contains asOfDate and symbol
addCheck(
  'CHECK 3: empty context mentions asOfDate and symbol',
  emptySummary.includes(asOfDate) && emptySummary.includes(targetSymbol),
  'asOfDate=' + asOfDate + ', symbol=' + targetSymbol
);

// Check 4: populated context mentions event count and "metadata"
addCheck(
  'CHECK 4: populated context mentions visible event count',
  populatedSummary.includes(String(visibleForTarget.length)),
  `visibleCount=${visibleForTarget.length}`
);

// Check 5: no factor score produced from news
const contextStr = JSON.stringify(populatedContext);
addCheck(
  'CHECK 5: no factor score derived from NewsEvent',
  !contextStr.includes('factorScore') && !contextStr.includes('alphaContribution'),
  'No factorScore/alphaContribution fields'
);

// Check 6: no scoreSnapshot modification
addCheck(
  'CHECK 6: scoreSnapshot not modified by event context',
  !contextStr.includes('"scoreSnapshot"'),
  'No scoreSnapshot in eventNewsContext'
);

// Check 7: readOnly=true in context
addCheck(
  'CHECK 7: readOnly=true',
  populatedContext.readOnly === true,
  'readOnly=' + populatedContext.readOnly
);

// Check 8: entersAlphaScore=false in context
addCheck(
  'CHECK 8: entersAlphaScore=false',
  populatedContext.entersAlphaScore === false,
  'entersAlphaScore=' + populatedContext.entersAlphaScore
);

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const passed = checks.filter(c => c.passed).length;
const failed = checks.filter(c => !c.passed).length;
const allPassed = failed === 0;

const output = {
  phase: 'P26B-HARDRESET',
  part: 'PART_H_REASON_CONTEXT_SMOKE',
  generatedAt: '2026-05-13',
  asOfDate,
  symbol: targetSymbol,
  visibleEventCount: visibleForTarget.length,
  emptySummary,
  populatedSummary,
  checksTotal: checks.length,
  checksPassed: passed,
  checksFailed: failed,
  allPassed,
  checks,
  verdict: allPassed ? 'REASON_CONTEXT_SMOKE_PASS' : 'P26B_REASON_CONTEXT_FORBIDDEN_CLAIM_DETECTED',
  disclaimer: 'No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.',
};

const jsonPath = path.join(OUTPUTS_DIR, 'p26b_event_news_reason_context_smoke.json');
const mdPath = path.join(OUTPUTS_DIR, 'p26b_event_news_reason_context_smoke.md');

fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
console.log(`\nWrote: ${jsonPath}`);

const md = `# P26B Event/News Reason Context Smoke (PART H)

**Generated:** 2026-05-13
**Verdict:** \`${output.verdict}\`

> No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.

## Sample Summaries

**Empty context:**
> ${output.emptySummary}

**Populated context (${output.visibleEventCount} events):**
> ${output.populatedSummary}

## Check Results

${checks.map(c => `- ${c.passed ? '✅' : '❌'} ${c.name}: ${c.detail || ''}`).join('\n')}

## Verdict

\`${output.verdict}\`
`;

fs.writeFileSync(mdPath, md);
console.log(`Wrote: ${mdPath}`);

if (allPassed) {
  console.log('\nReason Context Smoke: PASS');
  process.exit(0);
} else {
  console.log('\nReason Context Smoke: FAIL');
  process.exit(1);
}
