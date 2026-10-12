# P9 Baseline Consolidation — Commit Readiness Report

**Phase:** P9  
**Generated:** 2026-05-23T08:36:30Z  
**Branch:** `main`  
**HEAD:** `261cd369db68f100e7d609b85dbd8af86094249d` (P48, unchanged)

---

## 1. Verification Summary

| Check | Result |
|---|---|
| onlineValidation suite | ✅ **4846 / 4846 PASS** (127 suites) |
| Research + Simulation suite | ✅ **275 / 275 PASS** (8 suites) |
| Total tests | ✅ **5121 / 5121 PASS** |
| Total failures | ✅ **0** |
| dev.db SHA | ✅ **DB_SHA_OK** (`a5cf2771…`) |
| Context-lock scan | ✅ **CLEAN** (no P26J/K/Betting-pool/CLV/TSL) |
| Forbidden claims scan (source) | ✅ **CLEAN** (governance disclaimers only) |

---

## 2. File Classification

**Total files in scope:** 119  
✅ SAFE_TO_COMMIT: **97** | ⚠️ USER_DECISION: **3** | 🚫 MUST_NOT_COMMIT: **19**

### Phase: P1

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p1_axis_a_controlled_research_snapshot_final_report.md` | ✅ SAFE | P1 Axis A final report |
| `??` | `src/lib/research/ControlledResearchSnapshot.ts` | ✅ SAFE | P1 Axis A: controlled research snapshot type |
| `??` | `src/lib/research/ControlledResearchSnapshotBuilder.ts` | ✅ SAFE | P1 Axis A: controlled research snapshot builder |
| `??` | `src/lib/research/__tests__/controlled_research_snapshot.test.ts` | ✅ SAFE | P1/P5 Axis A: 46-case controlled research snapshot test |

### Phase: P2

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p2_p49_manifest_final_report.md` | ✅ SAFE | P2 manifest final report |

### Phase: P3

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p3_closure_final_report.md` | ✅ SAFE | P3 closure final report |
| `??` | `outputs/online_validation/p3_untracked_artifact_disposition_final_report.md` | ✅ SAFE | P3 disposition final report |
| `??` | `outputs/online_validation/untracked_artifact_disposition_plan.json` | ✅ SAFE | P3 disposition plan |
| `??` | `outputs/online_validation/untracked_artifact_disposition_plan.md` | ✅ SAFE | P3 disposition plan (md) |

### Phase: P4

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p4_axis_b_fixture_validation_readiness.md` | ✅ SAFE | P4 Axis B fixture validation readiness |
| `??` | `outputs/online_validation/p4_fixture_validation_final_report.md` | ✅ SAFE | P4 fixture validation final report |
| `??` | `src/lib/simulation/__tests__/p4_golden_fixture_validation.test.ts` | ✅ SAFE | P4 Axis B: 25-case golden fixture validation test |

### Phase: P5

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p5_axis_a_research_snapshot_extension_final_report.md` | ✅ SAFE | P5 Axis A extension final report |

### Phase: P6

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p6_axis_b_fixture_result_contract_final_report.md` | ✅ SAFE | P6 Axis B fixture result contract final report |
| `??` | `src/lib/simulation/__tests__/p6_fixture_result_contract_extension.test.ts` | ✅ SAFE | P6 Axis B: 25-case fixture result contract test |

### Phase: P7

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p7_axis_a_research_coverage_determinism_final_report.md` | ✅ SAFE | P7 Axis A coverage determinism final report |
| `??` | `src/lib/research/__tests__/p7_research_coverage_determinism.test.ts` | ✅ SAFE | P7 Axis A: 25-case research coverage determinism test |

### Phase: P8

| Git | File | Tier | Reason |
|---|---|---|---|
| `M` | `src/lib/onlineValidation/__tests__/p26a_batch_pipeline_wiring.test.ts` | ✅ SAFE | P8 SHA repair — dev.db hash updated from P29C era to canonical |
| `M` | `src/lib/onlineValidation/__tests__/p26a_renderer_fix.test.ts` | ✅ SAFE | P8 SHA repair — dev.db hash updated from P29C era to canonical |
| `M` | `src/lib/onlineValidation/__tests__/p27_waiting_state_policy_guard.test.ts` | ✅ SAFE | P8 SHA repair — dev.db hash updated from P29C era to canonical |
| `??` | `outputs/online_validation/p8_known_failure_repair_final_report.md` | ✅ SAFE | P8 known-failure repair final report |
| `??` | `src/lib/onlineValidation/__tests__/p29d_dropzone_scaffold.test.ts` | ✅ SAFE | P8 SHA repair — new file, dev.db hash canonical |

### Phase: P28

| Git | File | Tier | Reason |
|---|---|---|---|
| `M` | `outputs/online_validation/p28c_renderer_only_repair_9case_before_after.json` | ✅ SAFE | pre-existing validation artifact modified during P28 |
| `M` | `outputs/online_validation/p28d_9case_integrated_review_validation.json` | ✅ SAFE | pre-existing validation artifact modified during P28 |
| `M` | `outputs/online_validation/p28d_p3_p19_renderer_regression_sweep.json` | ✅ SAFE | pre-existing validation artifact modified during P28 |

### Phase: P29G

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p29g_preflight_final_report.md` | ✅ SAFE | P29G preflight report |
| `??` | `outputs/online_validation/p29g_preflight_forbidden_claims_scan.json` | ✅ SAFE | P29G forbidden claims scan |
| `??` | `outputs/online_validation/p29g_preflight_forbidden_claims_scan.md` | ✅ SAFE | P29G forbidden claims scan (md) |
| `??` | `outputs/online_validation/p29g_preflight_git_ancestry_audit.json` | ✅ SAFE | P29G git ancestry audit |
| `??` | `outputs/online_validation/p29g_preflight_git_ancestry_audit.md` | ✅ SAFE | P29G git ancestry audit (md) |
| `??` | `outputs/online_validation/p29g_preflight_invariance_baseline.json` | ✅ SAFE | P29G invariance baseline |
| `??` | `outputs/online_validation/p29g_preflight_invariance_baseline.md` | ✅ SAFE | P29G invariance baseline (md) |
| `??` | `outputs/online_validation/p29g_preflight_scaffold_inventory.json` | ✅ SAFE | P29G scaffold inventory |
| `??` | `outputs/online_validation/p29g_preflight_scaffold_inventory.md` | ✅ SAFE | P29G scaffold inventory (md) |
| `??` | `outputs/online_validation/p29g_preflight_test_baseline.json` | ✅ SAFE | P29G test baseline |
| `??` | `outputs/online_validation/p29g_preflight_test_baseline.md` | ✅ SAFE | P29G test baseline (md) |

### Phase: P27

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p27_overnight_deep_audit_preflight.json` | ✅ SAFE | P27 audit preflight artifact |

### Phase: P32

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p32_final_report.md` | ✅ SAFE | P32 monthly revenue final report |
| `??` | `outputs/online_validation/p32_forbidden_claims_scan.json` | ✅ SAFE | P32 forbidden claims scan |
| `??` | `outputs/online_validation/p32_monthly_revenue_dry_run_sample.json` | ✅ SAFE | P32 dry-run sample |
| `??` | `outputs/online_validation/p32_monthly_revenue_dry_run_sample.md` | ✅ SAFE | P32 dry-run sample (md) |
| `??` | `outputs/online_validation/p32_monthly_revenue_source_present_dry_run.json` | ✅ SAFE | P32 source-present dry-run |
| `??` | `outputs/online_validation/p32_monthly_revenue_source_present_dry_run.md` | ✅ SAFE | P32 source-present dry-run (md) |
| `??` | `outputs/online_validation/p32_monthly_revenue_spec_conformance.json` | ✅ SAFE | P32 spec conformance |
| `??` | `outputs/online_validation/p32_monthly_revenue_spec_conformance.md` | ✅ SAFE | P32 spec conformance (md) |
| `??` | `outputs/online_validation/p32prep_artifact_inventory.json` | ✅ SAFE | P32prep artifact inventory |
| `??` | `outputs/online_validation/p32prep_artifact_inventory.md` | ✅ SAFE | P32prep artifact inventory (md) |
| `??` | `outputs/online_validation/p32prep_final_report.md` | ✅ SAFE | P32prep final report |
| `??` | `outputs/online_validation/p32prep_golden_fixture_candidates.json` | ✅ SAFE | P32prep golden fixture candidates |
| `??` | `outputs/online_validation/p32prep_golden_fixture_candidates.md` | ✅ SAFE | P32prep golden fixture candidates (md) |
| `??` | `outputs/online_validation/p32prep_report_spec_v0_dry_run_sample.json` | ✅ SAFE | P32prep spec v0 dry-run |
| `??` | `outputs/online_validation/p32prep_report_spec_v0_dry_run_sample.md` | ✅ SAFE | P32prep spec v0 dry-run (md) |
| `??` | `outputs/online_validation/p32prep_report_spec_v0_pit_audit.json` | ✅ SAFE | P32prep spec v0 pit audit |
| `??` | `outputs/online_validation/p32prep_report_spec_v0_pit_audit.md` | ✅ SAFE | P32prep spec v0 pit audit (md) |
| `??` | `outputs/online_validation/p32prep_report_spec_v0_source_gate.json` | ✅ SAFE | P32prep spec v0 source gate |
| `??` | `outputs/online_validation/p32prep_report_spec_v0_source_gate.md` | ✅ SAFE | P32prep spec v0 source gate (md) |

### Phase: P33

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p33_final_report.md` | ✅ SAFE | P33 news-event final report |
| `??` | `outputs/online_validation/p33_financial_report_source_present_scan.json` | ✅ SAFE | P33 financial source-present scan |
| `??` | `outputs/online_validation/p33_financial_report_source_present_scan.md` | ✅ SAFE | P33 financial source-present scan (md) |
| `??` | `outputs/online_validation/p33_forbidden_claims_scan.json` | ✅ SAFE | P33 forbidden claims scan |
| `??` | `outputs/online_validation/p33_news_event_source_present_scan.json` | ✅ SAFE | P33 news-event source-present scan |
| `??` | `outputs/online_validation/p33_news_event_source_present_scan.md` | ✅ SAFE | P33 news-event source-present scan (md) |
| `??` | `outputs/online_validation/p33_source_present_gate_summary.json` | ✅ SAFE | P33 source-present gate summary |
| `??` | `outputs/online_validation/p33_source_present_gate_summary.md` | ✅ SAFE | P33 source-present gate summary (md) |
| `??` | `outputs/online_validation/p33_spec_conformance.json` | ✅ SAFE | P33 spec conformance |
| `??` | `outputs/online_validation/p33_spec_conformance.md` | ✅ SAFE | P33 spec conformance (md) |

### Phase: P34

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p34_final_report.md` | ✅ SAFE | P34 final report |
| `??` | `outputs/online_validation/p34_forbidden_claims_scan.json` | ✅ SAFE | P34 forbidden claims scan |
| `??` | `outputs/online_validation/p34_news_event_dry_run_sample.json` | ✅ SAFE | P34 news-event dry-run sample |
| `??` | `outputs/online_validation/p34_news_event_dry_run_sample.md` | ✅ SAFE | P34 news-event dry-run sample (md) |
| `??` | `outputs/online_validation/p34_news_event_pit_audit.json` | ✅ SAFE | P34 news-event pit audit |
| `??` | `outputs/online_validation/p34_news_event_pit_audit.md` | ✅ SAFE | P34 news-event pit audit (md) |
| `??` | `outputs/online_validation/p34_news_event_source_present_dry_run.json` | ✅ SAFE | P34 news-event source-present dry-run |
| `??` | `outputs/online_validation/p34_news_event_source_present_dry_run.md` | ✅ SAFE | P34 news-event source-present dry-run (md) |
| `??` | `outputs/online_validation/p34_spec_conformance.json` | ✅ SAFE | P34 spec conformance |
| `??` | `outputs/online_validation/p34_spec_conformance.md` | ✅ SAFE | P34 spec conformance (md) |

### Phase: P35

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p35_realign_decision_matrix.md` | ✅ SAFE | P35 realign decision matrix |
| `??` | `outputs/online_validation/p35_realign_final_report.md` | ✅ SAFE | P35 realign final report |
| `??` | `outputs/online_validation/p35_realign_next_implementation_p0.md` | ✅ SAFE | P35 realign next impl plan |
| `??` | `outputs/online_validation/p35_realign_untracked_disposition_plan.json` | ✅ SAFE | P35 realign disposition plan |
| `??` | `outputs/online_validation/p35_realign_untracked_disposition_plan.md` | ✅ SAFE | P35 realign disposition plan (md) |

### Phase: P49

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `outputs/online_validation/p49_ledger_context_lock_scan.json` | ✅ SAFE | P49 ledger context-lock scan |
| `??` | `outputs/online_validation/p49_ledger_context_lock_scan.md` | ✅ SAFE | P49 ledger context-lock scan (md) |
| `??` | `outputs/online_validation/p49_ledger_final_report.md` | ✅ SAFE | P49 ledger final report |
| `??` | `outputs/online_validation/p49_ledger_full_suite_baseline.json` | ✅ SAFE | P49 ledger full-suite baseline |
| `??` | `outputs/online_validation/p49_ledger_full_suite_baseline.md` | ✅ SAFE | P49 ledger full-suite baseline (md) |
| `??` | `outputs/online_validation/p49_ledger_known_failures.json` | ✅ SAFE | P49 ledger known failures |
| `??` | `outputs/online_validation/p49_ledger_known_failures.md` | ✅ SAFE | P49 ledger known failures (md) |
| `??` | `outputs/online_validation/p49_manifest_p39_p48.json` | ✅ SAFE | P49 manifest p39–p48 |
| `??` | `outputs/online_validation/p49_manifest_p39_p48.md` | ✅ SAFE | P49 manifest p39–p48 (md) |

### Phase: roadmap

| Git | File | Tier | Reason |
|---|---|---|---|
| `M` | `00-Plan/roadmap/roadmap.md` | ✅ SAFE | roadmap with P1–P9 overlays appended |
| `M` | `00-Plan/roadmap/CTO-Analysis.md` | ✅ SAFE | pre-existing planning modification |
| `??` | `00-Plan/roadmap/active_task.md` | ✅ SAFE | active task tracking document |
| `??` | `00-Plan/roadmap/CEO-Decision.md` | ✅ SAFE | CTO/CEO decision log |

### Phase: scripts

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `scripts/generate_artifacts.py` | ✅ SAFE | utility artifact-generation script |
| `??` | `scripts/p28c_9case_validation.js` | ✅ SAFE | P28C 9-case validation script |
| `??` | `scripts/verify_p34.py` | ✅ SAFE | P34 verification script |

### Phase: stock-plan

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `00-StockPlan/20260514/cto_analysis_20260514.md` | ⚠️ USER_DECISION | daily stock plan — commit only if user intends to track |
| `??` | `00-StockPlan/20260515/20260515.md` | ⚠️ USER_DECISION | daily stock plan — commit only if user intends to track |
| `??` | `00-StockPlan/20260515/cto_analysis_20260515.md` | ⚠️ USER_DECISION | daily stock plan — commit only if user intends to track |

### Phase: data

| Git | File | Tier | Reason |
|---|---|---|---|
| `??` | `data/manual/financial-report/p29b-dropzone/EXPECTED_FILENAMES.md` | 🚫 MUST_NOT | data/ governance exclusion |
| `??` | `data/manual/financial-report/p29b-dropzone/EXPECTED_SCHEMA.json` | 🚫 MUST_NOT | data/ governance exclusion |
| `??` | `data/manual/financial-report/p29b-dropzone/SOURCE_MANIFEST_TEMPLATE.json` | 🚫 MUST_NOT | data/ governance exclusion |
| `??` | `data/manual/financial-report/p29b-dropzone/TEMPLATE_DO_NOT_IMPORT_financial_report_sample.csv` | 🚫 MUST_NOT | data/ governance exclusion — DO_NOT_IMPORT template |
| `??` | `data/manual/news-event/p29b-dropzone/EXPECTED_FILENAMES.md` | 🚫 MUST_NOT | data/ governance exclusion |
| `??` | `data/manual/news-event/p29b-dropzone/EXPECTED_SCHEMA.json` | 🚫 MUST_NOT | data/ governance exclusion |
| `??` | `data/manual/news-event/p29b-dropzone/SOURCE_MANIFEST_TEMPLATE.json` | 🚫 MUST_NOT | data/ governance exclusion |
| `??` | `data/manual/news-event/p29b-dropzone/TEMPLATE_DO_NOT_IMPORT_news_event_sample.csv` | 🚫 MUST_NOT | data/ governance exclusion — DO_NOT_IMPORT template |

### Phase: runtime

| Git | File | Tier | Reason |
|---|---|---|---|
| `M` | `logs/launchd/backend.stderr.log` | 🚫 MUST_NOT | runtime log |
| `M` | `logs/launchd/backend.stdout.log` | 🚫 MUST_NOT | runtime log |
| `M` | `logs/launchd/main-service.stderr.log` | 🚫 MUST_NOT | runtime log |
| `M` | `logs/launchd/main-service.stdout.log` | 🚫 MUST_NOT | runtime log |
| `M` | `logs/launchd/planner-tick.stderr.log` | 🚫 MUST_NOT | runtime log |
| `M` | `logs/launchd/planner-tick.stdout.log` | 🚫 MUST_NOT | runtime log |
| `M` | `logs/launchd/start_all.log` | 🚫 MUST_NOT | runtime log |
| `M` | `logs/launchd/stop_all.log` | 🚫 MUST_NOT | runtime log |
| `M` | `logs/launchd/worker-tick.stderr.log` | 🚫 MUST_NOT | runtime log |
| `M` | `logs/launchd/worker-tick.stdout.log` | 🚫 MUST_NOT | runtime log |
| `M` | `runtime/agent_orchestrator/pids/backend.pid` | 🚫 MUST_NOT | runtime PID file |

---

## 3. Commit Readiness Verdict

```
P9_BASELINE_CONSOLIDATION_PARTIAL_USER_DECISION_REQUIRED
```

**Reason:** 3 daily stock plan files under `00-StockPlan/20260514/` and `00-StockPlan/20260515/` require user decision on whether to track in git.

---

## 4. Recommended Commit Grouping

Once user decides on `00-StockPlan/` files, the safe commit command is:

```bash
# Group A — Source repairs + new source (P1, P4, P6, P7, P8)
git add \
  src/lib/onlineValidation/__tests__/p26a_batch_pipeline_wiring.test.ts \
  src/lib/onlineValidation/__tests__/p26a_renderer_fix.test.ts \
  src/lib/onlineValidation/__tests__/p27_waiting_state_policy_guard.test.ts \
  src/lib/onlineValidation/__tests__/p29d_dropzone_scaffold.test.ts \
  src/lib/research/ControlledResearchSnapshot.ts \
  src/lib/research/ControlledResearchSnapshotBuilder.ts \
  src/lib/research/__tests__/controlled_research_snapshot.test.ts \
  src/lib/research/__tests__/p7_research_coverage_determinism.test.ts \
  src/lib/simulation/__tests__/p4_golden_fixture_validation.test.ts \
  src/lib/simulation/__tests__/p6_fixture_result_contract_extension.test.ts

# Group B — Roadmap + outputs + scripts
git add \
  00-Plan/roadmap/roadmap.md \
  00-Plan/roadmap/CTO-Analysis.md \
  00-Plan/roadmap/active_task.md \
  00-Plan/roadmap/CEO-Decision.md \
  outputs/online_validation/ \
  scripts/generate_artifacts.py \
  scripts/p28c_9case_validation.js \
  scripts/verify_p34.py

# EXCLUDE (never add):
#   logs/launchd/
#   runtime/agent_orchestrator/pids/
#   data/manual/
```

---

## 5. Governance Invariants Verified

| Invariant | Status |
|---|---|
| `prisma/**` unchanged | ✅ Confirmed (no prisma diff) |
| `data/**` not staged | ✅ MUST_NOT_COMMIT classification enforced |
| `package.json` / `package-lock.json` unchanged | ✅ Confirmed (not in diff) |
| `alphaScore` / scoring formula unchanged | ✅ Confirmed (only governance tests reference alphaScore) |
| `entersAlphaScore=false`, `paperOnly=true`, `dryRunOnly=true` | ✅ Confirmed (P8 files governance-compliant) |
| No real execution / no actual metrics | ✅ Confirmed |
| `executedAt=null`, `noRealExecution=true` | ✅ Confirmed |
