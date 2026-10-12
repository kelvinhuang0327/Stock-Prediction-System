# P29L — MonthlyRevenue releaseDate Historical Backfill Plan

**Plan ID:** P29L-MONTHLY-REVENUE-BACKFILL-PLAN  
**Captured At:** 2026-05-20T00:00:00.000Z  
**Classification:** `BACKFILL_SCRIPT_READY_NOT_APPLIED`  
**Disclaimer:** Structural backfill plan only. Does not constitute investment advice. No profit, return, or investment performance claims. `MonthlyRevenue entersAlphaScore = false`. Results must not be used as buy/sell/hold signals.

---

## Problem Statement

`MonthlyRevenue` rows synced before the P29K repair (commit `ecfa744`) have `releaseDate = NULL`. The P29K sync repair now writes `releaseDate` on every new upsert, but historical rows were never backfilled.

---

## Backfill Policy: INFERRED_NEXT_MONTH_10TH

| Dimension | Value |
|---|---|
| Rule | `releaseDate = 10th of month(year, month+1)` at UTC midnight |
| December wrap | `month=12` → `nextYear=year+1, nextMonth=1` |
| PIT-safe | Yes — always after last day of revenue month |
| `releaseDateSource` | `INFERRED_NEXT_MONTH_10TH` |
| `releaseDateConfidence` | `LOW` — inferred, not sourced from TWSE announcements |

**Sample computed values:**

| Revenue Month | computedReleaseDate |
|---|---|
| 2024-01 | 2024-02-10 |
| 2024-12 | 2025-01-10 (year wrap) |
| 2025-06 | 2025-07-10 |

---

## Script Safety

Script: `scripts/p29l_monthly_revenue_release_date_backfill.ts`

| Property | Value |
|---|---|
| Default `dryRun` | **`true`** — NEVER writes unless `--apply` flag |
| Batch size | 100 rows |
| `entersAlphaScore` | `false` ALWAYS |
| Idempotent | Yes — only updates rows WHERE `releaseDate IS NULL` |
| Requires CTO auth | Yes — `--apply` flag requires explicit authorization |

---

## Execution Gates

| Gate | Status |
|---|---|
| Dry-run approved | ✅ |
| Production apply approved | ❌ NOT YET (requires CTO auth) |
| Source-present dry-run | `NOT_YET` — NULL rows remain in dev.db |
| P29L session applied | ❌ NO — script ready but NOT run |

---

## Pure Function Module

`src/lib/onlineValidation/p29l/MonthlyRevenueBackfillReadiness.ts` — no DB imports, fully tested (T05–T10, 96/96 PASS).
