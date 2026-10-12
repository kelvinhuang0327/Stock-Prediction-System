# P40 — Test Baseline

**Phase:** P40  
**Task:** Paper Simulation Framework Design Gate  
**Test Run:** 2026-05-21

---

## P40 Targeted Tests

**File:** `src/lib/onlineValidation/__tests__/p40_paper_simulation_framework_design_gate.test.ts`

**Result:** ✅ 118/118 PASS

| Group | Tests | Status |
|-------|-------|--------|
| Group 1 — Framework governance invariants | 10 | ✅ PASS |
| Group 2 — Framework accepts P39 input bundle | 5 | ✅ PASS |
| Group 3 — Framework phase and mode | 5 | ✅ PASS |
| Group 4 — Execution is blocked | 5 | ✅ PASS |
| Group 5 — Eligible sources (MonthlyRevenue, Quote, Regime) | 5 | ✅ PASS |
| Group 6 — Blocked sources (NewsEvent, FinancialReport, Chip) | 8 | ✅ PASS |
| Group 7 — Validator accepts valid framework plan | 5 | ✅ PASS |
| Group 8 — Validator rejects invalid framework plans | 12 | ✅ PASS |
| Group 9 — assertNoSimulationExecution | 10 | ✅ PASS |
| Group 10 — summarizeFrameworkReadiness | 7 | ✅ PASS |
| Group 11 — Forbidden outputs and uses constants | 13 | ✅ PASS |
| Group 12 — No forbidden outputs appear as plan result fields | 12 | ✅ PASS |
| Group 13 — Isolation and governance | 8 | ✅ PASS |
| Group 14 — P39 contract regression | 5 | ✅ PASS |
| Group 15 — No simulation execution function is implemented | 8 | ✅ PASS |
| **Total** | **118** | ✅ **PASS** |

---

## Regression Tests

| Suite | Tests | Status |
|-------|-------|--------|
| P39 `p39_paper_simulation_input_contract.test.ts` | 77/77 | ✅ PASS |
| P38 `p38_simulation_input_readiness_mapping.test.ts` | 55/55 | ✅ PASS |

---

## Full onlineValidation Suite

| Metric | Value |
|--------|-------|
| Suites total | 119 |
| Suites passed | 115 |
| Suites failed | 4 |
| Tests total | 4061 |
| Tests passed | 4057 |
| Tests failed | 4 |

**Pre-existing failures (unrelated to P40):**
- `p26a_batch_pipeline_wiring.test.ts` — DB hash drift
- `p26a_renderer_fix.test.ts` — DB hash drift
- `p27_waiting_state_policy_guard.test.ts` — DB hash drift
- `p29d_dropzone_scaffold.test.ts` — DB hash drift

These 4 failures are pre-existing (present before P40) and are caused by runtime DB changes to `prisma/dev.db`. They are unrelated to P40.

---

## Forbidden Diff

`prisma/dev.db` and `runtime/agent_orchestrator/llm_usage.jsonl` appear in diff but are classified as runtime-only and **will not be committed**.

**Verdict:** CLEAN (no forbidden files will be committed)

---

**Classification:** `P40_TEST_BASELINE_PASS`
