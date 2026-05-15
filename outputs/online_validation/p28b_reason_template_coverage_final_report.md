# P28B — Reason Template Coverage Repair Plan — Final Report

**Phase**: P28B-REASON-TEMPLATE-COVERAGE-HARDRESET  
**Classification**: `P28B_REASON_TEMPLATE_COVERAGE_PLAN_READY`

---

## 1. Summary

P28B audited 9 underoutput cases identified in P28A and produced a complete renderer repair plan.  
All proposed repairs are **renderer-only / template-only**. No scoring formula change is required or permitted.

---

## 2. Root Cause — Two Repair Families

### Family 1: `scoreSnapshot_zero_label` — 5 cases

**Cases**: P5-CASE-010, 011, 013, 053, 055  
**Symbols**: 1710, 00738U  

`P5WalkthroughReviewUtils.ts::reviewWalkthroughCase()` constructs `minimalSnapshot` with hardcoded zeros:
```ts
scoreSnapshot: { technicalScore: 0, chipScore: 0, momentumScore: 0, revenueScore: 0 }
```
This causes `enrichReasonFromExistingFactors()` to infer direction = `'偏空'` even when MA shows `多頭排列`.

**Fix**: Pass actual `scoreSnapshot` from corpus through `WalkthroughCaseInput`.  
Fallback: Add `inferDirectionFromMATrend(factorSnapshot)` pure function.

### Family 2: `mixed_signals_no_template` — 4 cases

**Cases**: P5-CASE-023, 026, 037, 054  
**Symbol**: 00891  

MA shows `空頭排列` but MACD shows `多方動能` — contradictory signals with no unified template.  
Renderer produces generic single-token output with no context.

**Fix**: Add mixed-signal aggregation template (TR-03) outputting neutral context with explicit signal conflict explanation.

---

## 3. Template Rules (6 total)

| Rule | Name | Target File |
|---|---|---|
| TR-01 | scoreSnapshot passthrough | P26ACorpusRowAdapter.ts, P5WalkthroughReviewUtils.ts |
| TR-02 | inferDirectionFromMATrend fallback | P26AReasonFactorEnrichmentUtils.ts |
| TR-03 | Mixed-signal aggregation template | P26ACorpusReasonRenderer.ts |
| TR-04 | NO_TRIGGERED_FACTOR context note | P26ACorpusReasonRenderer.ts |
| TR-05 | Monthly revenue missing inline note | P26ACorpusReasonRenderer.ts |
| TR-06 | rendererVersion bump | P26ACorpusReasonRenderer.ts |

---

## 4. Artifacts Created (14 total)

| Artifact | Status |
|---|---|
| p28b_reason_template_coverage_preflight.json/.md | ✅ |
| p28b_p28a_findings_recap.json/.md | ✅ |
| p28b_reason_renderer_path_trace.json/.md | ✅ |
| p28b_reason_template_coverage_gap_matrix.json/.md | ✅ |
| p28b_reason_template_repair_spec.json/.md | ✅ |
| p28b_reason_template_fixture_plan.json/.md | ✅ |
| p28b_readonly_prototype_result.json/.md | ✅ |
| p28b_reason_template_coverage_invariance.json/.md | ✅ |
| p28b_reason_template_coverage_tests.json/.md | ✅ |
| p28b_reason_template_coverage_forbidden_claims_scan.json/.md | ✅ |
| p28b_reason_template_coverage_final_report.md | ✅ (this file) |
| p28_next_prompt_renderer_repair_only.md | ⏳ PART L |
| src/lib/onlineValidation/P28BReasonTemplateCoveragePlanner.ts | ✅ |
| src/lib/onlineValidation/__tests__/p28b_reason_template_coverage_plan.test.ts | ✅ |

---

## 5. Test Results

| Suite | Result |
|---|---|
| p27_waiting_state_policy_guard | ✅ PASS |
| p27_artifact_index_consistency | ✅ PASS |
| p28b_reason_template_coverage_plan (48 tests) | ✅ PASS |
| Full `__tests__` suite (96 suites, 2933 tests) | ✅ PASS |

---

## 6. Invariance

All frozen file SHA256 hashes confirmed unchanged.  
All 9 underoutput case alphaScores and buckets unchanged.  
Corpus row counts unchanged.

---

## 7. Forbidden Claims Scan

**Result**: ✅ CLEAN — No investment recommendations in output artifacts.

---

## 8. Final Classification

**`P28B_REASON_TEMPLATE_COVERAGE_PLAN_READY`**

- Repair plan is renderer-only, no scoring formula change
- No alphaScore change, no bucket change
- No DB write, no corpus change
- All tests pass
- Forbidden claims: CLEAN
- Frozen files: UNCHANGED

*Observability only. No investment recommendations.*
