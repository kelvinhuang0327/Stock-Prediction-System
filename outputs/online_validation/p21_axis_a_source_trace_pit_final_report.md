# P21 — Axis A v2: sourceTrace Auditability + PIT Metadata Exposure
## Final Report

**Classification:** `P21_AXIS_A_SOURCE_TRACE_PIT_COMPLETE`
**Date:** 2026-05-23
**Branch:** `main`
**HEAD at completion:** (see git log — committed after P20: `628d9b1`)

---

## 1. Objective

Extend the Controlled Research Snapshot test suite (Axis A) with targeted coverage of two governance sub-dimensions:

1. **sourceTrace auditability** — the snapshot-level `sourceTrace` field must faithfully encode the caller's pipeline identity across all readiness states (READY / PARTIAL / BLOCKED / BLOCKED_PIT), and must not be contaminated by per-source `SourceReadinessFacts.sourceTrace` fields.

2. **PIT metadata exposure** — the `pitMetadataComplete` flag (MonthlyRevenue mapper), `pitSafeConfirmed` flag (Quote/Regime mapper), and `qualityEvidenceComplete` / `consumerStatus` gates must be correctly reflected in `pitSafeInputs` per-source states and in `researchReadinessStatus`.

---

## 2. New Test File

**Path:** `src/lib/research/__tests__/p21_axis_a_source_trace_pit_metadata.test.ts`

---

## 3. Test Results

### New P21 tests (this session)

| Group | Count | Result |
|-------|------:|--------|
| T16: sourceTrace auditability | 10 | ✅ PASS |
| T17: PIT metadata exposure | 12 | ✅ PASS |
| T18: Cross-invariant (PIT + sourceTrace + governance) | 10 | ✅ PASS |
| **Total new tests** | **32** | **✅ ALL PASS** |

### Full research suite

| Metric | Before P21 | After P21 |
|--------|----------:|----------:|
| Test suites | 6 | 7 |
| Tests | 225 | 257 |
| Failures | 0 | 0 |
| Status | ✅ PASS | ✅ PASS |

### Full onlineValidation suite (baseline guard)

| Metric | Value |
|--------|------:|
| Test suites | 127 |
| Tests | 4846 |
| Failures | 0 |
| Status | ✅ PASS (unchanged) |

---

## 4. What the Tests Prove

### T16 — sourceTrace Auditability

- **T16.1–T16.3**: Snapshot-level `sourceTrace` reflects exactly the caller-provided trace string; per-source `SourceReadinessFacts.sourceTrace` values do not override or contaminate it.
- **T16.4–T16.6**: `sourceTrace` is preserved verbatim in all four readiness states (BLOCKED_PIT, BLOCKED, PARTIAL, READY) — the builder does not override or mangle it.
- **T16.7**: `sourceTrace` contains no forbidden investment-advice keywords (buy/sell/hold/alpha/score etc.).
- **T16.8**: Structured pipeline identifiers (e.g. `p21-axis-a::research-snapshot::2026-05-23::v1::symbol=2330`) are preserved verbatim.
- **T16.9–T16.10**: `sourceTrace` is always a non-null string; default value is the canonical builder identifier.

### T17 — PIT Metadata Exposure

Key mapper invariants documented and validated:

| Source | Gate checked | Missing → | Status in snapshot |
|--------|-------------|-----------|-------------------|
| MonthlyRevenue | `pitMetadataComplete` | false → BLOCKED_PIT_METADATA | `BLOCKED` |
| MonthlyRevenue | `qualityEvidenceComplete` | false → BLOCKED_QUALITY_EVIDENCE | `BLOCKED` |
| MonthlyRevenue | `consumerStatus` | non-READY → CONSUMER_READY_AUDIT_ONLY | `AUDIT_ONLY` |
| Quote / Regime | `pitSafeConfirmed` | false → SOURCE_PRESENT_AUDIT_ONLY | `AUDIT_ONLY` |
| Quote / Regime | `pitMetadataComplete` | **ignored** (mapper only checks pitSafeConfirmed) | n/a |
| MonthlyRevenue | `pitStatus` field | **ignored** (mapper only checks pitMetadataComplete) | n/a |
| Quote | `pitStatus=NOT_ASSESSED` + `pitSafeConfirmed=true` | → ELIGIBLE | `ELIGIBLE` |

- **T17.3**: `blockingReasons` always contains a human-readable PIT metadata message when blocked.
- **T17.11–T17.12**: Mixed PIT metadata states across sources produce `SNAPSHOT_PARTIAL` (not BLOCKED).

### T18 — Cross-invariant

- **T18.1–T18.4**: Across all four readiness states, `sourceTrace` is non-null and governance flags (`entersAlphaScore=false`, `notInvestmentRecommendation=true`, `paperOnly=true`, `dryRun=true`) hold.
- **T18.5**: `validateSnapshotInvariants()` returns `{valid: true, violations: []}` for all PIT metadata variations.
- **T18.6**: No `SNAPSHOT_FORBIDDEN_FIELDS` appear in any snapshot regardless of PIT metadata state.
- **T18.7**: Contract constants unchanged.
- **T18.8**: Three-source snapshot with distinct PIT metadata outcomes (BLOCKED / ELIGIBLE / AUDIT_ONLY) correctly populates `pitSafeInputs`.
- **T18.9**: Build is deterministic — same facts → same `pitSafeInputs` + `researchReadinessStatus`.
- **T18.10**: SNAPSHOT_READY with custom trace does not absorb per-source trace strings.

---

## 5. Scope Adherence

| Constraint | Status |
|------------|--------|
| No `prisma/**` changes | ✅ Not touched |
| No `data/**` changes | ✅ Not touched |
| DB SHA unchanged (`a5cf277...`) | ✅ Confirmed |
| No scoring formula access | ✅ All tests use `entersAlphaScore=false` |
| No investment advice semantics | ✅ `notInvestmentRecommendation=true` on all new snapshots |
| `paperOnly=true`, `dryRun=true` | ✅ Verified in T18.1–T18.4 |
| No forbidden fields in any snapshot | ✅ T18.6 passes |
| Only `src/lib/research/**` modified | ✅ Only new test file added |

---

## 6. Files Changed

| File | Change |
|------|--------|
| `src/lib/research/__tests__/p21_axis_a_source_trace_pit_metadata.test.ts` | CREATED (32 new tests) |
| `outputs/online_validation/p21_axis_a_source_trace_pit_final_report.md` | CREATED (this report) |

No source files modified. No DB migrations. No schema changes.

---

## 7. Pending Items (not in P21 scope)

- p28 drift files (3 modified JSON) — USER_DECISION pending
- 00-StockPlan/20260514/ + 20260515/ — USER_DECISION pending
- p20 final report (untracked `??`) — not yet committed
- Axis B (dry-run validation) — NOT started, NOT authorized
- Commit / push of P21 changes — awaiting explicit user instruction

---

## 8. Readiness Gate

| Gate | Result |
|------|--------|
| New tests: 32/32 PASS | ✅ |
| Research suite: 257/257 PASS | ✅ |
| onlineValidation baseline: 4846/4846 PASS | ✅ |
| No forbidden fields | ✅ |
| No scoring / investment advice | ✅ |
| Governance flags intact | ✅ |

**Status: P21 COMPLETE — ready for commit authorization.**
