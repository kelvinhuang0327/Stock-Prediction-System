# P18 Fixture DB Rollback Validation — PASS

> **DISCLAIMER**: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.

## Result: PASS (27/27)

| Gate | Status |
|------|--------|
| RB-SG1: Fixture DB exists | ✅ PASS |
| RB-1: Pre-rollback has releaseDate | ✅ PASS |
| RB-2: Pre-rollback has releaseDateSource | ✅ PASS |
| RB-3: Pre-rollback has releaseDateConfidence | ✅ PASS |
| RB-4: Pre-rollback row count >= 6 | ✅ PASS |
| RB-5: Rollback SQL executed without error | ✅ PASS |
| RB-6: releaseDate removed after rollback | ✅ PASS |
| RB-7: releaseDateSource removed after rollback | ✅ PASS |
| RB-8: releaseDateConfidence removed after rollback | ✅ PASS |
| RB-9-id: Original column 'id' preserved | ✅ PASS |
| RB-9-stockId: Original column 'stockId' preserved | ✅ PASS |
| RB-9-year: Original column 'year' preserved | ✅ PASS |
| RB-9-month: Original column 'month' preserved | ✅ PASS |
| RB-9-revenue: Original column 'revenue' preserved | ✅ PASS |
| RB-9-yoyGrowth: Original column 'yoyGrowth' preserved | ✅ PASS |
| RB-9-momGrowth: Original column 'momGrowth' preserved | ✅ PASS |
| RB-10: Row count preserved after rollback | ✅ PASS |
| RB-11: s1 row data preserved (revenue=10000) | ✅ PASS |
| RB-11b: s1 has no releaseDate field | ✅ PASS |
| RB-12: s3 row data preserved (revenue=5000) | ✅ PASS |
| RB-12b: s3 has no releaseDateSource field | ✅ PASS |
| RB-Safety: rollback affected fixture DB only | ✅ PASS |
| RB-Safety: productionDbWritten=false | ✅ PASS |
| RB-Safety: productionApplyAllowed=false | ✅ PASS |
| RB-13: Post-rollback re-migration restores releaseDate | ✅ PASS |
| RB-14: Post-rollback re-migration restores releaseDateSource | ✅ PASS |
| RB-15: Post-rollback re-migration restores releaseDateConfidence | ✅ PASS |

## Schema Verification

**Pre-rollback columns:** `id, stockId, year, month, revenue, yoyGrowth, momGrowth, createdAt, releaseDate, releaseDateSource, releaseDateConfidence`

**Post-rollback columns:** `id, stockId, year, month, revenue, yoyGrowth, momGrowth, createdAt`

**Post-re-migration columns:** `id, stockId, year, month, revenue, yoyGrowth, momGrowth, createdAt, releaseDate, releaseDateSource, releaseDateConfidence`

## Data Integrity

| Metric | Value |
|--------|-------|
| Rows before rollback | 6 |
| Rows after rollback | 6 |
| Data preserved | ✅ |

## Safety

- `productionApplyAllowed`: `false`
- `productionDbWritten`: `false`
- Rollback affected fixture DB only
- Re-migration possible after rollback ✅
