# P29K — Chip availableAt Schema Readiness Plan

**Audit ID:** P29K-CHIP-AVAILABLE-AT-READINESS  
**Captured At:** 2026-05-20T00:00:00.000Z  
**Classification:** `CHIP_AVAILABLE_AT_NEEDS_MIGRATION_PLAN`  
**Disclaimer:** Structural audit-only. Does not constitute investment advice. No profit, return, or investment performance claims. Results must not be used as buy/sell/hold signals.

---

## Finding

`InstitutionalChip` schema (prisma/schema.prisma, lines 147–162) has **NO** `availableAt` or `releaseDate` field.

| Existing Fields | `availableAt`? | `releaseDate`? |
|---|---|---|
| id, stockId, date, foreignBuy, trustBuy, dealerBuy, totalBuy, holders400, holders1000, createdAt | ❌ | ❌ |

---

## Timing Context (from P29J)

| Dimension | Value |
|---|---|
| Cron schedule | `0 7 * * 1-5` UTC = **15:00 TWN** |
| T86 data availability | **~17:30 TWN** |
| Gap | **~2.5 hours** |
| Effective chip date | **T-1** (previous trading day) |

Without an `availableAt` field, this timing constraint **cannot be enforced at runtime**. The cron fires 2.5 hours before chip data is actually available, meaning every scoring run uses T-1 chip data. The P29J classification of `CHIP_LAG_WARN_ASSUMPTION_REQUIRED` remains.

---

## Migration Plan (Deferred to P29L)

**Risk level: LOW** — schema change is additive (new nullable field), no breaking changes.

| Step | Action |
|---|---|
| 1 | Add `availableAt DateTime?` to `InstitutionalChip` in `prisma/schema.prisma` |
| 2 | Run `npx prisma migrate dev --name add_chip_available_at` |
| 3 | Update `syncInstitutionalChip()` to set `availableAt = chip date 09:30 UTC (~17:30 TWN)` |
| 4 | Backfill existing rows: `availableAt = date + 1 day at 09:30 UTC` (conservative T-1) |
| 5 | Update `ChipLagEvidenceAudit` (P29J): reclassify `CHIP_LAG_WARN_ASSUMPTION_REQUIRED → CHIP_LAG_CONFIRMED` when `availableAt` evidence is present |

**Deferral reason:** Migration + backfill + audit update is well-bounded but exceeds P29K's primary goal of MonthlyRevenue `releaseDate` repair. Scope deferred to P29L to keep P29K focused.

---

## Constraint

`entersAlphaScore = false` — Chip field timing evidence is structural audit metadata only.  
It does NOT enter `alphaScore` or `recommendationBucket`.
