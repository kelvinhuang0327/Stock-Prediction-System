# P12-HARDRESET: PIT Feature Contract v0 — Final Report

**Date:** 2026-05-12  
**Phase:** P12-HARDRESET  
**Commit:** 794c44d  
**Final Classification:** P12_PIT_FEATURE_CONTRACT_COMPLETE

> **Disclaimer:** This report documents observability findings and contract scaffolding only. No investment recommendations. No scoring changes. No corpus modifications. No ROI, win-rate, alpha calculations, profit estimates, or performance guarantees.

---

## 1. Executive Summary

P12-HARDRESET established a **PIT (Point-In-Time) Feature Contract v0** for the Stock Prediction System's scoring and snapshot pipeline. The contract defines which feature sources are used, their asOf rules, PIT risk classifications, forbidden snapshot fields, and documented repair requirements.

**Key outcomes:**
- 11 feature sources catalogued across LOW (7), MEDIUM (2), HIGH (2) risk tiers
- 4500/4500 P3 corpus rows pass all contract validation checks (validationStatus: PASS)
- 50 new unit tests, all passing (1214 total in onlineValidation suite)
- Critical PIT risk documented: MonthlyRevenue uses year+month composite gate (no `releaseDate` field)
- No scoring formulas modified. No corpus rows modified. No investment claims.

---

## 2. Pre-flight Audit (PART A)

**Status:** PASS

All prerequisite artifacts verified:

| Artifact | Status |
|----------|--------|
| p6lite_bucket_contract_freeze.json | ✅ Present |
| p8preflight_signal_reason_diagnosis.json | ✅ Present |
| simulation_snapshot_corpus.jsonl | ✅ 60 lines |
| p1baseline_historical_replay_corpus.jsonl | ✅ 9900 lines |
| p3active_scoring_historical_replay_corpus.jsonl | ✅ 4500 lines |
| P6 finalVerdict = BY_DESIGN_BOUNDARY | ✅ Confirmed |
| P8 case count = 24 | ✅ Confirmed |
| P3 mock-deterministic count = 0 | ✅ Confirmed |

---

## 3. Feature Source Discovery (PART B)

**Sources Discovered:** 11  
**High Risk:** 2 — MonthlyRevenue, NewsEvent  
**Medium Risk:** 2 — FinancialReport, MarketRegime  
**Low Risk:** 7 — StockQuote, InstitutionalChip, TechnicalIndicators, BucketContract, TwseTradingCalendar, ActiveScoringSnapshot, ReasonSignalFactorSnapshot

### 3.1 HIGH Risk Sources

#### MonthlyRevenue — HIGH PIT Risk

**Root cause:** The `prisma.monthlyRevenue` table has **no `releaseDate` field**. The scoring engine (`RuleBasedStockAnalyzer`) gates monthly revenue by:

```
WHERE (year < asOfYear) OR (year == asOfYear AND month <= asOfMonth)
```

This uses the **reporting period** as the gate, not the **announcement date**. In Taiwan, monthly revenue is released on the **10th of the following month**. If `asOfDate` is 2026-02-05 (before the Feb 10 announcement), the gate would still include January revenue data that was not yet public.

**Current behavior:** Accepted as interim (SOFT requirement PIT-003). Revenue factor is skipped if `revenueCount < 13 rows`.

**Required repair (P0 priority):** Add `releaseDate (DateTime)` field to `MonthlyRevenue` schema. Gate queries to `releaseDate <= asOfDate`.

#### NewsEvent — HIGH PIT Risk

**Root cause:** `prisma.newsEvent` has both `publishedAt` (correct PIT gate) and `ingestedAt` (DB write time — **not PIT-safe**). NewsEvent is **not currently used** in scoring, but if activated: must gate by `publishedAt`, never `ingestedAt`.

---

## 4. PIT Feature Contract v0 (PART C + D)

**contractVersion:** p12-pit-feature-contract-v0  
**Verdict:** CONTRACT_PARTIAL  
**Reason:** 3 sources have documented repair needs (MonthlyRevenue, NewsEvent, FinancialReport) — all repair actions documented.

### 4.1 PIT Safety Requirements (7 total)

| Requirement | Enforcement | Scope |
|-------------|-------------|-------|
| PIT-001: All time-series sources gate to date <= asOfDate | **HARD** | StockQuote, InstitutionalChip, MonthlyRevenue, FinancialReport, NewsEvent |
| PIT-002: pitGateDate must equal asOfDate in every activeScoringSnapshot | **HARD** | ActiveScoringSnapshot |
| PIT-003: MonthlyRevenue year+month gate accepted as interim | SOFT | MonthlyRevenue |
| PIT-004: Forbidden fields never in activeScoringSnapshot | **HARD** | ActiveScoringSnapshot, ReasonSignalFactorSnapshot |
| PIT-005: NewsEvent must gate by publishedAt, not ingestedAt | SOFT | NewsEvent |
| PIT-006: FinancialReport needs availabilityDate before activation | SOFT | FinancialReport |
| PIT-007: priceSource must never be mock-deterministic | **HARD** | StockQuote |

### 4.2 Forbidden Snapshot Fields

The following fields are **forbidden** inside `activeScoringSnapshot`. They belong only in `outcomeSnapshot` (write-back, post-prediction):

- `outcomePrice`
- `returnPct`
- `realizedReturnClass`
- `futurePrice`
- `baselineResult`
- `outcomeClose`
- `horizonReturnPct`

### 4.3 Repair Priorities

| Priority | Source | Action |
|----------|--------|--------|
| **P0** | MonthlyRevenue | Add `releaseDate (DateTime)` to schema. Gate queries to `releaseDate <= asOfDate`. |
| **P1** | ReasonSignalFactorSnapshot | Fix `buildReason()` in RuleBasedStockAnalyzer to produce richer tokens. Tracked in P8-PREFLIGHT. |
| **P2** | FinancialReport | Add `availabilityDate (DateTime)` field before activating in scoring pipeline. |

---

## 5. Contract Validation Against P3 Corpus (PART E)

**Status:** ✅ PASS  
**Corpus:** p3active_scoring_historical_replay_corpus.jsonl  
**Total Rows:** 4500

| Check | Result |
|-------|--------|
| Rows passed | 4500/4500 |
| Rows failed | 0 |
| Warnings | 0 |
| Fail rate | 0.00% |

**Requirements tested:**
- PIT-001: originalAsOfDate present at corpus row level ✅
- PIT-002: pitGateDate == asOfDate in activeScoringSnapshot ✅
- PIT-004: No forbidden snapshot fields in activeScoringSnapshot ✅
- PIT-007: priceSource != mock-deterministic ✅
- scoringCompletenessStatus present ✅

---

## 6. Unit Tests (PART F)

**Tests added:** 50  
**Tests passing:** 50/50  
**Full suite:** 1214 passing (onlineValidation), 118 passing (data) — 0 regressions

### Test Coverage by Function

| Function | Tests | All Pass |
|----------|-------|---------|
| normalizeFeatureSourceName | 5 | ✅ |
| classifyPitRisk | 4 | ✅ |
| validateAsOfRule | 5 | ✅ |
| validateFeatureContractEntry | 5 | ✅ |
| validatePitFeatureSnapshot | 8 | ✅ |
| buildPitFeatureContract | 3 | ✅ |
| summarizePitFeatureContract | 4 | ✅ |
| scanForbiddenClaims | 14 | ✅ |
| FORBIDDEN_SNAPSHOT_FIELDS export | 1 | ✅ |

---

## 7. Forbidden Claims Scan (PART G)

**Status:** CLEAN

All grep matches were in:
1. Scanner pattern definitions (`FORBIDDEN_CLAIM_PATTERNS` array in utility file)
2. Non-goal declarations ("This contract does NOT produce ROI figures...")

No actual investment recommendations, performance guarantees, ROI figures, win-rate claims, or alpha/profit/outperform language found in any output artifact.

---

## 8. Artifact Validation (PART H)

**Status:** ALL CHECKS PASSED

| Artifact | Valid JSON | Structure OK |
|----------|-----------|-------------|
| p12pit_feature_contract_preflight_audit.json | ✅ | ✅ |
| p12pit_feature_source_discovery.json | ✅ | ✅ |
| p12pit_feature_contract_v0.json | ✅ | ✅ |
| p12pit_feature_contract_validation.json | ✅ | ✅ |

Frozen corpus line counts confirmed:

| Corpus | Lines | Status |
|--------|-------|--------|
| simulation_snapshot_corpus.jsonl | 60 | ✅ |
| p1baseline_historical_replay_corpus.jsonl | 9900 | ✅ |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 | ✅ |

---

## 9. Bucket Contract Cross-Reference (P6-LITE)

- **Source:** p6lite_bucket_contract_freeze.json
- **Verdict:** BY_DESIGN_BOUNDARY
- **Canonical Bucket Labels:** Strong, Watch, Neutral, LowPriority, InsufficientData, Avoid
- **Watch + score[20-39]:** Accepted as BY_DESIGN_BOUNDARY — signal-qualified borderline cases
- **Non-goals:** Bucket contract is frozen for P12. No threshold changes.

---

## 10. P8 Signal/Reason Cross-Reference

- **Source:** p8preflight_signal_reason_diagnosis.json
- **Total Cases:** 24
- **Category Breakdown:**
  - TEMPLATE_TOO_GENERIC: 9 cases
  - SCORING_ENGINE_UNDEROUTPUT: 9 cases
  - FACTOR_EXPLANATION_MISSING: 4 cases
  - SNAPSHOT_CAPTURE_MISSING: 2 cases
- **P12 Repair Mapping:** P1 priority — fix `buildReason()` to produce richer tokens beyond single-character labels (法人買超, 技術偏多, etc.)

---

## 11. Files Created/Modified

### New Scripts
- `scripts/run-p12-preflight-audit.js` — PART A pre-flight audit runner
- `scripts/discover-p12-pit-feature-sources.js` — PART B feature source discovery
- `scripts/build-p12-pit-feature-contract-v0.js` — PART D contract builder
- `scripts/validate-p12-contract-against-p3-corpus.js` — PART E validation runner
- `scripts/validate-p12-artifacts.py` — PART H artifact validation checker

### New Source Files
- `src/lib/onlineValidation/P12PitFeatureContractUtils.ts` — PART C utility module
- `src/lib/onlineValidation/__tests__/p12pit_feature_contract_utils.test.ts` — PART F tests

### New Output Artifacts
- `outputs/online_validation/p12pit_feature_contract_preflight_audit.json` + `.md`
- `outputs/online_validation/p12pit_feature_source_discovery.json` + `.md`
- `outputs/online_validation/p12pit_feature_contract_v0.json` + `.md`
- `outputs/online_validation/p12pit_feature_contract_validation.json` + `.md`

### NOT Modified (frozen)
- All corpus files (simulation, p0, p1, p3) — zero modifications
- `src/lib/analysis/RuleBasedStockAnalyzer.ts` — no scoring changes
- `src/lib/alpha/SignalFusionEngine.ts` — no changes
- `prisma/schema.prisma` — no schema changes (repairs documented as future work)
- Any ManualReview modules

---

## 12. Known Limitations and Future Work

1. **MonthlyRevenue releaseDate (P0):** The current year+month gate is a known approximation. Until `releaseDate` is added to the `MonthlyRevenue` schema, there is a risk of including data that was not yet announced on `asOfDate`. This is documented and accepted for P12 scope.

2. **FinancialReport not activated (P2):** FinancialReport exists in schema but is not used in scoring. If activated in the future, `availabilityDate` must be added first.

3. **MarketRegime sourcing (MEDIUM):** `MarketRegimeEngine.detectRegime(asOf)` uses `asOf` for gating, but the internal data sources for regime classification were not fully audited in this phase. Flagged as MEDIUM risk.

4. **P8 reason repair (P1):** `buildReason()` produces single-token reasons only. 24 cases flagged as TEMPLATE_TOO_GENERIC/SCORING_ENGINE_UNDEROUTPUT. Repair is out of scope for P12 but documented.

---

## 13. Non-Goals (Preserved from Contract)

1. This phase does NOT modify scoring formulas, scoring weights, or bucket thresholds.
2. This phase does NOT modify any corpus files (simulation, p0, p1, p3).
3. This phase does NOT add new investment claims, performance predictions, or strategy recommendations.
4. This phase does NOT modify ManualReview modules.
5. This phase does NOT change production database schema — repairs are flagged as future work.
6. This phase does NOT produce ROI figures, win rates, alpha calculations, profit estimates, or performance guarantees.

---

## 14. Classification

**Final Classification: P12_PIT_FEATURE_CONTRACT_COMPLETE**

Criteria met:
- ✅ All prerequisite artifacts present and verified (PART A: PASS)
- ✅ All 11 feature sources catalogued with PIT risk classifications (PART B)
- ✅ Full utility module with 8 pure functions (PART C)
- ✅ Contract v0 built with 7 safety requirements + 15 snapshot rules (PART D)
- ✅ Contract validated against 4500 P3 corpus rows — 0 failures (PART E: PASS)
- ✅ 50 unit tests, all pass, 0 regressions in 1332 existing tests (PART F)
- ✅ Forbidden claims scan: CLEAN (PART G)
- ✅ Artifact validation: ALL CHECKS PASSED (PART H)
- ✅ Commit: 794c44d (PART I)

CONTRACT_PARTIAL verdict on the contract itself (3 sources need repair) is expected — the contract documents the current state including known deficiencies. The P12 phase itself is COMPLETE.

---

## 15. Next Steps (P13+)

1. **P13 MonthlyRevenue Repair:** Add `releaseDate` field to `MonthlyRevenue` schema. Update `RuleBasedStockAnalyzer` to use `releaseDate <= asOfDate`. Re-validate P3 corpus after migration.
2. **P13 buildReason() Enhancement:** Expand reason token vocabulary in `RuleBasedStockAnalyzer.buildReason()` to address P8 TEMPLATE_TOO_GENERIC cases.
3. **P14 FinancialReport Activation (if needed):** Add `availabilityDate` field first, then integrate into scoring formula.
4. **P15 MarketRegime Data Audit:** Full audit of `MarketRegimeEngine` data sources for PIT compliance.

---

*Report generated: 2026-05-12 | Commit: 794c44d | Phase: P12-HARDRESET*
