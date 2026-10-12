const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Use local dev DB if DATABASE_URL not provided
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/dev.db';
const p = new PrismaClient({ log: [] });

function normalizeDateStr(d) {
  if (!d) return null;
  return d.includes('-') ? d.replace(/-/g, '') : d;
}

function avg(arr) { return arr.reduce((a,b)=>a+b,0)/arr.length; }

async function analyzeSample(setupType, limit=20) {
  const trades = await p.simulatedTrade.findMany({
    where: { status: 'closed', setupType },
    orderBy: { id: 'desc' },
    take: limit,
    select: { id: true, symbol: true, setupType: true, entryDate: true, entryPrice: true, pnlPct: true }
  });

  const results = [];

  for (const t of trades) {
    const entryDateRaw = t.entryDate || '';
    const entryDate = normalizeDateStr(entryDateRaw).slice(0,8);
    if (!entryDate) {
      results.push({ tradeId: t.id, error: 'no entryDate' });
      continue;
    }

    // fetch up to 30 quotes up to and including entryDate
    const quotes = await p.stockQuote.findMany({
      where: { stockId: t.symbol, date: { lte: entryDate } },
      orderBy: { date: 'desc' },
      take: 30,
      select: { date: true, close: true, volume: true }
    });

    if (!quotes || quotes.length === 0) {
      results.push({ tradeId: t.id, symbol: t.symbol, entryDate: entryDateRaw, error: 'no quotes' });
      continue;
    }

    const closes = quotes.map(q => q.close);
    const volumes = quotes.map(q => q.volume);

    const ma5 = closes.length >=5 ? avg(closes.slice(0,5)) : null;
    const ma20 = closes.length >=20 ? avg(closes.slice(0,20)) : null;

    const ma_regime = (ma5 === null || ma20 === null) ? 'insufficient' : (Math.abs((ma5-ma20)/((ma20||1))) < 0.001 ? 'neutral' : (ma5 > ma20 ? 'up' : 'down'));

    const fiveDayReturn = closes.length >=5 ? (closes[0]/closes[4] - 1) * 100 : null;

    let volConfirmation = null;
    if (volumes.length >= 8) {
      const recent3 = avg(volumes.slice(0,3));
      const prior20 = volumes.length >= 23 ? avg(volumes.slice(3,23)) : (volumes.length > 3 ? avg(volumes.slice(3)) : null);
      if (prior20 && prior20 > 0) volConfirmation = recent3 / prior20;
    }

    results.push({ tradeId: t.id, symbol: t.symbol, entryDate: entryDateRaw, setupType: t.setupType, entryPrice: t.entryPrice, pnlPct: t.pnlPct, ma5, ma20, ma_regime, fiveDayReturn, volConfirmation });
  }

  return results;
}

async function main() {
  try {
    const trendSample = await analyzeSample('trend', 20);
    const reboundSample = await analyzeSample('rebound', 20);

    const all = [...trendSample, ...reboundSample];

    // build confusion matrix: setupType vs ma_regime
    const regimes = ['up','down','neutral','insufficient'];
    const setupTypes = ['trend','rebound'];
    const matrix = {};
    for (const s of setupTypes) {
      matrix[s] = {};
      for (const r of regimes) matrix[s][r] = 0;
    }

    for (const r of all) {
      if (!r.setupType || !r.ma_regime) continue;
      if (!matrix[r.setupType]) matrix[r.setupType] = {};
      matrix[r.setupType][r.ma_regime] = (matrix[r.setupType][r.ma_regime] || 0) + 1;
    }

    const out = {
      generatedAt: new Date().toISOString(),
      sampleCounts: { trend: trendSample.length, rebound: reboundSample.length },
      trades: all,
      confusionMatrix: matrix
    };

    const outPath = path.join(__dirname, '..', 'docs', 'reports', 'setup_audit.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log('Wrote audit JSON to', outPath);

    // write wiki summary
    const wikiPath = path.join(__dirname, '..', 'wiki', 'v1', 'price-analysis-quality.md');
    fs.mkdirSync(path.dirname(wikiPath), { recursive: true });
    const upTrendInTrend = matrix['trend'] ? (matrix['trend']['up']||0) : 0;
    const upTrendInRebound = matrix['rebound'] ? (matrix['rebound']['up']||0) : 0;
    const summary = `# Price Analysis Quality — Setup Classification Audit\n\nGenerated: ${new Date().toISOString()}\n\nSamples: trend=${trendSample.length}, rebound=${reboundSample.length}\n\nConfusion summary (MA-regime 'up' vs setupType):\n- trend labelled trades with up MA-regime: ${upTrendInTrend}\n- rebound labelled trades with up MA-regime: ${upTrendInRebound}\n\nSee docs/reports/setup_audit.json for full per-trade metrics and confusion matrix.\n\nNotes: This is a diagnostics artifact only. No automated reclassification was performed.\n`;
    fs.writeFileSync(wikiPath, summary);
    console.log('Wrote wiki summary to', wikiPath);

    await p.$disconnect();
    console.log('Done');
  } catch (err) {
    console.error('Error', err);
    try { await p.$disconnect(); } catch(e){}
    process.exit(1);
  }
}

main();
