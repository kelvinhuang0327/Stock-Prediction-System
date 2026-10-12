# P38 — Test Baseline

**Phase:** P38  
**Date:** 2026-05-15  
**Status:** PASS  

---

## Test Run Result

| Metric | Value |
|--------|-------|
| Test Suites | 1 |
| Total Tests | **55** |
| Passed | **55** |
| Failed | 0 |
| Skipped | 0 |

---

## Group Summary

| Group | Name | Tests | Passed |
|-------|------|-------|--------|
| 1 | MonthlyRevenue mapping | 8 | ✅ 8 |
| 2 | NewsEvent mapping | 6 | ✅ 6 |
| 3 | FinancialReport mapping | 5 | ✅ 5 |
| 4 | Chip mapping | 5 | ✅ 5 |
| 5 | Quote and Regime mapping | 6 | ✅ 6 |
| 6 | buildSimulationInputReadinessMatrix | 6 | ✅ 6 |
| 7 | summarizeSimulationInputReadinessMatrix | 4 | ✅ 4 |
| 8 | Forbidden semantics enforcement | 5 | ✅ 5 |
| 9 | Isolation and governance | 5 | ✅ 5 |
| 10 | Field integrity and forbidden field scan | 5 | ✅ 5 |

---

## Regression Suites

| Suite | Tests | Result |
|-------|-------|--------|
| P37 MonthlyRevenue consumer integration surface | 60 | ✅ PASS |
| P36 MonthlyRevenue controlled consumer readiness | 114 | ✅ PASS |
| P31 MonthlyRevenue source-present dry-run | 174 | ✅ PASS |

---

## Forbidden Diff

`CLEAN_NO_FORBIDDEN_SOURCE_EDITS` — runtime noise only (prisma/dev.db, llm_usage.jsonl)

## Forbidden Claims Scan

`CLEAN` — no `entersAlphaScore=true`, no Prisma import, no investment advice claims

---

## Classification

`P38_TEST_BASELINE_PASS`
