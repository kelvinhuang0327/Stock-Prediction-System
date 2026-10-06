/**
 * Phase 1: Contamination cleanup
 *
 * 1a. Flag trades 40/41/42 in marketContext as contaminated
 * 1b. Flag their TradeReviewReport.preTrade JSON as contaminated
 * 1c. Mark Insight #19 limitations as contaminated
 *
 * Does NOT delete any records.
 */
'use strict';

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });

async function main() {
  console.log('=== Phase 1: Contamination Cleanup ===\n');

  // ── 1a. Flag trades 40, 41, 42 in marketContext ──────────────────────────
  console.log('Step 1a: Flagging contaminated trades (IDs: 40, 41, 42)...');
  const CONTAMINATED_IDS = [40, 41, 42];

  for (const id of CONTAMINATED_IDS) {
    const trade = await p.simulatedTrade.findUnique({
      where: { id },
      select: { id: true, symbol: true, pnlPct: true, marketContext: true },
    });

    if (!trade) {
      console.log(`  SKIP: Trade ${id} not found`);
      continue;
    }

    let ctx;
    try {
      ctx = JSON.parse(trade.marketContext ?? '{}');
    } catch {
      // marketContext was a plain string (e.g. "historical-sim"), wrap it
      ctx = { context: trade.marketContext ?? '' };
    }

    if (ctx.dataQuality === 'contaminated') {
      console.log(`  SKIP: Trade ${id} (${trade.symbol}) already flagged`);
      continue;
    }

    ctx.dataQuality = 'contaminated';
    ctx.contamReason = 'day3-synthetic-batch';

    await p.simulatedTrade.update({
      where: { id },
      data: { marketContext: JSON.stringify(ctx) },
    });

    console.log(`  ✓ Trade ${id} (${trade.symbol}, pnl=${trade.pnlPct?.toFixed(2)}%) → marketContext updated`);
  }

  // ── 1b. Flag their TradeReviewReport.preTrade JSON ───────────────────────
  console.log('\nStep 1b: Flagging review reports for contaminated trades...');
  const reviews = await p.tradeReviewReport.findMany({
    where: { tradeId: { in: CONTAMINATED_IDS } },
    select: { id: true, tradeId: true, preTrade: true },
  });

  if (reviews.length === 0) {
    console.log('  NOTE: No review reports found for trades 40/41/42');
  } else {
    for (const review of reviews) {
      let preTrade;
      try {
        preTrade = JSON.parse(review.preTrade ?? '{}');
      } catch {
        preTrade = {};
      }

      if (preTrade.dataQuality === 'contaminated') {
        console.log(`  SKIP: Review ${review.id} (trade ${review.tradeId}) already flagged`);
        continue;
      }

      preTrade.dataQuality = 'contaminated';
      preTrade.contamReason = 'day3-synthetic-batch';

      await p.tradeReviewReport.update({
        where: { id: review.id },
        data: { preTrade: JSON.stringify(preTrade) },
      });
      console.log(`  ✓ Review ${review.id} (trade ${review.tradeId}) → preTrade updated`);
    }
  }

  // ── 1c. Mark Insight #19 limitations ─────────────────────────────────────
  console.log('\nStep 1c: Flagging Insight #19 as contaminated in limitations...');
  const insight19 = await p.strategyLearningInsight.findFirst({
    where: { id: 19 },
    select: { id: true, limitations: true, summary: true },
  });

  if (!insight19) {
    console.log('  NOTE: Insight #19 not found — skipping');
  } else {
    let lims;
    try {
      lims = JSON.parse(insight19.limitations ?? '[]');
    } catch {
      lims = [];
    }

    const contaminationWarning =
      'WARNING: 此 insight 的 trend 正報酬信號（3筆）全數來自 Day 3 合成批次（trades 40/41/42），資料已污染。應以後續 clean insight 取代。';

    if (!lims.includes(contaminationWarning)) {
      lims.push(contaminationWarning);
      await p.strategyLearningInsight.update({
        where: { id: 19 },
        data: { limitations: JSON.stringify(lims) },
      });
      console.log('  ✓ Insight #19 limitations updated with contamination warning');
    } else {
      console.log('  SKIP: Insight #19 already flagged');
    }
  }

  // ── Verify ────────────────────────────────────────────────────────────────
  console.log('\n=== Verification ===');
  const flaggedTrades = await p.simulatedTrade.findMany({
    where: { marketContext: { contains: '"dataQuality":"contaminated"' } },
    select: { id: true, symbol: true, pnlPct: true, marketContext: true },
  });
  console.log(`Contaminated trades in DB: ${flaggedTrades.length}`);
  flaggedTrades.forEach((t) => {
    const ctx = JSON.parse(t.marketContext ?? '{}');
    console.log(`  id=${t.id} symbol=${t.symbol} pnl=${t.pnlPct?.toFixed(2)}% reason=${ctx.contamReason}`);
  });

  const flaggedReviews = await p.tradeReviewReport.findMany({
    where: { tradeId: { in: CONTAMINATED_IDS } },
    select: { id: true, tradeId: true, preTrade: true },
  });
  console.log(`Review reports flagged: ${flaggedReviews.length}`);
  flaggedReviews.forEach((r) => {
    const pt = JSON.parse(r.preTrade ?? '{}');
    console.log(`  reviewId=${r.id} tradeId=${r.tradeId} dataQuality=${pt.dataQuality}`);
  });

  console.log('\n✓ Phase 1a/1b/1c complete — contamination flags applied');
  console.log('  Next: run day5-generate-clean-insight.js to produce Insight #20');
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1); })
  .finally(() => p.$disconnect());
