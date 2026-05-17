# P29A-HARDRESET Final Report

**Task:** P29A — PIT-safe Feature Availability Registry v1 Paper Design
**Date:** 2026-05-23
**Final Classification:** `P29A_PIT_FEATURE_REGISTRY_V1_READY`

> Not investment advice. Not a trading recommendation. Research observability only.

---

## 1. 本輪目標

在 P28E 正式關閉 reason underoutput track 後，依 CEO Route D 強制執行，建立：
1. Feature source inventory（6+ sources 全面盤點）
2. PIT-safe Feature Availability Registry contract v1（10 條規則）
3. PIT-safe Feature Availability Registry v1 draft（6 core sources 完整定義）
4. Scoring boundary review（確認 registry 不影響任何 production scoring path）
5. Route D continuation link（P28E → P29-A → P29-B → P29-C 軸線說明）

本輪不是資料匯入、不是 DB write、不是 scoring 修改。

---

## 2. P28E Route D Recap

| Item | Value |
| --- | --- |
| P28E commit | `455c86a` |
| P28E classification | `P28E_REASON_UNDEROUTPUT_TRACK_CLOSED` |
| CEO Route D trigger | P28E closure mandated P29-A as forced next round |
| Forbidden next-round tasks | P27 naming audit / scanner consolidation / phase registry |
| P26F4 state | `WAITING_FOR_OPERATOR_SOURCE` (unchanged) |

---

## 3. Feature Source Inventory (PART B)

**8 sources inventoried** (6 core + 2 sub-features derived from StockQuote):

| Source | In alphaScore | PIT Gate | Status |
| --- | :---: | --- | --- |
| TWSE_TPEX_Quote | ✅ | `date` <= asOfDate | AVAILABLE_NEEDS_VALIDATION |
| MarketRegime | ✅ | asOf param (TAIEX) | AVAILABLE_NEEDS_VALIDATION |
| InstitutionalChip | ✅ | `date` <= asOfDate | AVAILABLE_NEEDS_VALIDATION |
| MonthlyRevenue | ✅ | `releaseDate` <= asOfDate | REPAIRED_BUT_SOURCE_GATED |
| FinancialReport | ❌ | *(not implemented)* | HIGH_RISK_SOURCE_ABSENT |
| NewsEvent | ❌ | `publishedAt` (not yet verified) | HIGH_RISK_SOURCE_ABSENT |
| Volume/Liquidity | ✅ (sub) | inherits StockQuote | ACTIVE_AS_SUBFEATURE |
| Momentum/Volatility | ✅ (sub) | inherits StockQuote | ACTIVE_AS_SUBFEATURE |

Key artifact: `p29a_feature_source_inventory.json`

---

## 4. Registry Contract Design (PART C)

**Contract v1 (`p29a-registry-contract-v1`)** defines:
- 8-value `sourceStatus` enum
- 10 registry rules (R1–R10)
- Required entry schema (16 fields per source)

Key rules enforced in v1 draft:
- **R2** — HIGH_RISK_SOURCE_ABSENT → entersAlphaScore must be false (FinancialReport, NewsEvent)
- **R5** — MonthlyRevenue stays REPAIRED_BUT_SOURCE_GATED until P26F4 import completes
- **R6** — Registry is paper design; no production scoring path reads it
- **R9** — `ingestedAt`, `createdAt`, `periodEndDate`, `fiscalQuarter` are NEVER valid PIT gate fields
- **R10** — Registry does not grant P26F4 import permission

Key artifact: `p29a_pit_feature_availability_registry_contract.json`

---

## 5. Registry v1 Draft (PART D)

**6 core sources fully defined** in `p29a_pit_feature_availability_registry_v1.json`:

### Sources entering alphaScore (4)
| Source | SFE weight (stock) | SFE weight (ETF) | PIT gate |
| --- | ---: | ---: | --- |
| TWSE_TPEX_Quote | 0.35 | 0.50 | `date` <= asOfDate |
| MarketRegime | 0.15 | 0.25 | asOf param |
| InstitutionalChip | 0.25 | 0.25 | `date` <= asOfDate |
| MonthlyRevenue | 0.25 | 0.00 | `releaseDate` <= asOfDate |

### Sources NOT entering alphaScore (2)
| Source | Reason | Activation Path |
| --- | --- | --- |
| FinancialReport | No `availabilityDate` gate; P26C paper only | Implement availabilityDate, verify gate, update P12 v2 |
| NewsEvent | publishedAt reliability unverified; P26B read-only only | Audit publishedAt across sources, separate mock events |

### MonthlyRevenue Source Gap
- Historical 2025-09 to 2026-01 still missing
- P26F4 = `WAITING_FOR_OPERATOR_SOURCE`
- Import approval token: `P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY`
- Registry does NOT grant import permission

---

## 6. Registry Safety / Scoring Boundary Review (PART E)

**12/12 checks PASS** — `REGISTRY_PAPER_DESIGN_IS_SCORING_BOUNDARY_SAFE`

Registry is a JSON document. It is not imported or consumed by any production scoring path at runtime. It does not change alphaScore, recommendationBucket, DB, or corpus.

Key artifact: `p29a_registry_scoring_boundary_review.json`

---

## 7. Route D Continuation Link (PART F)

- Confirms P29-A is axis-A continuation, not P27 housekeeping
- Documents P29-A runs in parallel with P26F4 operator wait
- Pre-announces: P29-B (NewsEvent/FinancialReport source plan), P29-C (Backtest paper design)

Key artifact: `p29a_route_d_continuation_from_p28e.json`

---

## 8. Tests Result (PART G)

| Command | Result | Tests |
| --- | :---: | ---: |
| P29A registry test (16 cases) | ✅ PASS | 16/16 |
| Full onlineValidation suite | ✅ PASS | **3027/3027** (101 suites) |

Delta from P28E: 3011 → 3027 (+16 new P29A registry tests).

---

## 9. Invariance Result (PART H)

All frozen files UNCHANGED:
- `prisma/dev.db` sha256 = `a5cf2771...` ✅
- `RuleBasedStockAnalyzer.ts` ✅
- `SignalFusionEngine.ts` ✅
- `ActiveScoringSnapshotBuilder.ts` ✅
- 5 corpus: 60 / 4500 / 9900 / 4500 / 4499 lines ✅

---

## 10. Forbidden Claims Scan (PART I)

**CLEAN** — 0 non-disclaimer violations in 9 raw regex hits.

All hits were:
- `buy/sell direction` → factual InstitutionalChip description
- `alpha` → file path `src/lib/alpha/SignalFusionEngine.ts`
- `edge` → "timezone edge" / "edge cases" technical context

---

## 11. Boundary Validation (PART J)

**8/8 PASS** — `BOUNDARY_SAFE`

No scoring files, DB, or frozen corpus modified. No imports, no corpus expansion, no optimizer, no new repo.

---

## 12. Modified / New Files

### New artifacts (P29A)
- `p29a_pit_feature_registry_preflight.json` / `.md`
- `p29a_feature_source_inventory.json` / `.md`
- `p29a_pit_feature_availability_registry_contract.json` / `.md`
- `p29a_pit_feature_availability_registry_v1.json` / `.md`
- `p29a_registry_scoring_boundary_review.json` / `.md`
- `p29a_route_d_continuation_from_p28e.json` / `.md`
- `p29a_pit_feature_registry_tests.json` / `.md`
- `p29a_pit_feature_registry_invariance.json` / `.md`
- `p29a_pit_feature_registry_forbidden_claims_scan.json` / `.md`
- `p29a_pit_feature_registry_boundary_validation.json` / `.md`
- `p29a_pit_feature_registry_final_report.md`
- `p29_next_prompt_after_pit_feature_registry.md`

### New test
- `src/lib/onlineValidation/__tests__/p29a_pit_feature_availability_registry.test.ts`

### NOT modified (verified by sha256)
- `prisma/dev.db`
- All 5 frozen corpus files
- `RuleBasedStockAnalyzer.ts`
- `SignalFusionEngine.ts`
- `ActiveScoringSnapshotBuilder.ts`

---

## 13. Remaining Blockers

| Blocker | Status |
| --- | --- |
| MonthlyRevenue 2025-09 to 2026-01 historical data | WAITING_FOR_OPERATOR_SOURCE |
| P26F4 import | Blocked — requires source files + manifest + dry-run + approval token |
| Corpus expansion | Blocked until P26F4 import + coverage PASS |
| Optimizer / backtest | Blocked until corpus expansion gate |
| FinancialReport PIT gate | Not implemented — needs availabilityDate governance |
| NewsEvent publishedAt reliability | Not verified — needs source audit |

---

## 14. Next Recommendations

### If source not yet arrived (expected)
→ **P29-B:** NewsEvent / FinancialReport Real Source Acquisition PLAN (research-only, no data write)
→ **P29-C:** Backtest / Simulation Contract Paper Design (axis-B paper-only, no optimizer)

### If operator drops source files
→ Immediately switch to: `outputs/online_validation/p26_next_prompt_source_arrival_only.md`

---

## 15. Contribution to CEO Two Strategic Axes

### Axis A — Taiwan Stock Prediction Research
**Direct contribution.** Registry v1 defines the availability contract for all 6 feature sources. This is the structural foundation that will drive P29-B (real source acquisition for NewsEvent/FinancialReport) and a future formal PIT gate validation audit (P30), moving 3 sources from `AVAILABLE_NEEDS_VALIDATION` to `AVAILABLE_PIT_SAFE`.

### Axis B — Strategy Simulation and Optimization
**Indirect but necessary.** Simulation optimizer must only consume PIT-safe features. Registry v1 defines which sources are safe to enter simulation replay. P29-C (Backtest contract paper design) will directly reference registry v1 as its feature availability input.

---

## 16. Final Classification

```
P29A_PIT_FEATURE_REGISTRY_V1_READY
```
