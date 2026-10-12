# P20-HARDRESET: Final Report — Pre/Post PIT MonthlyRevenue Availability Impact

> **DISCLAIMER**: This report does not constitute investment advice. It is an observability-only analysis of system metadata changes. No ROI, win-rate, outperformance, profit, buy/sell signals, or investment recommendations are computed or implied.  
> **productionApplyAllowed**: false | **productionDbWritten**: false

**Phase**: P20-HARDRESET  
**Classification**: `P20_READY_FOR_PRODUCTION_MIGRATION_APPROVAL_REVIEW`  
**Generated**: 2026-05-12  
**Commit**: `b43a992`  
**Prior phase**: P19-HARDRESET (commit `dcffc34`)

---

## 1. Executive Summary

P20-HARDRESET compared the active scoring corpora from P3 (pre-PIT gate patch) and P19 (post-PIT gate patch) to quantify the impact of the MonthlyRevenue PIT (Point-in-Time) gate on active scoring output.

**Key finding**: The PIT gate patch (P17, applied in P19) produced **zero scoring changes** across all 4500 rows. Every row received `monthlyRevenuePitGateStatus = NOT_APPLICABLE_NO_DATA` because MonthlyRevenue was already absent from all P3 active scoring corpus rows. The gate had nothing to apply or reject — it was inactive for the entire corpus.

All 10 decision criteria passed. The system is classified as **P20_READY_FOR_PRODUCTION_MIGRATION_APPROVAL_REVIEW**.

---

## 2. Objectives

- Compare P3 (pre-PIT) vs P19 (post-PIT) active scoring corpora
- Quantify impact of MonthlyRevenue PIT gate on scoring output
- Confirm observability-only analysis (no DB writes, no corpus mutations)
- Generate production migration readiness classification for P21
- Produce all artifacts and unit tests required for approval review

---

## 3. Corpus Overview

| Corpus | Phase | Rows | Horizons | MonthlyRevenue Status |
|--------|-------|------|----------|-----------------------|
| P3 (pre-PIT) | P3-HARDRESET | 4500 | 5/20/60 days | Absent from all missingSources |
| P19 (post-PIT) | P19-HARDRESET | 4500 | 5/20/60 days | NOT_APPLICABLE_NO_DATA (all rows) |

**P3 schema notes**:
- No top-level `horizonDays` — horizon encoded in `duplicateKey` as `symbol|date|horizon`
- `researchBucket`: LowPriority / Watch / Neutral / Strong
- `activeScoringSnapshot.signalSnapshot`: array of strings
- `activeScoringSnapshot.factorSnapshot`: array of strings

**P19 schema additions**:
- Top-level `horizonDays` field
- `duplicateKey` suffixed with `|p19`
- Extra fields: `monthlyRevenuePitGateStatus`, `monthlyRevenueAvailabilitySummary`, `pitReplayRunId`, `productionApplyAllowed`, `productionDbWritten`, `universeTierP19`
- `activeScoringSnapshot` adds: `pitReplayRunId`, `monthlyRevenuePitGateApplied`, `monthlyRevenuePitGateStatus`

---

## 4. Part-by-Part Results

### Part A — Pre-flight Gates
**Result**: 19/19 PASS  
Validated: P19 artifacts present, P3 artifacts present, P19 conclusions correct, frozen corpus line counts (P3=4500, P19=4500).

### Part B — P20 Comparison Utility (TypeScript)
**File**: `src/lib/onlineValidation/P20PitImpactComparisonUtils.ts`  
**Result**: COMPLETE  
Exports: `buildComparisonKey`, `alignPrePostRows`, `compareScoringCompleteness`, `compareBucket`, `compareScoreSnapshot`, `compareSignalSnapshot`, `compareReasonSnapshot`, `compareFactorSnapshot`, `classifyPitImpactChange`, `buildRowImpactResult`, `summarizePitImpactComparison`, `scanForbiddenClaims`.

Key design: `classifyPitImpactChange` never uses `returnPct` or `outcomeSnapshot`.

### Part C — Pre/Post PIT Comparison Run
**File**: `scripts/run-p20-pre-post-pit-impact-comparison.js`  
**Output**: `outputs/online_validation/p20pit_impact_comparison.json` + `.md`

| Metric | Result |
|--------|--------|
| Aligned rows | 4500 / 4500 |
| Missing pre rows | 0 |
| Missing post rows | 0 |
| Shape compatible | true |
| Completeness degraded | 0 |
| Completeness improved | 0 |
| Bucket changed | 0 |
| Score changed | 0 |
| Signal changed | 0 |
| Reason changed | 0 |
| Factor changed | 0 |
| MonthlyRevenue excluded | 4500 (all rows) |
| Ready for P21 review | **true** |

### Part D — Changed Case Sampling
**File**: `scripts/sample-p20-pit-impact-changed-cases.js`  
**Output**: `outputs/online_validation/p20pit_impact_changed_cases.json` + `.md`

| Class | Available | Sampled |
|-------|-----------|---------|
| BUCKET_CHANGED | 0 | 0 |
| SCORE_CHANGED | 0 | 0 |
| REASON_CHANGED | 0 | 0 |
| SIGNAL_CHANGED | 0 | 0 |
| FACTOR_CHANGED | 0 | 0 |
| MONTHLY_REVENUE_EXCLUDED | 4500 | 5 |
| NO_CHANGE | 0 | 0 |
| NO_SCORING_CHANGE (virtual) | 4500 | 5 |

The `NO_SCORING_CHANGE` virtual class represents rows whose only classification is `MONTHLY_REVENUE_EXCLUDED` with no associated scoring delta — i.e., effective no-change control cases.

### Part E — Production Migration Readiness Decision
**File**: `scripts/decide-p20-production-migration-readiness.js`  
**Output**: `outputs/online_validation/p20production_migration_readiness_decision.json` + `.md`

| Criterion | Status |
|-----------|--------|
| P3/P19 corpus shape compatible | PASS |
| P19 PIT validation PASS | PASS |
| Leakage violations = 0 | PASS |
| Forbidden field violations = 0 | PASS |
| Completeness degradation < 5% (0.00%) | PASS |
| Bucket change ratio < 10% (0.00%) | PASS |
| Snapshot impact < 10% (0.00%) | PASS |
| Changed cases documented | PASS |

**Classification**: `P20_READY_FOR_PRODUCTION_MIGRATION_APPROVAL_REVIEW`

### Part F — Unit Tests
**File**: `src/lib/onlineValidation/__tests__/p20pit_impact_comparison_utils.test.ts`  
**Result**: 59/59 PASS (1.7s)

Test suites covered:
- `buildComparisonKey` — deterministic, symbol/date/horizon differentiation
- `alignPrePostRows` — exact match, missing pre, missing post, sort order
- `compareScoringCompleteness` — all direction transitions
- `compareBucket` — same / changed / null
- `compareScoreSnapshot` — delta, no returnPct/outcomeSnapshot
- `compareSignalSnapshot` — added/removed signal detection
- `compareReasonSnapshot` — string diff
- `classifyPitImpactChange` — no returnPct, no outcomeSnapshot
- `summarizePitImpactComparison` — deterministic, counts, safety flags
- `scanForbiddenClaims` — ROI/win-rate/outperform/profit/guaranteed/buy/sell/investment recommendation
- `buildRowImpactResult` — field population
- Production safety — `productionApplyAllowed=false`, `productionDbWritten=false`

### Part G — Forbidden Claims Scan
**Result**: CLEAN — zero actual forbidden claims  
All grep matches were in: DISCLAIMER lines, scanner pattern definition strings, or negation comment lines (`// No ROI, win-rate…`).

### Part H — Artifact Validation
**Result**: ALL PASS  
- JSON parse: 4/4 artifacts valid
- Structure: all required fields present
- Frozen corpus: P3=4500 lines, P19=4500 lines (unchanged)
- Markdown: 4/4 `.md` files present
- Safety: `productionApplyAllowed=false`, `productionDbWritten=false` confirmed

### Part I — Git Commit
**Commit**: `b43a992`  
**Message**: `P20-HARDRESET: Compare pre/post PIT MonthlyRevenue availability impact`  
**Files committed**: 15 files, 3816 insertions

---

## 5. Corpus Alignment Analysis

`buildComparisonKey` extracts a canonical key:
- P3 rows: parses `symbol|date|horizon` from `duplicateKey` (strips `|p19` suffix if present)
- P19 rows: uses `horizonDays` directly

Result: 4500/4500 rows aligned perfectly with no missing keys.

---

## 6. Scoring Completeness Impact

All 4500 P3 rows and all 4500 P19 rows have `scoringCompletenessStatus = COMPLETE`.  
Degradation ratio: 0.00%. No completeness regression was introduced by the PIT gate.

---

## 7. Bucket Distribution Impact

P3 and P19 bucket distributions are identical. No bucket changes occurred.

---

## 8. Snapshot Impact (Signal / Reason / Factor)

Zero signal, reason, or factor snapshot changes between P3 and P19.  
All scoring content is byte-for-byte identical.

---

## 9. MonthlyRevenue PIT Gate Analysis

| Metric | Value |
|--------|-------|
| Rows with MonthlyRevenue in missingSources | 4500 (100%) |
| monthlyRevenuePitGateStatus distribution | NOT_APPLICABLE_NO_DATA: 4500 |
| Leakage violations | 0 |
| Forbidden field violations | 0 |

**Interpretation**: The PIT gate for MonthlyRevenue was correctly inactive. MonthlyRevenue was not available in the historical data window for any of the 4500 active scoring rows. The gate status `NOT_APPLICABLE_NO_DATA` accurately reflects that there was no MonthlyRevenue data to gate or reject — the gate had nothing to act on.

This is not a failure of the gate — it is the expected behavior when the data source is unavailable. The gate would become active only if MonthlyRevenue data were present for a future-date query.

---

## 10. PIT Query Guard Validation

P19 PIT guard validation: **PASS**  
- Leakage violations: 0  
- Forbidden field violations: 0  
- All queries correctly restricted to data available at `originalAsOfDate`

---

## 11. Observability-Only Constraints

The following constraints were maintained throughout all P20 parts:

| Constraint | Status |
|------------|--------|
| productionApplyAllowed | false |
| productionDbWritten | false |
| P3 corpus frozen (4500 lines) | confirmed |
| P19 corpus frozen (4500 lines) | confirmed |
| No scoring formula changes | confirmed |
| No returnPct/outcomeSnapshot used | confirmed |
| No Math.random | confirmed |
| Forbidden claims: ROI/win-rate/etc. | 0 actual matches |

---

## 12. Comparison with P3 Active Scoring Conclusions

P3 concluded: active scoring corpus produced with horizons 5/20/60, COMPLETE status for all 1500 base scoring rows (×3 = 4500 total), MonthlyRevenue absent from missingSources across all rows.

P19 replayed P3 with the PIT gate patch applied. The P19 conclusions match P3 exactly on all scoring dimensions, confirming the patch introduced no regressions.

---

## 13. Unit Test Coverage Summary

```
Tests: 59 passed, 59 total
Suites: 1 passed, 1 total
Time: 1.718s
```

Key invariants verified:
1. `classifyPitImpactChange` never reads `returnPct` or `outcomeSnapshot`
2. `summarizePitImpactComparison` always returns `productionApplyAllowed=false`
3. `scanForbiddenClaims` catches all 8 forbidden claim categories
4. `alignPrePostRows` handles missing pre/post cases without crash
5. Fixture rows do not modify P0/P1/P3/P4/P19 corpus files

---

## 14. Artifact Inventory

| Artifact | Location | Type | Status |
|----------|----------|------|--------|
| Preflight report | `outputs/online_validation/p20pit_impact_preflight.json` | JSON | ✓ |
| Preflight report | `outputs/online_validation/p20pit_impact_preflight.md` | Markdown | ✓ |
| Comparison report | `outputs/online_validation/p20pit_impact_comparison.json` | JSON | ✓ |
| Comparison report | `outputs/online_validation/p20pit_impact_comparison.md` | Markdown | ✓ |
| Changed cases | `outputs/online_validation/p20pit_impact_changed_cases.json` | JSON | ✓ |
| Changed cases | `outputs/online_validation/p20pit_impact_changed_cases.md` | Markdown | ✓ |
| Migration readiness | `outputs/online_validation/p20production_migration_readiness_decision.json` | JSON | ✓ |
| Migration readiness | `outputs/online_validation/p20production_migration_readiness_decision.md` | Markdown | ✓ |
| Final report | `outputs/online_validation/p20pit_impact_final_report.md` | Markdown | ✓ |
| Comparison utility | `src/lib/onlineValidation/P20PitImpactComparisonUtils.ts` | TypeScript | ✓ |
| Unit tests | `src/lib/onlineValidation/__tests__/p20pit_impact_comparison_utils.test.ts` | TypeScript | ✓ |
| Pre-flight script | `scripts/run-p20-preflight.js` | Node.js | ✓ |
| Comparison script | `scripts/run-p20-pre-post-pit-impact-comparison.js` | Node.js | ✓ |
| Sampling script | `scripts/sample-p20-pit-impact-changed-cases.js` | Node.js | ✓ |
| Readiness script | `scripts/decide-p20-production-migration-readiness.js` | Node.js | ✓ |
| Artifact validator | `scripts/validate-p20-artifacts.js` | Node.js | ✓ |

---

## 15. Git History

```
b43a992  P20-HARDRESET: Compare pre/post PIT MonthlyRevenue availability impact
dcffc34  P19: Add final report — P19_ACTIVE_SCORING_PIT_REPLAY_COMPLETE
bfceb28  P19-HARDRESET: Active scoring PIT replay corpus after MonthlyRevenue gate
```

---

## 16. No Scoring Impact — Root Cause Analysis

The zero-change result is not an anomaly. It is the correct and expected outcome given:

1. **P17 PIT Gate Design**: The MonthlyRevenue PIT gate rejects queries for future-date revenue data. It activates only when a query for MonthlyRevenue is attempted for a date when that data was not yet published.

2. **P3 Data Reality**: All 4500 P3 active scoring rows already recorded MonthlyRevenue in `missingSources`. The scoring system already knew MonthlyRevenue was unavailable — it was not being queried for future data.

3. **Gate Status Semantics**: `NOT_APPLICABLE_NO_DATA` means: "The PIT gate was evaluated, but since MonthlyRevenue had no data at all for this window, gating/rejection was not applicable."

4. **Consequence**: Since MonthlyRevenue was never contributing to scores (it was always missing), blocking future-date queries for it could not change scores. The gate would only produce observable scoring changes if future-date MonthlyRevenue data were present in P3, which it was not.

---

## 17. Interpretation Boundaries

This analysis observes corpus metadata differences only. It does NOT:
- Predict future system behavior
- Assert scoring accuracy
- Recommend any investment action
- Constitute an approval to deploy to production

---

## 18. Recommended P21 Scope

Based on P20 findings, P21 Production Migration Approval Review should address:

1. **Data availability expansion**: Under what conditions would MonthlyRevenue data become available in the scoring window, and how would the PIT gate behave?
2. **Gate activation test**: Create a synthetic corpus where MonthlyRevenue IS available for future dates, confirm the gate correctly rejects those queries.
3. **Production DB write authorization**: Define the approval authority for setting `productionApplyAllowed=true`.
4. **Rollback plan**: If production migration reveals unexpected scoring changes, what is the rollback path?

P21 should NOT recalculate scores from P20 observations. It is an approval process, not a recalculation.

---

## 19. Data Integrity Confirmations

| Corpus | Expected Lines | Actual Lines | Status |
|--------|---------------|--------------|--------|
| P3 historical replay | 4500 | 4500 | ✓ FROZEN |
| P19 PIT replay | 4500 | 4500 | ✓ FROZEN |

No corpus files were modified at any point during P20 execution.

---

## 20. Forbidden Claims Compliance

Scan result: **CLEAN**

Words scanned (forbidden in analysis content): ROI, win-rate, alpha (standalone), edge, profit, outperform, beat the market, guaranteed, investment recommendation, buy, sell.

All matches found were in DISCLAIMER text, scanner pattern definitions, or negation statements — none in analysis content.

---

## 21. Known Limitations

1. **MonthlyRevenue availability**: The zero-change result is specific to the P3/P19 universe window (2026-01-01 through 2026-04-30). A different time window may include periods where MonthlyRevenue data was available, which could produce different gate outcomes.

2. **Synthetic case absence**: No synthetic test cases with future-date MonthlyRevenue were included in P20. The gate's activation behavior for such cases is validated only by unit tests, not by corpus replay.

3. **Corpus horizon coverage**: Horizons covered are 5/20/60 days only. Other horizon configurations (e.g., 1 day, 120 days) were not tested.

---

## 22. Final Classification

```
P20_READY_FOR_PRODUCTION_MIGRATION_APPROVAL_REVIEW
```

**All 8 decision criteria PASS:**
- Corpus shape compatible: ✓
- PIT validation PASS: ✓  
- Leakage violations = 0: ✓
- Forbidden field violations = 0: ✓
- Completeness degradation < 5% (0.00%): ✓
- Bucket change ratio < 10% (0.00%): ✓
- Snapshot impact < 10% (0.00%): ✓
- Changed cases documented: ✓

**Next step**: Proceed to P21 Production Migration Approval Review.  
**Important**: This classification does NOT approve production migration. It confirms readiness for the approval review process only.

---

*P20-HARDRESET complete. productionApplyAllowed=false. productionDbWritten=false.*  
*DISCLAIMER: Observability-only analysis. Not investment advice.*
