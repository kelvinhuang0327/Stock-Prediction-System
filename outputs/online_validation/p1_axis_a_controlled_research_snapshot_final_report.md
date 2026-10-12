# P1 — Axis A Controlled Research Snapshot v0 — Final Report

**Date:** 2026-05-23  
**Phase:** P1  
**Classification:** `P1_AXIS_A_RESEARCH_SNAPSHOT_READY`  
**HEAD at capture:** `261cd369db68f100e7d609b85dbd8af86094249d` (P48, unchanged — no new commit in P1)

---

## 1. Pre-flight Result

| Check | Result |
|---|---|
| Repo | canonical (`/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System`) |
| Branch | `main` |
| HEAD | `261cd369db68f100e7d609b85dbd8af86094249d` (P48) |
| Contamination (alphaScore/edgeScore/scoring formula) | CLEAN — no matches in new files |
| Dirty pre-existing files | 6 (pre-dirty before P1; unchanged by P1) |

Pre-flight status: **PASS**

---

## 2. Files Changed

| File | Type | Lines | Description |
|---|---|---|---|
| `src/lib/research/ControlledResearchSnapshot.ts` | NEW | ~170 | Contract types, constants, `SNAPSHOT_FORBIDDEN_FIELDS`, `validateSnapshotInvariants()` |
| `src/lib/research/ControlledResearchSnapshotBuilder.ts` | NEW | ~160 | `buildControlledResearchSnapshot()` — 5-step pure builder via P38 |
| `src/lib/research/__tests__/controlled_research_snapshot.test.ts` | NEW | ~310 | 46 deterministic tests across 10 groups (T1–T10) |

**Modified files:** 0 (append-only to `00-Plan/roadmap/roadmap.md` — no source modification)  
**Deleted files:** 0  
**DB migrations applied:** 0 (noDbApply enforced)

---

## 3. Tests Run

### New P1 Test Suite

```
PASS  src/lib/research/__tests__/controlled_research_snapshot.test.ts
  T1: Contract invariants           10/10 ✅
  T2: PIT safety                     6/6  ✅
  T3: Missing source → NOT_ASSESSED  5/5  ✅
  T4: All eligible → SNAPSHOT_READY  4/4  ✅
  T5: Mixed → SNAPSHOT_PARTIAL       3/3  ✅
  T6: All blocked → SNAPSHOT_BLOCKED 2/2  ✅
  T7: No forbidden fields            3/3  ✅
  T8: No action semantics            3/3  ✅
  T9: No scoring formula access      3/3  ✅
  T10: Deterministic output          7/7  ✅

Tests: 46/46 PASS
```

### Regression Checks

| Suite | Tests | Result |
|---|---|---|
| `ExperimentRegistry.test.ts` | pre-existing | PASS |
| `ResearchStateMachine.test.ts` | pre-existing | PASS |
| `ResearchParameterVersioning.test.ts` | pre-existing | PASS |
| `ResearchCoverageEngine.test.ts` | pre-existing | PASS |
| `p36_monthly_revenue_controlled_consumer_readiness.test.ts` | pre-existing | PASS |
| `p37_monthly_revenue_consumer_integration_surface.test.ts` | pre-existing | PASS |
| `p38_simulation_input_readiness_mapping.test.ts` | pre-existing | PASS |

**Total across all affected modules:** 175 + 46 = **221/221 PASS.** 0 regressions.

---

## 4. Research Snapshot Contract Summary

The `ControlledResearchSnapshot` is a **Axis A research artifact** — a pure, deterministic,
paper-only read of source readiness as of a given `asOfDate`. It does not enter the
scoring formula, does not produce buy/sell/hold signals, and does not touch the database.

### Key exports (`ControlledResearchSnapshot.ts`)

| Export | Purpose |
|---|---|
| `CONTROLLED_RESEARCH_SNAPSHOT_VERSION` | `"p1-axis-a-controlled-research-snapshot-v0"` |
| `CONTROLLED_RESEARCH_SNAPSHOT_DISCLAIMER` | Full anti-advice text (no buy/sell/hold) |
| `CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT` | Governance flags (7 booleans + version) |
| `ResearchSnapshotReadinessStatus` | `SNAPSHOT_READY / SNAPSHOT_PARTIAL / SNAPSHOT_BLOCKED / SNAPSHOT_BLOCKED_PIT` |
| `SourceInputState` | `ELIGIBLE / AUDIT_ONLY / BLOCKED / NOT_ASSESSED` |
| `SNAPSHOT_FORBIDDEN_FIELDS` | 21 forbidden output fields (alphaScore, buy, sell, hold, etc.) |
| `validateSnapshotInvariants()` | Pure validator — returns `{valid, violations}` |

### Builder logic (`ControlledResearchSnapshotBuilder.ts`)

5-step pure function `buildControlledResearchSnapshot(input)`:

1. **PIT boundary** — `asOfDate` must be `YYYY-MM-DD` format and `<= today`; else `SNAPSHOT_BLOCKED_PIT`
2. **Forbidden-field guard** — reject any input key in `SNAPSHOT_FORBIDDEN_FIELDS`
3. **P38 mapping** — calls `mapSourceToSimulationInputReadiness()` for each provided source
4. **State mapping** — `SimulationInputStatus` → `SourceInputState` (ELIGIBLE / AUDIT_ONLY / BLOCKED / NOT_ASSESSED)
5. **Overall classification** — `classifyOverallReadiness()`: all-eligible-assessed → READY; any-eligible → PARTIAL; else BLOCKED

---

## 5. PIT-Safety and Anti-Advice Invariants

| Invariant | Mechanism | Test |
|---|---|---|
| PIT boundary enforced | Future `asOfDate` → `SNAPSHOT_BLOCKED_PIT` | T2.1–T2.5 |
| Invalid date format rejected | Regex gate `^\d{4}-\d{2}-\d{2}$` | T2.5 |
| `entersAlphaScore = false` | Hard-coded in builder for all paths | T1.1, T9.3 |
| `notInvestmentRecommendation = true` | Hard-coded in builder for all paths | T1.2, T8.3 |
| `paperOnly = true` | Hard-coded in builder | T1.3 |
| `dryRun = true` | Hard-coded in builder | T1.4 |
| No buy/sell/hold fields emitted | 21-field forbidden guard | T7.1–T7.3, T8.1 |
| Absent source → `NOT_ASSESSED` | Builder returns NOT_ASSESSED for unset facts | T3.1–T3.5 |
| Disclaimer prohibits buy/sell/hold | `CONTROLLED_RESEARCH_SNAPSHOT_DISCLAIMER` | T8.2 |
| No scoring formula imported | Builder imports: P38 mapper + currentDate only | T9.1–T9.2 |
| No DB apply | Pure module — zero Prisma imports | T1.7 |

All invariants: **VERIFIED ✅**

---

## 6. Known Limitations

1. **Quote/Regime cannot produce `BLOCKED` state via current P38 resolver.**
   `resolveQuoteOrRegime` only returns `SIMULATION_INPUT_ELIGIBLE` or `SOURCE_PRESENT_AUDIT_ONLY`.
   Tests updated to expect `AUDIT_ONLY` (not `BLOCKED`) for Quote/Regime with `pitSafeConfirmed=false`.
   This is a P38 design constraint — not a P1 bug.

2. **`AUDIT_ONLY` sources are treated as non-eligible in overall classification.**
   A snapshot with all sources `AUDIT_ONLY` produces `SNAPSHOT_BLOCKED` (no eligible sources).
   This is intentional and conservative.

3. **`blockingReasons` are sourced from P38 mapper.**
   The builder does not add extra human-readable reasons beyond what P38 provides.
   Future work could enrich these for operator display.

4. **No snapshot serialization / persistence layer.**
   The P1 snapshot is pure in-memory. Persisting to disk/DB is out of scope for P1.

5. **`SNAPSHOT_FORBIDDEN_FIELDS` guard operates on input keys only.**
   It does not scan nested objects. If future inputs include nested forbidden fields,
   the guard will not catch them.

---

## 7. Next Recommended Tasks

In priority order per P49-LEDGER routing:

| Priority | Task | Dependency |
|---|---|---|
| P2 | P49 Manifest — canonicalize P39–P48 documentation in `00-Plan/` | None (can start immediately) |
| P3 | Untracked Artifact Disposition Plan — clean up outputs, archive orphaned files | None (parallel to P2) |
| P4 | Axis B Fixture-backed Dry-run Validation Checkpoint | P1 ✅ (now unblocked) |

**P4 is now unblocked.** The hard rule "No Axis B until Axis A delivers visible research snapshot artifact" is satisfied by this P1 delivery.

---

## 8. CTO Agent 10-Line Summary

```
P1 STATUS: COMPLETE — P1_AXIS_A_RESEARCH_SNAPSHOT_READY

3 new files in src/lib/research/: contract types, pure builder, 46 tests.
46/46 new tests PASS. 175/175 existing tests PASS. 0 regressions.

Key design: buildControlledResearchSnapshot() is a 5-step pure function that
enforces PIT boundary, forbidden-field guard, delegates to P38 mapper for
source classification, and hard-codes all governance flags (entersAlphaScore=false
paperOnly=true dryRun=true notInvestmentRecommendation=true) for every output path.

P38 note: Quote/Regime with pitSafeConfirmed=false yields AUDIT_ONLY (not BLOCKED)
per P38 resolveQuoteOrRegime design. Tests corrected to match actual resolver semantics.

Axis A hard rule satisfied. Axis B (P4) now authorized.
Next: P2 (P49 Manifest) + P3 (Untracked Disposition) in parallel, then P4.
```

---

*DISCLAIMER: This report documents the Axis A Controlled Research Snapshot v0 implementation only.
`entersAlphaScore = false`. This is not investment advice. No buy/sell/hold semantics.
Paper-only. Dry-run. P1 — 2026-05-23.*
