# P30 — Chip Schema Migration Readiness

**Phase:** P30
**Captured:** 2026-05-20T00:00:00.000Z
**Classification:** `CHIP_SCHEMA_READY_MIGRATION_ARTIFACT_CREATED_NOT_APPLIED`

## Summary

In P30, the `InstitutionalChip` Prisma schema was updated to add the `availableAt DateTime?` field for PIT (point-in-time) tracking. A migration SQL artifact was created but NOT applied to the dev DB or production DB.

## Schema Change

| Field | Before P30 | After P30 |
|---|---|---|
| `availableAt` | absent | `DateTime?` (nullable) |
| `@@index([availableAt])` | absent | added |

**Change type:** Additive nullable field — no breaking changes to existing rows.

## Migration Artifact

- **File:** `prisma/migrations/20260520000000_add_chip_available_at/migration.sql`
- **SQL:** `ALTER TABLE "InstitutionalChip" ADD COLUMN "availableAt" DATETIME;`
- **Index SQL:** `CREATE INDEX "InstitutionalChip_availableAt_idx" ON "InstitutionalChip"("availableAt");`

## Application Status

| Target | Applied |
|---|---|
| Dev DB (`prisma/dev.db`) | false — NOT applied (constraint: do not run `prisma migrate dev`) |
| Production DB | false — requires explicit `prisma migrate deploy` approval |

## PIT Lag Status

- Chip lag status remains: `CHIP_LAG_WARN_ASSUMPTION_REQUIRED`
- `canClaimChipLagConfirmed`: false
- `prodLogsRequired`: true — production logs needed to upgrade to `CHIP_LAG_CONFIRMED`
- `entersAlphaScore`: false (always)

## Next Steps

1. Run `prisma migrate dev` (requires CTO authorization) to apply migration to dev DB
2. Update `syncInstitutionalChip()` to write `availableAt = computeChipAvailableAt(isoDate).availableAt`
3. Backfill existing rows using `computeChipAvailableAtConservative(date)`
4. Collect production logs to upgrade lag classification to `CHIP_LAG_CONFIRMED`

---
*Structural migration readiness only. Does not constitute investment advice. InstitutionalChip entersAlphaScore = false.*
