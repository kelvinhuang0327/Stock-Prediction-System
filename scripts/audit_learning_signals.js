/* eslint-disable */
// Learning signal audit — run with: node scripts/audit_learning_signals.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const trades = await prisma.simulatedTrade.findMany({ orderBy: { id: 'desc' } });
  const reviews = await prisma.tradeReviewReport.findMany({
    include: { trade: true },
    orderBy: { generatedAt: 'desc' },
  });
  const insights = await prisma.strategyLearningInsight.findMany({
    orderBy: { generatedAt: 'desc' },
  });

  // Latest quote per open trade symbol
  const openTrades = trades.filter(function(t) { return t.status === 'open' || t.status === 'shadow-open'; });
  const openSymbols = [...new Set(openTrades.map(function(t) { return t.symbol; }))];
  const quoteMap = {};
  for (const sym of openSymbols) {
    const q = await prisma.stockQuote.findFirst({ where: { stockId: sym }, orderBy: { date: 'desc' } });
    quoteMap[sym] = q ? { date: q.date, close: q.close } : null;
  }

  // ── TRADES ──
  console.log('=== TRADES (' + trades.length + ') ===');
  for (const t of trades) {
    const pnl = t.pnlPct !== null ? Number(t.pnlPct).toFixed(4) : null;
    console.log(JSON.stringify({ id: t.id, symbol: t.symbol, status: t.status, exitReason: t.exitReason, pnlPct: pnl, holdingDays: t.holdingDays, setupType: t.setupType, tradeMode: t.tradeMode, entryDate: t.entryDate }));
  }

  // ── LATEST QUOTES ──
  console.log('\n=== LATEST QUOTES FOR OPEN TRADES ===');
  for (const sym of openSymbols) {
    console.log(sym + ': ' + JSON.stringify(quoteMap[sym]));
  }

  // ── REVIEWS ──
  console.log('\n=== REVIEWS (' + reviews.length + ') ===');
  const tc = { '+5': 0, '-5': 0, time: 0, other: 0 };
  for (const r of reviews) {
    const st = r.trade;
    let analysis = {}; let result = {}; let recs = {};
    try { analysis = JSON.parse(r.analysis || '{}'); } catch (e) { /**/ }
    try { result = JSON.parse(r.result || '{}'); } catch (e) { /**/ }
    try { recs = JSON.parse(r.recommendations || '{}'); } catch (e) { /**/ }
    const tt = r.triggerType;
    if (tt === '+5') tc['+5']++;
    else if (tt === '-5') tc['-5']++;
    else if (tt === 'time') tc.time++;
    else tc.other++;
    const pnl = st ? Number(st.pnlPct).toFixed(4) : null;
    console.log(JSON.stringify({
      id: r.id, tradeId: r.tradeId, triggerType: tt,
      setupType: st ? st.setupType : null, tradeMode: st ? st.tradeMode : null,
      pnlPct: pnl, exitReason: result.exitReason,
      technicalEffective: analysis.technicalEffective,
      raiseThresholds: recs.raiseThresholds,
    }));
  }
  console.log('triggerType counts: ' + JSON.stringify(tc));

  const signalCount = tc['+5'] + tc['-5'];
  const noiseCount = tc.time;
  const snr = reviews.length > 0 ? (signalCount / reviews.length * 100).toFixed(0) + '%' : 'n/a';
  console.log('signal/noise: ' + signalCount + ' signal, ' + noiseCount + ' time-exit, SNR=' + snr);

  // ── INSIGHTS ──
  console.log('\n=== INSIGHTS (' + insights.length + ') ===');
  for (const i of insights) {
    let sp = [], fp = [], sug = [], lim = [];
    try { sp = JSON.parse(i.successPatterns || '[]'); } catch (e) { /**/ }
    try { fp = JSON.parse(i.failurePatterns || '[]'); } catch (e) { /**/ }
    try { sug = JSON.parse(i.adjustmentSuggestions || '[]'); } catch (e) { /**/ }
    try { lim = JSON.parse(i.limitations || '[]'); } catch (e) { /**/ }
    const contaminated = fp.some(function(p) { return p.includes('time'); }) || sp.some(function(p) { return p.includes('time'); });
    console.log(JSON.stringify({
      id: i.id, generatedAt: i.generatedAt,
      summary: i.summary, sourceCount: i.sourceCount,
      successPatterns: sp, failurePatterns: fp,
      adjustmentSuggestions: sug, limitations: lim,
      _contaminated: contaminated,
    }, null, 2));
  }

  // ── READINESS SUMMARY ──
  console.log('\n=== READINESS ===');
  const fullTradeCount = reviews.filter(function(r) { return r.trade && r.trade.tradeMode === 'full'; }).length;
  console.log('fullTradesClosed: ' + fullTradeCount);
  console.log('gate_5_clear: ' + (fullTradeCount >= 5));
  console.log('has_signal: ' + (signalCount > 0));
  const setupTypes = [...new Set(reviews.filter(function(r) { return r.trade; }).map(function(r) { return r.trade.setupType; }))];
  console.log('setupDiversity: ' + setupTypes.join(', ') + ' (' + setupTypes.length + ' types)');

  await prisma.$disconnect();
}

main().catch(function(e) { console.error(e.message); process.exit(1); });
