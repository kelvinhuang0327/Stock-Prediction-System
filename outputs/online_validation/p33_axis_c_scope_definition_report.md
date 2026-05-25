# P33 — Axis C Scope Definition Report

Date: 2026-05-25
Project: Stock-Prediction-System
Phase: P33 — Axis C Scope Definition and Implementation Planning
Branch: main
HEAD at planning time: f024fd3ace8442eb05fb65c20e002ccdc3c34b8a
Classification: P33_AXIS_C_SCOPE_DEFINED

> **DISCLAIMER:** This document is a design and governance planning artifact only.
> It does not constitute investment advice, a buy/sell/hold recommendation, or any
> investment performance claim. All described paths are paper-only, dry-run-only,
> entersAlphaScore=false, no PnL/ROI/win-rate semantics.

---

## 1. Pre-flight Result

| Check | Expected | Result |
|---|---|---|
| Repo root | `/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System` | PASS |
| Branch | `main` | PASS |
| HEAD | `f024fd3` (P32A CTO realignment commit) | PASS |
| Staged files before | none | PASS |
| Dirty files | `active_task.md` (USER_DECISION), `00-StockPlan/20260514/` (USER_DECISION), `00-StockPlan/20260515/` (USER_DECISION) | PASS — all USER_DECISION, none staged |
| STOP conditions | none triggered | PASS |

---

## 2. Current HEAD

```
f024fd3ace8442eb05fb65c20e002ccdc3c34b8a
docs: align post-P31 roadmap governance and closure evidence
```

Prior chain:
- `ac95e3d` — P31-DOC: 6 pending final report docs committed, CI run 26382142427 success
- `a7d2b39` — P29: Axis B v5 P39 advanced edge cases
- `46847c1` — P21: Axis A sourceTrace/PIT metadata coverage

---

## 3. Dirty-File Classification

| File | Type | Action |
|---|---|---|
| `00-Plan/roadmap/active_task.md` | Modified — task specification | USER_DECISION — do NOT stage |
| `00-StockPlan/20260514/` | Untracked directory | USER_DECISION — do NOT stage |
| `00-StockPlan/20260515/` | Untracked directory | USER_DECISION — do NOT stage |

No source code, DB schema, scoring, Prisma, package-lock, production data, or executable logic changes in working tree. STOP conditions not triggered.

---

## 4. Axis C Definition

### 4.1 What Axis C Is

**Axis C** is the architectural bridge layer that defines how trusted Axis A data sources
(with confirmed PIT-safe evidence, sourceTrace auditability, and consumer readiness) transition
into eligible inputs for Axis B paper-only simulation validation.

CEO-approved reframing: **"Axis A→B Bridge Design: PIT-Safe Eligibility State Machine"**
(same substance as CTO's "Axis C", but preserving the user's two-axis framing).
The term "Axis C" is used internally as a phase label, not a new product axis.

### 4.2 Why Axis C Is Needed (Evidence Gap)

The current system has two proven but disconnected layers:

| Layer | What Exists | What Is Missing |
|---|---|---|
| Axis A (P21) | `sourceTrace`/PIT metadata coverage in tests; `ControlledResearchSnapshot` types and builder; `SimulationInputReadinessTypes` (P38) | No user-visible research snapshot artifact; no end-to-end A→B pipeline test |
| Axis B (P23-P29) | P39 `PaperSimulationInputContract` types; fixture-backed P39 validator/bundle boundary tests | No mapping from confirmed-eligible sources to actual bundle construction; no capability map |

Without Axis C:
- Axis A and Axis B remain test-hardened but operationally disconnected.
- There is no formal document stating which sources can enter which states under which evidence conditions.
- Future agents cannot determine without re-reading P38/P39/P21 code whether a source is eligible.
- Axis B v6 cannot be justified without knowing what boundary gaps Axis C exposes.

### 4.3 Axis C State Machine — Formal Definition

The state machine governs source eligibility transitions. It is purely evidence-based
and produces no scores, recommendations, or buy/sell/action semantics.

#### States

| State | Code | Meaning |
|---|---|---|
| SIMULATION_INPUT_ELIGIBLE | `SIE` | Source has all PIT, consumer, quality, authorization, and lag evidence; may enter Axis B paper-only bundle |
| CONSUMER_READY_AUDIT_ONLY | `CRAO` | Consumer integration complete but simulation input not yet authorized |
| SOURCE_PRESENT_AUDIT_ONLY | `SPAO` | Source data present and gate-tested, but consumer integration missing |
| BLOCKED_PIT_METADATA | `BPM` | PIT gate field (releaseDate / publishedAt / availableAt) missing or not validated |
| BLOCKED_QUALITY_EVIDENCE | `BQE` | NLP / symbol linkage / source diversity quality not validated |
| BLOCKED_AUTHORIZATION | `BA` | Explicit authorization sentence required before any action |
| BLOCKED_LAG_EVIDENCE | `BLE` | Lag evidence (production logs / availableAt) not confirmed |
| NOT_APPLICABLE | `NA` | Source not in current governance scope |

#### Transitions (evidence-gated)

```
NOT_ASSESSED
  → BLOCKED_PIT_METADATA       [if pitStatus=PIT_GATE_MISSING]
  → BLOCKED_QUALITY_EVIDENCE   [if qualityEvidenceComplete=false AND pitStatus=PIT_GATE_PRESENT]
  → BLOCKED_AUTHORIZATION      [if authorizationGranted=false]
  → BLOCKED_LAG_EVIDENCE       [if lagEvidenceComplete=false]
  → SOURCE_PRESENT_AUDIT_ONLY  [if consumerStatus=SOURCE_PRESENT_AUDIT_ONLY]
  → CONSUMER_READY_AUDIT_ONLY  [if consumerStatus=CONSUMER_READY AND !allGatesPass]
  → SIMULATION_INPUT_ELIGIBLE  [if ALL: pitStatus=PRESENT, pitConfidence≥MEDIUM,
                                  pitMetadataComplete=true, pitSafeConfirmed=true,
                                  consumerStatus=CONSUMER_READY,
                                  qualityEvidenceComplete=true,
                                  lagEvidenceComplete=true,
                                  authorizationGranted=true]
```

All transitions are implemented in `src/lib/onlineValidation/p38/SimulationInputReadinessMapper.ts`.
Axis C formalizes this as an explicit state machine document and adds end-to-end pipeline tests.

#### Hard Invariants (never violated in any state)

```
entersAlphaScore = false         — no source in any state may mutate scoring formula
paperOnly = true                 — all outputs are paper-only
dryRunOnly = true                — no real execution
noInvestmentAdvice = true        — no buy/sell/hold/action semantics
noBuySellActionSemantics = true  — no price targets, ROI, win-rate
```

### 4.4 Current Source Status Inventory

| Source | Current State | Evidence Present | Evidence Missing | Gate to SIE |
|---|---|---|---|---|
| **MonthlyRevenue** | `SIMULATION_INPUT_ELIGIBLE` | pitStatus=PRESENT, pitConfidence=HIGH, consumerStatus=CONSUMER_READY, qualityEvidenceComplete=true, pitMetadataComplete=true, lagEvidenceComplete=true, authorizationGranted=true, pitSafeConfirmed=true | — | Already eligible |
| **Quote** | `SIMULATION_INPUT_ELIGIBLE` (if pitSafeConfirmed=true) | pitStatus=PRESENT, consumerStatus=CONSUMER_READY | pitSafeConfirmed must be confirmed per-call | Confirm pitSafeConfirmed=true at snapshot build time |
| **Regime** | `SIMULATION_INPUT_ELIGIBLE` (if pitSafeConfirmed=true) | pitStatus=PRESENT, consumerStatus=CONSUMER_READY | pitSafeConfirmed must be confirmed per-call | Same as Quote |
| **NewsEvent** | `SOURCE_PRESENT_AUDIT_ONLY` | 1018 rows, publishedAt=100%, RECORDED_FROM_SOURCE | NLP quality audit, symbol linkage, source diversity scoring | BLOCKED_QUALITY_EVIDENCE until quality/linkage validated |
| **FinancialReport** | `BLOCKED_PIT_METADATA` | 957 rows exist | releaseDate, releaseDateSource, releaseDateConfidence fields missing; DB migration requires `YES apply FinancialReport releaseDate migration to dev DB` | BLOCKED until explicit DB auth + migration |
| **Chip** | `BLOCKED_AUTHORIZATION` / `BLOCKED_LAG_EVIDENCE` | — | availableAt evidence, production lag logs (T86), explicit authorization | BLOCKED until `YES apply Chip availableAt migration to dev DB` + logs |

**Summary:** 3 sources are currently eligible (MonthlyRevenue + Quote + Regime with pitSafeConfirmed). 1 source is audit-only pending quality gate (NewsEvent). 2 sources are blocked by DB/auth gates (FinancialReport, Chip). Axis C C0-C1 work with currently eligible sources only.

---

## 5. Proposed C0-C4 Phase Breakdown

### C0 — Scope and Acceptance Criteria (this document, P33)

**Status:** COMPLETE (this report is the C0 output)

**Objective:** Define Axis C scope, state machine, source inventory, phase plan, and risk boundaries without changing code.

**Scope boundary:**
- Planning and documentation only
- No `src/`, no `prisma/`, no `data/`, no `tests/`, no `scripts/` modifications
- No DB reads or schema changes
- No staging of USER_DECISION files

**Acceptance criteria:**
1. P33 planning report written and committed to `outputs/online_validation/`
2. State machine states, transitions, and hard invariants documented
3. All 6 sources inventoried with current status and evidence gaps
4. C1-C4 phases defined with concrete acceptance criteria
5. Dependencies on Axis A and Axis B identified
6. Risk boundaries enumerated
7. Only the P33 report file staged and committed
8. CI green after push

**Files produced:** `outputs/online_validation/p33_axis_c_scope_definition_report.md` (this file)

---

### C1 — Data Contract and Evidence Inventory

**Objective:** Produce a structured evidence inventory showing, for each eligible source, exactly
what evidence exists in the current codebase (test assertions, type contracts, fact structures)
and what is missing before a research snapshot can be built.

**Scope:**
- Read-only survey of `src/lib/research/`, `src/lib/onlineValidation/p38/`, `src/lib/onlineValidation/p39/`
- Produce a JSON or MD evidence table per source
- No code changes; no DB access; no Prisma; pure file reads + documentation

**Key questions to answer:**
1. For MonthlyRevenue: which `SourceReadinessFacts` fields are currently test-asserted? Are all SNAPSHOT_READY gates covered?
2. For Quote/Regime: which test cases confirm `pitSafeConfirmed=true` produces `SIMULATION_INPUT_ELIGIBLE`?
3. For `ControlledResearchSnapshotBuilder`: does it correctly propagate `sourceTrace` through all readiness states?
4. What is the minimum fact set that yields `SNAPSHOT_READY` from `buildControlledResearchSnapshot`?
5. Are there any uncovered edge cases in the P21 + P23-P29 test matrix?

**Deliverables:**
- `outputs/online_validation/p34_axis_c_evidence_inventory.md` (C1 report — separate phase)
- Evidence table: per-source fact coverage, missing assertions, gap classification

**Acceptance criteria:**
1. Evidence inventory covers all 6 sources
2. For each source: current state, evidence present (by test file + line), evidence missing, gate to SIE
3. No src/ modifications
4. Forbidden claims scan CLEAN
5. CI green after commit

**Dependency:** C0 (this document) — complete.
**Dependency:** P21 (`p21_axis_a_source_trace_pit_metadata.test.ts`) — evidence base for sourceTrace/PIT metadata gaps.

---

### C2 — Dry-Run Integration Validation

**Objective:** Write fixture-backed unit tests that verify the full Axis A→B pipeline:
`SourceReadinessFacts` → `SimulationInputReadinessMapper` → `PaperSimulationInputContractBuilder`
→ `buildControlledResearchSnapshot` — for eligible sources (MonthlyRevenue, Quote, Regime).

**Scope:**
- New test file: `src/lib/simulation/__tests__/p35_axis_c_eligibility_pipeline.test.ts`
  (or `src/lib/research/__tests__/p35_axis_c_pipeline_integration.test.ts`)
- Pure unit tests — no DB, no Prisma, no side effects, all fixture-backed
- Tests only the deterministic pipeline logic; no scheduling, no runtime, no advice

**Key test cases (proposed):**
- `T1`: MonthlyRevenue with all evidence present → SIMULATION_INPUT_ELIGIBLE → bundle contains MonthlyRevenue → snapshot SNAPSHOT_READY
- `T2`: Quote with pitSafeConfirmed=true → SIMULATION_INPUT_ELIGIBLE → bundle contains Quote
- `T3`: Regime with pitSafeConfirmed=true → SIMULATION_INPUT_ELIGIBLE → bundle contains Regime
- `T4`: All 3 eligible sources → bundle eligibleCount=3, blockedCount=0 → SNAPSHOT_READY
- `T5`: NewsEvent added to facts → stays out of eligible bundle (BLOCKED_QUALITY_EVIDENCE)
- `T6`: FinancialReport added to facts → stays out of eligible bundle (BLOCKED_PIT_METADATA)
- `T7`: Chip added to facts → stays out (BLOCKED_AUTHORIZATION)
- `T8`: sourceTrace preserved end-to-end through pipeline
- `T9`: Bundle with forbidden field in facts → BLOCKED_AUTHORIZATION, no eligible sources
- `T10`: Future asOfDate → SNAPSHOT_BLOCKED_PIT at snapshot level

**Hard invariants asserted in every test:**
```typescript
expect(result.entersAlphaScore).toBe(false);
expect(result.paperOnly).toBe(true);
expect(result.dryRun).toBe(true);
expect(result.notInvestmentRecommendation).toBe(true);
```

**Acceptance criteria:**
1. All new tests pass (target: ≥10 tests, fixture-backed, deterministic)
2. No existing test broken (simulation 150/150, research suite stable)
3. No DB, Prisma, scoring, or real-execution code touched
4. No forbidden claims (ROI, win-rate, recommendation, buy/sell/action)
5. `entersAlphaScore=false` asserted in every test path
6. CI green after commit

**Dependency:** C0 (state machine defined), C1 (evidence inventory, gap confirmation).

---

### C3 — Simulation-Only Integration

**Objective:** Wire the C2-validated pipeline into `ControlledResearchSnapshotBuilder` so that
a snapshot can be materialized from confirmed Axis A evidence and fed into a P39 paper
simulation bundle in a single deterministic call.

**Scope:**
- Extend or add to `src/lib/research/ControlledResearchSnapshotBuilder.ts` (if gap identified in C1)
- Extend or add to `src/lib/onlineValidation/p39/PaperSimulationInputContractBuilder.ts`
- Write integration fixture test verifying round-trip: facts → snapshot → bundle
- No real simulation execution; no DB; no optimizer; no metrics

**Key deliverables:**
- `SnapshotToBundle` bridge function (or contract type) that accepts a `ControlledResearchSnapshot`
  and produces a `PaperSimulationInputBundle` containing only SNAPSHOT_READY eligible sources
- Fixture test: `p36_axis_c_snapshot_to_bundle_integration.test.ts`
- Invariants: same as C2; all governance fields preserved across boundary

**Acceptance criteria:**
1. Round-trip test: `facts → SNAPSHOT_READY → bundle` with only eligible sources
2. BLOCKED sources never appear in bundle regardless of input
3. `entersAlphaScore=false`, `paperOnly=true`, `dryRunOnly=true` preserved across boundary
4. No real DB, Prisma, scoring formula, optimizer, or backtest involved
5. Existing 150 simulation + research tests unaffected
6. CI green after commit

**Dependency:** C2 — dry-run validation tests must be green.

---

### C4 — Reporting and Governance Closure

**Objective:** Produce the Axis C final report, update the roadmap, and close the evidence chain.

**Scope:**
- Final report: `outputs/online_validation/p37_axis_c_final_report.md`
  (name subject to revision based on actual phase numbers)
- Roadmap update: `00-Plan/roadmap/roadmap.md` — add C4 completion overlay
- No src/ code changes in this phase

**Deliverables:**
- Axis C final report with: state machine summary, source inventory, C0-C3 completion evidence,
  test count, CI run references, classification
- Roadmap overlay: `P33-Axis C Completion`
- Push + protected CI green

**Acceptance criteria:**
1. Final report covers C0-C3 evidence
2. All Axis C tests (C2 + C3) are referenced with counts and CI run
3. Source status table accurate at time of closure
4. Roadmap overlay added
5. Only report + roadmap staged (no src/, no active_task.md, no 00-StockPlan/)
6. CI green after push

**Dependency:** C3 — simulation-only integration must be committed and green.

---

## 6. Dependencies and Assumptions

### Axis A Dependencies

| Dependency | File | Status | Used By |
|---|---|---|---|
| `SourceReadinessFacts` type | `src/lib/onlineValidation/p38/SimulationInputReadinessTypes.ts` | Committed ✓ | C1, C2 — facts input structure |
| `SimulationInputReadinessMapper` | `src/lib/onlineValidation/p38/SimulationInputReadinessMapper.ts` | Committed ✓ | C2 — state transitions |
| `ControlledResearchSnapshot` types | `src/lib/research/ControlledResearchSnapshot.ts` | Committed ✓ | C2, C3 — snapshot contract |
| `ControlledResearchSnapshotBuilder` | `src/lib/research/ControlledResearchSnapshotBuilder.ts` | Committed ✓ | C2, C3 — snapshot construction |
| P21 sourceTrace/PIT tests | `src/lib/research/__tests__/p21_axis_a_source_trace_pit_metadata.test.ts` | Committed ✓ | C1 — evidence base for gap analysis |

### Axis B Dependencies

| Dependency | File | Status | Used By |
|---|---|---|---|
| `PaperSimulationInputContract` types | `src/lib/onlineValidation/p39/PaperSimulationInputContract.ts` | Committed ✓ | C2, C3 — bundle contract |
| `PaperSimulationInputContractBuilder` | `src/lib/onlineValidation/p39/PaperSimulationInputContractBuilder.ts` | Committed ✓ | C3 — bundle construction |
| P23-P29 Axis B test suite | `src/lib/simulation/__tests__/p23_*.test.ts` … `p29_*.test.ts` | Committed ✓ | C2/C3 must not break these (regression) |
| P38 readiness types | `src/lib/onlineValidation/p38/SimulationInputReadinessTypes.ts` | Committed ✓ | Both axes |

### Assumptions

1. **MonthlyRevenue, Quote, Regime** are the only currently eligible sources. C2/C3 scope these three first.
2. **NewsEvent, FinancialReport, Chip** remain blocked in C2/C3; C1 will document the exact evidence gap for each.
3. **C1 is read-only** — no DB access needed; evidence comes from existing tests and type contracts.
4. **CEO framing prevails**: "Axis C" is a phase label, not a new product axis; outputs are labeled as Axis A/B bridge work.
5. **Anti-axis-monopoly rule**: Axis C C2/C3 phases touch `src/` and must be counted as Axis A deliveries (closes the 4:1 ratio).

---

## 7. Risk Boundaries

| Risk | Boundary | Mitigation |
|---|---|---|
| **PIT-safety** | All state machine transitions must check `pitStatus`, `pitConfidence`, `pitMetadataComplete`, `pitSafeConfirmed` | C2 test T10: future asOfDate → SNAPSHOT_BLOCKED_PIT; T3/T4: pitSafeConfirmed=false → not eligible |
| **No investment advice** | State machine outputs are eligibility flags only (boolean) — no price targets, ROI, win-rate, recommendation | Hard invariant: `noInvestmentAdvice=true` asserted in all C2/C3 tests |
| **No production trading** | `dryRunOnly=true`, `paperOnly=true` are struct-level constants, not runtime flags | TypeScript type system enforces `paperOnly: true` literal type on all bundle entries |
| **No hidden data leakage** | State machine uses only `SourceReadinessFacts` input struct — no raw DB reads, no Prisma, no API calls | C2/C3 tests are pure unit tests with no I/O |
| **No source contamination** | PROJECT_CONTEXT_LOCK: Stock-Prediction-System only | P33 planning scope is limited to current repo; no Betting-pool/MLB/CLV/P26J/P26K references |
| **No USER_DECISION file staging** | `active_task.md`, `00-StockPlan/*` must not be staged in any Axis C commit | Boundary scan in each commit verifies no forbidden files staged |
| **No scoring formula access** | `entersAlphaScore=false` is a struct-level literal type in all contracts | Type system + runtime assert; `SIMULATION_INPUT_FORBIDDEN_FIELDS` list enforced in P38 mapper |
| **No DB schema changes in C0-C2** | C0/C1 are read-only; C2 is pure unit tests | C3 may extend builder types but must not touch Prisma schema or run migrations |
| **Axis B regression** | C2/C3 must not break P23-P29 test suite (150 tests) | Pre-commit: run full simulation + research suites; CI verifies all 3 required checks |
| **No FinancialReport/Chip activation** | Both remain BLOCKED; C2/C3 test that they stay out of bundles | C2 test T5-T7 assert these sources never appear in eligible bundle |

---

## 8. Files Created or Modified

| File | Action | Notes |
|---|---|---|
| `outputs/online_validation/p33_axis_c_scope_definition_report.md` | Created (this file) | P33 C0 output — planning only, no code |

No `src/`, `prisma/`, `data/`, `scripts/`, `tests/`, `logs/`, `runtime/` files modified.
No DB schema, scoring, package-lock, or production data changes.

---

## 9. Tests / Verification Result

This is a planning-only phase (C0). No new tests are written in P33.
Existing test suites are unaffected — no code changes.

Pre-P33 baseline (from P32A CI run 26383114389, conclusion: success):
- `onlineValidation (4846/4846)` ✓
- `research + simulation (275/275)` ✓
- `Dirty-File Bleed-Through Guard` ✓

Governance-safe local check before commit:

```bash
npx jest src/lib/simulation/__tests__/ src/lib/research/__tests__/ --no-coverage
# Expected: 407/407 PASS (13 suites × sim + research)
```

---

## 10. Commit Hash

`67985a6` — `docs: define P33 Axis C implementation scope`
CI run: triggered — 3 required checks expected (onlineValidation, research+simulation, dirty-file guard).

Proposed commit message:
```
docs: define P33 Axis C implementation scope

Axis C = Axis A→B Bridge Design: PIT-Safe Eligibility State Machine.
Defines C0-C4 phase plan, source inventory (6 sources), state machine
formal definition, dependencies on P38/P39/P21, and risk boundaries.

Planning only — no src/, no prisma/, no scoring, no DB, no package-lock.
Authorized by user P33 task 2026-05-25.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## 11. Remaining Dirty Files

| File | Status | Plan |
|---|---|---|
| `00-Plan/roadmap/active_task.md` | Modified | USER_DECISION — do NOT stage |
| `00-StockPlan/20260514/` | Untracked | USER_DECISION — do NOT stage |
| `00-StockPlan/20260515/` | Untracked | USER_DECISION — do NOT stage |

---

## 12. Final Classification

```
P33_AXIS_C_SCOPE_DEFINED
```

---

## 13. CTO Agent 10-Line Summary

```
1. Pre-flight PASS: repo canonical, branch main, HEAD f024fd3 (P32A commit), USER_DECISION items only in dirty state.
2. Axis C defined as "Axis A→B Bridge Design: PIT-Safe Eligibility State Machine" — CEO framing preserved.
3. Formal state machine documented: 8 states, evidence-gated transitions, hard invariants (entersAlphaScore=false, paperOnly=true).
4. Source inventory: MonthlyRevenue/Quote/Regime = ELIGIBLE (3); NewsEvent = BLOCKED_QUALITY_EVIDENCE; FinancialReport = BLOCKED_PIT_METADATA; Chip = BLOCKED_AUTHORIZATION/LAG.
5. C0-C4 phases defined: C0=scope (P33), C1=evidence inventory, C2=dry-run integration tests, C3=snapshot-to-bundle wiring, C4=governance closure.
6. Dependencies: P38 readiness mapper, P39 input contract builder, P21 sourceTrace/PIT tests, P23-P29 Axis B regression suite.
7. Risk boundaries: PIT-safety gated on pitSafeConfirmed; no advice/scoring/trading/DB in C0-C2; FinancialReport/Chip remain blocked.
8. P33 report created (outputs/online_validation/p33_axis_c_scope_definition_report.md); only this file staged.
9. Local verification 407/407 PASS before commit; CI baseline from 26383114389 (all 3 checks green).
10. Final classification: P33_AXIS_C_SCOPE_DEFINED.
```

---

## 14. Next 24h Prompt (copy-paste ready)

```
[每次交接開頭] — Governance Header

## Required Output
- next 24h 可以直接複製貼上的 prompt
- CTO agent 10 行內摘要

---

# Branch Governance (MANDATORY)
Canonical Repo: /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System
Canonical Branch: main
Rules: Do NOT create a new branch. Do NOT modify active_task.md or 00-StockPlan/*.

Required Pre-flight:
  git rev-parse --show-toplevel
  git branch --show-current
  git status --short
  git rev-parse HEAD

---

[Stock] P34 — Axis C C1: Evidence Inventory

你現在是 Stock Prediction System 的 CTO agent。

P33 classification: P33_AXIS_C_SCOPE_DEFINED
P33 planning report: outputs/online_validation/p33_axis_c_scope_definition_report.md
P33 defines Axis C as "Axis A→B Bridge Design: PIT-Safe Eligibility State Machine."
Current HEAD after P33 commit (to be confirmed on start): TBD

Task Objectives (C1 — Evidence Inventory, read-only):
1. Run required pre-flight.
2. Read the P33 planning report for the full state machine and source inventory.
3. For each of the 6 sources (MonthlyRevenue, Quote, Regime, NewsEvent, FinancialReport, Chip):
   a. Read the relevant test files in src/lib/research/__tests__/ and src/lib/simulation/__tests__/
   b. Read src/lib/onlineValidation/p38/SimulationInputReadinessMapper.ts
   c. Read src/lib/onlineValidation/p39/PaperSimulationInputContract.ts
   d. Read src/lib/research/ControlledResearchSnapshotBuilder.ts
   e. Identify which SourceReadinessFacts fields are currently test-asserted and which are NOT.
4. Produce a structured evidence inventory per source:
   - Current state (from P38 mapper)
   - Evidence present (test file + describe/it path)
   - Evidence missing (fields not yet asserted)
   - Gate to SIMULATION_INPUT_ELIGIBLE (what's needed)
5. Identify the minimum fact set for SNAPSHOT_READY from buildControlledResearchSnapshot.
6. Identify any uncovered edge cases in the P21 + P23-P29 test matrix that C2 should target.
7. Write report to: outputs/online_validation/p34_axis_c_evidence_inventory.md
8. Stage only the P34 report file.
9. Run: npx jest src/lib/simulation/__tests__/ src/lib/research/__tests__/ --no-coverage
10. Commit if staged set contains only P34 report and no USER_DECISION files.

Governance constraints:
- Do NOT touch active_task.md or 00-StockPlan/*.
- Do NOT modify src/, prisma/, data/, scripts/, tests/, logs/, runtime/.
- Do NOT change scoring, DB schema, package-lock, or production data.
- No investment advice, no buy/sell/action, no PnL/ROI/win-rate claims.
- entersAlphaScore=false invariant must be respected in all outputs.
- No branch creation. No force push.

Final classification should be one of:
- P34_AXIS_C_EVIDENCE_INVENTORY_COMPLETE
- P34_PLANNING_ONLY_NOT_COMMITTED
- P34_BLOCKED_BY_DIRTY_STATE
- P34_BLOCKED_BY_USER_DECISION_FILES
```
