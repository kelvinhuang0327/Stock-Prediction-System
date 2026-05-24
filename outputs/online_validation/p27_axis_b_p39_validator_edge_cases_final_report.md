# P27 — Axis B v4: P39 Validator Edge Cases — Final Report

**Classification**: `P27_AXIS_B_P39_VALIDATOR_EDGE_CASES_READY`
**Date**: 2026-05-24
**Branch**: `main` (HEAD `d6a4e35` — unchanged, P27 not yet committed)

---

## Summary

P27 created 25 new fixture-backed tests covering edge cases of
`validatePaperSimulationInputBundle` and `buildPaperSimulationInputBundle`
from `src/lib/onlineValidation/p39/PaperSimulationInputContractBuilder.ts`.

No source files were modified. No DB access. No scoring, optimizer, or
real-backtest semantics. `entersAlphaScore=false`, `paperOnly=true`,
`dryRunOnly=true` enforced in every fixture and assertion.

---

## Test File

`src/lib/simulation/__tests__/p27_axis_b_p39_validator_edge_cases.test.ts`

---

## Test Groups & Coverage (T21–T25)

### Group T21 — Per-source governance flag injection rejection (5 tests)

| ID    | Description | Result |
|-------|-------------|--------|
| T21.1 | validator rejects `eligibleSources` entry with `entersAlphaScore=true`; error mentions entry `sourceName` | ✅ PASS |
| T21.2 | validator rejects `eligibleSources` entry with `paperOnly=false`; error mentions entry `sourceName` | ✅ PASS |
| T21.3 | validator rejects bundle with `notRealBacktest=false`; error mentions field name | ✅ PASS |
| T21.4 | validator rejects bundle with `noInvestmentAdvice=false`; error mentions field name | ✅ PASS |
| T21.5 | validator rejects bundle with `noBuySellActionSemantics=false`; error mentions field name | ✅ PASS |

### Group T22 — Forbidden field injection at bundle root (5 tests)

| ID    | Description | Result |
|-------|-------------|--------|
| T22.1 | `alphaScore` key at bundle root → caught; error mentions `"alphaScore"` | ✅ PASS |
| T22.2 | `recommendation` key at bundle root → caught; error mentions `"recommendation"` | ✅ PASS |
| T22.3 | `winRate` key at bundle root → caught; error mentions `"winRate"` | ✅ PASS |
| T22.4 | `alphaScore` + `backtestResult` + `profit` injected → `errors.length >= 3` | ✅ PASS |
| T22.5 | Forbidden field injection does not corrupt validator result invariants (`entersAlphaScore=false`, `paperOnly=true`) | ✅ PASS |

### Group T23 — Entry ordering, deduplication, and status routing (5 tests)

| ID    | Description | Result |
|-------|-------------|--------|
| T23.1 | Entries in `[Regime, Quote, MonthlyRevenue]` order → `eligibleSources` in same input order | ✅ PASS |
| T23.2 | Duplicate eligible entry (`MonthlyRevenue` twice) → two entries in `eligibleSources` (no dedup) | ✅ PASS |
| T23.3 | Entry with `currentGateStatus=""` → `sourceTrace` stored as `""` (not filtered or nulled) | ✅ PASS |
| T23.4 | Same `sourceName` once eligible + once blocked → one in each partition | ✅ PASS |
| T23.5 | `CONSUMER_READY_AUDIT_ONLY` entry → `blockedSources` with `blockedStatus = "BLOCKED_AUTHORIZATION"` | ✅ PASS |

### Group T24 — Null/mode tamper and validator type safety (5 tests)

| ID    | Description | Result |
|-------|-------------|--------|
| T24.1 | `null` passed to validator → `valid=false`; error mentions `"non-null"` | ✅ PASS |
| T24.2 | Wrong `mode` string → `valid=false`; error mentions `"mode"` | ✅ PASS |
| T24.3 | `entersAlphaScore=true` at root → error mentions `"entersAlphaScore"` | ✅ PASS |
| T24.4 | `disclaimer=undefined` → `valid=false`; error mentions `"disclaimer"` | ✅ PASS |
| T24.5 | `disclaimer` shorter than 10 chars → `valid=false`; error mentions `"disclaimer"` | ✅ PASS |

### Group T25 — Repeated stability, empty source list, full flag tamper (5 tests)

| ID    | Description | Result |
|-------|-------------|--------|
| T25.1 | Three successive validations of same bundle yield identical result (strong determinism) | ✅ PASS |
| T25.2 | 3 forbidden fields injected → `errors.length >= 3` | ✅ PASS |
| T25.3 | All 9 root governance flags wrong → `errors.length >= 9` | ✅ PASS |
| T25.4 | Empty object `{}` → `valid=false` with multiple errors | ✅ PASS |
| T25.5 | Default bundle with `eligibleSources=[]` → `valid=true` (empty list is not a contract violation) | ✅ PASS |

---

## Verification Results

| Scope | Count | Status |
|-------|-------|--------|
| P27 isolated | 25/25 | ✅ PASS |
| Simulation suite (5 files) | 125/125 | ✅ PASS |
| Research suite | 257/257 | ✅ PASS |
| OnlineValidation suite | 4846/4846 | ✅ PASS |
| **Grand total** | **5228/5228** | ✅ PASS |

---

## Axis B Accumulation (post-P27)

| Axis | File | Tests | Status |
|------|------|-------|--------|
| Axis B v1 (P4) | `p4_golden_fixture_validation.test.ts` | 25 (T1–T5) | ✅ committed |
| Axis B v1.5 (P6) | `p6_fixture_result_contract_extension.test.ts` | 25 (T6–T10) | ✅ committed |
| Axis B v2 (P23) | `p23_axis_b_dryrun_validation_extension.test.ts` | 25 (T11–T15) | ✅ committed (`386ca2c`) |
| Axis B v3 (P25) | `p25_axis_b_p39_bundle_boundary.test.ts` | 25 (T16–T20) | ✅ committed (`d6a4e35`) |
| Axis B v4 (P27) | `p27_axis_b_p39_validator_edge_cases.test.ts` | 25 (T21–T25) | 🔄 ready to commit |
| **Total** | 5 files | **125** | 100 committed, 25 pending |

---

## Working Tree (pre-commit state)

```
 M outputs/online_validation/p28c_renderer_only_repair_9case_before_after.json   ← USER_DECISION
 M outputs/online_validation/p28d_9case_integrated_review_validation.json         ← USER_DECISION
 M outputs/online_validation/p28d_p3_p19_renderer_regression_sweep.json           ← USER_DECISION
?? 00-StockPlan/20260514/                                                          ← USER_DECISION
?? 00-StockPlan/20260515/                                                          ← USER_DECISION
?? outputs/online_validation/p20_documentation_commit_or_next_axis_final_report.md
?? outputs/online_validation/p22_p21_commit_or_next_axis_final_report.md
?? outputs/online_validation/p24_p23_commit_or_axis_b_v3_final_report.md
?? outputs/online_validation/p26_p25_commit_or_axis_b_v4_final_report.md
?? src/lib/simulation/__tests__/p27_axis_b_p39_validator_edge_cases.test.ts       ← P27 NEW
?? outputs/online_validation/p27_axis_b_p39_validator_edge_cases_final_report.md  ← THIS FILE
```

---

## Governance Constraints Verified

- NO `prisma/**` changes ✅
- NO `data/**` changes ✅
- NO source file modifications ✅
- DB SHA unchanged: `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8` ✅
- `entersAlphaScore=false` in every fixture and every assertion ✅
- `paperOnly=true` in every fixture and every assertion ✅
- `dryRunOnly=true` in every fixture ✅
- No investment advice / no buy-sell-hold / no PnL / no ROI / no win-rate claims ✅

---

## Next Step

```
[Stock Prediction System] P28 — Commit P27 Axis B v4 OR Begin Next Axis

[A] YES commit P27 axis B v4   — stage p27 test file + final report,
                                  verify 5228/5228, commit "P27: add Axis B v4 P39 validator edge cases",
                                  push, observe CI

[B] begin axis B v5            — further P39 edge cases

[C] begin axis C               — new axis (scope TBD)

[D] YES commit pending docs    — batch p20 + p22 + p24 + p26 + p27 reports

Recommended: [A] YES commit P27 axis B v4
```
