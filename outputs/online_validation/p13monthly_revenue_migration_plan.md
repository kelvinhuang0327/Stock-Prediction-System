# P13-HARDRESET: MonthlyRevenue Non-Production Migration Plan

> **Disclaimer:** This is a non-production draft. No production DB is written. No investment recommendations. No ROI/win-rate/alpha/profit claims. Actual migration requires separate explicit approval.

**Plan ID:** p13-monthly-revenue-migration-plan-v0  
**Generated:** 2026-05-12  
**Production Safety:** DRAFT ONLY — approval NOT granted

---

## 1. Problem Statement

The `MonthlyRevenue` table has no `releaseDate` field. All query paths gate data availability by the **reporting period** (`year <= asOfYear AND month <= asOfMonth`), not the **actual announcement date**.

**Taiwan monthly revenue (月營收) is officially released by the 10th calendar day of the following month** (TWSE/MOPS regulation). Without a `releaseDate` field:

- A query with `asOfDate = 2026-02-05` would include January 2026 revenue data, even though it was not announced until February 10, 2026.
- This is a **HIGH PIT risk** — the scoring engine may inadvertently use future-knowledge data.

---

## 2. Proposed Schema Change

Add three nullable columns to the `MonthlyRevenue` model:

```prisma
model MonthlyRevenue {
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
}
```

**No fields removed. No constraints changed. Backward-compatible addition only.**

### SQL Migration Draft (non-production)

```sql
-- NON-PRODUCTION DRAFT. Do NOT run in production without explicit approval.
ALTER TABLE "MonthlyRevenue" ADD COLUMN IF NOT EXISTS "releaseDate" TIMESTAMP;
ALTER TABLE "MonthlyRevenue" ADD COLUMN IF NOT EXISTS "releaseDateSource" TEXT;
ALTER TABLE "MonthlyRevenue" ADD COLUMN IF NOT EXISTS "releaseDateConfidence" TEXT;
```

---

## 3. Backfill Rule

For all existing records where `releaseDate IS NULL`:

```
releaseDate = IF month = 12 THEN DATE(year+1, 1, 10)
              ELSE DATE(year, month+1, 10)
releaseDateSource     = 'INFERRED_NEXT_MONTH_10TH'
releaseDateConfidence = 'LOW_TO_MEDIUM'
```

This is the **Taiwan TWSE/MOPS convention**: monthly revenue announced by the 10th of the following month.

### Backfill SQL Draft (non-production)

```sql
-- NON-PRODUCTION DRAFT. Do NOT run in production without explicit approval.
UPDATE "MonthlyRevenue"
SET
  "releaseDate" = (
    CASE
      WHEN month = 12 THEN MAKE_DATE(year + 1, 1, 10)::timestamp
      ELSE MAKE_DATE(year, month + 1, 10)::timestamp
    END
  ),
  "releaseDateSource" = 'INFERRED_NEXT_MONTH_10TH',
  "releaseDateConfidence" = 'LOW_TO_MEDIUM'
WHERE "releaseDate" IS NULL;
```

### Forbidden Backfill Inputs

The following fields must **NEVER** be used to compute `releaseDate`:

- `outcomePrice`
- `returnPct`
- `realizedReturnClass`
- `outcomeDate`
- `horizonDays`
- `baselineResult`
- stock price data of any kind

---

## 4. Production DB Safety

This phase (P13) does **NOT** write any production database records.

- All artifacts are written to `outputs/online_validation/` only
- No Prisma migration is applied
- No `prisma migrate dev` or `prisma db push` is run
- Actual migration requires:
  1. Explicit written approval from authorized operator
  2. Staging environment validation
  3. Backfill validation (0 NULL releaseDates after backfill)
  4. Code path gate update verification

---

## 5. Validation Requirements

| ID | Requirement | Blocking |
|----|------------|---------|
| MR-VAL-001 | `releaseDate <= asOfDate` gate replaces year/month period gate in all paths | ✅ Yes |
| MR-VAL-002 | Inferred releaseDates labeled `releaseDateSource=INFERRED_NEXT_MONTH_10TH` | ✅ Yes |
| MR-VAL-003 | No realized-return tuning of releaseDate | ✅ Yes |
| MR-VAL-004 | No outcome leakage in releaseDate computation | ✅ Yes |
| MR-VAL-005 | `MonthlyRevenueLike` interface includes optional `releaseDate` | No |
| MR-VAL-006 | `FundamentalResearchService` receives asOf and gates by releaseDate | No |

---

## 6. Code Changes Required (P14)

| File | Change | Phase |
|------|--------|-------|
| `prisma/schema.prisma` | Add releaseDate, releaseDateSource, releaseDateConfidence | P14 |
| `StockFundamentalSnapshot.ts` | Add `releaseDate?: string \| null` to `MonthlyRevenueLike` | P14 |
| `RuleBasedStockAnalyzer.ts` | Replace year/month gate with `releaseDate: { lte: asOfDate }` | P14 |
| `FundamentalResearchService.ts` | Add asOf parameter; gate by releaseDate | P14 |

---

## 7. Query Gate Change

```typescript
// BEFORE (HIGH PIT risk — reporting period gate):
prisma.monthlyRevenue.findMany({
  where: {
    stockId: symbol,
    OR: [
      { year: { lt: asOfYear } },
      { year: asOfYear, month: { lte: asOfMonth } },
    ],
  },
})

// AFTER (PIT safe — release date gate):
prisma.monthlyRevenue.findMany({
  where: {
    stockId: symbol,
    releaseDate: { lte: asOfDate },
  },
})
```

---

## 8. Rollback Plan

If migration causes issues, rollback by nulling inferred releaseDates:

```sql
-- Option A: Safe rollback — null out inferred releaseDates
UPDATE "MonthlyRevenue"
SET "releaseDate" = NULL, "releaseDateSource" = NULL, "releaseDateConfidence" = NULL
WHERE "releaseDateSource" = 'INFERRED_NEXT_MONTH_10TH';

-- Option B: Drop columns (only if authoritative data not yet stored)
-- ALTER TABLE "MonthlyRevenue" DROP COLUMN IF EXISTS "releaseDate";
-- ALTER TABLE "MonthlyRevenue" DROP COLUMN IF EXISTS "releaseDateSource";
-- ALTER TABLE "MonthlyRevenue" DROP COLUMN IF EXISTS "releaseDateConfidence";
```

**Artifact-only proof:** All P13 artifacts are read-only files. No DB was modified in P13 phase.

---

## 9. Non-Goals

1. This plan does NOT write production DB.
2. This plan does NOT modify scoring formulas, alphaScore, or recommendationBucket.
3. This plan does NOT modify P0/P1/P3/P4 corpus or simulation_snapshot_corpus.
4. This plan does NOT produce ROI figures, win rates, alpha calculations, profit estimates, or performance guarantees.
5. This plan does NOT tune releaseDate based on realized returns or outcome data.
6. This plan does NOT modify ManualReview* modules.

---

*P13-HARDRESET | Non-production draft | 2026-05-12*
