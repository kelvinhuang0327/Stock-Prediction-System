'use strict';
const fs = require('fs');
const files = [
  'p18monthly_revenue_fixture_db_migration',
  'p18monthly_revenue_fixture_db_backfill',
  'p18monthly_revenue_fixture_db_query_gate',
  'p18monthly_revenue_fixture_db_rollback',
];
for (const f of files) {
  const d = JSON.parse(fs.readFileSync('outputs/online_validation/' + f + '.json', 'utf8'));
  const allTestsLen = Array.isArray(d.allTests) ? d.allTests.length : 'N/A';
  console.log(f, 'passCount=' + d.passCount, 'totalCount=' + d.totalCount, 'validationStatus=' + d.validationStatus, 'allTests_len=' + allTestsLen);
}
const p17v = JSON.parse(fs.readFileSync('outputs/online_validation/p17monthly_revenue_query_gate_validation.json', 'utf8'));
console.log('p17v validationStatus=' + p17v.validationStatus, 'passCount=' + p17v.passCount, 'failCount=' + p17v.failCount);
const p20c = JSON.parse(fs.readFileSync('outputs/online_validation/p20pit_impact_comparison.json', 'utf8'));
console.log('p20 bucketChangedCount=' + (p20c.bucketImpact && p20c.bucketImpact.bucketChangedCount));
console.log('p20 alignedRowCount=' + (p20c.corpusShapeComparison && p20c.corpusShapeComparison.alignedRowCount));
console.log('p20 snapshotImpact:', JSON.stringify(p20c.snapshotImpact));
const p19g = JSON.parse(fs.readFileSync('outputs/online_validation/p19monthly_revenue_pit_guard_validation.json', 'utf8'));
console.log('p19 pitGateStatusDistribution:', JSON.stringify(p19g.pitGateStatusDistribution));
