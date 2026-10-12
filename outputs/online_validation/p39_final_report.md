# P39 — Paper Simulation Input Contract for Eligible Sources

**Phase:** P39  
**Date:** 2026-05-21  
**Branch:** main  
**Base commit:** `d096a5c` (P38: Add simulation input readiness mapping for controlled sources)  
**Classification:** `P39_PAPER_SIMULATION_INPUT_CONTRACT_READY`

---

## 1. Objective

Build a paper-only simulation input contract that:

1. Formalizes which data sources (MonthlyRevenue, Quote, Regime) are **eligible** for paper simulation consumption
2. Explicitly **blocks** NewsEvent, FinancialReport, and Chip from paper simulation use with documented blocking reasons and required next evidence
3. Provides a typed contract builder and validator with 14 governance enforcement rules
4. Ships with 77 tests, a sample bundle, and complete output artifacts

**Scope constraints (all respected):**
- No simulation execution
- No optimizer
- No real backtest
- No alphaScore activation
- No investment advice
- No Prisma/DB touch
- No scoring formula modification

---

## 2. Deliverables

### Source Files

| File | Purpose |
|------|---------|
| `src/lib/onlineValidation/p39/PaperSimulationInputContract.ts` | Full type system: `PaperSimulationEligibleSourceInput`, `PaperSimulationBlockedSource`, `PaperSimulationInputBundle`, `PaperSimulationInputValidationResult`, all constants |
| `src/lib/onlineValidation/p39/PaperSimulationInputContractBuilder.ts` | Builder (`buildPaperSimulationInputBundle`, `buildDefaultPaperSimulationInputBundle`) and validator (`validatePaperSimulationInputBundle`) |

### Test File

| File | Tests |
|------|-------|
| `src/lib/onlineValidation/__tests__/p39_paper_simulation_input_contract.test.ts` | 77/77 PASS |

### Output Artifacts

| Artifact | Status |
|----------|--------|
| `p39_preflight_mainline_status.json/.md` | ✅ |
| `p39_input_artifact_review.json/.md` | ✅ |
| `p39_paper_simulation_input_bundle.json/.md` | ✅ |
| `p39_test_baseline.json/.md` | ✅ |
| `p39_forbidden_claims_scan.json/.md` | ✅ |
| `p39_final_report.md` | ✅ |

---

## 3. Contract Results — Source Classification

### Eligible Sources (paper simulation consumption authorized)

| Source | Status | paperOnly | entersAlphaScore | Basis |
|--------|--------|-----------|-----------------|-------|
| MonthlyRevenue | SIMULATION_INPUT_ELIGIBLE | true | false | P36/P37/P38 |
| Quote | SIMULATION_INPUT_ELIGIBLE | true | false | P38 |
| Regime | SIMULATION_INPUT_ELIGIBLE | true | false | P38 |

### Blocked Sources (paper simulation consumption explicitly blocked)

| Source | Blocked Status | Primary Reason |
|--------|---------------|----------------|
| NewsEvent | BLOCKED_QUALITY_EVIDENCE | NLP quality validation absent |
| FinancialReport | BLOCKED_PIT_METADATA | `releaseDate` metadata absent |
| Chip | BLOCKED_AUTHORIZATION | `availableAt` field absent (migration deferred) |

---

## 4. Architecture

### Types Layer — `PaperSimulationInputContract.ts`

```
PaperSimulationContractMode = "paper-simulation-input-contract"
PaperSimulationEligibleSourceInput
  .sourceName: SourceName
  .readinessStatus: "SIMULATION_INPUT_ELIGIBLE"
  .paperOnly: true
  .dryRunOnly: true
  .entersAlphaScore: false
  .noInvestmentAdvice: true
  .noBuySellActionSemantics: true
  .asOfDate: string
  .payloadSummary: string
  .sourceTrace?: string

PaperSimulationBlockedSource
  .sourceName: SourceName
  .blockedStatus: "BLOCKED_QUALITY_EVIDENCE" | "BLOCKED_PIT_METADATA" | ...
  .blockingReasons: string[]
  .requiredNextEvidence: string[]
  .forbiddenUse: string[]

PaperSimulationInputBundle
  (all 10 governance fields + eligibleSources + blockedSources + disclaimer)

PaperSimulationInputValidationResult
  .valid: boolean
  .errors: string[]
  .warnings: string[]
  .entersAlphaScore: false   ← ALWAYS FALSE
  .paperOnly: true            ← ALWAYS TRUE

PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS (14 items)
PAPER_SIMULATION_CONTRACT_FORBIDDEN_USES (8 items)
P39_ELIGIBLE_SOURCES: ["MonthlyRevenue", "Quote", "Regime"]
P39_BLOCKED_SOURCES: ["NewsEvent", "FinancialReport", "Chip"]
```

### Builder Layer — `PaperSimulationInputContractBuilder.ts`

**`buildPaperSimulationInputBundle(entries, opts?)`**
- Iterates `SimulationInputReadinessEntry[]` from P38
- Routes `SIMULATION_INPUT_ELIGIBLE` → `eligibleSources`
- Routes all BLOCKED_* and AUDIT_ONLY → `blockedSources`
- Enforces all 10 governance invariants on the resulting bundle

**`buildDefaultPaperSimulationInputBundle(opts?)`**
- Canonical default using static P38 results
- MonthlyRevenue / Quote / Regime → eligible
- NewsEvent / FinancialReport / Chip → blocked (with static blocking definitions)
- Deterministic, pure, no external dependencies

**`validatePaperSimulationInputBundle(bundle)`**
14 validation rules:
1. `mode === "paper-simulation-input-contract"`
2. `paperOnly === true`
3. `dryRunOnly === true`
4. `entersAlphaScore === false`
5. `noInvestmentAdvice === true`
6. `noBuySellActionSemantics === true`
7. `notSimulationExecution === true`
8. `notOptimizer === true`
9. `notRealBacktest === true`
10. No blocked source name in `eligibleSources`
11. No eligible entry with `entersAlphaScore !== false`
12. No eligible entry with `paperOnly !== true`
13. No forbidden field keys present in bundle root
14. `disclaimer` present and non-empty

---

## 5. Test Coverage

**77 tests, 12 groups — 77/77 PASS**

| Group | Tests | Coverage |
|-------|-------|---------|
| 1 — Bundle governance invariants | 8 | All 8 required invariant fields |
| 2 — Mode and version | 5 | Mode constant, version string, disclaimer |
| 3 — MonthlyRevenue is eligible | 5 | Eligible status, paperOnly, entersAlphaScore, not-blocked |
| 4 — Quote is eligible | 5 | Same for Quote |
| 5 — Regime is eligible | 4 | Same for Regime |
| 6 — Blocked sources | 8 | BlockedStatus per source, not-in-eligible, non-empty reasons/evidence |
| 7 — Validator accepts valid bundle | 4 | Full bundle, result fields |
| 8 — Validator rejects invalid bundles | 10 | Blocked-in-eligible, paperOnly=false, entersAlphaScore=true, noInvestmentAdvice=false, wrong mode, forbidden fields |
| 9 — buildPaperSimulationInputBundle from entries | 5 | Entry routing, governance, determinism, empty input |
| 10 — Default bundle structure | 7 | 3/3 eligible, 3/3 blocked, constants, JSON stability |
| 11 — Forbidden fields/uses constants | 10 | All key forbidden fields present in constants |
| 12 — Isolation and governance | 6 | No Prisma, pure functions, no mutable state, forbidden fields absent from entries |

---

## 6. Regression Results

| Suite | Tests | Result |
|-------|-------|--------|
| P38 — SimulationInputReadinessMapping | 55 | 55/55 PASS ✅ |
| P37 — MonthlyRevenue Consumer Integration | 60 | 60/60 PASS ✅ |
| P36 — MonthlyRevenue Consumer Readiness | 50 | 50/50 PASS ✅ |
| Full onlineValidation suite | 3943 | 3939/3943 (4 pre-existing DB hash failures, unchanged) ✅ |

---

## 7. Governance Verification

| Check | Result |
|-------|--------|
| `entersAlphaScore = false` in all P39 code | ✅ VERIFIED |
| `paperOnly = true` | ✅ VERIFIED |
| `dryRunOnly = true` | ✅ VERIFIED |
| `notSimulationExecution = true` | ✅ VERIFIED |
| `notOptimizer = true` | ✅ VERIFIED |
| `notRealBacktest = true` | ✅ VERIFIED |
| No Prisma / DB import | ✅ VERIFIED |
| No scoring module import | ✅ VERIFIED |
| No `RuleBasedStockAnalyzer` modification | ✅ VERIFIED |
| No `SignalFusionEngine` modification | ✅ VERIFIED |
| No `ActiveScoringSnapshotBuilder` modification | ✅ VERIFIED |
| No `MarketRegimeEngine` modification | ✅ VERIFIED |
| No corpus / `.jsonl` modification | ✅ VERIFIED |
| Forbidden claims scan | ✅ CLEAN |
| `prisma/dev.db` unchanged (runtime noise only) | ✅ VERIFIED |

---

## 8. Next Steps (P40+)

P40 should be: **Simulation Framework Design** — design (not execute) the paper simulation framework that consumes the P39 contract bundle.

**P40 must NOT:**
- Execute a simulation
- Call an optimizer
- Run a real backtest
- Activate `entersAlphaScore`
- Touch `prisma/dev.db` schema
- Import scoring modules

P40 authorization requires explicit CTO approval beyond this P39 contract.

**Blocked sources next unlock criteria:**
- **NewsEvent:** NLP quality score gate + P39+ authorization
- **FinancialReport:** `releaseDate` schema enforcement + PIT gate + P39+ authorization
- **Chip:** `availableAt` migration applied + P39+ authorization

---

## 9. Classification

```
P39_PAPER_SIMULATION_INPUT_CONTRACT_READY
```

- 2 new `src/` files (types + builder)
- 77/77 tests PASS
- 3 eligible sources formalized in contract
- 3 blocked sources explicitly blocked with documented evidence requirements
- 11 output artifacts committed
- No simulation execution, no optimizer, no real backtest, no alphaScore activation
- No DB, no scoring, no corpus mutation
