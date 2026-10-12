# P35-REALIGN — Untracked Artifact Disposition Plan

**Phase:** P35-REALIGN  
**Date:** 2026-05-21  
**Total untracked entries:** 42  
**Plan only — no git operations executed**

---

## Disposition Summary

| Disposition | Count |
|-------------|-------|
| COMMIT_WITH_RETENTION | 41 |
| RELOCATE | 1 (verify_p34.py → scripts/) |
| RETIRE_WITH_RATIONALE | 0 |
| DELETE | 0 |

---

## Group 1: p32prep outputs (11 files) — COMMIT_WITH_RETENTION

**Proposed commit:** `P32PREP: Add dry-run spec scaffolding and artifact inventory`

| Path | Rationale |
|------|-----------|
| p32prep_artifact_inventory.json/.md | Canonical P32PREP artifact inventory |
| p32prep_final_report.md | Phase gate report |
| p32prep_golden_fixture_candidates.json/.md | MonthlyRevenue fixture candidate list; input for future fixture materialization |
| p32prep_report_spec_v0_dry_run_sample.json/.md | v0 spec schema for dry-run sample; referenced by P32/P33/P34 conformance |
| p32prep_report_spec_v0_pit_audit.json/.md | v0 spec schema for PIT audit; referenced by P32/P33/P34 |
| p32prep_report_spec_v0_source_gate.json/.md | v0 spec schema for source-gate; referenced by P33/P34 |

---

## Group 2: p32 outputs (8 files) — COMMIT_WITH_RETENTION

**Proposed commit:** `P32: Add MonthlyRevenue source-present dry-run artifacts`

| Path | Rationale |
|------|-----------|
| p32_monthly_revenue_source_present_dry_run.json/.md | Core dry-run gate evidence; primary artifact for PROMOTE decision |
| p32_monthly_revenue_dry_run_sample.json/.md | Stratified sample with PIT trace; reference for Feature Consumer DESIGN |
| p32_monthly_revenue_spec_conformance.json/.md | FULL_CONFORMANCE evidence |
| p32_forbidden_claims_scan.json | Governance CLEAN evidence |
| p32_final_report.md | Phase completion gate report |

---

## Group 3: p33 outputs (10 files) — COMMIT_WITH_RETENTION

**Proposed commit:** `P33: Add FinancialReport+NewsEvent source-present gate artifacts`

| Path | Rationale |
|------|-----------|
| p33_financial_report_source_present_scan.json/.md | BLOCK evidence; required for migration authorization workflow |
| p33_news_event_source_present_scan.json/.md | ELIGIBLE evidence; RECORDED_FROM_SOURCE PIT policy documented |
| p33_source_present_gate_summary.json/.md | Multi-source summary; NEWS_ONLY_SOURCE_PRESENT_GATE_READY classification |
| p33_spec_conformance.json/.md | GOVERNANCE_ALIGNED evidence |
| p33_forbidden_claims_scan.json | Governance CLEAN evidence |
| p33_final_report.md | Phase completion gate report |

---

## Group 4: p34 outputs (10 files) — COMMIT_WITH_RETENTION

**Proposed commit:** `P34: Add NewsEvent source-present dry-run sample artifacts`

| Path | Rationale |
|------|-----------|
| p34_news_event_source_present_dry_run.json/.md | Core dry-run gate evidence; 1018/1018 READY |
| p34_news_event_dry_run_sample.json/.md | Stratified sample (official/mainstream/secondary); reference for NewsEvent consumer |
| p34_news_event_pit_audit.json/.md | PIT PASS; RECORDED confidence; 0 nulls, 0 anomalies — strongest PIT result in system |
| p34_spec_conformance.json/.md | FULL_CONFORMANCE evidence |
| p34_forbidden_claims_scan.json | Governance CLEAN evidence |
| p34_final_report.md | Phase completion gate report |

---

## Group 5: data/manual dropzone templates (10 files) — COMMIT_WITH_RETENTION

**Proposed commit:** `data/manual: Add p29b dropzone templates for FinancialReport and NewsEvent`

| Path | Rationale |
|------|-----------|
| data/manual/financial-report/p29b-dropzone/ (5 files) | Schema templates, README, import instructions. Required when FinancialReport block is lifted. |
| data/manual/news-event/p29b-dropzone/ (5 files) | Same for NewsEvent. |

---

## Group 6: repo root — RELOCATE

| Path | Disposition | Destination | Rationale |
|------|-------------|-------------|-----------|
| verify_p34.py | RELOCATE | `scripts/verify_p34.py` | Phase-specific verification script; belongs in `scripts/` per repo convention. Provides executable P34 audit trail. Command (not executed here): `mv verify_p34.py scripts/verify_p34.py` |

---

## Proposed Commit Sequence

```
1. P32PREP: Add dry-run spec scaffolding and artifact inventory
2. P32: Add MonthlyRevenue source-present dry-run artifacts
3. P33: Add FinancialReport+NewsEvent source-present gate artifacts
4. P34: Add NewsEvent source-present dry-run sample artifacts
5. data/manual: Add p29b dropzone templates for FinancialReport and NewsEvent
6. scripts: Relocate verify_p34.py from repo root to scripts/
```

**Note:** Commits should land **after** D3 (next implementation P0) is executed and the src/ task completes, OR can be grouped as a single pre-P36 hygiene commit before starting the src/ round. No auto-squash with the P35 artifacts commit.

---

*Governance: entersAlphaScore=false. No investment advice. Plan only — no git operations executed.*
