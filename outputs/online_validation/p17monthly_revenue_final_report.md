# P17-HARDRESET: MonthlyRevenue releaseDate Schema and Query Gate Patch — Final Report

> **DISCLAIMER**: This report describes software engineering changes to a data filtering system. It does not constitute investment advice, ROI projections, or alpha claims of any kind.

---

## 1. Phase Summary

**Phase:** P17-HARDRESET  
**Classification:** `P17_MONTHLY_REVENUE_SCHEMA_QUERY_GATE_PATCH_COMPLETE`  
**Commit:** `3d3803f7e37cc525b5cbec9c8135c29a25dd7dbe`  
**Date:** 2026-05-12  
**Files changed:** 17 (1849 insertions, 16 deletions)

---

## 2. Approval Token

| Token | Status |
|-------|--------|
| `P17_APPROVE_SCHEMA_AND_QUERY_GATE_PATCH_ONLY` | ✅ VERIFIED PRESENT |

---

## 3. Production Safety

| Safety Check | Result |
|---|---|
| `productionApplyAllowed` | `false` (all artifacts) |
| `prisma migrate deploy` executed | ❌ NEVER |
| Production DB writes | ❌ NONE |
| Migration status | DRAFT only — not applied |

---

## 4. Frozen Corpus Verification (PART A)

| Corpus | Expected Lines | Status |
|--------|---------------|--------|
| `simulation_snapshot_corpus.jsonl` | 60 | ✅ FROZEN |
| `p0hardreset_historical_replay_corpus.jsonl` | 4500 | ✅ FROZEN |
| `p1baseline_historical_replay_corpus.jsonl` | 9900 | ✅ FROZEN |
| `p3active_scoring_historical_replay_corpus.jsonl` | 4500 | ✅ FROZEN |

---

## 5. Schema Changes (PART C)

**Model:** `MonthlyRevenue` in `prisma/schema.prisma`

**3 new optional fields added:**
```prisma
releaseDate           DateTime? // P17: PIT gate — date revenue was publicly released
releaseDateSource     String?   // P17: e.g. INFERRED_NEXT_MONTH_10TH or EXPLICIT
releaseDateConfidence String?   // P17: e.g. LOW_TO_MEDIUM or HIGH
```

**Frozen fields (unchanged):** `id, stockId, year, month, revenue, yoyGrowth, momGrowth, createdAt`  
**Frozen constraints (unchanged):** `@@unique([stockId, year, month])`

---

## 6. Migration Draft

**File:** `prisma/migrations/20260512000000_monthly_revenue_release_date_pit_draft/migration.sql`  
**Status:** DRAFT — not applied to production  
**Content:**
```sql
-- DRAFT: Not applied to production DB. Requires prisma migrate deploy approval.
ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDate" DATETIME;
ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDateSource" TEXT;
ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDateConfidence" TEXT;
```

---

## 7. Code Patches (PART D)

### 7a. `src/lib/onlineValidation/MonthlyRevenueAvailability.ts` (NEW)

6 exports implementing Taiwan Revenue PIT gate:
- `inferMonthlyRevenueReleaseDate` — Taiwan 10th-of-next-month rule (Dec → Jan 10th of year+1)
- `normalizeMonthlyRevenueReleaseDate` — coerce Date/string to YYYY-MM-DD
- `isMonthlyRevenueAvailableAsOf` — core PIT gate returning `MonthlyRevenueAvailabilityResult`
- `filterMonthlyRevenueAvailableAsOf` — filter array using PIT gate
- `validateMonthlyRevenueAvailabilityResult` — validates required fields
- `explainMonthlyRevenueAvailability` — returns rule + details

Constants: `TAIWAN_REVENUE_RELEASE_DAY=10`, `INFERRED_RELEASE_DATE_SOURCE='INFERRED_NEXT_MONTH_10TH'`, `INFERRED_RELEASE_DATE_CONFIDENCE='LOW_TO_MEDIUM'`

### 7b. `src/lib/analysis/RuleBasedStockAnalyzer.ts` (PATCHED)

Changes:
1. Import: `filterMonthlyRevenueAvailableAsOf`
2. PIT filter applied after fetch: `revenues → revenuesPIT` (with `allowInferredReleaseDate: true`)
3. Revenue YoY section uses `revenuesPIT` instead of `revenues`
4. **Scoring formula unchanged**: `clamp(50 + revenueYoY, 0, 100)`
5. **alphaScore / recommendationBucket: unchanged**

### 7c. `src/lib/fundamentals/FundamentalResearchService.ts` (PATCHED)

Changes:
1. Import: `filterMonthlyRevenueAvailableAsOf`
2. `buildFundamentalResearchContextForSymbol` accepts optional `asOf?: string`
3. Fetch renamed `monthlyRevenuesRaw` → filtered to `monthlyRevenues` via PIT gate

### 7d. `src/lib/fundamentals/StockFundamentalSnapshot.ts` (PATCHED)

`MonthlyRevenueLike` interface extended with optional PIT gate fields:
- `releaseDate?: string | Date | null`
- `releaseDateSource?: string | null`
- `releaseDateConfidence?: string | null`

---

## 8. Validation Results (PART E)

**Script:** `scripts/validate-p17-monthly-revenue-query-gate-patch.js`  
**Result:** 18/18 PASS

| Group | Pass |
|-------|------|
| SC1–SC10: Scenario tests | 10/10 |
| SG1–SG8: Safety gate tests | 8/8 |

---

## 9. Test Results (PART F)

| Suite | Tests | Result |
|-------|-------|--------|
| `p17monthly_revenue_availability.test.ts` | 59 | ✅ ALL PASS |
| `src/lib/onlineValidation/__tests__` (full) | 1493 | ✅ ALL PASS |
| `src/lib/data/__tests__` (full) | 118 | ✅ ALL PASS |
| **Total** | **1670** | ✅ |

TypeScript (`npx tsc --noEmit`): Pre-existing errors in `src/app/api/admin/data-quality/route.ts` lines 174/181 — **unrelated to P17 changes**, present before this phase.

---

## 10. Forbidden Claims Scan (PART G)

Scanned files: all P17 artifacts, helper, tests, validation script, migration SQL

| Term | Hits | Verdict |
|------|------|---------|
| `alpha` | 8 hits | ✅ All are `alphaScore: unchanged` / `alphaScoreChanged: false` — label references, not claims |
| All other terms (ROI, win-rate, profit, buy, sell, guaranteed, etc.) | 0 | ✅ CLEAN |

**Result: CLEAN — No forbidden investment claims**

---

## 11. Artifact Validation (PART H)

**Script:** `scripts/run-p17-artifact-validation.js`  
**Result:** 30/30 PASS

Key checks passed:
- All 4 P17 JSON artifacts parse correctly
- All 4 P17 markdown artifacts exist
- `schema.productionApplyAllowed === false`
- `schema.addedFields.length >= 3` (releaseDate, releaseDateSource, releaseDateConfidence)
- `patch.productionApplyAllowed === false`
- `patch.patchStatus === 'APPLIED'`
- `patch.usedForbiddenOutcomeFields === false`
- `validation.validationStatus === 'ALL_PASS'`
- Migration draft SQL exists and marked DRAFT
- All 5 P16 artifacts preserved

---

## 12. Git Commit

```
commit 3d3803f7e37cc525b5cbec9c8135c29a25dd7dbe
P17-HARDRESET: MonthlyRevenue releaseDate schema and query gate patch

- New: MonthlyRevenue availability helper
- Patch: Prisma MonthlyRevenue releaseDate fields
- Patch: MonthlyRevenue query gate uses releaseDate <= asOfDate
- New: query gate validation
- Frozen: P0/P1/P3/P4/frozen corpus unchanged
- Frozen: scoring formula / alphaScore / recommendationBucket unchanged
- No production DB writes
- productionApplyAllowed=false
- No ROI / alpha / edge / win-rate claims
```

17 files changed, 1849 insertions(+), 16 deletions(-)

---

## 13. Final Classification

```
P17_MONTHLY_REVENUE_SCHEMA_QUERY_GATE_PATCH_COMPLETE
```

---

## 14. Next Phases

| Phase | Description |
|-------|-------------|
| P18 | MonthlyRevenue ReleaseDate Backfill Dry-Run with Local Fixture DB |
| P19 | Active Scoring Corpus Regeneration after PIT Gate Patch |
| P20 | Compare pre/post PIT MonthlyRevenue availability impact |
