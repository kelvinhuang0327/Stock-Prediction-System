# P34 — Axis C C1: Evidence Inventory

Date: 2026-05-25
Project: Stock-Prediction-System
Phase: P34 — Axis C C1: Read-Only Evidence Inventory
Branch: main
HEAD at inventory time: 35e03f8 (docs: finalize P33 report commit metadata)
Classification: P34_AXIS_C_EVIDENCE_INVENTORY_COMMITTED

> **DISCLAIMER:** This document is a read-only evidence inventory.
> It does not constitute investment advice, a buy/sell/hold recommendation, or any
> investment performance claim. All described paths are paper-only, dry-run-only,
> entersAlphaScore=false, no PnL/ROI/win-rate semantics.

---

## 1. Pre-flight Result

| Check | Expected | Result |
|---|---|---|
| Repo root | `/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System` | PASS |
| Branch | `main` | PASS |
| HEAD | `35e03f8` (P33 metadata finalization) | PASS |
| Dirty files before P34 | `active_task.md` M, `00-StockPlan/20260514/` ??, `00-StockPlan/20260515/` ?? | PASS — all USER_DECISION |
| STOP conditions | none triggered | PASS |

---

## 2. P33 Post-Commit Metadata Dirty State

**Was P33 report dirty?** YES — `p33_axis_c_scope_definition_report.md` contained
`PENDING — will be recorded after commit` in Section 10 (post-commit hash update).

**Diff classification:** Documentation metadata only — replaced one line
(`PENDING`) with the actual commit hash `67985a6` and CI trigger note.

**Action taken:** Staged only the P33 report file, committed and pushed.

---

## 3. P33 Metadata Commit Hash

```
35e03f8  docs: finalize P33 report commit metadata
```

CI triggered from `35e03f8` push — 3 required checks expected.

---

## 4. Files Read for This Inventory

| File | Purpose |
|---|---|
| `src/lib/onlineValidation/p38/SimulationInputReadinessTypes.ts` | `SourceReadinessFacts` interface, `SimulationInputStatus` enum |
| `src/lib/onlineValidation/p38/SimulationInputReadinessMapper.ts` | Per-source resolver functions (all 6 sources) |
| `src/lib/onlineValidation/p39/PaperSimulationInputContract.ts` | Bundle types, `P39_ELIGIBLE_SOURCES`, `P39_BLOCKED_SOURCES` |
| `src/lib/onlineValidation/p39/PaperSimulationInputContractBuilder.ts` | `buildPaperSimulationInputBundle`, `buildDefaultPaperSimulationInputBundle` |
| `src/lib/research/ControlledResearchSnapshot.ts` | Snapshot contract, `classifyOverallReadiness` |
| `src/lib/research/ControlledResearchSnapshotBuilder.ts` | `buildControlledResearchSnapshot`, `classifyOverallReadiness` logic |
| `src/lib/research/__tests__/controlled_research_snapshot.test.ts` | T1-T14 core snapshot tests |
| `src/lib/research/__tests__/p21_axis_a_source_trace_pit_metadata.test.ts` | T16-T18 sourceTrace/PIT extension |
| `src/lib/simulation/__tests__/p23_axis_b_dryrun_validation_extension.test.ts` | T11-T15 Axis B dry-run/governance |
| `src/lib/simulation/__tests__/p25_axis_b_p39_bundle_boundary.test.ts` | T16-T20 bundle boundary |
| `src/lib/simulation/__tests__/p27_axis_b_p39_validator_edge_cases.test.ts` | T21-T25 validator edge cases |
| `src/lib/simulation/__tests__/p29_axis_b_p39_advanced_edge_cases.test.ts` | T26-T30 advanced edge cases |

---

## 5. Mapper Logic Summary (per source)

Understanding the resolver logic is the foundation for identifying coverage gaps.

| Source | Resolver | Fields Checked (in order) | Fields IGNORED by mapper | Result when all checked fields pass |
|---|---|---|---|---|
| **MonthlyRevenue** | `resolveMonthlyRevenue` | `pitMetadataComplete`, `qualityEvidenceComplete`, `consumerStatus=CONSUMER_READY` | `pitStatus`, `pitConfidence`, `lagEvidenceComplete`, `authorizationGranted`, `pitSafeConfirmed`, `sourceTrace` | `SIMULATION_INPUT_ELIGIBLE` |
| **Quote** | `resolveQuoteOrRegime` | `pitSafeConfirmed=true` only | `pitStatus`, `pitConfidence`, `consumerStatus`, `qualityEvidenceComplete`, `pitMetadataComplete`, `lagEvidenceComplete`, `authorizationGranted`, `sourceTrace` | `SIMULATION_INPUT_ELIGIBLE` |
| **Regime** | `resolveQuoteOrRegime` | `pitSafeConfirmed=true` only | (same as Quote) | `SIMULATION_INPUT_ELIGIBLE` |
| **NewsEvent** | `resolveNewsEvent` | `qualityEvidenceComplete` (gate), then always `SOURCE_PRESENT_AUDIT_ONLY` | nothing — can never reach ELIGIBLE via this resolver | Max: `SOURCE_PRESENT_AUDIT_ONLY` |
| **FinancialReport** | `resolveFinancialReport` | none — hardcoded BLOCKED | all fields ignored | Always `BLOCKED_PIT_METADATA` |
| **Chip** | `resolveChip` | `authorizationGranted` first | all other fields after auth check | Max: `BLOCKED_LAG_EVIDENCE` |

**Key architectural fact:** `ControlledResearchSnapshotBuilder` only accepts facts for
MonthlyRevenue, Quote, Regime. NewsEvent, FinancialReport, and Chip cannot enter the
builder; they are only handled at the P39 bundle validation layer.

---

## 6. Source-by-Source Coverage Table

### 6.1 MonthlyRevenue

**Current state:** `SIMULATION_INPUT_ELIGIBLE`
**Path to eligibility:** `pitMetadataComplete=true` AND `qualityEvidenceComplete=true` AND `consumerStatus=CONSUMER_READY`

| Field | Role in Mapper | Asserted in Tests | Test Reference |
|---|---|---|---|
| `pitMetadataComplete=false` | → `BLOCKED_PIT_METADATA` | ✅ YES | T17.1, T17.2, T17.3, T17.4 |
| `pitMetadataComplete=true` | passes first gate | ✅ YES (all eligible fact sets) | T4.1, T17.9, T18.1 |
| `qualityEvidenceComplete=false` | → `BLOCKED_QUALITY_EVIDENCE` | ✅ YES | T17.5 |
| `qualityEvidenceComplete=true` | passes second gate | ✅ YES (all eligible fact sets) | T4.1, T18.1 |
| `consumerStatus=CONSUMER_READY` | → ELIGIBLE | ✅ YES | T4.1, T17.9 |
| `consumerStatus=BLOCKED` | → `CONSUMER_READY_AUDIT_ONLY` | ✅ YES | T17.6 |
| `consumerStatus=SOURCE_PRESENT_AUDIT_ONLY` | → `CONSUMER_READY_AUDIT_ONLY` | ⚠️ PARTIAL | Only BLOCKED tested; SPAO variant not explicit |
| `pitStatus` | IGNORED by mapper | ✅ YES | T17.9 (pitStatus=MISSING+eligible shows ignored) |
| `lagEvidenceComplete=false` | IGNORED by mapper | ❌ NOT TESTED | No test asserts MR with lag=false → still ELIGIBLE |
| `authorizationGranted=false` | IGNORED by mapper | ❌ NOT TESTED | No test asserts MR with auth=false → still ELIGIBLE |
| `pitSafeConfirmed=false` | IGNORED by mapper | ❌ NOT TESTED | T17.9 shows pitStatus ignored, not pitSafeConfirmed |
| `pitConfidence` | IGNORED by mapper | ❌ NOT TESTED | No variation tests (LOW/NONE/MEDIUM) |
| `sourceTrace` | Passed to entry | ✅ YES | T16.1-T16.8 |

**Missing assertions (C2 targets for MR):**
- C2-MR-1: `lagEvidenceComplete=false` + all other fields complete → ELIGIBLE (shows mapper ignores this)
- C2-MR-2: `authorizationGranted=false` + all other fields complete → ELIGIBLE (shows mapper ignores this)
- C2-MR-3: `pitSafeConfirmed=false` + all other fields complete → ELIGIBLE
- C2-MR-4: `consumerStatus=SOURCE_PRESENT_AUDIT_ONLY` → `CONSUMER_READY_AUDIT_ONLY` (distinct from BLOCKED case)
- C2-MR-5: `pitConfidence=NONE` + pitMetadataComplete=true → ELIGIBLE (shows pitConfidence ignored)

---

### 6.2 Quote

**Current state:** `SIMULATION_INPUT_ELIGIBLE` (when `pitSafeConfirmed=true`)
**Path to eligibility:** `pitSafeConfirmed=true` only

| Field | Role in Mapper | Asserted in Tests | Test Reference |
|---|---|---|---|
| `pitSafeConfirmed=true` | → ELIGIBLE | ✅ YES | T17.7, T17.10, T4.1 |
| `pitSafeConfirmed=false` | → `SOURCE_PRESENT_AUDIT_ONLY` | ✅ YES | T17.8, T5.2 |
| `pitStatus=NOT_ASSESSED` + confirmed=true | ELIGIBLE (pitStatus ignored) | ✅ YES | T17.7 |
| `pitMetadataComplete=false` + confirmed=true | ELIGIBLE (pitMetadataComplete ignored) | ✅ YES | T17.10 |
| `consumerStatus` | IGNORED by mapper | ❌ NOT TESTED | No test with consumerStatus=BLOCKED + pitSafeConfirmed=true |
| `qualityEvidenceComplete=false` | IGNORED by mapper | ❌ NOT TESTED | No test showing Quote ignores quality evidence |
| `lagEvidenceComplete=false` | IGNORED by mapper | ❌ NOT TESTED | No test |
| `authorizationGranted=false` | IGNORED by mapper | ❌ NOT TESTED | No test |
| `pitConfidence` | IGNORED by mapper | ❌ NOT TESTED | No variation |
| `sourceTrace` | Passed to entry | ✅ YES | T16.1 (used in eligible Quote fact) |

**Missing assertions (C2 targets for Quote):**
- C2-QUOTE-1: `consumerStatus=BLOCKED` + `pitSafeConfirmed=true` → ELIGIBLE (mapper ignores consumerStatus)
- C2-QUOTE-2: `qualityEvidenceComplete=false` + `pitSafeConfirmed=true` → ELIGIBLE
- C2-QUOTE-3: `lagEvidenceComplete=false` + `pitSafeConfirmed=true` → ELIGIBLE
- C2-QUOTE-4: `authorizationGranted=false` + `pitSafeConfirmed=true` → ELIGIBLE

---

### 6.3 Regime

**Current state:** `SIMULATION_INPUT_ELIGIBLE` (when `pitSafeConfirmed=true`)
**Path to eligibility:** Same as Quote — uses same `resolveQuoteOrRegime` function

| Field | Role in Mapper | Asserted in Tests | Test Reference |
|---|---|---|---|
| `pitSafeConfirmed=true` | → ELIGIBLE | ✅ YES | T4.1, T18.1 |
| `pitSafeConfirmed=false` | → `SOURCE_PRESENT_AUDIT_ONLY` | ⚠️ PARTIAL | Tested via Quote; Regime-specific variant not explicit |
| All other fields | IGNORED | ❌ NOT TESTED | Same gaps as Quote |

**Missing assertions (C2 targets for Regime):**
- C2-REGIME-1: `pitSafeConfirmed=false` → `SOURCE_PRESENT_AUDIT_ONLY` (Regime-specific)
- C2-REGIME-2: `consumerStatus=BLOCKED` + `pitSafeConfirmed=true` → ELIGIBLE
- C2-REGIME-3: All quote gaps apply symmetrically to Regime

---

### 6.4 NewsEvent

**Current state:** `SOURCE_PRESENT_AUDIT_ONLY` (max possible state — can never reach ELIGIBLE)
**Path to BLOCKED_QUALITY_EVIDENCE:** `qualityEvidenceComplete=false`
**Max reachable state:** `SOURCE_PRESENT_AUDIT_ONLY` (even with quality=true, still SPAO)

| Field | Role in Mapper | Asserted in Tests | Test Reference |
|---|---|---|---|
| `qualityEvidenceComplete=false` | → `BLOCKED_QUALITY_EVIDENCE` | ❌ NOT TESTED at mapper level | P28/P29 test validator rejection, not mapper output |
| `qualityEvidenceComplete=true` | → `SOURCE_PRESENT_AUDIT_ONLY` | ❌ NOT TESTED | Critical gap: shows NewsEvent can't reach ELIGIBLE |
| In eligibleSources → validator rejects | ✅ YES | T28.1 (P29) |
| In eligibleSources with alpha tamper → rejected | ✅ YES | T28.5 (P29) |

**Missing assertions (C2 targets for NewsEvent):**
- C2-NEWS-1: Call `mapSourceToSimulationInputReadiness` with NewsEvent facts where `qualityEvidenceComplete=true` → result is `SOURCE_PRESENT_AUDIT_ONLY` (max reachable state)
- C2-NEWS-2: Call mapper with NewsEvent `qualityEvidenceComplete=false` → `BLOCKED_QUALITY_EVIDENCE`
- C2-NEWS-3: Bundle built with NewsEvent entry (SPAO status) → newsEvent appears in `blockedSources`, NOT in `eligibleSources`

**Architectural note:** `ControlledResearchSnapshotBuilder` does not accept NewsEvent facts.
NewsEvent eligibility can only be checked at the P38 mapper + P39 bundle level.

---

### 6.5 FinancialReport

**Current state:** Always `BLOCKED_PIT_METADATA` regardless of input facts
**Path to ELIGIBLE:** Blocked by design — requires DB schema migration + explicit authorization

| Field | Role in Mapper | Asserted in Tests | Test Reference |
|---|---|---|---|
| Any facts | All IGNORED — resolver unconditional | ❌ NOT TESTED at mapper level | Only validator-level (T28.2 P29) |
| In eligibleSources → validator rejects | ✅ YES | T28.2 (P29) |
| blockingReasons always contains releaseDate | ❌ NOT TESTED | No direct mapper call test |

**Missing assertions (C2 targets for FinancialReport):**
- C2-FR-1: Call `mapSourceToSimulationInputReadiness` with FinancialReport facts where all fields=true → still `BLOCKED_PIT_METADATA` (demonstrates unconditional block)
- C2-FR-2: `blockingReasons` for FinancialReport always mentions `releaseDate`, `releaseDateSource`, `releaseDateConfidence`
- C2-FR-3: No combination of FinancialReport facts can produce ELIGIBLE (architectural invariant test)

**Architectural note:** `resolveFinancialReport` ignores all `SourceReadinessFacts` parameters.
It always returns `BLOCKED_PIT_METADATA` with 4 hardcoded blocking reasons.

---

### 6.6 Chip

**Current state:** `BLOCKED_AUTHORIZATION` (if `authorizationGranted=false`) or `BLOCKED_LAG_EVIDENCE` (if `authorizationGranted=true`)
**Max reachable state:** `BLOCKED_LAG_EVIDENCE` — can never reach ELIGIBLE without schema migration

| Field | Role in Mapper | Asserted in Tests | Test Reference |
|---|---|---|---|
| `authorizationGranted=false` | → `BLOCKED_AUTHORIZATION` | ❌ NOT TESTED at mapper level | Only validator (T28.3 P29) |
| `authorizationGranted=true` | → `BLOCKED_LAG_EVIDENCE` | ❌ NOT TESTED | No direct mapper call |
| In eligibleSources → validator rejects | ✅ YES | T28.3 (P29) |
| In eligibleSources with alpha + Chip → errors≥2 | ✅ YES | T28.5 (P29) |

**Missing assertions (C2 targets for Chip):**
- C2-CHIP-1: Call mapper with Chip `authorizationGranted=false` → `BLOCKED_AUTHORIZATION` with correct blocking reasons
- C2-CHIP-2: Call mapper with Chip `authorizationGranted=true` → `BLOCKED_LAG_EVIDENCE` (one step beyond, but still blocked)
- C2-CHIP-3: No Chip facts combination produces ELIGIBLE

---

## 7. Minimum Fact Set for SNAPSHOT_READY

From `classifyOverallReadiness` in `ControlledResearchSnapshotBuilder.ts`:

```typescript
const assessed = states.filter((s) => s !== "NOT_ASSESSED");
const eligible = states.filter((s) => s === "ELIGIBLE");

if (assessed.length === 0) return "SNAPSHOT_BLOCKED";
if (eligible.length === assessed.length && assessed.length > 0) return "SNAPSHOT_READY";
if (eligible.length > 0) return "SNAPSHOT_PARTIAL";
return "SNAPSHOT_BLOCKED";
```

**Rule:** SNAPSHOT_READY = every assessed source is ELIGIBLE (and at least 1 assessed).
NOT_ASSESSED sources are excluded from the comparison, so they do not block READY.

**Minimum fact set — Option A (MR only):**

```typescript
buildControlledResearchSnapshot({
  symbol: "2330",
  asOfDate: "2026-05-01",          // must be ≤ today
  monthlyRevenueFacts: {
    sourceName: "MonthlyRevenue",
    pitStatus: "PIT_GATE_PRESENT",  // value doesn't matter for MR mapper
    pitConfidence: "HIGH",           // value doesn't matter for MR mapper
    consumerStatus: "CONSUMER_READY",  // REQUIRED
    qualityEvidenceComplete: true,     // REQUIRED
    pitMetadataComplete: true,         // REQUIRED
    lagEvidenceComplete: true,         // value doesn't matter for MR mapper
    authorizationGranted: true,        // value doesn't matter for MR mapper
    pitSafeConfirmed: true,            // value doesn't matter for MR mapper
  },
  // quoteFacts: omitted → NOT_ASSESSED
  // regimeFacts: omitted → NOT_ASSESSED
})
// → assessed=[MR=ELIGIBLE], eligible=[MR=ELIGIBLE]
// → eligible.length === assessed.length → SNAPSHOT_READY ✓
// (Confirmed by T4.4)
```

**Minimum fact set — Option B (Quote or Regime only):**

```typescript
buildControlledResearchSnapshot({
  symbol: "2330",
  asOfDate: "2026-05-01",
  quoteFacts: {
    sourceName: "Quote",
    pitSafeConfirmed: true,   // only field that matters for Quote mapper
    // all other fields: any value is fine
    pitStatus: "NOT_ASSESSED",
    pitConfidence: "NONE",
    consumerStatus: "BLOCKED",
    qualityEvidenceComplete: false,
    pitMetadataComplete: false,
    lagEvidenceComplete: false,
    authorizationGranted: false,
  },
})
// → assessed=[Quote=ELIGIBLE], eligible=[Quote=ELIGIBLE]
// → SNAPSHOT_READY ✓
// (T12.1 confirms: no MR + eligible Quote + eligible Regime → SNAPSHOT_READY)
```

**Minimum fact set — All three sources (strongest form):**

```typescript
{
  monthlyRevenueFacts: { pitMetadataComplete: true, qualityEvidenceComplete: true, consumerStatus: "CONSUMER_READY", ...rest },
  quoteFacts: { pitSafeConfirmed: true, ...rest },
  regimeFacts: { pitSafeConfirmed: true, ...rest },
}
// → SNAPSHOT_READY (T4.1 confirmed)
```

**Key insight:** The SNAPSHOT_READY check is NOT "all 3 sources must be eligible". It is
"all ASSESSED sources must be eligible". Providing only 1 or 2 sources with eligible facts
is sufficient for SNAPSHOT_READY if the others are omitted (NOT_ASSESSED).

---

## 8. Pipeline Architecture Gap — Snapshot → Bundle Bridge (C3 Gap)

**Gap:** There is no function or test that connects a `ControlledResearchSnapshot` output
to `buildPaperSimulationInputBundle` input. The two systems are independent:

| Layer | Input | Output | Connected to next layer? |
|---|---|---|---|
| P38 mapper | `SourceReadinessFacts` | `SimulationInputReadinessEntry` | ✅ YES — P39 builder accepts entries |
| P39 builder | `SimulationInputReadinessEntry[]` | `PaperSimulationInputBundle` | ❌ NOT CONNECTED — no direct link to snapshot |
| Snapshot builder | `SourceReadinessFacts` (MR/Quote/Regime only) | `ControlledResearchSnapshot` | ❌ NOT CONNECTED — internally calls mapper but doesn't produce entries |

**C3 design target:** A bridge function with signature:
```typescript
function snapshotToBundle(
  snapshot: ControlledResearchSnapshot,
  opts: BuildContractOptions
): PaperSimulationInputBundle
```

This would:
1. Convert `snapshot.pitSafeInputs` back into `SimulationInputReadinessEntry[]`
2. Pass only ELIGIBLE entries to `buildPaperSimulationInputBundle`
3. Include BLOCKED/AUDIT_ONLY as blockedSources

**Or alternatively** (simpler — no bridge function needed):
- C2 tests build `SourceReadinessFacts` → call P38 mapper → call P39 builder → verify bundle
- C3 tests verify that the pipeline produces the same result as the default bundle

---

## 9. End-to-End Pipeline Coverage (C2 Gap)

**Gap:** No test currently runs the full `facts → mapper → bundle` pipeline.

- P25-P29 tests use `buildDefaultPaperSimulationInputBundle` (pre-baked, no mapper call)
  or construct `SimulationInputReadinessEntry[]` manually (no facts → mapper step)
- Research tests (`controlled_research_snapshot.test.ts`, `p21`) test `facts → mapper → snapshot`
  but stop before the P39 bundle step

**C2 must add:** Tests that call `mapSourceToSimulationInputReadiness(facts)` and then
pass the resulting entry into `buildPaperSimulationInputBundle([entry])`, verifying
the full round-trip for all 6 sources.

---

## 10. Complete C2 Target List (Prioritized)

### Priority 1 — Pipeline Integration (currently untested path)

| ID | Test Description | Verifies |
|---|---|---|
| C2-PIPE-1 | MR eligible facts → mapper → bundle → MR in eligibleSources | End-to-end pipeline for eligible source |
| C2-PIPE-2 | Quote eligible facts → mapper → bundle → Quote in eligibleSources | End-to-end for Quote |
| C2-PIPE-3 | Regime eligible facts → mapper → bundle → Regime in eligibleSources | End-to-end for Regime |
| C2-PIPE-4 | All 3 eligible → mapper × 3 → bundle → 3 in eligible, 0 blocked | All-eligible pipeline |
| C2-PIPE-5 | All 6 source facts → mapper × 6 → bundle → 3 eligible, 3 blocked | Full 6-source pipeline |

### Priority 2 — Mapper Field Isolation (fields that mapper ignores)

| ID | Test Description | Source | Field Tested |
|---|---|---|---|
| C2-MR-1 | MR with `lagEvidenceComplete=false` → ELIGIBLE | MonthlyRevenue | lagEvidenceComplete ignored |
| C2-MR-2 | MR with `authorizationGranted=false` → ELIGIBLE | MonthlyRevenue | authorizationGranted ignored |
| C2-MR-3 | MR with `pitSafeConfirmed=false` → ELIGIBLE | MonthlyRevenue | pitSafeConfirmed ignored |
| C2-MR-4 | MR with `consumerStatus=SOURCE_PRESENT_AUDIT_ONLY` → CONSUMER_READY_AUDIT_ONLY | MonthlyRevenue | SPAO variant |
| C2-QUOTE-1 | Quote with `consumerStatus=BLOCKED` + confirmed=true → ELIGIBLE | Quote | consumerStatus ignored |
| C2-QUOTE-2 | Quote with `qualityEvidenceComplete=false` + confirmed=true → ELIGIBLE | Quote | quality ignored |
| C2-REGIME-1 | Regime with `pitSafeConfirmed=false` → SOURCE_PRESENT_AUDIT_ONLY | Regime | Regime-specific SPAO |

### Priority 3 — Blocked Source Mapper Verification (mapper-level, not validator)

| ID | Test Description | Source |
|---|---|---|
| C2-NEWS-1 | NewsEvent `qualityEvidenceComplete=true` → SOURCE_PRESENT_AUDIT_ONLY (max state) | NewsEvent |
| C2-NEWS-2 | NewsEvent `qualityEvidenceComplete=false` → BLOCKED_QUALITY_EVIDENCE | NewsEvent |
| C2-FR-1 | FinancialReport any facts → always BLOCKED_PIT_METADATA | FinancialReport |
| C2-CHIP-1 | Chip `authorizationGranted=false` → BLOCKED_AUTHORIZATION | Chip |
| C2-CHIP-2 | Chip `authorizationGranted=true` → BLOCKED_LAG_EVIDENCE | Chip |

### Priority 4 — Governance Invariants in Pipeline

| ID | Test Description |
|---|---|
| C2-GOV-1 | All pipeline outputs have `entersAlphaScore=false` end-to-end |
| C2-GOV-2 | `sourceTrace` preserved through facts → entry → bundle |
| C2-GOV-3 | Blocked sources never appear in `eligibleSources` even when constructed from facts |
| C2-GOV-4 | Full 6-source bundle preserves all root governance flags |

**Total C2 test target count:** ≥ 20 tests across 4 priority groups.

---

## 11. Test Count Inventory (Existing, Before C2)

| Suite | File | Tests | Groups |
|---|---|---|---|
| Controlled Research Snapshot (P1 core) | `controlled_research_snapshot.test.ts` | ~90 | T1-T14 |
| P21 sourceTrace/PIT extension | `p21_axis_a_source_trace_pit_metadata.test.ts` | ~30 | T16-T18 |
| P23 Axis B dry-run extension | `p23_axis_b_dryrun_validation_extension.test.ts` | 25 | T11-T15 |
| P25 Axis B bundle boundary | `p25_axis_b_p39_bundle_boundary.test.ts` | 25 | T16-T20 |
| P27 Axis B validator edge cases | `p27_axis_b_p39_validator_edge_cases.test.ts` | 25 | T21-T25 |
| P29 Axis B advanced edge cases | `p29_axis_b_p39_advanced_edge_cases.test.ts` | 25 | T26-T30 |
| P4 golden fixture | `p4_golden_fixture_validation.test.ts` | varies | — |
| P6 fixture result contract | `p6_fixture_result_contract_extension.test.ts` | varies | — |
| ExperimentRegistry | `ExperimentRegistry.test.ts` | varies | — |
| ResearchParameterVersioning | `ResearchParameterVersioning.test.ts` | varies | — |
| ResearchStateMachine | `ResearchStateMachine.test.ts` | varies | — |
| ResearchCoverageEngine | `ResearchCoverageEngine.test.ts` | varies | — |
| p7 coverage determinism | `p7_research_coverage_determinism.test.ts` | varies | — |

**Total confirmed by local run:** 407/407 PASS, 13 suites.

---

## 12. Architecture Notes for C3 Design

**Option A — Bridge function (new src/ code):**
```typescript
// New function in src/lib/research/ControlledResearchSnapshotBridge.ts
function snapshotToBundle(
  snapshot: ControlledResearchSnapshot,
  opts?: BuildContractOptions
): PaperSimulationInputBundle
```
- Maps `snapshot.pitSafeInputs.*` back to readiness entries
- Eligible entries (ELIGIBLE) → `eligibleSources`
- Non-eligible (BLOCKED/AUDIT_ONLY/NOT_ASSESSED) → `blockedSources`
- Preserves `entersAlphaScore=false`, `paperOnly=true`, `dryRunOnly=true`

**Option B — No bridge function (re-use existing pipeline):**
- C3 verifies that calling `facts → mapper → bundle` produces the same result
  as what the snapshot would logically represent
- No new bridge function needed; the connection is conceptual, not structural
- Simpler — no new src/ file; C3 scope stays small

**Recommendation:** Option B for C3 — avoids adding new production code for a conceptual link
that already exists implicitly. C2 tests prove the pipeline; C3 proves the consistency.

---

## 13. Files Created or Modified

| File | Action | Notes |
|---|---|---|
| `outputs/online_validation/p33_axis_c_scope_definition_report.md` | Modified (metadata only) | Staged + committed as `35e03f8` |
| `outputs/online_validation/p34_axis_c_evidence_inventory.md` | Created (this file) | P34 C1 output — read-only inventory |

No `src/`, `prisma/`, `data/`, `scripts/`, `tests/`, `logs/`, `runtime/` files modified.

---

## 14. Tests / Verification Result

This is a planning-and-inventory phase (C1). No new tests written in P34.
Local suite run before commit:

```bash
npx jest src/lib/simulation/__tests__/ src/lib/research/__tests__/ --no-coverage
```

**Result: 13/13 suites PASS, 407/407 tests PASS** (verified at P33 commit; no code changed since).

---

## 15. Commit Hash

`126669b` — docs: inventory Axis C evidence coverage

Proposed commit message:
```
docs: inventory Axis C evidence coverage

C1 read-only evidence inventory for all 6 Axis C sources.
Maps SourceReadinessFacts fields to test coverage (asserted vs. missing)
for MonthlyRevenue, Quote, Regime, NewsEvent, FinancialReport, Chip.
Identifies 20+ C2 test targets and C3 bridge design options.

Read-only — no src/, no prisma/, no scoring, no DB, no package-lock.
HEAD at inventory time: 35e03f8.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## 16. Remaining Dirty Files

| File | Status | Plan |
|---|---|---|
| `00-Plan/roadmap/active_task.md` | Modified | USER_DECISION — do NOT stage |
| `00-StockPlan/20260514/` | Untracked | USER_DECISION — do NOT stage |
| `00-StockPlan/20260515/` | Untracked | USER_DECISION — do NOT stage |

---

## 17. Final Classification

```
P34_AXIS_C_EVIDENCE_INVENTORY_COMMITTED
```

---

## 18. CTO Agent 10-Line Summary

```
1. Pre-flight PASS: repo canonical, branch main, HEAD 35e03f8, USER_DECISION items only dirty.
2. P33 report was dirty (commit-hash metadata); staged+committed as 35e03f8, pushed to main.
3. Read 12 source files: P38 types+mapper, P39 contract+builder, ControlledResearchSnapshot+Builder, all Axis A/B test suites.
4. Mapper logic confirmed: MR checks 3 fields; Quote/Regime check only pitSafeConfirmed; FR unconditionally blocked; Chip blocked by auth/lag.
5. SNAPSHOT_READY minimum: only requires all ASSESSED sources to be ELIGIBLE; NOT_ASSESSED sources excluded from check.
6. 5 fields for MR are IGNORED by mapper (lagEvidenceComplete, authorizationGranted, pitSafeConfirmed, pitStatus, pitConfidence) — none are tested.
7. 4 fields for Quote/Regime are IGNORED (consumerStatus, qualityEvidenceComplete, lagEvidenceComplete, authorizationGranted) — none are tested.
8. Blocked sources (NewsEvent/FinancialReport/Chip) have NO direct mapper-call tests — only validator-level rejection tests exist.
9. End-to-end pipeline gap: no test runs facts → P38 mapper → P39 bundle; C2 targets ≥20 tests across 4 priority groups.
10. C3 architecture: recommend Option B (no bridge function); C2 pipeline tests prove the implicit connection without new src/ code.
```

---

## 19. Next 24h Prompt (copy-paste ready)

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

[Stock] P35 — Axis C C2: Dry-Run Pipeline Integration Tests

你現在是 Stock Prediction System 的 CTO agent。

已知狀態:
- P33 classification: P33_AXIS_C_SCOPE_DEFINED (commit: 67985a6, finalized 35e03f8)
- P34 classification: P34_AXIS_C_EVIDENCE_INVENTORY_COMMITTED (commit: TBD after P34 commit)
- P34 report: outputs/online_validation/p34_axis_c_evidence_inventory.md
- Local tests: 407/407 PASS (13 suites) before P34

USER_DECISION files (must remain untouched):
  - active_task.md
  - 00-StockPlan/20260514/*
  - 00-StockPlan/20260515/*

Task Objectives (C2 — Dry-Run Pipeline Integration Tests):

1. Run required pre-flight.
2. Read outputs/online_validation/p34_axis_c_evidence_inventory.md to understand:
   a. Section 10 — Complete C2 Target List (≥20 test targets, 4 priority groups)
   b. Section 8 — Pipeline architecture gap (facts → mapper → bundle)
   c. Section 7 — Minimum fact set for SNAPSHOT_READY
3. Read src/lib/onlineValidation/p38/SimulationInputReadinessMapper.ts (full file)
4. Read src/lib/onlineValidation/p39/PaperSimulationInputContractBuilder.ts (full file)
5. Write a new test file:
   src/lib/simulation/__tests__/p35_axis_c_eligibility_pipeline.test.ts
   
   Required tests (≥20):
   
   Priority 1 — Pipeline integration (C2-PIPE-1 through C2-PIPE-5):
   - P1.1: MR eligible facts → mapSourceToSimulationInputReadiness → buildPaperSimulationInputBundle → MR in eligibleSources
   - P1.2: Quote eligible facts (pitSafeConfirmed=true) → mapper → bundle → Quote in eligibleSources
   - P1.3: Regime eligible facts → mapper → bundle → Regime in eligibleSources
   - P1.4: All 3 eligible facts → mapper x3 → bundle → eligibleCount=3, blockedCount=0
   - P1.5: All 6 source facts → mapper x6 → bundle → 3 eligible, 3 blocked
   
   Priority 2 — Mapper field isolation (C2-MR-1 through C2-REGIME-1):
   - MR-1: lagEvidenceComplete=false + all other fields eligible → SIMULATION_INPUT_ELIGIBLE
   - MR-2: authorizationGranted=false + all other fields eligible → SIMULATION_INPUT_ELIGIBLE
   - MR-3: pitSafeConfirmed=false + all other fields eligible → SIMULATION_INPUT_ELIGIBLE
   - MR-4: consumerStatus=SOURCE_PRESENT_AUDIT_ONLY → CONSUMER_READY_AUDIT_ONLY
   - QUOTE-1: consumerStatus=BLOCKED + pitSafeConfirmed=true → SIMULATION_INPUT_ELIGIBLE
   - QUOTE-2: qualityEvidenceComplete=false + pitSafeConfirmed=true → SIMULATION_INPUT_ELIGIBLE
   - REGIME-1: pitSafeConfirmed=false → SOURCE_PRESENT_AUDIT_ONLY
   
   Priority 3 — Blocked source mapper verification (C2-NEWS through C2-CHIP):
   - NEWS-1: NewsEvent qualityEvidenceComplete=true → SOURCE_PRESENT_AUDIT_ONLY (max state)
   - NEWS-2: NewsEvent qualityEvidenceComplete=false → BLOCKED_QUALITY_EVIDENCE
   - FR-1: FinancialReport any facts → always BLOCKED_PIT_METADATA
   - CHIP-1: Chip authorizationGranted=false → BLOCKED_AUTHORIZATION
   - CHIP-2: Chip authorizationGranted=true → BLOCKED_LAG_EVIDENCE
   
   Priority 4 — Governance invariants (C2-GOV):
   - GOV-1: All pipeline outputs have entersAlphaScore=false
   - GOV-2: sourceTrace preserved through facts → entry → bundle
   - GOV-3: Blocked sources never appear in eligibleSources even when constructed from facts
   - GOV-4: Full 6-source bundle preserves all root governance flags

   Test file must have header disclaimer:
   DISCLAIMER: Test suite for Axis C pipeline integration only.
   entersAlphaScore = false. ALWAYS. Not investment advice.
   No buy/sell/hold semantics. No scoring formula access. No DB.

6. Run BEFORE commit:
   npx jest src/lib/simulation/__tests__/ src/lib/research/__tests__/ --no-coverage
   Expected: all 13 suites PASS + new p35 suite PASS. Total > 407.

7. Boundary scan — git diff --cached --name-only must show:
   - ONLY: src/lib/simulation/__tests__/p35_axis_c_eligibility_pipeline.test.ts
   - PLUS: outputs/online_validation/p35_axis_c_pipeline_test_report.md (if created)
   - NO src/ production files, no prisma/, no data/, no active_task.md, no 00-StockPlan/*

8. Produce report: outputs/online_validation/p35_axis_c_pipeline_test_report.md
   Contents:
   - Pre-flight result
   - Test count: new tests written + existing tests unaffected
   - Per-group test results
   - Governance invariants verified
   - Files created (test file + report)
   - Commit hash + CI status

9. Commit if clean:
   git add src/lib/simulation/__tests__/p35_axis_c_eligibility_pipeline.test.ts
   git add outputs/online_validation/p35_axis_c_pipeline_test_report.md
   git commit -m "test: add Axis C C2 dry-run pipeline integration tests"
   git push origin main

Governance constraints:
- Do NOT modify any existing test file.
- Do NOT modify any src/ production file (only the new __tests__ file is allowed).
- Do NOT touch prisma/, data/, scripts/, logs/, runtime/.
- Do NOT modify scoring logic, DB schema, package-lock, or production data.
- Do NOT touch active_task.md or 00-StockPlan/*.
- Do NOT provide investment advice or claim predictive performance.
- entersAlphaScore=false invariant must be asserted in every test path.
- All tests must be pure unit tests — no DB, no Prisma, no I/O, fixture-backed only.

Final classification should be one of:
- P35_AXIS_C_C2_TESTS_COMMITTED
- P35_TESTS_WRITTEN_NOT_COMMITTED
- P35_BLOCKED_BY_TEST_FAILURE
- P35_BLOCKED_BY_DIRTY_STATE
- P35_BLOCKED_BY_NON_TEST_DIFF
```
