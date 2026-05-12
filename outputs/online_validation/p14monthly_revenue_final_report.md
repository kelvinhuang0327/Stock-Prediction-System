# P14-HARDRESET: MonthlyRevenue PIT Migration Approval Gate — Final Report

> **Disclaimer:** This report does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. All validation is fixture-only. No production DB was written.

**Generated:** 2025-05-12  
**Phase:** P14  
**Commit:** caf44f8

---

## Final Classification

```
P14_MONTHLY_REVENUE_AWAITING_SCHEMA_MIGRATION_APPROVAL
```

**Reason:** Approval token `P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY` was NOT present in the prompt.  
All artifacts were produced as dry-run / draft. `productionApplyAllowed = false` on all outputs.

---

## 1. Objective

Implement a migration approval gate for the `MonthlyRevenue` Point-in-Time (PIT) leakage fix identified in P13. The MonthlyRevenue table lacks a `releaseDate` field; Taiwan 月營收 is released on the 10th of the following month. Without `releaseDate`, any query that filters by `year/month` or applies no date gate at all leaks future revenue data into training.

This phase:
- Builds the approval gate infrastructure
- Produces a schema migration draft (dry-run only)
- Documents query gate proposals for two leaking code paths
- Validates all logic via fixture-only dry-run
- Does NOT write to production DB
- Does NOT apply schema migration
- Does NOT modify frozen corpora

---

## 2. P13 Foundation (Confirmed Intact)

| Artifact | Status |
|----------|--------|
| `p13monthly_revenue_migration_plan.json` | ✅ Present, `writesProductionDb: false` |
| `p13monthly_revenue_source_audit.json` | ✅ Present, `overallRisk: HIGH` |
| `p13monthly_revenue_pit_gate_validation.json` | ✅ Present, `passed: 35/35` |
| `p13monthly_revenue_final_report.md` | ✅ Present, contains `P13_MONTHLY_REVENUE_REQUIRES_SCHEMA_MIGRATION_APPROVAL` |
| `p12pit_feature_contract_v0.json` | ✅ Present |

---

## 3. Approval Gate (PART A)

- Approval token: `P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY` — **NOT present**
- `approvalStatus`: `NOT_APPROVED`
- `allowsDryRunArtifacts`: `true`
- `allowsProductionApply`: `false` (hardcoded — cannot be overridden)
- Preflight: **PASS** (all P13 artifacts present, frozen corpus verified)

---

## 4. Migration Gate Utilities (PART B)

**File:** `src/lib/onlineValidation/P14MonthlyRevenueMigrationGateUtils.ts`

Key exports:

| Function | Purpose |
|----------|---------|
| `detectApprovalToken` | Checks for approval token; returns `approvalStatus`, `allowsProductionApply` always `false` |
| `validateMigrationApprovalScope` | Returns scope: `canModifyProductionDb: false`, `canModifyCorpus: false` always |
| `buildMonthlyRevenueMigrationDraft` | Draft with `releaseDate`, `releaseDateSource`, `releaseDateConfidence` fields |
| `buildMonthlyRevenueRollbackDraft` | Rollback strategies A (null inferred) and B (drop columns) |
| `validateMigrationDraftSafety` | Validates `productionApplyAllowed===false`, required fields |
| `buildMonthlyRevenueQueryGateContract` | 7-rule contract (QG-001..QG-007) |
| `validateMonthlyRevenueQueryGate` | PIT gate check: explicit/inferred releaseDate vs asOfDate |
| `summarizeMigrationReadiness` | Final classification with `productionApplyAllowed: false` always |
| `scanForbiddenClaims` | Scans for ROI/profit/alpha/win-rate/outperform/buy/sell/guaranteed |

**Taiwan Revenue Release Rule:**
- `TAIWAN_REVENUE_RELEASE_DAY = 10`
- Month M → released on day 10 of month M+1 (December → January 10 of next year)
- Deterministic inference, no realized-return data used

---

## 5. Migration Draft (PART C)

**File:** `outputs/online_validation/p14monthly_revenue_migration_draft.json`

| Property | Value |
|----------|-------|
| `draftId` | `p14-monthly-revenue-migration-draft-v0` |
| `productionApplyAllowed` | `false` |
| `safetyValidation.status` | `SAFE_DRY_RUN_ONLY` |
| Fields proposed | `releaseDate DateTime?`, `releaseDateSource String?`, `releaseDateConfidence String?` |
| Backfill source label | `INFERRED_NEXT_MONTH_10TH` |
| Forbidden backfill inputs | `outcomePrice`, `returnPct`, `realizedReturnClass`, `futurePrice` |

**Rollback draft:** Two strategies: (A) set fields to NULL (soft rollback), (B) drop columns (hard rollback). Both `productionApplyAllowed = false`.

---

## 6. Query Gate Proposals (PART D)

**File:** `outputs/online_validation/p14monthly_revenue_query_gate_proposal.json`

### 7 Query Gate Rules

| Rule | Condition | Result |
|------|-----------|--------|
| QG-001 | `releaseDateSource = AUTHORITATIVE`, `releaseDate <= asOfDate` | AVAILABLE |
| QG-002 | `releaseDateSource = AUTHORITATIVE`, `releaseDate > asOfDate` | UNAVAILABLE_RELEASE_DATE_FUTURE |
| QG-003 | `releaseDateSource = AUTHORITATIVE`, invalid releaseDate | UNAVAILABLE_INVALID_RELEASE_DATE |
| QG-004 | No explicit releaseDate, `allowInferredReleaseDate = true`, inferred `<= asOfDate` | AVAILABLE (INFERRED) |
| QG-005 | No explicit releaseDate, `allowInferredReleaseDate = true`, inferred `> asOfDate` | UNAVAILABLE_RELEASE_DATE_FUTURE |
| QG-006 | No explicit releaseDate, `allowInferredReleaseDate = false` | UNAVAILABLE_INFERRED_NOT_ALLOWED |
| QG-007 | Missing year/month | UNAVAILABLE_MISSING_PERIOD |

### Patch Proposals

| File | Risk | Issue | Status |
|------|------|-------|--------|
| `src/lib/analysis/RuleBasedStockAnalyzer.ts` | HIGH | year/month gate leaks Jan 2024 revenue on asOf=2024-02-09 | Proposal only — requires P15 |
| `src/lib/fundamentals/FundamentalResearchService.ts` | HIGH | No asOf gate at all | Proposal only — requires P15 |
| `src/lib/fundamentals/StockFundamentalSnapshot.ts` | MEDIUM | MonthlyRevenueLike interface missing releaseDate | Proposal only — requires P15 |

**Neither patch has been applied.** Both require P15 schema migration approval.

---

## 7. Fixture Dry-Run (PART E)

**File:** `outputs/online_validation/p14monthly_revenue_fixture_dry_run.json`

| Test Case | Description | Result |
|-----------|-------------|--------|
| TC-01 | Explicit releaseDate=2024-02-10, asOf=2024-02-09 | ✅ PASS — unavailable |
| TC-02 | Explicit releaseDate=2024-02-10, asOf=2024-02-10 | ✅ PASS — available |
| TC-03 | Inferred, allowInferred=true, year=2024 month=1, asOf=2024-02-10 | ✅ PASS — available |
| TC-04 | Inferred, allowInferred=false | ✅ PASS — unavailable |
| TC-05 | Dec 2024 inferred → Jan 10 2025 | ✅ PASS — available on 2025-01-10 |
| TC-06 | Missing year/month | ✅ PASS — UNAVAILABLE_MISSING_PERIOD |
| TC-07 | Invalid releaseDate | ✅ PASS — UNAVAILABLE_INVALID_RELEASE_DATE |
| TC-08 | Forbidden outcome fields (outcomePrice/returnPct/realizedReturnClass) | ✅ PASS — flagged |
| TC-09 | AUTHORITATIVE → confidence=HIGH | ✅ PASS |
| TC-09b | Inferred → confidence=LOW_TO_MEDIUM | ✅ PASS |
| TC-10 | Rollback draft exists, productionApplyAllowed=false | ✅ PASS |

**Status:** 11/11 PASS. `validationStatus: PASS`

---

## 8. Tests (PART F)

**File:** `src/lib/onlineValidation/__tests__/p14monthly_revenue_migration_gate_utils.test.ts`

| Suite | Tests | Result |
|-------|-------|--------|
| `detectApprovalToken` | 5 | ✅ PASS |
| `validateMigrationApprovalScope` | 4 | ✅ PASS |
| `buildMonthlyRevenueMigrationDraft` | 10 | ✅ PASS |
| `buildMonthlyRevenueRollbackDraft` | 5 | ✅ PASS |
| `validateMigrationDraftSafety` | 4 | ✅ PASS |
| `buildMonthlyRevenueQueryGateContract` | 5 | ✅ PASS |
| `validateMonthlyRevenueQueryGate — explicit` | 3 | ✅ PASS |
| `validateMonthlyRevenueQueryGate — inferred` | 5 | ✅ PASS |
| `validateMonthlyRevenueQueryGate — invalid/missing` | 5 | ✅ PASS |
| `scanForbiddenClaims` | 14 | ✅ PASS |
| `summarizeMigrationReadiness` | 6 | ✅ PASS |
| **Total** | **67** | **✅ 67/67 PASS** |

Full suite (onlineValidation + data): **1438/1438 PASS**

---

## 9. Forbidden Claims Scan (PART G)

All matches for ROI / win-rate / outperform / guaranteed / investment recommendation were found **only** in:
- Disclaimer lines
- Non-goal declarations
- Scanner pattern definitions (the scanner's own regex patterns)
- Test harness (scanner test strings)

**Result: CLEAN — zero active forbidden claims**

---

## 10. Artifact Validation (PART H)

| Check | Value |
|-------|-------|
| `preflight.approvalStatus` | `NOT_APPROVED` ✅ |
| `preflight.approvalTokenPresent` | `false` ✅ |
| `preflight.preflightStatus` | `PASS` ✅ |
| `preflight.productionDbWritten` | `false` ✅ |
| `preflight.finalClassification` | `P14_MONTHLY_REVENUE_AWAITING_SCHEMA_MIGRATION_APPROVAL` ✅ |
| `draft.proposedSchemaChange` | present ✅ |
| `draft.productionApplyAllowed` | `false` ✅ |
| `draft.safetyValidation.status` | `SAFE_DRY_RUN_ONLY` ✅ |
| `draft schema releaseDate field` | present ✅ |
| `proposal.queryGateRules` | 7 rules ✅ |
| `proposal.productionApplyAllowed` | `false` ✅ |
| `proposal.proposals` | 3 proposals ✅ |
| `dryRun.validationStatus` | `PASS` ✅ |
| `dryRun.productionDbWritten` | `false` ✅ |
| `dryRun.passed` | 11 ✅ |
| Frozen corpus (4 files) | all ≥ 60 lines ✅ |

**Result: 20/20 PASS**

---

## 11. Git Commit (PART I)

**Commit:** `caf44f8`  
**Message:** `P14-HARDRESET: MonthlyRevenue PIT migration approval gate and dry-run`

**16 files committed:**
- `src/lib/onlineValidation/P14MonthlyRevenueMigrationGateUtils.ts`
- `src/lib/onlineValidation/__tests__/p14monthly_revenue_migration_gate_utils.test.ts`
- `scripts/run-p14-approval-preflight.js`
- `scripts/build-p14-monthly-revenue-migration-draft.js`
- `scripts/build-p14-monthly-revenue-query-gate-proposal.js`
- `scripts/validate-p14-monthly-revenue-fixture-dry-run.js`
- `scripts/run-p14-artifact-validation.js`
- `outputs/online_validation/p14monthly_revenue_approval_preflight.json` + `.md`
- `outputs/online_validation/p14monthly_revenue_migration_draft.json` + `.md`
- `outputs/online_validation/p14monthly_revenue_rollback_draft.md`
- `outputs/online_validation/p14monthly_revenue_query_gate_proposal.json` + `.md`
- `outputs/online_validation/p14monthly_revenue_fixture_dry_run.json` + `.md`

---

## 12. Non-Goals

- Does NOT write production DB
- Does NOT apply Prisma migration
- Does NOT modify frozen corpora (P0/P1/P3/P4)
- Does NOT modify scoring formulas (`alphaScore`, `recommendationBucket`)
- Does NOT compute ROI, profit, alpha, win-rate, edge, or outperformance
- Does NOT constitute investment advice
- `productionApplyAllowed = false` on ALL draft artifacts (hardcoded, cannot be overridden)

---

## 13. PIT Leakage Summary (Inherited from P13)

| Leakage Path | Risk | Proposed Fix | Requires |
|--------------|------|--------------|---------|
| `RuleBasedStockAnalyzer.ts` year/month gate | HIGH | `releaseDate <= asOfDate` filter | P15 migration |
| `FundamentalResearchService.ts` no asOf gate | HIGH | Add `asOf` param + `releaseDate <= asOf` | P15 migration |
| `MonthlyRevenueLike` interface missing `releaseDate` | MEDIUM | Add optional fields | P15 migration |
| Schema missing `releaseDate` | BLOCKER | Add `releaseDate DateTime?` + backfill | P15 migration |

---

## 14. Taiwan Revenue Release Rule

```
TAIWAN_REVENUE_RELEASE_DAY = 10
releaseDate(year, month):
  if month == 12 → DATE(year+1, 1, 10)
  else           → DATE(year, month+1, 10)

Examples:
  Jan 2024 → 2024-02-10
  Dec 2024 → 2025-01-10
  Nov 2023 → 2023-12-10
```

Inference is deterministic. No realized-return data is used in the backfill.

---

## 15. Invariants Preserved

| Invariant | Status |
|-----------|--------|
| `productionApplyAllowed = false` on all drafts | ✅ Verified |
| No production DB writes | ✅ Verified |
| Frozen corpus unchanged | ✅ 4 files verified |
| No forbidden outcome fields (`outcomePrice`, `returnPct`, `realizedReturnClass`, etc.) in gate logic | ✅ Verified |
| No ROI / profit / alpha / win-rate claims | ✅ CLEAN scan |
| 1438/1438 tests pass (no regression) | ✅ Verified |

---

## 16. Next Steps

1. **If approval missing (current state):** Proceed to **P15 — Migration Approval Review**. Operator must provide token `P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY` to unlock Prisma schema edit.
2. **If approval granted in P15:** Apply `prisma migrate dev` with `releaseDate` field. Run backfill SQL. Re-run fixture dry-run against real DB (read-only verification).
3. **After schema migration:** Apply query gate patches to `RuleBasedStockAnalyzer.ts` and `FundamentalResearchService.ts`.
4. **After patches:** Update `MonthlyRevenueLike` interface. Re-run full test suite.
5. **After all patches:** Re-run PIT gate validation (P13 contract) — target: 35/35 PASS with real DB.

---

## Summary

| Metric | Result |
|--------|--------|
| Phase | P14 |
| Final classification | `P14_MONTHLY_REVENUE_AWAITING_SCHEMA_MIGRATION_APPROVAL` |
| Approval token present | ❌ NOT_APPROVED |
| Production DB written | ❌ No |
| Tests | ✅ 67/67 PASS |
| Full suite | ✅ 1438/1438 PASS |
| Fixture dry-run | ✅ 11/11 PASS |
| Artifact validation | ✅ 20/20 PASS |
| Forbidden claims | ✅ CLEAN |
| Commit | `caf44f8` |
