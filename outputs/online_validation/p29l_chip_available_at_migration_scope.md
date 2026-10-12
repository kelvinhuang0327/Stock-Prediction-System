# P29L — Chip availableAt Migration Scope Audit

**Audit ID:** P29L-CHIP-AVAILABLE-AT-MIGRATION-SCOPE  
**Captured At:** 2026-05-20T00:00:00.000Z  
**Disclaimer:** Structural audit-only. Does not constitute investment advice. No profit, return, or investment performance claims. Results must not be used as buy/sell/hold signals.

---

## Scope Matrix

### Item 1 — InstitutionalChip Schema

| Dimension | Value |
|---|---|
| Target model | `InstitutionalChip` |
| File | `prisma/schema.prisma` lines 147–162 |
| Missing field | `availableAt DateTime?` |
| Migration required | ✅ YES |
| Sync path exists | ✅ YES — `syncInstitutionalChip()` in `syncService.ts` |
| Test fixtures need update | No (tests use pure functions) |
| Production log requirement | **REQUIRED** for `CHIP_LAG_CONFIRMED` |
| Risk | LOW — additive nullable field |
| **P29L Action** | **Option A** — create readiness module, do NOT modify schema |

### Item 2 — syncInstitutionalChip() Update

| Dimension | Value |
|---|---|
| Target | `syncInstitutionalChip()` at line ~401 |
| Missing write | `availableAt` — never computed or written |
| Proposed change | `availableAt = chipDate at 09:30 UTC (17:30 TWN)` |
| P29L Action | Document sync update plan in readiness module; implement AFTER schema migration |

### Item 3 — ChipLagEvidenceAudit (P29J re-audit)

| Dimension | Value |
|---|---|
| Current classification | `CHIP_LAG_WARN_ASSUMPTION_REQUIRED` |
| Missing evidence | `availableAt` populated + production log cross-check |
| P29L verdict | **Remains WARN** — cannot upgrade to `CHIP_LAG_CONFIRMED` without prod logs |
| P29L Action | Maintain current P29J classification; re-audit only after migration + logs |

### Item 4 — MonthlyRevenue Historical NULL Backfill

| Dimension | Value |
|---|---|
| Target | `MonthlyRevenue` rows with `releaseDate = NULL` |
| Root cause | `syncRealRevenue()` never wrote `releaseDate` before P29K repair |
| Proposed fix | Backfill script: `INFERRED_NEXT_MONTH_10TH` policy |
| P29L Action | Create `dryRun=true` backfill script — NOT applied in this session |
| Risk | LOW — idempotent nullable field update |

---

## Timing Evidence

| Dimension | Value |
|---|---|
| Cron (UTC) | `0 7 * * 1-5` |
| Cron (TWN) | 15:00 TWN |
| T86 availability | ~17:30 TWN |
| Timing gap | **150 minutes** |
| Effective chip date | **T-1** (previous trading day) |
| Primary policy | `INFERRED_SAME_DAY_T86_0930_UTC` — `availableAt = chipDate at 09:30 UTC` |
| Conservative policy | `INFERRED_NEXT_DAY_0930_UTC_CONSERVATIVE` — `availableAt = chipDate + 1 day at 09:30 UTC` |

---

## P29L Decision

**Selected Option: A** — dev-safe schema readiness only.

- Schema NOT modified (`prisma/schema.prisma` unchanged)
- `prisma/dev.db` NOT touched
- `prisma migrate dev` NOT run
- Pure `ChipAvailableAtMigrationReadiness.ts` module created
- Final classification: `CHIP_AVAILABLE_AT_MIGRATION_PLAN_READY`

`CHIP_LAG_CONFIRMED` requires: schema migration executed + `availableAt` populated + production logs collected. All three remain pending.
