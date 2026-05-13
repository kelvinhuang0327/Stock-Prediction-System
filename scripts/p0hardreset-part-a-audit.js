/**
 * P0-HARDRESET PART A Audit Script
 * 
 * A.1 stockQuote coverage
 * A.2 InstitutionalChip intersection universe
 * A.3 Historical asOfDate candidates (>= 30 non-overlapping)
 * A.4 Output artifacts
 * 
 * SAFETY: read-only, no DB writes, no production writes
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'outputs', 'online_validation');

// Inline TwseTradingCalendar logic (simplified) for Node.js compatibility
const TWSE_HOLIDAYS = new Set([
  '2024-01-01','2024-02-08','2024-02-09','2024-02-10','2024-02-11','2024-02-12',
  '2024-02-13','2024-02-14','2024-02-28','2024-04-04','2024-04-05','2024-05-01',
  '2024-06-10','2024-09-17','2024-10-10',
  '2025-01-01','2025-01-27','2025-01-28','2025-01-29','2025-01-30','2025-01-31',
  '2025-02-04','2025-02-28','2025-04-03','2025-04-04','2025-05-01','2025-05-30',
  '2025-05-31','2025-10-06','2025-10-10',
  '2026-01-01','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-23',
  '2026-02-24','2026-02-28','2026-04-03','2026-04-04','2026-05-01','2026-06-19',
  '2026-09-25','2026-10-09',
]);

function isTwseTradingDay(date) {
  const d = new Date(date + 'T12:00:00Z');
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !TWSE_HOLIDAYS.has(date);
}

function addTwseTradingDays(startDate, n) {
  let d = new Date(startDate + 'T12:00:00Z');
  let count = 0;
  while (count < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const ds = d.toISOString().slice(0, 10);
    if (isTwseTradingDay(ds)) count++;
  }
  return d.toISOString().slice(0, 10);
}

async function main() {
  const p = new PrismaClient({ log: [] });
  
  try {
    // A.1 stockQuote coverage
    console.log('A.1 Auditing stockQuote...');
    const total = await p.stockQuote.count();
    const quoteBySymbol = await p.stockQuote.groupBy({
      by: ['stockId'],
      _count: { stockId: true },
      _min: { date: true },
      _max: { date: true },
    });
    const dateRange = await p.stockQuote.aggregate({
      _min: { date: true },
      _max: { date: true },
    });
    const top30 = quoteBySymbol
      .sort((a, b) => b._count.stockId - a._count.stockId)
      .slice(0, 30)
      .map(r => ({ symbol: r.stockId, days: r._count.stockId, from: r._min.date, to: r._max.date }));

    console.log(`  Total stockQuote rows: ${total}`);
    console.log(`  Distinct symbols: ${quoteBySymbol.length}`);

    // A.2 InstitutionalChip intersection universe
    console.log('A.2 Auditing InstitutionalChip intersection...');
    const chipBySymbol = await p.institutionalChip.groupBy({
      by: ['stockId'],
      _count: { stockId: true },
      _min: { date: true },
      _max: { date: true },
    });
    const chipMap = new Map(chipBySymbol.map(r => [r.stockId, r]));
    const quoteMap = new Map(quoteBySymbol.map(r => [r.stockId, r]));

    const universe = [];
    for (const [sym, qr] of quoteMap) {
      if (qr._count.stockId < 180) continue;
      const cr = chipMap.get(sym);
      if (cr == null || cr._count.stockId < 120) continue;
      const overlapStart = qr._min.date > cr._min.date ? qr._min.date : cr._min.date;
      const overlapEnd = qr._max.date < cr._max.date ? qr._max.date : cr._max.date;
      if (overlapStart > overlapEnd) continue;
      const msPerDay = 86400000;
      const overlapDays = Math.round(
        (new Date(overlapEnd + 'T12:00:00Z').getTime() - new Date(overlapStart + 'T12:00:00Z').getTime()) / msPerDay
      ) + 1;
      if (overlapDays < 150) continue;
      universe.push({
        symbol: sym,
        quoteDays: qr._count.stockId,
        chipDays: cr._count.stockId,
        overlapDays,
        quoteStart: qr._min.date,
        quoteEnd: qr._max.date,
        chipStart: cr._min.date,
        chipEnd: cr._max.date,
      });
    }
    universe.sort((a, b) => b.quoteDays - a.quoteDays);
    console.log(`  Universe count (quota >= 20): ${universe.length}`);

    // A.3 Historical asOfDate candidates
    console.log('A.3 Finding historical asOfDate candidates...');
    // Get all unique dates from stockQuote as a sorted set
    const allDatesRaw = await p.stockQuote.findMany({
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'desc' },
    });
    const allDates = allDatesRaw
      .map(r => r.date)
      .filter(d => d.match(/^\d{4}-\d{2}-\d{2}$/))
      .sort()
      .reverse();

    const today = new Date().toISOString().slice(0, 10);
    const dateSet = new Set(allDates);

    // For each candidate asOfDate (going from most recent to oldest):
    // - asOfDate must be a trading day in stockQuote
    // - asOfDate <= today - some buffer (so outcome + 60TD might exist)
    // - asOfDate + 60 trading days must exist in stockQuote
    const asOfDateCandidates = [];
    const usedDates = new Set();

    for (const d of allDates) {
      if (d >= today) continue; // must be historical
      if (usedDates.has(d)) continue;
      
      // Calculate asOfDate + 60 trading days
      const outcomeDate60 = addTwseTradingDays(d, 60);
      if (!dateSet.has(outcomeDate60)) continue; // outcome must exist in DB
      
      // Also check asOfDate + 5 and + 20 trading days
      const outcomeDate5 = addTwseTradingDays(d, 5);
      const outcomeDate20 = addTwseTradingDays(d, 20);
      if (!dateSet.has(outcomeDate5)) continue;
      if (!dateSet.has(outcomeDate20)) continue;

      asOfDateCandidates.push({
        asOfDate: d,
        outcome5dDate: outcomeDate5,
        outcome20dDate: outcomeDate20,
        outcome60dDate: outcomeDate60,
        allOutcomesAvailable: outcomeDate60 < today,
        outcome5dAvailable: outcomeDate5 < today,
        outcome20dAvailable: outcomeDate20 < today,
        outcome60dAvailable: outcomeDate60 < today,
      });
      usedDates.add(d);
      
      if (asOfDateCandidates.length >= 60) break;
    }
    
    console.log(`  Historical asOfDate candidates found: ${asOfDateCandidates.length}`);

    // A.4 Output artifacts
    const universeAudit = {
      generatedAt: new Date().toISOString(),
      auditVersion: 'p0hardreset-audit-v1',
      stockQuoteAudit: {
        totalRows: total,
        distinctSymbols: quoteBySymbol.length,
        dateRange: { min: dateRange._min.date, max: dateRange._max.date },
        top30ByDays: top30,
      },
      institutionalChipAudit: {
        distinctSymbols: chipBySymbol.length,
      },
      universeResult: {
        criteriaDescription: 'stockQuote >= 180 days AND institutionalChip >= 120 days AND overlap >= 150 calendar days',
        universeCount: universe.length,
        passThreshold: 20,
        pass: universe.length >= 20,
        universe: universe.slice(0, 50),
      },
      overallPass: universe.length >= 20,
      failReason: universe.length < 20 ? `Universe count ${universe.length} < 20 required` : null,
    };

    const asOfAudit = {
      generatedAt: new Date().toISOString(),
      auditVersion: 'p0hardreset-asofdate-v1',
      candidateCount: asOfDateCandidates.length,
      passThreshold: 30,
      pass: asOfDateCandidates.length >= 30,
      failReason: asOfDateCandidates.length < 30 ? `Only ${asOfDateCandidates.length} candidates found, need >= 30` : null,
      candidates: asOfDateCandidates,
    };

    // Write artifacts
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const universeAuditJsonPath = path.join(OUTPUT_DIR, 'p0hardreset_universe_audit.json');
    const universeAuditMdPath = path.join(OUTPUT_DIR, 'p0hardreset_universe_audit.md');
    const asOfDatePath = path.join(OUTPUT_DIR, 'p0hardreset_historical_asofdate_candidates.json');

    fs.writeFileSync(universeAuditJsonPath, JSON.stringify(universeAudit, null, 2));
    fs.writeFileSync(asOfDatePath, JSON.stringify(asOfAudit, null, 2));

    // Markdown summary
    const statusIcon = universeAudit.overallPass && asOfAudit.pass ? '✅ PASS' : '❌ FAIL';
    const md = `# P0-HARDRESET Universe Audit

**Generated:** ${universeAudit.generatedAt}  
**Status:** ${statusIcon}

## A.1 stockQuote Coverage

| Metric | Value |
|--------|-------|
| Total rows | ${total.toLocaleString()} |
| Distinct symbols | ${quoteBySymbol.length.toLocaleString()} |
| Date range | ${dateRange._min.date} ~ ${dateRange._max.date} |

### Top 30 Symbols by Days
${top30.map(r => `- ${r.symbol}: ${r.days} days (${r.from} ~ ${r.to})`).join('\n')}

## A.2 Universe (stockQuote>=180 + chip>=120 + overlap>=150)

| Metric | Value |
|--------|-------|
| Universe count | **${universe.length}** |
| Pass threshold | 20 |
| Result | ${universe.length >= 20 ? '✅ PASS' : '❌ FAIL'} |

${universe.length >= 20 ? '' : `**FAIL reason:** ${universeAudit.failReason}`}

### Universe List (top 50)
${universe.slice(0, 50).map(r => `- ${r.symbol}: quote=${r.quoteDays}d chip=${r.chipDays}d overlap=${r.overlapDays}d`).join('\n')}

## A.3 Historical asOfDate Candidates

| Metric | Value |
|--------|-------|
| Candidates found | **${asOfDateCandidates.length}** |
| Pass threshold | 30 |
| Result | ${asOfDateCandidates.length >= 30 ? '✅ PASS' : '❌ FAIL'} |

${asOfDateCandidates.length >= 30 ? '' : `**FAIL reason:** ${asOfAudit.failReason}`}

### Candidates (first 30)
${asOfDateCandidates.slice(0, 30).map(r => `- ${r.asOfDate} → 5D:${r.outcome5dDate} 20D:${r.outcome20dDate} 60D:${r.outcome60dDate} (60D available: ${r.outcome60dAvailable})`).join('\n')}

## Overall Assessment

${universeAudit.overallPass && asOfAudit.pass
  ? '✅ **PASS** — Sufficient universe and asOfDate candidates for historical replay'
  : '❌ **FAIL** — Escalate to P5 coverage backfill'}
`;

    fs.writeFileSync(universeAuditMdPath, md);

    console.log('\n=== AUDIT RESULTS ===');
    console.log(`Universe count: ${universe.length} (${universe.length >= 20 ? 'PASS' : 'FAIL'}, need >= 20)`);
    console.log(`asOfDate candidates: ${asOfDateCandidates.length} (${asOfDateCandidates.length >= 30 ? 'PASS' : 'FAIL'}, need >= 30)`);
    console.log(`\nArtifacts written:`);
    console.log(`  ${universeAuditJsonPath}`);
    console.log(`  ${universeAuditMdPath}`);
    console.log(`  ${asOfDatePath}`);

    if (!universeAudit.overallPass || !asOfAudit.pass) {
      console.error('\n❌ ESCALATION REQUIRED - see artifacts for details');
      process.exit(1);
    } else {
      console.log('\n✅ A.4 PASS — Proceeding with historical replay');
    }

  } finally {
    await p.$disconnect();
  }
}

main().catch(e => {
  console.error('AUDIT FAILED:', e.message);
  process.exit(1);
});
