# P32 — Spec Conformance Report

**Phase:** P32  
**Date:** 2026-05-21  
**P32 Artifact:** `outputs/online_validation/p32_monthly_revenue_dry_run_sample.json`  
**Spec:** `outputs/online_validation/p32prep_report_spec_v0_dry_run_sample.json` (v0)  

> Disclaimer: Conformance report only. Does not constitute investment advice. No profit, return, or investment performance claims.

---

## Required Fields — 10/10 Present

| Field | Required | P32 Value | Conformant |
|-------|----------|-----------|------------|
| `phase` | ✅ | `P32` | ✅ |
| `capturedAt` | ✅ | `2026-05-21T00:00:00.000Z` | ✅ |
| `mode` | ✅ | `source-present-dry-run` | ✅ |
| `paperOnly` | ✅ hard=true | `true` | ✅ PASS |
| `dryRun` | ✅ hard=true | `true` | ✅ PASS |
| `entersAlphaScore` | ✅ hard=false | `false` | ✅ PASS |
| `notInvestmentRecommendation` | ✅ hard=true | `true` | ✅ PASS |
| `dryRunStatus` | ✅ enum | `READY` | ✅ valid enum |
| `overallClassification` | ✅ | `MONTHLY_REVENUE_SOURCE_PRESENT_DRY_RUN_READY` | ✅ |
| `disclaimer` | ✅ | Present | ✅ |

**Hard constraint violations: 0**

---

## Optional Fields — 9/15 Populated

| Field | Populated | Notes |
|-------|-----------|-------|
| `rowCount` | ✅ `2143` | |
| `blockedRows` | ✅ `0` | |
| `releaseDateCoverage` | ✅ `{count: 2143, pct: 100}` | |
| `releaseDateSourceCoverage` | ✅ `{count: 2143, pct: 100, policy: INFERRED_NEXT_MONTH_10TH}` | |
| `releaseDateConfidenceCoverage` | ✅ `{count: 2143, pct: 100, confidence: LOW}` | |
| `auditConclusion` | ✅ | |
| `source` | ✅ `MonthlyRevenue` | |
| `dbQueryMethod` | ✅ `sqlite3 prisma/dev.db` | |
| `dbQuery` | ✅ | |
| `authorizationReceived` | — | Not applicable — dry-run is READY, no auth phrase needed |
| `gate` | — | Not applicable — dryRunStatus=READY |
| `runId` | — | Not generated for DB-query-based dry-run |
| `executionNote` | — | Captured in companion artifact (p32_monthly_revenue_source_present_dry_run.json) |
| `policy` | — | Captured inside `releaseDateSourceCoverage.policy` |
| `executionNote` | — | See companion artifact |

---

## Governance Constraints — 7/7 PASS

| Constraint | Status |
|-----------|--------|
| `entersAlphaScore=false` | ✅ PASS |
| `paperOnly=true` | ✅ PASS |
| `dryRun=true` | ✅ PASS |
| `notInvestmentRecommendation=true` | ✅ PASS |
| No forbidden fields present | ✅ PASS |
| `dryRunStatus` is valid enum | ✅ PASS |
| `disclaimer` present and non-empty | ✅ PASS |

---

## Intentional Exclusions

The following fields are intentionally absent per no-investment-advice governance:

| Field | Reason |
|-------|--------|
| `roi`, `winRate`, `edge`, `profit`, `predictedReturn` | Forbidden — investment performance claims |
| `buySignal`, `sellSignal`, `holdSignal` | Forbidden — buy/sell/hold/action semantics |
| `outperform`, `beat`, `guaranteed` | Forbidden — prediction quality claims |
| `investmentRecommendation` | Forbidden — investment advice |

---

## Backward Compatibility

- P32 artifact fully compatible with P32PREP v0 spec (all 10 required fields populated)
- P32 adds no new required fields — backward compatible with any P33+ reader of v0 spec
- P31 dry-run sample (predecessor) also conforms to this spec
- P32 adds `inputLineage` and `specConformance` fields for forward traceability

---

## Overall Conformance

**Result: FULL_CONFORMANCE**  
**Classification: P32_SPEC_CONFORMANCE_PASS**
