# P32PREP — Golden Fixture Candidates

**capturedAt:** 2026-05-21  
**designOnly:** true  

> Disclaimer: Design-only golden fixture candidate list. Does not constitute investment advice. No profit, return, or investment performance claims are made.

---

## Summary

| Stat | Value |
|------|-------|
| Total candidates | 5 |
| pit-audit candidates | 1 |
| source-gate candidates | 1 |
| dry-run-sample candidates | 3 |
| Fixture directory status | NOT_CREATED — design only |

Proposed fixture paths are under `outputs/online_validation/fixtures/` — **DO NOT create fixture files until P32 explicitly authorizes fixture materialization.**

---

## Candidates

### GFC-01 — P29I PIT Audit Scan

| Property | Value |
|----------|-------|
| Source artifact | `outputs/online_validation/p29i_pit_audit_scan.json` |
| Proposed fixture | `outputs/online_validation/fixtures/p29i_pit_audit_scan_fixture_v1.json` |
| Spec alignment | `pit-audit` (p32prep_report_spec_v0_pit_audit) |

**Reason:** The P29I PIT audit scan is the canonical PSR-01..15 rule-check baseline for Quote, Regime, and Chip. Its structure (sourceOutputs per source, ruleChecks array) is stable at HEAD `a6fb753` and will only change if a new source is admitted or a rule is added. It serves as the regression anchor for all future pit-audit artifacts.

**Stability:**
- **Stable under:** Phase progression (P32/P33) without new source admission; DB migration with no source model changes
- **Changes on:** Addition of new audited source; PSR rule set extension beyond PSR-15
- **Stability window:** Until FinancialReport or NewsEvent source admission gate opens

**Governance note:** Chip result is `WARN_ASSUMPTION_REQUIRED` — fixture must not change this to `PASS_PIT_SAFE` without a dedicated Chip lag evidence gate.

---

### GFC-02 — P29I Source Path Inventory

| Property | Value |
|----------|-------|
| Source artifact | `outputs/online_validation/p29i_source_path_inventory.json` |
| Proposed fixture | `outputs/online_validation/fixtures/p29i_source_path_inventory_fixture_v1.json` |
| Spec alignment | `source-gate` (p32prep_report_spec_v0_source_gate) |

**Reason:** The P29I source path inventory is the canonical map of all sources to pipeline path, DB table, PIT gate status, and audit conclusion. It documents the structural relationship between source name and alphaScore entry path. Fixtures allow regression tests to verify that a new phase has not accidentally upgraded a blocked source or changed the DB table for an approved source.

**Stability:**
- **Stable under:** MonthlyRevenue releaseDate policy changes; P32 dry-run execution (read-only); roadmap priority changes
- **Changes on:** Addition of FinancialReport DB table; Chip `availableAt` migration apply that changes `asOfDateHandling`
- **Stability window:** Until P30B Chip migration is applied or a new source gate is opened

**Governance note:** MonthlyRevenue entry must remain `STRUCTURAL_PLACEHOLDER_ONLY` or `NOT_IN_ALPHA_SCORE_SOURCE_ABSENT`; FinancialReport and NewsEvent must remain `BLOCKED`.

---

### GFC-03 — P31 MonthlyRevenue Dry-Run Sample

| Property | Value |
|----------|-------|
| Source artifact | `outputs/online_validation/p31_monthly_revenue_dry_run_sample.json` |
| Proposed fixture | `outputs/online_validation/fixtures/p31_monthly_revenue_dry_run_sample_fixture_v1.json` |
| Spec alignment | `dry-run-sample` (p32prep_report_spec_v0_dry_run_sample) |

**Reason:** This is the flattest, most compact representation of a MonthlyRevenue source-present dry-run result and the primary output contract that P32 will use as its schema anchor. Pinning it as a fixture lets P32 regression tests assert that its own output matches or supersedes the structural guarantees recorded here.

**Stability:**
- **Stable under:** P32 adding new optional fields (additive); roadmap priority changes; Chip schema migration apply
- **Changes on:** New MonthlyRevenue sync exceeding 2143 rows; policy confidence upgrade from `LOW` to higher tier
- **Stability window:** Until new MonthlyRevenue sync or policy upgrade

**Governance note:** `entersAlphaScore=false`, `paperOnly=true`, `dryRun=true` are hard constraints — must not be relaxed in any fixture derivative.

---

### GFC-04 — P31 MonthlyRevenue Dry-Run Gate Scan

| Property | Value |
|----------|-------|
| Source artifact | `outputs/online_validation/p31_monthly_revenue_dry_run_gate_scan.json` |
| Proposed fixture | `outputs/online_validation/fixtures/p31_monthly_revenue_dry_run_gate_scan_fixture_v1.json` |
| Spec alignment | `dry-run-sample` (p32prep_report_spec_v0_dry_run_sample) |

**Reason:** The P31 gate scan provides DB-level evidence for the P31 dry-run sample. Pinning it as a companion to GFC-03 enables two-level regression: (a) structural (same fields, governance flags) and (b) data-level (same `totalRows=2143`, same SQL pattern, same policy). It also documents the explicit DB query, making it an auditable record of what "ready" meant at P31 HEAD.

**Stability:**
- **Stable under:** P32 read-only gate scan reusing same SQL query; Chip migration (different table)
- **Changes on:** New MonthlyRevenue rows synced; DB migration changing query method; policy upgrade
- **Stability window:** Until next MonthlyRevenue sync event or DB migration

**Governance note:** `blockedRows` must remain `0` unless a genuine leakage-risk row is introduced. Any change to `totalRows` must be accompanied by a preflight audit explaining the delta.

---

### GFC-05 — P29G Dry-Run Sample Output

| Property | Value |
|----------|-------|
| Source artifact | `outputs/online_validation/p29g_dry_run_sample_output.json` |
| Proposed fixture | `outputs/online_validation/fixtures/p29g_dry_run_sample_output_fixture_v1.json` |
| Spec alignment | `dry-run-sample` (p32prep_report_spec_v0_dry_run_sample) |

**Reason:** The P29G dry-run sample is the earliest scaffold-level dry-run artifact and establishes baseline simulation boundary semantics: `scoringMutation=false`, `corpusMutation=false`, `optimizerExecuted=false`, `realBacktestExecuted=false`, `notInvestmentRecommendation=true`. Pinning it as a fixture allows regression tests to assert that later dry-run artifacts (P31, P32) continue to assert the same simulation boundary flags without regression.

**Stability:**
- **Stable under:** P32 execution with MonthlyRevenue source; Chip migration apply; corpus expansion
- **Changes on:** `p29gContractVersion` upgrade; `sourceClassifications` list expansion with new source admission
- **Stability window:** Until P29G contract version is superseded by a new simulation runner

**Governance note:** `sourceClassifications` for FinancialReport and NewsEvent must remain `HIGH_RISK_SOURCE_ABSENT` unless those sources pass their dedicated admission gates.

---

## Anti-Drift Rule

All golden fixtures must be version-tagged (e.g. `_fixture_v1`) and updated only via an explicit phase gate artifact — not silently overwritten by CI reruns or data syncs. Any fixture delta requires a recorded `changeDrivers` justification before the fixture version is incremented.
