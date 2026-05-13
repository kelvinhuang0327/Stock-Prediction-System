import { prisma } from '../src/lib/prisma';

async function main() {
  const POST_INGEST = new Date('2026-05-01T13:50:00Z');

  // ── Proposals ───────────────────────────────────────────────────────────
  const proposals = await prisma.strategyProposal.findMany({
    where: { createdAt: { gte: POST_INGEST } },
    select: {
      id: true, snapshotId: true, setupType: true,
      positionSizing: true, state: true,
      decisionMeta: true, ctoDecision: true, ctoDecisionReason: true,
      createdAt: true, symbol: true,
    },
    orderBy: { id: 'desc' },
  });

  const summary = proposals.map((p) => {
    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(p.decisionMeta ?? '{}'); } catch { /**/ }
    return {
      id: p.id,
      symbol: p.symbol,
      setupType: p.setupType,
      state: p.state,
      dataCoverage: meta['dataCoverage'],
      adjustedPositionSizing: meta['adjustedPositionSizing'],
      triggerScore: meta['triggerScore'],
      rejectionReason: meta['rejectionReason'] ?? null,
      ctoDecision: p.ctoDecision,
    };
  });

  const stateCount: Record<string, number> = {};
  const coverageCount: Record<string, number> = {};
  for (const s of summary) {
    stateCount[String(s.state)] = (stateCount[String(s.state)] ?? 0) + 1;
    coverageCount[String(s.dataCoverage)] = (coverageCount[String(s.dataCoverage)] ?? 0) + 1;
  }

  console.log(JSON.stringify({
    section: '1_PROPOSALS',
    total: proposals.length,
    byState: stateCount,
    byCoverage: coverageCount,
    rows: summary,
  }, null, 2));

  // ── Trades ───────────────────────────────────────────────────────────────
  const allTrades = await prisma.simulatedTrade.findMany({
    select: { id: true, symbol: true, tradeMode: true, status: true, pnlPct: true, mfePct: true, maePct: true, exitReason: true, createdAt: true },
    orderBy: { id: 'desc' },
    take: 20,
  });
  const tradeStatusCount: Record<string, number> = {};
  const tradeModeCount: Record<string, number> = {};
  for (const t of allTrades) {
    tradeStatusCount[String(t.status)] = (tradeStatusCount[String(t.status)] ?? 0) + 1;
    tradeModeCount[String(t.tradeMode ?? 'null')] = (tradeModeCount[String(t.tradeMode ?? 'null')] ?? 0) + 1;
  }
  const openTrades = allTrades.filter(t => t.status === 'open' || t.status === 'shadow-open');
  console.log(JSON.stringify({ section: '3_TRADES', totalRecent: allTrades.length, byStatus: tradeStatusCount, byTradeMode: tradeModeCount, openTrades }, null, 2));

  // ── TradeReviewReports ────────────────────────────────────────────────────
  const totalReviews = await prisma.tradeReviewReport.count();
  const latestReviews = await prisma.tradeReviewReport.findMany({
    orderBy: { id: 'desc' }, take: 5,
    select: { id: true, triggerType: true, createdAt: true, tradeId: true },
  });
  const reviewTriggerDist = latestReviews.reduce((acc: Record<string, number>, r) => {
    acc[r.triggerType] = (acc[r.triggerType] ?? 0) + 1; return acc;
  }, {});
  console.log(JSON.stringify({ section: '5_TRADE_REVIEW_REPORTS', totalEver: totalReviews, triggerDist: reviewTriggerDist, latest: latestReviews }, null, 2));

  // ── Learning insights (active + StrategyLearningInsight) ────────────────
  const activeInsights = await prisma.optimizationInsightRecord.findMany({
    where: { expiresAt: { gt: new Date() } },
    select: { id: true, insightType: true, confidence: true, severity: true, createdAt: true },
    orderBy: { id: 'desc' }, take: 10,
  });
  const latestLearning = await prisma.strategyLearningInsight.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true, generatedAt: true, sourceCount: true, summary: true, limitations: true },
  });
  console.log(JSON.stringify({ section: '5_LEARNING', activeInsights: { count: activeInsights.length, rows: activeInsights }, latestStrategyLearning: latestLearning }, null, 2));

  // ── Q1 FinancialReport safety check ──────────────────────────────────────
  const q1Count = await prisma.financialReport.count({ where: { year: 2026, quarter: 1 } });
  const q4Count = await prisma.financialReport.count({ where: { year: 2025, quarter: 4 } });
  const llmJobRunCount = await prisma.jobRunLog.count({ where: { jobName: { contains: 'llm' } } });
  // Confirm no duplicate Q1 rows per stock
  const q1PerStock = await prisma.financialReport.groupBy({ by: ['stockId'], where: { year: 2026, quarter: 1 }, _count: { id: true }, having: { id: { _count: { gt: 1 } } } });
  console.log(JSON.stringify({ section: '6_SAFETY', q1FinancialReport2026Q1: q1Count, q4FinancialReport2025Q4: q4Count, duplicateQ1PerStock: q1PerStock.length, llmJobRunCount }, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
