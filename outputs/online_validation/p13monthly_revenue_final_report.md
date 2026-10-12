# P13-HARDRESET: MonthlyRevenue releaseDate PIT Repair Contract — Final Report

> **Disclaimer:** Observability and contract documentation only. No production DB writes. No investment recommendations. No ROI/win-rate/alpha/profit claims. No corpus modifications. No scoring formula changes.

**Phase:** P13-HARDRESET  
**Date:** 2026-05-12  
**Commit:** `9457615`  
**Final Classification:** P13_MONTHLY_REVENUE_REQUIRES_SCHEMA_MIGRATION_APPROVAL

---

## 1. Executive Summary

P13-HARDRESET documents and contracts the MonthlyRevenue PIT risk in the Stock Prediction System. The `MonthlyRevenue` table in the database lacks a `releaseDate` field. All query paths currently gate data availability by the **reporting period** (`year <= asOfYear AND month <= asOfMonth`) rather than the actual public announcement date.

Taiwan monthly revenue (月營收) is officially released by the **10th calendar day of the following month** (TWSE/MOPS regulation). This creates a **HIGH PIT risk**: queries may return data not yet publicly disclosed on the asOfDate.

This phase establishes:
- A full PIT repair contract (`P13MonthlyRevenuePitUtils.ts`)
- A schema-only source audit
- A non-production migration plan (awaiting approval)
- A deterministic PIT gate validation suite (35/35 PASS)
- 39 new unit tests (1253 total PASS)

No production DB has been modified. No corpora have been altered. Schema migration requires explicit approval before proceeding to P14.

---

## 2. Problem Statement

| Dimension | Current State | PIT Risk |
|-----------|--------------|---------|
| Schema | `MonthlyRevenue` has no `releaseDate`, `releaseDateSource`, `releaseDateConfidence` | HIGH |
| `RuleBasedStockAnalyzer` | Gates by `(year < asOfYear) OR (year = asOfYear AND month <= asOfMonth)` | HIGH |
| `FundamentalResearchService` | `findMany({ where: { stockId } })` — no asOf gate at all | HIGH |
| `MonthlyRevenueLike` interface | No `releaseDate` field | MEDIUM |
| Inference fallback | `INFERRED_NEXT_MONTH_10TH` rule deterministic, but not yet stored | MEDIUM |

### Root Cause

Without `releaseDate`, a query with `asOfDate = 2026-02-05` includes January 2026 revenue data, which was not officially released until February 10, 2026. This leaks future knowledge into historical simulations and backtests.

---

## 3. Part Execution Summary

| Part | Status | Detail |
|------|--------|--------|
| A: Preflight audit | ✅ PASS | P12 artifacts verified, P3 corpus 4500/4500 |
| B: P13MonthlyRevenuePitUtils.ts | ✅ DONE | 8 exports, full PIT contract, scanner, validator |
| C: Source audit | ✅ DONE | SCHEMA_ONLY, releaseDate MISSING, risk HIGH |
| D: Migration plan | ✅ DONE | JSON + MD, non-production draft, proposedSchemaChange present |
| E: PIT gate validation | ✅ PASS | 35/35 cases, 12 distinct test scenarios |
| F: Tests | ✅ PASS | 39/39 new tests, 1253 total suite passes |
| G: Forbidden claims scan | ✅ PASS | All matches in disclaimers, non-goals, or scanner pattern definitions |
| H: Artifact validation | ✅ PASS | All 4 JSON files parse, all required fields present, corpora frozen |
| I: Git commit | ✅ DONE | Commit `9457615`, 13 files, 2860 insertions |
| J: Final report | ✅ This document | |

---

## 4. PIT Contract (P13-MR Requirements)

| Requirement ID | Description | Blocking |
|----------------|-------------|---------|
| P13-MR-001 | `releaseDate` must gate all MonthlyRevenue queries | ✅ Yes |
| P13-MR-002 | Inference must use deterministic 10th-of-next-month rule only | ✅ Yes |
| P13-MR-003 | Inferred releaseDates must be labeled `INFERRED_NEXT_MONTH_10TH` | ✅ Yes |
| P13-MR-004 | No outcome data (returnPct, realizedReturnClass, etc.) in releaseDate computation | ✅ Yes |
| P13-MR-005 | Both `RuleBasedStockAnalyzer` and `FundamentalResearchService` must adopt `releaseDate` gate | ✅ Yes |

Contract version: `p13-monthly-revenue-pit-contract-v0`

---

## 5. Affected Code Paths

| File | Issue | Required Fix (P14) |
|------|-------|-------------------|
| `prisma/schema.prisma` | No releaseDate field | Add `releaseDate DateTime?`, `releaseDateSource String?`, `releaseDateConfidence String?` |
| `src/lib/analysis/RuleBasedStockAnalyzer.ts` | Year/month period gate (HIGH PIT risk) | Replace with `releaseDate: { lte: asOfDate }` |
| `src/lib/fundamentals/FundamentalResearchService.ts` | No asOf gate at all (HIGH PIT risk) | Add asOf parameter, gate by `releaseDate: { lte: asOf }` |
| `src/lib/fundamentals/StockFundamentalSnapshot.ts` | `MonthlyRevenueLike` interface missing `releaseDate` | Add `releaseDate?: string \| null` |

---

## 6. Inference Rule (Deterministic)

```
IF month = 12: releaseDate = DATE(year+1, 1, 10)
ELSE:          releaseDate = DATE(year, month+1, 10)
```

Source: Taiwan TWSE/MOPS official regulation — monthly revenue announced by the 10th of the following calendar month.

No realized return data, no stock price, no outcome fields may be used as inputs.

---

## 7. PIT Gate Validation Results

35/35 test cases PASS across 12 scenarios:

1. Missing releaseDate, Jan 2024 → inferred `2024-02-10`; asOf `2024-02-09` → unavailable; asOf `2024-02-10` → available
2. Explicit releaseDate (AUTHORITATIVE) overrides inference, repairNeeded=false
3. Missing year/month → always unavailable
4. releaseDate after asOfDate → unavailable
5. releaseDate equal/before asOfDate → available
6. Outcome fields in record ignored by inference
7. December → January year rollover correct
8. Invalid releaseDate format → INVALID source
9. Invalid asOfDate → unavailable
10. AUTHORITATIVE date passes validation
11. Inferred date generates repairNeeded warning
12. Missing year/month → validation invalid

---

## 8. Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| `p13monthly_revenue_pit_utils.test.ts` (new) | 39 | ✅ PASS |
| Full `onlineValidation/__tests__` suite | 1253 | ✅ PASS |
| `src/lib/data/__tests__` | Not re-run (unchanged) | ✅ Pre-existing |

---

## 9. Frozen Corpus Status

| Corpus | Line Count | Status |
|--------|-----------|--------|
| `simulation_snapshot_corpus.jsonl` | 60 | ✅ FROZEN |
| `p0hardreset_historical_replay_corpus.jsonl` | 4500 | ✅ FROZEN |
| `p1baseline_historical_replay_corpus.jsonl` | 9900 | ✅ FROZEN |
| `p3active_scoring_historical_replay_corpus.jsonl` | 4500 | ✅ FROZEN |

---

## 10. Migration Plan Status

| Field | Value |
|-------|-------|
| Plan ID | `p13-monthly-revenue-migration-plan-v0` |
| Production DB writes | **NONE** — draft only |
| Approval status | NOT APPROVED |
| Backfill rule | `releaseDate = 10th of following month` |
| Backfill source label | `INFERRED_NEXT_MONTH_10TH` |
| Rollback strategy | Null inferred releaseDates or drop columns (Option A/B) |

The migration plan is **non-production only**. Execution requires:
1. Explicit written approval from authorized operator
2. Staging environment validation
3. Post-backfill validation (0 NULL releaseDates after backfill)
4. Code path gate update verification

---

## 11. Forbidden Claims Audit

All grep matches for ROI/win-rate/alpha/profit/guaranteed/buy/sell in P13 artifacts appear **exclusively** in:
- Disclaimer lines
- Non-goals arrays
- Scanner pattern definition arrays (`FORBIDDEN_CLAIM_PATTERNS`)
- Test fixture strings (`scanForbiddenClaims` unit tests)

**No actual forbidden claims present in P13 artifacts.**

---

## 12. Non-Goals Confirmed

This phase did NOT:
- Write to any production database
- Modify scoring formulas, alphaScore, or recommendationBucket
- Modify P0/P1/P3/P4 corpus or simulation_snapshot_corpus
- Produce ROI figures, win rates, alpha calculations, profit estimates, or performance guarantees
- Tune releaseDate based on realized returns or outcome data
- Modify ManualReview* modules

---

## 13. What P14 Must Do

P14 (requires separate approval before execution):

1. **Apply Prisma migration** — add `releaseDate`, `releaseDateSource`, `releaseDateConfidence` to `MonthlyRevenue`
2. **Backfill** — run `INFERRED_NEXT_MONTH_10TH` backfill SQL for all records where `releaseDate IS NULL`
3. **Update `RuleBasedStockAnalyzer`** — replace year/month gate with `releaseDate: { lte: asOfDate }` gate
4. **Update `FundamentalResearchService`** — add asOf parameter, gate by releaseDate
5. **Update `MonthlyRevenueLike` interface** — add optional `releaseDate` field
6. **Validate** — run PIT gate validation script, confirm 0 NULL releaseDates, run full test suite

---

## 14. Artifacts Produced

| Artifact | Path |
|----------|------|
| PIT utilities | `src/lib/onlineValidation/P13MonthlyRevenuePitUtils.ts` |
| Tests | `src/lib/onlineValidation/__tests__/p13monthly_revenue_pit_utils.test.ts` |
| Preflight audit | `outputs/online_validation/p13monthly_revenue_preflight_audit.json/.md` |
| Source audit | `outputs/online_validation/p13monthly_revenue_source_audit.json/.md` |
| Migration plan | `outputs/online_validation/p13monthly_revenue_migration_plan.json/.md` |
| PIT gate validation | `outputs/online_validation/p13monthly_revenue_pit_gate_validation.json/.md` |
| Preflight script | `scripts/run-p13-preflight-audit.js` |
| Source audit script | `scripts/audit-p13-monthly-revenue-source.js` |
| PIT gate script | `scripts/validate-p13-monthly-revenue-pit-gate.js` |
| P12 validation | `scripts/validate-p12-artifacts.py` |

---

## 15. Commit Record

| Commit | Description |
|--------|-------------|
| `9457615` | P13-HARDRESET: MonthlyRevenue releaseDate PIT repair contract (this phase) |
| `6416486` | P12-HARDRESET: final report (previous phase) |
| `794c44d` | P12-HARDRESET: PIT feature contract v0 (previous phase) |

---

## 16. Risk Register

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Production query returns unreleased revenue data | HIGH | Schema migration + gate change (P14) |
| Backfill uses incorrect year rollover | LOW | Validated in 39 unit tests + PIT gate 35/35 |
| FundamentalResearchService returns all-time revenue with no asOf guard | HIGH | Documented; fix in P14 |
| releaseDate NULL after backfill | MEDIUM | Post-backfill validation query required |
| Authoritative data not obtained from TWSE/MOPS | LOW | Inferred fallback provides conservative `LOW_TO_MEDIUM` confidence |

---

## 17. Final Classification

```
P13_MONTHLY_REVENUE_REQUIRES_SCHEMA_MIGRATION_APPROVAL
```

**Rationale:** The PIT repair contract is complete. The migration plan is fully drafted with non-production backfill SQL, rollback strategy, and validation requirements. All 10 parts of P13 have passed. However, the actual schema migration (adding `releaseDate` to the `MonthlyRevenue` table) and associated code path changes require explicit approval from an authorized operator before P14 execution begins.

---

*P13-HARDRESET | 2026-05-12 | Commit 9457615*
