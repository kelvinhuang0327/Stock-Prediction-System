# P26F2-HARDRESET: MonthlyRevenue ReleaseDate Population — Final Report

## Section 1: Phase Overview

**Phase**: P26F2-HARDRESET  
**Date**: 2026-05-13  
**Sprint**: 7th sprint in P26A-F2 chain  
**Goal**: Add MonthlyRevenue releaseDate population rule + dry-run candidate backfill  

## Section 2: Prior Sprint Context

- **P26A-F** (b330b42 → 40152ce): Full PIT adapter chain implemented
- **P26F** (40152ce): MonthlyRevenue source mapping implemented; all releaseDate=null → 0% coverage

## Section 3: DB Schema State

| Field | Value |
|---|---|
| Prisma MonthlyRevenue model | ✅ Present |
| `releaseDate` in Prisma schema | ✅ Yes (draft migration only) |
| Migration applied | ❌ No |
| DB column exists | ❌ No |
| DB actual columns | id, stockId, year, month, revenue, yoyGrowth, momGrowth, createdAt |
| DB row count | 2143 |
| Year/Month distribution | 2026-02: 1070 rows, 2026-03: 1073 rows |

## Section 4: Pre-flight Classification

**P26F_SOURCE_MAPPING_IMPLEMENTED_BUT_NO_REAL_COVERAGE**

Source mode: REAL_SOURCE_PRESENT_NO_RELEASE_DATE  
Matched rows (P26F): 0

## Section 5: Frozen Code Baseline

| File | SHA256 |
|---|---|
| ActiveScoringSnapshotBuilder.ts | 063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d |
| RuleBasedStockAnalyzer.ts | bc3716cc8e74be304f2e262aac586a61760bb59d6c95e82a575c38e03ea7373d |
| SignalFusionEngine.ts | b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4 |

All verified unchanged ✅

## Section 6: Dry-Run Candidate Backfill

**2143 candidate releaseDates built.**

- Inference rule: INFERRED_NEXT_MONTH_10TH
- Formula: `candidateReleaseDate = (year, month+1, day=10)` (Dec → Jan of next year)
- Candidate date distribution:
  - 2026-03-10: 1070 rows (from 2026-02 revenue)
  - 2026-04-10: 1073 rows (from 2026-03 revenue)
- All candidates: `dryRunOnly=true`, `productionWriteAllowed=false`
- Output: `outputs/online_validation/p26f2_monthly_revenue_release_date_candidates.jsonl`
- DB writes: **0** (verified by re-query after script)

## Section 7: Coverage Preview

**Matched rows = 0** (zero coverage).

| Metric | Value |
|---|---|
| P3 corpus rows | 4500 |
| P19 corpus rows | 4500 |
| Candidate rows | 2143 |
| Candidate date range | 2026-03-10 → 2026-04-10 |
| Corpus asOfDate range | 2025-10-14 → 2026-02-11 |
| P3 matched | 0 |
| P19 matched | 0 |
| Coverage ratio | 0 |

**Reason**: candidateDates (2026-03-10, 2026-04-10) all exceed corpus max asOfDate (2026-02-11).

## Section 8: PIT Safety Validation — 13/13 PASS

Key PIT rules verified:
- `candidateReleaseDate` is the **only** visibility gate
- `year`, `month`, `createdAt` do NOT gate visibility
- null `candidateReleaseDate` → not visible
- "INVALID" `candidateReleaseDate` → not visible
- `candidateReleaseDate <= asOfDate` → visible
- `candidateReleaseDate > asOfDate` → not visible
- December correctly rolls over to January of next year
- Deterministic: same input → same output
- All candidates: `dryRunOnly=true`, `productionWriteAllowed=false`
- No outcome fields in candidates

## Section 9: Scoring Invariance — PASS

| Metric | Value |
|---|---|
| Scoring path sha256 unchanged | ✅ true |
| Frozen corpus sha256 unchanged | ✅ true |
| Candidate enters scoring | ❌ false |
| Mismatched alphaScore count | 0 |
| Mismatched bucket count | 0 |

No scoring formula was touched in P26F2.

## Section 10: Quality Gate — PASS

| Check | Result |
|---|---|
| JSONL parseable | ✅ |
| Candidate count == 2143 | ✅ |
| All dryRunOnly=true | ✅ |
| All productionWriteAllowed=false | ✅ |
| No outcome fields | ✅ |
| All required fields present | ✅ |
| DB row count unchanged | ✅ |
| Frozen corpus sha256 unchanged | ✅ |
| No forbidden claims | ✅ |
| candidateReleaseDate format valid | ✅ |

## Section 11: Frozen Corpus Verification

| Corpus | Count |
|---|---|
| simulation_snapshot_corpus.jsonl | 60 |
| p0hardreset_historical_replay_corpus.jsonl | 4500 |
| p1baseline_historical_replay_corpus.jsonl | 9900 |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 |
| p19active_scoring_pit_replay_corpus.jsonl | 4500 |

Unchanged ✅

## Section 12: New TypeScript Source Files

- `src/lib/onlineValidation/P26F2MonthlyRevenueReleaseDateRuleContractUtils.ts`
  - ZERO external imports
  - Pure functions, no side-effects
  - Contract version: v1, rule: INFERRED_NEXT_MONTH_10TH
- `src/lib/onlineValidation/P26F2MonthlyRevenueReleaseDateInferenceUtils.ts`
  - ZERO external imports
  - Pure functions, no mutation, no Math.random()

## Section 13: New Script Files

| Script | Purpose |
|---|---|
| run-p26f2-monthly-revenue-release-date-dry-run.js | Reads DB, builds 2143 candidate JSONL |
| run-p26f2-candidate-release-date-coverage-preview.js | PIT coverage preview (0 matches) |
| run-p26f2-release-date-pit-safety-validation.js | 13 PIT safety tests |
| run-p26f2-scoring-invariance-check.js | sha256 + corpus invariance check |
| run-p26f2-release-date-dry-run-quality-gate.js | 10-check quality gate |

## Section 14: Test Results

| Test Suite | Tests | Status |
|---|---|---|
| p26f2_release_date_rule_contract_utils.test.ts | 16/16 | ✅ PASS |
| p26f2_release_date_inference_utils.test.ts | 19/19 | ✅ PASS |
| All onlineValidation tests | 2458/2458 | ✅ PASS |
| All data tests | 118/118 | ✅ PASS |

## Section 15: TypeScript Compilation

Pre-existing error (NOT from P26F2):
- `src/app/api/admin/data-quality/route.ts:174` — TS1128/TS1005 (pre-existing, not fixed)

No new TS errors from P26F2 files. ✅

## Section 16: Artifact List

- `outputs/online_validation/p26f2_release_date_population_preflight.json` ✅
- `outputs/online_validation/p26f2_release_date_population_preflight.md` ✅
- `outputs/online_validation/p26f2_release_date_rule_contract_v1.json` ✅
- `outputs/online_validation/p26f2_release_date_rule_contract_v1.md` ✅
- `outputs/online_validation/p26f2_monthly_revenue_release_date_candidates.jsonl` (2143 rows) ✅
- `outputs/online_validation/p26f2_monthly_revenue_release_date_candidates_summary.json` ✅
- `outputs/online_validation/p26f2_monthly_revenue_release_date_candidates_summary.md` ✅
- `outputs/online_validation/p26f2_candidate_release_date_coverage_preview.json` ✅
- `outputs/online_validation/p26f2_candidate_release_date_coverage_preview.md` ✅
- `outputs/online_validation/p26f2_release_date_pit_safety_validation.json` ✅
- `outputs/online_validation/p26f2_release_date_pit_safety_validation.md` ✅
- `outputs/online_validation/p26f2_scoring_invariance_check.json` ✅
- `outputs/online_validation/p26f2_scoring_invariance_check.md` ✅
- `outputs/online_validation/p26f2_release_date_dry_run_quality_gate.json` ✅
- `outputs/online_validation/p26f2_release_date_dry_run_quality_gate.md` ✅

## Section 17: Constraints Compliance

| Constraint | Status |
|---|---|
| ZERO external imports in TS source | ✅ |
| No DB write of any kind | ✅ |
| No mutation of input objects | ✅ |
| No Math.random() | ✅ |
| No outcome fields | ✅ |
| Corpus files unchanged | ✅ |
| No scoring formula change | ✅ |
| No external API / LLM | ✅ |
| No optimizer authorization | ✅ |

## Section 18: Root Cause — Data Gap

**Root cause**: DB only synced 2026-02 and 2026-03 revenue data.

The corpus requires revenue data from **2025-09 through 2026-01** (with releaseDates 2025-10-10 through 2026-02-10) for asOfDates 2025-10-14 to 2026-02-11.

Currently available:
- DB data months: 2026-02, 2026-03
- Candidate dates: 2026-03-10, 2026-04-10 (all after corpus max)

**Next step**: P26F3 — MonthlyRevenue Historical Data Sync (acquire 2025-09 to 2026-01 revenue data + releaseDates from TWSE).

## Section 19: No Forbidden Claims

No ROI, win-rate, alpha, edge, profit, outperform, beat, buy, sell, guaranteed, or investment recommendation claims made anywhere in P26F2 artifacts.

## Section 20: Final Classification

**P26F2_RELEASE_DATE_CANDIDATE_NO_COVERAGE**

P26F2 is valuable despite zero coverage: it proves the inference rule is correct, establishes the data gap clearly, provides a dry-run JSONL for future use, and validates all PIT safety properties. The sprint is complete and correctly classified.

**Status**: ✅ COMPLETE
