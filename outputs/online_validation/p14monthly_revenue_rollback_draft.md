# P14-HARDRESET: MonthlyRevenue Rollback Draft

> **Disclaimer:** Dry-run draft only. Does not write production DB. Does not constitute investment advice.
> **productionApplyAllowed = false**

**Rollback ID:** p14-monthly-revenue-rollback-draft-v0
**Generated:** 2026-05-12T03:43:54.881Z

> ⚠️ Both rollback strategies are dry-run drafts only. No production DB may be modified without explicit approval.

---

## Rollback Strategy A — Null Inferred Entries

**Description:** Null out inferred releaseDates (preserves authoritative entries).

```sql
-- WARNING: DO NOT EXECUTE ON PRODUCTION WITHOUT EXPLICIT APPROVAL
UPDATE "MonthlyRevenue"
SET "releaseDate" = NULL,
    "releaseDateSource" = NULL,
    "releaseDateConfidence" = NULL
WHERE "releaseDateSource" = 'INFERRED_NEXT_MONTH_10TH';
```

---

## Rollback Strategy B — Drop Columns (Full Rollback)

**Description:** Drop the three releaseDate columns entirely (full rollback).

```sql
-- WARNING: DO NOT EXECUTE ON PRODUCTION WITHOUT EXPLICIT APPROVAL
ALTER TABLE "MonthlyRevenue"
  DROP COLUMN IF EXISTS "releaseDate",
  DROP COLUMN IF EXISTS "releaseDateSource",
  DROP COLUMN IF EXISTS "releaseDateConfidence";
```

---

## Selection Criteria

| Scenario | Recommended Strategy |
|----------|---------------------|
| Partial backfill, need to retry | Strategy A (null inferred, re-run backfill) |
| Complete rollback of migration | Strategy B (drop columns) |
| Authoritative entries exist | Strategy A (preserves authoritative entries) |
