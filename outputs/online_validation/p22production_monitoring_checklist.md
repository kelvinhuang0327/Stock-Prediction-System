# P22-HARDRESET Part E — Production Monitoring / Validation Checklist

**Generated**: 2026-05-12T06:21:38.110Z  
**Target Table**: MonthlyRevenue

## Summary

| | Count |
|-|-------|
| Total items | 13 |
| Mandatory | 12 |
| Optional | 1 |

## Category: SCHEMA

| Item ID | Label | Mandatory | Expected Result |
|---------|-------|-----------|-----------------|
| MON-01 | MonthlyRevenue releaseDate field exists post-migration | YES | Column releaseDate present with type DateTime (nullable) |
| MON-02 | releaseDateSource field exists post-migration | YES | Column releaseDateSource present with type String (nullable) |
| MON-03 | releaseDateConfidence field exists post-migration | YES | Column releaseDateConfidence present with type String (nullable) |

**MON-01 Query**: `PRAGMA table_info(MonthlyRevenue) — releaseDate column must be present`
**MON-02 Query**: `PRAGMA table_info(MonthlyRevenue) — releaseDateSource column must be present`
**MON-03 Query**: `PRAGMA table_info(MonthlyRevenue) — releaseDateConfidence column must be present`

## Category: DATA-QUALITY

| Item ID | Label | Mandatory | Expected Result |
|---------|-------|-----------|-----------------|
| MON-04 | Records with missing releaseDate counted and tracked | YES | Count logged. Acceptable threshold: < 5% of total rows (or per ops policy) |
| MON-05 | INFERRED_NEXT_MONTH_10TH releaseDate rows counted | YES | Count logged and consistent with P18 backfill expectation |
| MON-06 | Authoritative / EXPLICIT releaseDate rows counted | No | Count logged |
| MON-07 | Invalid releaseDate rows counted (future dates or null where mandatory) | YES | Must be 0 — no future releaseDate values allowed |

**MON-04 Query**: `SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NULL`
**MON-05 Query**: `SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDateSource = 'INFERRED_NEXT_MONTH_10TH'`
**MON-06 Query**: `SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDateSource = 'EXPLICIT'`
**MON-07 Query**: `SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate > CURRENT_DATE`

## Category: PIT-GUARD

| Item ID | Label | Mandatory | Expected Result |
|---------|-------|-----------|-----------------|
| MON-08 | Query gate smoke: releaseDate <= asOfDate sample validation | YES | leakageViolations = 0 |
| MON-13 | Post-migration no-leakage check — 0 rows with releaseDate > asOfDate | YES | Count must be 0 — PIT guard invariant |

**MON-08 Query**: `Sample validation: for 100 random MonthlyRevenue rows, verify releaseDate <= asOfDate. Zero violations required.`
**MON-13 Query**: `SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate > asOfDate`

## Category: SMOKE

| Item ID | Label | Mandatory | Expected Result |
|---------|-------|-----------|-----------------|
| MON-09 | RuleBasedStockAnalyzer smoke validation (no error) | YES | Smoke test exits without error; no releaseDate-related exception |
| MON-10 | FundamentalResearchService smoke validation (no error) | YES | Smoke test exits without error; releaseDate field accessible |
| MON-11 | ActiveScoringSnapshot smoke validation (no error) | YES | Smoke test exits without error; PIT guard active and leakage-free |



## Category: ROLLBACK

| Item ID | Label | Mandatory | Expected Result |
|---------|-------|-----------|-----------------|
| MON-12 | Rollback readiness validation — backup file still accessible | YES | Backup file exists and checksum matches recorded value |




## Key Invariants

| Invariant | Status |
|-----------|--------|
| Query gate smoke check included | YES (MON-08) |
| releaseDate null rate check included | YES (MON-04) |
| No-leakage check included | YES (MON-13) |
| Rollback readiness check included | YES (MON-12) |
| `approvalGranted` | false |
| `productionMigrationApplied` | false |
