# P32PREP — Internal Report Spec v0 + Golden Fixture Candidate Design

**Task:** P32-PREP  
**Date:** 2026-05-21  
**Classification:** P32PREP_REPORT_SPEC_V0_DESIGN_READY  
**Branch:** main  
**HEAD:** a6fb7531c1a0bc52f94fae687ac5ea303314a89f  

---

## 1. Goal

Produce design-only artifacts that P32 (MonthlyRevenue Source-present Dry-run Execution) can consume as input contracts. No code, DB schema, test file, or scoring configuration changes were made. All deliverables are output-only design documents synthesized by reverse-engineering the P29G, P29I, P30, and P31 artifact corpus.

---

## 2. CEO-Decision Linkage

On **2026-05-21**, the following CEO decisions were recorded:

- **P31A** (External Benchmark) demoted to **P2** (read-only, non-blocking)
- **P32PREP** (this task) elevated to **P0** — must complete before P32 executes
- **P32** (MonthlyRevenue dry-run execution) designated as the next P0 after P32PREP passes

These decisions reflect a priority realignment: internal report spec design is a prerequisite for safe P32 execution. External benchmark work is deferred until P32's dry-run results are available.

---

## 3. Artifact Inventory Summary

A full inventory of 22 artifacts across P29G, P29I, P30, and P31 was catalogued.

| Metric | Value |
|--------|-------|
| Total artifacts catalogued | 22 |
| Phases covered | 4 (P29G, P29I, P30, P31) |
| source-gate artifacts | 3 |
| dry-run-sample artifacts | 5 |
| pit-audit artifacts | 4 |
| other artifacts | 10 |
| Golden fixture candidates identified | 5 |

Full inventory: `outputs/online_validation/p32prep_artifact_inventory.json` / `.md`

---

## 4. Three v0 Report Specs

### 4a. source-gate

`p32prep_report_spec_v0_source_gate.json` / `.md`

Defines the contract for artifacts that record the gate result and PIT-safety classification of a named data source. Required fields establish identity (`sourceName`, `phase`, `capturedAt`), the gate decision (`gateResult` enum), the hard governance constraint (`entersAlphaScore=false`), and the disclaimer. Optional fields capture migration state, publication-lag documentation, and DB table details. This spec maps directly to `p29i_source_path_inventory.json`, `p30_chip_schema_migration_readiness.json`, and `p30_reaudit_result.json`.

### 4b. dry-run-sample

`p32prep_report_spec_v0_dry_run_sample.json` / `.md`

Defines the contract for artifacts that record the output of a paper-only dry-run execution. Four boolean hard constraints form the governance core: `paperOnly=true`, `dryRun=true`, `entersAlphaScore=false`, `notInvestmentRecommendation=true`. The `dryRunStatus` enum (`READY | BLOCKED | PARTIAL | WAITING_FOR_AUTHORIZATION`) is the machine-readable pass/block signal. Optional fields capture row counts, release-date coverage statistics, DB query provenance, and execution notes. This spec maps to four prior-phase artifacts including the P31 MonthlyRevenue dry-run sample — the primary P32 output contract anchor.

### 4c. pit-audit

`p32prep_report_spec_v0_pit_audit.json` / `.md`

Defines the contract for artifacts that record PSR-01..15 rule-check results per data source. The `sourceOutputs` array structure is the core: each entry carries `sourceName`, `result` enum, `forbiddenFieldsFound` (must be empty to PASS), and `ruleChecks` with per-rule `{ruleId, passed, detail}`. The `overallResult` enum (`ALL_PIT_SAFE | PARTIAL_PASS | WARN | BLOCKED`) summarizes across all sources. This spec maps to `p29i_pit_audit_scan.json` and `p30_reaudit_result.json`.

---

## 5. Golden Fixture Candidates

Five candidates were identified, spanning all three spec types:

| ID | Artifact | Spec Type | Key Stability Anchor |
|----|----------|-----------|----------------------|
| GFC-01 | `p29i_pit_audit_scan.json` | pit-audit | PSR-01..15 rule baseline; stable until new source admission |
| GFC-02 | `p29i_source_path_inventory.json` | source-gate | Canonical 6-source map; stable until Chip migration or new source gate |
| GFC-03 | `p31_monthly_revenue_dry_run_sample.json` | dry-run-sample | P32 output contract anchor; stable at rowCount=2143 |
| GFC-04 | `p31_monthly_revenue_dry_run_gate_scan.json` | dry-run-sample | DB-level companion; SQL query + per-field coverage anchored |
| GFC-05 | `p29g_dry_run_sample_output.json` | dry-run-sample | Simulation boundary semantics baseline (earliest scaffold) |

Proposed fixture paths are under `outputs/online_validation/fixtures/` — **NOT created**. Fixture materialization requires P32 authorization.

Full details: `outputs/online_validation/p32prep_golden_fixture_candidates.json` / `.md`

---

## 6. Anti-Drift Rule Proposal

All golden fixtures must be stored with an explicit version tag (e.g. `_fixture_v1`) and updated only via a phase gate artifact that records the `changeDrivers` justification and increments the version number. Silent overwriting by CI reruns, data syncs, or batch jobs is prohibited. Any fixture delta that would change a governance-hard field (`entersAlphaScore`, `paperOnly`, `dryRun`, `forbiddenFieldsFound`) requires an additional explicit sign-off recorded as a separate audit artifact before the fixture version is accepted.

---

## 7. P32 Consumption Plan

P32 should produce three artifacts: (a) one `dry-run-sample` conforming to `p32prep_report_spec_v0_dry_run_sample` covering MonthlyRevenue, (b) one `source-gate` conforming to `p32prep_report_spec_v0_source_gate` for the MonthlyRevenue source specifically, and (c) optionally one `pit-audit` if P32 re-audits PIT rules. The D1 inventory file (`p32prep_artifact_inventory.json`) provides the naming convention and phase prefix (`P32`). The GFC-03 and GFC-04 fixtures (once materialized) serve as structural regression anchors: P32's dry-run output must cover the same required fields with the same governance-hard values, and must not reduce row counts below the P31 baseline without an explicit explanation artifact.

---

## 8. Forbidden Modification Scan

Only the following paths were modified during this task:

| Path | Type |
|------|------|
| `outputs/online_validation/p32prep_artifact_inventory.json` | D1 — Created |
| `outputs/online_validation/p32prep_artifact_inventory.md` | D1 — Created |
| `outputs/online_validation/p32prep_report_spec_v0_source_gate.json` | D2 — Created |
| `outputs/online_validation/p32prep_report_spec_v0_source_gate.md` | D2 — Created |
| `outputs/online_validation/p32prep_report_spec_v0_dry_run_sample.json` | D2 — Created |
| `outputs/online_validation/p32prep_report_spec_v0_dry_run_sample.md` | D2 — Created |
| `outputs/online_validation/p32prep_report_spec_v0_pit_audit.json` | D2 — Created |
| `outputs/online_validation/p32prep_report_spec_v0_pit_audit.md` | D2 — Created |
| `outputs/online_validation/p32prep_golden_fixture_candidates.json` | D3 — Created |
| `outputs/online_validation/p32prep_golden_fixture_candidates.md` | D3 — Created |
| `outputs/online_validation/p32prep_final_report.md` | D4 — Created (this file) |
| `00-Plan/roadmap/roadmap.md` | Roadmap status update |
| `00-Plan/roadmap/CTO-Analysis.md` | CEO overlay note |

**Forbidden paths confirmed unmodified:**
- `src/lib/**` — no changes
- `prisma/**` — no changes (Chip migration NOT applied)
- `scripts/**` — no changes
- `tests/**` — no changes
- `package.json` — no changes
- Any corpus jsonl — no changes
- Any scoring file — no changes

**Forbidden claims verified absent:** No `ROI|win-rate|alpha(?!Score)|edge|profit|outperform|beat|buy|sell|guaranteed|investment recommendation` language appears in any produced artifact.

---

## 9. Test Re-Run Decision

No test re-run is required. All modifications are limited to `outputs/online_validation/p32prep_*` (design artifacts), `00-Plan/roadmap/roadmap.md` (status text), and `00-Plan/roadmap/CTO-Analysis.md` (CEO overlay text). No source files, test files, schema files, or scoring files were touched. The P31 test baseline of **3697/3701** (4 pre-existing failures) remains unchanged.

---

## 10. Final Classification

```
P32PREP_REPORT_SPEC_V0_DESIGN_READY
```

All required deliverables are complete:
- ✅ D1 — Artifact inventory (22 artifacts, 4 phases)
- ✅ D2 — Three v0 report specs (source-gate, dry-run-sample, pit-audit), each as JSON + MD pair
- ✅ D3 — Five golden fixture candidates with stability analysis
- ✅ D4 — This final report
- ✅ Roadmap update (status only)
- ✅ CTO-Analysis update (CEO overlay only)

P32 is cleared to proceed as the next P0.
