'use strict';

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: [] });

function parseJsonSafe(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function summarizeResultJson(resultStr) {
  const obj = parseJsonSafe(resultStr, {});
  const pnlPct = toFiniteNumber(obj.pnlPct);
  const ret = toFiniteNumber(obj.return);
  const hasPnlPct = pnlPct !== null;
  const hasReturn = ret !== null;
  return {
    obj,
    pnlPct,
    ret,
    hasPnlPct,
    hasReturn,
    hasEither: hasPnlPct || hasReturn,
    hasNeither: !hasPnlPct && !hasReturn,
  };
}

function printHeader(title) {
  console.log(`\n=== ${title} ===`);
}

async function phase0aBaselineSnapshot() {
  printHeader('PHASE 0a - DB Snapshot');

  const statusCounts = await prisma.$queryRawUnsafe(`
    SELECT status, COUNT(*) AS count
    FROM SimulatedTrade
    GROUP BY status
    ORDER BY status
  `);

  const reviewCountRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM TradeReviewReport`);

  const insights = await prisma.$queryRawUnsafe(`
    SELECT id, createdAt, sourceCount
    FROM StrategyLearningInsight
    ORDER BY id
  `);

  const setupStatsClosed = await prisma.$queryRawUnsafe(`
    SELECT setupType,
           COUNT(*) AS total,
           AVG(pnlPct) AS avgPnlPct,
           MIN(pnlPct) AS minPnlPct,
           MAX(pnlPct) AS maxPnlPct
    FROM SimulatedTrade
    WHERE status='closed'
      AND NOT (marketContext LIKE '%"dataQuality":"contaminated"%')
    GROUP BY setupType
    ORDER BY setupType
  `);

  console.log('SimulatedTrade status counts:');
  statusCounts.forEach((r) => console.log(`  ${r.status}: ${Number(r.count)}`));

  console.log(`TradeReviewReport total: ${Number(reviewCountRows[0].count)}`);

  console.log('StrategyLearningInsight rows (id, createdAt, sourceCount):');
  insights.forEach((r) => console.log(`  #${r.id} ${new Date(r.createdAt).toISOString()} sourceCount=${r.sourceCount}`));

  console.log("Closed (status='closed', non-contaminated) stats by setupType:");
  if (setupStatsClosed.length === 0) {
    console.log('  (none)');
  } else {
    setupStatsClosed.forEach((r) => {
      console.log(
        `  ${r.setupType}: count=${Number(r.total)} avg=${Number(r.avgPnlPct).toFixed(2)}% min=${Number(r.minPnlPct).toFixed(2)}% max=${Number(r.maxPnlPct).toFixed(2)}%`,
      );
    });
  }
}

async function phase0bBugImpactAudit() {
  printHeader('PHASE 0b - Bug Impact Scope Audit');

  const learningFile = path.join(process.cwd(), 'src/lib/autonomous/StrategyLearningEngine.ts');
  const fileMtime = fs.statSync(learningFile).mtime;

  const insight22 = await prisma.strategyLearningInsight.findUnique({
    where: { id: 22 },
    select: { id: true, createdAt: true, generatedAt: true, sourceCount: true },
  });

  const effectiveFixTs = insight22?.createdAt ?? fileMtime;

  console.log(`StrategyLearningEngine.ts mtime: ${fileMtime.toISOString()}`);
  if (insight22) {
    console.log(
      `Insight #22 createdAt: ${insight22.createdAt.toISOString()} (generatedAt=${insight22.generatedAt}, sourceCount=${insight22.sourceCount})`,
    );
    console.log(
      `Using effective fix boundary for review audit: ${effectiveFixTs.toISOString()} (Insight #22 timestamp)`,
    );
  } else {
    console.log(`Insight #22 not found; using file mtime as boundary: ${effectiveFixTs.toISOString()}`);
  }

  const reviews = await prisma.tradeReviewReport.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      tradeId: true,
      createdAt: true,
      result: true,
      trade: {
        select: {
          id: true,
          symbol: true,
          entryDate: true,
          pnlPct: true,
        },
      },
    },
  });

  let hasPnlPct = 0;
  let hasReturn = 0;
  let hasNeither = 0;
  let hasBoth = 0;
  let pnlOnly = 0;
  let returnOnly = 0;

  let preFixCount = 0;
  let preFixPnlOnly = 0;
  let preFixReturnOnly = 0;
  let preFixNeither = 0;
  let preFixBoth = 0;

  const byBand = {
    day3_1_13: { total: 0, pnlOnly: 0, returnOnly: 0, both: 0, neither: 0 },
    day4_14_29: { total: 0, pnlOnly: 0, returnOnly: 0, both: 0, neither: 0 },
    day5plus_30_up: { total: 0, pnlOnly: 0, returnOnly: 0, both: 0, neither: 0 },
  };

  for (const r of reviews) {
    const parsed = summarizeResultJson(r.result);

    if (parsed.hasPnlPct) hasPnlPct += 1;
    if (parsed.hasReturn) hasReturn += 1;
    if (parsed.hasNeither) hasNeither += 1;
    if (parsed.hasPnlPct && parsed.hasReturn) hasBoth += 1;
    if (parsed.hasPnlPct && !parsed.hasReturn) pnlOnly += 1;
    if (!parsed.hasPnlPct && parsed.hasReturn) returnOnly += 1;

    const preFix = r.createdAt < effectiveFixTs;
    if (preFix) {
      preFixCount += 1;
      if (parsed.hasPnlPct && !parsed.hasReturn) preFixPnlOnly += 1;
      else if (!parsed.hasPnlPct && parsed.hasReturn) preFixReturnOnly += 1;
      else if (parsed.hasPnlPct && parsed.hasReturn) preFixBoth += 1;
      else preFixNeither += 1;
    }

    const bucket = r.id <= 13 ? byBand.day3_1_13 : r.id <= 29 ? byBand.day4_14_29 : byBand.day5plus_30_up;
    bucket.total += 1;
    if (parsed.hasPnlPct && !parsed.hasReturn) bucket.pnlOnly += 1;
    else if (!parsed.hasPnlPct && parsed.hasReturn) bucket.returnOnly += 1;
    else if (parsed.hasPnlPct && parsed.hasReturn) bucket.both += 1;
    else bucket.neither += 1;
  }

  console.log(`Total reviews audited: ${reviews.length}`);
  console.log(`Field population (all reviews): pnlPct=${hasPnlPct}, return=${hasReturn}, both=${hasBoth}, pnlOnly=${pnlOnly}, returnOnly=${returnOnly}, neither=${hasNeither}`);
  console.log(`Field population (pre-fix boundary): total=${preFixCount}, pnlOnly=${preFixPnlOnly}, returnOnly=${preFixReturnOnly}, both=${preFixBoth}, neither=${preFixNeither}`);

  console.log('By ID band (requested expectation check):');
  console.log(`  IDs 1-13: total=${byBand.day3_1_13.total}, pnlOnly=${byBand.day3_1_13.pnlOnly}, returnOnly=${byBand.day3_1_13.returnOnly}, both=${byBand.day3_1_13.both}, neither=${byBand.day3_1_13.neither}`);
  console.log(`  IDs 14-29: total=${byBand.day4_14_29.total}, pnlOnly=${byBand.day4_14_29.pnlOnly}, returnOnly=${byBand.day4_14_29.returnOnly}, both=${byBand.day4_14_29.both}, neither=${byBand.day4_14_29.neither}`);
  console.log(`  IDs 30+: total=${byBand.day5plus_30_up.total}, pnlOnly=${byBand.day5plus_30_up.pnlOnly}, returnOnly=${byBand.day5plus_30_up.returnOnly}, both=${byBand.day5plus_30_up.both}, neither=${byBand.day5plus_30_up.neither}`);

  console.log('Sample rows (id, createdAt, tradeId, fields):');
  const sampleIds = [1, 13, 14, 22, 29, 30, 40, 59];
  const sample = reviews.filter((r) => sampleIds.includes(r.id));
  sample.forEach((r) => {
    const parsed = summarizeResultJson(r.result);
    console.log(
      `  #${r.id} ${r.createdAt.toISOString()} trade=${r.tradeId} pnlPct=${parsed.pnlPct} return=${parsed.ret} entry=${r.trade?.entryDate ?? 'n/a'}`,
    );
  });

  return {
    effectiveFixTs,
    reviewStats: {
      total: reviews.length,
      preFixCount,
      preFixPnlOnly,
      preFixReturnOnly,
      preFixBoth,
      preFixNeither,
    },
  };
}

async function phase0cInsight22SourceQualityCheck() {
  printHeader('PHASE 0c - Insight #22 Source Quality Check');

  const insight22 = await prisma.strategyLearningInsight.findUnique({
    where: { id: 22 },
    select: {
      id: true,
      createdAt: true,
      summary: true,
      sourceCount: true,
      successPatterns: true,
      failurePatterns: true,
      adjustmentSuggestions: true,
      limitations: true,
    },
  });

  if (!insight22) {
    console.log('Insight #22 not found; skipping source-quality check.');
    return { sourceCount: 0, returnOnlyPct: 0, hasPartialContamination: true };
  }

  console.log('Note: StrategyLearningInsight has no `findings` column in schema; using summary/pattern fields as raw insight payload.');
  console.log(`Insight #22 sourceCount=${insight22.sourceCount}, createdAt=${insight22.createdAt.toISOString()}`);
  console.log(`  summary: ${insight22.summary}`);
  console.log(`  successPatterns: ${insight22.successPatterns}`);
  console.log(`  failurePatterns: ${insight22.failurePatterns}`);

  const contaminatedTrades = await prisma.simulatedTrade.findMany({
    where: { marketContext: { contains: '"dataQuality":"contaminated"' } },
    select: { id: true },
  });
  const contaminatedIds = new Set(contaminatedTrades.map((t) => t.id));

  const latest50AtThatTime = await prisma.tradeReviewReport.findMany({
    where: { createdAt: { lte: insight22.createdAt } },
    orderBy: { generatedAt: 'desc' },
    take: 50,
    select: { id: true, tradeId: true, result: true, createdAt: true },
  });

  const sourceReviews = latest50AtThatTime.filter((r) => !contaminatedIds.has(r.tradeId));

  let withPnlPct = 0;
  let withReturn = 0;
  let withBoth = 0;
  let withNeither = 0;
  let pnlOnly = 0;
  let returnOnly = 0;

  for (const r of sourceReviews) {
    const parsed = summarizeResultJson(r.result);
    if (parsed.hasPnlPct) withPnlPct += 1;
    if (parsed.hasReturn) withReturn += 1;
    if (parsed.hasPnlPct && parsed.hasReturn) withBoth += 1;
    if (parsed.hasPnlPct && !parsed.hasReturn) pnlOnly += 1;
    if (!parsed.hasPnlPct && parsed.hasReturn) returnOnly += 1;
    if (!parsed.hasPnlPct && !parsed.hasReturn) withNeither += 1;
  }

  const total = sourceReviews.length;
  const returnOnlyPct = total > 0 ? (returnOnly / total) * 100 : 0;

  console.log(`Reconstructed source reviews for #22: ${total}`);
  console.log(`  with pnlPct=${withPnlPct}, with return=${withReturn}, both=${withBoth}, pnlOnly=${pnlOnly}, returnOnly=${returnOnly}, neither=${withNeither}`);
  console.log(`  returnOnly ratio: ${returnOnlyPct.toFixed(2)}%`);

  const hasPartialContamination = returnOnlyPct > 20;
  if (hasPartialContamination) {
    console.log('Verdict: Insight #22 is PARTIAL-CONTAMINATED by source-field mismatch (>20% return-only).');
  } else {
    console.log('Verdict: Insight #22 source-field mix does NOT exceed contamination threshold (>20% return-only).');
  }

  return {
    sourceCount: total,
    returnOnlyPct,
    hasPartialContamination,
    withNeither,
  };
}

async function phase1RemediatePrefixReviewsIfNeeded(effectiveFixTs) {
  printHeader('PHASE 1 - Remediate Pre-Fix Reviews (if needed)');

  const reviews = await prisma.tradeReviewReport.findMany({
    where: { createdAt: { lt: effectiveFixTs } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      tradeId: true,
      createdAt: true,
      result: true,
      trade: {
        select: {
          id: true,
          symbol: true,
          entryDate: true,
          pnlPct: true,
          marketContext: true,
        },
      },
    },
  });

  const needsFix = reviews.filter((r) => {
    const parsed = summarizeResultJson(r.result);
    const tradePnl = toFiniteNumber(r.trade?.pnlPct);
    return tradePnl !== null && (!parsed.hasPnlPct || !parsed.hasReturn);
  });

  const day4WindowNeedsFix = needsFix.filter((r) => {
    const d = r.trade?.entryDate ?? '';
    return d >= '2025-10-01' && d <= '2025-10-31';
  });

  console.log(`Pre-fix reviews checked: ${reviews.length}`);
  console.log(`Pre-fix reviews needing result field remediation: ${needsFix.length}`);
  console.log(`Day4 Oct(2025-10-01~2025-10-31) subset needing remediation: ${day4WindowNeedsFix.length}`);

  if (needsFix.length === 0) {
    console.log('Pre-fix reviews already have correct pnlPct + return - no remediation needed.');
    return { fixedCount: 0, day4Fixed: 0, needed: false };
  }

  let fixedCount = 0;
  let day4Fixed = 0;

  for (const r of needsFix) {
    const tradePnl = toFiniteNumber(r.trade?.pnlPct);
    if (tradePnl === null) continue;

    const resultObj = parseJsonSafe(r.result, {});
    resultObj.pnlPct = tradePnl;
    resultObj.return = tradePnl;

    await prisma.tradeReviewReport.update({
      where: { id: r.id },
      data: { result: JSON.stringify(resultObj) },
    });

    fixedCount += 1;
    if ((r.trade?.entryDate ?? '') >= '2025-10-01' && (r.trade?.entryDate ?? '') <= '2025-10-31') {
      day4Fixed += 1;
    }

    console.log(
      `Fixed review #${r.id}: result.pnlPct = ${tradePnl.toFixed(4)} (from SimulatedTrade #${r.tradeId}, symbol=${r.trade?.symbol ?? 'n/a'})`,
    );
  }

  console.log(`Remediation complete: ${fixedCount} reviews fixed (${day4Fixed} from Day4 Oct window).`);
  return { fixedCount, day4Fixed, needed: true };
}

async function main() {
  const t0 = Date.now();

  await phase0aBaselineSnapshot();
  const phase0b = await phase0bBugImpactAudit();
  const phase0c = await phase0cInsight22SourceQualityCheck();
  const phase1 = await phase1RemediatePrefixReviewsIfNeeded(phase0b.effectiveFixTs);

  printHeader('PHASE 0/1 SUMMARY');
  console.log(`Fix boundary used: ${phase0b.effectiveFixTs.toISOString()}`);
  console.log(`Pre-fix reviews: ${phase0b.reviewStats.preFixCount}`);
  console.log(`Insight #22 reconstructed sourceCount: ${phase0c.sourceCount}`);
  console.log(`Insight #22 return-only ratio: ${phase0c.returnOnlyPct.toFixed(2)}%`);
  console.log(`Insight #22 partial-contamination-threshold (>20% return-only): ${phase0c.hasPartialContamination ? 'YES' : 'NO'}`);
  console.log(`Phase 1 remediation: ${phase1.needed ? `FIXED ${phase1.fixedCount}` : 'NOT NEEDED'}`);

  const ms = Date.now() - t0;
  console.log(`Runtime: ${(ms / 1000).toFixed(2)}s`);
}

main()
  .catch((err) => {
    console.error('ERROR:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
