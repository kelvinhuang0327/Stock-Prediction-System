# P26F-HARDRESET: MonthlyRevenue Corpus Expansion Candidate Final Report

**Phase:** P26F-HARDRESET  
**Date:** 2026-05-13  
**Classification:** P26F_SOURCE_MAPPING_IMPLEMENTED_BUT_NO_REAL_COVERAGE

---

## Section 1: Executive Summary

P26F-HARDRESET implements the MonthlyRevenue source mapping contract and candidate corpus dry-run. The PIT gate (releaseDate ≤ asOfDate) is correctly implemented and tested. All 2143 MonthlyRevenue rows in the SQLite DB have `releaseDate = null`, which blocks all PIT matches. Matched rows = 0. No scoring formula changed. No corpus replaced.

---

## Section 2: Prior Sprint Context

| Sprint | Commit | Artifact |
|---|---|---|
| P26A | b330b42 | MonthlyRevenue reason enrichment (24→9 generic) |
| P26B | 2d607eb | NewsEvent PIT adapter |
| P26C | 0698b81 | FinancialReport availability contract |
| P26D | 3d05fb9 | Coverage comparison (MonthlyRevenue in P3/P19 = 0) |
| P26E | d600682 | MonthlyRevenue = PARTIAL_SOURCE_MAPPING_REQUIRED |

---

## Section 3: Pre-flight Results

| Check | Result |
|---|---|
| P26E classification | P26E_PARTIAL_SOURCE_MAPPING_REQUIRED |
| Prisma MonthlyRevenue model | ✅ Found |
| Prisma releaseDate field | ✅ Found |
| DB MonthlyRevenue rows | 2143 |
| DB releaseDate populated | 0 |
| DB releaseDate null | 2143 |
| Status | PREFLIGHT_PASS |

---

## Section 4: Frozen Corpus Integrity

| Corpus | Count |
|---|---|
| simulation | 60 |
| p0 | 4500 |
| p1 | 9900 |
| p3 | 4500 |
| p19 | 4500 |

All counts verified unchanged.

---

## Section 5: Scoring File SHA256 (Frozen)

| File | SHA256 | Status |
|---|---|---|
| ActiveScoringSnapshotBuilder.ts | 063a3bd... | ✅ Unchanged |
| RuleBasedStockAnalyzer.ts | bc3716c... | ✅ Unchanged |
| SignalFusionEngine.ts | b8ce3fa... | ✅ Unchanged |

---

## Section 6: Candidate Dry-Run

- **P3 candidate rows:** 4500
- **P19 candidate rows:** 4500
- **Source mode:** REAL_SOURCE_PRESENT_NO_RELEASE_DATE
- **All rows have p26fMonthlyRevenueContext:** ✅
- **All context readOnly=true:** ✅
- **All context entersAlphaScore=false:** ✅
- **No outcome fields in context:** ✅
- **P3 matched rows:** 0
- **P19 matched rows:** 0
- **Total matched:** 0

All candidate rows have `pitGateStatus: "NO_VISIBLE_SOURCE_ROW"` due to null releaseDate.

---

## Section 7: PIT Leakage Validation (13/13 PASS)

| Test | Result |
|---|---|
| releaseDate before asOfDate → visible | ✅ PASS |
| releaseDate after asOfDate → not visible | ✅ PASS |
| releaseDate equals asOfDate → visible | ✅ PASS |
| releaseDate null → not visible | ✅ PASS |
| releaseDate undefined → not visible | ✅ PASS |
| old year/month, future releaseDate → not visible | ✅ PASS |
| different symbol → no match | ✅ PASS |
| duplicate rows → select latest releaseDate | ✅ PASS |
| no outcome fields in context | ✅ PASS |
| entersAlphaScore=false | ✅ PASS |
| readOnly=true | ✅ PASS |
| alphaScore preserved | ✅ PASS |
| researchBucket preserved | ✅ PASS |

---

## Section 8: Coverage Delta

| Metric | Value |
|---|---|
| Before (P26E baseline) matched rows | 0 |
| After (P26F candidate) matched rows | 0 |
| Delta | 0 |
| Coverage ratio | 0 |
| Coverage classification | NONE |
| Coverage improved | false |
| Missing releaseDate blocks all matches | true |

Root cause: All 2143 MonthlyRevenue rows have `releaseDate=null`. PIT gate requires non-null releaseDate.

---

## Section 9: Scoring Invariance

| Metric | Value |
|---|---|
| Total rows checked | 9000 |
| Mismatched alphaScore | 0 |
| Mismatched researchBucket | 0 |
| Scoring file SHA256 unchanged | true |
| All context entersAlphaScore=false | true |
| Status | SCORING_INVARIANCE_PASS |

---

## Section 10: Candidate Quality Gate

| Check | Result |
|---|---|
| P3 candidate row count = 4500 | ✅ |
| P19 candidate row count = 4500 | ✅ |
| All rows parseable | ✅ |
| All rows have context | ✅ |
| All context readOnly=true | ✅ |
| All context entersAlphaScore=false | ✅ |
| No outcome fields in context | ✅ |
| Original P3 sha256 unchanged | ✅ |
| Original P19 sha256 unchanged | ✅ |
| No forbidden claims | ✅ |
| Status | QUALITY_GATE_PASS |

---

## Section 11: TypeScript Source Files Created

- `src/lib/onlineValidation/P26FMonthlyRevenueMappingContractUtils.ts` — contract v1
- `src/lib/onlineValidation/P26FMonthlyRevenueSourceMapperUtils.ts` — pure mapping functions

---

## Section 12: Test Results

| Suite | Tests | Result |
|---|---|---|
| p26f_monthly_revenue_mapping_contract_utils | 35 | ✅ PASS |
| p26f_monthly_revenue_source_mapper_utils | 39 | ✅ PASS |
| All onlineValidation tests | 2423 | ✅ PASS |

New tests added: 74. Total onlineValidation tests: 2423.

---

## Section 13: Scripts Created

| Script | Status |
|---|---|
| run-p26f-monthly-revenue-candidate-corpus-builder.js | ✅ |
| run-p26f-monthly-revenue-pit-leakage-validation.js | ✅ 13/13 |
| run-p26f-monthly-revenue-coverage-delta.js | ✅ |
| run-p26f-scoring-invariance-check.js | ✅ |
| run-p26f-candidate-corpus-quality-gate.js | ✅ |

---

## Section 14: Output Artifacts

| File | Description |
|---|---|
| p26f_monthly_revenue_corpus_expansion_preflight.json | Pre-flight check |
| p26f_monthly_revenue_mapping_contract_v1.json | Mapping contract |
| p26f_monthly_revenue_candidate_corpus_summary.json | Corpus summary |
| p26f_monthly_revenue_candidate_p3_enriched.jsonl | Candidate P3 (4500 rows) |
| p26f_monthly_revenue_candidate_p19_enriched.jsonl | Candidate P19 (4500 rows) |
| p26f_monthly_revenue_pit_leakage_validation.json | PIT leakage results |
| p26f_monthly_revenue_coverage_delta.json | Coverage delta |
| p26f_scoring_invariance_check.json | Scoring invariance |
| p26f_candidate_corpus_quality_gate.json | Quality gate |

---

## Section 15: Mapping Contract v1 Summary

- **PIT gate field:** `releaseDate` (ONLY field)
- **Join:** `corpusRow.symbol === monthlyRevenue.stockId`
- **Null releaseDate:** NOT visible (blocks match)
- **year/month:** NOT visibility gates
- **createdAt:** Observability only

---

## Section 16: Source Mode

**REAL_SOURCE_PRESENT_NO_RELEASE_DATE**

2143 real MonthlyRevenue rows exist in DB. Zero have releaseDate populated. No fixture data used. No mock/synthetic source data.

---

## Section 17: Constraints Verified

- ✅ ZERO external imports in TypeScript source files
- ✅ Taiwan UTC+8 timezone for releaseDate resolution
- ✅ No random number generation
- ✅ No mutation of input objects
- ✅ No outcome fields (outcomePrice/returnPct/realizedReturnClass)
- ✅ Original corpus files not overwritten
- ✅ Candidate JSONL files have exactly 4500 non-empty lines each

---

## Section 18: Risk Assessment

**Primary Risk:** Matched rows = 0 because `releaseDate` field was never populated in the MonthlyRevenue table. The source mapping contract and PIT gate logic are correctly implemented, but cannot produce coverage until releaseDate is populated.

**Next Action (P26F-2):** Populate `releaseDate` field in MonthlyRevenue table. Options:
1. Infer from TWSE public release schedule (typically next month's 10th day)
2. Use explicit historical release dates from TWSE data

**No production risk** from this sprint — candidate corpus is dry-run only, does not replace frozen corpus.

---

## Section 19: Pre-existing TSC Error (Not Fixed)

```
src/app/api/admin/data-quality/route.ts:174 TS1128/TS1005
```

This error is pre-existing and unrelated to P26F. Documented per instructions, not fixed.

---

## Section 20: Final Classification

**P26F_SOURCE_MAPPING_IMPLEMENTED_BUT_NO_REAL_COVERAGE**

- Source mapping: ✅ Implemented
- PIT gate: ✅ Correct (releaseDate-only)
- Candidate corpus: ✅ Built (4500+4500 rows)
- Coverage: ❌ 0 matched rows (releaseDate=null blocks all)
- Scoring: ✅ Unchanged (invariance verified)
- Optimizer: ❌ Not authorized
- Corpus replacement: ❌ Not performed

---

*Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell/alpha/edge/outperform/guaranteed claims. Candidate dry-run only.*
