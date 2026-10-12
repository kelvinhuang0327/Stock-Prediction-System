# P29J — MonthlyRevenue Activation Readiness Inventory

**Audit ID:** P29J-MONTHLY-REVENUE-READINESS-INVENTORY  
**Captured:** 2026-05-15  
**Classification:** `MONTHLY_REVENUE_NEEDS_SCHEMA_REPAIR`

---

## 1. Schema Status

| Field | Present | Populated |
|---|---|---|
| `releaseDate` (DateTime?) | ✅ YES | ❌ NEVER (always NULL) |
| `releaseDateSource` | ✅ YES | ❌ NEVER |
| `releaseDateConfidence` | ✅ YES | ❌ NEVER |
| `announcementDate` | ❌ NO | — |
| `availabilityDate` | ❌ NO | — |
| `year` / `month` (Int) | ✅ YES | ✅ YES |

---

## 2. Sync Status (`syncRealRevenue()`)

Upserted fields: `revenue`, `yoyGrowth`, `momGrowth`  
**NOT upserted:** `releaseDate`, `releaseDateSource`, `releaseDateConfidence`

→ All MonthlyRevenue records have `releaseDate = NULL` in production DB.

---

## 3. PIT Gate Status

Gate: `filterMonthlyRevenueAvailableAsOf(revenues, asOf, { allowInferredReleaseDate: true })`  
Inference rule: `INFERRED_NEXT_MONTH_10TH` (when releaseDate NULL)  
Confidence: **LOW_TO_MEDIUM** (inferred, not explicitly set)

---

## 4. Classification Rationale

`MONTHLY_REVENUE_NEEDS_SCHEMA_REPAIR`:
- Schema has all required fields for PIT-safe release date tracking ✅
- PIT gate exists and functions ✅
- BUT sync never populates releaseDate → all records NULL
- Gate falls back to inference only → LOW_TO_MEDIUM confidence

Cannot advance to `MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN` until sync repair.

---

## 5. Activation Requirements

1. Repair `syncRealRevenue()`: populate `releaseDate` on each upsert
2. Set `releaseDateSource = 'EXPLICIT'` or `'INFERRED'`  
3. Backfill historical records using `INFERRED_NEXT_MONTH_10TH`
4. Re-audit → advance to `MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN`
5. **Hard constraint: `entersAlphaScore = false` always** — dry-run readiness ≠ alpha eligibility

---

## 6. Hard Constraints (Unchanged)

| Source | Status | entersAlphaScore |
|---|---|---|
| MonthlyRevenue | `STRUCTURAL_PLACEHOLDER_ONLY` → `NEEDS_SCHEMA_REPAIR` | `false` (always) |
| FinancialReport | `HIGH_RISK_SOURCE_ABSENT` | `false` (always) |
| NewsEvent | `HIGH_RISK_SOURCE_ABSENT` | `false` (always) |

---

*Structural audit-only. Does not constitute investment advice.*
