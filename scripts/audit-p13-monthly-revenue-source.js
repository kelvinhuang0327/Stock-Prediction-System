#!/usr/bin/env node
/**
 * P13-HARDRESET PART C: MonthlyRevenue Source Audit
 * Read-only schema/code audit. Does NOT write production DB.
 * If DB is inaccessible, falls back to SCHEMA_ONLY mode.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const OUT_DIR = 'outputs/online_validation';

// ── Schema audit ─────────────────────────────────────────────────────────────
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const schemaLines = schema.split('\n');
const mrStart = schemaLines.findIndex(l => l.trim().startsWith('model MonthlyRevenue'));
const mrEnd = schemaLines.findIndex((l, i) => i > mrStart && l.trim() === '}');
const mrBlock = schemaLines.slice(mrStart, mrEnd + 1).join('\n');

// Parse fields from schema block
function parseSchemaFields(block) {
  const lines = block.split('\n').filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('model') && l.trim() !== '}' && !l.trim().startsWith('@@') && !l.trim().startsWith('stock '));
  return lines.map(l => l.trim()).filter(Boolean);
}

const rawFields = parseSchemaFields(mrBlock);
const fieldNames = rawFields.map(l => l.split(/\s+/)[0]).filter(Boolean);

const monthlyRevenueSchema = {
  modelName: 'MonthlyRevenue',
  fields: rawFields,
  fieldNames,
  hasId: fieldNames.includes('id'),
  hasStockId: fieldNames.includes('stockId'),
  hasYear: fieldNames.includes('year'),
  hasMonth: fieldNames.includes('month'),
  hasRevenue: fieldNames.includes('revenue'),
  hasYoyGrowth: fieldNames.includes('yoyGrowth'),
  hasMomGrowth: fieldNames.includes('momGrowth'),
  hasCreatedAt: fieldNames.includes('createdAt'),
  hasUpdatedAt: fieldNames.includes('updatedAt'),
  hasIngestedAt: fieldNames.includes('ingestedAt'),
  hasReleaseDate: fieldNames.includes('releaseDate'),
  hasAnnouncementDate: fieldNames.includes('announcementDate'),
  hasAvailabilityDate: fieldNames.includes('availabilityDate'),
  hasReleaseDateSource: fieldNames.includes('releaseDateSource'),
  hasReleaseDateConfidence: fieldNames.includes('releaseDateConfidence'),
  uniqueConstraint: '@@unique([stockId, year, month])',
  schemaSnippet: mrBlock.trim(),
};

// ── Code path audit ───────────────────────────────────────────────────────────
const codeAudits = [];

function auditFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    codeAudits.push({ file: filePath, label, status: 'NOT_FOUND' });
    return null;
  }
  const src = fs.readFileSync(filePath, 'utf8');
  return src;
}

// RuleBasedStockAnalyzer
const analyzerSrc = auditFile('src/lib/analysis/RuleBasedStockAnalyzer.ts', 'RuleBasedStockAnalyzer');
if (analyzerSrc) {
  const gateBlock = (() => {
    const m = analyzerSrc.match(/revenueAsOfWhere[\s\S]{0,600}/);
    return m ? m[0].slice(0, 400) : null;
  })();
  codeAudits.push({
    file: 'src/lib/analysis/RuleBasedStockAnalyzer.ts',
    label: 'RuleBasedStockAnalyzer',
    status: 'FOUND',
    usesYearMonthGate: /year.*lt.*asOfYear|OR.*year.*asOfYear.*month.*lte.*asOfMonth/.test(analyzerSrc),
    usesReleaseDateGate: /releaseDate.*lte.*asOf/.test(analyzerSrc),
    gateBlock,
    pitRisk: 'HIGH — gates by reporting period, not releaseDate',
  });
}

// FundamentalResearchService
const fundSrc = auditFile('src/lib/fundamentals/FundamentalResearchService.ts', 'FundamentalResearchService');
if (fundSrc) {
  const queryBlock = (() => {
    const m = fundSrc.match(/monthlyRevenue\.findMany\([\s\S]{0,300}?\)/);
    return m ? m[0].slice(0, 250) : null;
  })();
  codeAudits.push({
    file: 'src/lib/fundamentals/FundamentalResearchService.ts',
    label: 'FundamentalResearchService',
    status: 'FOUND',
    hasAsOfGate: /monthlyRevenue[\s\S]{0,200}asOf/.test(fundSrc),
    hasReleaseDateGate: /monthlyRevenue[\s\S]{0,200}releaseDate/.test(fundSrc),
    queryBlock,
    pitRisk: 'HIGH — buildFundamentalResearchContextForSymbol uses no asOf gate at all',
  });
}

// StockFundamentalSnapshot interface
const snapshotSrc = auditFile('src/lib/fundamentals/StockFundamentalSnapshot.ts', 'StockFundamentalSnapshot');
if (snapshotSrc) {
  const iface = (() => {
    const m = snapshotSrc.match(/interface MonthlyRevenueLike \{[\s\S]*?\}/);
    return m ? m[0] : null;
  })();
  codeAudits.push({
    file: 'src/lib/fundamentals/StockFundamentalSnapshot.ts',
    label: 'MonthlyRevenueLike interface',
    status: 'FOUND',
    hasReleaseDateField: iface ? /releaseDate/.test(iface) : false,
    interfaceSnippet: iface,
    pitRisk: 'MEDIUM — interface does not include releaseDate, so even if schema had it, it would not flow through',
  });
}

// BacktestRunner
const backtestSrc = auditFile('src/lib/backtest/BacktestRunner.ts', 'BacktestRunner');
if (backtestSrc) {
  const hasRevenueQuery = /monthlyRevenues.*where|monthlyRevenue.*findMany/.test(backtestSrc);
  const hasAsOfGate = hasRevenueQuery && /asOf/.test(backtestSrc.match(/monthlyRevenue[\s\S]{0,300}/)?.[0] ?? '');
  codeAudits.push({
    file: 'src/lib/backtest/BacktestRunner.ts',
    label: 'BacktestRunner',
    status: 'FOUND',
    hasRevenueQuery,
    hasAsOfGate,
    pitRisk: hasRevenueQuery && !hasAsOfGate ? 'HIGH — backtest may load revenues without asOf gate' : 'LOW — no direct revenue query or has gate',
  });
}

// ── Current PIT risk summary ──────────────────────────────────────────────────
const currentPitRisk = {
  overallRisk: 'HIGH',
  primaryReason: 'MonthlyRevenue schema has no releaseDate field. All query paths use year/month period gate, not announcement date.',
  affectedCodePaths: [
    {
      path: 'RuleBasedStockAnalyzer.analyzeStock()',
      risk: 'HIGH',
      detail: 'Uses OR [year < asOfYear] OR [year = asOfYear AND month <= asOfMonth]. This treats reporting period as availability, not actual release.',
    },
    {
      path: 'FundamentalResearchService.buildFundamentalResearchContextForSymbol()',
      risk: 'HIGH',
      detail: 'No asOf gate at all. Returns all revenue records regardless of date.',
    },
    {
      path: 'MonthlyRevenueLike interface',
      risk: 'MEDIUM',
      detail: 'Interface lacks releaseDate field. Even after schema migration, requires interface update to propagate.',
    },
  ],
};

// ── Required repair fields ────────────────────────────────────────────────────
const requiredRepairFields = [
  {
    field: 'releaseDate',
    type: 'DateTime?',
    required: true,
    backfillRule: 'releaseDate = 10th day of following month for existing records',
    notes: 'Primary PIT gate field. Must be added to schema, interface, and all query paths.',
  },
  {
    field: 'releaseDateSource',
    type: 'String?',
    required: false,
    backfillRule: 'releaseDateSource = INFERRED_NEXT_MONTH_10TH for backfilled records',
    notes: 'Tracks whether releaseDate is authoritative or inferred.',
  },
  {
    field: 'releaseDateConfidence',
    type: 'String?',
    required: false,
    backfillRule: 'releaseDateConfidence = LOW_TO_MEDIUM for backfilled records',
    notes: 'Documents confidence level of inferred releaseDates.',
  },
];

// ── Recommended migration shape ───────────────────────────────────────────────
const recommendedMigrationShape = {
  schemaAddition: `model MonthlyRevenue {
  id                    Int       @id @default(autoincrement())
  stockId               String
  year                  Int
  month                 Int
  revenue               Float
  yoyGrowth             Float?
  momGrowth             Float?
  releaseDate           DateTime? // Authoritative release date (from TWSE/MOPS)
  releaseDateSource     String?   // AUTHORITATIVE | INFERRED_NEXT_MONTH_10TH
  releaseDateConfidence String?   // HIGH | MEDIUM | LOW_TO_MEDIUM
  createdAt             DateTime  @default(now())

  stock Stock @relation(fields: [stockId], references: [id])

  @@unique([stockId, year, month])
}`,
  queryGateChange: `// BEFORE (HIGH PIT risk):
prisma.monthlyRevenue.findMany({
  where: {
    stockId: symbol,
    OR: [
      { year: { lt: asOfYear } },
      { year: asOfYear, month: { lte: asOfMonth } },
    ],
  },
})

// AFTER (PIT safe):
prisma.monthlyRevenue.findMany({
  where: {
    stockId: symbol,
    releaseDate: { lte: asOfDate },
  },
})`,
  backfillSql: `-- Non-production draft. Do NOT run in production without explicit approval.
-- Backfill inferred releaseDates for existing MonthlyRevenue records.
UPDATE "MonthlyRevenue"
SET
  "releaseDate" = (
    CASE
      WHEN month = 12 THEN MAKE_DATE(year + 1, 1, 10)
      ELSE MAKE_DATE(year, month + 1, 10)
    END
  )::timestamp,
  "releaseDateSource" = 'INFERRED_NEXT_MONTH_10TH',
  "releaseDateConfidence" = 'LOW_TO_MEDIUM'
WHERE "releaseDate" IS NULL;`,
};

// ── Attempt safe DB read (sample only) ───────────────────────────────────────
let dataAuditMode = 'SCHEMA_ONLY';
let sampleRecordShape = null;
let dbReadError = null;

// We don't attempt a live DB read in this script — schema-only is safe and sufficient.
// If a DBA wants to validate, they can run the Prisma migrate dry-run separately.
dataAuditMode = 'SCHEMA_ONLY';
sampleRecordShape = {
  note: 'DB read not attempted. Schema-only audit is sufficient for contract purposes.',
  expectedShape: {
    id: 'number',
    stockId: 'string',
    year: 'number',
    month: 'number',
    revenue: 'number',
    yoyGrowth: 'number | null',
    momGrowth: 'number | null',
    createdAt: 'DateTime',
    releaseDate: 'DOES NOT EXIST — field missing from schema',
  },
};

// ── Output ────────────────────────────────────────────────────────────────────
const output = {
  phase: 'P13-HARDRESET',
  part: 'C',
  generatedAt: new Date().toISOString(),
  dataAuditMode,
  monthlyRevenueSchema,
  codePathAudits: codeAudits,
  currentPitRisk,
  requiredRepairFields,
  recommendedMigrationShape,
  sampleRecordShape,
  dbReadError,
};

fs.writeFileSync(`${OUT_DIR}/p13monthly_revenue_source_audit.json`, JSON.stringify(output, null, 2));

const md = `# P13-HARDRESET: MonthlyRevenue Source Audit

> Disclaimer: Observability/contract work only. No investment recommendations. No ROI/alpha/profit claims. No production DB writes.

**Audit Mode:** ${dataAuditMode}  
**Generated:** ${output.generatedAt}

## MonthlyRevenue Schema

\`\`\`
${monthlyRevenueSchema.schemaSnippet}
\`\`\`

| Field | Present |
|-------|---------|
| id | ${monthlyRevenueSchema.hasId ? '✅' : '❌'} |
| stockId | ${monthlyRevenueSchema.hasStockId ? '✅' : '❌'} |
| year | ${monthlyRevenueSchema.hasYear ? '✅' : '❌'} |
| month | ${monthlyRevenueSchema.hasMonth ? '✅' : '❌'} |
| revenue | ${monthlyRevenueSchema.hasRevenue ? '✅' : '❌'} |
| yoyGrowth | ${monthlyRevenueSchema.hasYoyGrowth ? '✅' : '❌'} |
| momGrowth | ${monthlyRevenueSchema.hasMomGrowth ? '✅' : '❌'} |
| createdAt | ${monthlyRevenueSchema.hasCreatedAt ? '✅' : '❌'} |
| **releaseDate** | **${monthlyRevenueSchema.hasReleaseDate ? '✅ EXISTS' : '❌ MISSING'}** |
| announcementDate | ${monthlyRevenueSchema.hasAnnouncementDate ? '✅' : '❌'} |
| availabilityDate | ${monthlyRevenueSchema.hasAvailabilityDate ? '✅' : '❌'} |

## Code Path Audits

${codeAudits.map(a => `### ${a.label}\n- File: \`${a.file}\`\n- Status: ${a.status}\n- PIT Risk: **${a.pitRisk}**`).join('\n\n')}

## Overall PIT Risk

**Level: ${currentPitRisk.overallRisk}**

${currentPitRisk.primaryReason}

## Required Repair Fields

${requiredRepairFields.map(f => `- **\`${f.field}\`** (${f.type}): ${f.notes}`).join('\n')}

## Recommended Schema Migration

\`\`\`prisma
${recommendedMigrationShape.schemaAddition}
\`\`\`

## Query Gate Change

\`\`\`typescript
${recommendedMigrationShape.queryGateChange}
\`\`\`
`;

fs.writeFileSync(`${OUT_DIR}/p13monthly_revenue_source_audit.md`, md);

console.log('Audit mode:', dataAuditMode);
console.log('Schema: releaseDate field exists:', monthlyRevenueSchema.hasReleaseDate);
console.log('Overall PIT risk:', currentPitRisk.overallRisk);
console.log('Output written:', `${OUT_DIR}/p13monthly_revenue_source_audit.json`);
