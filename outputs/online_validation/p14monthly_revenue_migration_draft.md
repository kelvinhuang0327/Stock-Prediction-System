# P14-HARDRESET: MonthlyRevenue releaseDate Migration Draft

> **Disclaimer:** Dry-run draft only. Does not write production DB. Does not constitute investment advice.
> **productionApplyAllowed = false**

**Draft ID:** p14-monthly-revenue-migration-draft-v0
**Generated:** 2026-05-12T03:43:54.878Z
**Approval Token Required:** `P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY`

---

## Production Safety Warning

> ⚠️ PRODUCTION APPLY FORBIDDEN. This draft must not be applied to any production database. Requires explicit written approval from authorized operator before P15 execution. Staging environment validation required before production.

---

## Proposed Prisma Schema Change

```prisma
// Add to MonthlyRevenue model in prisma/schema.prisma
// WARNING: DO NOT APPLY TO PRODUCTION WITHOUT EXPLICIT APPROVAL
releaseDate        DateTime?
releaseDateSource  String?
releaseDateConfidence String?
```

---

## Proposed SQL Draft

```sql
-- WARNING: DO NOT EXECUTE ON PRODUCTION WITHOUT EXPLICIT APPROVAL
-- Dry-run / fixture-only draft
ALTER TABLE "MonthlyRevenue"
  ADD COLUMN "releaseDate" TIMESTAMP,
  ADD COLUMN "releaseDateSource" TEXT,
  ADD COLUMN "releaseDateConfidence" TEXT;
```

---

## Backfill Rule

| Field | Value |
|-------|-------|
| Description | Infer releaseDate as the 10th calendar day of the month following the revenue reporting month. |
| Formula | releaseDate = DATE(year, month+1, 10); if month=12, releaseDate = DATE(year+1, 1, 10) |
| December Rollover | month=12 → releaseDate = DATE(year+1, 01, 10) |
| Source Label | INFERRED_NEXT_MONTH_10TH |

**Forbidden Inputs (must not be used to compute releaseDate):**
- `outcomePrice`
- `returnPct`
- `realizedReturnClass`
- `futurePrice`
- `horizonReturnPct`
- `outcomeDate`
- `horizonDays`
- `baselineResult`
- `outcomeClose`

---

## Backfill SQL Draft

```sql
-- WARNING: DO NOT EXECUTE ON PRODUCTION WITHOUT EXPLICIT APPROVAL
-- Dry-run / fixture-only backfill draft
UPDATE "MonthlyRevenue"
SET
  "releaseDate" = CASE
    WHEN month = 12 THEN MAKE_DATE(year + 1, 1, 10)
    ELSE MAKE_DATE(year, month + 1, 10)
  END,
  "releaseDateSource" = 'INFERRED_NEXT_MONTH_10TH',
  "releaseDateConfidence" = 'LOW_TO_MEDIUM'
WHERE "releaseDate" IS NULL;
```

---

## Fixture-Only Instructions

To validate this draft: use fixture MonthlyRevenue objects in memory. Run validate-p14-monthly-revenue-fixture-dry-run.js for fixture-only proof. Do NOT run against production Prisma client. Do NOT run npx prisma migrate deploy without explicit production approval.

---

## Validation Requirements

- MR-VAL-001: All MonthlyRevenue records must have non-null releaseDate after backfill.
- MR-VAL-002: releaseDate must equal 10th of month+1 (or Jan 10 of year+1 for December).
- MR-VAL-003: releaseDateSource must be INFERRED_NEXT_MONTH_10TH for all backfilled records.
- MR-VAL-004: RuleBasedStockAnalyzer must gate by releaseDate <= asOfDate.
- MR-VAL-005: FundamentalResearchService must gate by releaseDate <= asOf.
- MR-VAL-006: MonthlyRevenueLike interface must include optional releaseDate field.

---

## Non-Goals

- Does not compute ROI, win-rate, profit, or alpha.
- Does not use realized return to infer releaseDate.
- Does not modify scoring formula or alphaScore.
- Does not modify frozen corpora.
- Does not write to production DB.

---

## Safety Validation

| Status | Errors | Warnings |
|--------|--------|---------|
| SAFE_DRY_RUN_ONLY | 0 | 0 |
