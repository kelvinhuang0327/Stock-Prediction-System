# P29J Final Report — Chip C-F05 Lag Evidence + MonthlyRevenue Activation Readiness

**Session:** P29J  
**Captured:** 2026-05-15  
**Base Commit:** `795d909` (P29I: QUOTE_REGIME_CHIP_PIT_SAFE_CONFIRMED)  
**Final Classification:** `P29J_CHIP_WARN_MONTHLY_REVENUE_NEEDS_SCHEMA_REPAIR`

---

## 1. Objective Recap

P29J targeted two open questions from P29I:

1. **Chip C-F05 lag evidence audit** — Validate T+0 / T+1 / availability lag assumptions for the Chip source. Determine whether same-day chip scoring can be trusted.
2. **MonthlyRevenue activation readiness audit** — Determine whether MonthlyRevenue has sufficient metadata / asOfDate / releaseDate to graduate from `STRUCTURAL_PLACEHOLDER_ONLY` to a source-present dry-run gate.

---

## 2. Chip C-F05 Lag Evidence Audit

### Classification: `CHIP_LAG_WARN_ASSUMPTION_REQUIRED`

**Evidence Summary:**

| Evidence Type | Finding |
|---|---|
| Schema availability field | ABSENT (`availableAt`, `releaseDate`, `generatedAt` all missing) |
| Cron schedule | `0 7 * * 1-5` = 15:00 TWN |
| T86 publication time | ~17:30 TWN |
| Cron fires before T86 | YES — 2.5 hours early |
| Same-day T+0 via cron | IMPOSSIBLE |
| Effective chip at cron time | **T-1 (prior trading day)** |
| PIT gate | EXISTS — `date lte normalizePitDateToIso(asOf)` ✅ |
| C-F05 assumption consistency | CONSISTENT — assumption covers both T+0 and T-1 branches |

**Verdict:**  
Chip via scheduled cron = T-1. C-F05 assumption correctly documents the T-1 fallback. PIT gate is correctly applied. **Cannot hard-upgrade to `CHIP_LAG_CONFIRMED`** without:
- `availableAt` timestamp field in schema
- Production log evidence of T+0 chip availability

Chip remains in `ALPHA_SCORE_PERMITTED_SOURCES` (confirmed by P29I). Classification is a **WARN** not a block.

---

## 3. MonthlyRevenue Activation Readiness Audit

### Classification: `MONTHLY_REVENUE_NEEDS_SCHEMA_REPAIR`

**Evidence Summary:**

| Evidence Type | Finding |
|---|---|
| Schema model | EXISTS (`MonthlyRevenue`) |
| `releaseDate` field | EXISTS in schema — DateTime? (nullable) |
| `releaseDate` in DB | **NULL — never populated by sync** |
| `syncRealRevenue()` upsert fields | `revenue`, `yoyGrowth`, `momGrowth` only |
| `announcementDate` | ABSENT |
| PIT gate | EXISTS — `filterMonthlyRevenueAvailableAsOf()` with inference fallback |
| Inference rule | `INFERRED_NEXT_MONTH_10TH` — LOW_TO_MEDIUM confidence |
| `entersAlphaScore` | **false (always — hard constraint)** |

**Verdict:**  
MonthlyRevenue has the correct schema structure for PIT-safe release date tracking, and the PIT gate exists. However, `syncRealRevenue()` never populates `releaseDate`, making all records NULL. Cannot advance to `MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN` until sync repair.

**Remains:** `STRUCTURAL_PLACEHOLDER_ONLY` → `NEEDS_SCHEMA_REPAIR` (blocked, not ready for dry-run)

---

## 4. Hard Constraints Confirmed Unchanged

| Source | Classification | entersAlphaScore |
|---|---|---|
| MonthlyRevenue | `MONTHLY_REVENUE_NEEDS_SCHEMA_REPAIR` | `false` always |
| FinancialReport | `HIGH_RISK_SOURCE_ABSENT` | `false` always |
| NewsEvent | `HIGH_RISK_SOURCE_ABSENT` | `false` always |
| Chip | `CHIP_LAG_WARN_ASSUMPTION_REQUIRED` | in `ALPHA_SCORE_PERMITTED_SOURCES` (P29I) |

---

## 5. Deliverables

### Code Files

| File | Status |
|---|---|
| `src/lib/onlineValidation/p29j/ChipLagEvidenceAudit.ts` | ✅ Created |
| `src/lib/onlineValidation/p29j/MonthlyRevenueReadinessAudit.ts` | ✅ Created |
| `src/lib/onlineValidation/__tests__/p29j_chip_lag_and_monthly_revenue_readiness.test.ts` | ✅ Created — 76/76 PASS |

### Output Artifacts

| File | Status |
|---|---|
| `outputs/online_validation/p29j_preflight_mainline_status.json` | ✅ |
| `outputs/online_validation/p29j_chip_lag_evidence_inventory.json/.md` | ✅ |
| `outputs/online_validation/p29j_monthly_revenue_readiness_inventory.json/.md` | ✅ |
| `outputs/online_validation/p29j_test_baseline.json` | ✅ |
| `outputs/online_validation/p29j_forbidden_claims_scan.json` | ✅ |
| `outputs/online_validation/p29j_final_report.md` | ✅ (this file) |

### Test Results

| Suite | Tests | Status |
|---|---|---|
| P29J (new) | 76 | ✅ ALL PASS |
| P29I (regression) | 95 | ✅ ALL PASS |
| P29G (regression) | 45 | ✅ ALL PASS |
| P29E (regression) | 27 | ✅ ALL PASS |
| Full onlineValidation suite | 3424 / 110 suites | ✅ ALL PASS |

---

## 6. Next Steps (P29K and Beyond)

### Chip Path
- Add `availableAt DateTime` to `prisma.InstitutionalChip`
- Populate `availableAt` in `syncInstitutionalChip()` upsert
- Reschedule cron to ~18:00 TWN (after T86 publication)
- Re-audit → `CHIP_LAG_CONFIRMED`

### MonthlyRevenue Path
- Repair `syncRealRevenue()`: populate `releaseDate` on each upsert
- Backfill historical records (INFERRED_NEXT_MONTH_10TH)
- Re-audit → `MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN`
- Hard constraint unchanged: `entersAlphaScore = false` always

---

*Structural audit-only. Does not constitute investment advice. No financial claims, win-rate, edge, or outperformance claims. Results must not be used as buy/sell/hold signals.*
