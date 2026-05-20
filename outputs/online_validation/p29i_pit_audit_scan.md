# P29I PIT Audit Scan — Canonical Scan Results

**Phase:** P29I — Quote / Regime / Chip PIT Validation Audit  
**Scanner:** `p29i-audit-scanner-v1`  
**Captured:** 2026-05-20T09:02:21Z  
**Overall Result:** `ALL_PIT_SAFE`  
**Disclaimer:** AUDIT-ONLY — This scan evaluates structural PIT-safety properties of data sources. It does NOT constitute investment advice and makes no claim of predictive performance, edge, or returns.

---

## Summary

| Source | Result | P29F Status | Blocked from alphaScore |
|--------|--------|-------------|------------------------|
| Quote | `PASS_PIT_SAFE` | PIT_SAFE_VERIFIED | No (permitted) |
| Regime | `PASS_PIT_SAFE` | PIT_SAFE_VERIFIED | No (permitted) |
| Chip | `WARN_ASSUMPTION_REQUIRED` | PIT_SAFE_VERIFIED | No (permitted, lag documented) |
| MonthlyRevenue | `PASS_PIT_SAFE` | STRUCTURAL_PLACEHOLDER_ONLY | Yes (correctly excluded) |
| FinancialReport | `PASS_PIT_SAFE` | HIGH_RISK_SOURCE_ABSENT | Yes (correctly blocked) |
| NewsEvent | `PASS_PIT_SAFE` | HIGH_RISK_SOURCE_ABSENT | Yes (correctly blocked) |

**Permitted in alphaScore:** `Quote`, `Regime`, `Chip`  
**Blocked sources (leakage/missing evidence):** _none_

---

## Source Detail

### Quote — `PASS_PIT_SAFE`
- Date field: `asOfDate` ✅
- Format consistency: ✅ (P29F-Repair: normalizePitDateToIso applied)
- PIT gate: ✅ present in DB query path
- asOf propagated: ✅
- Forbidden fields: none
- PSR-10: PIT_SAFE_VERIFIED + on permitted list ✅

### Regime — `PASS_PIT_SAFE`
- Date field: `asOfDate` ✅
- Format consistency: ✅ (ISO-to-ISO, no mismatch)
- PIT gate: ✅ present
- asOf propagated: ✅
- Forbidden fields: none
- PSR-10: PIT_SAFE_VERIFIED + on permitted list ✅

### Chip — `WARN_ASSUMPTION_REQUIRED`
- Date field: `asOfDate` ✅
- Format consistency: ✅ (P29F-Repair applied)
- PIT gate: ✅ present
- asOf propagated: ✅
- Forbidden fields: none
- PSR-14 assumption (C-F05): T+0 institutional chip data published ~6pm on T; post-close scoring assumed ⚠️
- PSR-10: PIT_SAFE_VERIFIED + on permitted list ✅
- **Note:** `WARN_ASSUMPTION_REQUIRED` is PIT_SAFE — assumption is documented, not a blocker.

### MonthlyRevenue — `PASS_PIT_SAFE` (correctly excluded)
- `permittedInAlphaScore: false`
- P29F status: `STRUCTURAL_PLACEHOLDER_ONLY`
- PSR-01/02/08/09: Not applicable (not in pipeline)
- PSR-10/13: Correctly excluded ✅

### FinancialReport — `PASS_PIT_SAFE` (correctly blocked)
- `permittedInAlphaScore: false`
- P29F status: `HIGH_RISK_SOURCE_ABSENT`
- PSR-01/02/08/09: Not applicable (not in pipeline)
- PSR-11: Correctly blocked ✅

### NewsEvent — `PASS_PIT_SAFE` (correctly blocked)
- `permittedInAlphaScore: false`
- P29F status: `HIGH_RISK_SOURCE_ABSENT`
- PSR-01/02/08/09: Not applicable (not in pipeline)
- PSR-12: Correctly blocked ✅

---

## Conclusion

All 6 data sources pass the P29I PIT-safety audit. No forbidden field patterns were detected in any source. The `WARN_ASSUMPTION_REQUIRED` on Chip reflects a documented publication lag assumption (not a structural violation). FinancialReport and NewsEvent are correctly absent from the pipeline.
