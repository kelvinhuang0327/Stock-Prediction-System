# P26D Targeted Post-Migration Replay / Coverage Comparison — Final Report

**Phase:** P26D-HARDRESET  
**Generated:** 2026-05-13  
**Final Classification:** P26D_TARGETED_REPLAY_COVERAGE_COMPLETE

---

## 1. Executive Summary

P26D implements targeted replay/coverage comparison, scanning how well the MonthlyRevenue, NewsEvent, and FinancialReport PIT context adapters (introduced in P26A/B/C) cover the existing corpus. All coverage dimensions are verified read-only. Scoring invariance is confirmed (0 mismatch across 9000 rows). No outcome fields accessed. No external API calls.

---

## 2. Prior Sprint Status

| Sprint | Classification | Commit |
|--------|---------------|--------|
| P26A | P26A_FEATURE_SNAPSHOT_V1_COMPLETE | b330b42 |
| P26B | P26B_EVENT_NEWS_PIT_CONTEXT_ADAPTER_COMPLETE | 2d607eb |
| P26C | P26C_FINANCIAL_REPORT_AVAILABILITY_CONTRACT_COMPLETE | 0698b81 |

---

## 3. Pre-flight Check

**Status:** PREFLIGHT_PASS

| Artifact | SHA256 Prefix |
|----------|--------------|
| p5walkthrough_review.json | d1cdcf56... |
| p25post_migration_observability_final_report.md | e5fb0b8f... |
| p26a_walkthrough_reason_quality_compare.json | a584a9c5... |

---

## 4. Coverage Contract v0

**9 Coverage Dimensions Defined:**

| # | Dimension | Context | ReadOnly | EntersScoring |
|---|-----------|---------|----------|---------------|
| 1 | monthlyRevenueAvailableAsOf | MonthlyRevenue | ✅ | false |
| 2 | monthlyRevenueReasonContextPresent | MonthlyRevenue | ✅ | false |
| 3 | monthlyRevenueFactorEvidencePresent | MonthlyRevenue | ✅ | false |
| 4 | newsEventContextVisibleAsOf | NewsEvent | ✅ | false |
| 5 | financialReportContextVisibleAsOf | FinancialReport | ✅ | false |
| 6 | contextReadOnly | ALL | ✅ | false |
| 7 | entersAlphaScoreFalseForNewsAndFinancial | NewsEvent\|FinancialReport | ✅ | false |
| 8 | alphaScoreInvariant | ScoringInvariant | ✅ | false |
| 9 | recommendationBucketInvariant | ScoringInvariant | ✅ | false |

**6 Output Classifications:**
1. COVERAGE_READY_FOR_CORPUS_EXPANSION
2. COVERAGE_PARTIAL_NEEDS_SOURCE_MAPPING
3. COVERAGE_BLOCKED_BY_ARTIFACTS
4. SCORING_INVARIANCE_BROKEN
5. PIT_CONTEXT_GATE_BROKEN
6. FAILED_TESTS

---

## 5. MonthlyRevenue Coverage Scan

**Corpus scan:** 0 rows with monthlyRevenueContext in P3/P19 (expected — scoring corpus ≠ revenue corpus)

**Synthetic test data (5 rows):**

| Metric | Value |
|--------|-------|
| Available (releaseDate ≤ 2026-05-13) | 3 |
| Future | 1 |
| Invalid (no releaseDate) | 1 |
| With reasonContext | 3 |
| With factorEvidence | 2 |

Gate: `releaseDate <= asOfDate` (Taiwan UTC+8)

---

## 6. NewsEvent Context Coverage

**Fixture:** p26b_news_events_fixture.json (6 events)  
**asOfDate:** 2026-05-13

| Metric | Value |
|--------|-------|
| Total | 6 |
| Visible (publishedAt ≤ 2026-05-13) | 4 |
| Future | 1 |
| Invalid (no publishedAt) | 1 |
| Enters alphaScore | false ✅ |

Gate: `publishedAt <= asOfDate` (Taiwan UTC+8). `ingestedAt` is observability only.

---

## 7. FinancialReport Context Coverage

**Fixture:** p26c_financial_reports_fixture.json (8 reports)  
**asOfDate:** 2026-05-13

| Metric | Value |
|--------|-------|
| Total | 8 |
| Visible | 5 |
| Future | 2 |
| No Availability Date | 1 |
| Enters alphaScore | false ✅ |

Availability priority: `filingDate → announcementDate → publishedAt → availableAt`

---

## 8. Targeted Replay Coverage Comparison

| Check | Result |
|-------|--------|
| P3 corpus rows | 4500 ✅ |
| P19 corpus rows | 4500 ✅ |
| Total | 9000 ✅ |
| Generic reasons after P26A | 9 (≤ 9) ✅ |
| No outcome fields used | ✅ |
| Contexts read-only | ✅ |
| Contexts enter alphaScore | false ✅ |

**Status:** PASS

---

## 9. Scoring Invariance Check

| Check | Result |
|-------|--------|
| Mismatched alphaScore | 0 ✅ |
| Mismatched recommendationBucket | 0 ✅ |
| Baseline file mismatch | false ✅ |

| Scoring File | SHA256 | Match |
|-------------|--------|-------|
| ActiveScoringSnapshotBuilder.ts | 063a3bd5... | ✅ |
| RuleBasedStockAnalyzer.ts | bc3716cc... | ✅ |
| SignalFusionEngine.ts | b8ce3fa3... | ✅ |

**Classification:** SCORING_INVARIANCE_CONFIRMED

---

## 10. Coverage Readiness Gate

| Check | Result |
|-------|--------|
| Scoring Invariance | ✅ PASS |
| MonthlyRevenue Corpus Evidence | ⚠️ None (0 rows in P3/P19) |
| Source Mapping Required | ⚠️ Yes (fixture-only) |

**Readiness for P26E:** PARTIAL  
**Classification:** COVERAGE_PARTIAL_NEEDS_SOURCE_MAPPING

*MonthlyRevenue requires a separate corpus source. NewsEvent/FinancialReport are fixture-only and need source mapping before corpus expansion.*

---

## 11. TypeScript Validation

```
npx tsc --noEmit
```

**Result:** 2 pre-existing errors at `src/app/api/admin/data-quality/route.ts:174` (TS1128/TS1005). These pre-date P26D and are not fixed.

No new TypeScript errors introduced.

---

## 12. Test Results

| Test Suite | Tests | Result |
|-----------|-------|--------|
| p26d_targeted_replay_coverage_contract_utils | 10/10 | ✅ PASS |
| p26d_monthly_revenue_coverage_scanner_utils | 12/12 | ✅ PASS |
| p26d_read_only_context_coverage_scanner_utils | 16/16 | ✅ PASS |
| Full onlineValidation suite | 2304/2304 | ✅ PASS |
| data/__tests__ | 118/118 | ✅ PASS |

---

## 13. Forbidden Claims Scan

Scanned: all `outputs/online_validation/p26d_*`, `src/lib/onlineValidation/P26D*.ts`, `scripts/run-p26d-*.js`

**Result:** No forbidden investment claims found. All matches are:
- `alphaScore` / `entersAlphaScore` field name references (allowed)
- Disclaimer texts *rejecting* forbidden claims
- File path references (src/lib/alpha/...)

---

## 14. Frozen Corpus Verification

| Corpus | Expected | Actual |
|--------|----------|--------|
| simulation_snapshot_corpus.jsonl | 60 | 60 ✅ |
| p0hardreset_historical_replay_corpus.jsonl | 4500 | 4500 ✅ |
| p1baseline_historical_replay_corpus.jsonl | 9900 | 9900 ✅ |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 | 4500 ✅ |
| p19active_scoring_pit_replay_corpus.jsonl | 4500 | 4500 ✅ |

---

## 15. Artifacts Created

### TypeScript Source Files
- `src/lib/onlineValidation/P26DTargetedReplayCoverageContractUtils.ts`
- `src/lib/onlineValidation/P26DMonthlyRevenueCoverageScannerUtils.ts`
- `src/lib/onlineValidation/P26DReadOnlyContextCoverageScannerUtils.ts`

### Test Files
- `src/lib/onlineValidation/__tests__/p26d_targeted_replay_coverage_contract_utils.test.ts`
- `src/lib/onlineValidation/__tests__/p26d_monthly_revenue_coverage_scanner_utils.test.ts`
- `src/lib/onlineValidation/__tests__/p26d_read_only_context_coverage_scanner_utils.test.ts`

### Scripts
- `scripts/run-p26d-targeted-replay-coverage-comparison.js`
- `scripts/run-p26d-scoring-invariance-check.js`
- `scripts/run-p26d-coverage-readiness-gate.js`
- `scripts/run-p26d-generate-artifacts.js`

### Output Artifacts
- `outputs/online_validation/p26d_targeted_replay_coverage_preflight.json`
- `outputs/online_validation/p26d_targeted_replay_coverage_preflight.md`
- `outputs/online_validation/p26d_targeted_replay_coverage_contract_v0.json`
- `outputs/online_validation/p26d_targeted_replay_coverage_contract_v0.md`
- `outputs/online_validation/p26d_monthly_revenue_targeted_coverage.json`
- `outputs/online_validation/p26d_monthly_revenue_targeted_coverage.md`
- `outputs/online_validation/p26d_read_only_context_coverage.json`
- `outputs/online_validation/p26d_read_only_context_coverage.md`
- `outputs/online_validation/p26d_targeted_replay_coverage_comparison.json`
- `outputs/online_validation/p26d_targeted_replay_coverage_comparison.md`
- `outputs/online_validation/p26d_scoring_invariance_check.json`
- `outputs/online_validation/p26d_scoring_invariance_check.md`
- `outputs/online_validation/p26d_coverage_readiness_gate.json`
- `outputs/online_validation/p26d_coverage_readiness_gate.md`
- `outputs/online_validation/p26d_targeted_post_migration_replay_coverage_final_report.md` (this file)

---

## 16. Technical Constraints Compliance

| Constraint | Status |
|-----------|--------|
| ZERO external imports in TS source | ✅ |
| Taiwan UTC+8 inline conversion | ✅ |
| No Math.random() | ✅ |
| No mutation of input rows | ✅ |
| No outcome fields accessed | ✅ |
| No scoring path modification | ✅ |
| No corpus modification | ✅ |
| P19 trailing newline handled | ✅ |

---

## 17. Non-Goals (Explicit Exclusions)

- No ROI, win-rate, profit, outperform, edge, or buy/sell claims
- No corpus regeneration
- No DB write
- No external API or LLM
- No scoring path modification

---

## 18. Path to P26E

P26E (corpus expansion) requires:
1. MonthlyRevenue corpus source mapping (live DB query or static corpus file)
2. NewsEvent/FinancialReport corpus row mapping to production data
3. Scoring invariance must remain confirmed

Current status: **COVERAGE_PARTIAL_NEEDS_SOURCE_MAPPING**

---

## 19. Final Classification

**P26D_TARGETED_REPLAY_COVERAGE_COMPLETE**

- Scoring invariance: CONFIRMED (9000 rows / 0 mismatch)
- Coverage contract: v0 with 9 dimensions
- Contexts read-only: all three adapters (MonthlyRevenue, NewsEvent, FinancialReport)
- Tests: 38/38 new tests passing, 2304/2304 total suite

---

*No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims. Research and coverage analysis only.*
