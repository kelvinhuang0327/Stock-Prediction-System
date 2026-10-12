# P36 — Axis C C3: Simulation-Only Integration Guard

Date: 2026-05-25
Project: Stock-Prediction-System
Phase: P36 — Axis C C3: Integration Guard Definition
Branch: main
HEAD at report time: 284c9fe (docs: finalize P35 Axis C pipeline test report)
Authorization: P35_AXIS_C_PIPELINE_TESTS_CI_GREEN (93e68db)
Classification: P36_AXIS_C_INTEGRATION_GUARD_DEFINED

> **DISCLAIMER:** This document is a design specification and governance guard definition only.
> It does not constitute investment advice, a buy/sell/hold recommendation, or any
> investment performance claim. All described paths are paper-only, dry-run-only,
> entersAlphaScore=false, no PnL/ROI/win-rate semantics.

---

## 1. Pre-flight Result

| Check | Expected | Result |
|---|---|---|
| Repo root | `/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System` | PASS |
| Branch | `main` | PASS |
| HEAD before changes | `93e68db` | PASS (P35 commit) |
| Dirty files | USER_DECISION only | PASS |
| STOP conditions | none triggered | PASS |

---

## 2. Axis C C3 Objective

C3 = Integration Guard: a formal design specification that defines:
1. The deterministic gate structure that governs which sources may enter the P39 bundle.
2. The invariants that any future code change must preserve.
3. The evidence gaps that prevent blocked sources from becoming eligible.
4. What a future C4 must verify before any new source can be promoted.

C3 does NOT execute simulations, call the optimizer, write to DB, or generate trading signals.
It is a paper-only, diagnostic-only design specification.

---

## 3. What "Simulation-Only Integration Guard" Means

An integration guard in Axis C is a structural contract that:

- **Statically defines** which sources are eligible vs blocked at any given evidence state.
- **Deterministically routes** source facts through a pure function pipeline (no DB, no network).
- **Structurally enforces** governance constraints (`entersAlphaScore=false`, `paperOnly=true`,
  `noInvestmentAdvice=true`) at every layer of the TypeScript type system.
- **Formally names** the blocking reasons so future agents can understand why a source is blocked
  without re-reading the resolver code.
- **Preserves auditability** by requiring `sourceTrace` provenance fields on all eligible entries.

The guard spans three layers:

| Layer | Component | Role |
|---|---|---|
| L1: Facts | `SourceReadinessFacts` interface | Input contract for the mapper |
| L2: Mapper | `SimulationInputReadinessMapper.ts` (P38) | Pure resolver per source → readiness entry |
| L3: Bundle | `PaperSimulationInputContractBuilder.ts` (P39) | Bundle assembly from P38 entries |

---

## 4. Current Axis C Source Classification

### 4.1 Eligible Sources (enter P39 `eligibleSources`)

These sources pass all required gates and appear in `PaperSimulationInputBundle.eligibleSources`:

| Source | Resolver | Gate That Grants Eligibility |
|---|---|---|
| **MonthlyRevenue** | `resolveMonthlyRevenue` | `pitMetadataComplete=true` AND `qualityEvidenceComplete=true` AND `consumerStatus=CONSUMER_READY` |
| **Quote** | `resolveQuoteOrRegime` | `pitSafeConfirmed=true` |
| **Regime** | `resolveQuoteOrRegime` | `pitSafeConfirmed=true` |

All three appear in `P39_ELIGIBLE_SOURCES` (defined in `PaperSimulationInputContract.ts`).

When eligible, each source enters the bundle as a `PaperSimulationEligibleSourceInput` record with:
- `readinessStatus: "SIMULATION_INPUT_ELIGIBLE"`
- `paperOnly: true`
- `dryRunOnly: true`
- `entersAlphaScore: false`
- `noInvestmentAdvice: true`
- `noBuySellActionSemantics: true`
- `asOfDate`: ISO timestamp of bundle generation
- `sourceTrace`: gate status string (audit provenance)
- `payloadSummary`: static description of what the source provides

### 4.2 Blocked Sources (enter P39 `blockedSources`)

These sources cannot reach `SIMULATION_INPUT_ELIGIBLE` under the current evidence state:

| Source | Blocking Status | Reason | Can Become Eligible? |
|---|---|---|---|
| **NewsEvent** | `SOURCE_PRESENT_AUDIT_ONLY` | Quality evidence incomplete: NLP quality, symbol linkage, source diversity not validated. 84% Yahoo RSS concentration. | Only if `qualityEvidenceComplete=true` AND resolver logic is updated to allow ELIGIBLE path. |
| **FinancialReport** | `BLOCKED_PIT_METADATA` | `releaseDate` / `releaseDateSource` / `releaseDateConfidence` fields absent. Schema migration authorization required. | Only if PIT metadata fields are added via authorized schema migration. |
| **Chip** | `BLOCKED_AUTHORIZATION` or `BLOCKED_LAG_EVIDENCE` | Authorization not granted by operator; `availableAt` field absent; dev DB migration not authorized. | Only if authorization granted AND lag evidence validated. |

All three appear in `P39_BLOCKED_SOURCES` (defined in `PaperSimulationInputContract.ts`).

Blocked sources enter the bundle as `PaperSimulationBlockedSource` records with:
- `blockedStatus`: the specific blocking classification
- `blockingReasons`: list of reasons from the resolver
- `requiredNextEvidence`: what must be confirmed before next gate review
- `forbiddenUse`: the full `SIMULATION_INPUT_FORBIDDEN_USES` list (8 entries)

### 4.3 Audit-Only Sources (sub-classification)

A source may reach an intermediate state before being fully blocked:

| Status | Meaning | Example |
|---|---|---|
| `SOURCE_PRESENT_AUDIT_ONLY` | Data present, consumer integration missing | NewsEvent with quality evidence complete |
| `CONSUMER_READY_AUDIT_ONLY` | Consumer integration complete, simulation input not yet authorized | (reserved for future use) |

Audit-only sources are routed to `blockedSources` in the P39 bundle builder. They are
treated as `BLOCKED_AUTHORIZATION` for contract purposes until promotion criteria are met.

---

## 5. Pipeline Architecture (Deterministic Flow)

```
SourceReadinessFacts
        │
        ▼
mapSourceToSimulationInputReadiness()   ← P38 mapper (pure, deterministic)
        │
        ├─ forbidden field guard (blocked → BLOCKED_AUTHORIZATION)
        │
        └─ source switch:
              MonthlyRevenue → resolveMonthlyRevenue()
              Quote/Regime   → resolveQuoteOrRegime()
              NewsEvent      → resolveNewsEvent()
              FinancialReport→ resolveFinancialReport()
              Chip           → resolveChip()
        │
        ▼
SimulationInputReadinessEntry
        │
        ▼
buildSimulationInputReadinessMatrix([...entries])   ← P38 matrix builder
        │
        ▼
SimulationInputReadinessMatrix
        │
        ▼
buildPaperSimulationInputBundle(matrix.entries)     ← P39 bundle builder
        │
        ├─ entry.simulationInputStatus === "SIMULATION_INPUT_ELIGIBLE"
        │         → PaperSimulationEligibleSourceInput → bundle.eligibleSources[]
        │
        └─ entry.simulationInputStatus !== "SIMULATION_INPUT_ELIGIBLE"
                  → PaperSimulationBlockedSource     → bundle.blockedSources[]
        │
        ▼
PaperSimulationInputBundle
```

**Pipeline properties:**
- Pure: no side effects, no DB reads, no network calls, no file I/O
- Deterministic: same `SourceReadinessFacts` → identical `SimulationInputStatus` on repeated calls
- Isolated: no Prisma imports, no scoring imports, no optimizer imports
- Traceable: every entry has `currentGateStatus` for audit

---

## 6. Governance Invariants (Must Always Hold)

These invariants define the integration guard. Any code change that violates them
is a governance violation that must be rejected.

### Invariant 1: `entersAlphaScore` is always `false`

At every layer:
- `SimulationInputReadinessEntry.entersAlphaScore: false` (TypeScript type, structurally enforced)
- `SimulationInputReadinessMatrix.entersAlphaScore: false` (TypeScript type)
- `PaperSimulationEligibleSourceInput.entersAlphaScore: false` (TypeScript type)
- `PaperSimulationInputBundle.entersAlphaScore: false` (TypeScript type)

This is not a runtime check — it is enforced at compile time by the TypeScript type system.
Any attempt to set `entersAlphaScore: true` will fail to compile.

### Invariant 2: Eligible sources are exactly MonthlyRevenue, Quote, Regime

`P39_ELIGIBLE_SOURCES = ["MonthlyRevenue", "Quote", "Regime"]`

This set is statically defined in `PaperSimulationInputContract.ts`.
No source may be added to this set without:
1. Updating the resolver in P38 to produce `SIMULATION_INPUT_ELIGIBLE`
2. Documenting the evidence basis (analogous to P34 for the current three)
3. An explicit Axis C scope extension (C5 or equivalent)

### Invariant 3: Blocked sources are exactly NewsEvent, FinancialReport, Chip

`P39_BLOCKED_SOURCES = ["NewsEvent", "FinancialReport", "Chip"]`

This set is statically defined in `PaperSimulationInputContract.ts`.
These sources may only move from blocked to eligible via the resolver logic changes
documented in Section 8 (Promotion Criteria).

### Invariant 4: Forbidden fields in `SourceReadinessFacts` trigger `BLOCKED_AUTHORIZATION`

If any key in the input object matches `SIMULATION_INPUT_FORBIDDEN_FIELDS`:
```
["alphaScore", "prediction", "recommendation", "signal", "buy", "sell", "hold",
 "targetPrice", "outcomePrice", "returnPct", "winRate", "profit",
 "expectedReturn", "optimizerScore", "edgeScore"]
```
then `mapSourceToSimulationInputReadiness` returns `BLOCKED_AUTHORIZATION`
with a `FORBIDDEN_FIELD_IN_INPUT` reason. No source processing occurs.

### Invariant 5: No scoring, no investment advice, no buy/sell semantics

Forbidden uses enforced via `SIMULATION_INPUT_FORBIDDEN_USES` list:
```
["production scoring", "alphaScore mutation", "optimizer", "real backtest",
 "buy/sell/hold action semantics", "investment recommendation",
 "performance claims (profit, ROI, win-rate, edge, expected return)",
 "scoring formula modification"]
```
All eight strings appear in every `SimulationInputReadinessEntry.forbiddenUse` and
every `PaperSimulationBlockedSource.forbiddenUse`.

### Invariant 6: Bundle mode is always `"paper-simulation-input-contract"`

`PAPER_SIMULATION_CONTRACT_MODE = "paper-simulation-input-contract"` (const, cannot be overridden).
The bundle `mode` field is structurally set to this value in `buildPaperSimulationInputBundle`.

### Invariant 7: `buildDefaultPaperSimulationInputBundle()` always produces the canonical partition

The default bundle (no arguments, uses `P39_ELIGIBLE_SOURCES` and `P39_BLOCKED_SOURCES`):
- `eligibleSources` length = 3 (MonthlyRevenue, Quote, Regime)
- `blockedSources` length = 3 (NewsEvent, FinancialReport, Chip)
- All 6 Axis C sources accounted for
- No source appears in both lists

---

## 7. How No Investment Advice / No Predictive Claim Is Enforced

### 7.1 TypeScript Structural Enforcement

Every interface that can escape the pipeline has `noInvestmentAdvice: true` and
`noBuySellActionSemantics: true` as required boolean literals. Setting them to `false`
fails to compile.

### 7.2 Payload Summary Design

`SOURCE_PAYLOAD_SUMMARIES` in the builder contains only factual descriptions
of what data is available ("2143 rows", "PIT metadata complete", "market quote series").
No price targets, no expected returns, no win rates, no recommendations.

### 7.3 Disclaimer Propagation

The full disclaimer string is embedded in:
- `SimulationInputReadinessMatrix.disclaimer`
- `PaperSimulationInputBundle.disclaimer`
- Module-level JSDoc in all P38/P39 files

### 7.4 Pipeline Isolation

The pipeline imports from:
- `SimulationInputReadinessTypes.ts` (types only)
- `PaperSimulationInputContract.ts` (types + constants only)

It does NOT import from:
- Prisma / DB clients
- Scoring formula modules
- Optimizer modules
- Backtest modules
- Network clients

This isolation is enforced by the no-import policy in the module JSDoc headers.

---

## 8. Blocked Source Promotion Criteria

Before any blocked source can move to `SIMULATION_INPUT_ELIGIBLE`, all of the following
must be satisfied:

### 8.1 NewsEvent

| Criterion | Evidence Required | Current State |
|---|---|---|
| Quality evidence complete | NLP quality gate pass + symbol linkage validation + source diversity audit | MISSING |
| RSS concentration resolved | Yahoo RSS share < 84% threshold | MISSING |
| Resolver updated | `resolveNewsEvent` must be modified to return ELIGIBLE when quality complete | PENDING code change |
| C5 authorization | Explicit human operator authorization | NOT STARTED |

### 8.2 FinancialReport

| Criterion | Evidence Required | Current State |
|---|---|---|
| `releaseDate` field present | Schema migration to add `releaseDate`, `releaseDateSource`, `releaseDateConfidence` | NOT AUTHORIZED |
| PIT metadata complete | All historical records must have valid `releaseDate` | BLOCKED — migration prerequisite |
| Schema migration authorization | Explicit operator authorization | NOT GRANTED |
| C5 authorization | Explicit human operator authorization | NOT STARTED |

### 8.3 Chip

| Criterion | Evidence Required | Current State |
|---|---|---|
| Authorization granted | Operator must grant `authorizationGranted=true` | NOT GRANTED |
| `availableAt` field present | DB field migration to dev environment | NOT AUTHORIZED |
| Lag evidence validated | Prod logs confirm lag between data creation and availability | NOT VALIDATED |
| C5 authorization | Explicit human operator authorization | NOT STARTED |

---

## 9. Test Coverage Gaps Discovered

The following gaps exist after P35. These are candidates for a future C4 or supplementary P36 task.

| Gap | Description | Priority | Notes |
|---|---|---|---|
| `buildDefaultPaperSimulationInputBundle()` | No test verifies that the default bundle always routes exactly MR/Quote/Regime → eligible and NewsEvent/FR/Chip → blocked | HIGH | Pure function, easy to add; no production changes needed |
| `summarizeSimulationInputReadinessMatrix()` | No test verifies the count summary (eligible/blocked/auditOnly) | MEDIUM | Part of public API of P38 mapper |
| Pipeline determinism | Same `SourceReadinessFacts` → identical output on repeated calls not explicitly tested | MEDIUM | Implied by pure functions; explicit test provides regression protection |
| Forbidden-field runtime guard | `SIMULATION_INPUT_FORBIDDEN_FIELDS` check in mapper not directly tested | MEDIUM | Guard exists and is unit-testable; no production changes needed |
| `SOURCE_PAYLOAD_SUMMARIES` content | String content of payload summaries not validated | LOW | Content drift possible without a test |
| `PAPER_SIMULATION_CONTRACT_MODE` propagation | `mode` field value not asserted in P35 tests | LOW | Easy snapshot test |

---

## 10. What C4 (Future) Should Verify

C4 = Simulation-Only Integration Guard Closure. C4 should:

1. **Test `buildDefaultPaperSimulationInputBundle()`** — assert canonical partition (3+3 split)
2. **Test pipeline determinism** — call mapper twice with same facts, compare results
3. **Test forbidden-field guard** — pass an object with a forbidden key, assert `BLOCKED_AUTHORIZATION`
4. **Test `summarizeSimulationInputReadinessMatrix()`** — known facts → known counts
5. **Verify the gap matrix** — cross-check Section 9 above against what P35 tests cover
6. **Update this report** — if any blocked source's evidence state changes, update Section 8

C4 must remain:
- Test-only additions (no production code changes)
- `entersAlphaScore=false` in all new test groups
- No DB, no Prisma, no network
- No investment advice, no scoring

---

## 11. Files Referenced

| File | Layer | Role |
|---|---|---|
| `src/lib/onlineValidation/p38/SimulationInputReadinessTypes.ts` | L1 | `SourceReadinessFacts`, `SimulationInputStatus`, forbidden fields/uses |
| `src/lib/onlineValidation/p38/SimulationInputReadinessMapper.ts` | L2 | Per-source resolver functions, matrix builder |
| `src/lib/onlineValidation/p39/PaperSimulationInputContract.ts` | L3 | Bundle types, `P39_ELIGIBLE_SOURCES`, `P39_BLOCKED_SOURCES` |
| `src/lib/onlineValidation/p39/PaperSimulationInputContractBuilder.ts` | L3 | `buildPaperSimulationInputBundle`, `buildDefaultPaperSimulationInputBundle` |
| `src/lib/simulation/__tests__/p35_axis_c_fixture_backed_pipeline.test.ts` | Tests | 25 tests, 5 groups, C2 pipeline coverage |
| `outputs/online_validation/p33_axis_c_scope_definition_report.md` | Docs | Axis C scope definition |
| `outputs/online_validation/p34_axis_c_evidence_inventory.md` | Docs | Source-by-source evidence inventory |
| `outputs/online_validation/p35_axis_c_pipeline_test_report.md` | Docs | P35 test report and CI closure |

---

## 12. Governance Confirmation

| Constraint | Status |
|---|---|
| No production logic changed | ✅ CONFIRMED — report-only |
| No DB / Prisma modified | ✅ CONFIRMED |
| No package-lock modified | ✅ CONFIRMED |
| No scoring formula accessed | ✅ CONFIRMED |
| No production data read or written | ✅ CONFIRMED |
| No investment advice | ✅ CONFIRMED |
| No buy/sell/hold semantics | ✅ CONFIRMED |
| `entersAlphaScore=false` documented and invariant-declared | ✅ CONFIRMED |
| `paperOnly=true` / `dryRunOnly=true` documented | ✅ CONFIRMED |
| No USER_DECISION files staged or modified | ✅ CONFIRMED |
| No alpha-score entry, no optimizer, no real backtest | ✅ CONFIRMED |
| No predictive performance claim | ✅ CONFIRMED |

---

## 13. Final Classification

```
P36_AXIS_C_INTEGRATION_GUARD_DEFINED
```

The Axis C C3 integration guard is formally defined as a report-only artifact.
No production code changes were required or made.
All 6 Axis C source states are documented with invariants, promotion criteria, and test gaps.
C4 can proceed with targeted test additions using Section 9 and Section 10 as input.
