# P29K — MonthlyRevenue Sync Path Inventory

**Audit ID:** P29K-SYNC-PATH-INVENTORY  
**Captured At:** 2026-05-20T00:00:00.000Z  
**Disclaimer:** Structural audit-only. Does not constitute investment advice. No guaranteed profit, guaranteed return, risk-free claims. Results must not be used as buy/sell/hold signals.

---

## The Blocker

`syncRealRevenue()` in `src/lib/services/syncService.ts` (line 298) executes a Prisma upsert for each TWSE revenue row. The upsert includes only:

- `update`: `revenue`, `yoyGrowth`, `momGrowth`
- `create`: `stockId`, `year`, `month`, `revenue`, `yoyGrowth`, `momGrowth`

**Missing from both paths:** `releaseDate`, `releaseDateSource`, `releaseDateConfidence`

This means every `MonthlyRevenue` row in the database has `releaseDate = NULL`, which breaks the P17 PIT gate (`filterMonthlyRevenueAvailableAsOf`) unless `allowInferredReleaseDate: true` is set at the call site.

---

## Upstream API

`twseApi.getMonthlyRevenueSummary()` fetches `/opendata/t187ap05_L` and maps to `MonthlyRevenueSummary`:

```
code, name, month (string), revenue, yoyGrowth, momGrowth
```

**TWSE does NOT provide `announcementDate` or `releaseDate`.** No upstream field can supply this.

---

## Repair Strategy

**Policy: `INFERRED_NEXT_MONTH_10TH`**

Taiwan statutory rule: listed companies must release monthly revenue by the **10th of the following calendar month**.

For revenue year `Y`, month `M`:
- `releaseDate = Y'-M'-10` where `(Y', M')` = `(Y, M+1)` or `(Y+1, 1)` if `M=12`
- `releaseDateSource = "INFERRED_NEXT_MONTH_10TH"`
- `releaseDateConfidence = "LOW"`

This is **PIT-safe**: the 10th of the next month is always after the last day of the revenue month.

---

## Existing Infrastructure

| File | Purpose |
|---|---|
| `P26F2MonthlyRevenueReleaseDateInferenceUtils.ts` | Same NEXT_MONTH_10TH logic (dry-run only) |
| `MonthlyRevenueAvailability.ts` | PIT gate — already handles allowInferredReleaseDate fallback |
| `P26FMonthlyRevenueMappingContractUtils.ts` | releaseDate is sole PIT gate, entersAlphaScore=false |

---

## Repair Scope

| What | Where |
|---|---|
| New policy file | `src/lib/onlineValidation/p29k/MonthlyRevenueReleaseDatePolicy.ts` |
| Modified sync file | `src/lib/services/syncService.ts` — `syncRealRevenue()` only |
| Forbidden (must not touch) | `RuleBasedStockAnalyzer.ts`, `SignalFusionEngine.ts`, `ActiveScoringSnapshotBuilder.ts`, `MarketRegimeEngine.ts` |

`entersAlphaScore: false` — MonthlyRevenue NEVER enters alphaScore or recommendationBucket.
