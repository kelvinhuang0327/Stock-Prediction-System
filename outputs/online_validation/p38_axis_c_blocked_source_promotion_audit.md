# P38 — Axis C C5: Blocked Source Promotion Criteria Audit

Date: 2026-05-25
Project: Stock-Prediction-System
Phase: P38 — Axis C C5: Blocked Source Promotion Criteria Audit
Branch: main
HEAD at report time: 8d30a46 (test: add Axis C integration guard coverage)
Authorization: P37_AXIS_C_INTEGRATION_GUARD_TESTS_COMMITTED (8d30a46)
Classification: P38_BLOCKED_SOURCE_PROMOTION_AUDIT_COMPLETE

> **DISCLAIMER:** This document is a design audit and governance report only.
> It does not constitute investment advice, a buy/sell/hold recommendation, or any
> investment performance claim. All described paths are paper-only, dry-run-only,
> entersAlphaScore=false, no PnL/ROI/win-rate semantics.

---

## 1. Pre-flight Result

| Check | Expected | Result |
|---|---|---|
| Repo root | `/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System` | PASS |
| Branch | `main` | PASS |
| HEAD | `8d30a46` | PASS |
| Dirty files | USER_DECISION only | PASS |
| STOP conditions | none triggered | PASS |

---

## 2. Authorization Chain

| Classification | Commit | Artifact |
|---|---|---|
| `P35_AXIS_C_PIPELINE_TESTS_CI_GREEN` | `93e68db` | `p35_axis_c_pipeline_test_report.md` |
| `P36_AXIS_C_INTEGRATION_GUARD_DEFINED` | `c16b188` | `p36_axis_c_integration_guard_report.md` |
| `P37_AXIS_C_INTEGRATION_GUARD_TESTS_COMMITTED` | `8d30a46` | `p37_axis_c_integration_guard.test.ts` |

CI verified: Test Gate `26384311945` — `onlineValidation (4846/4846)`, `research + simulation (275/275)`, `Dirty-File Bleed-Through Guard` all SUCCESS.

---

## 3. Current Test Baseline

| Metric | Value |
|---|---|
| Test suites | 15 |
| Tests | 451 |
| Result | ALL PASS |
| Baseline as of | P37 commit `8d30a46` |

---

## 4. Blocked Source Audit

### 4.1 NewsEvent

#### Current Resolver Path

```
resolveNewsEvent(facts, blockingReasons):
  if !facts.qualityEvidenceComplete
    → push "NLP quality not validated"
    → push "Symbol linkage not validated"
    → push "Source diversity concern: 84% Yahoo RSS concentration"
    → return BLOCKED_QUALITY_EVIDENCE
  if consumerStatus === "SOURCE_PRESENT_AUDIT_ONLY"
    → push "No consumer integration code: src/ not yet touched for NewsEvent"
    → return SOURCE_PRESENT_AUDIT_ONLY
  if consumerStatus !== "CONSUMER_READY"
    → return SOURCE_PRESENT_AUDIT_ONLY
  → return SOURCE_PRESENT_AUDIT_ONLY   ← hardcoded final branch
```

#### Current SimulationInputStatus

`BLOCKED_QUALITY_EVIDENCE` (facts incomplete)  
`SOURCE_PRESENT_AUDIT_ONLY` (facts complete — **maximum reachable state in current code**)

#### Critical Finding: No Eligible Code Path Exists

The resolver's final branch unconditionally returns `SOURCE_PRESENT_AUDIT_ONLY`
regardless of `qualityEvidenceComplete=true` and `consumerStatus=CONSUMER_READY`.
Even if all facts fields are set to their best values, `SIMULATION_INPUT_ELIGIBLE`
is **structurally unreachable** for NewsEvent in the current resolver.

This is intentional — NewsEvent has a design-level block at the resolver layer,
separate from the facts-level gates.

#### Current Blocking Reasons

| Layer | Reason |
|---|---|
| Facts level | `qualityEvidenceComplete=false` — NLP quality, symbol linkage, source diversity not validated |
| Resolver level | Final return is hardcoded to `SOURCE_PRESENT_AUDIT_ONLY` — no ELIGIBLE path |
| Source diversity | 84% Yahoo RSS concentration — single-source risk not resolved |

#### What Facts Must Change

| Field | Current | Required for Resolver to Reach Best State |
|---|---|---|
| `qualityEvidenceComplete` | `false` | `true` (NLP quality + symbol linkage + diversity audit complete) |
| `consumerStatus` | `NOT_ASSESSED` | `CONSUMER_READY` (consumer integration code written and deployed) |

**Even with all facts at best values, the resolver still returns `SOURCE_PRESENT_AUDIT_ONLY`.**

#### What Resolver Code Change Is Required

> DOCUMENTATION ONLY — no code change made or authorized.

To allow NewsEvent to reach `SIMULATION_INPUT_ELIGIBLE`, the resolver would need
a new code path after all quality and consumer gates are cleared:

```typescript
// Proposed code-only (NOT implemented — requires C6 authorization):
function resolveNewsEvent(facts, blockingReasons): SimulationInputStatus {
  if (!facts.qualityEvidenceComplete) { ... return "BLOCKED_QUALITY_EVIDENCE"; }
  if (!facts.pitMetadataComplete) { ... return "BLOCKED_PIT_METADATA"; }
  if (facts.consumerStatus !== "CONSUMER_READY") { ... return "SOURCE_PRESENT_AUDIT_ONLY"; }
  // NEW: All gates cleared — eligible as paper-only input
  return "SIMULATION_INPUT_ELIGIBLE";  // ← requires explicit C6 authorization to add
}
```

This change is **not authorized** in P38. It requires:
1. NLP quality audit complete (entity extraction, relevance scoring)
2. Symbol linkage accuracy validated (ticker mapping accuracy > threshold)
3. Source diversity resolved (Yahoo RSS share reduced below threshold)
4. Consumer integration code written in `src/lib/onlineValidation/` for NewsEvent
5. Explicit C6 operator authorization

#### Evidence Requirements Not Yet Met

| Requirement | Status |
|---|---|
| NLP quality audit (entity extraction, relevance scoring) | NOT STARTED |
| Symbol linkage validation (ticker mapping accuracy) | NOT STARTED |
| Source diversity analysis (reduce 84% Yahoo RSS) | NOT STARTED |
| Consumer integration code in `src/lib/onlineValidation/` | NOT WRITTEN |
| Resolver ELIGIBLE path code change | NOT AUTHORIZED |

#### Risk Level

**MEDIUM** — No schema migration required. All blockers are quality evidence and
resolver logic. Lower infrastructure risk than FinancialReport or Chip.
However, NLP quality audit and source diversity work are non-trivial.

---

### 4.2 FinancialReport

#### Current Resolver Path

```
resolveFinancialReport(blockingReasons):
  // No facts parameter — resolver takes NO input from SourceReadinessFacts
  push "releaseDate field missing from schema"
  push "releaseDateSource field missing from schema"
  push "releaseDateConfidence field missing from schema"
  push "Authorization required: YES apply FinancialReport releaseDate migration..."
  return BLOCKED_PIT_METADATA
```

#### Current SimulationInputStatus

`BLOCKED_PIT_METADATA` — **always**, unconditionally.

#### Critical Finding: Resolver Ignores All Facts

`resolveFinancialReport` takes **no `facts` parameter**. It is structurally
impossible for any combination of `SourceReadinessFacts` values to change its output.
The block is at the resolver signature level, not the logic level.

This is intentional — FinancialReport requires a schema migration authorization
before any conditional logic should be added. The hardcoded block prevents
premature promotion.

#### Current Blocking Reasons

| Layer | Reason |
|---|---|
| Schema | `releaseDate` field absent from `FinancialReport` Prisma schema |
| Schema | `releaseDateSource` field absent |
| Schema | `releaseDateConfidence` field absent |
| Authorization | Schema migration requires explicit operator `YES` authorization |

#### What Facts Must Change

No change to `SourceReadinessFacts` can unblock FinancialReport under the current
resolver. The resolver must be rewritten to accept and evaluate facts — which itself
requires authorization.

After authorization and schema migration, the following facts must be met:
| Field | Required Value |
|---|---|
| `pitMetadataComplete` | `true` (all historical records have valid `releaseDate`) |
| `qualityEvidenceComplete` | `true` (spec conformance confirmed) |
| `consumerStatus` | `CONSUMER_READY` |

#### What Resolver Code Change Is Required

> DOCUMENTATION ONLY — no code change made or authorized.

The current resolver signature `resolveFinancialReport(blockingReasons)` must be
changed to `resolveFinancialReport(facts, blockingReasons)`. Then the same
gate sequence as MonthlyRevenue can apply:

```typescript
// Proposed structure (NOT implemented — requires schema migration + C6 authorization):
function resolveFinancialReport(facts: SourceReadinessFacts, blockingReasons): SimulationInputStatus {
  if (!facts.pitMetadataComplete) {
    blockingReasons.push("PIT metadata incomplete: releaseDate not populated");
    return "BLOCKED_PIT_METADATA";
  }
  if (!facts.qualityEvidenceComplete) { ... return "BLOCKED_QUALITY_EVIDENCE"; }
  if (facts.consumerStatus !== "CONSUMER_READY") { ... return "CONSUMER_READY_AUDIT_ONLY"; }
  return "SIMULATION_INPUT_ELIGIBLE";  // ← requires schema migration + C6 authorization
}
```

And `mapSourceToSimulationInputReadiness` switch case must be updated:
```typescript
case "FinancialReport":
  simulationInputStatus = resolveFinancialReport(facts, blockingReasons); // pass facts
```

This change requires:
1. Schema migration authorization (`YES apply FinancialReport releaseDate migration to dev DB`)
2. Migration applied and validated
3. `releaseDate` populated for all historical FinancialReport records
4. `releaseDateSource` and `releaseDateConfidence` populated
5. Explicit C6 authorization

#### Evidence Requirements Not Yet Met

| Requirement | Status |
|---|---|
| `YES apply FinancialReport releaseDate migration to dev DB` | NOT GRANTED |
| Prisma schema updated (`releaseDate`, `releaseDateSource`, `releaseDateConfidence`) | NOT DONE |
| Historical records backfilled with valid `releaseDate` | IMPOSSIBLE without migration |
| `releaseDateSource` provenance documented | NOT STARTED |
| `releaseDateConfidence` scoring method defined | NOT STARTED |
| Consumer integration code written | NOT WRITTEN |
| Resolver signature change + conditional logic | NOT AUTHORIZED |

#### Risk Level

**HIGH** — Requires Prisma schema migration (DB change), historical data backfill,
and a resolver signature change. Highest infrastructure risk of the three blocked sources.
Any error in `releaseDate` population creates PIT leakage risk.

---

### 4.3 Chip

#### Current Resolver Path

```
resolveChip(facts, blockingReasons):
  if !facts.authorizationGranted
    → push "Authorization required: YES apply Chip availableAt migration..."
    → push "availableAt field absent from schema"
    → return BLOCKED_AUTHORIZATION
  // Authorization granted branch:
  push "availableAt prod logs not validated"
  push "Lag evidence incomplete: distribution lag not quantified"
  return BLOCKED_LAG_EVIDENCE
```

#### Current SimulationInputStatus

`BLOCKED_AUTHORIZATION` (authorization not granted)  
`BLOCKED_LAG_EVIDENCE` (after authorization — **maximum reachable state in current code**)

#### Critical Finding: Two-Stage Block with No Eligible Path

Even after authorization is granted (`authorizationGranted=true`), the resolver
hardcodes `return BLOCKED_LAG_EVIDENCE`. There is no code path to
`SIMULATION_INPUT_ELIGIBLE` even with all facts at best values.

Like NewsEvent, Chip has a design-level block at the resolver layer beyond
the facts-level gates.

#### Current Blocking Reasons

| Layer | Reason |
|---|---|
| Authorization | `authorizationGranted=false` — migration not authorized by operator |
| Schema | `availableAt` field absent from Chip schema |
| Lag evidence | `availableAt` prod logs not validated |
| Lag evidence | Distribution lag not quantified (P50/P95 not measured) |

#### What Facts Must Change

| Field | Current | Required |
|---|---|---|
| `authorizationGranted` | `false` | `true` (operator grants `YES apply Chip availableAt migration`) |
| `lagEvidenceComplete` | `false` | `true` (prod logs validated, lag distribution quantified) |
| `pitMetadataComplete` | `false` | `true` (after `availableAt` field populated and validated) |
| `consumerStatus` | `NOT_ASSESSED` | `CONSUMER_READY` |

**Even with all facts at best values, the current resolver still returns `BLOCKED_LAG_EVIDENCE`.**

#### What Resolver Code Change Is Required

> DOCUMENTATION ONLY — no code change made or authorized.

After authorization and lag evidence validation, the resolver needs a new
ELIGIBLE path:

```typescript
// Proposed code (NOT implemented — requires authorization + C6 approval):
function resolveChip(facts: SourceReadinessFacts, blockingReasons): SimulationInputStatus {
  if (!facts.authorizationGranted) {
    blockingReasons.push("Authorization required: YES apply Chip availableAt migration...");
    blockingReasons.push("availableAt field absent from schema");
    return "BLOCKED_AUTHORIZATION";
  }
  if (!facts.lagEvidenceComplete) {
    blockingReasons.push("availableAt prod logs not validated");
    blockingReasons.push("Lag evidence incomplete: distribution lag not quantified");
    return "BLOCKED_LAG_EVIDENCE";
  }
  if (!facts.pitMetadataComplete) {
    blockingReasons.push("PIT metadata incomplete after availableAt migration");
    return "BLOCKED_PIT_METADATA";
  }
  if (facts.consumerStatus !== "CONSUMER_READY") { ... return "CONSUMER_READY_AUDIT_ONLY"; }
  return "SIMULATION_INPUT_ELIGIBLE";  // ← requires all above + C6 authorization
}
```

#### Evidence Requirements Not Yet Met

| Requirement | Status |
|---|---|
| `YES apply Chip availableAt migration to dev DB` | NOT GRANTED |
| Prisma schema updated (`availableAt` field) | NOT DONE |
| `availableAt` populated for existing Chip records | IMPOSSIBLE without migration |
| Prod logs analyzed to validate `availableAt` accuracy | NOT STARTED |
| Lag distribution quantified (P50/P95 lag in hours) | NOT STARTED |
| Consumer integration code written | NOT WRITTEN |
| Resolver ELIGIBLE path code change | NOT AUTHORIZED |

#### Risk Level

**MEDIUM-HIGH** — Requires schema migration (lower scope than FinancialReport's 3-field migration)
and prod log analysis. The authorization gate serves as a formal safety barrier.
Lag evidence quantification is non-trivial but well-defined.

---

## 5. Cross-Source Dependency Analysis

### 5.1 Does Chip Authorization Unlock FinancialReport or NewsEvent?

**No.** Each resolver is independent:
- `resolveChip` → only reads `facts.authorizationGranted` and `facts.lagEvidenceComplete`
- `resolveFinancialReport` → reads NO facts at all
- `resolveNewsEvent` → reads `facts.qualityEvidenceComplete` and `facts.consumerStatus`

Granting Chip authorization has zero effect on FinancialReport or NewsEvent resolver output.

### 5.2 Does FinancialReport Schema Migration Unlock Chip or NewsEvent?

**No.** The `releaseDate` field is FinancialReport-specific. Adding it to the Prisma
schema does not affect the Chip `availableAt` field or the NewsEvent quality evidence
requirements.

### 5.3 Does NewsEvent Quality Evidence Completion Unlock Chip or FinancialReport?

**No.** `qualityEvidenceComplete=true` is only meaningful to `resolveNewsEvent` and
`resolveMonthlyRevenue`. The Chip and FinancialReport resolvers do not read this field
(FinancialReport reads no facts; Chip reads only `authorizationGranted` and `lagEvidenceComplete`).

### 5.4 Shared Infrastructure Risk

All three share one potential risk: if any blocked source mistakenly reached the
`buildPaperSimulationInputBundle` eligible path, it would appear in the P39 bundle.
This is guarded by:
1. The resolver hardcoded returns (no code path to ELIGIBLE for any of the three)
2. The `buildPaperSimulationInputBundle` router (non-ELIGIBLE statuses → blockedSources)
3. T39.5 in P37 tests (verifies blocked sources never appear in eligibleSources)

### 5.5 Summary

| Source | Depends On | Affects |
|---|---|---|
| NewsEvent | quality evidence (NLP, symbol linkage, diversity) | nothing |
| FinancialReport | schema migration authorization | nothing |
| Chip | authorization + lag evidence | nothing |

All three are fully independent. No shared blocking condition, no shared unlock.

---

## 6. Recommended Promotion Sequencing (If Ever Authorized)

If a future operator decides to promote one or more blocked sources, the recommended
sequencing is:

### Step 1 — NewsEvent (Lowest Infrastructure Risk)

No schema migration required. Promotion path:
1. Complete NLP quality audit (define quality thresholds; run audit)
2. Validate symbol linkage accuracy (ticker mapping rate > defined threshold)
3. Resolve source diversity (reduce Yahoo RSS share; add 2+ alternative sources)
4. Write consumer integration code in `src/lib/onlineValidation/newsEvent/`
5. Authorize C6: update `resolveNewsEvent` to add ELIGIBLE path
6. Add P37-style tests for the new ELIGIBLE path

### Step 2 — Chip (Medium Infrastructure Risk)

Schema migration required (1 field: `availableAt`). Promotion path:
1. Operator grants: `YES apply Chip availableAt migration to dev DB`
2. Apply Prisma schema migration (`availableAt: DateTime?`)
3. Validate `availableAt` values in dev DB against prod logs
4. Quantify lag distribution (P50/P95 lag between data creation and availability)
5. Write consumer integration code
6. Authorize C6: update `resolveChip` to add ELIGIBLE path after lag evidence gate
7. Add P37-style tests for both authorization gate and lag gate

### Step 3 — FinancialReport (Highest Infrastructure Risk)

Schema migration required (3 fields) plus historical data backfill. Promotion path:
1. Operator grants: `YES apply FinancialReport releaseDate migration to dev DB`
2. Apply Prisma schema migration (3 fields: `releaseDate`, `releaseDateSource`, `releaseDateConfidence`)
3. Define `releaseDateSource` provenance taxonomy
4. Define `releaseDateConfidence` scoring method
5. Backfill all historical FinancialReport records
6. Run PIT leakage scan to verify `releaseDate` accuracy
7. Write consumer integration code
8. Authorize C6: change resolver signature and add ELIGIBLE path
9. Add P37-style tests

**Sequencing rationale:** Each step is independent; NewsEvent is sequenced first
because it carries no schema risk and its blockers are quality-evidence work.
Chip is second because its schema migration is small (1 field) and well-scoped.
FinancialReport is last because of its multi-field migration + historical backfill complexity.

---

## 7. What C6 Should Implement (If Any)

C6 is not yet authorized. No promotion authorization has been granted for any blocked source.

If a future promotion is authorized, C6's scope should be limited to exactly one source
at a time, with the following template:

| C6 Item | Scope | Prerequisite |
|---|---|---|
| C6a — NewsEvent resolver ELIGIBLE path | Code change to `resolveNewsEvent` only | All Section 4.1 evidence requirements met + operator auth |
| C6b — Chip resolver ELIGIBLE path | Code change to `resolveChip` only + schema migration | All Section 4.3 evidence requirements met + operator auth |
| C6c — FinancialReport resolver ELIGIBLE path | Resolver signature change + schema migration | All Section 4.2 evidence requirements met + operator auth |

Each C6 variant must:
- Target exactly one source
- Include P37-style tests for the new ELIGIBLE path
- Include a new report analogous to this audit
- Preserve `entersAlphaScore=false` at all layers
- Include governance confirmation in the commit

C6 must NOT:
- Promote multiple sources in a single commit
- Change the resolver for a source without operator authorization
- Apply schema migrations without explicit `YES <migration name>` authorization
- Touch DB, Prisma, or production data without authorization

**If no promotion is authorized, C6 should not be started.**

---

## 8. Resolver Architecture: Summary Table

| Source | Resolver Signature | Hardcoded ELIGIBLE Path? | Schema Migration Needed? | Resolver Code Change Needed? |
|---|---|---|---|---|
| MonthlyRevenue | `resolveMonthlyRevenue(facts, reasons)` | YES (pitMetadata + quality + consumer gated) | No | No (gates already coded) |
| Quote | `resolveQuoteOrRegime(facts, reasons)` | YES (`pitSafeConfirmed=true`) | No | No |
| Regime | `resolveQuoteOrRegime(facts, reasons)` | YES (`pitSafeConfirmed=true`) | No | No |
| **NewsEvent** | `resolveNewsEvent(facts, reasons)` | **NO** (hardcoded final return) | No | YES |
| **FinancialReport** | `resolveFinancialReport(reasons)` | **NO** (no facts param) | YES (3 fields) | YES (add facts param) |
| **Chip** | `resolveChip(facts, reasons)` | **NO** (hardcoded final return) | YES (1 field) | YES (add lag gate exit) |

---

## 9. Governance Confirmation

| Constraint | Status |
|---|---|
| Report-only — no production logic changed | ✅ CONFIRMED |
| No test files changed or added | ✅ CONFIRMED |
| No DB / Prisma schema modified | ✅ CONFIRMED |
| No package-lock modified | ✅ CONFIRMED |
| No scoring formula accessed or modified | ✅ CONFIRMED |
| No production data read or written | ✅ CONFIRMED |
| No USER_DECISION files staged or modified | ✅ CONFIRMED |
| `entersAlphaScore=false` documented and preserved | ✅ CONFIRMED |
| `paperOnly=true` / `dryRunOnly=true` framing preserved | ✅ CONFIRMED |
| No alpha-score entry, no optimizer, no real backtest | ✅ CONFIRMED |
| No investment advice | ✅ CONFIRMED |
| No predictive performance claim | ✅ CONFIRMED |
| No promotion authorized or implemented | ✅ CONFIRMED |

---

## 10. Final Classification

```
P38_BLOCKED_SOURCE_PROMOTION_AUDIT_COMPLETE
```

All 3 blocked sources (NewsEvent, FinancialReport, Chip) have been audited.
Resolver paths, blocking reasons, evidence requirements, code change documentation,
and promotion sequencing are formally defined.
No code changes were made. No authorizations were granted.
C6 may proceed only after explicit per-source authorization from the operator.
