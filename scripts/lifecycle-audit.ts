import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'node:fs';
import nodePath from 'node:path';
import { classifyQuoteFreshness } from '../src/lib/market/twTradingCalendar';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  // 1. Latest quotes for the 3 symbols
  const quotes = await Promise.all(['2027', '1301', '1303'].map(sym =>
    prisma.stockQuote.findFirst({
      where: { stockId: sym },
      orderBy: { date: 'desc' },
      select: { stockId: true, date: true, close: true, high: true, low: true, volume: true, createdAt: true },
    })
  ));

  // 1b. Recent 3 dates for 2027 (to confirm whether 2026-05-01 landed)
  const recent2027 = await prisma.stockQuote.findMany({
    where: { stockId: '2027' },
    orderBy: { date: 'desc' },
    take: 3,
    select: { date: true, close: true, high: true, low: true },
  });

  // 1c. Recent SyncLog entries
  const syncLogs = await prisma.syncLog.findMany({
    orderBy: { id: 'desc' },
    take: 5,
    select: { id: true, endpoint: true, status: true, records: true, syncedAt: true, error: true, metadata: true },
  });

  // 2. Full trade state for ids 314/315/316
  const trades = await prisma.simulatedTrade.findMany({
    where: { id: { in: [314, 315, 316] } },
    select: {
      id: true, symbol: true, tradeMode: true, status: true,
      entryDate: true, entryPrice: true, simulatedFillPrice: true,
      holdingDays: true, pnlPct: true, mfePct: true, maePct: true,
      exitReason: true, exitTime: true, exitPrice: true,
      updatedAt: true, proposalId: true,
    },
  });

  // 3. Review reports for these 3 trades
  const reviews = await prisma.tradeReviewReport.findMany({
    where: { tradeId: { in: [314, 315, 316] } },
    select: { id: true, tradeId: true, triggerType: true, createdAt: true, result: true },
  });

  // 4. Latest StrategyLearningInsight
  const latestLearning = await prisma.strategyLearningInsight.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true, generatedAt: true, sourceCount: true, summary: true },
  });

  // 5. LLM safety: read llm_usage.jsonl from runtime — file-based, no DB model
  const llmUsagePath = nodePath.join(process.cwd(), 'runtime', 'agent_orchestrator', 'llm_usage.jsonl');
  let llmUsageLines: unknown[] = [];
  if (existsSync(llmUsagePath)) {
    const raw = readFileSync(llmUsagePath, 'utf8').trim().split('\n').filter(Boolean);
    llmUsageLines = raw.slice(-10).map(l => { try { return JSON.parse(l); } catch { return l; } });
  }

  // 6. Latest monitor job runs
  const monitorRuns = await prisma.jobRunLog.findMany({
    where: { jobName: { in: ['autonomous:monitor', 'training:intraday_monitor'] } },
    orderBy: { id: 'desc' },
    take: 4,
    select: { id: true, jobName: true, status: true, finishedAt: true, summary: true },
  });

  // 7. Active OptimizationInsightRecord
  const activeInsights = await prisma.optimizationInsightRecord.findMany({
    orderBy: { id: 'desc' },
    take: 3,
    select: { id: true, insightType: true, severity: true, expiresAt: true, createdAt: true },
  });

  // 8. Worker cycle last run
  const lastWorker = await prisma.jobRunLog.findFirst({
    where: { jobName: 'training:tw-worker-cycle' },
    orderBy: { id: 'desc' },
    select: { id: true, status: true, summary: true, finishedAt: true },
  });

  // 9. Calendar-aware freshness classification per symbol
  const quoteFreshness = Object.fromEntries(
    ['2027', '1301', '1303'].map(sym => {
      const q = quotes.find(r => r?.stockId === sym);
      const latestDate = q?.date ?? '1970-01-01';
      // date field may be a string ISO or a Date object depending on Prisma config
      const latestDateIso = typeof latestDate === 'string'
        ? latestDate.slice(0, 10)
        : new Date(latestDate).toISOString().slice(0, 10);
      return [sym, classifyQuoteFreshness(latestDateIso, now)];
    })
  );

  console.log(JSON.stringify({
    snapshotAt: now.toISOString(),
    quotes,
    quoteFreshness,
    recent2027,
    syncLogs,
    trades,
    reviews,
    latestLearning,
    llmUsageLast10: llmUsageLines,
    monitorRuns,
    activeInsights,
    lastWorker,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(e => { console.error(String(e)); process.exitCode = 1; });
