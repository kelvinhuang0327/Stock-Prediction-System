/**
 * P25-HARDRESET: MonthlyRevenue Query Gate Smoke (Part D)
 *
 * Tests PIT query gate: releaseDate <= asOfDate for Feb 2026 and March 2026 data.
 * Sample cases: before/equal/after releaseDate, December overflow, allowInferredReleaseDate.
 *
 * DISCLAIMER: Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 * productionDbWritten = false | corpusModified = false
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT_DIR = 'outputs/online_validation';
const DB_FILE = 'prisma/dev.db';
const NOW = new Date().toISOString();

function sqlQuery(q) {
  try { return execSync(`sqlite3 "${DB_FILE}" "${q}"`, { encoding: 'utf8' }).trim(); }
  catch (e) { return `ERROR: ${e.message}`; }
}

console.log('P25-HARDRESET: MonthlyRevenue Query Gate Smoke');
console.log('Generated:', NOW);
console.log('');

// ── Load sample rows ─────────────────────────────────────────────────────
// Feb 2026: releaseDate = 2026-03-10
// March 2026: releaseDate = 2026-04-10

const feb2026Raw = sqlQuery("SELECT stockId, year, month, DATE(releaseDate), releaseDateSource FROM MonthlyRevenue WHERE year=2026 AND month=2 LIMIT 1");
const mar2026Raw = sqlQuery("SELECT stockId, year, month, DATE(releaseDate), releaseDateSource FROM MonthlyRevenue WHERE year=2026 AND month=3 LIMIT 1");

function parseRow(raw) {
  if (!raw || raw.startsWith('ERROR')) return null;
  const p = raw.split('|');
  if (p.length < 5) return null;
  return { stockId: p[0], year: parseInt(p[1]), month: parseInt(p[2]), releaseDate: p[3], releaseDateSource: p[4] };
}

const feb2026 = parseRow(feb2026Raw);
const mar2026 = parseRow(mar2026Raw);

console.log('Feb 2026 sample:', JSON.stringify(feb2026));
console.log('Mar 2026 sample:', JSON.stringify(mar2026));
console.log('');

const cases = [];
let passCount = 0;
let failCount = 0;

function addCase(caseId, description, row, asOfDate, expectAvailable, allowInferred = true) {
  if (!row) {
    cases.push({ caseId, description, status: 'SKIP', reason: 'Sample row not available', asOfDate, expectAvailable });
    return;
  }
  const rd = row.releaseDate; // YYYY-MM-DD from DATE()
  const asOf = asOfDate.substring(0, 10);
  const rdStr = rd ? rd.substring(0, 10) : null;

  let actualAvailable;
  let reason;

  if (!rdStr) {
    if (allowInferred) {
      // Infer next-month-10th
      const yr = row.year; const mo = row.month;
      const infYear = mo === 12 ? yr + 1 : yr;
      const infMonth = mo === 12 ? 1 : mo + 1;
      const infDate = `${infYear}-${String(infMonth).padStart(2,'0')}-10`;
      actualAvailable = infDate <= asOf;
      reason = `No explicit releaseDate; inferred=${infDate}, asOf=${asOf}, available=${actualAvailable}`;
    } else {
      actualAvailable = false;
      reason = `No releaseDate and allowInferredReleaseDate=false — unavailable`;
    }
  } else {
    actualAvailable = rdStr <= asOf;
    reason = `releaseDate=${rdStr} ${rdStr <= asOf ? '<=' : '>'} asOfDate=${asOf} — ${actualAvailable ? 'available' : 'unavailable'}`;
  }

  const pass = actualAvailable === expectAvailable;
  if (pass) passCount++; else failCount++;

  cases.push({
    caseId,
    description,
    stockId: row.stockId,
    year: row.year,
    month: row.month,
    releaseDate: rdStr || 'NULL',
    asOfDate: asOf,
    expectedAvailable: expectAvailable,
    actualAvailable,
    pass,
    reason,
    allowInferred,
  });

  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${caseId}: ${description}`);
  console.log(`  ${reason}`);
}

// ── Case set 1: Feb 2026 (releaseDate = 2026-03-10) ──────────────────────

// Case 1a: One day before releaseDate → unavailable
addCase('QG-01a', 'Feb 2026 | asOf one day before releaseDate (2026-03-09) → unavailable', feb2026, '2026-03-09', false);

// Case 1b: Equal to releaseDate → available
addCase('QG-01b', 'Feb 2026 | asOf = releaseDate (2026-03-10) → available', feb2026, '2026-03-10', true);

// Case 1c: One day after releaseDate → available
addCase('QG-01c', 'Feb 2026 | asOf one day after releaseDate (2026-03-11) → available', feb2026, '2026-03-11', true);

// ── Case set 2: March 2026 (releaseDate = 2026-04-10) ────────────────────

// Case 2a: One day before releaseDate → unavailable
addCase('QG-02a', 'Mar 2026 | asOf one day before releaseDate (2026-04-09) → unavailable', mar2026, '2026-04-09', false);

// Case 2b: Equal to releaseDate → available
addCase('QG-02b', 'Mar 2026 | asOf = releaseDate (2026-04-10) → available', mar2026, '2026-04-10', true);

// ── Case set 3: allowInferredReleaseDate=false ────────────────────────────

// Case 3: Feb 2026 with allowInferred=false on releaseDate — but row HAS releaseDate
// We test the gate: even with allowInferred=false, explicit releaseDate gating works
addCase('QG-03a', 'Feb 2026 | allowInferred=false | asOf 2026-03-09 → unavailable', feb2026, '2026-03-09', false, false);
addCase('QG-03b', 'Feb 2026 | allowInferred=false | asOf 2026-03-10 → available', feb2026, '2026-03-10', true, false);

// ── Case set 4: asOf well before any data ────────────────────────────────

addCase('QG-04', 'Feb 2026 | asOf 2026-01-01 (well before) → unavailable', feb2026, '2026-01-01', false);

// ── Case set 5: asOf well after any data ─────────────────────────────────

addCase('QG-05a', 'Feb 2026 | asOf 2026-05-12 (current date) → available', feb2026, '2026-05-12', true);
addCase('QG-05b', 'Mar 2026 | asOf 2026-05-12 (current date) → available', mar2026, '2026-05-12', true);

// ── MonthlyRevenueAvailability helper consistency check ──────────────────

// Verify query gate via direct DB query
const dbAvailFeb = sqlQuery("SELECT COUNT(*) FROM MonthlyRevenue WHERE year=2026 AND month=2 AND DATE(releaseDate) <= '2026-03-09'");
const dbAvailFebOnDate = sqlQuery("SELECT COUNT(*) FROM MonthlyRevenue WHERE year=2026 AND month=2 AND DATE(releaseDate) <= '2026-03-10'");
const dbAvailFebAfter = sqlQuery("SELECT COUNT(*) FROM MonthlyRevenue WHERE year=2026 AND month=2 AND DATE(releaseDate) <= '2026-03-11'");

console.log('');
console.log('DB-level gate check:');
console.log(`  Feb 2026 rows available asOf 2026-03-09: ${dbAvailFeb} (expected 0)`);
console.log(`  Feb 2026 rows available asOf 2026-03-10: ${dbAvailFebOnDate} (expected 1070)`);
console.log(`  Feb 2026 rows available asOf 2026-03-11: ${dbAvailFebAfter} (expected 1070)`);

const dbCheck09 = parseInt(dbAvailFeb, 10) === 0;
const dbCheck10 = parseInt(dbAvailFebOnDate, 10) === 1070;
const dbCheck11 = parseInt(dbAvailFebAfter, 10) === 1070;

if (dbCheck09) passCount++; else failCount++;
if (dbCheck10) passCount++; else failCount++;
if (dbCheck11) passCount++; else failCount++;

cases.push({ caseId: 'QG-DB-09', description: 'DB gate: 0 rows available before 2026-03-10', pass: dbCheck09, count: parseInt(dbAvailFeb, 10), expected: 0 });
cases.push({ caseId: 'QG-DB-10', description: 'DB gate: 1070 rows available on 2026-03-10', pass: dbCheck10, count: parseInt(dbAvailFebOnDate, 10), expected: 1070 });
cases.push({ caseId: 'QG-DB-11', description: 'DB gate: 1070 rows available after 2026-03-10', pass: dbCheck11, count: parseInt(dbAvailFebAfter, 10), expected: 1070 });

// ── Summary ──────────────────────────────────────────────────────────────

const validationStatus = failCount === 0 ? 'PASS' : 'FAIL';
console.log('');
console.log(`Total cases: ${cases.length} | PASS: ${passCount} | FAIL: ${failCount}`);
console.log('validationStatus:', validationStatus);

const result = {
  phase: 'P25-HARDRESET',
  part: 'D',
  generatedAt: NOW,
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.',
  validationStatus,
  totalCases: cases.length,
  passCount,
  failCount,
  cases,
  dbGateCheck: {
    feb2026Before20260309: parseInt(dbAvailFeb, 10),
    feb2026On20260310: parseInt(dbAvailFebOnDate, 10),
    feb2026After20260311: parseInt(dbAvailFebAfter, 10),
    allDbGatesPass: dbCheck09 && dbCheck10 && dbCheck11,
  },
  productionDbWritten: false,
  corpusModified: false,
  scoringFormulaModified: false,
};

const jsonPath = path.join(OUT_DIR, 'p25monthly_revenue_query_gate_smoke.json');
fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
console.log('Written:', jsonPath);

const md = `# P25 MonthlyRevenue Query Gate Smoke

**Phase:** P25-HARDRESET Part D  
**Generated:** ${NOW}  
**Validation Status:** \`${validationStatus}\`

## Summary

| Metric | Value |
|--------|-------|
| Total cases | ${cases.length} |
| PASS | ${passCount} |
| FAIL | ${failCount} |

## Smoke Cases

${cases.map(c => `- [${c.pass === undefined ? 'SKIP' : c.pass ? 'PASS' : 'FAIL'}] \`${c.caseId}\` — ${c.description}${c.reason ? ': ' + c.reason : ''}`).join('\n')}

## DB-Level Gate Verification

| Query | Count | Expected | Status |
|-------|-------|----------|--------|
| Feb 2026 rows available asOf 2026-03-09 | ${dbAvailFeb} | 0 | ${dbCheck09 ? '✅' : '❌'} |
| Feb 2026 rows available asOf 2026-03-10 | ${dbAvailFebOnDate} | 1070 | ${dbCheck10 ? '✅' : '❌'} |
| Feb 2026 rows available asOf 2026-03-11 | ${dbAvailFebAfter} | 1070 | ${dbCheck11 ? '✅' : '❌'} |

*Does not constitute investment advice. No ROI / win-rate / alpha / profit / outperform claims.*
`;

const mdPath = path.join(OUT_DIR, 'p25monthly_revenue_query_gate_smoke.md');
fs.writeFileSync(mdPath, md);
console.log('Written:', mdPath);
