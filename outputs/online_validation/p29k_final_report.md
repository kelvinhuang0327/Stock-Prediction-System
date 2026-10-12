# P29K Final Report — MonthlyRevenue releaseDate Sync Repair + Chip availableAt Schema Readiness

**Phase:** P29K  
**Committed:** (see git commit)  
**Captured At:** 2026-05-20T00:00:00.000Z  
**Disclaimer:** Structural audit-only. Does not constitute investment advice. No profit, return, or investment performance claims. Results must not be used as buy/sell/hold signals.

---

## Executive Summary

P29K resolves the source-readiness blocker identified in P29J:

1. **MonthlyRevenue `releaseDate` Repair** — `syncRealRevenue()` now writes `releaseDate`, `releaseDateSource`, and `releaseDateConfidence` on every upsert. The P29J finding (`MONTHLY_REVENUE_NEEDS_SCHEMA_REPAIR`) is resolved.

2. **Chip `availableAt` Readiness Plan** — `InstitutionalChip` has no `availableAt` field. A 5-step migration plan has been produced and deferred to P29L. The P29J `CHIP_LAG_WARN_ASSUMPTION_REQUIRED` classification remains unchanged until migration is executed.

---

## P29J Blockers Resolved

| P29J Finding | Resolution |
|---|---|
| `MONTHLY_REVENUE_NEEDS_SCHEMA_REPAIR` — `syncRealRevenue()` never writes `releaseDate` | ✅ **Fixed** — `syncRealRevenue()` now includes `releaseDate`, `releaseDateSource`, `releaseDateConfidence` |
| `CHIP_LAG_WARN_ASSUMPTION_REQUIRED` — no `availableAt` evidence | ⏭ **Deferred to P29L** — migration plan produced, schema change deferred to avoid scope creep |

---

## Files Changed

### New — Policy / Audit

| File | Purpose |
|---|---|
| `src/lib/onlineValidation/p29k/MonthlyRevenueReleaseDatePolicy.ts` | Pure release date policy for `syncRealRevenue()` upsert |
| `src/lib/onlineValidation/p29k/ChipAvailableAtReadinessPlan.ts` | Chip availableAt field audit + migration plan |

### Modified — Sync Repair

| File | Change |
|---|---|
| `src/lib/services/syncService.ts` | `syncRealRevenue()` — added `buildMonthlyRevenueReleaseDatePayload()` call; added `releaseDate`, `releaseDateSource`, `releaseDateConfidence` to both `create` and `update` blocks |

### New — Tests

| File | Tests |
|---|---|
| `src/lib/onlineValidation/__tests__/p29k_monthly_revenue_release_date_repair.test.ts` | 68 tests / 15 groups (T01–T15) |

---

## Release Date Policy

**Strategy:** `INFERRED_NEXT_MONTH_10TH`

Taiwan statutory rule: listed companies must release monthly revenue by the 10th of the following calendar month.

For revenue year `Y`, month `M`:
- `releaseDate = Y'-M'-10T00:00:00.000Z` where next month rolls over correctly for December
- `releaseDateSource = "INFERRED_NEXT_MONTH_10TH"`
- `releaseDateConfidence = "LOW"`

**PIT-safety guarantee:** `INFERRED_NEXT_MONTH_10TH` is always after the last day of the revenue month — no lookahead possible.

**Upstream fact:** `twseApi.getMonthlyRevenueSummary()` (`/opendata/t187ap05_L`) returns `code, name, month, revenue, yoyGrowth, momGrowth` — **no `releaseDate` or `announcementDate`**. The inference policy is the only possible repair path.

---

## Test Results

| Suite | Tests | Result |
|---|---|---|
| P29K targeted | 68 | ✅ PASS |
| P29J regression | 76 | ✅ PASS |
| P29I regression | 33 | ✅ PASS |
| Full onlineValidation suite | 3492 / 111 suites | ✅ PASS |

**Forbidden diff:** CLEAN — `RuleBasedStockAnalyzer.ts`, `SignalFusionEngine.ts`, `ActiveScoringSnapshotBuilder.ts`, `MarketRegimeEngine.ts` untouched.

---

## Constraints Verified

- `MonthlyRevenue.entersAlphaScore = false` — ALWAYS. Revenue data is structural metadata only.
- No scoring formula, alphaScore, or recommendationBucket logic touched.
- No DB migration needed for MonthlyRevenue repair — `releaseDate` field already existed in schema (P17).
- `prisma/dev.db` not staged (runtime drift only).

---

## P29L Gates

The following items are **explicitly deferred** and block P29L activation:

1. **Chip `availableAt` migration** — 5-step plan documented in `p29k_chip_available_at_readiness_plan.md`.  
   Once `availableAt` is populated, `ChipLagEvidenceAudit` can reclassify from `CHIP_LAG_WARN_ASSUMPTION_REQUIRED` → `CHIP_LAG_CONFIRMED`.

2. **MonthlyRevenue backfill** — Existing rows with NULL `releaseDate` are not repaired by `syncRealRevenue()` update path (idempotent for existing records would require raw SQL).  
   A dedicated backfill script should populate `releaseDate` for historical rows before P29L dry-run activation.

---

## Output Artifacts

| Artifact | Status |
|---|---|
| `p29k_preflight_mainline_status.json/.md` | ✅ |
| `p29k_monthly_revenue_sync_path_inventory.json/.md` | ✅ |
| `p29k_chip_available_at_readiness_plan.json/.md` | ✅ |
| `p29k_test_baseline.json` | ✅ |
| `p29k_forbidden_claims_scan.json` | ✅ |
| `p29k_final_report.md` | ✅ |
