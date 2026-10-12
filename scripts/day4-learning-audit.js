/**
 * Day 4 Phase 0b — Learning Quality Audit
 * Reads last 4 StrategyLearningInsights in full and assesses contamination.
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });

async function main() {
  console.log('\n=== PHASE 0b: LEARNING QUALITY AUDIT ===\n');

  const insights = await p.strategyLearningInsight.findMany({
    orderBy: { id: 'desc' },
    take: 4,
    select: {
      id: true, createdAt: true, updatedAt: true, generatedAt: true,
      summary: true,
      successPatterns: true,
      failurePatterns: true,
      adjustmentSuggestions: true,
      limitations: true,
      sourceCount: true,
    },
  });

  const CONTAMINATION_KEYWORDS = ['成功', 'success', '有效', 'effective', '正向', 'positive', '獲利', 'profit', '優秀', 'excellent', 'trend.*success', 'rebound.*success'];

  for (const insight of insights) {
    const genDate = insight.generatedAt ? new Date(insight.generatedAt).toISOString().slice(0,10) : 'n/a';
    console.log(`\n── Insight #${insight.id} (date=${genDate}, sourceTrades=${insight.sourceCount}) ──`);

    // Parse JSON fields
    const fields = {
      summary: insight.summary,
      successPatterns: insight.successPatterns,
      failurePatterns: insight.failurePatterns,
      adjustmentSuggestions: insight.adjustmentSuggestions,
      limitations: insight.limitations,
    };

    for (const [key, val] of Object.entries(fields)) {
      if (val == null) continue;
      let parsed = val;
      if (typeof val === 'string') {
        try { parsed = JSON.parse(val); } catch { parsed = val; }
      }
      const str = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
      // Truncate very long fields
      const truncated = str.length > 800 ? str.slice(0, 800) + '...[truncated]' : str;
      console.log(`\n  [${key}]:\n${truncated.split('\n').map(l => '    ' + l).join('\n')}`);
    }

    // Contamination check
    const fullText = JSON.stringify(fields);
    const hasTrendSuccess = /trend.*(\+\d{2}|success|成功|優秀|有效)/i.test(fullText);
    const hasHighPnl = /4[0-9]\.|47\.|26\.|24\./.test(fullText);
    const hasOutlierRef = /95.*day|2026-01-15|historical.sim|context.*historical/i.test(fullText);
    const isConservative = /insufficient|limited|small.*sample|few.*trade|不足|謹慎|有限/i.test(fullText);

    let verdict = 'VALID';
    const reasons = [];
    if (hasTrendSuccess && insight.sourceTradeCount <= 5) { verdict = 'CONTAMINATED'; reasons.push('trend success claim with ≤5 trades'); }
    if (hasHighPnl) { verdict = 'CONTAMINATED'; reasons.push('references outlier pnl (47/26/24%)'); }
    if (hasOutlierRef) { verdict = 'CONTAMINATED'; reasons.push('references historical-sim context'); }
    if (isConservative && verdict !== 'CONTAMINATED') { verdict = 'CONSERVATIVE'; reasons.push('hedged language despite small sample'); }

    console.log(`\n  >>> VERDICT: ${verdict}${reasons.length ? ' — ' + reasons.join('; ') : ''}`);
  }

  console.log('\n\n=== OVERALL LEARNING QUALITY VERDICT ===');
  // Aggregate: if any CONTAMINATED, overall = CONTAMINATED
  const insightDetails = await p.strategyLearningInsight.findMany({ orderBy: { id: 'desc' }, take: 4, select: { id: true, sourceCount: true, successPatterns: true, summary: true } });
  const overallTexts = insightDetails.map(i => JSON.stringify({ summary: i.summary, successPatterns: i.successPatterns }));
  const anyContam = overallTexts.some(t => /4[0-9]\.|47\.|26\.|24\.|historical.sim/i.test(t));
  console.log(`Learning quality: ${anyContam ? 'CONTAMINATED' : 'CONSERVATIVE'}`);
  if (anyContam) console.log('Reason: Insights sourced from Day3 batch outlier trades (pnl 47%/26%/24%, historical-sim context)');
  // Aggregate: if any CONTAMINATED, overall = CONTAMINATED
  const insightDetails = await p.strategyLearningInsight.findMany({ orderBy: { id: 'desc' }, take: 4, select: { id: true, sourceCount: true, successPatterns: true, summary: true } });
  const overallTexts = insightDetails.map(i => JSON.stringify({ summary: i.summary, successPatterns: i.successPatterns }));
  const anyContam = overallTexts.some(t => /4[0-9]\.|47\.|26\.|24\.|historical.sim/i.test(t));
  console.log(`Learning quality: ${anyContam ? 'CONTAMINATED' : 'CONSERVATIVE'}`);
  if (anyContam) console.log('Reason: Insights sourced from Day3 batch outlier trades (pnl 47%/26%/24%, historical-sim context)');

  await p.$disconnect();
}

main().catch(console.error);
