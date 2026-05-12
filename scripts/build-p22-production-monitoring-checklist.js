'use strict';
/**
 * P22-HARDRESET Part E
 * Build Production Monitoring / Validation Checklist
 *
 * Outputs: p22production_monitoring_checklist.json + .md
 *
 * Must include all 13 required checklist items per spec.
 */

const fs = require('fs');
const path = require('path');
const NOW = new Date().toISOString();
const OUT = 'outputs/online_validation';

const checklistItems = [
  {
    itemId: 'MON-01',
    label: 'MonthlyRevenue releaseDate field exists post-migration',
    category: 'schema',
    mandatory: true,
    validationQuery: 'PRAGMA table_info(MonthlyRevenue) — releaseDate column must be present',
    expectedResult: 'Column releaseDate present with type DateTime (nullable)',
  },
  {
    itemId: 'MON-02',
    label: 'releaseDateSource field exists post-migration',
    category: 'schema',
    mandatory: true,
    validationQuery: 'PRAGMA table_info(MonthlyRevenue) — releaseDateSource column must be present',
    expectedResult: 'Column releaseDateSource present with type String (nullable)',
  },
  {
    itemId: 'MON-03',
    label: 'releaseDateConfidence field exists post-migration',
    category: 'schema',
    mandatory: true,
    validationQuery: 'PRAGMA table_info(MonthlyRevenue) — releaseDateConfidence column must be present',
    expectedResult: 'Column releaseDateConfidence present with type String (nullable)',
  },
  {
    itemId: 'MON-04',
    label: 'Records with missing releaseDate counted and tracked',
    category: 'data-quality',
    mandatory: true,
    validationQuery: 'SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NULL',
    expectedResult: 'Count logged. Acceptable threshold: < 5% of total rows (or per ops policy)',
    monitoringSchedule: 'T+0, T+24h, T+7d',
  },
  {
    itemId: 'MON-05',
    label: 'INFERRED_NEXT_MONTH_10TH releaseDate rows counted',
    category: 'data-quality',
    mandatory: true,
    validationQuery: "SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDateSource = 'INFERRED_NEXT_MONTH_10TH'",
    expectedResult: 'Count logged and consistent with P18 backfill expectation',
  },
  {
    itemId: 'MON-06',
    label: 'Authoritative / EXPLICIT releaseDate rows counted',
    category: 'data-quality',
    mandatory: false,
    validationQuery: "SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDateSource = 'EXPLICIT'",
    expectedResult: 'Count logged',
  },
  {
    itemId: 'MON-07',
    label: 'Invalid releaseDate rows counted (future dates or null where mandatory)',
    category: 'data-quality',
    mandatory: true,
    validationQuery: 'SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate > CURRENT_DATE',
    expectedResult: 'Must be 0 — no future releaseDate values allowed',
  },
  {
    itemId: 'MON-08',
    label: 'Query gate smoke: releaseDate <= asOfDate sample validation',
    category: 'pit-guard',
    mandatory: true,
    validationQuery: 'Sample validation: for 100 random MonthlyRevenue rows, verify releaseDate <= asOfDate. Zero violations required.',
    expectedResult: 'leakageViolations = 0',
  },
  {
    itemId: 'MON-09',
    label: 'RuleBasedStockAnalyzer smoke validation (no error)',
    category: 'smoke',
    mandatory: true,
    expectedResult: 'Smoke test exits without error; no releaseDate-related exception',
  },
  {
    itemId: 'MON-10',
    label: 'FundamentalResearchService smoke validation (no error)',
    category: 'smoke',
    mandatory: true,
    expectedResult: 'Smoke test exits without error; releaseDate field accessible',
  },
  {
    itemId: 'MON-11',
    label: 'ActiveScoringSnapshot smoke validation (no error)',
    category: 'smoke',
    mandatory: true,
    expectedResult: 'Smoke test exits without error; PIT guard active and leakage-free',
  },
  {
    itemId: 'MON-12',
    label: 'Rollback readiness validation — backup file still accessible',
    category: 'rollback',
    mandatory: true,
    expectedResult: 'Backup file exists and checksum matches recorded value',
  },
  {
    itemId: 'MON-13',
    label: 'Post-migration no-leakage check — 0 rows with releaseDate > asOfDate',
    category: 'pit-guard',
    mandatory: true,
    validationQuery: 'SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate > asOfDate',
    expectedResult: 'Count must be 0 — PIT guard invariant',
  },
];

const artifact = {
  phase: 'P22',
  part: 'E',
  generatedAt: NOW,
  description: 'Production monitoring and post-migration validation checklist for MonthlyRevenue releaseDate migration',
  targetTable: 'MonthlyRevenue',
  checklistItems,
  totalItems: checklistItems.length,
  mandatoryItems: checklistItems.filter(i => i.mandatory).length,
  categorySummary: {
    schema: checklistItems.filter(i => i.category === 'schema').length,
    'data-quality': checklistItems.filter(i => i.category === 'data-quality').length,
    'pit-guard': checklistItems.filter(i => i.category === 'pit-guard').length,
    smoke: checklistItems.filter(i => i.category === 'smoke').length,
    rollback: checklistItems.filter(i => i.category === 'rollback').length,
  },
  includesQueryGateSmokeCheck: true,
  includesReleaseDateNullRateCheck: true,
  includesReleaseDateSchemaCheck: true,
  includesRollbackReadinessCheck: true,
  includesNoLeakageCheck: true,
  approvalGranted: false,
  productionMigrationApplied: false,
};

fs.writeFileSync(path.join(OUT, 'p22production_monitoring_checklist.json'), JSON.stringify(artifact, null, 2));

// ─── Markdown ─────────────────────────────────────────────────────────────────
const categoryOrder = ['schema', 'data-quality', 'pit-guard', 'smoke', 'rollback'];
const categorized = (cat) => checklistItems.filter(i => i.category === cat);

const md = `# P22-HARDRESET Part E — Production Monitoring / Validation Checklist

**Generated**: ${NOW}  
**Target Table**: MonthlyRevenue

## Summary

| | Count |
|-|-------|
| Total items | ${checklistItems.length} |
| Mandatory | ${checklistItems.filter(i => i.mandatory).length} |
| Optional | ${checklistItems.filter(i => !i.mandatory).length} |

${categoryOrder.map(cat => {
  const items = categorized(cat);
  if (!items.length) return '';
  return `## Category: ${cat.toUpperCase()}

| Item ID | Label | Mandatory | Expected Result |
|---------|-------|-----------|-----------------|
${items.map(i => `| ${i.itemId} | ${i.label} | ${i.mandatory ? 'YES' : 'No'} | ${i.expectedResult || '—'} |`).join('\n')}

${items.filter(i => i.validationQuery).map(i => `**${i.itemId} Query**: \`${i.validationQuery}\``).join('\n')}
`;
}).join('\n')}

## Key Invariants

| Invariant | Status |
|-----------|--------|
| Query gate smoke check included | YES (MON-08) |
| releaseDate null rate check included | YES (MON-04) |
| No-leakage check included | YES (MON-13) |
| Rollback readiness check included | YES (MON-12) |
| \`approvalGranted\` | false |
| \`productionMigrationApplied\` | false |
`;

fs.writeFileSync(path.join(OUT, 'p22production_monitoring_checklist.md'), md);

console.log('P22 Part E: monitoring checklist written');
console.log('  p22production_monitoring_checklist.json');
console.log('  p22production_monitoring_checklist.md');
console.log('  totalItems:', checklistItems.length);
console.log('  mandatoryItems:', checklistItems.filter(i => i.mandatory).length);
