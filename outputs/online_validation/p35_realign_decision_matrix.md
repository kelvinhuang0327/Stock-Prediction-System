# P35-REALIGN — Source-by-Source Decision Matrix

**Phase:** P35-REALIGN  
**Date:** 2026-05-21  
**Evidence base:** outputs/online_validation/p32prep_*, p32_*, p33_*, p34_*  
**Governance carry-forward:** `entersAlphaScore=false`, `paperOnly=true`, `dryRun=true`, `notInvestmentRecommendation=true`

---

## Decision Matrix

| Source | Current proven | Not yet proven | Decision | Why |
|--------|---------------|----------------|----------|-----|
| **MonthlyRevenue** | P32: source-present dry-run PASS; 2143/2143 rows eligible; `releaseDate` PIT gate (INFERRED_NEXT_MONTH_10TH); spec conformance FULL_CONFORMANCE; forbidden claims CLEAN | No `src/` consumer code; no controlled fixture candidate materialized; PIT confidence LOW (inference, not recorded) | **PROMOTE** | All dry-run gates cleared. `releaseDate` coverage is complete. Next step is Feature Consumer DESIGN in `src/lib/onlineValidation/`. Weakest PIT confidence of the three eligible sources — note for future hardening. |
| **NewsEvent** | P34: source-present dry-run PASS; 1018/1018 rows eligible; `publishedAt` PIT gate (RECORDED_FROM_SOURCE); PIT confidence RECORDED (strongest in system); PIT timing anomalies=0; spec conformance FULL_CONFORMANCE; forbidden claims CLEAN | No `src/` consumer code; no controlled fixture candidate materialized; source diversity concern (84% Yahoo RSS) | **PROMOTE** | Strongest PIT confidence of all sources. All gates cleared. Secondary to MonthlyRevenue for the immediate next `src/` task (yield MonthlyRevenue the first consumer slot; NewsEvent follows in the subsequent round). |
| **FinancialReport** | P33: schema inspected; block identified (`releaseDate`, `releaseDateSource`, `releaseDateConfidence` missing); 957 rows (all Q4 2025, single-period bulk import); unblock path defined | PIT gate unreachable until migration applied; single-period data limits temporal coverage | **BLOCK** | Hard block until user authorizes: `YES apply FinancialReport releaseDate migration to dev DB`. Single-period data is also a structural concern for eventual validation quality. No dry-run scope until block lifted. |
| **Chip** | Block identified in P30B: `availableAt` field absent; migration authorization pending | No PIT gate audit performed; no dry-run scan; no schema inspection documented in p32–p34 | **DEFER** | Cannot proceed without `YES apply Chip availableAt migration to dev DB`. Not scanned in P32–P34; must re-enter at source-present gate after migration is authorized and applied. |

---

## Summary

| Decision | Count | Sources |
|----------|-------|---------|
| PROMOTE | 2 | MonthlyRevenue, NewsEvent |
| BLOCK | 1 | FinancialReport |
| DEFER | 1 | Chip |

**Next P0 target:** MonthlyRevenue Feature Consumer Readiness DESIGN (`src/lib/onlineValidation/` only). See D3.

---

*Rendered length: ~55 lines. Governance: entersAlphaScore=false. No investment advice.*
