# P18-HARDRESET Final Report

> **DISCLAIMER**: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. Does not produce buy/sell/recommendation signals.

---

## 1. Phase Summary

**Phase**: P18-HARDRESET — MonthlyRevenue ReleaseDate Backfill Dry-Run with Local Fixture DB
**Date**: 2026-05-12
**Git Commit**: `33eec5b`
**Final Classification**: `P18_MONTHLY_REVENUE_FIXTURE_DB_DRY_RUN_COMPLETE`
**Production DB Written**: `false`
**Production Apply Allowed**: `false`

---

## 2. P17 Recap

P17-HARDRESET (commit `3d3803f` + `21f2556`) delivered:
- `MonthlyRevenueAvailability.ts` — PIT gate helper (6 exports)
- `RuleBasedStockAnalyzer.ts` — PIT filter added
- `FundamentalResearchService.ts` — PIT filter added
- `prisma/schema.prisma` — `releaseDate`/`releaseDateSource`/`releaseDateConfidence` added to MonthlyRevenue
- Migration DRAFT at `prisma/migrations/20260512000000_monthly_revenue_release_date_pit_draft/migration.sql`
- P17 validation: 18/18 PASS, tests 1670 PASS, artifact validation 30/30 PASS

---

## 3. Migration Results (PART C)

**Script**: `scripts/run-p18-monthly-revenue-fixture-db-migration.js`
**Artifact**: `outputs/online_validation/p18monthly_revenue_fixture_db_migration.json`
**Result**: ✅ PASS — 16/16 gates

Key validations:
- Fixture DB created fresh at `outputs/online_validation/fixture_db/p18_monthly_revenue_fixture.sqlite`
- Pre-migration schema seeded WITHOUT releaseDate columns
- Migration SQL applied (comment-line stripping fix applied)
- Post-migration: `releaseDate`/`releaseDateSource`/`releaseDateConfidence` present
- Original columns preserved, 3 rows survive with NULL releaseDate

---

## 4. Backfill Results (PART D)

**Script**: `scripts/run-p18-monthly-revenue-fixture-db-backfill.js`
**Artifact**: `outputs/online_validation/p18monthly_revenue_fixture_db_backfill.json`
**Result**: ✅ PASS — 23/23 gates

10 fixture scenarios tested:

| Scenario | Description | Action |
|----------|-------------|--------|
| s1 | 2330/2024-01, no releaseDate → inferred 2024-02-10 | INFERRED ✅ |
| s2 | 2330/2024-12, no releaseDate → inferred 2025-01-10 (Dec→Jan) | INFERRED ✅ |
| s3 | 2454/2024-03, explicit 2024-04-15 (EXPLICIT) | PRESERVED ✅ |
| s4 | missing year → inferRelease(null,1)=null | SKIPPED ✅ |
| s5 | missing month → inferRelease(2024,null)=null | SKIPPED ✅ |
| s6 | invalid month 13 → null | SKIPPED ✅ |
| s7 | duplicate s1 → INSERT OR IGNORE → 6 distinct rows | IGNORED ✅ |
| s8 | 6505/2026-06, no releaseDate → inferred 2026-07-10 | INFERRED ✅ |
| s9 | outcomePrice/returnPct/realizedReturnClass NOT persisted | SAFE ✅ |
| s10 | 1101/2024-02, already INFERRED → preserved 2024-03-10 | PRESERVED ✅ |

---

## 5. Query Gate Results (PART E)

**Script**: `scripts/run-p18-monthly-revenue-fixture-db-query-gate-validation.js`
**Artifact**: `outputs/online_validation/p18monthly_revenue_fixture_db_query_gate.json`
**Result**: ✅ PASS — 22/22 gates

PIT gate logic validated: `releaseDate.slice(0,10) <= asOfDate.slice(0,10)` → available

| Scenario | Description | Result |
|----------|-------------|--------|
| S1 | 2024-01 before/on/after releaseDate=2024-02-10 | ✅ |
| S2 | 2024-12 before/on releaseDate=2025-01-10 | ✅ |
| S3 | Explicit releaseDate preserved and used | ✅ |
| S4 | allowInferredReleaseDate=false → unavailable | ✅ |
| S5 | No rows available as of 2024-01-01 | ✅ |
| S6 | Multiple rows available as of 2025-02-01 | ✅ |
| S7 | P17 query gate consistency (ALL_PASS) | ✅ |
| S8 | No forbidden outcome fields in DB | ✅ |

---

## 6. Rollback Results (PART F)

**Script**: `scripts/run-p18-monthly-revenue-fixture-db-rollback.js`
**Artifact**: `outputs/online_validation/p18monthly_revenue_fixture_db_rollback.json`
**Result**: ✅ PASS — 27/27 gates

- Rollback via table recreation (SQLite-compatible)
- `releaseDate`/`releaseDateSource`/`releaseDateConfidence` removed ✅
- Original columns (`id`, `stockId`, `year`, `month`, `revenue`, `yoyGrowth`, `momGrowth`) preserved ✅
- Row data intact after rollback ✅
- Re-migration possible after rollback ✅

---

## 7. Production DB Proof

- `productionApplyAllowed: false` in all artifacts
- `productionDbWritten: false` in all artifacts
- Fixture DB isolated at `outputs/online_validation/fixture_db/`
- `validateFixtureDbIsolation` rejects production URLs and non-fixture paths
- `prisma migrate deploy` to production DB: **NOT EXECUTED**

---

## 8. No Model Adjustment

- Scoring formula: **UNCHANGED**
- `alphaScore`: **UNCHANGED**
- `recommendationBucket`: **UNCHANGED**
- No P0/P1/P3/P4 corpus modifications
- Frozen corpus line counts verified in PART A preflight

---

## 9. File List (17 files committed)

| File | Type |
|------|------|
| `src/lib/onlineValidation/P18MonthlyRevenueFixtureDbUtils.ts` | New TypeScript utility |
| `src/lib/onlineValidation/__tests__/p18monthly_revenue_fixture_db_utils.test.ts` | New test (69 tests) |
| `scripts/run-p18-monthly-revenue-fixture-db-migration.js` | New script |
| `scripts/run-p18-monthly-revenue-fixture-db-backfill.js` | New script |
| `scripts/run-p18-monthly-revenue-fixture-db-query-gate-validation.js` | New script |
| `scripts/run-p18-monthly-revenue-fixture-db-rollback.js` | New script |
| `outputs/online_validation/p18monthly_revenue_fixture_db_preflight.json` | Artifact |
| `outputs/online_validation/p18monthly_revenue_fixture_db_preflight.md` | Artifact |
| `outputs/online_validation/p18monthly_revenue_fixture_db_migration.json` | Artifact |
| `outputs/online_validation/p18monthly_revenue_fixture_db_migration.md` | Artifact |
| `outputs/online_validation/p18monthly_revenue_fixture_db_backfill.json` | Artifact |
| `outputs/online_validation/p18monthly_revenue_fixture_db_backfill.md` | Artifact |
| `outputs/online_validation/p18monthly_revenue_fixture_db_query_gate.json` | Artifact |
| `outputs/online_validation/p18monthly_revenue_fixture_db_query_gate.md` | Artifact |
| `outputs/online_validation/p18monthly_revenue_fixture_db_rollback.json` | Artifact |
| `outputs/online_validation/p18monthly_revenue_fixture_db_rollback.md` | Artifact |
| `outputs/online_validation/fixture_db/p18_monthly_revenue_fixture.sqlite` | SQLite fixture DB |

---

## 10. Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| P18 fixture DB utils | 69 | ✅ PASS |
| onlineValidation/__tests__ | 1562 | ✅ PASS |
| data/__tests__ | 118 | ✅ PASS |
| **Total** | **1749** | **✅ PASS** |

---

## 11. TypeScript Validation

```
npx tsc --noEmit
```

Only pre-existing errors in `src/app/api/admin/data-quality/route.ts` (lines 174, 181) — TS1128/TS1005.
These pre-existed before P18 and are unrelated to P18 files. **No new TS errors.**

---

## 12. Forbidden Claims Scan

Scanned: all P18 TypeScript/JS source files + all P18 JSON/MD artifacts.

**Result: CLEAN**

Exempted (correctly): disclaimer lines, `alphaScore` field references, `does not compute` lines, `scanForbiddenClaims` code patterns, `FORBIDDEN_CLAIM` constant definitions.

---

## 13. Frozen Corpus Verification

| Corpus | Status |
|--------|--------|
| P0 frozen corpus (`gbgf/__init__.py`) | ✅ UNCHANGED |
| Prisma schema (P17 patch only) | ✅ UNCHANGED since P17 |
| Scoring formula | ✅ UNCHANGED |
| alphaScore | ✅ UNCHANGED |
| recommendationBucket | ✅ UNCHANGED |

---

## 14. CEO Axis Contributions

| Axis | Contribution |
|------|-------------|
| A: Fixture DB proves PIT-safe execution | Demonstrated migration + backfill + rollback on isolated fixture DB without touching production |
| B: Reduces leakage risk | Taiwan 10th-of-month PIT gate validated end-to-end with 22 boundary checks |

---

## 15. Risks

| Risk | Mitigation |
|------|-----------|
| Production migration not yet applied | `productionApplyAllowed=false`; P21 approval review required before production apply |
| Backfill relies on inferred dates (LOW_TO_MEDIUM confidence) | Explicit dates from authoritative source should override in production |
| SQLite fixture differs from production Prisma schema | Fixture schema validated against migration SQL; production apply is separate step |

---

## 16. Next Phases

| Phase | Description |
|-------|-------------|
| P19 | Active Scoring Corpus Regeneration after MonthlyRevenue PIT Gate Patch |
| P20 | Compare pre/post PIT MonthlyRevenue availability impact |
| P21 | Production migration approval review (if production DB required) |

---

## 17. Final Classification

```
P18_MONTHLY_REVENUE_FIXTURE_DB_DRY_RUN_COMPLETE
```

**Commit**: `33eec5b`
**PARTS**: A ✅ B ✅ C ✅ D ✅ E ✅ F ✅ G ✅ H ✅ I ✅ J ✅ K ✅
**Gate total**: 16+23+22+27+69 = **157 validation gates, 0 failures**
