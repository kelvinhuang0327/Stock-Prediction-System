# P35 — Axis C C2: Pipeline Test Report and CI Closure

Date: 2026-05-25
Project: Stock-Prediction-System
Phase: P35 — Axis C C2: Fixture-Backed Pipeline Coverage
Branch: main
Classification: P35_AXIS_C_PIPELINE_TESTS_CI_GREEN

> **DISCLAIMER:** This document is a test coverage and CI closure report only.
> It does not constitute investment advice, a buy/sell/hold recommendation, or any
> investment performance claim. All described paths are paper-only, dry-run-only,
> entersAlphaScore=false, no PnL/ROI/win-rate semantics.

---

## 1. P35 Objective

P35 = Axis C C2: Fixture-Backed Pipeline Coverage.

The primary gap identified in P34 (Axis C C1 Evidence Inventory) was:

> No existing test ran `SourceReadinessFacts → P38 mapper → P39 bundle` end-to-end.

P35 closed this gap by adding 25 pure unit tests (5 groups, fixture-backed,
no DB / Prisma / network) that prove the full P38 mapper → P39 bundle pipeline
is deterministic and correct for all 6 Axis C sources.

No production logic was changed. No scoring, no DB schema, no package-lock,
no Prisma, no investment advice. Tests only.

---

## 2. Commit Hash

```
93e68db  test: add Axis C fixture-backed pipeline coverage
```

Parent commit:
```
398706d  docs: finalize P34 report commit metadata
```

Pushed to: `origin/main`
Push range: `398706d..93e68db → origin/main`

---

## 3. File Created

| File | Lines | Tests |
|---|---|---|
| `src/lib/simulation/__tests__/p35_axis_c_fixture_backed_pipeline.test.ts` | 497 | 25 |

No other files were staged, modified, or created.

---

## 4. Files Read Before Implementation

| File | Purpose |
|---|---|
| `src/lib/onlineValidation/p38/SimulationInputReadinessTypes.ts` | `SourceReadinessFacts` interface, `SimulationInputStatus` enum |
| `src/lib/onlineValidation/p38/SimulationInputReadinessMapper.ts` | Per-source resolver functions (all 6 sources) |
| `src/lib/onlineValidation/p39/PaperSimulationInputContract.ts` | Bundle types, `P39_ELIGIBLE_SOURCES`, `P39_BLOCKED_SOURCES` |
| `src/lib/onlineValidation/p39/PaperSimulationInputContractBuilder.ts` | `buildPaperSimulationInputBundle`, `buildDefaultPaperSimulationInputBundle` |
| `outputs/online_validation/p34_axis_c_evidence_inventory.md` | Source-by-source coverage gap analysis |

---

## 5. Local Test Results

### 5.1 P35 Test File Alone

```
25/25 PASS
File: src/lib/simulation/__tests__/p35_axis_c_fixture_backed_pipeline.test.ts
```

### 5.2 Targeted Suite (all simulation + research tests)

```
Test Suites: 14 passed, 14 total
Tests:       432 passed, 432 total
```

Targeted suites: `src/lib/simulation/__tests__/` and `src/lib/research/__tests__/`
407 baseline tests (pre-P35) + 25 new P35 tests = 432 total.

---

## 6. Source-by-Source Coverage Summary

### 6.1 MonthlyRevenue (Group T32 — Field Isolation)

Tests verified that `resolveMonthlyRevenue` checks only 3 fields:
- `pitMetadataComplete` → required gate
- `qualityEvidenceComplete` → required gate
- `consumerStatus=CONSUMER_READY` → required gate

Tests confirmed that `lagEvidenceComplete`, `authorizationGranted`,
`pitSafeConfirmed`, and `pitStatus/pitConfidence` are structurally
ignored by the resolver (changing them does not change the outcome).

| Condition | Status Confirmed |
|---|---|
| All 3 gates cleared | `SIMULATION_INPUT_ELIGIBLE` |
| `pitMetadataComplete=false` | `BLOCKED_PIT_METADATA` |
| `qualityEvidenceComplete=false` | `BLOCKED_QUALITY_EVIDENCE` |
| `consumerStatus=SOURCE_PRESENT_AUDIT_ONLY` | `SOURCE_PRESENT_AUDIT_ONLY` |
| Ignored fields changed freely | outcome unchanged |

### 6.2 Quote (Group T33 — Field Isolation)

Tests verified that `resolveQuoteOrRegime` checks only 1 field:
- `pitSafeConfirmed=true` → eligible gate

All other fields (`pitMetadataComplete`, `qualityEvidenceComplete`,
`consumerStatus`, `lagEvidenceComplete`, `authorizationGranted`,
`pitStatus`, `pitConfidence`) are ignored by the resolver.

| Condition | Status Confirmed |
|---|---|
| `pitSafeConfirmed=true` | `SIMULATION_INPUT_ELIGIBLE` |
| `pitSafeConfirmed=false` | `SOURCE_PRESENT_AUDIT_ONLY` |
| Other fields changed freely | outcome unchanged |

### 6.3 Regime (Group T33 — Field Isolation)

Same resolver as Quote (`resolveQuoteOrRegime`). Same field isolation.
`pitSafeConfirmed=true` → `SIMULATION_INPUT_ELIGIBLE`.
All other fields ignored.

### 6.4 NewsEvent (Group T34 — Blocked Source Verification)

Tests verified that `resolveNewsEvent` always caps at `SOURCE_PRESENT_AUDIT_ONLY`.
Even with `qualityEvidenceComplete=true`, the source cannot reach `SIMULATION_INPUT_ELIGIBLE`.
This is hardcoded in the resolver — NewsEvent can never be eligible under the current mapper.

| Condition | Status Confirmed |
|---|---|
| `qualityEvidenceComplete=true` | `SOURCE_PRESENT_AUDIT_ONLY` (max reachable) |
| `qualityEvidenceComplete=false` | `BLOCKED_QUALITY_EVIDENCE` |

### 6.5 FinancialReport (Group T34 — Blocked Source Verification)

Tests verified that `resolveFinancialReport` always returns `BLOCKED_PIT_METADATA`,
unconditionally. No input fields affect the outcome. Hardcoded blocking.

| Condition | Status Confirmed |
|---|---|
| Any input | `BLOCKED_PIT_METADATA` (always) |

### 6.6 Chip (Group T34 — Blocked Source Verification)

Tests verified that `resolveChip` checks `authorizationGranted` first, then lag evidence.

| Condition | Status Confirmed |
|---|---|
| `authorizationGranted=false` | `BLOCKED_AUTHORIZATION` |
| `authorizationGranted=true`, `lagEvidenceComplete=false` | `BLOCKED_LAG_EVIDENCE` |
| `authorizationGranted=true`, `lagEvidenceComplete=true` | `BLOCKED_LAG_EVIDENCE` (no eligible path) |

---

## 7. Test Group Summary

| Group | Tests | Description |
|---|---|---|
| T31 | 5 | End-to-end pipeline: facts → P38 mapper → P39 bundle, all 6 sources |
| T32 | 5 | MonthlyRevenue field isolation (ignored-field contract) |
| T33 | 5 | Quote/Regime field isolation (single-gate contract) |
| T34 | 5 | Blocked source mapper verification (NewsEvent cap, FR unconditional, Chip auth/lag) |
| T35 | 5 | Governance invariants (entersAlphaScore=false throughout, matrix-level invariants) |

---

## 8. Boundary Scan Result

Before commit:

```
git diff --name-only:    1 file (test file only)
git diff --cached --name-only:  1 file staged (test file only)
```

Files NOT staged or modified:
- `active_task.md` — NOT staged (USER_DECISION)
- `00-StockPlan/20260514/*` — NOT staged (USER_DECISION)
- `00-StockPlan/20260515/*` — NOT staged (USER_DECISION)
- No production src/ files modified
- No DB, Prisma, package-lock, scoring formula, or production data files touched

**Boundary scan result: CLEAN**

---

## 9. Required CI Run

| Workflow | Run ID | Conclusion |
|---|---|---|
| **Test Gate — 5121/5121 Baseline** | **26383776899** | **SUCCESS** |
| CI | 26383776900 | FAILURE (pre-existing — see Section 10) |
| OpenClaw Notify | 26383822883 | FAILURE (notification service — not a CI gate) |

---

## 10. Required Checks Status

Branch protection: `strict: true`, 3 required checks.

| Required Check | Workflow Job | Status |
|---|---|---|
| `onlineValidation (4846/4846)` | Test Gate 26383776899 | ✅ **SUCCESS** |
| `research + simulation (275/275)` | Test Gate 26383776899 | ✅ **SUCCESS** |
| `Dirty-File Bleed-Through Guard` | Test Gate 26383776899 | ✅ **SUCCESS** |

**All 3 required checks PASS.**

---

## 11. Pre-existing CI Workflow Failures (Non-Required)

The "CI" workflow (run `26383776900`) failed. This is **NOT a required check**.

The same failures exist on commits P33 (`67985a6`, `35e03f8`), P34 (`126669b`, `398706d`),
and P35 (`93e68db`) — confirming this is a pre-existing issue unrelated to Axis C work.

| Failing Suite | Failure Type | Relation to Axis C |
|---|---|---|
| `llmAuditSmoke.integration.test.ts` (SMOKE-1/2/3/4) | Integration — file I/O | None |
| `src/app/candidates/__tests__/page.test.tsx` | UI text element (`基本面壓力`) | None |
| `src/app/stocks/[symbol]/__tests__/page.tab-sync.test.tsx` | UI text element (`現金流`) | None |
| `src/lib/__tests__/NotificationDeliveryEngine.test.ts` | Notification engine | None |

These failures require separate triage and are outside the Axis C workstream.

---

## 12. Governance Confirmation

| Constraint | Status |
|---|---|
| No production logic changed | ✅ CONFIRMED |
| No DB / Prisma modified | ✅ CONFIRMED |
| No package-lock modified | ✅ CONFIRMED |
| No scoring formula accessed | ✅ CONFIRMED |
| No production data read or written | ✅ CONFIRMED |
| No investment advice | ✅ CONFIRMED |
| No buy/sell/hold semantics | ✅ CONFIRMED |
| `entersAlphaScore=false` asserted in all 5 test groups | ✅ CONFIRMED |
| `paperOnly=true` / `dryRunOnly=true` preserved | ✅ CONFIRMED |
| No USER_DECISION files staged or modified | ✅ CONFIRMED |
| Test file only — no imports of DB, Prisma, network, or scoring | ✅ CONFIRMED |

---

## 13. Risks / Unknowns

| Risk | Severity | Notes |
|---|---|---|
| Pre-existing CI workflow failures | LOW | Non-required check; failing across P33/P34/P35 commits; separate workstream |
| `p36_*` namespace collision | LOW | Older p36 artifacts exist in outputs/online_validation/; Axis C C3 must use `p36_axis_c_integration_guard_report.md` |
| No `buildDefaultPaperSimulationInputBundle` test coverage yet | LOW | Deferred to P36 if test-only changes are added |

---

## 14. Final Classification

```
P35_AXIS_C_PIPELINE_TESTS_CI_GREEN
```

P35 is fully closed. All 3 required CI checks GREEN. No production changes.
No USER_DECISION files touched. 432/432 tests pass locally. P36 authorized to start.
