/**
 * P25-HARDRESET: MonthlyRevenue Distribution Audit (Part C)
 *
 * Audits the post-migration distribution of releaseDate / releaseDateSource / releaseDateConfidence.
 * Does NOT write to production DB.
 * Does NOT modify corpus.
 * Does NOT modify scoring formula.
 *
 * DISCLAIMER: Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
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
function sqlInt(q) { return parseInt(sqlQuery(q), 10) || 0; }

console.log('P25-HARDRESET: MonthlyRevenue Distribution Audit');
console.log('Generated:', NOW);
console.log('');

// ── Basic counts ─────────────────────────────────────────────────────────

const totalRows = sqlInt('SELECT COUNT(*) FROM MonthlyRevenue');
const rowsWithReleaseDate = sqlInt('SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NOT NULL');
const rowsWithoutReleaseDate = sqlInt('SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NULL');
const invalidReleaseDateCount = sqlInt("SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NOT NULL AND DATE(releaseDate) IS NULL");
const duplicateCount = sqlInt('SELECT COUNT(*) FROM (SELECT stockId, year, month, COUNT(*) as c FROM MonthlyRevenue GROUP BY stockId, year, month HAVING c > 1)');

console.log('totalRows:', totalRows);
console.log('rowsWithReleaseDate:', rowsWithReleaseDate);
console.log('rowsWithoutReleaseDate:', rowsWithoutReleaseDate);
console.log('invalidReleaseDateCount:', invalidReleaseDateCount);
console.log('duplicateCount:', duplicateCount);

// ── Distribution by releaseDateSource ───────────────────────────────────

const sourceDistribRaw = sqlQuery("SELECT releaseDateSource, COUNT(*) FROM MonthlyRevenue GROUP BY releaseDateSource ORDER BY COUNT(*) DESC");
const releaseDateSourceDistribution = {};
if (sourceDistribRaw && !sourceDistribRaw.startsWith('ERROR')) {
  for (const line of sourceDistribRaw.split('\n')) {
    const parts = line.split('|');
    if (parts.length === 2) {
      releaseDateSourceDistribution[parts[0] || 'NULL'] = parseInt(parts[1], 10);
    }
  }
}
console.log('releaseDateSourceDistribution:', JSON.stringify(releaseDateSourceDistribution));

// ── Distribution by releaseDateConfidence ───────────────────────────────

const confDistribRaw = sqlQuery("SELECT releaseDateConfidence, COUNT(*) FROM MonthlyRevenue GROUP BY releaseDateConfidence ORDER BY COUNT(*) DESC");
const releaseDateConfidenceDistribution = {};
if (confDistribRaw && !confDistribRaw.startsWith('ERROR')) {
  for (const line of confDistribRaw.split('\n')) {
    const parts = line.split('|');
    if (parts.length === 2) {
      releaseDateConfidenceDistribution[parts[0] || 'NULL'] = parseInt(parts[1], 10);
    }
  }
}
console.log('releaseDateConfidenceDistribution:', JSON.stringify(releaseDateConfidenceDistribution));

// ── Min/Max releaseDate ──────────────────────────────────────────────────

const minReleaseDate = sqlQuery('SELECT MIN(DATE(releaseDate)) FROM MonthlyRevenue WHERE releaseDate IS NOT NULL');
const maxReleaseDate = sqlQuery('SELECT MAX(DATE(releaseDate)) FROM MonthlyRevenue WHERE releaseDate IS NOT NULL');
console.log('minReleaseDate:', minReleaseDate);
console.log('maxReleaseDate:', maxReleaseDate);

// ── Sample inferred rows ─────────────────────────────────────────────────

const sampleRaw = sqlQuery("SELECT stockId, year, month, DATE(releaseDate), releaseDateSource, releaseDateConfidence FROM MonthlyRevenue WHERE releaseDateSource='INFERRED_NEXT_MONTH_10TH' ORDER BY stockId, year, month LIMIT 5");
const sampleInferredRows = [];
if (sampleRaw && !sampleRaw.startsWith('ERROR')) {
  for (const line of sampleRaw.split('\n')) {
    const p = line.split('|');
    if (p.length >= 6) {
      sampleInferredRows.push({ stockId: p[0], year: parseInt(p[1]), month: parseInt(p[2]), releaseDate: p[3], releaseDateSource: p[4], releaseDateConfidence: p[5] });
    }
  }
}

// ── Sample rows by month boundary ───────────────────────────────────────

const boundaryRaw = sqlQuery("SELECT stockId, year, month, DATE(releaseDate), releaseDateSource FROM MonthlyRevenue WHERE month=12 LIMIT 3");
const sampleDecemberRows = [];
if (boundaryRaw && !boundaryRaw.startsWith('ERROR')) {
  for (const line of boundaryRaw.split('\n')) {
    const p = line.split('|');
    if (p.length >= 5) {
      sampleDecemberRows.push({ stockId: p[0], year: parseInt(p[1]), month: parseInt(p[2]), releaseDate: p[3], releaseDateSource: p[4] });
    }
  }
}

// Note: DB only has Feb and March 2026 data (no December rows yet)
const sampleMarchRows = [];
const marchRaw = sqlQuery("SELECT stockId, year, month, DATE(releaseDate), releaseDateSource FROM MonthlyRevenue WHERE month=3 LIMIT 3");
if (marchRaw && !marchRaw.startsWith('ERROR')) {
  for (const line of marchRaw.split('\n')) {
    const p = line.split('|');
    if (p.length >= 5) {
      sampleMarchRows.push({ stockId: p[0], year: parseInt(p[1]), month: parseInt(p[2]), releaseDate: p[3], releaseDateSource: p[4] });
    }
  }
}

// ── Validation ───────────────────────────────────────────────────────────

const errors = [];
const warnings = [];

if (totalRows < 2143) errors.push(`totalRows ${totalRows} < expected 2143`);
if (rowsWithReleaseDate < 2143) errors.push(`rowsWithReleaseDate ${rowsWithReleaseDate} < 2143`);
if (!releaseDateSourceDistribution['INFERRED_NEXT_MONTH_10TH']) {
  errors.push('No rows with releaseDateSource=INFERRED_NEXT_MONTH_10TH');
}
if (invalidReleaseDateCount > 0) errors.push(`invalidReleaseDateCount=${invalidReleaseDateCount} (expected 0)`);
if (rowsWithoutReleaseDate > 0) warnings.push(`rowsWithoutReleaseDate=${rowsWithoutReleaseDate}`);
if (duplicateCount > 0) warnings.push(`duplicateCount=${duplicateCount} (stockId+year+month duplicates)`);

const validationStatus = errors.length === 0 ? 'PASS' : 'FAIL';
console.log('');
console.log('validationStatus:', validationStatus);
if (errors.length) console.log('errors:', errors);
if (warnings.length) console.log('warnings:', warnings);

// ── Output ───────────────────────────────────────────────────────────────

const result = {
  phase: 'P25-HARDRESET',
  part: 'C',
  generatedAt: NOW,
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.',
  validationStatus,
  totalRows,
  rowsWithReleaseDate,
  rowsWithoutReleaseDate,
  invalidReleaseDateCount,
  duplicateStockIdYearMonthCount: duplicateCount,
  releaseDateSourceDistribution,
  releaseDateConfidenceDistribution,
  minReleaseDate: minReleaseDate || null,
  maxReleaseDate: maxReleaseDate || null,
  sampleInferredRows,
  sampleDecemberRows,
  sampleMarchRows,
  errors,
  warnings,
  productionDbWritten: false,
  corpusModified: false,
  scoringFormulaModified: false,
};

const jsonPath = path.join(OUT_DIR, 'p25monthly_revenue_distribution_audit.json');
fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
console.log('Written:', jsonPath);

const md = `# P25 MonthlyRevenue Distribution Audit

**Phase:** P25-HARDRESET Part C  
**Generated:** ${NOW}  
**Validation Status:** \`${validationStatus}\`

## Summary

| Metric | Value |
|--------|-------|
| Total rows | ${totalRows} |
| Rows with releaseDate | ${rowsWithReleaseDate} |
| Rows without releaseDate | ${rowsWithoutReleaseDate} |
| Invalid releaseDate count | ${invalidReleaseDateCount} |
| Duplicate stockId/year/month | ${duplicateCount} |
| Min releaseDate | ${minReleaseDate || 'N/A'} |
| Max releaseDate | ${maxReleaseDate || 'N/A'} |

## releaseDateSource Distribution

${Object.entries(releaseDateSourceDistribution).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n')}

## releaseDateConfidence Distribution

${Object.entries(releaseDateConfidenceDistribution).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n')}

## Sample Inferred Rows

${sampleInferredRows.map(r => `- stockId=${r.stockId} year=${r.year} month=${r.month} releaseDate=${r.releaseDate} source=${r.releaseDateSource}`).join('\n') || 'None'}

## Errors

${errors.length ? errors.map(e => `- ❌ ${e}`).join('\n') : '✅ None'}

## Warnings

${warnings.length ? warnings.map(w => `- ⚠️ ${w}`).join('\n') : 'None'}

*Does not constitute investment advice. No ROI / win-rate / alpha / profit / outperform claims.*
`;

const mdPath = path.join(OUT_DIR, 'p25monthly_revenue_distribution_audit.md');
fs.writeFileSync(mdPath, md);
console.log('Written:', mdPath);
